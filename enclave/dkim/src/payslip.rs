//! The signed payslip text: exact labelled lines, parsed only after the DKIM signature verified.

use sha2::{Digest, Sha256};

#[derive(Debug, PartialEq, Eq)]
pub struct Payslip {
    pub employee_id: String,
    pub grade: String,
    pub period: String,
    pub monthly_cents: u64,
}

const MAX_CENTS: u64 = 1_000_000_000;

fn once<'a>(lines: &[&'a str], label: &str) -> Option<&'a str> {
    let mut hits = lines.iter().filter_map(|l| l.strip_prefix(label));
    let v = hits.next()?;
    hits.next().is_none().then(|| v.trim())
}

/// `EUR 5,833.33` -> 583333. Thousands commas optional, exactly two decimals optional.
fn cents(s: &str) -> Option<u64> {
    let s = s.strip_prefix("EUR ")?.trim();
    let (int, frac) = match s.split_once('.') {
        Some((i, f)) => (i, f),
        None => (s, "00"),
    };
    if frac.len() != 2 || !frac.bytes().all(|b| b.is_ascii_digit()) {
        return None;
    }
    let groups: Vec<&str> = int.split(',').collect();
    let grouped = groups.len() > 1;
    let ok = groups.iter().enumerate().all(|(i, g)| {
        !g.is_empty() && g.bytes().all(|b| b.is_ascii_digit()) && (!grouped || (if i == 0 { g.len() <= 3 } else { g.len() == 3 }))
    });
    if !ok {
        return None;
    }
    let whole: u64 = groups.concat().parse().ok()?;
    let total = whole.checked_mul(100)?.checked_add(frac.parse().ok()?)?;
    (total > 0 && total <= MAX_CENTS).then_some(total)
}

fn period_ok(p: &str) -> bool {
    let b = p.as_bytes();
    b.len() == 7 && b[4] == b'-' && b[..4].iter().all(u8::is_ascii_digit) && matches!(&p[5..], "01" | "02" | "03" | "04" | "05" | "06" | "07" | "08" | "09" | "10" | "11" | "12")
}

/// Each label must appear exactly once; anything else is None (a body mismatch).
pub fn parse(body: &[u8]) -> Option<Payslip> {
    let text = std::str::from_utf8(body).ok()?;
    let lines: Vec<&str> = text.lines().collect();
    let employee_id = once(&lines, "Employee ID:")?.to_string();
    let grade = once(&lines, "Grade:")?.to_string();
    let period = once(&lines, "Period:")?.to_string();
    let monthly_cents = cents(once(&lines, "Gross pay (month):")?)?;
    let id_ok = !employee_id.is_empty() && employee_id.len() <= 32 && employee_id.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'_');
    (id_ok && !grade.is_empty() && period_ok(&period)).then_some(Payslip { employee_id, grade, period, monthly_cents })
}

impl Payslip {
    /// Annual pay is month x 12, rounded to EUR; the entry's annual figure may differ by at most EUR 1.
    pub fn annual_matches(&self, entry_annual_eur: u64) -> bool {
        let entry = entry_annual_eur.saturating_mul(100);
        let signed = self.monthly_cents * 12;
        entry.abs_diff(signed) <= 100
    }
}

/// sha256(domain|employee_id|period), lowercase hex.
pub fn nullifier(domain: &str, employee_id: &str, period: &str) -> String {
    hex::encode(Sha256::digest(format!("{domain}|{employee_id}|{period}").as_bytes()))
}
