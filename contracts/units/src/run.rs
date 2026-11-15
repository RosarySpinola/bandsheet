//! Release proposals, council votes, and the engine run. A proposal passes when more than half of the council
//! seats it was made under approve; the passing call starts the OutLayer run over that unit's entries and history.
//!
//! Two runs go out together when the unit has employer DKIM keys and real (non-synthetic) entries:
//!  1. the release itself, policy require_dkim=false, so DKIM, self-attested and synthetic entries all count;
//!  2. a count run, require_dkim=true with the unit's issuer keys, history null and a filter that matches no one,
//!     so it publishes no cells and only reports how many entries' employer emails verified (entries_verified).
//! The engine is not changed: both are ordinary requests to the same project and build.
use near_sdk::json_types::U64;
use near_sdk::serde_json::{self, Map, Value};
use near_sdk::{env, near, require, AccountId, Gas, NearToken, PromiseError};

use crate::outlayer;
use crate::util::{self, emit, stamp_query};
use crate::{Proposal, Unit, UnitInFlight, UnitRelease, Units, UnitsExt, OPEN_PROPOSALS, PROPOSALS_PER_DAY, RELEASES_PER_DAY, RUNS_PER_DAY_TOTAL};

const CALLBACK_GAS: Gas = Gas::from_tgas(40);
const RESERVE_GAS: Gas = Gas::from_tgas(30);
const COUNT_RESERVE_GAS: Gas = Gas::from_tgas(15);
const MIN_RUN_GAS: Gas = Gas::from_tgas(100);
const DAY_NS: u64 = 86_400_000_000_000;
const STALE_NS: u64 = 600_000_000_000;
const EXPIRY_NS: u64 = 7 * DAY_NS;
/// Largest release record (cells, witnesses, proof, history) the callback stores; a larger answer is logged as an error.
const MAX_STORED: usize = 96 * 1024;
const PROOF_KEYS: [&str; 8] = ["attestation", "signature", "public_key", "quote", "tee", "report_data", "request_id", "worker"];
const STATUSES: [&str; 3] = ["released", "partially_released", "refused"];
/// A grade no entry can have: the count run groups nobody and publishes nothing.
const COUNT_FILTER: &str = "(dkim count only)";

fn text(v: &Value, key: &str) -> String {
    v.get(key).and_then(Value::as_str).unwrap_or_default().to_string()
}

fn json_of(v: &Value, key: &str, empty: &str) -> String {
    match v.get(key) {
        Some(x) if !x.is_null() => x.to_string(),
        _ => empty.to_string(),
    }
}

enum Out {
    Output(Vec<u8>, Value),
    Unreadable(Vec<u8>, &'static str),
    Failed,
}

/// outlayer::read_result for promise index `i` (the joint callback reads two).
fn read_at(i: u64) -> Out {
    match env::promise_result_checked(i, outlayer::MAX_OUT) {
        Ok(bytes) => match serde_json::from_slice::<Value>(&bytes) {
            Ok(Value::Null) => Out::Unreadable(bytes, "OutLayer returned no result (failed or timed out)"),
            Ok(v) if v.is_object() => Out::Output(bytes, v),
            _ => Out::Unreadable(bytes, "OutLayer output was not a JSON object"),
        },
        Err(PromiseError::Failed) => Out::Failed,
        Err(_) => Out::Unreadable(Vec::new(), "OutLayer output too large"),
    }
}

fn passes(p: &Proposal) -> bool {
    p.approvals.len() * 2 > p.council.len()
}

fn cannot_pass(p: &Proposal) -> bool {
    (p.council.len() - p.rejections.len()) * 2 <= p.council.len()
}

fn prune(u: &mut Unit) {
    let now = env::block_timestamp();
    u.recent_runs.retain(|t| now.saturating_sub(*t) < DAY_NS);
    u.recent_proposals.retain(|t| now.saturating_sub(*t) < DAY_NS);
}

fn expired(p: &Proposal) -> bool {
    env::block_timestamp().saturating_sub(p.created_at.0) >= EXPIRY_NS
}

#[near]
impl Units {
    /// Council: propose a release. The proposer's approval counts, so on a one-seat council the proposal passes
    /// and runs in this same call (attach 300 Tgas). Returns the proposal id (per unit, from 1).
    pub fn unit_propose_release(&mut self, unit_id: u32, query: String) -> u64 {
        let (mut u, by) = self.council_unit(unit_id);
        let query = stamp_query(&query, 0);
        prune(&mut u);
        self.expire_open(&mut u);
        require!((u.open.len() as u32) < OPEN_PROPOSALS, format!("A unit has at most {OPEN_PROPOSALS} open proposals"));
        require!((u.recent_proposals.len() as u32) < PROPOSALS_PER_DAY, format!("A unit can make at most {PROPOSALS_PER_DAY} proposals in 24 hours"));
        require!((u.recent_runs.len() as u32) < RELEASES_PER_DAY, format!("This unit already ran {RELEASES_PER_DAY} releases in the last 24 hours"));
        util::require_floor();
        u.proposals += 1;
        let id = u.proposals;
        u.open.push(id);
        u.recent_proposals.push(env::block_timestamp());
        let mut p = Proposal {
            id,
            unit_id,
            query,
            proposer: by.clone(),
            created_at: U64(env::block_timestamp()),
            council: u.council.clone(),
            approvals: vec![by.clone()],
            rejections: Vec::new(),
            status: "open".to_string(),
            release_id: None,
        };
        self.save(u);
        emit("proposal_created", &format!("{{\"unit_id\":{unit_id},\"proposal_id\":{id},\"proposer\":\"{by}\",\"query\":{}}}", p.query));
        if passes(&p) {
            self.execute(&mut p, &by);
        }
        self.proposals.insert((unit_id, id), p);
        id
    }

    /// Council: vote on an open proposal. Only the seats it was made under vote, once each. When approvals pass
    /// more than half, this call starts the engine run (attach 300 Tgas). Returns the proposal's new status.
    pub fn unit_vote(&mut self, unit_id: u32, proposal_id: u64, approve: bool) -> String {
        let caller = env::predecessor_account_id();
        let mut p = self.proposals.get(&(unit_id, proposal_id)).cloned().unwrap_or_else(|| env::panic_str(&format!("No proposal {proposal_id} in unit {unit_id}")));
        require!(p.status == "open", format!("Proposal {proposal_id} is {}; voting is closed", p.status));
        require!(!expired(&p), format!("Proposal {proposal_id} has expired (7 days); voting is closed"));
        require!(p.council.contains(&caller), format!("Refused: {caller} did not hold a seat when proposal {proposal_id} was made"));
        require!(!p.approvals.contains(&caller) && !p.rejections.contains(&caller), format!("{caller} has already voted on proposal {proposal_id}"));
        if approve {
            p.approvals.push(caller.clone());
        } else {
            p.rejections.push(caller.clone());
        }
        emit("vote_cast", &format!("{{\"unit_id\":{unit_id},\"proposal_id\":{proposal_id},\"voter\":\"{caller}\",\"approve\":{approve}}}"));
        if passes(&p) {
            self.execute(&mut p, &caller);
        } else if cannot_pass(&p) {
            p.status = "rejected".to_string();
            self.close(unit_id, proposal_id);
        }
        let status = p.status.clone();
        self.proposals.insert((unit_id, proposal_id), p);
        status
    }

    /// The proposer withdraws an open proposal (for example when a seat is unreachable and it can never pass).
    pub fn unit_withdraw_proposal(&mut self, unit_id: u32, proposal_id: u64) {
        let caller = env::predecessor_account_id();
        let mut p = self.proposals.get(&(unit_id, proposal_id)).cloned().unwrap_or_else(|| env::panic_str(&format!("No proposal {proposal_id} in unit {unit_id}")));
        require!(p.proposer == caller, "Only the proposer can withdraw a proposal");
        require!(p.status == "open", format!("Proposal {proposal_id} is {}", p.status));
        p.status = "withdrawn".to_string();
        self.proposals.insert((unit_id, proposal_id), p);
        self.close(unit_id, proposal_id);
        emit("proposal_withdrawn", &format!("{{\"unit_id\":{unit_id},\"proposal_id\":{proposal_id}}}"));
    }

    /// Council: unfreeze a unit whose engine run never answered (after 10 minutes). The release number is used up
    /// by an error record, so a late answer can never land under another proposal's number.
    pub fn unit_clear_stale(&mut self, unit_id: u32) {
        let (mut u, by) = self.council_unit(unit_id);
        let f = u.in_flight.clone().unwrap_or_else(|| env::panic_str("No release is running"));
        require!(env::block_timestamp() > f.requested_at.0 + STALE_NS, "The release is not stale yet (10 minutes)");
        u.in_flight = None;
        u.releases = f.release_id;
        self.save(u);
        let mut rec = Self::blank(unit_id, f.release_id, f.proposal_id, String::new(), String::new(), f.requested_by);
        rec.wasm_sha256 = self.policy.wasm_sha256.clone();
        rec.note = format!("The engine did not answer within 10 minutes; cleared by {by}");
        self.releases.insert((unit_id, f.release_id), rec);
        self.releases_total += 1;
        if let Some(mut p) = self.proposals.get(&(unit_id, f.proposal_id)).cloned() {
            p.status = "executed".to_string();
            self.proposals.insert((unit_id, f.proposal_id), p);
        }
        emit("release_logged", &format!("{{\"unit_id\":{unit_id},\"id\":{},\"status\":\"error\"}}", f.release_id));
    }

    /// OutLayer's answer(s). Appends one record whatever came back; a refusal and a failed run are logged too.
    #[private]
    #[allow(clippy::too_many_arguments)]
    pub fn on_unit_release(
        &mut self,
        unit_id: u32,
        proposal_id: u64,
        release_id: u32,
        query: String,
        input_sha256: String,
        requested_by: AccountId,
        entries: u32,
        synthetic: u32,
        counted: bool,
        count_note: String,
    ) -> String {
        let mut u = self.unit(unit_id);
        if u.in_flight.as_ref().map(|f| f.release_id) != Some(release_id) {
            env::log_str(&format!("Late engine answer for unit {unit_id} release {release_id} ignored (it was cleared as stale)"));
            return "ignored".to_string();
        }
        u.in_flight = None;
        let mut rec = Self::blank(unit_id, release_id, proposal_id, query, input_sha256, requested_by);
        rec.wasm_sha256 = self.policy.wasm_sha256.clone();
        rec.entries = entries;
        rec.synthetic = synthetic;
        rec.issuers = u.issuers.len() as u32;
        match read_at(0) {
            Out::Failed => rec.note = "The OutLayer request failed".to_string(),
            Out::Unreadable(bytes, why) => {
                rec.output_sha256 = hex::encode(env::sha256(&bytes));
                rec.note = why.to_string();
            }
            Out::Output(bytes, v) => {
                rec.output_sha256 = hex::encode(env::sha256(&bytes));
                let status = text(&v, "status");
                if STATUSES.contains(&status.as_str()) {
                    rec.status = status;
                } else if v.get("error").is_some() {
                    rec.note = format!("Enclave error {}: {}", text(&v, "code"), text(&v, "error"));
                } else {
                    rec.note = format!("Unknown status \"{status}\" from the enclave");
                }
                rec.cells = json_of(&v, "cells", "[]");
                rec.suppressed = json_of(&v, "suppressed", "[]");
                rec.input_hash = text(&v, "input_hash");
                rec.output_hash = text(&v, "output_hash");
                rec.entries_used = v.get("entries_used").and_then(Value::as_u64).map(|n| n as u32);
                rec.entries_rejected = json_of(&v, "entries_rejected", "{}");
                let mut proof = Map::new();
                for k in PROOF_KEYS {
                    if let Some(x) = v.get(k).filter(|x| !x.is_null()) {
                        proof.insert(k.to_string(), x.clone());
                    }
                }
                rec.proof = Value::Object(proof).to_string();
                let history_len = v.get("history").map_or(0, |h| h.to_string().len());
                if rec.cells.len() + rec.suppressed.len() + rec.proof.len() + rec.entries_rejected.len() + history_len > MAX_STORED {
                    rec.status = "error".to_string();
                    rec.note = "The engine answer was too large to store".to_string();
                    rec.cells = "[]".to_string();
                    rec.suppressed = "[]".to_string();
                    rec.proof = "{}".to_string();
                }
                if rec.status != "error" {
                    if let Some(h) = v.get("history").filter(|h| !h.is_null()) {
                        self.history.insert(unit_id, h.to_string());
                    }
                }
            }
        }
        if counted {
            match read_at(1) {
                Out::Output(bytes, v) => {
                    rec.count_output_sha256 = hex::encode(env::sha256(&bytes));
                    rec.dkim_verified = v.get("entries_verified").and_then(Value::as_u64).map(|n| n as u32);
                    rec.dkim_rejections = json_of(&v, "rejections", "[]");
                    if rec.dkim_rejections.len() > 4096 {
                        rec.dkim_rejections = "[]".to_string();
                    }
                    if rec.dkim_verified.is_none() {
                        rec.count_note = format!("The DKIM count run gave no count: {} {}", text(&v, "code"), text(&v, "error"));
                    }
                }
                Out::Unreadable(bytes, why) => {
                    rec.count_output_sha256 = hex::encode(env::sha256(&bytes));
                    rec.count_note = format!("The DKIM count run failed: {why}");
                }
                Out::Failed => rec.count_note = "The DKIM count run failed".to_string(),
            }
        } else {
            rec.dkim_verified = Some(0);
            rec.count_note = count_note;
        }
        u.releases = release_id;
        self.save(u);
        if let Some(mut p) = self.proposals.get(&(unit_id, proposal_id)).cloned() {
            p.status = "executed".to_string();
            self.proposals.insert((unit_id, proposal_id), p);
        }
        self.releases_total += 1;
        emit(
            "release_logged",
            &format!(
                "{{\"unit_id\":{unit_id},\"id\":{release_id},\"status\":\"{}\",\"entries\":{entries},\"synthetic\":{synthetic},\"dkim_verified\":{}}}",
                rec.status,
                rec.dkim_verified.map(|n| n.to_string()).unwrap_or_else(|| "null".to_string())
            ),
        );
        let status = rec.status.clone();
        self.releases.insert((unit_id, release_id), rec);
        status
    }
}

impl Units {
    fn close(&mut self, unit_id: u32, proposal_id: u64) {
        let mut u = self.unit(unit_id);
        u.open.retain(|x| *x != proposal_id);
        self.save(u);
    }

    /// Mark open proposals older than 7 days as expired, so they stop holding open-proposal places.
    fn expire_open(&mut self, u: &mut Unit) {
        let ids = u.open.clone();
        for id in ids {
            if let Some(mut p) = self.proposals.get(&(u.id, id)).cloned() {
                if p.status == "open" && expired(&p) {
                    p.status = "expired".to_string();
                    self.proposals.insert((u.id, id), p);
                    u.open.retain(|x| *x != id);
                }
            }
        }
    }

    fn blank(unit_id: u32, id: u32, proposal_id: u64, query: String, input_sha256: String, requested_by: AccountId) -> UnitRelease {
        UnitRelease {
            unit_id,
            id,
            proposal_id,
            query,
            requested_by,
            status: "error".to_string(),
            cells: "[]".to_string(),
            suppressed: "[]".to_string(),
            input_hash: String::new(),
            output_hash: String::new(),
            input_sha256,
            output_sha256: String::new(),
            proof: "{}".to_string(),
            note: String::new(),
            block_timestamp: U64(env::block_timestamp()),
            wasm_sha256: String::new(),
            issuers: 0,
            entries: 0,
            synthetic: 0,
            entries_used: None,
            entries_rejected: "{}".to_string(),
            dkim_verified: None,
            dkim_rejections: "[]".to_string(),
            count_note: String::new(),
            count_output_sha256: String::new(),
        }
    }

    /// Start the engine run for a passed proposal. Refuses (and so reverts the passing vote) when the unit already
    /// has a run in flight, hit its daily cap, has no entries, or the contract cannot pay the deposit.
    fn execute(&mut self, p: &mut Proposal, by: &AccountId) {
        let unit_id = p.unit_id;
        let mut u = self.unit(unit_id);
        require!(u.in_flight.is_none(), "A release is already running for this unit; vote again when it lands");
        prune(&mut u);
        require!((u.recent_runs.len() as u32) < RELEASES_PER_DAY, format!("This unit already ran {RELEASES_PER_DAY} releases in the last 24 hours"));
        let release_id = u.releases + 1;
        let query = stamp_query(&p.query, release_id);
        let mut list: Vec<String> = Vec::new();
        let mut synthetic = 0u32;
        for slot in &u.slots {
            if let Some(ct) = self.entries.get(slot) {
                list.push(ct.clone());
                if self.slots.get(slot).is_some_and(|s| s.synthetic) {
                    synthetic += 1;
                }
            }
        }
        require!(!list.is_empty(), "This unit has no entries yet");
        let refs: Vec<&String> = list.iter().collect();
        let k = self.policy.k;
        let history = self.history.get(&unit_id).cloned();
        let input = outlayer::build_input(&format!("{{\"k\":{k},\"trusted_issuers\":[],\"require_dkim\":false}}"), &query, &refs, history.as_ref());
        let deposit = outlayer::deposit_for(&self.outlayer, input.len());
        let real = list.len() as u32 - synthetic;
        let mut counted = !u.issuers.is_empty() && real > 0;
        let mut count_note = if u.issuers.is_empty() {
            "No employer DKIM key is recorded for this unit, so no entry could verify".to_string()
        } else if real == 0 {
            "Every entry is synthetic".to_string()
        } else {
            String::new()
        };
        // Gas: the reserve pays the receipt fees of the calls created below (one more call and data receipt for a
        // count run). If a count run would leave either request under the minimum, the release goes out alone and the
        // record says DKIM was not counted, rather than failing the vote.
        let left = env::prepaid_gas().saturating_sub(env::used_gas()).saturating_sub(CALLBACK_GAS);
        let split = Gas::from_gas(left.saturating_sub(RESERVE_GAS).saturating_sub(COUNT_RESERVE_GAS).as_gas() / 2);
        if counted && split < MIN_RUN_GAS {
            counted = false;
            count_note = "Not enough gas was attached for the DKIM count run, so DKIM-verified entries were not counted".to_string();
        }
        let per = if counted { split } else { left.saturating_sub(RESERVE_GAS) };
        require!(per >= MIN_RUN_GAS, "Attach 300 Tgas: the passing vote starts the engine run");
        let count_input = counted.then(|| {
            let issuers = serde_json::to_string(
                &u.issuers.iter().map(|i| serde_json::json!({"domain": i.domain, "selector": i.selector, "rsa_pubkey_spki_b64": i.rsa_pubkey_spki_b64})).collect::<Vec<_>>(),
            )
            .unwrap_or_else(|_| "[]".to_string());
            let q = serde_json::json!({"id": release_id, "group_by": ["grade"], "filter": {"grade": COUNT_FILTER}, "stat": "mean"}).to_string();
            outlayer::build_input(&format!("{{\"k\":{k},\"trusted_issuers\":{issuers},\"require_dkim\":true}}"), &q, &refs, None)
        });
        let count_deposit = count_input.as_ref().map_or(0, |c| outlayer::deposit_for(&self.outlayer, c.len()));
        let need = deposit + count_deposit + NearToken::from_millinear(200).as_yoctonear();
        require!(
            util::spare_yocto() >= need,
            format!("The units contract needs about {}.{:02} NEAR spare to pay for the engine run", need / 10u128.pow(24), need / 10u128.pow(22) % 100 + 1)
        );
        self.runs_window.retain(|t| env::block_timestamp().saturating_sub(*t) < DAY_NS);
        require!((self.runs_window.len() as u32) < RUNS_PER_DAY_TOTAL, "The units contract has run its daily share of engine runs; try again tomorrow");
        self.runs_window.push(env::block_timestamp());

        let input_sha256 = hex::encode(env::sha256(input.as_bytes()));
        u.in_flight = Some(UnitInFlight { release_id, proposal_id: p.id, requested_by: by.clone(), requested_at: U64(env::block_timestamp()) });
        u.recent_runs.push(env::block_timestamp());
        u.open.retain(|x| *x != p.id);
        self.save(u);
        p.status = "running".to_string();
        p.release_id = Some(release_id);

        let mut run = outlayer::request(&self.outlayer, &input, deposit, per);
        if let Some(c) = &count_input {
            run = run.and(outlayer::request(&self.outlayer, c, count_deposit, per));
        }
        run.then(Self::ext(env::current_account_id()).with_static_gas(CALLBACK_GAS).on_unit_release(
            unit_id,
            p.id,
            release_id,
            query.clone(),
            input_sha256,
            by.clone(),
            list.len() as u32,
            synthetic,
            counted,
            count_note,
        ))
        .detach();
        emit("release_requested", &format!("{{\"unit_id\":{unit_id},\"id\":{release_id},\"proposal_id\":{},\"query\":{query},\"dkim_count\":{counted}}}", p.id));
    }
}
