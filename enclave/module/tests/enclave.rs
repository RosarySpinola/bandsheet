use bandsheet_enclave::crypto::{self, Envelope, INFO_ENTRY, INFO_HISTORY};
use bandsheet_enclave::run::{handle, output_hash};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};

const SK: [u8; 32] = [7u8; 32];

fn env_with_sk(name: &str) -> Option<String> {
    (name == "ENCLAVE_X25519_SK").then(|| hex::encode(SK))
}

fn slot(name: &str) -> String {
    hex::encode(Sha256::digest(name.as_bytes()))
}

fn sealed_entry(name: &str, pay: u64, grade: &str, t: u64) -> Value {
    let plain = json!({"slot": slot(name), "gross_annual_eur": pay, "grade": grade,
        "gender": if name.len() % 2 == 0 { "F" } else { "M" }, "site": "City", "submitted_at": t});
    let e = crypto::seal(INFO_ENTRY, &crypto::public_key(&SK), plain.to_string().as_bytes()).unwrap();
    serde_json::to_value(e).unwrap()
}

/// 36 members: Junior 8, Reporter 11, Senior 12, Editor 4, Chief 1.
fn chapel() -> Vec<Value> {
    let spec = [("Junior", 8, 30_000u64), ("Reporter", 11, 42_000), ("Senior", 12, 67_998), ("Editor", 4, 75_000), ("Chief", 1, 112_000)];
    let mut out = Vec::new();
    for (grade, n, base) in spec {
        for i in 0..n {
            out.push(sealed_entry(&format!("{grade}-{i}"), base + 10 * i as u64, grade, 1_763_000_000));
        }
    }
    assert_eq!(out.len(), 36);
    out
}

fn input(id: u32, entries: &[Value], history: &Value) -> String {
    json!({"policy": {"k": 3}, "query": {"id": id, "group_by": ["grade"], "stat": "mean"}, "entries": entries, "history": history}).to_string()
}

fn call(raw: &str) -> Value {
    serde_json::from_str(&handle(raw.as_bytes(), &env_with_sk)).unwrap()
}

#[test]
fn cross_language_vector_typescript_made_opens_in_rust_and_rust_reproduces_it() {
    let v: Value = serde_json::from_str(include_str!("../../test-vectors/entry-v1.json")).unwrap();
    let h = |k: &str| -> Vec<u8> { hex::decode(v[k].as_str().unwrap()).unwrap() };
    let sk: [u8; 32] = h("enclave_sk_hex").try_into().unwrap();
    let pk: [u8; 32] = h("enclave_pk_hex").try_into().unwrap();
    assert_eq!(crypto::public_key(&sk), pk);
    let env: Envelope = serde_json::from_value(v["envelope"].clone()).unwrap();
    // TypeScript -> Rust
    let plain = crypto::open(INFO_ENTRY, &sk, &env).unwrap();
    assert_eq!(String::from_utf8(plain).unwrap(), v["plaintext"].as_str().unwrap());
    // Rust reproduces the exact bytes TypeScript produced.
    let again = crypto::seal_with(INFO_ENTRY, &pk, v["plaintext"].as_str().unwrap().as_bytes(), &h("esk_hex").try_into().unwrap(), &h("nonce_hex").try_into().unwrap()).unwrap();
    assert_eq!(again, env);
    // Rust -> TypeScript: a Rust-sealed entry for `crosscheck.mjs verify`.
    let esk = [0x55u8; 32];
    let nonce = [0x66u8; 12];
    let text = v["plaintext"].as_str().unwrap();
    let sealed = crypto::seal_with(INFO_ENTRY, &pk, text.as_bytes(), &esk, &nonce).unwrap();
    let out = json!({"note": "Made by Rust (bandsheet-enclave) with fixed keys. Test keys only.", "enclave_sk_hex": hex::encode(sk),
        "plaintext": text, "envelope": sealed});
    let path = concat!(env!("CARGO_MANIFEST_DIR"), "/../test-vectors/rust-sealed.json");
    std::fs::write(path, serde_json::to_string_pretty(&out).unwrap() + "\n").unwrap();
}

#[test]
fn purposes_are_separated_and_tampering_is_caught() {
    let pk = crypto::public_key(&SK);
    let e = crypto::seal(INFO_HISTORY, &pk, b"secret").unwrap();
    assert!(crypto::open(INFO_ENTRY, &SK, &e).is_err(), "a history blob is not an entry");
    assert_eq!(crypto::open(INFO_HISTORY, &SK, &e).unwrap(), b"secret");
    let mut t = e.clone();
    let mut ct = base64_decode(&t.ct);
    ct[0] ^= 1;
    t.ct = base64_encode(&ct);
    assert!(crypto::open(INFO_HISTORY, &SK, &t).is_err());
    assert!(crypto::open(INFO_HISTORY, &[9u8; 32], &e).is_err(), "wrong key");
    let a = crypto::seal(INFO_ENTRY, &pk, b"x").unwrap();
    let b = crypto::seal(INFO_ENTRY, &pk, b"x").unwrap();
    assert_ne!(a, b, "fresh ephemeral key and nonce every time");
}

fn base64_decode(s: &str) -> Vec<u8> {
    use base64::Engine;
    base64::engine::general_purpose::STANDARD.decode(s).unwrap()
}
fn base64_encode(b: &[u8]) -> String {
    use base64::Engine;
    base64::engine::general_purpose::STANDARD.encode(b)
}

#[test]
fn hero_flow_through_the_module() {
    let entries = chapel();
    let raw1 = input(1, &entries, &Value::Null);
    let r1 = call(&raw1);
    assert_eq!(r1["status"], "partially_released");
    assert_eq!(r1["entries_used"], 36);
    assert_eq!(r1["input_hash"], hex::encode(Sha256::digest(raw1.as_bytes())));
    let senior = r1["cells"].as_array().unwrap().iter().find(|c| c["key"]["grade"] == "Senior").unwrap();
    assert_eq!((senior["n"].as_u64(), senior["mean_eur"].as_u64()), (Some(12), Some(68_053)));
    assert_eq!(r1["suppressed"][0]["reason"], "small_cell");
    // output_hash is the sha256 of the key-sorted compact JSON without the hash field.
    let mut body = r1.as_object().unwrap().clone();
    let claimed = body.remove("output_hash").unwrap();
    assert_eq!(claimed, json!(output_hash(&body)));
    // The history is opaque to everyone but the enclave and carries no pay.
    let hist = &r1["history"];
    assert!(hist["epk"].is_string() && hist["nonce"].is_string() && hist["ct"].is_string());

    // A Senior joins at EUR 70,000; the second release must hold the Senior cell back.
    let mut entries2 = entries.clone();
    entries2.push(sealed_entry("Senior-new", 70_000, "Senior", 1_763_100_000));
    let r2 = call(&input(2, &entries2, hist));
    assert_eq!(r2["status"], "partially_released");
    assert!(r2["cells"].as_array().unwrap().iter().all(|c| c["key"]["grade"] != "Senior"));
    let s = r2["suppressed"].as_array().unwrap().iter().find(|s| s["key"]["grade"] == "Senior").unwrap();
    assert_eq!(s["reason"], "differencing");
    assert_eq!(s["witness"], "Release #2 Senior - Release #1 Senior isolates 1 member");
    assert!(!r2.to_string().contains("70000"));

    // Same entries, no history: nothing remembers, so the cell would pass (why history matters).
    let r2_blind = call(&input(2, &entries2, &Value::Null));
    assert!(r2_blind["cells"].as_array().unwrap().iter().any(|c| c["key"]["grade"] == "Senior"));
}

#[test]
fn resubmission_replaces_and_bad_entries_are_counted_not_fatal() {
    let mut entries = chapel();
    entries.push(sealed_entry("Junior-0", 31_000, "Junior", 1_763_200_000)); // resubmits slot Junior-0
    let wrong_key = crypto::seal(INFO_ENTRY, &crypto::public_key(&[1u8; 32]), b"{}").unwrap();
    entries.push(serde_json::to_value(wrong_key).unwrap());
    entries.push(json!("not base64 !!"));
    let plain = json!({"slot": "xyz", "gross_annual_eur": 1, "grade": "Junior", "gender": "F", "site": "City", "submitted_at": 1});
    entries.push(serde_json::to_value(crypto::seal(INFO_ENTRY, &crypto::public_key(&SK), plain.to_string().as_bytes()).unwrap()).unwrap());
    let r = call(&input(1, &entries, &Value::Null));
    assert_eq!(r["entries_used"], 36, "count unchanged by a resubmission");
    assert_eq!(r["entries_superseded"], 1);
    assert_eq!(r["entries_rejected"]["entry_decrypt"], 2);
    assert_eq!(r["entries_rejected"]["entry_slot"], 1);
}

#[test]
fn envelope_may_be_a_base64_string() {
    let entries: Vec<Value> = chapel().iter().map(|e| json!(base64_encode(e.to_string().as_bytes()))).collect();
    let r = call(&input(1, &entries, &Value::Null));
    assert_eq!(r["entries_used"], 36);
}

#[test]
fn errors_are_structured_and_leak_nothing() {
    let entries = chapel();
    let bad_hist = serde_json::to_value(crypto::seal(INFO_HISTORY, &crypto::public_key(&[2u8; 32]), b"{}").unwrap()).unwrap();
    assert_eq!(call(&input(1, &entries, &bad_hist))["code"], "E_HISTORY");
    assert_eq!(call("{not json")["code"], "E_INPUT");
    assert_eq!(call(&json!({"policy": {"k": 1}, "query": {"id": 1, "group_by": []}, "entries": []}).to_string())["code"], "E_INPUT");
    assert_eq!(call(&json!({"policy": {"k": 3}, "query": {"id": 1, "group_by": ["colour"]}, "entries": []}).to_string())["code"], "E_INPUT");
    assert_eq!(call(&json!({"op": "dance"}).to_string())["code"], "E_INPUT");
    let none: &dyn Fn(&str) -> Option<String> = &|_| None;
    let out: Value = serde_json::from_str(&handle(input(1, &entries, &Value::Null).as_bytes(), none)).unwrap();
    assert_eq!(out["code"], "E_KEY");
    let seed = |n: &str| (n == "PROTECTED_ENCLAVE_SEED").then(|| "ab".repeat(32));
    let p: Value = serde_json::from_str(&handle(br#"{"op":"pubkey"}"#, &seed)).unwrap();
    assert_eq!(p["key_source"], "PROTECTED_ENCLAVE_SEED");
    assert_eq!(p["pubkey_hex"].as_str().unwrap().len(), 64);
    assert!(!p.to_string().contains(&"ab".repeat(32)));
}
