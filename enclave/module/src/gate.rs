//! The DKIM gate: when the policy requires it, an entry counts only if its payslip email verifies.
//!
//! Order (each step is deliberate):
//! 1. every entry is checked alone: email present, trusted DKIM signature, signed text matches the entry;
//! 2. one entry per slot among the verified (latest `submitted_at` wins), so a member's valid entry is
//!    never evicted by a rejected one and a plain resubmission is a replacement, not a duplicate;
//! 3. one entry per nullifier = sha256(domain|employee_id|period) among those (latest wins, ties broken by
//!    the larger slot so the result is deterministic): the same payslip cannot count twice.
//!
//! Rejections are counts by reason only, never identities.

use crate::entry::Entry;
use base64::{engine::general_purpose::STANDARD, Engine};
use bandsheet_dkim::{nullifier, payslip, verify, Failure, Issuer};
use serde::Deserialize;
use std::collections::BTreeMap;

pub const MAX_ISSUERS: usize = 16;
const MAX_EML_BYTES: usize = 256 * 1024;

#[derive(Deserialize)]
pub struct IssuerIn {
    pub domain: String,
    pub selector: String,
    pub rsa_pubkey_spki_b64: String,
}

pub struct Outcome {
    pub entries: Vec<Entry>,
    pub rejections: BTreeMap<&'static str, u32>,
    pub superseded: usize,
}

pub fn load_issuers(list: &[IssuerIn]) -> Result<Vec<Issuer>, String> {
    if list.len() > MAX_ISSUERS {
        return Err(format!("at most {MAX_ISSUERS} trusted_issuers"));
    }
    list.iter()
        .enumerate()
        .map(|(i, x)| Issuer::from_spki_b64(&x.domain, &x.selector, &x.rsa_pubkey_spki_b64).map_err(|e| format!("trusted_issuers[{i}]: {e}")))
        .collect()
}

/// Ok(nullifier) or the rejection reason.
fn check(e: &Entry, issuers: &[Issuer]) -> Result<String, &'static str> {
    let b64 = e.eml_b64.as_deref().filter(|s| !s.trim().is_empty()).ok_or("no_email")?;
    let raw = STANDARD.decode(b64.trim()).map_err(|_| "no_email")?;
    if raw.is_empty() || raw.len() > MAX_EML_BYTES {
        return Err("no_email");
    }
    let v = verify(&raw, issuers).map_err(|f| match f {
        Failure::UntrustedIssuer => "untrusted_issuer",
        Failure::BadSignature => "dkim_bad_signature",
    })?;
    let p = payslip::parse(&v.body).ok_or("body_mismatch")?;
    if p.grade != e.grade || !p.annual_matches(e.gross_annual_eur) {
        return Err("body_mismatch");
    }
    Ok(nullifier(&v.domain, &p.employee_id, &p.period))
}

pub fn apply(entries: Vec<Entry>, issuers: &[Issuer]) -> Outcome {
    let mut rejections: BTreeMap<&'static str, u32> = BTreeMap::new();
    let mut by_slot: BTreeMap<String, (Entry, String)> = BTreeMap::new();
    let mut superseded = 0;
    for e in entries {
        match check(&e, issuers) {
            Err(reason) => *rejections.entry(reason).or_default() += 1,
            Ok(n) => match by_slot.get(&e.slot) {
                Some((old, _)) if old.submitted_at > e.submitted_at => superseded += 1,
                Some(_) => {
                    superseded += 1;
                    by_slot.insert(e.slot.clone(), (e, n));
                }
                None => {
                    by_slot.insert(e.slot.clone(), (e, n));
                }
            },
        }
    }
    let mut by_null: BTreeMap<String, Entry> = BTreeMap::new();
    for (e, n) in by_slot.into_values() {
        match by_null.get(&n) {
            Some(old) if (old.submitted_at, &old.slot) >= (e.submitted_at, &e.slot) => *rejections.entry("duplicate_payslip").or_default() += 1,
            Some(_) => {
                *rejections.entry("duplicate_payslip").or_default() += 1;
                by_null.insert(n, e);
            }
            None => {
                by_null.insert(n, e);
            }
        }
    }
    Outcome { entries: by_null.into_values().collect(), rejections, superseded }
}
