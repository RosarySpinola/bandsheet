//! Shared types. JSON shapes follow BRIEF.md ("Query", "Enclave output").

use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

/// A member attribute a table can be grouped or filtered by.
#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Field {
    Grade,
    Gender,
    Site,
}

impl Field {
    pub fn name(self) -> &'static str {
        match self {
            Field::Grade => "grade",
            Field::Gender => "gender",
            Field::Site => "site",
        }
    }
}

/// Query as sent by the contract: `{"id","group_by":[..],"filter":{..}?,"stat":"mean"}`.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Query {
    pub id: u32,
    #[serde(default)]
    pub group_by: Vec<Field>,
    #[serde(default)]
    pub filter: Option<BTreeMap<Field, String>>,
    #[serde(default = "default_stat")]
    pub stat: String,
}

fn default_stat() -> String {
    "mean".into()
}

/// One current member's validated entry. `fp` is a fingerprint of the whole entry: a member whose
/// pay or attributes changed is a new unknown to the audit (see `Member::fingerprint`).
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Member {
    pub slot: String,
    pub fp: String,
    pub grade: String,
    pub gender: String,
    pub site: String,
    pub pay_eur: u64,
}

impl Member {
    pub fn new(slot: &str, grade: &str, gender: &str, site: &str, pay_eur: u64) -> Member {
        use sha2::{Digest, Sha256};
        let mut h = Sha256::new();
        for part in [b"bandsheet/v1/fp".as_slice(), slot.as_bytes(), grade.as_bytes(), gender.as_bytes(), site.as_bytes(), pay_eur.to_string().as_bytes()] {
            h.update(part);
            h.update([0u8]);
        }
        Member {
            slot: slot.into(),
            fp: hex::encode(&h.finalize()[..8]),
            grade: grade.into(),
            gender: gender.into(),
            site: site.into(),
            pay_eur,
        }
    }

    pub fn attr(&self, f: Field) -> &str {
        match f {
            Field::Grade => &self.grade,
            Field::Gender => &self.gender,
            Field::Site => &self.site,
        }
    }
}

pub type Key = BTreeMap<String, String>;

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct Cell {
    pub key: Key,
    pub n: u32,
    pub mean_eur: u64,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Reason {
    SmallCell,
    Differencing,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct Suppressed {
    pub key: Key,
    pub reason: Reason,
    pub witness: String,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Status {
    Released,
    PartiallyReleased,
    Refused,
}

/// A released row kept for later audits: which unknowns (columns) it summed. Never any pay value.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct HistoryRow {
    pub release: u32,
    pub label: String,
    /// Base64 bitmap over `History::cols`, bit i set = column i is a member of this cell.
    pub members: String,
}

/// One unknown: a member in one version of their entry.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct Col {
    pub slot: String,
    pub fp: String,
}

/// Plaintext history (it is only ever stored encrypted to the enclave key).
#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct History {
    #[serde(default = "one")]
    pub v: u32,
    #[serde(default)]
    pub cols: Vec<Col>,
    #[serde(default)]
    pub rows: Vec<HistoryRow>,
}

fn one() -> u32 {
    1
}

#[derive(Clone, Debug)]
pub struct ReleaseResult {
    pub status: Status,
    pub cells: Vec<Cell>,
    pub suppressed: Vec<Suppressed>,
    pub history: History,
}

#[derive(Debug, PartialEq, Eq)]
pub enum AuditError {
    BadQuery(String),
    BadHistory(String),
}

impl std::fmt::Display for AuditError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            AuditError::BadQuery(m) => write!(f, "bad query: {m}"),
            AuditError::BadHistory(m) => write!(f, "bad history: {m}"),
        }
    }
}

impl std::error::Error for AuditError {}
