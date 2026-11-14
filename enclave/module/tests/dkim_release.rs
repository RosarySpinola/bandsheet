//! Releases with `require_dkim: true` over the generated payslip fixtures (fixtures/dkim).
use base64::{engine::general_purpose::STANDARD, Engine};
use bandsheet_enclave::crypto::{self, INFO_ENTRY};
use bandsheet_enclave::run::{handle, output_hash};
use serde_json::{json, Value};

const SK: [u8; 32] = [7u8; 32];
const ROOT: &str = concat!(env!("CARGO_MANIFEST_DIR"), "/../../fixtures/dkim");

fn env_with_sk(name: &str) -> Option<String> {
    (name == "ENCLAVE_X25519_SK").then(|| hex::encode(SK))
}
fn read(rel: &str) -> Vec<u8> {
    std::fs::read(format!("{ROOT}/{rel}")).unwrap()
}
fn manifest() -> Value {
    serde_json::from_slice(&read("manifest.json")).unwrap()
}

fn seal(plain: Value) -> Value {
    serde_json::to_value(crypto::seal(INFO_ENTRY, &crypto::public_key(&SK), plain.to_string().as_bytes()).unwrap()).unwrap()
}

/// An entry claiming `m`'s fields, carrying the email at `eml` (None = no email).
fn entry_for(m: &Value, eml: Option<&str>, t: u64) -> Value {
    let mut p = json!({"slot": m["slot"], "gross_annual_eur": m["gross_annual_eur"], "grade": m["grade"],
        "gender": m["gender"], "site": m["site"], "submitted_at": t});
    if let Some(rel) = eml {
        p["eml_b64"] = json!(STANDARD.encode(read(rel)));
    }
    seal(p)
}

fn members(joiner: bool) -> Vec<Value> {
    manifest()["members"].as_array().unwrap().iter().filter(|m| joiner || !m["joiner"].as_bool().unwrap()).cloned().collect()
}
fn good_entries(joiner: bool) -> Vec<Value> {
    members(joiner).iter().map(|m| entry_for(m, m["eml"].as_str(), 1_762_000_000)).collect()
}
fn negative_entries() -> Vec<Value> {
    manifest()["negatives"].as_array().unwrap().iter().map(|n| {
        let c = &n["claim"];
        let mut p = c.clone();
        p["eml_b64"] = json!(STANDARD.encode(read(n["eml"].as_str().unwrap())));
        seal(p)
    }).collect()
}

fn policy(require: bool, issuers: Value) -> Value {
    json!({"k": 3, "require_dkim": require, "trusted_issuers": issuers})
}
fn chapel_issuers() -> Value {
    json!([manifest()["issuer"].clone()])
}
fn call(id: u32, policy: Value, entries: &[Value], history: &Value) -> Value {
    let raw = json!({"policy": policy, "query": {"id": id, "group_by": ["grade"], "stat": "mean"}, "entries": entries, "history": history}).to_string();
    serde_json::from_str(&handle(raw.as_bytes(), &env_with_sk)).unwrap()
}
fn rejections(r: &Value) -> Vec<(String, u64)> {
    r["rejections"].as_array().unwrap().iter().map(|x| (x["reason"].as_str().unwrap().to_string(), x["count"].as_u64().unwrap())).collect()
}

#[test]
fn full_fixture_set_gives_the_hero_bands_with_the_forged_entry_excluded() {
    let mut all = good_entries(false);
    all.extend(negative_entries());
    let r = call(1, policy(true, chapel_issuers()), &all, &Value::Null);
    assert_eq!(r["entries_verified"], 36);
    assert_eq!(r["entries_used"], 36);
    assert_eq!(r["engine"], "bandsheet-enclave/0.2.0+dkim");
    assert_eq!(
        rejections(&r),
        [("dkim_bad_signature".to_string(), 2), ("duplicate_payslip".to_string(), 1), ("untrusted_issuer".to_string(), 2)]
    );
    // The same 36 members without any emails or DKIM give exactly these bands: nothing forged leaked in.
    let plain: Vec<Value> = members(false).iter().map(|m| entry_for(m, None, 1_762_000_000)).collect();
    let base = call(1, json!({"k": 3}), &plain, &Value::Null);
    assert_eq!(r["cells"], base["cells"]);
    assert_eq!(r["suppressed"], base["suppressed"]);
    let senior = r["cells"].as_array().unwrap().iter().find(|c| c["key"]["grade"] == "Senior").unwrap();
    assert_eq!(senior["n"], 9, "nine seeded Seniors; the forged EUR 82,900 entry is not among them");
    assert_eq!(senior["mean_eur"], 62_400);
    // Without the gate the forged entry (and the unsigned ones) poison the Senior band.
    let mut poisoned = good_entries(false);
    poisoned.extend(negative_entries());
    let open = call(1, json!({"k": 3}), &poisoned, &Value::Null);
    let s2 = open["cells"].as_array().unwrap().iter().find(|c| c["key"]["grade"] == "Senior").unwrap();
    assert_ne!(s2["mean_eur"], 62_400);
    // The output hash covers the new fields.
    let mut body = r.as_object().unwrap().clone();
    let claimed = body.remove("output_hash").unwrap();
    assert_eq!(claimed, json!(output_hash(&body)));
}

#[test]
fn rejections_name_reasons_and_counts_never_identities() {
    let mut all = good_entries(false);
    all.extend(negative_entries());
    let out = call(1, policy(true, chapel_issuers()), &all, &Value::Null).to_string();
    for n in manifest()["negatives"].as_array().unwrap() {
        assert!(!out.contains(n["claim"]["slot"].as_str().unwrap()));
    }
    for id in ["HC-9001", "HC-9002", "HC-9003", "HC-0412"] {
        assert!(!out.contains(id));
    }
    assert!(!out.contains("Halvorsen") && !out.contains("82900"));
}

#[test]
fn hero_release_two_still_holds_the_joiners_cell_under_dkim() {
    let r1 = call(1, policy(true, chapel_issuers()), &good_entries(false), &Value::Null);
    assert_eq!(r1["status"], "released", "3 Chiefs in the seed, so no small cell");
    let r2 = call(2, policy(true, chapel_issuers()), &good_entries(true), &r1["history"]);
    assert_eq!(r2["entries_verified"], 37);
    assert_eq!(rejections(&r2), vec![]);
    assert!(r2["cells"].as_array().unwrap().iter().all(|c| c["key"]["grade"] != "Senior"));
    let s = r2["suppressed"].as_array().unwrap().iter().find(|s| s["key"]["grade"] == "Senior").unwrap();
    assert_eq!(s["witness"], "Release #2 Senior - Release #1 Senior isolates 1 member");
}

#[test]
fn entry_that_disagrees_with_its_signed_payslip_is_a_body_mismatch() {
    let ingrid = members(false).into_iter().find(|m| m["name"] == "Ingrid Halvorsen").unwrap();
    let mut inflated = ingrid.clone();
    inflated["gross_annual_eur"] = json!(80_000); // genuine email says 58,900
    let mut too_far = ingrid.clone();
    too_far["gross_annual_eur"] = json!(58_901); // EUR 1.04 away
    let mut regraded = ingrid.clone();
    regraded["grade"] = json!("Editor");
    let mut near = ingrid.clone();
    near["gross_annual_eur"] = json!(58_899); // 4,908.33 x 12 = 58,899.96: EUR 0.96 away, inside the EUR 1 tolerance
    let e = ingrid["eml"].as_str();
    let es = vec![entry_for(&inflated, e, 1), entry_for(&regraded, e, 1), entry_for(&too_far, e, 1)];
    let r = call(1, policy(true, chapel_issuers()), &es, &Value::Null);
    assert_eq!(rejections(&r), vec![("body_mismatch".to_string(), 3)]);
    assert_eq!(r["entries_verified"], 0);
    let ok = call(1, policy(true, chapel_issuers()), &[entry_for(&near, e, 1)], &Value::Null);
    assert_eq!(ok["entries_verified"], 1);
}

#[test]
fn missing_email_and_unreadable_email_are_no_email() {
    let m = members(false)[0].clone();
    let mut junk = json!({"slot": m["slot"], "gross_annual_eur": 1, "grade": "Junior", "gender": "F", "site": "City", "submitted_at": 1, "eml_b64": "%%%"});
    junk["slot"] = json!("b".repeat(64));
    let r = call(1, policy(true, chapel_issuers()), &[entry_for(&m, None, 1), seal(junk)], &Value::Null);
    assert_eq!(rejections(&r), vec![("no_email".to_string(), 2)]);
}

#[test]
fn resubmitting_the_same_payslip_replaces_it_and_is_not_a_duplicate() {
    let m = members(false)[0].clone();
    let es = vec![entry_for(&m, m["eml"].as_str(), 100), entry_for(&m, m["eml"].as_str(), 200)];
    let r = call(1, policy(true, chapel_issuers()), &es, &Value::Null);
    assert_eq!((r["entries_used"].as_u64(), r["entries_superseded"].as_u64()), (Some(1), Some(1)));
    assert_eq!(rejections(&r), vec![]);
}

#[test]
fn the_same_payslip_from_two_slots_counts_once_and_the_latest_wins() {
    let ms = members(false);
    let (a, b) = (ms[0].clone(), ms[1].clone());
    let mut copy = b.clone(); // slot b submits a's payslip, claiming a's fields
    copy["grade"] = a["grade"].clone();
    copy["gross_annual_eur"] = a["gross_annual_eur"].clone();
    let es = vec![entry_for(&a, a["eml"].as_str(), 100), entry_for(&copy, a["eml"].as_str(), 200)];
    let r = call(1, policy(true, chapel_issuers()), &es, &Value::Null);
    assert_eq!(r["entries_used"], 1);
    assert_eq!(rejections(&r), vec![("duplicate_payslip".to_string(), 1)]);
}

#[test]
fn no_trusted_issuer_means_every_entry_is_untrusted_and_a_bad_issuer_is_an_input_error() {
    let r = call(1, policy(true, json!([])), &good_entries(false), &Value::Null);
    assert_eq!(rejections(&r), vec![("untrusted_issuer".to_string(), 36)]);
    assert_eq!(r["status"], "refused");
    let bad = call(1, policy(true, json!([{"domain": "x.example", "selector": "s", "rsa_pubkey_spki_b64": "AAAA"}])), &[], &Value::Null);
    assert_eq!(bad["code"], "E_INPUT");
    let other: Value = serde_json::from_slice(&read("issuer.json")).unwrap();
    let wrong_only = json!([other["other_issuer"].clone()]);
    let r2 = call(1, policy(true, wrong_only), &good_entries(false), &Value::Null);
    assert_eq!(rejections(&r2), vec![("untrusted_issuer".to_string(), 36)]);
}
