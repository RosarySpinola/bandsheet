//! Stored and returned types. One contract holds many units; every record carries its unit id.
use near_sdk::json_types::{U128, U64};
use near_sdk::serde_json::{self, Value};
use near_sdk::{near, AccountId};

/// Same shape as the bandsheet contract's OutlayerCfg (outlayer.rs is shared with that crate).
#[near(serializers=[borsh, json])]
#[derive(Clone)]
pub struct OutlayerCfg {
    pub account: AccountId,
    /// JSON text of the `source` argument, e.g. {"Project":{"project_id":"o/p","version_key":null}}.
    pub source: String,
    /// JSON text of `secrets_ref` or empty for none.
    pub secrets_ref: String,
    /// Paid from this contract's balance on every run; OutLayer refunds the unused part.
    pub run_deposit: U128,
}

/// One policy for every unit: the same sealed engine, the same enclave key, the same k.
#[near(serializers=[borsh, json])]
#[derive(Clone)]
pub struct Policy {
    pub k: u32,
    pub enclave_pubkey: String,
    pub wasm_sha256: String,
    pub policy_hash: String,
}

/// An employer DKIM key the unit trusts. `source` is "dns" (fetched over DNS-over-HTTPS by the registrar) or
/// "supplied" (a council member supplied it; used for a fictional test domain that has no DNS record).
#[near(serializers=[borsh, json])]
#[derive(Clone)]
pub struct UnitIssuer {
    pub domain: String,
    pub selector: String,
    pub rsa_pubkey_spki_b64: String,
    pub source: String,
}

#[near(serializers=[borsh, json])]
#[derive(Clone)]
pub struct UnitInFlight {
    pub release_id: u32,
    pub proposal_id: u64,
    pub requested_by: AccountId,
    pub requested_at: U64,
}

#[near(serializers=[borsh])]
#[derive(Clone)]
pub struct Unit {
    pub id: u32,
    pub name: String,
    pub creator: AccountId,
    pub created_at: U64,
    pub council: Vec<AccountId>,
    /// hex sha256 of the invite code (the code itself never goes on chain; see INTERFACE.md).
    pub invite_code_hash: String,
    pub dkim_domains: Vec<String>,
    pub issuers: Vec<UnitIssuer>,
    /// Member slots (hex sha256 of the posting key), in join order. Nothing here names an account.
    pub slots: Vec<String>,
    /// Synthetic members ever added (sample data). Capped; removing one does not free the allowance.
    pub synthetic_added: u32,
    pub entries: u32,
    pub proposals: u64,
    /// Ids of open proposals (at most 5; they expire after 7 days).
    pub open: Vec<u64>,
    pub releases: u32,
    pub in_flight: Option<UnitInFlight>,
    /// Start times of recent engine runs (rolling 24 h window for the daily cap).
    pub recent_runs: Vec<u64>,
    /// Creation times of recent proposals (rolling 24 h window).
    pub recent_proposals: Vec<u64>,
    /// Seats waiting for more than half of the council to approve them.
    pub seat_votes: Vec<SeatVote>,
    /// Members ever added (real and synthetic), capped so remove-and-rejoin cannot mint gas allowances forever.
    pub joins: u32,
}

#[near(serializers=[borsh, json])]
#[derive(Clone)]
pub struct SeatVote {
    pub account_id: AccountId,
    pub approvals: Vec<AccountId>,
}

#[near(serializers=[borsh, json])]
#[derive(Clone)]
pub struct SlotInfo {
    pub unit_id: u32,
    pub synthetic: bool,
}

#[near(serializers=[borsh, json])]
#[derive(Clone)]
pub struct Proposal {
    pub id: u64,
    pub unit_id: u32,
    /// The validated query JSON; the release number is stamped in when it runs.
    pub query: String,
    pub proposer: AccountId,
    pub created_at: U64,
    /// The council when the proposal was made: only these seats vote, and the threshold is more than half of them.
    pub council: Vec<AccountId>,
    pub approvals: Vec<AccountId>,
    pub rejections: Vec<AccountId>,
    /// open | running | executed | rejected | withdrawn | expired
    pub status: String,
    pub release_id: Option<u32>,
}

/// One immutable line in a unit's release log.
#[near(serializers=[borsh])]
#[derive(Clone)]
pub struct UnitRelease {
    pub unit_id: u32,
    pub id: u32,
    pub proposal_id: u64,
    pub query: String,
    pub requested_by: AccountId,
    /// released | partially_released | refused | error
    pub status: String,
    pub cells: String,
    pub suppressed: String,
    pub input_hash: String,
    pub output_hash: String,
    pub input_sha256: String,
    pub output_sha256: String,
    pub proof: String,
    pub note: String,
    pub block_timestamp: U64,
    pub wasm_sha256: String,
    pub issuers: u32,
    /// Entries sent to the engine, and how many of them were synthetic (flagged on chain at join).
    pub entries: u32,
    pub synthetic: u32,
    pub entries_used: Option<u32>,
    pub entries_rejected: String,
    /// From the DKIM count run (require_dkim, no cells): entries whose employer email verified. None when it failed.
    pub dkim_verified: Option<u32>,
    pub dkim_rejections: String,
    pub count_note: String,
    pub count_output_sha256: String,
}

#[near(serializers=[json])]
pub struct ReleaseCounts {
    pub entries: u32,
    pub synthetic: u32,
    pub dkim_verified: Option<u32>,
    pub self_attested: Option<u32>,
    pub rejected: u32,
}

#[near(serializers=[json])]
pub struct UnitReleaseView {
    pub unit_id: u32,
    pub id: u32,
    pub proposal_id: u64,
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
    pub wasm_sha256: Option<String>,
    pub issuers: Option<u32>,
    pub require_dkim: Option<bool>,
    /// Same as counts.dkim_verified (the field name the bandsheet contract uses).
    pub entries_verified: Option<u32>,
    pub entries_used: Option<u32>,
    pub rejections: Value,
    pub dkim_rejections: Value,
    pub counts: ReleaseCounts,
    pub count_note: String,
    pub count_output_sha256: String,
}

fn j(s: &str) -> Value {
    serde_json::from_str(s).unwrap_or(Value::Null)
}

fn rejected_total(s: &str) -> u32 {
    match j(s) {
        Value::Object(m) => m.values().filter_map(Value::as_u64).sum::<u64>() as u32,
        _ => 0,
    }
}

impl UnitRelease {
    pub fn view(&self) -> UnitReleaseView {
        let rejected = rejected_total(&self.entries_rejected);
        let real = self.entries.saturating_sub(self.synthetic);
        UnitReleaseView {
            unit_id: self.unit_id,
            id: self.id,
            proposal_id: self.proposal_id,
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
            wasm_sha256: Some(self.wasm_sha256.clone()),
            issuers: Some(self.issuers),
            require_dkim: Some(false),
            entries_verified: self.dkim_verified,
            entries_used: self.entries_used,
            rejections: j(&self.entries_rejected),
            dkim_rejections: j(&self.dkim_rejections),
            counts: ReleaseCounts {
                entries: self.entries,
                synthetic: self.synthetic,
                dkim_verified: self.dkim_verified,
                self_attested: self.dkim_verified.map(|v| real.saturating_sub(v)),
                rejected,
            },
            count_note: self.count_note.clone(),
            count_output_sha256: self.count_output_sha256.clone(),
        }
    }
}

#[near(serializers=[json])]
pub struct IssuerView {
    pub domain: String,
    pub selector: String,
    pub source: String,
    /// sha256 hex of the SPKI key bytes as stored (base64 text), so a viewer can compare keys.
    pub key_sha256: String,
}

#[near(serializers=[json])]
pub struct UnitView {
    pub id: u32,
    pub name: String,
    pub creator: AccountId,
    pub created_at: U64,
    pub council: Vec<AccountId>,
    /// hex sha256 of the invite code (already public in the create_unit arguments; the link secret is not).
    pub invite_code_hash: String,
    /// Approvals needed for a release: more than half of the council.
    pub threshold: u32,
    pub dkim_domains: Vec<String>,
    pub issuers: Vec<IssuerView>,
    pub members: u32,
    pub synthetic_members: u32,
    pub synthetic_added: u32,
    pub entries: u32,
    pub proposals: u64,
    pub open_proposals: u32,
    pub releases: u32,
    pub in_flight: Option<UnitInFlight>,
    pub runs_last_24h: u32,
    /// Seat additions waiting for approval: each needs more than half of the current council.
    pub pending_seats: Vec<SeatVote>,
    pub joins: u32,
}

#[near(serializers=[json])]
pub struct UnitSummary {
    pub id: u32,
    pub name: String,
    pub creator: AccountId,
    pub council: Vec<AccountId>,
    pub members: u32,
    pub entries: u32,
    pub releases: u32,
}

#[near(serializers=[json])]
pub struct SlotView {
    pub unit_id: u32,
    pub synthetic: bool,
    pub has_entry: bool,
}

#[near(serializers=[json])]
pub struct StatsView {
    pub units: u32,
    pub max_units: u32,
    pub members: u64,
    pub entries: u64,
    pub releases: u64,
}

#[near(serializers=[json])]
pub struct Caps {
    pub max_units: u32,
    pub units_per_account: u32,
    pub releases_per_unit_per_day: u32,
    pub council_seats: u32,
    pub members_per_unit: u32,
    pub synthetic_per_unit: u32,
    pub dkim_domains_per_unit: u32,
    pub issuers_per_unit: u32,
    pub open_proposals_per_unit: u32,
    pub max_ciphertext_bytes: u32,
}

#[near(serializers=[json])]
pub struct PolicyView {
    pub contract: AccountId,
    pub registrar: AccountId,
    pub k: u32,
    pub enclave_pubkey: String,
    pub wasm_sha256: String,
    pub policy_hash: String,
    pub outlayer: OutlayerCfg,
    pub caps: Caps,
    pub frozen: bool,
}
