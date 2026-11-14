//! Entry plaintext validation and de-duplication.

use bandsheet_audit::Member;
use serde::Deserialize;

pub const GRADES: [&str; 5] = ["Junior", "Reporter", "Senior", "Editor", "Chief"];
pub const GENDERS: [&str; 3] = ["F", "M", "X"];
pub const SITES: [&str; 2] = ["City", "Port"];
pub const MAX_PAY_EUR: u64 = 10_000_000;

#[derive(Deserialize)]
pub struct Entry {
    pub slot: String,
    pub gross_annual_eur: u64,
    pub grade: String,
    pub gender: String,
    pub site: String,
    pub submitted_at: u64,
}

/// Parses and validates one decrypted entry. The error is a short code, never the content.
pub fn parse(plaintext: &[u8]) -> Result<Entry, &'static str> {
    let e: Entry = serde_json::from_slice(plaintext).map_err(|_| "entry_shape")?;
    let slot_ok = e.slot.len() == 64 && e.slot.bytes().all(|b| matches!(b, b'0'..=b'9' | b'a'..=b'f'));
    if !slot_ok {
        return Err("entry_slot");
    }
    if e.gross_annual_eur == 0 || e.gross_annual_eur > MAX_PAY_EUR {
        return Err("entry_pay");
    }
    if !GRADES.contains(&e.grade.as_str()) || !GENDERS.contains(&e.gender.as_str()) || !SITES.contains(&e.site.as_str()) {
        return Err("entry_attribute");
    }
    Ok(e)
}

/// One entry per slot: the latest submission wins (a member who resubmits replaces).
/// Returns the members (sorted by slot, so the result is deterministic) and how many were superseded.
pub fn latest_per_slot(entries: Vec<Entry>) -> (Vec<Member>, usize) {
    let mut best: std::collections::BTreeMap<String, Entry> = std::collections::BTreeMap::new();
    let mut superseded = 0;
    for e in entries {
        match best.get(&e.slot) {
            Some(old) if old.submitted_at > e.submitted_at => superseded += 1,
            Some(_) => {
                superseded += 1;
                best.insert(e.slot.clone(), e);
            }
            None => {
                best.insert(e.slot.clone(), e);
            }
        }
    }
    let members = best.into_values().map(|e| Member::new(&e.slot, &e.grade, &e.gender, &e.site, e.gross_annual_eur)).collect();
    (members, superseded)
}
