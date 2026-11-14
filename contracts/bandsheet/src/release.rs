//! Release requests (DAO only) and the append-only log of what OutLayer answered.
use near_sdk::json_types::U64;
use near_sdk::serde_json::{self, Map, Value};
use near_sdk::{env, near, require, AccountId, Gas, NearToken};

use crate::dkim;
use crate::events::emit;
use crate::outlayer::{self, Out};
use crate::types::{InFlight, ReleaseExtra, ReleaseRecord, ReleaseView};
use crate::{Bandsheet, BandsheetExt};

const MIN_REQUEST_GAS: Gas = Gas::from_tgas(60);
const PROOF_KEYS: [&str; 8] = ["attestation", "signature", "public_key", "quote", "tee", "report_data", "request_id", "worker"];
const STATUSES: [&str; 3] = ["released", "partially_released", "refused"];

fn text(v: &Value, key: &str) -> String {
    v.get(key).and_then(Value::as_str).unwrap_or_default().to_string()
}

fn json_of(v: &Value, key: &str, empty: &str) -> String {
    match v.get(key) {
        Some(x) if !x.is_null() => x.to_string(),
        _ => empty.to_string(),
    }
}

/// Validate the query and stamp it with the release number the contract assigns.
fn stamp_query(query: &str, id: u32) -> String {
    require!(query.len() <= 2048, "Query is too long");
    let mut q: Map<String, Value> = match serde_json::from_str(query) {
        Ok(Value::Object(m)) => m,
        _ => env::panic_str("Query must be a JSON object"),
    };
    let ok = matches!(q.get("group_by"), Some(Value::Array(a)) if !a.is_empty() && a.iter().all(Value::is_string));
    require!(ok, "Query needs a non-empty group_by list of field names");
    q.entry("stat").or_insert(Value::String("mean".to_string()));
    q.insert("id".to_string(), Value::from(id));
    Value::Object(q).to_string()
}

#[near]
impl Bandsheet {
    /// Only the union's DAO (a passed vote) can ask for a release. Returns the release number; the record
    /// lands in `get_releases` when OutLayer answers. One request runs at a time so history stays ordered.
    pub fn request_release(&mut self, query: String) -> u32 {
        let caller = env::predecessor_account_id();
        let by_owner = self.demo_owner_override && caller == self.owner;
        require!(caller == self.dao || by_owner, format!("Refused: only the union's DAO ({}) can request a release", self.dao));
        require!(self.in_flight.is_none(), "A release is already running");
        require!(!self.outlayer.source.is_empty(), "OutLayer source is not configured");
        require!(!self.entries.is_empty(), "There are no entries to release from");
        // the engine input is built first: its size sets the OutLayer deposit
        let id = self.releases.len() + 1;
        let query = stamp_query(&query, id);
        let entries: Vec<&String> = self.entries.values().collect();
        let input = outlayer::build_input(&dkim::policy_json(self.policy.k), &query, &entries, self.history.as_ref());
        let deposit = outlayer::deposit_for(&self.outlayer, input.len());
        let spare = env::account_balance().as_yoctonear().saturating_sub(env::storage_usage() as u128 * env::storage_byte_cost().as_yoctonear());
        require!(
            spare >= deposit + NearToken::from_millinear(200).as_yoctonear(),
            format!("The union account needs about {}.{:02} NEAR spare to pay for the OutLayer run", deposit / 10u128.pow(24), deposit / 10u128.pow(22) % 100 + 1)
        );

        let input_sha256 = hex::encode(env::sha256(input.as_bytes()));
        let gas = outlayer::request_gas();
        require!(gas >= MIN_REQUEST_GAS, "Attach at least 200 Tgas to the call");

        self.in_flight = Some(InFlight { id, requested_by: caller.clone(), requested_at: Self::now() });
        outlayer::request(&self.outlayer, &input, deposit, gas)
            .then(Self::ext(env::current_account_id()).with_static_gas(outlayer::CALLBACK_GAS).on_release(id, query.clone(), input_sha256, caller))
            .detach();
        emit("release_requested", &format!("{{\"id\":{id},\"query\":{query}}}"));
        id
    }

    /// OutLayer's answer. Appends one record, whatever came back: a refusal and a failed run are logged too.
    #[private]
    pub fn on_release(&mut self, id: u32, query: String, input_sha256: String, requested_by: AccountId) -> String {
        self.in_flight = None;
        let mut rec = ReleaseRecord {
            id,
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
        };
        let (mut extra_rejections, mut entries_verified) = ("[]".to_string(), None);
        match outlayer::read_result() {
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
                    // the guest refused the input: {"error","code"} with no status. A failed release, not a panic.
                    rec.note = format!("Enclave error {}: {}", text(&v, "code"), text(&v, "error"));
                } else {
                    rec.note = format!("Unknown status \"{status}\" from the enclave");
                }
                rec.cells = json_of(&v, "cells", "[]");
                rec.suppressed = json_of(&v, "suppressed", "[]");
                extra_rejections = dkim::rejections_json(&v);
                entries_verified = v.get("entries_verified").and_then(Value::as_u64).map(|n| n as u32);
                rec.input_hash = text(&v, "input_hash");
                rec.output_hash = text(&v, "output_hash");
                let mut proof = Map::new();
                for k in PROOF_KEYS {
                    if let Some(x) = v.get(k).filter(|x| !x.is_null()) {
                        proof.insert(k.to_string(), x.clone());
                    }
                }
                rec.proof = Value::Object(proof).to_string();
                if rec.status != "error" {
                    if let Some(h) = v.get("history").filter(|h| !h.is_null()) {
                        self.history = Some(h.to_string());
                    }
                }
            }
        }
        emit(
            "release_logged",
            &format!(
                "{{\"id\":{id},\"status\":\"{}\",\"output_sha256\":\"{}\",\"suppressed\":{}}}",
                rec.status,
                rec.output_sha256,
                serde_json::from_str::<Value>(&rec.suppressed).ok().and_then(|s| s.as_array().map(Vec::len)).unwrap_or(0)
            ),
        );
        let status = rec.status.clone();
        let extra = ReleaseExtra {
            rejections: extra_rejections,
            entries_verified,
            wasm_sha256: self.policy.wasm_sha256.clone(),
            require_dkim: dkim::require_dkim(),
            issuers: dkim::issuers().len() as u32,
        };
        dkim::extras().insert(id, extra);
        self.releases.push(rec);
        status
    }

    pub fn release_count(&self) -> u64 {
        self.releases.len() as u64
    }

    pub fn get_releases(&self, from: Option<u64>, limit: Option<u64>) -> Vec<ReleaseView> {
        let (from, limit) = (from.unwrap_or(0) as usize, limit.unwrap_or(20).min(50) as usize);
        let extras = dkim::extras();
        self.releases.iter().skip(from).take(limit).map(|r| r.view(extras.get(&r.id).cloned())).collect()
    }

    pub fn get_release(&self, id: u32) -> Option<ReleaseView> {
        let extras = dkim::extras();
        id.checked_sub(1).and_then(|i| self.releases.get(i)).map(|r| r.view(extras.get(&r.id).cloned()))
    }
}
