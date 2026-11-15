//! Unit tests: helpers, creating units, council seats, DKIM domains, issuer keys, admin.
use near_sdk::json_types::U128;
use near_sdk::serde_json::{json, Value};
use near_sdk::test_utils::{get_logs, VMContextBuilder};
use near_sdk::{env, testing_env, AccountId, CurveType, Gas, NearToken, PublicKey};

use crate::*;

pub(crate) const UNITS: &str = "units.testnet";
pub(crate) const REG: &str = "registrar.testnet";

pub(crate) fn acct(s: &str) -> AccountId {
    s.parse().unwrap()
}

pub(crate) fn key(n: u8) -> PublicKey {
    PublicKey::from_parts(CurveType::ED25519, vec![n; 32]).unwrap()
}

pub(crate) fn slot(n: u8) -> String {
    crate::util::member_slot(&key(n))
}

pub(crate) fn ctx(predecessor: &str, signer_pk: Option<PublicKey>) -> VMContextBuilder {
    let mut b = VMContextBuilder::new();
    b.current_account_id(acct(UNITS))
        .predecessor_account_id(acct(predecessor))
        .signer_account_id(acct(predecessor))
        .account_balance(NearToken::from_near(100))
        .prepaid_gas(Gas::from_tgas(300));
    if let Some(pk) = signer_pk {
        b.signer_account_pk(pk);
    }
    b
}

pub(crate) fn as_(who: &str) {
    testing_env!(ctx(who, None).build());
}

pub(crate) fn outlayer_cfg() -> OutlayerCfg {
    OutlayerCfg {
        account: acct("outlayer.testnet"),
        source: r#"{"Project":{"project_id":"bandsheet-enclave.testnet/bandsheet-enclave","version_key":null}}"#.into(),
        secrets_ref: r#"{"profile":"default","account_id":"bandsheet-enclave.testnet"}"#.into(),
        run_deposit: U128(50_000_000_000_000_000_000_000),
    }
}

pub(crate) fn fresh() -> Units {
    as_(UNITS);
    Units::new(acct(REG), 3, "Kn0bVgYSbpi5A3d/ldGgeVoUQr/zxTccybuYjC2JE0Y=".into(), "69".repeat(32), "53".repeat(32), outlayer_cfg())
}

/// The invite code for unit tests is "code-<n>"; the unit stores sha256 of it.
pub(crate) fn code(n: u32) -> String {
    format!("code-{n}")
}
pub(crate) fn code_hash(n: u32) -> String {
    hex::encode(env::sha256(code(n).as_bytes()))
}

/// alice creates a unit (id returned) with the given DKIM domains.
pub(crate) fn with_unit(c: &mut Units, creator: &str, domains: &[&str]) -> u32 {
    as_(creator);
    let n = c.get_units_stats().units + 1;
    c.create_unit(format!("Unit {n}"), code_hash(n), domains.iter().map(|d| d.to_string()).collect())
}

pub(crate) fn add_member(c: &mut Units, unit: u32, k: u8, synthetic: bool) -> u32 {
    as_(REG);
    c.unit_add_member(unit, key(k), if synthetic { String::new() } else { code(unit) }, synthetic)
}

pub(crate) fn submit_as(c: &mut Units, k: u8, tag: &str) -> u64 {
    testing_env!(ctx(UNITS, Some(key(k))).build());
    c.submit(json!({"epk": tag, "nonce": "bm9uY2U=", "ct": "Y3Q="})).0
}

pub(crate) fn panics<F: FnOnce()>(f: F, expected: &str) {
    let r = std::panic::catch_unwind(std::panic::AssertUnwindSafe(f));
    let msg = match r {
        Ok(()) => panic!("expected a panic containing {expected:?}"),
        Err(e) => e.downcast_ref::<String>().cloned().or_else(|| e.downcast_ref::<&str>().map(|s| s.to_string())).unwrap_or_default(),
    };
    assert!(msg.contains(expected), "panic {msg:?} does not contain {expected:?}");
}

pub(crate) const RSA: &str = "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAwYQbPBZJmFq1ZaRZ8n3t2hT5t7kQ0hM9bZcVY2xg1Y3nJ0dI4ZfJp7r8Kq4m2s7N2wQ1kq9Vb3rX5Y8nU4cR8e6hD1yT2pS0fG3jK5lM7nO9qR2tU4vW6xY8zA0bC2dE4fG6hI8jK0lM2nO4pQ6rS8tU0vW2xY4zA6bC8dE0fG2hI4jK6lM8nO0pQ2rS4tU6vW8xY0zA2bC4dE6fG8hI0jK2lM4nO6pQ8rS0tU2vW4xY6zA8bC0dE2fG4hI6jK8lM0nO2pQ4rS6tU8vW0xY2zA4bC6dE8fG0hI2jK4lM6nO8pQ0rS2tU4vW6xY8zA0bC2dE4fG6hI8jK0lM2nO4pQ6rS8tU0vW2xQIDAQAB";

#[test]
fn create_unit_makes_the_caller_seat_one() {
    let mut c = fresh();
    as_("alice.testnet");
    let id = c.create_unit("Harbour Night Desk".into(), code_hash(1), vec!["Payroll.Example.COM".into(), "payroll.example.com".into()]);
    assert_eq!(id, 1);
    assert!(get_logs().join("\n").contains(r#""event":"unit_created","data":{"unit_id":1,"name":"Harbour Night Desk","creator":"alice.testnet"}"#));
    let u = c.get_unit(1).unwrap();
    assert_eq!(u.council, vec![acct("alice.testnet")]);
    assert_eq!(u.threshold, 1);
    assert_eq!(u.dkim_domains, vec!["payroll.example.com".to_string()], "domains are lower-cased and de-duplicated");
    assert_eq!(c.get_units_of(acct("alice.testnet")).len(), 1);
    assert!(c.get_units_of(acct("bob.testnet")).is_empty());
    assert!(c.get_unit(2).is_none());
    assert_eq!(c.get_units_stats().units, 1);
}

#[test]
fn create_unit_refusals() {
    let mut c = fresh();
    as_("alice.testnet");
    panics(|| { c.create_unit("x".into(), "ABC".into(), vec![]); }, "invite_code_hash");
    panics(|| { c.create_unit("  ".into(), code_hash(1), vec![]); }, "unit name");
    panics(|| { c.create_unit("a\u{7}b".into(), code_hash(1), vec![]); }, "unit name");
    panics(|| { c.create_unit("x".repeat(81), code_hash(1), vec![]); }, "unit name");
    panics(|| { c.create_unit("x".into(), code_hash(1), vec!["nodot".into()]); }, "not a domain");
    panics(|| { c.create_unit("x".into(), code_hash(1), vec!["bad_domain.com".into()]); }, "not a domain");
    let five: Vec<String> = (0..5).map(|i| format!("d{i}.example")).collect();
    panics(|| { c.create_unit("x".into(), code_hash(1), five); }, "At most 4 DKIM domains");
    assert_eq!(c.get_units_stats().units, 0);
}

#[test]
fn an_account_starts_at_most_three_units() {
    let mut c = fresh();
    for _ in 0..3 {
        with_unit(&mut c, "alice.testnet", &[]);
    }
    as_("alice.testnet");
    panics(|| { c.create_unit("Fourth".into(), code_hash(4), vec![]); }, "at most 3 units");
    assert_eq!(with_unit(&mut c, "bob.testnet", &[]), 4, "another account still can");
}

#[test]
fn the_contract_holds_at_most_400_units() {
    let mut c = fresh();
    for i in 0..MAX_UNITS {
        with_unit(&mut c, &format!("a{}.testnet", i / 3), &[]);
    }
    as_("late.testnet");
    panics(|| { c.create_unit("One more".into(), code_hash(401), vec![]); }, "All 400 units are taken");
}

#[test]
fn create_is_refused_when_the_contract_is_low_on_balance() {
    let mut c = fresh();
    testing_env!(ctx("alice.testnet", None).account_balance(NearToken::from_millinear(100)).build());
    panics(|| { c.create_unit("Poor".into(), code_hash(1), vec![]); }, "low on storage balance");
}

#[test]
fn council_adds_seats_by_more_than_half_and_up_to_five() {
    let mut c = fresh();
    let u = with_unit(&mut c, "alice.testnet", &[]);
    as_("mallory.testnet");
    panics(|| { c.unit_add_council(u, acct("mallory.testnet")); }, "not on unit 1's council");
    as_("alice.testnet");
    assert_eq!(c.unit_add_council(u, acct("bob.testnet")), "added", "a one-seat council adds at once");
    panics(|| { c.unit_add_council(u, acct("bob.testnet")); }, "already holds a seat");
    // two seats: one approval is half, not more than half
    assert_eq!(c.unit_add_council(u, acct("carol.testnet")), "pending");
    panics(|| { c.unit_add_council(u, acct("carol.testnet")); }, "already approved");
    assert_eq!(c.get_unit(u).unwrap().pending_seats.len(), 1);
    assert!(c.get_units_of(acct("carol.testnet")).is_empty(), "a pending seat is not a seat");
    as_("bob.testnet");
    assert_eq!(c.unit_add_council(u, acct("carol.testnet")), "added");
    assert!(c.get_unit(u).unwrap().pending_seats.is_empty());
    // three seats: two approvals add; one member alone cannot pack the council
    as_("alice.testnet");
    assert_eq!(c.unit_add_council(u, acct("mallory1.testnet")), "pending");
    assert_eq!(c.unit_add_council(u, acct("mallory2.testnet")), "pending");
    assert_eq!(c.get_unit(u).unwrap().council.len(), 3);
    as_("carol.testnet");
    assert_eq!(c.unit_add_council(u, acct("dan.testnet")), "pending");
    as_("bob.testnet");
    assert_eq!(c.unit_add_council(u, acct("dan.testnet")), "added");
    // four seats now: three approvals needed
    as_("alice.testnet");
    assert_eq!(c.unit_add_council(u, acct("erin.testnet")), "pending");
    as_("bob.testnet");
    assert_eq!(c.unit_add_council(u, acct("erin.testnet")), "pending");
    as_("carol.testnet");
    assert_eq!(c.unit_add_council(u, acct("erin.testnet")), "added");
    as_("alice.testnet");
    panics(|| { c.unit_add_council(u, acct("frank.testnet")); }, "at most 5 seats");
    let v = c.get_unit(u).unwrap();
    assert_eq!(v.council.len(), 5);
    assert_eq!(v.threshold, 3);
    assert_eq!(c.get_units_of(acct("erin.testnet"))[0].id, u);
    panics(|| { c.unit_add_council(9, acct("x.testnet")); }, "No unit 9");
}

#[test]
fn council_rotates_the_invite() {
    let mut c = fresh();
    let u = with_unit(&mut c, "alice.testnet", &[]);
    as_("bob.testnet");
    panics(|| c.unit_rotate_invite(u, code_hash(9)), "not on unit 1's council");
    as_("alice.testnet");
    panics(|| c.unit_rotate_invite(u, "zz".into()), "invite_code_hash");
    c.unit_rotate_invite(u, code_hash(9));
    as_(REG);
    panics(|| { c.unit_add_member(u, key(1), code(u), false); }, "invite code does not match");
    c.unit_add_member(u, key(1), code(9), false);
    assert_eq!(c.get_unit(u).unwrap().invite_code_hash, code_hash(9));
}

#[test]
fn council_lists_dkim_domains() {
    let mut c = fresh();
    let u = with_unit(&mut c, "alice.testnet", &["harbourcourier.example"]);
    as_("bob.testnet");
    panics(|| c.unit_add_dkim_domain(u, "other.example".into()), "not on unit 1's council");
    as_("alice.testnet");
    panics(|| c.unit_add_dkim_domain(u, "HarbourCourier.example".into()), "already listed");
    panics(|| c.unit_add_dkim_domain(u, "-bad.example".into()), "not a domain");
    for d in ["a.example", "b.example", "c.example"] {
        c.unit_add_dkim_domain(u, d.into());
    }
    panics(|| c.unit_add_dkim_domain(u, "d.example".into()), "At most 4 DKIM domains");
    assert!(get_logs().join("\n").contains("dkim_domain_added"));
}

#[test]
fn only_the_registrar_records_issuer_keys_and_only_for_listed_domains() {
    let mut c = fresh();
    let u = with_unit(&mut c, "alice.testnet", &["harbourcourier.example"]);
    for who in ["alice.testnet", "mallory.testnet", UNITS] {
        as_(who);
        panics(|| c.unit_add_issuer(u, "harbourcourier.example".into(), "payroll2026".into(), RSA.into(), None), "only the units registrar");
    }
    as_(REG);
    panics(|| c.unit_add_issuer(u, "evil.example".into(), "s1".into(), RSA.into(), None), "is not one of unit 1's DKIM domains");
    panics(|| c.unit_add_issuer(u, "harbourcourier.example".into(), "s1".into(), "short".into(), None), "RSA public key");
    panics(|| c.unit_add_issuer(u, "harbourcourier.example".into(), "s1".into(), RSA.into(), Some("web".into())), "dns or supplied");
    panics(|| c.unit_add_issuer(u, "harbourcourier.example".into(), "s\"1".into(), RSA.into(), None), "selector must be");
    let pem = format!("-----BEGIN PUBLIC KEY-----\n{}\n{}\n-----END PUBLIC KEY-----\n", &RSA[..64], &RSA[64..]);
    c.unit_add_issuer(u, "HarbourCourier.example".into(), "payroll2026".into(), pem, Some("supplied".into()));
    let v = c.get_unit(u).unwrap();
    assert_eq!(v.issuers.len(), 1);
    assert_eq!((v.issuers[0].domain.as_str(), v.issuers[0].source.as_str()), ("harbourcourier.example", "supplied"));
    assert_eq!(v.issuers[0].key_sha256, hex::encode(env::sha256(RSA.as_bytes())), "a PEM is stored as its base64 body");
    // the same selector again rotates the key, a new selector adds one
    c.unit_add_issuer(u, "harbourcourier.example".into(), "payroll2026".into(), RSA.into(), None);
    assert!(get_logs().join("\n").contains(r#""rotated":true"#));
    assert_eq!(c.get_unit(u).unwrap().issuers[0].source, "dns");
    for i in 0..7 {
        c.unit_add_issuer(u, "harbourcourier.example".into(), format!("s{i}"), RSA.into(), None);
    }
    panics(|| c.unit_add_issuer(u, "harbourcourier.example".into(), "s9".into(), RSA.into(), None), "At most 8 issuer keys");
    // unit 2 lists other domains: the key cannot land there
    let u2 = with_unit(&mut c, "bob.testnet", &["other.example"]);
    as_(REG);
    panics(|| c.unit_add_issuer(u2, "harbourcourier.example".into(), "payroll2026".into(), RSA.into(), None), "unit 2's DKIM domains");
}

#[test]
fn policy_view_carries_the_engine_and_caps() {
    let c = fresh();
    let p = c.get_policy();
    assert_eq!(p.k, 3);
    assert_eq!(p.wasm_sha256, "69".repeat(32));
    assert_eq!(p.registrar, acct(REG));
    assert!(p.outlayer.source.contains("bandsheet-enclave.testnet/bandsheet-enclave"));
    let caps: Value = near_sdk::serde_json::to_value(&p.caps).unwrap();
    assert_eq!(caps["synthetic_per_unit"], 8);
    assert_eq!(caps["releases_per_unit_per_day"], 5);
    assert!(!p.frozen);
}

#[test]
fn init_and_admin_refusals() {
    as_(UNITS);
    panics(|| { Units::new(acct(REG), 1, "k".into(), "69".repeat(32), "53".repeat(32), outlayer_cfg()); }, "k must be between");
    let mut bad = outlayer_cfg();
    bad.source = "not json".into();
    panics(|| { Units::new(acct(REG), 3, "k".into(), "69".repeat(32), "53".repeat(32), bad.clone()); }, "valid JSON");
    let mut c = fresh();
    as_("alice.testnet");
    panics(|| c.set_outlayer(outlayer_cfg()), "only the units registrar");
    panics(|| c.set_run_deposit(U128(1)), "only the units registrar");
    as_(REG);
    c.set_run_deposit(U128(60_000_000_000_000_000_000_000));
    assert_eq!(c.get_policy().outlayer.run_deposit.0, 60_000_000_000_000_000_000_000);
    panics(|| c.set_run_deposit(U128(2_000_000_000_000_000_000_000_000)), "At most 1 NEAR");
    panics(|| c.set_outlayer(bad), "valid JSON");
    c.set_outlayer(outlayer_cfg());
}
