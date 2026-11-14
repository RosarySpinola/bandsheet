//! The whole OutLayer surface in one place: building the enclave input, the request_execution call,
//! and reading the result. If the enclave interface changes, only this file changes.
use near_sdk::serde_json::{self, Value};
use near_sdk::{env, Gas, NearToken, Promise, PromiseError};

use crate::types::OutlayerCfg;

pub const MAX_OUT: usize = 262_144;
pub const CALLBACK_GAS: Gas = Gas::from_tgas(50);
const RESERVE_GAS: Gas = Gas::from_tgas(30);
const MAX_INSTRUCTIONS: u64 = 2_000_000_000;
const MAX_MEMORY_MB: u32 = 128;
const MAX_SECONDS: u32 = 60;

/// A stored ciphertext is either the JSON object text {"epk","nonce","ct"} (embedded as an object)
/// or an opaque base64 string (embedded as a string). `submit` has already checked which it is.
fn embed(ct: &str) -> String {
    if ct.starts_with('{') {
        ct.to_string()
    } else {
        serde_json::to_string(ct).unwrap_or_else(|_| "\"\"".to_string())
    }
}

/// Enclave input: {"policy":{"k":3,"trusted_issuers":[..],"require_dkim":bool},"query":Query,"entries":[Ciphertext...],"history":HistoryBlob|null}
pub fn build_input(policy: &str, query: &str, entries: &[&String], history: Option<&String>) -> String {
    let list: Vec<String> = entries.iter().map(|c| embed(c)).collect();
    format!(
        "{{\"policy\":{policy},\"query\":{query},\"entries\":[{}],\"history\":{}}}",
        list.join(","),
        history.map(String::as_str).unwrap_or("null")
    )
}

/// OutLayer holds about 1e19 yocto per byte of input_data beyond 32 KB (the unused part is refunded). With a 10% margin.
const FREE_INPUT_BYTES: usize = 32_768;
const YOCTO_PER_EXTRA_BYTE: u128 = 11_000_000_000_000_000_000;

/// The deposit for this input: the configured base, plus the size charge for a large input.
pub fn deposit_for(cfg: &OutlayerCfg, input_len: usize) -> u128 {
    cfg.run_deposit.0 + input_len.saturating_sub(FREE_INPUT_BYTES) as u128 * YOCTO_PER_EXTRA_BYTE
}

/// request_execution on OutLayer; the caller chains the callback. The union pays from its own balance
/// (payer null: OutLayer refunds the unused deposit to the caller, which is the union).
pub fn request(cfg: &OutlayerCfg, input: &str, deposit: u128, gas: Gas) -> Promise {
    let secrets = if cfg.secrets_ref.is_empty() { "null" } else { cfg.secrets_ref.as_str() };
    let args = format!(
        "{{\"source\":{},\"resource_limits\":{{\"max_instructions\":{MAX_INSTRUCTIONS},\"max_memory_mb\":{MAX_MEMORY_MB},\"max_execution_seconds\":{MAX_SECONDS}}},\
         \"input_data\":{},\"secrets_ref\":{secrets},\"response_format\":\"Json\",\"payer_account_id\":null,\"params\":null}}",
        cfg.source,
        serde_json::to_string(input).unwrap_or_default(),
    );
    Promise::new(cfg.account.clone()).function_call(
        "request_execution".to_string(),
        args.into_bytes(),
        NearToken::from_yoctonear(deposit),
        gas,
    )
}

/// Gas for the OutLayer call: everything left minus the callback and a reserve.
pub fn request_gas() -> Gas {
    env::prepaid_gas().saturating_sub(env::used_gas()).saturating_sub(CALLBACK_GAS).saturating_sub(RESERVE_GAS)
}

pub enum Out {
    /// Output bytes and the parsed JSON.
    Output(Vec<u8>, Value),
    /// OutLayer's marker for a failed or timed-out run, or output we cannot read.
    Unreadable(Vec<u8>, &'static str),
    /// The request_execution promise itself failed.
    Failed,
}

pub fn read_result() -> Out {
    match env::promise_result_checked(0, MAX_OUT) {
        Ok(bytes) => match serde_json::from_slice::<Value>(&bytes) {
            Ok(Value::Null) => Out::Unreadable(bytes, "OutLayer returned no result (failed or timed out)"),
            Ok(v) if v.is_object() => Out::Output(bytes, v),
            _ => Out::Unreadable(bytes, "OutLayer output was not a JSON object"),
        },
        Err(PromiseError::Failed) => Out::Failed,
        Err(_) => Out::Unreadable(Vec::new(), "OutLayer output too large"),
    }
}
