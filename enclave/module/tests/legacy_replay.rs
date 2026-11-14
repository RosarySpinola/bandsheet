//! `require_dkim` absent or false must replay old releases byte for byte.
//!
//! The golden file was captured from the pre-DKIM build (0.1.0). Everything deterministic is compared
//! exactly: every output field, the engine string, the key set, and the decrypted history plaintext.
//! The sealed history envelope and the `output_hash` that covers it depend on random ephemeral keys and
//! nonces, so for those the test recomputes the hash over the new body instead (same rule as before).
use bandsheet_enclave::crypto::{self, Envelope, INFO_ENTRY, INFO_HISTORY};
use bandsheet_enclave::run::{handle, output_hash};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};

const SK: [u8; 32] = [7u8; 32];
const GOLDEN: &str = concat!(env!("CARGO_MANIFEST_DIR"), "/../test-vectors/legacy-replay.json");

fn env_with_sk(name: &str) -> Option<String> {
    (name == "ENCLAVE_X25519_SK").then(|| hex::encode(SK))
}

fn entry(name: &str, pay: u64, grade: &str, t: u64, extra: bool) -> Value {
    let mut plain = json!({"slot": hex::encode(Sha256::digest(name.as_bytes())), "gross_annual_eur": pay, "grade": grade,
        "gender": if name.len() % 2 == 0 { "F" } else { "M" }, "site": "City", "submitted_at": t});
    if extra {
        plain["eml_b64"] = json!("bm90IGFuIGVtYWls"); // ignored when require_dkim is false
    }
    serde_json::to_value(crypto::seal(INFO_ENTRY, &crypto::public_key(&SK), plain.to_string().as_bytes()).unwrap()).unwrap()
}

fn chapel(extra: bool, joiner: bool) -> Vec<Value> {
    let spec = [("Junior", 8, 30_000u64), ("Reporter", 11, 42_000), ("Senior", 12, 67_998), ("Editor", 4, 75_000), ("Chief", 1, 112_000)];
    let mut out = Vec::new();
    for (grade, n, base) in spec {
        for i in 0..n {
            out.push(entry(&format!("{grade}-{i}"), base + 10 * i as u64, grade, 1_763_000_000, extra));
        }
    }
    if joiner {
        out.push(entry("Senior-new", 70_000, "Senior", 1_763_100_000, extra));
    }
    out
}

fn policy(extra: bool) -> Value {
    if extra {
        json!({"k": 3, "require_dkim": false, "trusted_issuers": [{"domain": "x.example", "selector": "s", "rsa_pubkey_spki_b64": "!!"}]})
    } else {
        json!({"k": 3})
    }
}

fn call(id: u32, entries: &[Value], history: &Value, extra: bool) -> Value {
    let raw = json!({"policy": policy(extra), "query": {"id": id, "group_by": ["grade"], "stat": "mean"}, "entries": entries, "history": history}).to_string();
    serde_json::from_str(&handle(raw.as_bytes(), &env_with_sk)).unwrap()
}

/// Output without the random parts, plus the decrypted history and a check of the output_hash rule.
fn normalise(out: &Value) -> Value {
    let mut body = out.as_object().unwrap().clone();
    let claimed = body.remove("output_hash").unwrap();
    assert_eq!(claimed, json!(output_hash(&body)), "output_hash is the hash of the body");
    let env: Envelope = serde_json::from_value(body.remove("history").unwrap()).unwrap();
    let plain = crypto::open(INFO_HISTORY, &SK, &env).unwrap();
    body.insert("input_hash".into(), json!("<varies with random sealing>"));
    body.insert("history_plain".into(), serde_json::from_slice(&plain).unwrap());
    Value::Object(body)
}

fn scenario(extra: bool) -> Value {
    let r1 = call(1, &chapel(extra, false), &Value::Null, extra);
    let r2 = call(2, &chapel(extra, true), &r1["history"], extra);
    json!({"release_1": normalise(&r1), "release_2": normalise(&r2)})
}

#[test]
fn old_releases_replay_unchanged() {
    let now = scenario(false);
    if std::env::var("GOLDEN_WRITE").is_ok() {
        std::fs::write(GOLDEN, serde_json::to_string_pretty(&now).unwrap() + "\n").unwrap();
        return;
    }
    let golden: Value = serde_json::from_str(&std::fs::read_to_string(GOLDEN).unwrap()).unwrap();
    assert_eq!(now, golden, "output differs from the pre-DKIM build");
    for r in ["release_1", "release_2"] {
        let keys: Vec<&String> = golden[r].as_object().unwrap().keys().collect();
        assert!(!keys.iter().any(|k| *k == "rejections" || *k == "entries_verified"), "no DKIM fields on the legacy path");
        assert_eq!(golden[r]["engine"], "bandsheet-enclave/0.1.0");
    }
}

#[test]
fn require_dkim_false_ignores_issuers_and_emails() {
    let plain = scenario(false);
    let with_fields = scenario(true);
    assert_eq!(plain, with_fields, "explicit require_dkim=false with issuers and eml_b64 present changes nothing");
}
