//! Member credentials are NEAR-native: a function-call access key on this account, limited to `submit`
//! with a small gas allowance. The key's hash is the member's slot.
use near_sdk::json_types::U64;
use near_sdk::serde_json::Value;
use near_sdk::{env, near, require, Allowance, NearToken, Promise, PublicKey};

use crate::events::emit;
use crate::{Bandsheet, BandsheetExt, MAX_CIPHERTEXT};

/// Gas the member key may burn on this account, in total. About 0.1 NEAR covers hundreds of submissions.
const ALLOWANCE: NearToken = NearToken::from_millinear(100);

/// hex(sha256(raw ed25519 key bytes)).
pub fn member_slot(pk: &PublicKey) -> String {
    let b = pk.as_bytes();
    require!(b.len() == 33 && b[0] == 0, "Member keys must be ed25519");
    hex::encode(env::sha256(&b[1..]))
}

/// A ciphertext is the object {epk, nonce, ct} (base64 strings) the member's client produced, or a bare
/// base64 string. The contract stores it as text and never reads inside it.
fn ciphertext_text(ct: Value) -> String {
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
    require!(text.len() <= MAX_CIPHERTEXT, "Ciphertext is too large");
    text
}

#[near]
impl Bandsheet {
    pub fn slot_of(&self, public_key: PublicKey) -> String {
        member_slot(&public_key)
    }

    /// Committee: give each key a function-call access key on the union account (method `submit` only).
    pub fn add_members(&mut self, public_keys: Vec<PublicKey>) -> u64 {
        self.require_owner();
        require!(!public_keys.is_empty() && public_keys.len() <= 40, "Add 1 to 40 keys per call");
        for pk in public_keys {
            let slot = member_slot(&pk);
            require!(self.members.insert(slot.clone()), "Key is already a member");
            Promise::new(env::current_account_id())
                .add_access_key_allowance(pk, Allowance::limited(ALLOWANCE).unwrap(), env::current_account_id(), "submit".to_string())
                .detach();
            emit("member_added", &format!("{{\"slot\":\"{slot}\"}}"));
        }
        self.members.len() as u64
    }

    /// Committee: revoke the key and drop that member's entry, so the next release is computed without them.
    pub fn revoke_member(&mut self, public_key: PublicKey) {
        self.require_owner();
        let slot = member_slot(&public_key);
        require!(self.members.remove(&slot), "Key is not a member");
        self.entries.remove(&slot);
        Promise::new(env::current_account_id()).delete_key(public_key).detach();
        emit("member_revoked", &format!("{{\"slot\":\"{slot}\"}}"));
    }

    /// A member submits (or replaces) their sealed entry. Only the union account's own access keys reach
    /// this: any other caller is refused, so an outside account cannot add a fake entry.
    pub fn submit(&mut self, ciphertext: Value) -> U64 {
        let caller = env::predecessor_account_id();
        require!(
            caller == env::current_account_id(),
            format!("Refused: {caller} is outside the union. Entries are accepted only from a member key on {}", env::current_account_id())
        );
        let slot = member_slot(&env::signer_account_pk());
        require!(self.members.contains(&slot), "Refused: this key is not a registered member of the union");
        let replaced = self.entries.insert(slot.clone(), ciphertext_text(ciphertext)).is_some();
        emit("entry_submitted", &format!("{{\"slot\":\"{slot}\",\"replaced\":{replaced},\"count\":{}}}", self.entries.len()));
        U64(self.entries.len() as u64)
    }
}
