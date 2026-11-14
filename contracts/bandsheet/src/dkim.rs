//! DKIM governance: which employer keys the chapel trusts, and whether entries must carry a verified payslip.
//! Everything here is changed only by the DAO. State lives under its own storage keys (not in the contract
//! struct), so the upgrade that added it did not change the layout of the deployed state: no migration needed.
use near_sdk::serde_json::{self, Value};
use near_sdk::store::LookupMap;
use near_sdk::{env, near, require};

use crate::events::emit;
use crate::types::{Issuer, ReleaseExtra};
use crate::{Bandsheet, BandsheetExt};

const K_ISSUERS: &[u8] = b"dk_issuers";
const K_REQUIRE: &[u8] = b"dk_require";
pub const P_EXTRA: &[u8] = b"dk_x";

pub fn issuers() -> Vec<Issuer> {
    env::storage_read(K_ISSUERS).and_then(|b| near_sdk::borsh::from_slice(&b).ok()).unwrap_or_default()
}

fn save_issuers(list: &[Issuer]) {
    env::storage_write(K_ISSUERS, &near_sdk::borsh::to_vec(list).unwrap_or_default());
}

pub fn require_dkim() -> bool {
    env::storage_read(K_REQUIRE).is_some_and(|b| b.first() == Some(&1))
}

/// The `policy` object of the enclave input: {"k":3,"trusted_issuers":[...],"require_dkim":false}
pub fn policy_json(k: u32) -> String {
    let list = serde_json::to_string(&issuers()).unwrap_or_else(|_| "[]".to_string());
    format!("{{\"k\":{k},\"trusted_issuers\":{list},\"require_dkim\":{}}}", require_dkim())
}

pub fn extras() -> LookupMap<u32, ReleaseExtra> {
    LookupMap::new(P_EXTRA)
}

pub fn rejections_json(v: &Value) -> String {
    match v.get("rejections") {
        Some(x) if x.is_array() => x.to_string(),
        _ => "[]".to_string(),
    }
}

fn clean(text: &str, max: usize, what: &str) {
    require!(!text.is_empty() && text.len() <= max && text.bytes().all(|b| b.is_ascii_graphic()), format!("{what} must be 1 to {max} printable characters"));
}

#[near]
impl Bandsheet {
    /// Trust an employer's DKIM key (DAO vote). Adding the same domain and selector again replaces the key (rotation).
    pub fn add_issuer(&mut self, domain: String, selector: String, rsa_pubkey_spki_b64: String) {
        self.require_governance();
        clean(&domain, 253, "domain");
        clean(&selector, 63, "selector");
        clean(&rsa_pubkey_spki_b64, 2048, "rsa_pubkey_spki_b64");
        let domain = domain.to_ascii_lowercase();
        let mut list = issuers();
        let rotated = list.iter().any(|i| i.domain == domain && i.selector == selector);
        list.retain(|i| !(i.domain == domain && i.selector == selector));
        require!(list.len() < 8, "At most 8 trusted issuers");
        list.push(Issuer { domain: domain.clone(), selector: selector.clone(), rsa_pubkey_spki_b64 });
        save_issuers(&list);
        emit("issuer_added", &format!("{{\"domain\":\"{domain}\",\"selector\":\"{selector}\",\"rotated\":{rotated}}}"));
    }

    pub fn remove_issuer(&mut self, domain: String, selector: String) {
        self.require_governance();
        let domain = domain.to_ascii_lowercase();
        let mut list = issuers();
        let before = list.len();
        list.retain(|i| !(i.domain == domain && i.selector == selector));
        require!(list.len() < before, "No such issuer");
        save_issuers(&list);
        emit("issuer_removed", &format!("{{\"domain\":\"{domain}\",\"selector\":\"{selector}\"}}"));
    }

    /// When on, the enclave counts only entries whose payslip email verifies against a trusted issuer.
    pub fn set_require_dkim(&mut self, on: bool) {
        self.require_governance();
        env::storage_write(K_REQUIRE, &[on as u8]);
        emit("require_dkim_set", &format!("{{\"on\":{on}}}"));
    }

    pub fn get_issuers(&self) -> Vec<Issuer> {
        issuers()
    }

    pub fn get_require_dkim(&self) -> bool {
        require_dkim()
    }

    /// DAO: the sealed engine was rebuilt. Records the new wasm hash (and, if the build has a new key, the new
    /// enclave public key, after which members resubmit). Every release record stores the engine hash in effect,
    /// so the log shows which build produced each result. Unlike `set_policy` (owner, frozen after release #1)
    /// this is a governance act and stays open.
    pub fn set_engine(&mut self, wasm_sha256: String, enclave_pubkey: Option<String>) {
        self.require_governance();
        clean(&wasm_sha256, 64, "wasm_sha256");
        self.policy.wasm_sha256 = wasm_sha256.clone();
        if let Some(k) = enclave_pubkey {
            clean(&k, 128, "enclave_pubkey");
            self.policy.enclave_pubkey = k;
        }
        emit("engine_set", &format!("{{\"wasm_sha256\":\"{wasm_sha256}\"}}"));
    }

    pub(crate) fn require_governance(&self) {
        let caller = env::predecessor_account_id();
        require!(
            caller == self.dao || (self.demo_owner_override && caller == self.owner),
            format!("Refused: only the union's DAO ({}) can change this", self.dao)
        );
    }
}
