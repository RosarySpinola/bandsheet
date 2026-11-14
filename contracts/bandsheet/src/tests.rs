//! Unit tests: submit authorization, replacement, count, DAO-only release, record immutability.
use near_sdk::json_types::U128;
use near_sdk::serde_json::{self, json, Value};
use near_sdk::test_utils::{get_logs, VMContextBuilder};
use near_sdk::{env, testing_env, AccountId, CurveType, Gas, NearToken, PromiseResult, PublicKey};

use crate::*;

fn acct(s: &str) -> AccountId {
    s.parse().unwrap()
}

fn key(n: u8) -> PublicKey {
    PublicKey::from_parts(CurveType::ED25519, vec![n; 32]).unwrap()
}

fn ctx(predecessor: &str, signer_pk: Option<PublicKey>) -> VMContextBuilder {
    let mut b = VMContextBuilder::new();
    b.current_account_id(acct("union.testnet"))
        .predecessor_account_id(acct(predecessor))
        .signer_account_id(acct(predecessor))
        .account_balance(NearToken::from_near(100))
        .prepaid_gas(Gas::from_tgas(300));
    if let Some(pk) = signer_pk {
        b.signer_account_pk(pk);
    }
    b
}

fn fresh() -> Bandsheet {
    testing_env!(ctx("owner.testnet", None).build());
    let mut c = Bandsheet::new(acct("owner.testnet"), acct("dao.testnet"), 3, "enclavekey".into(), "ab".repeat(32), "cd".repeat(32));
    c.set_outlayer(
        acct("outlayer.testnet"),
        r#"{"Project":{"project_id":"o/p","version_key":null}}"#.into(),
        String::new(),
        U128(20_000_000_000_000_000_000_000),
    );
    c
}

fn with_members(n: u8) -> Bandsheet {
    let mut c = fresh();
    c.add_members((1..=n).map(key).collect());
    c
}

/// A member's own key signs a call on the union account.
fn as_member(n: u8) {
    testing_env!(ctx("union.testnet", Some(key(n))).build());
}

fn ct(tag: &str) -> Value {
    json!({"epk": tag, "nonce": "n", "ct": "c"})
}

#[test]
fn member_submits_and_count_grows() {
    let mut c = with_members(3);
    for n in 1..=3 {
        as_member(n);
        c.submit(ct(&format!("m{n}")));
    }
    assert_eq!(c.entry_count(), 3);
    assert_eq!(c.member_count(), 3);
    assert_eq!(c.get_entries(None, None).len(), 3);
}

#[test]
fn resubmission_replaces_and_count_is_unchanged() {
    let mut c = with_members(2);
    as_member(1);
    c.submit(ct("first"));
    as_member(2);
    c.submit(ct("other"));
    as_member(1);
    c.submit(ct("second"));
    assert_eq!(c.entry_count(), 2);
    let all = c.get_entries(None, None);
    assert!(all.iter().any(|e| e.contains("second")) && !all.iter().any(|e| e.contains("first")));
}

#[test]
#[should_panic(expected = "outside the union")]
fn outside_account_cannot_submit() {
    let mut c = with_members(1);
    testing_env!(ctx("mallory.testnet", Some(key(1))).build());
    c.submit(ct("fake"));
}

#[test]
#[should_panic(expected = "outside the union")]
fn owner_account_cannot_submit_from_outside() {
    let mut c = with_members(1);
    testing_env!(ctx("owner.testnet", Some(key(1))).build());
    c.submit(ct("fake"));
}

#[test]
#[should_panic(expected = "not a registered member")]
fn unregistered_key_on_the_union_account_is_refused() {
    let mut c = with_members(1);
    as_member(9);
    c.submit(ct("fake"));
}

#[test]
#[should_panic(expected = "Only the owner")]
fn only_the_owner_adds_members() {
    let mut c = fresh();
    testing_env!(ctx("mallory.testnet", None).build());
    c.add_members(vec![key(1)]);
}

#[test]
fn revoked_member_loses_the_key_and_the_entry() {
    let mut c = with_members(2);
    as_member(1);
    c.submit(ct("a"));
    as_member(2);
    c.submit(ct("b"));
    testing_env!(ctx("owner.testnet", None).build());
    c.revoke_member(key(1));
    assert_eq!(c.entry_count(), 1);
    assert_eq!(c.member_count(), 1);
    as_member(1);
    let r = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| c.submit(ct("again"))));
    assert!(r.is_err());
}

#[test]
fn slot_is_sha256_of_the_key_bytes() {
    let c = fresh();
    assert_eq!(c.slot_of(key(7)), hex::encode(env::sha256(&[7u8; 32])));
}

#[test]
#[should_panic(expected = "epk, nonce and ct")]
fn malformed_ciphertext_is_refused() {
    let mut c = with_members(1);
    as_member(1);
    c.submit(json!({"epk": "x", "nonce": "n"}));
}

fn seeded(n: u8) -> Bandsheet {
    let mut c = with_members(n);
    for i in 1..=n {
        as_member(i);
        c.submit(ct(&format!("m{i}")));
    }
    c
}

const QUERY: &str = r#"{"group_by":["grade"],"stat":"mean"}"#;

#[test]
#[should_panic(expected = "only the union's DAO")]
fn release_refused_for_anyone_but_the_dao() {
    let mut c = seeded(3);
    testing_env!(ctx("mallory.testnet", None).build());
    c.request_release(QUERY.into());
}

#[test]
#[should_panic(expected = "only the union's DAO")]
fn owner_cannot_release_without_the_override() {
    let mut c = seeded(3);
    testing_env!(ctx("owner.testnet", None).build());
    c.request_release(QUERY.into());
}

#[test]
fn owner_can_release_when_the_demo_override_is_on() {
    let mut c = seeded(3);
    testing_env!(ctx("owner.testnet", None).build());
    c.set_demo_owner_override(true);
    assert_eq!(c.request_release(QUERY.into()), 1);
}

#[test]
fn dao_request_stamps_the_id_and_blocks_a_second_request() {
    let mut c = seeded(3);
    testing_env!(ctx("dao.testnet", None).build());
    assert_eq!(c.request_release(r#"{"id":99,"group_by":["grade","site"]}"#.into()), 1);
    let logs = get_logs().join("\n");
    assert!(logs.contains("release_requested") && logs.contains("\"id\":1") && logs.contains("\"stat\":\"mean\""));
    assert_eq!(c.get_policy().in_flight.unwrap().id, 1);
    let r = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| c.request_release(QUERY.into())));
    assert!(r.is_err(), "a second request while one runs must be refused");
}

#[test]
#[should_panic(expected = "group_by")]
fn bad_query_is_refused() {
    let mut c = seeded(3);
    testing_env!(ctx("dao.testnet", None).build());
    c.request_release(r#"{"stat":"mean"}"#.into());
}

fn callback(c: &mut Bandsheet, id: u32, result: PromiseResult) -> String {
    testing_env!(ctx("union.testnet", None).build(), near_sdk::test_vm_config(), near_sdk::RuntimeFeesConfig::test(), Default::default(), vec![result]);
    c.on_release(id, QUERY.into(), "ff".repeat(32), acct("dao.testnet"))
}

fn ok_output(status: &str, cell_mean: u64) -> PromiseResult {
    let v = json!({
        "release_id": 1, "status": status,
        "cells": [{"key": {"grade": "Senior"}, "n": 4, "mean_eur": cell_mean}],
        "suppressed": [{"key": {"grade": "Chief"}, "reason": "small_cell", "witness": "n=1 < k=3"}],
        "history": {"v": 1, "blob": format!("h{cell_mean}")},
        "input_hash": "aa", "output_hash": "bb", "signature": "sig1"
    });
    PromiseResult::Successful(v.to_string().into_bytes())
}

#[test]
fn callback_appends_a_record_with_witnesses_and_history() {
    let mut c = seeded(3);
    testing_env!(ctx("dao.testnet", None).build());
    c.request_release(QUERY.into());
    assert_eq!(callback(&mut c, 1, ok_output("partially_released", 51_000)), "partially_released");
    let r = c.get_release(1).unwrap();
    assert_eq!(r.status, "partially_released");
    assert_eq!(r.cells[0]["mean_eur"], 51_000);
    assert_eq!(r.suppressed[0]["witness"], "n=1 < k=3");
    assert_eq!(r.proof["signature"], "sig1");
    assert_eq!(r.input_hash, "aa");
    assert_eq!(r.output_sha256.len(), 64);
    assert!(c.get_history().unwrap().contains("h51000"));
    assert!(c.get_policy().in_flight.is_none());
}

#[test]
fn records_are_append_only_and_never_change() {
    let mut c = seeded(3);
    testing_env!(ctx("dao.testnet", None).build());
    c.request_release(QUERY.into());
    callback(&mut c, 1, ok_output("released", 51_000));
    let first = serde_json::to_string(&c.get_release(1).unwrap()).unwrap();
    testing_env!(ctx("dao.testnet", None).build());
    assert_eq!(c.request_release(QUERY.into()), 2);
    callback(&mut c, 2, ok_output("refused", 52_000));
    assert_eq!(c.release_count(), 2);
    assert_eq!(serde_json::to_string(&c.get_release(1).unwrap()).unwrap(), first, "release 1 must not change");
    let page: Vec<Value> = serde_json::from_str(&serde_json::to_string(&c.get_releases(Some(0), Some(10))).unwrap()).unwrap();
    assert_eq!(page.len(), 2);
    assert_eq!(page[1]["status"], "refused");
}

#[test]
fn a_null_result_is_logged_as_an_error_record() {
    let mut c = seeded(3);
    testing_env!(ctx("dao.testnet", None).build());
    c.request_release(QUERY.into());
    assert_eq!(callback(&mut c, 1, PromiseResult::Successful(b"null".to_vec())), "error");
    assert!(c.get_release(1).unwrap().note.contains("no result"));
    assert!(c.get_history().is_none());
    testing_env!(ctx("dao.testnet", None).build());
    assert_eq!(c.request_release(QUERY.into()), 2, "retry is possible after a failed run");
}

#[test]
fn enclave_input_matches_the_brief() {
    let entries = [ct("a").to_string(), "YWJjZA==".to_string()];
    let refs: Vec<&String> = entries.iter().collect();
    let history = r#"{"v":1}"#.to_string();
    let input: Value = serde_json::from_str(&outlayer::build_input(3, QUERY, &refs, Some(&history))).unwrap();
    assert_eq!(input["policy"]["k"], 3);
    assert_eq!(input["query"]["group_by"][0], "grade");
    assert_eq!(input["entries"][0]["epk"], "a");
    assert_eq!(input["entries"][1], "YWJjZA==");
    assert_eq!(input["history"]["v"], 1);
    let none: Value = serde_json::from_str(&outlayer::build_input(3, QUERY, &refs, None)).unwrap();
    assert!(none["history"].is_null());
}

#[test]
#[should_panic(expected = "frozen once a release exists")]
fn policy_is_frozen_after_the_first_release() {
    let mut c = seeded(3);
    testing_env!(ctx("dao.testnet", None).build());
    c.request_release(QUERY.into());
    callback(&mut c, 1, ok_output("released", 51_000));
    testing_env!(ctx("owner.testnet", None).build());
    c.set_policy(3, "new".into(), "ab".repeat(32), "cd".repeat(32));
}

#[test]
fn a_guest_error_is_logged_as_a_failed_release_without_a_panic() {
    let mut c = seeded(3);
    testing_env!(ctx("dao.testnet", None).build());
    c.request_release(QUERY.into());
    let out = json!({"error": "history blob could not be opened", "code": "E_HISTORY"});
    assert_eq!(callback(&mut c, 1, PromiseResult::Successful(out.to_string().into_bytes())), "error");
    let r = c.get_release(1).unwrap();
    assert!(r.note.contains("E_HISTORY") && r.cells.as_array().unwrap().is_empty());
    assert!(c.get_history().is_none() && c.get_policy().in_flight.is_none());
}
