//! Bandsheet: the contract account IS the union unit.
//!
//! Members hold function-call access keys on this very account, restricted to `submit`, so they submit
//! gas-free and no outside account can write an entry. Release requests come only from the union's
//! Sputnik DAO. A sealed OutLayer enclave audits every request against all earlier releases; every
//! release and every refusal is appended to an immutable log.
use near_sdk::json_types::{U128, U64};
use near_sdk::store::{IterableMap, IterableSet, Vector};
use near_sdk::{env, near, require, AccountId, NearToken, PanicOnDefault};

mod events;
mod members;
mod outlayer;
mod release;
#[cfg(test)]
mod tests;
mod types;

pub use types::*;

pub const MAX_CIPHERTEXT: usize = 4096;

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct Bandsheet {
    owner: AccountId,
    dao: AccountId,
    demo_owner_override: bool,
    policy: Policy,
    outlayer: OutlayerCfg,
    /// slot ids (hex sha256 of the member key) of registered members
    members: IterableSet<String>,
    /// slot id -> ciphertext
    entries: IterableMap<String, String>,
    releases: Vector<ReleaseRecord>,
    history: Option<String>,
    in_flight: Option<InFlight>,
}

#[near]
impl Bandsheet {
    /// `owner` is the committee account that registers members; `dao` is the only caller of `request_release`.
    #[init]
    pub fn new(owner: AccountId, dao: AccountId, k: u32, enclave_pubkey: String, wasm_sha256: String, policy_hash: String) -> Self {
        require!(k >= 2, "k must be at least 2");
        Self {
            owner,
            dao,
            demo_owner_override: false,
            policy: Policy { k, enclave_pubkey, wasm_sha256, policy_hash },
            outlayer: OutlayerCfg {
                account: "outlayer.testnet".parse().unwrap(),
                source: String::new(),
                secrets_ref: String::new(),
                run_deposit: U128(NearToken::from_millinear(20).as_yoctonear()),
            },
            members: IterableSet::new(b"m"),
            entries: IterableMap::new(b"e"),
            releases: Vector::new(b"r"),
            history: None,
            in_flight: None,
        }
    }

    pub fn get_policy(&self) -> PolicyView {
        PolicyView {
            unit: env::current_account_id(),
            owner: self.owner.clone(),
            dao: self.dao.clone(),
            demo_owner_override: self.demo_owner_override,
            policy: self.policy.clone(),
            outlayer: self.outlayer.clone(),
            members: self.members.len() as u64,
            entries: self.entries.len() as u64,
            releases: self.releases.len() as u64,
            in_flight: self.in_flight.clone(),
        }
    }

    pub fn entry_count(&self) -> u64 {
        self.entries.len() as u64
    }

    pub fn member_count(&self) -> u64 {
        self.members.len() as u64
    }

    /// Ciphertexts only, in insertion order. Nothing here says whose they are.
    pub fn get_entries(&self, from: Option<u64>, limit: Option<u64>) -> Vec<String> {
        let (from, limit) = (from.unwrap_or(0) as usize, limit.unwrap_or(50).min(100) as usize);
        self.entries.values().skip(from).take(limit).cloned().collect()
    }

    /// True when this key's slot has a stored entry (for a member's own "was it received" check).
    pub fn has_entry(&self, slot: String) -> bool {
        self.entries.contains_key(&slot)
    }

    pub fn is_member(&self, slot: String) -> bool {
        self.members.contains(&slot)
    }

    pub fn get_history(&self) -> Option<String> {
        self.history.clone()
    }

    // ---- owner (committee) administration ----

    pub fn set_dao(&mut self, dao: AccountId) {
        self.require_owner();
        self.dao = dao;
    }

    /// Local-development switch: lets the owner call `request_release` without a vote. Leave it off for the demo.
    pub fn set_demo_owner_override(&mut self, on: bool) {
        self.require_owner();
        self.demo_owner_override = on;
    }

    /// Re-point the policy at a new enclave build or key. Only before the first release, so a published
    /// release can never be reinterpreted under a different policy. Members then resubmit.
    pub fn set_policy(&mut self, k: u32, enclave_pubkey: String, wasm_sha256: String, policy_hash: String) {
        self.require_owner();
        require!(self.releases.is_empty(), "The policy is frozen once a release exists");
        require!(k >= 2, "k must be at least 2");
        self.policy = Policy { k, enclave_pubkey, wasm_sha256, policy_hash };
    }

    pub fn set_outlayer(&mut self, account: AccountId, source: String, secrets_ref: String, run_deposit: U128) {
        self.require_owner();
        for (name, text) in [("source", &source), ("secrets_ref", &secrets_ref)] {
            require!(
                text.is_empty() || near_sdk::serde_json::from_str::<near_sdk::serde_json::Value>(text).is_ok(),
                format!("{name} must be empty or valid JSON")
            );
        }
        self.outlayer = OutlayerCfg { account, source, secrets_ref, run_deposit };
    }

    /// Unfreeze a stuck request (OutLayer never answered). Owner or DAO, and only after 10 minutes.
    pub fn clear_stale_request(&mut self) {
        let caller = env::predecessor_account_id();
        require!(caller == self.owner || caller == self.dao, "Only the owner or the DAO");
        let f = self.in_flight.clone().unwrap_or_else(|| env::panic_str("No request in flight"));
        require!(env::block_timestamp() > f.requested_at.0 + 600_000_000_000, "The request is not stale yet");
        self.in_flight = None;
    }

    pub(crate) fn require_owner(&self) {
        require!(env::predecessor_account_id() == self.owner, "Only the owner (committee) account can do this");
    }

    pub(crate) fn now() -> U64 {
        U64(env::block_timestamp())
    }
}
