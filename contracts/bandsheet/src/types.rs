//! Stored and returned types.
use near_sdk::json_types::{U128, U64};
use near_sdk::serde_json::{self, Value};
use near_sdk::{near, AccountId};

/// Public policy of the unit: what the enclave is, and the smallest group it will show.
#[near(serializers=[borsh, json])]
#[derive(Clone)]
pub struct Policy {
    pub k: u32,
    /// Enclave X25519 public key (hex or base64, as the enclave publishes it). Entries are sealed to it.
    pub enclave_pubkey: String,
    /// sha256 of the OutLayer wasm the policy was written for.
    pub wasm_sha256: String,
    /// Hash of the human-readable policy text the committee published.
    pub policy_hash: String,
}

/// How the contract reaches OutLayer. Kept apart so it can be adjusted without touching the release logic.
#[near(serializers=[borsh, json])]
#[derive(Clone)]
pub struct OutlayerCfg {
    pub account: AccountId,
    /// JSON text of the `source` argument, e.g. {"Project":{"project_id":"o/p","version_key":null}}.
    pub source: String,
    /// JSON text of `secrets_ref` or empty for none.
    pub secrets_ref: String,
    /// Paid from the union account's balance on every release; OutLayer refunds the unused part to the union.
    pub run_deposit: U128,
}

/// One immutable line in the union's release log. Nothing in the contract rewrites a record.
#[near(serializers=[borsh, json])]
#[derive(Clone)]
pub struct ReleaseRecord {
    pub id: u32,
    pub query: String,
    pub requested_by: AccountId,
    /// released | partially_released | refused | error
    pub status: String,
    pub cells: String,
    pub suppressed: String,
    /// Hashes the enclave reported.
    pub input_hash: String,
    pub output_hash: String,
    /// Hashes the contract computed itself: over the exact input it sent, over the exact bytes it received.
    pub input_sha256: String,
    pub output_sha256: String,
    /// JSON of the attestation / signature fields the enclave output carried, "{}" if none.
    pub proof: String,
    pub note: String,
    pub block_timestamp: U64,
}

#[near(serializers=[json])]
pub struct ReleaseView {
    pub id: u32,
    pub query: Value,
    pub requested_by: AccountId,
    pub status: String,
    pub cells: Value,
    pub suppressed: Value,
    pub input_hash: String,
    pub output_hash: String,
    pub input_sha256: String,
    pub output_sha256: String,
    pub proof: Value,
    pub note: String,
    pub block_timestamp: U64,
}

impl ReleaseRecord {
    pub fn view(&self) -> ReleaseView {
        let j = |s: &str| serde_json::from_str(s).unwrap_or(Value::Null);
        ReleaseView {
            id: self.id,
            query: j(&self.query),
            requested_by: self.requested_by.clone(),
            status: self.status.clone(),
            cells: j(&self.cells),
            suppressed: j(&self.suppressed),
            input_hash: self.input_hash.clone(),
            output_hash: self.output_hash.clone(),
            input_sha256: self.input_sha256.clone(),
            output_sha256: self.output_sha256.clone(),
            proof: j(&self.proof),
            note: self.note.clone(),
            block_timestamp: self.block_timestamp,
        }
    }
}

#[near(serializers=[borsh, json])]
#[derive(Clone)]
pub struct InFlight {
    pub id: u32,
    pub requested_by: AccountId,
    pub requested_at: U64,
}

#[near(serializers=[json])]
pub struct PolicyView {
    pub unit: AccountId,
    pub owner: AccountId,
    pub dao: AccountId,
    pub demo_owner_override: bool,
    pub policy: Policy,
    pub outlayer: OutlayerCfg,
    pub members: u64,
    pub entries: u64,
    pub releases: u64,
    pub in_flight: Option<InFlight>,
}
