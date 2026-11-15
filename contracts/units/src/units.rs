//! Creating a unit and its council-governed settings (seats, employer DKIM domains, issuer keys).
use near_sdk::{env, near, require, AccountId};

use crate::util::{self, emit};
use crate::{SeatVote, Unit, UnitIssuer, Units, UnitsExt, COUNCIL_SEATS, DKIM_DOMAINS, ISSUERS, MAX_UNITS, UNITS_PER_ACCOUNT};

#[near]
impl Units {
    /// Start a unit. The caller becomes council seat 1. `invite_code_hash` is hex sha256 of the invite code
    /// (the code is itself hex sha256 of the secret in the invite link, so the link secret never reaches the chain).
    pub fn create_unit(&mut self, name: String, invite_code_hash: String, dkim_domains: Vec<String>) -> u32 {
        let creator = env::predecessor_account_id();
        let name = util::unit_name(&name);
        util::hex64(&invite_code_hash, "invite_code_hash");
        require!(dkim_domains.len() <= DKIM_DOMAINS, format!("At most {DKIM_DOMAINS} DKIM domains"));
        let mut domains: Vec<String> = Vec::new();
        for d in &dkim_domains {
            let d = util::domain(d);
            if !domains.contains(&d) {
                domains.push(d);
            }
        }
        require!(self.units.len() < MAX_UNITS, format!("All {MAX_UNITS} units are taken on this contract"));
        let made = self.created.get(&creator).copied().unwrap_or(0);
        require!(made < UNITS_PER_ACCOUNT, format!("An account can start at most {UNITS_PER_ACCOUNT} units"));
        util::require_floor();

        let id = self.units.len() + 1;
        self.units.push(Unit {
            id,
            name: name.clone(),
            creator: creator.clone(),
            created_at: near_sdk::json_types::U64(env::block_timestamp()),
            council: vec![creator.clone()],
            invite_code_hash,
            dkim_domains: domains,
            issuers: Vec::new(),
            slots: Vec::new(),
            synthetic_added: 0,
            entries: 0,
            proposals: 0,
            open: Vec::new(),
            releases: 0,
            in_flight: None,
            recent_runs: Vec::new(),
            recent_proposals: Vec::new(),
            seat_votes: Vec::new(),
            joins: 0,
        });
        self.created.insert(creator.clone(), made + 1);
        self.add_seat(&creator, id);
        let name_json = near_sdk::serde_json::to_string(&name).unwrap_or_default();
        emit("unit_created", &format!("{{\"unit_id\":{id},\"name\":{name_json},\"creator\":\"{creator}\"}}"));
        id
    }

    /// Council: add a seat (at most 5). On a one-seat council it is added at once. Otherwise each call is an approval
    /// and the seat is added when more than half of the current council has approved it, so no single member can
    /// pack the council. Returns "added" or "pending". A new seat votes on proposals made after it joined.
    pub fn unit_add_council(&mut self, unit_id: u32, account_id: AccountId) -> String {
        let (mut u, by) = self.council_unit(unit_id);
        require!(!u.council.contains(&account_id), format!("{account_id} already holds a seat"));
        require!(u.council.len() < COUNCIL_SEATS, format!("A council has at most {COUNCIL_SEATS} seats"));
        util::require_floor();
        let mut vote = match u.seat_votes.iter().position(|v| v.account_id == account_id) {
            Some(i) => u.seat_votes.remove(i),
            None => SeatVote { account_id: account_id.clone(), approvals: Vec::new() },
        };
        require!(!vote.approvals.contains(&by), format!("{by} has already approved {account_id}"));
        vote.approvals.push(by.clone());
        // only approvals from current seats count
        let current = vote.approvals.iter().filter(|a| u.council.contains(a)).count();
        let status = if current * 2 > u.council.len() {
            u.council.push(account_id.clone());
            "added"
        } else {
            require!(u.seat_votes.len() < COUNCIL_SEATS, "Too many seat requests are pending");
            u.seat_votes.push(vote);
            "pending"
        };
        let seats = u.council.len();
        self.save(u);
        if status == "added" {
            self.add_seat(&account_id, unit_id);
        }
        emit(
            "council_added",
            &format!("{{\"unit_id\":{unit_id},\"account_id\":\"{account_id}\",\"by\":\"{by}\",\"status\":\"{status}\",\"seats\":{seats}}}"),
        );
        status.to_string()
    }

    /// Council: replace the invite (for example after a link leaked). Existing members are unaffected.
    pub fn unit_rotate_invite(&mut self, unit_id: u32, invite_code_hash: String) {
        let (mut u, by) = self.council_unit(unit_id);
        util::hex64(&invite_code_hash, "invite_code_hash");
        u.invite_code_hash = invite_code_hash;
        self.save(u);
        emit("invite_rotated", &format!("{{\"unit_id\":{unit_id},\"by\":\"{by}\"}}"));
    }

    /// Council: list an employer DKIM signing domain (the d= of its payslip emails).
    pub fn unit_add_dkim_domain(&mut self, unit_id: u32, domain: String) {
        let (mut u, by) = self.council_unit(unit_id);
        let d = util::domain(&domain);
        require!(!u.dkim_domains.contains(&d), format!("{d} is already listed"));
        require!(u.dkim_domains.len() < DKIM_DOMAINS, format!("At most {DKIM_DOMAINS} DKIM domains"));
        u.dkim_domains.push(d.clone());
        self.save(u);
        emit("dkim_domain_added", &format!("{{\"unit_id\":{unit_id},\"domain\":\"{d}\",\"by\":\"{by}\"}}"));
    }

    /// Registrar: record an employer's DKIM key for a listed domain. The same domain and selector again replaces
    /// the key (rotation). `source`: "dns" (default; fetched over DoH) or "supplied" (a council member gave it).
    pub fn unit_add_issuer(&mut self, unit_id: u32, domain: String, selector: String, public_key_pem_or_fingerprint: String, source: Option<String>) {
        self.require_registrar();
        let mut u = self.unit(unit_id);
        let d = util::domain(&domain);
        require!(u.dkim_domains.contains(&d), format!("{d} is not one of unit {unit_id}'s DKIM domains"));
        require!(
            !selector.is_empty() && selector.len() <= 63 && selector.bytes().all(|b| b.is_ascii_alphanumeric() || matches!(b, b'.' | b'-' | b'_')),
            "selector must be 1 to 63 letters, digits, dots, dashes or underscores"
        );
        let source = source.unwrap_or_else(|| "dns".to_string());
        require!(source == "dns" || source == "supplied", "source must be dns or supplied");
        let key = util::spki_b64(&public_key_pem_or_fingerprint);
        let rotated = u.issuers.iter().any(|i| i.domain == d && i.selector == selector);
        u.issuers.retain(|i| !(i.domain == d && i.selector == selector));
        require!(u.issuers.len() < ISSUERS, format!("At most {ISSUERS} issuer keys per unit"));
        u.issuers.push(UnitIssuer { domain: d.clone(), selector: selector.clone(), rsa_pubkey_spki_b64: key, source: source.clone() });
        self.save(u);
        emit(
            "issuer_added",
            &format!("{{\"unit_id\":{unit_id},\"domain\":\"{d}\",\"selector\":\"{selector}\",\"source\":\"{source}\",\"rotated\":{rotated}}}"),
        );
    }
}

impl Units {
    fn add_seat(&mut self, account: &AccountId, unit_id: u32) {
        let mut list = self.seats.get(account).cloned().unwrap_or_default();
        if !list.contains(&unit_id) {
            list.push(unit_id);
        }
        self.seats.insert(account.clone(), list);
    }
}
