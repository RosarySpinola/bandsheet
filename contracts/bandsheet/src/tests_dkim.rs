//! DKIM governance tests: DAO-only setters, passing the policy fields to the enclave, extras on records.
use near_sdk::serde_json::{self, json, Value};
use near_sdk::test_utils::get_logs;
use near_sdk::{testing_env, PromiseResult};

use crate::tests::*;
use crate::*;

const SPKI: &str = "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAtestkeytestkeytestkey";

fn as_dao() {
    testing_env!(ctx("dao.testnet", None).build());
}

#[test]
fn dao_adds_and_removes_an_issuer() {
    let mut c = fresh();
    as_dao();
    c.add_issuer("HarbourCourier.example".into(), "payroll2026".into(), SPKI.into());
    let list = c.get_issuers();
    assert_eq!(list.len(), 1);
    assert_eq!(list[0].domain, "harbourcourier.example");
    // the same domain and selector again is a key rotation, not a second issuer
    c.add_issuer("harbourcourier.example".into(), "payroll2026".into(), "AAAAnewkey".into());
    assert_eq!(c.get_issuers().len(), 1);
    assert_eq!(c.get_issuers()[0].rsa_pubkey_spki_b64, "AAAAnewkey");
    c.remove_issuer("harbourcourier.example".into(), "payroll2026".into());
    assert!(c.get_issuers().is_empty());
    assert!(get_logs().join("\n").contains("issuer_removed"));
}

#[test]
#[should_panic(expected = "only the union's DAO")]
fn outsider_cannot_add_an_issuer() {
    let mut c = fresh();
    testing_env!(ctx("mallory.testnet", None).build());
    c.add_issuer("evil.example".into(), "s".into(), SPKI.into());
}

#[test]
#[should_panic(expected = "only the union's DAO")]
fn owner_cannot_add_an_issuer_without_the_override() {
    let mut c = fresh();
    testing_env!(ctx("owner.testnet", None).build());
    c.add_issuer("harbourcourier.example".into(), "payroll2026".into(), SPKI.into());
}

#[test]
fn owner_can_set_issuers_only_with_the_demo_override() {
    let mut c = fresh();
    testing_env!(ctx("owner.testnet", None).build());
    c.set_demo_owner_override(true);
    c.add_issuer("harbourcourier.example".into(), "payroll2026".into(), SPKI.into());
    c.set_require_dkim(true);
    assert!(c.get_require_dkim());
}

#[test]
#[should_panic(expected = "only the union's DAO")]
fn outsider_cannot_flip_require_dkim() {
    let mut c = fresh();
    testing_env!(ctx("mallory.testnet", None).build());
    c.set_require_dkim(true);
}

#[test]
#[should_panic(expected = "only the union's DAO")]
fn outsider_cannot_set_the_engine() {
    let mut c = fresh();
    testing_env!(ctx("owner.testnet", None).build());
    c.set_engine("ef".repeat(32), None);
}

#[test]
#[should_panic(expected = "No such issuer")]
fn removing_an_unknown_issuer_fails() {
    let mut c = fresh();
    as_dao();
    c.remove_issuer("nobody.example".into(), "x".into());
}

#[test]
fn policy_json_carries_issuers_and_the_flag_into_the_enclave_input() {
    let mut c = fresh();
    // default: no issuers, flag off, so old releases replay unchanged
    let d: Value = serde_json::from_str(&dkim::policy_json(c.get_policy().policy.k)).unwrap();
    assert_eq!(d["require_dkim"], false);
    assert!(d["trusted_issuers"].as_array().unwrap().is_empty());
    as_dao();
    c.add_issuer("harbourcourier.example".into(), "payroll2026".into(), SPKI.into());
    c.set_require_dkim(true);
    let entries = [ct("a").to_string()];
    let refs: Vec<&String> = entries.iter().collect();
    let input: Value = serde_json::from_str(&outlayer::build_input(&dkim::policy_json(3), QUERY, &refs, None)).unwrap();
    assert_eq!(input["policy"]["k"], 3);
    assert_eq!(input["policy"]["require_dkim"], true);
    assert_eq!(input["policy"]["trusted_issuers"][0]["domain"], "harbourcourier.example");
    assert_eq!(input["policy"]["trusted_issuers"][0]["selector"], "payroll2026");
    assert_eq!(input["policy"]["trusted_issuers"][0]["rsa_pubkey_spki_b64"], SPKI);
}

#[test]
fn set_engine_records_the_new_hash_and_every_release_stores_the_one_in_effect() {
    let mut c = seeded(3);
    testing_env!(ctx("dao.testnet", None).build());
    c.request_release(QUERY.into());
    callback(&mut c, 1, ok_output("released", 51_000));
    let first = c.get_release(1).unwrap();
    assert_eq!(first.wasm_sha256.as_deref(), Some("ab".repeat(32).as_str()));
    assert!(first.rejections.as_array().unwrap().is_empty() && first.entries_verified.is_none());
    // the policy is frozen after release 1 for the owner, but the DAO can announce a rebuilt engine
    as_dao();
    c.set_engine("ef".repeat(32), Some("bmV3a2V5".into()));
    assert_eq!(c.get_policy().policy.wasm_sha256, "ef".repeat(32));
    assert_eq!(c.get_policy().policy.enclave_pubkey, "bmV3a2V5");
    testing_env!(ctx("dao.testnet", None).build());
    c.request_release(QUERY.into());
    callback(&mut c, 2, ok_output("released", 52_000));
    assert_eq!(c.get_release(2).unwrap().wasm_sha256.as_deref(), Some("ef".repeat(32).as_str()));
    assert_eq!(c.get_release(1).unwrap().wasm_sha256.as_deref(), Some("ab".repeat(32).as_str()), "release 1 is unchanged");
}

#[test]
fn rejections_and_entries_verified_are_stored_as_returned() {
    let mut c = seeded(3);
    as_dao();
    c.add_issuer("harbourcourier.example".into(), "payroll2026".into(), SPKI.into());
    c.set_require_dkim(true);
    testing_env!(ctx("dao.testnet", None).build());
    c.request_release(QUERY.into());
    let out = json!({
        "release_id": 1, "status": "partially_released", "cells": [], "suppressed": [],
        "history": {"v": 1}, "input_hash": "aa", "output_hash": "bb",
        "rejections": [{"reason": "dkim_bad_signature", "count": 1}], "entries_verified": 2
    });
    callback(&mut c, 1, PromiseResult::Successful(out.to_string().into_bytes()));
    let r = c.get_release(1).unwrap();
    assert_eq!(r.rejections[0]["reason"], "dkim_bad_signature");
    assert_eq!(r.rejections[0]["count"], 1);
    assert_eq!(r.entries_verified, Some(2));
    assert_eq!(r.require_dkim, Some(true));
    assert_eq!(r.issuers, Some(1));
    let page = c.get_releases(None, None);
    assert_eq!(page[0].entries_verified, Some(2));
}

#[test]
fn deposit_grows_with_the_input_beyond_the_free_32_kb() {
    let c = fresh();
    let cfg = c.get_policy().outlayer;
    assert_eq!(outlayer::deposit_for(&cfg, 10_000), cfg.run_deposit.0);
    let big = outlayer::deposit_for(&cfg, 95_000);
    // about 0.7 NEAR for a full 38-entry DKIM input
    assert!(big > 600_000_000_000_000_000_000_000 && big < 800_000_000_000_000_000_000_000, "{big}");
}
