//! Read-only views. Nothing here links an account to a slot: slots appear only as hashes of posting keys.
use near_sdk::{env, near, AccountId};

use crate::{
    Caps, IssuerView, PolicyView, Proposal, SlotView, StatsView, Unit, UnitReleaseView, UnitSummary, UnitView, Units, UnitsExt, COUNCIL_SEATS,
    DKIM_DOMAINS, ISSUERS, MAX_UNITS, MEMBERS_PER_UNIT, OPEN_PROPOSALS, RELEASES_PER_DAY, SYNTHETIC_PER_UNIT, UNITS_PER_ACCOUNT,
};

const DAY_NS: u64 = 86_400_000_000_000;

impl Units {
    fn unit_view(&self, u: &Unit) -> UnitView {
        let synthetic = u.slots.iter().filter(|s| self.slots.get(*s).is_some_and(|i| i.synthetic)).count() as u32;
        let now = env::block_timestamp();
        UnitView {
            id: u.id,
            name: u.name.clone(),
            creator: u.creator.clone(),
            created_at: u.created_at,
            council: u.council.clone(),
            invite_code_hash: u.invite_code_hash.clone(),
            threshold: u.council.len() as u32 / 2 + 1,
            dkim_domains: u.dkim_domains.clone(),
            issuers: u
                .issuers
                .iter()
                .map(|i| IssuerView {
                    domain: i.domain.clone(),
                    selector: i.selector.clone(),
                    source: i.source.clone(),
                    key_sha256: hex::encode(env::sha256(i.rsa_pubkey_spki_b64.as_bytes())),
                })
                .collect(),
            members: u.slots.len() as u32,
            synthetic_members: synthetic,
            synthetic_added: u.synthetic_added,
            entries: u.entries,
            proposals: u.proposals,
            open_proposals: u.open.len() as u32,
            releases: u.releases,
            in_flight: u.in_flight.clone(),
            runs_last_24h: u.recent_runs.iter().filter(|t| now.saturating_sub(**t) < DAY_NS).count() as u32,
            pending_seats: u.seat_votes.clone(),
            joins: u.joins,
        }
    }

    fn page(from: Option<u64>, limit: Option<u64>, total: u64, max: u64) -> std::ops::Range<u64> {
        let from = from.unwrap_or(0).min(total);
        from..(from + limit.unwrap_or(max).min(max)).min(total)
    }
}

#[near]
impl Units {
    pub fn get_unit(&self, unit_id: u32) -> Option<UnitView> {
        unit_id.checked_sub(1).and_then(|i| self.units.get(i)).map(|u| self.unit_view(u))
    }

    /// Units where this account holds a council seat.
    pub fn get_units_of(&self, account_id: AccountId) -> Vec<UnitSummary> {
        self.seats
            .get(&account_id)
            .map(|ids| {
                ids.iter()
                    .filter_map(|id| self.units.get(id - 1))
                    .map(|u| UnitSummary {
                        id: u.id,
                        name: u.name.clone(),
                        creator: u.creator.clone(),
                        council: u.council.clone(),
                        members: u.slots.len() as u32,
                        entries: u.entries,
                        releases: u.releases,
                    })
                    .collect()
            })
            .unwrap_or_default()
    }

    /// Newest first is the caller's choice: pages run from proposal 1 upwards.
    pub fn get_unit_proposals(&self, unit_id: u32, from: Option<u64>, limit: Option<u64>) -> Vec<Proposal> {
        let Some(u) = unit_id.checked_sub(1).and_then(|i| self.units.get(i)) else { return Vec::new() };
        let now = env::block_timestamp();
        Self::page(from, limit, u.proposals, 50)
            .filter_map(|i| self.proposals.get(&(unit_id, i + 1)).cloned())
            .map(|mut p| {
                // an open proposal past 7 days is shown as expired even before a later call marks it
                if p.status == "open" && now.saturating_sub(p.created_at.0) >= 7 * DAY_NS {
                    p.status = "expired".to_string();
                }
                p
            })
            .collect()
    }

    pub fn get_unit_releases(&self, unit_id: u32, from: Option<u64>, limit: Option<u64>) -> Vec<UnitReleaseView> {
        let Some(u) = unit_id.checked_sub(1).and_then(|i| self.units.get(i)) else { return Vec::new() };
        Self::page(from, limit, u.releases as u64, 20).filter_map(|i| self.releases.get(&(unit_id, i as u32 + 1)).map(|r| r.view())).collect()
    }

    pub fn get_unit_release(&self, unit_id: u32, release_id: u32) -> Option<UnitReleaseView> {
        self.releases.get(&(unit_id, release_id)).map(|r| r.view())
    }

    /// Ciphertexts of a unit in slot order (what the next run would send). Nothing says whose they are.
    pub fn get_unit_entries(&self, unit_id: u32, from: Option<u64>, limit: Option<u64>) -> Vec<String> {
        let Some(u) = unit_id.checked_sub(1).and_then(|i| self.units.get(i)) else { return Vec::new() };
        let with: Vec<&String> = u.slots.iter().filter_map(|s| self.entries.get(s)).collect();
        Self::page(from, limit, with.len() as u64, 50).map(|i| with[i as usize].clone()).collect()
    }

    pub fn unit_of_slot(&self, slot: String) -> Option<SlotView> {
        self.slots.get(&slot).map(|i| SlotView { unit_id: i.unit_id, synthetic: i.synthetic, has_entry: self.entries.contains_key(&slot) })
    }

    pub fn slot_of(&self, public_key: near_sdk::PublicKey) -> String {
        crate::util::member_slot(&public_key)
    }

    pub fn get_units_stats(&self) -> StatsView {
        StatsView { units: self.units.len(), max_units: MAX_UNITS, members: self.members_total, entries: self.entries_total, releases: self.releases_total }
    }

    pub fn get_policy(&self) -> PolicyView {
        PolicyView {
            contract: env::current_account_id(),
            registrar: self.owner.clone(),
            k: self.policy.k,
            enclave_pubkey: self.policy.enclave_pubkey.clone(),
            wasm_sha256: self.policy.wasm_sha256.clone(),
            policy_hash: self.policy.policy_hash.clone(),
            outlayer: self.outlayer.clone(),
            caps: Caps {
                max_units: MAX_UNITS,
                units_per_account: UNITS_PER_ACCOUNT,
                releases_per_unit_per_day: RELEASES_PER_DAY,
                council_seats: COUNCIL_SEATS as u32,
                members_per_unit: MEMBERS_PER_UNIT as u32,
                synthetic_per_unit: SYNTHETIC_PER_UNIT,
                dkim_domains_per_unit: DKIM_DOMAINS as u32,
                issuers_per_unit: ISSUERS as u32,
                open_proposals_per_unit: OPEN_PROPOSALS,
                max_ciphertext_bytes: crate::util::MAX_CIPHERTEXT as u32,
            },
            frozen: self.releases_total > 0,
        }
    }
}
