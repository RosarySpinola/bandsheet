//! Small checks shared by the unit methods. member_slot, ciphertext_text and stamp_query follow the bandsheet
//! contract's versions (contracts/bandsheet/src/members.rs, release.rs), so a units entry and a demo entry are the
//! same bytes and the engine sees the same query shape.
use near_sdk::serde_json::{self, Map, Value};
use near_sdk::{env, require, NearToken, PublicKey};

pub const MAX_CIPHERTEXT: usize = 16_384;

pub fn emit(event: &str, data: &str) {
    env::log_str(&format!("EVENT_JSON:{{\"standard\":\"bandsheet-units\",\"version\":\"1.0.0\",\"event\":\"{event}\",\"data\":{data}}}"));
}

/// hex(sha256(raw ed25519 key bytes)).
pub fn member_slot(pk: &PublicKey) -> String {
    let b = pk.as_bytes();
    require!(b.len() == 33 && b[0] == 0, "Member keys must be ed25519");
    hex::encode(env::sha256(&b[1..]))
}

/// {epk, nonce, ct} base64 strings (or a bare base64 string); stored as text, never read inside.
pub fn ciphertext_text(ct: Value) -> String {
    let b64 = |s: &str| !s.is_empty() && s.bytes().all(|b| b.is_ascii_alphanumeric() || matches!(b, b'+' | b'/' | b'=' | b'-' | b'_'));
    let text = match &ct {
        Value::Object(m) => {
            let ok = ["epk", "nonce", "ct"].iter().all(|k| m.get(*k).and_then(Value::as_str).is_some_and(b64));
            require!(ok && m.len() == 3, "Ciphertext must be an object with base64 epk, nonce and ct");
            ct.to_string()
        }
        Value::String(s) => {
            require!(b64(s), "Ciphertext must be base64");
            s.clone()
        }
        _ => env::panic_str("Ciphertext must be an object with base64 epk, nonce and ct"),
    };
    require!(text.len() <= MAX_CIPHERTEXT, "Ciphertext is too large (16 KB at most)");
    text
}

const FIELDS: [&str; 3] = ["grade", "gender", "site"];

/// Validate a release query and stamp it with the release number. Fields are the engine's: grade, gender, site.
pub fn stamp_query(query: &str, id: u32) -> String {
    require!(query.len() <= 512, "Query is too long (512 bytes at most)");
    let mut q: Map<String, Value> = match serde_json::from_str(query) {
        Ok(Value::Object(m)) => m,
        _ => env::panic_str("Query must be a JSON object"),
    };
    require!(q.keys().all(|k| matches!(k.as_str(), "group_by" | "filter" | "stat" | "id")), "Query keys are group_by, filter and stat");
    let ok = matches!(q.get("group_by"), Some(Value::Array(a)) if !a.is_empty() && a.len() <= 3
        && a.iter().all(|f| f.as_str().is_some_and(|s| FIELDS.contains(&s))));
    require!(ok, "Query needs a non-empty group_by list of grade, gender or site");
    if let Some(f) = q.get("filter") {
        let ok = matches!(f, Value::Object(m) if m.iter().all(|(k, v)| FIELDS.contains(&k.as_str()) && v.as_str().is_some_and(|s| s.len() <= 32)));
        require!(ok, "Query filter must map grade, gender or site to a value");
    }
    q.entry("stat").or_insert(Value::String("mean".to_string()));
    require!(q.get("stat").and_then(Value::as_str) == Some("mean"), "Only the mean is supported");
    q.insert("id".to_string(), Value::from(id));
    Value::Object(q).to_string()
}

/// A DNS name: lower-case labels of [a-z0-9-], at least one dot, at most 253 bytes.
pub fn domain(d: &str) -> String {
    let d = d.trim().to_ascii_lowercase();
    let labels_ok = d.split('.').all(|l| !l.is_empty() && l.len() <= 63 && !l.starts_with('-') && !l.ends_with('-') && l.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'-'));
    require!(d.len() <= 253 && d.contains('.') && labels_ok, format!("\"{d}\" is not a domain name"));
    d
}

/// Unit names: 1 to 80 bytes, no control characters.
pub fn unit_name(name: &str) -> String {
    let n = name.trim();
    require!(!n.is_empty() && n.len() <= 80 && !n.chars().any(char::is_control), "The unit name must be 1 to 80 characters");
    n.to_string()
}

pub fn hex64(s: &str, what: &str) {
    require!(s.len() == 64 && s.bytes().all(|b| matches!(b, b'0'..=b'9' | b'a'..=b'f')), format!("{what} must be 64 lower-case hex characters"));
}

/// An RSA public key as base64 SPKI: either the bare base64 (a DKIM `p=` value) or a PEM block.
pub fn spki_b64(key: &str) -> String {
    let body: String = key.lines().filter(|l| !l.starts_with("-----")).collect::<String>().split_whitespace().collect();
    let b64 = body.bytes().all(|b| b.is_ascii_alphanumeric() || matches!(b, b'+' | b'/' | b'='));
    // a 1024-bit SPKI is 216 base64 chars, 4096-bit about 736
    require!(b64 && (200..=2048).contains(&body.len()), "The issuer key must be an RSA public key (base64 SPKI or PEM)");
    body
}

/// Balance not locked for storage.
pub fn spare_yocto() -> u128 {
    env::account_balance().as_yoctonear().saturating_sub(env::storage_usage() as u128 * env::storage_byte_cost().as_yoctonear())
}

/// What the contract keeps free for engine deposits: writes that grow state are refused below it.
pub const FLOOR: NearToken = NearToken::from_millinear(500);

pub fn require_floor() {
    require!(spare_yocto() >= FLOOR.as_yoctonear(), "The units contract is low on storage balance; try again later");
}
