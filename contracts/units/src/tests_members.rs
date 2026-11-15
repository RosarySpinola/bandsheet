//! Unit tests: joining (registrar + invite code), synthetic members, submit routing and unit isolation.
use near_sdk::test_utils::{get_created_receipts, get_logs};
use near_sdk::mock::MockAction;
use near_sdk::serde_json::json;
use near_sdk::{testing_env, NearToken};

use crate::tests::*;

#[test]
fn registrar_adds_a_member_with_the_right_invite_code() {
    let mut c = fresh();
    let u = with_unit(&mut c, "alice.testnet", &[]);
    for who in ["alice.testnet", "mallory.testnet", UNITS] {
        as_(who);
        panics(|| { c.unit_add_member(u, key(1), code(u), false); }, "only the units registrar");
    }
    as_(REG);
    panics(|| { c.unit_add_member(u, key(1), "code-2".into(), false); }, "invite code does not match");
    panics(|| { c.unit_add_member(u, key(1), String::new(), false); }, "invite code does not match");
    panics(|| { c.unit_add_member(u, key(1), "x".repeat(129), false); }, "too long");
    assert_eq!(c.unit_add_member(u, key(1), code(u), false), 1);
    // a function-call key on this account, method submit only, with an allowance
    let receipts = get_created_receipts();
    let add = receipts.iter().flat_map(|r| r.actions.iter()).find_map(|a| match a {
        MockAction::AddKeyWithFunctionCall { method_names, allowance, receiver_id, .. } => Some((method_names.clone(), *allowance, receiver_id.clone())),
        _ => None,
    });
    let (methods, allowance, receiver) = add.expect("an add-key action");
    assert_eq!(methods, vec!["submit".to_string()]);
    assert_eq!(receiver, acct(UNITS));
    assert_eq!(allowance, Some(NearToken::from_millinear(50)));
    assert!(get_logs().join("\n").contains(&format!(r#""event":"member_added","data":{{"unit_id":1,"slot":"{}","synthetic":false"#, slot(1))));
    panics(|| { c.unit_add_member(u, key(1), code(u), false); }, "already a member of a unit");
    let s = c.unit_of_slot(slot(1)).unwrap();
    assert_eq!((s.unit_id, s.synthetic, s.has_entry), (1, false, false));
    panics(|| { c.unit_add_member(7, key(2), code(7), false); }, "No unit 7");
}

#[test]
fn a_key_belongs_to_one_unit_only() {
    let mut c = fresh();
    let u1 = with_unit(&mut c, "alice.testnet", &[]);
    let u2 = with_unit(&mut c, "bob.testnet", &[]);
    add_member(&mut c, u1, 1, false);
    as_(REG);
    panics(|| { c.unit_add_member(u2, key(1), code(u2), false); }, "already a member of a unit");
    panics(|| { c.unit_add_member(u2, key(2), code(u1), false); }, "invite code does not match");
}

#[test]
fn synthetic_members_need_no_code_are_flagged_and_capped_at_eight() {
    let mut c = fresh();
    let u = with_unit(&mut c, "alice.testnet", &[]);
    for k in 1..=8 {
        add_member(&mut c, u, k, true);
    }
    assert!(get_created_receipts().iter().flat_map(|r| r.actions.iter()).any(|a| matches!(a,
        MockAction::AddKeyWithFunctionCall { allowance: Some(x), .. } if *x == NearToken::from_millinear(20))));
    as_(REG);
    panics(|| { c.unit_add_member(u, key(9), String::new(), true); }, "at most 8 synthetic colleagues");
    let v = c.get_unit(u).unwrap();
    assert_eq!((v.members, v.synthetic_members, v.synthetic_added), (8, 8, 8));
    assert!(c.unit_of_slot(slot(3)).unwrap().synthetic);
    // removing one does not free the allowance
    as_(REG);
    c.unit_remove_member(u, key(3));
    panics(|| { c.unit_add_member(u, key(9), String::new(), true); }, "at most 8 synthetic colleagues");
    // real members still join
    add_member(&mut c, u, 20, false);
    assert!(!c.unit_of_slot(slot(20)).unwrap().synthetic);
}

#[test]
fn a_unit_holds_at_most_forty_members() {
    let mut c = fresh();
    let u = with_unit(&mut c, "alice.testnet", &[]);
    for k in 1..=40 {
        add_member(&mut c, u, k, false);
    }
    as_(REG);
    panics(|| { c.unit_add_member(u, key(41), code(u), false); }, "at most 40 members");
}

#[test]
fn submit_routes_to_the_slots_unit_and_replaces() {
    let mut c = fresh();
    let u1 = with_unit(&mut c, "alice.testnet", &[]);
    let u2 = with_unit(&mut c, "bob.testnet", &[]);
    add_member(&mut c, u1, 1, false);
    add_member(&mut c, u1, 2, false);
    add_member(&mut c, u2, 3, false);
    assert_eq!(submit_as(&mut c, 1, "a"), 1);
    assert_eq!(submit_as(&mut c, 2, "b"), 2);
    assert_eq!(submit_as(&mut c, 3, "c"), 1, "unit 2 counts only its own entry");
    assert_eq!(submit_as(&mut c, 1, "a2"), 2, "a resubmission replaces");
    assert!(get_logs().join("\n").contains(r#""replaced":true"#));
    let e1 = c.get_unit_entries(u1, None, None);
    let e2 = c.get_unit_entries(u2, None, None);
    assert_eq!(e1.len(), 2);
    assert!(e1.iter().any(|e| e.contains("a2")) && !e1.iter().any(|e| e.contains(r#""a""#)) && !e1.iter().any(|e| e.contains(r#""c""#)));
    assert_eq!(e2.len(), 1);
    assert!(e2[0].contains(r#""c""#));
    assert_eq!((c.get_unit(u1).unwrap().entries, c.get_unit(u2).unwrap().entries), (2, 1));
    assert!(c.unit_of_slot(slot(1)).unwrap().has_entry);
    assert_eq!(c.get_units_stats().entries, 3);
}

#[test]
fn submit_refusals() {
    let mut c = fresh();
    let u = with_unit(&mut c, "alice.testnet", &[]);
    add_member(&mut c, u, 1, false);
    // an outside account (any wallet) is refused even when it signs with a member's key
    testing_env!(ctx("mallory.testnet", Some(key(1))).build());
    panics(|| { c.submit(json!({"epk": "a", "nonce": "b", "ct": "c"})); }, "outside the units contract");
    // the units account's own key that is not a posting key
    testing_env!(ctx(UNITS, Some(key(99))).build());
    panics(|| { c.submit(json!({"epk": "a", "nonce": "b", "ct": "c"})); }, "not a member of any unit");
    testing_env!(ctx(UNITS, Some(key(1))).build());
    panics(|| { c.submit(json!({"epk": "a", "nonce": "b"})); }, "Ciphertext must be");
    panics(|| { c.submit(json!({"epk": "a b", "nonce": "b", "ct": "c"})); }, "Ciphertext must be");
    panics(|| { c.submit(json!(42)); }, "Ciphertext must be");
    panics(|| { c.submit(json!({"epk": "a", "nonce": "b", "ct": "A".repeat(16_400)})); }, "too large");
    testing_env!(ctx(UNITS, Some(key(1))).account_balance(NearToken::from_millinear(100)).build());
    panics(|| { c.submit(json!({"epk": "a", "nonce": "b", "ct": "c"})); }, "low on storage balance");
    assert_eq!(c.get_unit(u).unwrap().entries, 0);
}

#[test]
fn a_synthetic_key_submits_once_and_deletes_itself() {
    let mut c = fresh();
    let u = with_unit(&mut c, "alice.testnet", &[]);
    add_member(&mut c, u, 5, true);
    submit_as(&mut c, 5, "s");
    assert!(get_logs().join("\n").contains(r#""synthetic":true"#));
    let deleted = get_created_receipts().iter().flat_map(|r| r.actions.iter()).any(|a| matches!(a, MockAction::DeleteKey { .. }));
    assert!(deleted, "the synthetic key is deleted after its submit");
    add_member(&mut c, u, 6, false);
    submit_as(&mut c, 6, "r");
    assert!(!get_created_receipts().iter().flat_map(|r| r.actions.iter()).any(|a| matches!(a, MockAction::DeleteKey { .. })), "a real key stays");
}

#[test]
fn registrar_removes_a_member_and_its_entry() {
    let mut c = fresh();
    let u1 = with_unit(&mut c, "alice.testnet", &[]);
    let u2 = with_unit(&mut c, "bob.testnet", &[]);
    add_member(&mut c, u1, 1, false);
    add_member(&mut c, u1, 2, false);
    submit_as(&mut c, 1, "a");
    submit_as(&mut c, 2, "b");
    as_("alice.testnet");
    panics(|| c.unit_remove_member(u1, key(1)), "only the units registrar");
    as_(REG);
    panics(|| c.unit_remove_member(u2, key(1)), "belongs to another unit");
    panics(|| c.unit_remove_member(u1, key(9)), "not a member");
    c.unit_remove_member(u1, key(1));
    assert!(get_created_receipts().iter().flat_map(|r| r.actions.iter()).any(|a| matches!(a, MockAction::DeleteKey { .. })));
    let v = c.get_unit(u1).unwrap();
    assert_eq!((v.members, v.entries), (1, 1));
    assert!(c.unit_of_slot(slot(1)).is_none());
    assert_eq!(c.get_unit_entries(u1, None, None).len(), 1);
    testing_env!(ctx(UNITS, Some(key(1))).build());
    panics(|| { c.submit(json!({"epk": "a", "nonce": "b", "ct": "c"})); }, "not a member of any unit");
    // the key can join again later (a fresh slot entry)
    add_member(&mut c, u1, 1, false);
    assert_eq!(c.get_unit(u1).unwrap().members, 2);
}

#[test]
fn views_page_and_never_mix_units() {
    let mut c = fresh();
    let u1 = with_unit(&mut c, "alice.testnet", &[]);
    for k in 1..=5 {
        add_member(&mut c, u1, k, false);
        submit_as(&mut c, k, &format!("e{k}"));
    }
    assert_eq!(c.get_unit_entries(u1, Some(3), Some(10)).len(), 2);
    assert_eq!(c.get_unit_entries(u1, Some(9), None).len(), 0);
    assert!(c.get_unit_entries(2, None, None).is_empty());
    assert!(c.get_unit_proposals(2, None, None).is_empty());
    assert!(c.get_unit_releases(2, None, None).is_empty());
    assert_eq!(c.slot_of(key(1)), slot(1));
    let s = c.get_units_stats();
    assert_eq!((s.units, s.members, s.entries, s.releases), (1, 5, 5, 0));
}

#[test]
fn remove_and_rejoin_cannot_mint_allowances_forever() {
    let mut c = fresh();
    let u = with_unit(&mut c, "alice.testnet", &[]);
    for _ in 0..120 {
        add_member(&mut c, u, 1, false);
        as_(REG);
        c.unit_remove_member(u, key(1));
    }
    as_(REG);
    panics(|| { c.unit_add_member(u, key(1), code(u), false); }, "at most 120 member keys");
    assert_eq!(c.get_unit(u).unwrap().joins, 120);
}
