//! Members are posting keys on this account (function-call keys limited to `submit`, with a small gas
//! allowance). The registrar adds them after the server has checked the joiner's wallet signature and invite code;
//! the account <-> slot link stays off chain. A slot routes every submit to its own unit.
use near_sdk::json_types::U64;
use near_sdk::serde_json::Value;
use near_sdk::{env, near, require, Allowance, NearToken, Promise, PublicKey};

use crate::util::{self, emit, member_slot};
use crate::{SlotInfo, Units, UnitsExt, JOINS_PER_UNIT, MEMBERS_PER_UNIT, SYNTHETIC_PER_UNIT};

/// Gas a member key may burn in total: a few dozen submits. A synthetic key submits once and is then deleted.
const ALLOWANCE: NearToken = NearToken::from_millinear(50);
const SYNTHETIC_ALLOWANCE: NearToken = NearToken::from_millinear(20);

#[near]
impl Units {
    /// Registrar: give a posting key to a unit. A real join must carry the invite code, whose sha256 must equal
    /// the unit's invite_code_hash. A synthetic add (sample data, flagged on chain for good) carries no code: the
    /// server only makes one after a council member's signed request, and the contract caps them at 8 per unit.
    pub fn unit_add_member(&mut self, unit_id: u32, public_key: PublicKey, invite_code: String, synthetic: bool) -> u32 {
        self.require_registrar();
        let mut u = self.unit(unit_id);
        if !synthetic {
            require!(invite_code.len() <= 128, "Invite code is too long");
            require!(hex::encode(env::sha256(invite_code.as_bytes())) == u.invite_code_hash, "Refused: the invite code does not match this unit");
        } else {
            require!(u.synthetic_added < SYNTHETIC_PER_UNIT, format!("A unit has at most {SYNTHETIC_PER_UNIT} synthetic colleagues"));
        }
        let slot = member_slot(&public_key);
        require!(!self.slots.contains_key(&slot), "That key is already a member of a unit");
        require!(u.slots.len() < MEMBERS_PER_UNIT, format!("A unit has at most {MEMBERS_PER_UNIT} members"));
        require!(u.joins < JOINS_PER_UNIT, format!("A unit can add at most {JOINS_PER_UNIT} member keys in its lifetime"));
        util::require_floor();
        u.joins += 1;

        if synthetic {
            u.synthetic_added += 1;
        }
        u.slots.push(slot.clone());
        let members = u.slots.len() as u32;
        self.save(u);
        self.slots.insert(slot.clone(), SlotInfo { unit_id, synthetic });
        self.members_total += 1;
        let allowance = if synthetic { SYNTHETIC_ALLOWANCE } else { ALLOWANCE };
        Promise::new(env::current_account_id())
            .add_access_key_allowance(public_key, Allowance::limited(allowance).unwrap(), env::current_account_id(), "submit".to_string())
            .detach();
        emit("member_added", &format!("{{\"unit_id\":{unit_id},\"slot\":\"{slot}\",\"synthetic\":{synthetic},\"members\":{members}}}"));
        members
    }

    /// Registrar: revoke a posting key (for example when a member re-joins from a new device). The slot's entry is
    /// dropped, so the next release is computed without it.
    pub fn unit_remove_member(&mut self, unit_id: u32, public_key: PublicKey) {
        self.require_registrar();
        let slot = member_slot(&public_key);
        let info = self.slots.get(&slot).cloned().unwrap_or_else(|| env::panic_str("That key is not a member"));
        require!(info.unit_id == unit_id, "That key belongs to another unit");
        let mut u = self.unit(unit_id);
        u.slots.retain(|s| s != &slot);
        let had_entry = self.entries.remove(&slot).is_some();
        if had_entry {
            u.entries -= 1;
            self.entries_total -= 1;
        }
        self.save(u);
        self.slots.remove(&slot);
        self.members_total -= 1;
        // a synthetic key that already submitted deleted itself
        if !info.synthetic || !had_entry {
            Promise::new(env::current_account_id()).delete_key(public_key).detach();
        }
        emit("member_removed", &format!("{{\"unit_id\":{unit_id},\"slot\":\"{slot}\"}}"));
    }

    /// A member's posting key submits (or replaces) its sealed entry, routed to the slot's unit. Only this account's
    /// own keys reach it: any outside caller is refused, so nobody can add an entry from a wallet.
    pub fn submit(&mut self, ciphertext: Value) -> U64 {
        let caller = env::predecessor_account_id();
        require!(
            caller == env::current_account_id(),
            format!("Refused: {caller} is outside the units contract. Entries are accepted only from a member key on {}", env::current_account_id())
        );
        let pk = env::signer_account_pk();
        let slot = member_slot(&pk);
        let info = self.slots.get(&slot).cloned().unwrap_or_else(|| env::panic_str("Refused: this key is not a member of any unit"));
        let text = util::ciphertext_text(ciphertext);
        util::require_floor();
        let replaced = self.entries.insert(slot.clone(), text).is_some();
        let mut u = self.unit(info.unit_id);
        if !replaced {
            u.entries += 1;
            self.entries_total += 1;
        }
        let count = u.entries;
        self.save(u);
        if info.synthetic {
            // single use: a synthetic key cannot replace its entry later
            Promise::new(env::current_account_id()).delete_key(pk).detach();
        }
        emit(
            "entry_submitted",
            &format!("{{\"unit_id\":{},\"slot\":\"{slot}\",\"synthetic\":{},\"replaced\":{replaced},\"count\":{count}}}", info.unit_id, info.synthetic),
        );
        U64(count as u64)
    }
}
