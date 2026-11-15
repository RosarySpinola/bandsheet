//! Unit tests: proposals, votes and threshold maths, caps, the engine run and its callback.
use near_sdk::mock::MockAction;
use near_sdk::serde_json::{self, json, Value};
use near_sdk::test_utils::{get_created_receipts, get_logs};
use near_sdk::{testing_env, Gas, NearToken, PromiseResult};

use crate::tests::*;
use crate::*;

const Q: &str = r#"{"group_by":["grade"]}"#;

/// A unit with council `seats` (alice first) and `n` members with entries; `syn` of them synthetic.
fn unit_with(c: &mut Units, seats: &[&str], n: u8, syn: u8, domains: &[&str]) -> u32 {
    let u = with_unit(c, seats[0], domains);
    for (i, s) in seats.iter().enumerate().skip(1) {
        // every current seat approves the next one
        for voter in &seats[..i] {
            as_(voter);
            if c.unit_add_council(u, acct(s)) == "added" {
                break;
            }
        }
    }
    let base = (u as u8 - 1) * 50;
    for k in 1..=n {
        add_member(c, u, base + k, k <= syn);
        submit_as(c, base + k, &format!("u{u}m{k}"));
    }
    u
}

/// The FunctionCall actions to outlayer the last call created: (input JSON, deposit, gas).
fn runs() -> Vec<(Value, NearToken, Gas)> {
    get_created_receipts()
        .into_iter()
        .filter(|r| r.receiver_id.as_str() == "outlayer.testnet")
        .flat_map(|r| r.actions)
        .filter_map(|a| match a {
            MockAction::FunctionCallWeight { method_name, args, attached_deposit, prepaid_gas, .. } if method_name == b"request_execution" => {
                let v: Value = serde_json::from_slice(&args).unwrap();
                Some((serde_json::from_str(v["input_data"].as_str().unwrap()).unwrap(), attached_deposit, prepaid_gas))
            }
            _ => None,
        })
        .collect()
}

fn out(status: &str, history: &str) -> PromiseResult {
    let v = json!({"release_id": 1, "status": status, "cells": [{"key": {"grade": "Senior"}, "n": 4, "mean_eur": 61000}],
        "suppressed": [{"key": {"grade": "Chief"}, "reason": "small_cell", "witness": "n=1 < k=3"}],
        "history": {"blob": history}, "input_hash": "aa", "output_hash": "bb", "entries_used": 5, "entries_rejected": {"entry_decrypt": 1}});
    PromiseResult::Successful(v.to_string().into_bytes())
}

fn count_out(verified: u64) -> PromiseResult {
    let v = json!({"status": "refused", "cells": [], "suppressed": [], "entries_verified": verified, "rejections": [{"reason": "no_email", "count": 2}]});
    PromiseResult::Successful(v.to_string().into_bytes())
}

fn callback(c: &mut Units, unit: u32, rid: u32, results: Vec<PromiseResult>, entries: u32, synthetic: u32) -> String {
    let counted = results.len() == 2;
    testing_env!(ctx(UNITS, None).build(), near_sdk::test_vm_config(), near_sdk::RuntimeFeesConfig::test(), Default::default(), results);
    let pid = c.get_unit(unit).unwrap().in_flight.map(|f| f.proposal_id).unwrap_or(1);
    c.on_unit_release(unit, pid, rid, Q.into(), "ff".repeat(32), acct("alice.testnet"), entries, synthetic, counted, String::new())
}

#[test]
fn a_one_seat_council_runs_on_propose() {
    let mut c = fresh();
    let u = unit_with(&mut c, &["alice.testnet"], 3, 0, &[]);
    as_("mallory.testnet");
    panics(|| { c.unit_propose_release(u, Q.into()); }, "not on unit 1's council");
    as_("alice.testnet");
    panics(|| { c.unit_propose_release(u, r#"{"group_by":["salary"]}"#.into()); }, "group_by list");
    panics(|| { c.unit_propose_release(u, r#"{"group_by":["grade"],"stat":"max"}"#.into()); }, "Only the mean");
    panics(|| { c.unit_propose_release(u, r#"{"group_by":["grade"],"filter":{"pay":"1"}}"#.into()); }, "filter");
    as_("alice.testnet");
    assert_eq!(c.unit_propose_release(u, Q.into()), 1);
    let r = runs();
    assert_eq!(r.len(), 1, "no DKIM key: one run only");
    let (input, deposit, gas) = &r[0];
    assert_eq!(input["policy"], json!({"k": 3, "trusted_issuers": [], "require_dkim": false}));
    assert_eq!(input["query"]["id"], 1);
    assert_eq!(input["entries"].as_array().unwrap().len(), 3);
    assert!(input["history"].is_null());
    assert_eq!(*deposit, NearToken::from_millinear(50));
    assert!(gas.as_tgas() >= 200);
    let p = &c.get_unit_proposals(u, None, None)[0];
    assert_eq!((p.status.as_str(), p.release_id), ("running", Some(1)));
    assert_eq!(c.get_unit(u).unwrap().in_flight.unwrap().release_id, 1);
}

#[test]
fn more_than_half_of_the_council_passes() {
    let mut c = fresh();
    let u = unit_with(&mut c, &["alice.testnet", "bob.testnet", "carol.testnet", "dan.testnet"], 3, 0, &[]);
    as_("alice.testnet");
    let p = c.unit_propose_release(u, Q.into());
    assert!(runs().is_empty(), "1 of 4 does not pass");
    as_("bob.testnet");
    assert_eq!(c.unit_vote(u, p, true), "open", "2 of 4 is half, not more than half");
    assert!(runs().is_empty());
    as_("bob.testnet");
    panics(|| { c.unit_vote(u, p, false); }, "already voted");
    as_("carol.testnet");
    assert_eq!(c.unit_vote(u, p, true), "running", "3 of 4 passes");
    assert_eq!(runs().len(), 1);
    as_("dan.testnet");
    panics(|| { c.unit_vote(u, p, true); }, "voting is closed");
}

#[test]
fn a_proposal_is_rejected_once_it_cannot_pass() {
    let mut c = fresh();
    let u = unit_with(&mut c, &["alice.testnet", "bob.testnet", "carol.testnet"], 3, 0, &[]);
    as_("alice.testnet");
    let p = c.unit_propose_release(u, Q.into());
    as_("bob.testnet");
    assert_eq!(c.unit_vote(u, p, false), "open");
    as_("carol.testnet");
    assert_eq!(c.unit_vote(u, p, false), "rejected");
    assert_eq!(c.get_unit(u).unwrap().open_proposals, 0);
    as_("bob.testnet");
    panics(|| { c.unit_vote(u, p, true); }, "rejected; voting is closed");
    panics(|| { c.unit_vote(u, 9, true); }, "No proposal 9 in unit 1");
}

#[test]
fn seats_added_after_a_proposal_do_not_vote_on_it() {
    let mut c = fresh();
    let u = unit_with(&mut c, &["alice.testnet", "bob.testnet"], 3, 0, &[]);
    as_("alice.testnet");
    let p = c.unit_propose_release(u, Q.into());
    c.unit_add_council(u, acct("mallory.testnet"));
    as_("bob.testnet");
    c.unit_add_council(u, acct("mallory.testnet"));
    assert_eq!(c.get_unit(u).unwrap().council.len(), 3);
    as_("mallory.testnet");
    panics(|| { c.unit_vote(u, p, true); }, "did not hold a seat when proposal 1 was made");
    // the snapshot keeps the threshold at more than half of 2
    as_("bob.testnet");
    assert_eq!(c.unit_vote(u, p, true), "running");
    // a member of another unit's council cannot vote here
    let u2 = unit_with(&mut c, &["zed.testnet"], 1, 0, &[]);
    as_("zed.testnet");
    panics(|| { c.unit_vote(u, p, true); }, "voting is closed");
    panics(|| { c.unit_propose_release(u, Q.into()); }, "not on unit 1's council");
    let _ = u2;
}

#[test]
fn only_one_run_at_a_time_per_unit_and_units_do_not_block_each_other() {
    let mut c = fresh();
    let u1 = unit_with(&mut c, &["alice.testnet", "bob.testnet"], 3, 0, &[]);
    let u2 = unit_with(&mut c, &["carol.testnet"], 3, 0, &[]);
    as_("alice.testnet");
    let p1 = c.unit_propose_release(u1, Q.into());
    let p2 = c.unit_propose_release(u1, Q.into());
    as_("bob.testnet");
    c.unit_vote(u1, p1, true);
    // a second proposal passing while the first runs is approved, and runs later
    as_("bob.testnet");
    assert_eq!(c.unit_vote(u1, p2, true), "approved");
    as_("anyone.testnet");
    panics(|| c.unit_run(u1, p2), "already running for this unit");
    as_("carol.testnet");
    c.unit_propose_release(u2, Q.into());
    let r = runs();
    assert_eq!(r[0].0["entries"].as_array().unwrap().len(), 3);
    assert!(r[0].0["entries"].to_string().contains("u2m1") && !r[0].0["entries"].to_string().contains("u1m"), "unit 2's run carries only its own entries");
    assert_eq!(r[0].0["query"]["id"], 1, "release numbers are per unit");
}

#[test]
fn caps_on_open_proposals_and_daily_runs() {
    let mut c = fresh();
    let u = unit_with(&mut c, &["alice.testnet", "bob.testnet"], 3, 0, &[]);
    as_("alice.testnet");
    for _ in 0..5 {
        c.unit_propose_release(u, Q.into());
    }
    panics(|| { c.unit_propose_release(u, Q.into()); }, "at most 5 open proposals");
    // five runs in a day: each lands, then the sixth is refused
    for p in 1..=5u64 {
        as_("bob.testnet");
        c.unit_vote(u, p, true);
        callback(&mut c, u, p as u32, vec![out("released", &format!("h{p}"))], 3, 0);
    }
    as_("alice.testnet");
    panics(|| { c.unit_propose_release(u, Q.into()); }, "5 releases in the last 24 hours");
    // a day later it is open again
    testing_env!(ctx("alice.testnet", None).block_timestamp(90_000_000_000_000).build());
    c.unit_propose_release(u, Q.into());
}

#[test]
fn a_run_needs_entries_gas_and_balance() {
    let mut c = fresh();
    let u = with_unit(&mut c, "alice.testnet", &[]);
    as_("alice.testnet");
    panics(|| { c.unit_propose_release(u, Q.into()); }, "no entries yet");
    add_member(&mut c, u, 1, false);
    submit_as(&mut c, 1, "only");
    // too little gas to run now: the proposal passes and waits as "approved"; unit_run without gas is refused
    testing_env!(ctx("alice.testnet", None).prepaid_gas(Gas::from_tgas(100)).build());
    let ap = c.unit_propose_release(u, Q.into());
    assert_eq!(c.get_unit_proposals(u, None, None).iter().find(|x| x.id == ap).unwrap().status, "approved");
    testing_env!(ctx("anyone.testnet", None).prepaid_gas(Gas::from_tgas(100)).build());
    panics(|| c.unit_run(u, ap), "Attach 300 Tgas");
    testing_env!(ctx("alice.testnet", None).account_balance(NearToken::from_millinear(400)).build());
    panics(|| { c.unit_propose_release(u, Q.into()); }, "low on storage balance");
    // one member is allowed: the engine refuses n < k, and that refusal is the honest result
    // (a unit test does not roll back state on a panic, so the proposal counter has moved; on chain it would not)
    as_("alice.testnet");
    let p = c.unit_propose_release(u, Q.into());
    assert_eq!(c.get_unit(u).unwrap().in_flight.unwrap().proposal_id, p);
    assert_eq!(runs()[0].0["entries"].as_array().unwrap().len(), 1);
}

#[test]
fn a_passing_vote_is_refused_when_the_contract_cannot_pay_the_run() {
    let mut c = fresh();
    let u = unit_with(&mut c, &["alice.testnet", "bob.testnet"], 3, 0, &[]);
    as_("alice.testnet");
    let p = c.unit_propose_release(u, Q.into());
    testing_env!(ctx("bob.testnet", None).account_balance(NearToken::from_millinear(200)).build());
    panics(|| { c.unit_vote(u, p, true); }, "needs about 0.26 NEAR");
    as_("bob.testnet");
    assert_eq!(c.unit_vote(u, p, true), "running");
    assert!(get_logs().join("\n").contains("release_requested"));
}

#[test]
fn the_callback_logs_the_release_with_counts_and_keeps_history_per_unit() {
    let mut c = fresh();
    let u1 = unit_with(&mut c, &["alice.testnet"], 5, 2, &[]);
    let u2 = unit_with(&mut c, &["carol.testnet"], 3, 0, &[]);
    as_("alice.testnet");
    c.unit_propose_release(u1, Q.into());
    assert_eq!(callback(&mut c, u1, 1, vec![out("partially_released", "unit1-h1")], 5, 2), "partially_released");
    let r = &c.get_unit_releases(u1, None, None)[0];
    assert_eq!((r.status.as_str(), r.unit_id, r.id), ("partially_released", 1, 1));
    assert_eq!(r.cells[0]["mean_eur"], 61000);
    assert_eq!(r.suppressed[0]["reason"], "small_cell");
    assert_eq!((r.counts.entries, r.counts.synthetic, r.counts.dkim_verified, r.counts.self_attested, r.counts.rejected), (5, 2, Some(0), Some(3), 1));
    assert!(r.count_note.is_empty() || r.count_note.contains("DKIM"));
    assert_eq!(r.wasm_sha256.as_deref(), Some("69".repeat(32).as_str()));
    assert_eq!(c.get_unit_proposals(u1, None, None)[0].status, "executed");
    assert!(c.get_unit(u1).unwrap().in_flight.is_none());
    // unit 2's first run starts with no history; unit 1's second run carries unit 1's history
    as_("carol.testnet");
    c.unit_propose_release(u2, Q.into());
    assert!(runs()[0].0["history"].is_null());
    as_("alice.testnet");
    c.unit_propose_release(u1, Q.into());
    let r = runs();
    assert_eq!(r[0].0["history"]["blob"], "unit1-h1");
    assert_eq!(r[0].0["query"]["id"], 2);
    let before = serde_json::to_string(&c.get_unit_release(u1, 1).unwrap()).unwrap();
    callback(&mut c, u1, 2, vec![out("refused", "unit1-h2")], 5, 2);
    assert_eq!(serde_json::to_string(&c.get_unit_release(u1, 1).unwrap()).unwrap(), before, "release 1 never changes");
    assert_eq!(c.get_unit(u1).unwrap().releases, 2);
    assert_eq!(c.get_policy().frozen, true);
    as_(REG);
    panics(|| c.set_outlayer(outlayer_cfg()), "frozen once a release exists");
}

#[test]
fn with_a_dkim_key_a_count_run_goes_out_beside_the_release() {
    let mut c = fresh();
    let u = unit_with(&mut c, &["alice.testnet"], 4, 1, &["harbourcourier.example"]);
    as_(REG);
    c.unit_add_issuer(u, "harbourcourier.example".into(), "payroll2026".into(), RSA.into(), Some("supplied".into()));
    as_("alice.testnet");
    c.unit_propose_release(u, r#"{"group_by":["grade","site"]}"#.into());
    let r = runs();
    assert_eq!(r.len(), 2);
    let (rel, count) = (&r[0].0, &r[1].0);
    assert_eq!(rel["policy"]["require_dkim"], false);
    assert_eq!(count["policy"]["require_dkim"], true);
    assert_eq!(count["policy"]["trusted_issuers"][0]["domain"], "harbourcourier.example");
    assert_eq!(count["query"]["filter"]["grade"], "(dkim count only)", "the count run groups nobody");
    assert!(count["history"].is_null(), "the count run never sees the history");
    assert_eq!(rel["entries"], count["entries"]);
    assert!(r[0].2.as_tgas() >= 100 && r[1].2.as_tgas() >= 100);
    callback(&mut c, u, 1, vec![out("released", "h"), count_out(2)], 4, 1);
    let v = &c.get_unit_releases(u, None, None)[0];
    assert_eq!((v.counts.dkim_verified, v.counts.self_attested, v.counts.synthetic), (Some(2), Some(1), 1));
    assert_eq!(v.entries_verified, Some(2));
    assert_eq!(v.dkim_rejections[0]["reason"], "no_email");
    assert_eq!(v.issuers, Some(1));
}

#[test]
fn a_failed_run_is_logged_and_the_unit_can_try_again() {
    let mut c = fresh();
    let u = unit_with(&mut c, &["alice.testnet"], 3, 0, &["harbourcourier.example"]);
    as_(REG);
    c.unit_add_issuer(u, "harbourcourier.example".into(), "s".into(), RSA.into(), None);
    as_("alice.testnet");
    c.unit_propose_release(u, Q.into());
    let err = PromiseResult::Successful(json!({"error": "bad", "code": "E_HISTORY"}).to_string().into_bytes());
    assert_eq!(callback(&mut c, u, 1, vec![PromiseResult::Successful(b"null".to_vec()), err], 3, 0), "error");
    let v = &c.get_unit_releases(u, None, None)[0];
    assert!(v.note.contains("no result"));
    assert!(v.count_note.contains("E_HISTORY") && v.counts.dkim_verified.is_none() && v.counts.self_attested.is_none());
    as_("alice.testnet");
    c.unit_propose_release(u, Q.into());
    assert!(runs()[0].0["history"].is_null(), "an error run stores no history");
    assert_eq!(callback(&mut c, u, 2, vec![PromiseResult::Failed, PromiseResult::Failed], 3, 0), "error");
    assert!(c.get_unit_release(u, 2).unwrap().note.contains("request failed"));
}

#[test]
fn a_stale_run_is_cleared_and_its_late_answer_ignored() {
    let mut c = fresh();
    let u = unit_with(&mut c, &["alice.testnet"], 3, 0, &[]);
    as_("alice.testnet");
    c.unit_propose_release(u, Q.into());
    panics(|| c.unit_clear_stale(u), "not stale yet");
    as_("mallory.testnet");
    panics(|| c.unit_clear_stale(u), "not on unit 1's council");
    testing_env!(ctx("alice.testnet", None).block_timestamp(700_000_000_000).build());
    c.unit_clear_stale(u);
    let r = c.get_unit_release(u, 1).unwrap();
    assert_eq!(r.status, "error");
    assert!(r.note.contains("did not answer"));
    assert_eq!(callback(&mut c, u, 1, vec![out("released", "late")], 3, 0), "ignored");
    assert_eq!(c.get_unit_release(u, 1).unwrap().status, "error", "a late answer never rewrites the record");
    as_("alice.testnet");
    panics(|| c.unit_clear_stale(u), "No release is running");
}

#[test]
fn queries_carry_only_known_keys() {
    let mut c = fresh();
    let u = unit_with(&mut c, &["alice.testnet", "bob.testnet"], 3, 0, &[]);
    as_("alice.testnet");
    panics(|| { c.unit_propose_release(u, r#"{"group_by":["grade"],"op":"pubkey"}"#.into()); }, "Query keys are");
    panics(|| { c.unit_propose_release(u, format!(r#"{{"group_by":["grade"],"filter":{{"grade":"{}"}}}}"#, "x".repeat(600))); }, "too long");
}

#[test]
fn the_proposer_withdraws_and_old_proposals_expire() {
    let mut c = fresh();
    let u = unit_with(&mut c, &["alice.testnet", "bob.testnet"], 3, 0, &[]);
    as_("alice.testnet");
    for _ in 0..5 {
        c.unit_propose_release(u, Q.into());
    }
    panics(|| { c.unit_propose_release(u, Q.into()); }, "at most 5 open proposals");
    as_("bob.testnet");
    panics(|| c.unit_withdraw_proposal(u, 1), "Only the proposer");
    as_("alice.testnet");
    c.unit_withdraw_proposal(u, 1);
    panics(|| c.unit_withdraw_proposal(u, 1), "is withdrawn");
    as_("bob.testnet");
    panics(|| { c.unit_vote(u, 1, true); }, "withdrawn; voting is closed");
    as_("alice.testnet");
    c.unit_propose_release(u, Q.into());
    assert_eq!(c.get_unit(u).unwrap().open_proposals, 5);
    // eight days later the open ones are expired: shown so, not votable, and they free their places
    let later = 8 * 86_400_000_000_000;
    testing_env!(ctx("bob.testnet", None).block_timestamp(later).build());
    panics(|| { c.unit_vote(u, 2, true); }, "expired");
    assert_eq!(c.get_unit_proposals(u, None, None)[1].status, "expired");
    testing_env!(ctx("alice.testnet", None).block_timestamp(later).build());
    c.unit_propose_release(u, Q.into());
    assert_eq!(c.get_unit(u).unwrap().open_proposals, 1);
}

#[test]
fn proposals_per_day_are_capped() {
    let mut c = fresh();
    let u = unit_with(&mut c, &["alice.testnet", "bob.testnet", "carol.testnet"], 3, 0, &[]);
    for i in 0..10u64 {
        as_("alice.testnet");
        let p = c.unit_propose_release(u, Q.into());
        as_("bob.testnet");
        c.unit_vote(u, p, false);
        as_("carol.testnet");
        assert_eq!(c.unit_vote(u, p, false), "rejected", "proposal {i}");
    }
    as_("alice.testnet");
    panics(|| { c.unit_propose_release(u, Q.into()); }, "at most 10 proposals in 24 hours");
}

#[test]
fn engine_runs_are_capped_across_all_units() {
    let mut c = fresh();
    let mut units = Vec::new();
    for i in 0..13u8 {
        let u = with_unit(&mut c, &format!("c{i}.testnet"), &[]);
        add_member(&mut c, u, 200 + i, false);
        submit_as(&mut c, 200 + i, "x");
        units.push((u, format!("c{i}.testnet")));
    }
    let mut ran = 0;
    'outer: for (u, who) in &units {
        for r in 1..=5u32 {
            if ran == RUNS_PER_DAY_TOTAL {
                break 'outer;
            }
            as_(who);
            c.unit_propose_release(*u, Q.into());
            callback(&mut c, *u, r, vec![out("refused", "h")], 1, 0);
            ran += 1;
        }
    }
    let (u, who) = &units[12];
    as_(who);
    panics(|| { c.unit_propose_release(*u, Q.into()); }, "daily share of engine runs");
}

#[test]
fn without_gas_for_the_count_run_the_release_goes_out_alone() {
    let mut c = fresh();
    let u = unit_with(&mut c, &["alice.testnet"], 3, 0, &["harbourcourier.example"]);
    as_(REG);
    c.unit_add_issuer(u, "harbourcourier.example".into(), "s".into(), RSA.into(), None);
    testing_env!(ctx("alice.testnet", None).prepaid_gas(Gas::from_tgas(260)).build());
    c.unit_propose_release(u, Q.into());
    let r = runs();
    assert_eq!(r.len(), 1);
    assert_eq!(r[0].0["policy"]["require_dkim"], false);
    testing_env!(ctx(UNITS, None).build(), near_sdk::test_vm_config(), near_sdk::RuntimeFeesConfig::test(), Default::default(), vec![out("released", "h")]);
    let note = "Not enough gas was attached for the DKIM count run, so DKIM-verified entries were not counted".to_string();
    c.on_unit_release(u, 1, 1, Q.into(), "ff".repeat(32), acct("alice.testnet"), 3, 0, false, note);
    let v = c.get_unit_release(u, 1).unwrap();
    assert!(v.count_note.contains("Not enough gas"));
}

#[test]
fn an_oversized_engine_answer_is_logged_as_an_error() {
    let mut c = fresh();
    let u = unit_with(&mut c, &["alice.testnet"], 3, 0, &[]);
    as_("alice.testnet");
    c.unit_propose_release(u, Q.into());
    let big = json!({"status": "released", "cells": [], "suppressed": [], "history": {"blob": "h".repeat(100_000)}});
    assert_eq!(callback(&mut c, u, 1, vec![PromiseResult::Successful(big.to_string().into_bytes())], 3, 0), "error");
    assert!(c.get_unit_release(u, 1).unwrap().note.contains("too large"));
    as_("alice.testnet");
    c.unit_propose_release(u, Q.into());
    assert!(runs()[0].0["history"].is_null(), "an oversized history is never stored");
}

#[test]
fn a_cheap_passing_vote_approves_and_anyone_starts_the_run() {
    let mut c = fresh();
    let u = unit_with(&mut c, &["alice.testnet", "bob.testnet"], 3, 0, &[]);
    testing_env!(ctx("alice.testnet", None).prepaid_gas(Gas::from_tgas(30)).build());
    let p = c.unit_propose_release(u, Q.into());
    testing_env!(ctx("anyone.testnet", None).build());
    panics(|| c.unit_run(u, p), "only an approved proposal runs");
    testing_env!(ctx("bob.testnet", None).prepaid_gas(Gas::from_tgas(30)).build());
    assert_eq!(c.unit_vote(u, p, true), "approved");
    assert!(runs().is_empty(), "a 30 Tgas vote starts nothing");
    assert!(get_logs().join("").contains("proposal_approved"));
    assert_eq!(c.get_unit(u).unwrap().open_proposals, 0);
    as_("bob.testnet");
    panics(|| { c.unit_vote(u, p, false); }, "approved; voting is closed");
    // anyone with 300 Tgas starts it; the release names the voter who passed it
    as_("relayer.testnet");
    c.unit_run(u, p);
    assert_eq!(runs().len(), 1);
    assert_eq!(c.get_unit(u).unwrap().in_flight.unwrap().requested_by, acct("bob.testnet"));
    as_("relayer.testnet");
    panics(|| c.unit_run(u, p), "is running");
    panics(|| c.unit_run(u, 9), "No proposal 9");
}
