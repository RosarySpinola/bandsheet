//! The module's single entry point: raw stdin bytes in, one JSON string out.
//!
//! Ops: `release` (default) and `pubkey`. Errors are `{"error","code"}`; they never include entry
//! content, keys or a stack trace.

use crate::crypto::{self, CryptoError, Envelope, INFO_ENTRY, INFO_HISTORY};
use crate::entry;
use crate::gate;
use crate::keys::{self, EnclaveKey};
use bandsheet_audit::{release, History, Query, ReleaseResult};
use base64::{engine::general_purpose::STANDARD, Engine};
use serde::Deserialize;
use serde_json::{json, Map, Value};
use sha2::{Digest, Sha256};

/// Reported on the legacy path, unchanged, so old releases replay byte for byte.
pub const ENGINE: &str = "bandsheet-enclave/0.1.0";
/// Reported when the policy requires DKIM.
pub const ENGINE_DKIM: &str = "bandsheet-enclave/0.2.0+dkim";
const MAX_ENTRIES: usize = 500;
const MAX_K: usize = 50;

#[derive(Deserialize)]
struct Policy {
    k: usize,
    /// Only read when `require_dkim` is true; ignored (and not validated) otherwise.
    #[serde(default)]
    trusted_issuers: Vec<gate::IssuerIn>,
    #[serde(default)]
    require_dkim: bool,
}

#[derive(Deserialize)]
struct Input {
    #[serde(default)]
    op: Option<String>,
    policy: Option<Policy>,
    query: Option<Query>,
    #[serde(default)]
    entries: Vec<Value>,
    #[serde(default)]
    history: Option<Value>,
}

fn sha256_hex(bytes: &[u8]) -> String {
    hex::encode(Sha256::digest(bytes))
}

fn error(code: &str, message: impl std::fmt::Display) -> Value {
    json!({"error": message.to_string(), "code": code})
}

/// An envelope is either the JSON object itself or a base64 string of that JSON.
fn envelope(v: &Value) -> Result<Envelope, CryptoError> {
    match v {
        Value::Object(_) => serde_json::from_value(v.clone()).map_err(|_| CryptoError::Format("envelope needs epk, nonce, ct")),
        Value::String(s) => {
            let bytes = STANDARD.decode(s.trim()).map_err(|_| CryptoError::Format("envelope string is not base64"))?;
            serde_json::from_slice(&bytes).map_err(|_| CryptoError::Format("envelope needs epk, nonce, ct"))
        }
        _ => Err(CryptoError::Format("envelope must be an object or a base64 string")),
    }
}

/// Canonical form: serde_json's default object is key-sorted and compact, ints only.
pub fn output_hash(body: &Map<String, Value>) -> String {
    sha256_hex(serde_json::to_string(&Value::Object(body.clone())).unwrap_or_default().as_bytes())
}

pub fn handle(raw: &[u8], env: &dyn Fn(&str) -> Option<String>) -> String {
    let out = match run(raw, env) {
        Ok(v) | Err(v) => v,
    };
    out.to_string()
}

fn run(raw: &[u8], env: &dyn Fn(&str) -> Option<String>) -> Result<Value, Value> {
    let input: Input = serde_json::from_slice(if raw.iter().all(u8::is_ascii_whitespace) { b"{}" } else { raw })
        .map_err(|e| error("E_INPUT", format!("input is not valid: {e}")))?;
    let key = keys::load(env).map_err(|e| error("E_KEY", e))?;
    match input.op.as_deref().unwrap_or("release") {
        "pubkey" => Ok(json!({
            "op": "pubkey",
            "pubkey_hex": hex::encode(key.public),
            "pubkey_b64": STANDARD.encode(key.public),
            "key_source": key.source,
            "engine": ENGINE,
        })),
        "release" => release_op(raw, input, &key),
        other => Err(error("E_INPUT", format!("unknown op {other:?}; one of release, pubkey"))),
    }
}

fn release_op(raw: &[u8], input: Input, key: &EnclaveKey) -> Result<Value, Value> {
    let policy = input.policy.ok_or_else(|| error("E_INPUT", "policy is required"))?;
    let k = policy.k;
    let query = input.query.ok_or_else(|| error("E_INPUT", "query is required"))?;
    if !(2..=MAX_K).contains(&k) {
        return Err(error("E_INPUT", format!("policy.k must be between 2 and {MAX_K}")));
    }
    if input.entries.len() > MAX_ENTRIES {
        return Err(error("E_INPUT", format!("at most {MAX_ENTRIES} entries")));
    }

    let history = match input.history.as_ref().filter(|v| !v.is_null()) {
        None => History::default(),
        Some(v) => envelope(v)
            .and_then(|e| crypto::open(INFO_HISTORY, &key.secret, &e))
            .ok()
            .and_then(|plain| serde_json::from_slice(&plain).ok())
            .ok_or_else(|| error("E_HISTORY", "history blob could not be opened or parsed"))?,
    };

    let mut rejected: std::collections::BTreeMap<&'static str, u32> = Default::default();
    let mut parsed: Vec<entry::Entry> = Vec::new();
    for v in &input.entries {
        let plain = envelope(v).and_then(|e| crypto::open(INFO_ENTRY, &key.secret, &e));
        match plain {
            Err(_) => *rejected.entry("entry_decrypt").or_default() += 1,
            Ok(bytes) => match entry::parse(&bytes) {
                Ok(e) => parsed.push(e),
                Err(code) => *rejected.entry(code).or_default() += 1,
            },
        }
    }
    let mut dkim = None;
    if policy.require_dkim {
        let issuers = gate::load_issuers(&policy.trusted_issuers).map_err(|m| error("E_INPUT", m))?;
        let outcome = gate::apply(parsed, &issuers);
        parsed = outcome.entries;
        dkim = Some((outcome.rejections, outcome.superseded));
    }
    let (members, superseded) = entry::latest_per_slot(parsed);
    let superseded = superseded + dkim.as_ref().map_or(0, |d| d.1);

    let result = release(k, &query, &members, &history).map_err(|e| match e {
        bandsheet_audit::AuditError::BadQuery(m) => error("E_QUERY", m),
        bandsheet_audit::AuditError::BadHistory(m) => error("E_HISTORY", m),
    })?;
    build_output(raw, query.id, result, key, members.len(), superseded, &rejected, dkim.map(|d| d.0))
}

fn build_output(
    raw: &[u8],
    release_id: u32,
    r: ReleaseResult,
    key: &EnclaveKey,
    used: usize,
    superseded: usize,
    rejected: &std::collections::BTreeMap<&'static str, u32>,
    dkim: Option<std::collections::BTreeMap<&'static str, u32>>,
) -> Result<Value, Value> {
    let history_json = serde_json::to_vec(&r.history).map_err(|e| error("E_INTERNAL", e))?;
    let sealed = crypto::seal(INFO_HISTORY, &key.public, &history_json).map_err(|e| error("E_INTERNAL", e))?;
    let mut body = Map::new();
    body.insert("release_id".into(), json!(release_id));
    body.insert("status".into(), serde_json::to_value(r.status).unwrap_or(Value::Null));
    body.insert("cells".into(), serde_json::to_value(&r.cells).unwrap_or(Value::Null));
    body.insert("suppressed".into(), serde_json::to_value(&r.suppressed).unwrap_or(Value::Null));
    body.insert("history".into(), serde_json::to_value(&sealed).unwrap_or(Value::Null));
    body.insert("input_hash".into(), json!(sha256_hex(raw)));
    body.insert("entries_used".into(), json!(used));
    body.insert("entries_superseded".into(), json!(superseded));
    body.insert("entries_rejected".into(), json!(rejected));
    match dkim {
        None => body.insert("engine".into(), json!(ENGINE)),
        Some(rej) => {
            let list: Vec<Value> = rej.iter().map(|(reason, count)| json!({"reason": reason, "count": count})).collect();
            body.insert("rejections".into(), Value::Array(list));
            body.insert("entries_verified".into(), json!(used));
            body.insert("engine".into(), json!(ENGINE_DKIM))
        }
    };
    let hash = output_hash(&body);
    body.insert("output_hash".into(), json!(hash));
    Ok(Value::Object(body))
}
