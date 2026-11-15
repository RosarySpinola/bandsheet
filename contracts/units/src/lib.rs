//! Bandsheet units: anyone with a NEAR wallet starts their own unit on this one contract.
//!
//! A unit has a council (in-contract votes, more than half passes), members who hold posting keys on THIS account
//! (function-call keys limited to `submit`, so no wallet sits beside a slot on chain), optional employer DKIM
//! domains, and a release log. Releases run the same sealed OutLayer engine as the demo chapel
//! (bandsheet-enclave.testnet/bandsheet-enclave), each over its own unit's entries and history only.
//! The registrar (`owner`) is the only account that adds members and issuer keys; the server holds a
//! function-call key on it limited to those methods.
use near_sdk::json_types::U128;
use near_sdk::store::{LookupMap, Vector};
use near_sdk::{env, near, require, AccountId, PanicOnDefault};

#[allow(dead_code)]
#[path = "../../bandsheet/src/outlayer.rs"]
mod outlayer;
mod members;
mod run;
mod types;
mod units;
mod util;
mod views;
#[cfg(test)]
mod tests;
#[cfg(test)]
mod tests_members;
#[cfg(test)]
mod tests_vote;

pub use types::*;

pub const MAX_UNITS: u32 = 400;
pub const UNITS_PER_ACCOUNT: u32 = 3;
pub const RELEASES_PER_DAY: u32 = 5;
pub const COUNCIL_SEATS: usize = 5;
pub const MEMBERS_PER_UNIT: usize = 40;
pub const SYNTHETIC_PER_UNIT: u32 = 8;
pub const DKIM_DOMAINS: usize = 4;
pub const ISSUERS: usize = 8;
pub const OPEN_PROPOSALS: u32 = 5;
pub const PROPOSALS_PER_DAY: u32 = 10;
/// Engine runs per rolling 24 h across all units: the contract pays every run, so a ceiling bounds the bill.
pub const RUNS_PER_DAY_TOTAL: u32 = 60;
/// Members ever added to one unit (remove-and-rejoin included).
pub const JOINS_PER_UNIT: u32 = 120;

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct Units {
    /// The registrar account: the only caller of unit_add_member / unit_remove_member / unit_add_issuer.
    owner: AccountId,
    policy: Policy,
    outlayer: OutlayerCfg,
    units: Vector<Unit>,
    /// slot -> (unit, synthetic). A slot (posting key) belongs to exactly one unit.
    slots: LookupMap<String, SlotInfo>,
    /// slot -> ciphertext text
    entries: LookupMap<String, String>,
    /// unit -> sealed engine history (opaque)
    history: LookupMap<u32, String>,
    proposals: LookupMap<(u32, u64), Proposal>,
    releases: LookupMap<(u32, u32), UnitRelease>,
    /// account -> units where it holds a council seat
    seats: LookupMap<AccountId, Vec<u32>>,
    /// account -> units it created (cap)
    created: LookupMap<AccountId, u32>,
    members_total: u64,
    entries_total: u64,
    releases_total: u64,
    /// Start times of engine runs in the last 24 h, all units together.
    runs_window: Vec<u64>,
}

#[near]
impl Units {
    /// One policy for every unit: the engine hash, enclave key and k are the demo chapel's. Private: only the
    /// contract account itself can initialise it (deploy and init go in one transaction).
    #[init]
    #[private]
    pub fn new(owner: AccountId, k: u32, enclave_pubkey: String, wasm_sha256: String, policy_hash: String, outlayer: OutlayerCfg) -> Self {
        require!((2..=50).contains(&k), "k must be between 2 and 50");
        util::hex64(&wasm_sha256, "wasm_sha256");
        Self::check_outlayer(&outlayer);
        Self {
            owner,
            policy: Policy { k, enclave_pubkey, wasm_sha256, policy_hash },
            outlayer,
            units: Vector::new(b"u"),
            slots: LookupMap::new(b"s"),
            entries: LookupMap::new(b"e"),
            history: LookupMap::new(b"h"),
            proposals: LookupMap::new(b"p"),
            releases: LookupMap::new(b"r"),
            seats: LookupMap::new(b"c"),
            created: LookupMap::new(b"n"),
            members_total: 0,
            entries_total: 0,
            releases_total: 0,
            runs_window: Vec::new(),
        }
    }

    /// Registrar: re-point OutLayer. Only before the first release in any unit, so no published release can be
    /// reinterpreted under a different engine source. The deposit alone can always be tuned (set_run_deposit).
    pub fn set_outlayer(&mut self, outlayer: OutlayerCfg) {
        self.require_registrar();
        require!(self.releases_total == 0, "OutLayer is frozen once a release exists");
        Self::check_outlayer(&outlayer);
        self.outlayer = outlayer;
    }

    pub fn set_run_deposit(&mut self, run_deposit: U128) {
        self.require_registrar();
        require!(run_deposit.0 <= 1_000_000_000_000_000_000_000_000, "At most 1 NEAR per run");
        self.outlayer.run_deposit = run_deposit;
    }
}

impl Units {
    fn check_outlayer(o: &OutlayerCfg) {
        for (name, text) in [("source", &o.source), ("secrets_ref", &o.secrets_ref)] {
            require!(
                text.is_empty() || near_sdk::serde_json::from_str::<near_sdk::serde_json::Value>(text).is_ok(),
                format!("{name} must be empty or valid JSON")
            );
        }
        require!(!o.source.is_empty(), "OutLayer source is required");
    }

    pub(crate) fn require_registrar(&self) {
        require!(env::predecessor_account_id() == self.owner, "Refused: only the units registrar can do this");
    }

    pub(crate) fn unit(&self, unit_id: u32) -> Unit {
        unit_id
            .checked_sub(1)
            .and_then(|i| self.units.get(i))
            .cloned()
            .unwrap_or_else(|| env::panic_str(&format!("No unit {unit_id}")))
    }

    pub(crate) fn save(&mut self, u: Unit) {
        let i = u.id - 1;
        self.units.set(i, u);
    }

    /// The caller must hold a council seat in this unit.
    pub(crate) fn council_unit(&self, unit_id: u32) -> (Unit, AccountId) {
        let u = self.unit(unit_id);
        let caller = env::predecessor_account_id();
        require!(u.council.contains(&caller), format!("Refused: {caller} is not on unit {unit_id}'s council"));
        (u, caller)
    }
}
