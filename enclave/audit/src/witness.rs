//! Human-readable witnesses. They name released cells and a count, never a member or a value.

use crate::echelon::Violation;

fn members(n: usize) -> String {
    if n == 1 {
        "1 member".into()
    } else {
        format!("{n} members")
    }
}

/// Explains why row `cand` cannot be released next to the rows already known.
pub fn explain(rows: &[Vec<u8>], labels: &[String], v: &Violation, limit: usize, cand: usize) -> String {
    if let Some(text) = simple_difference(rows, labels, limit, cand) {
        return text;
    }
    if let Some(text) = from_combination(labels, v, cand) {
        return text;
    }
    format!("{} combine to isolate {}", labels[cand], members(v.weight))
}

/// Candidate minus one earlier row leaves fewer than k members: the join/leave and complement cases.
fn simple_difference(rows: &[Vec<u8>], labels: &[String], limit: usize, cand: usize) -> Option<String> {
    let mut best: Option<(usize, usize)> = None;
    for (r, row) in rows.iter().enumerate().take(cand) {
        let s = (0..rows[cand].len())
            .filter(|&i| rows[cand][i] != row.get(i).copied().unwrap_or(0))
            .count();
        if s >= 1 && s <= limit && best.is_none_or(|(bs, _)| s < bs) {
            best = Some((s, r));
        }
    }
    let (s, r) = best?;
    let only_gain = (0..rows[cand].len()).all(|i| rows[cand][i] >= rows[r].get(i).copied().unwrap_or(0));
    let only_loss = (0..rows[cand].len()).all(|i| rows[cand][i] <= rows[r].get(i).copied().unwrap_or(0));
    let (a, b) = if only_loss && !only_gain { (&labels[r], &labels[cand]) } else { (&labels[cand], &labels[r]) };
    Some(format!("{a} - {b} isolates {}", members(s)))
}

fn from_combination(labels: &[String], v: &Violation, cand: usize) -> Option<String> {
    if v.combo.len() > 6 || v.combo.iter().any(|(_, c)| c.abs() > 4) {
        return None;
    }
    let flip = v.combo.iter().find(|(i, _)| *i == cand).is_some_and(|(_, c)| *c < 0);
    let mut terms: Vec<(i128, &String)> = v.combo.iter().map(|(i, c)| (if flip { -c } else { *c }, &labels[*i])).collect();
    terms.sort_by_key(|(c, _)| std::cmp::Reverse(*c));
    let mut out = String::new();
    for (n, (c, label)) in terms.iter().enumerate() {
        let mag = c.abs();
        let body = if mag == 1 { (*label).clone() } else { format!("{mag} x {label}") };
        match (n, *c > 0) {
            (0, true) => out.push_str(&body),
            (0, false) => out.push_str(&format!("-{body}")),
            (_, true) => out.push_str(&format!(" + {body}")),
            (_, false) => out.push_str(&format!(" - {body}")),
        }
    }
    Some(format!("{out} isolates {}", members(v.weight)))
}
