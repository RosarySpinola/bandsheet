//! One release: group members, apply primary suppression (n < k), then admit cells one at a time
//! (largest first) through the auditor; a cell that would let something small be solved is
//! suppressed (secondary suppression) with a witness.

use crate::engine::{Auditor, Outcome};
use crate::history::{decode_bits, encode_bits};
use crate::types::*;
use std::collections::{BTreeMap, HashMap};

pub struct Group {
    pub key: Key,
    pub label: String,
    pub members: Vec<usize>,
}

/// Members after the filter, grouped by `group_by`, in key order. Absent groups do not appear.
pub fn groups(q: &Query, members: &[Member]) -> Result<Vec<Group>, AuditError> {
    let mut seen = std::collections::BTreeSet::new();
    for f in &q.group_by {
        if !seen.insert(*f) {
            return Err(AuditError::BadQuery(format!("group_by repeats {}", f.name())));
        }
    }
    if q.stat != "mean" {
        return Err(AuditError::BadQuery(format!("unsupported stat {:?}", q.stat)));
    }
    let mut map: BTreeMap<Vec<String>, Vec<usize>> = BTreeMap::new();
    for (i, m) in members.iter().enumerate() {
        if let Some(filter) = &q.filter {
            if filter.iter().any(|(f, v)| m.attr(*f) != v) {
                continue;
            }
        }
        map.entry(q.group_by.iter().map(|f| m.attr(*f).to_string()).collect()).or_default().push(i);
    }
    let suffix = match &q.filter {
        Some(f) if !f.is_empty() => format!(" ({})", f.iter().map(|(k, v)| format!("{}={v}", k.name())).collect::<Vec<_>>().join(", ")),
        _ => String::new(),
    };
    Ok(map
        .into_iter()
        .map(|(vals, idx)| {
            let key: Key = q.group_by.iter().zip(&vals).map(|(f, v)| (f.name().to_string(), v.clone())).collect();
            let base = if vals.is_empty() { "All members".to_string() } else { vals.join(" / ") };
            Group { key, label: format!("{base}{suffix}"), members: idx }
        })
        .collect())
}

/// Mean pay rounded half up, in whole EUR.
pub fn mean_eur(members: &[Member], idx: &[usize]) -> u64 {
    let n = idx.len() as u128;
    let sum: u128 = idx.iter().map(|&i| members[i].pay_eur as u128).sum();
    ((2 * sum + n) / (2 * n)) as u64
}

pub fn release(k: usize, q: &Query, members: &[Member], hist: &History) -> Result<ReleaseResult, AuditError> {
    if k < 2 {
        return Err(AuditError::BadQuery("policy k must be at least 2".into()));
    }
    let mut dup = std::collections::HashSet::new();
    if members.iter().any(|m| !dup.insert(m.slot.as_str())) {
        return Err(AuditError::BadQuery("two entries share a slot".into()));
    }
    let gs = groups(q, members)?;

    // Unknowns: history columns first, then one per current member version not seen before.
    let mut cols = hist.cols.clone();
    let mut index: HashMap<(String, String), usize> = HashMap::new();
    for (i, c) in cols.iter().enumerate() {
        if index.insert((c.slot.clone(), c.fp.clone()), i).is_some() {
            return Err(AuditError::BadHistory("duplicate column".into()));
        }
    }
    let member_col: Vec<usize> = members
        .iter()
        .map(|m| {
            *index.entry((m.slot.clone(), m.fp.clone())).or_insert_with(|| {
                cols.push(Col { slot: m.slot.clone(), fp: m.fp.clone() });
                cols.len() - 1
            })
        })
        .collect();
    let ncols = cols.len();

    let mut auditor = Auditor::new(k, ncols, hist.rows.len() + gs.len());
    for row in &hist.rows {
        let bits = decode_bits(&row.members, hist.cols.len(), ncols)?;
        auditor.load_known(bits, format!("Release #{} {}", row.release, row.label));
    }

    let mut released: Vec<&Group> = Vec::new();
    let mut cells = Vec::new();
    let mut suppressed = Vec::new();
    let mut order: Vec<&Group> = Vec::new();
    for g in &gs {
        if g.members.len() < k {
            suppressed.push(Suppressed {
                key: g.key.clone(),
                reason: Reason::SmallCell,
                witness: format!("fewer than {k} members in this group"),
            });
        } else {
            order.push(g);
        }
    }
    order.sort_by(|a, b| b.members.len().cmp(&a.members.len()).then_with(|| a.key.cmp(&b.key)));

    let mut new_rows: Vec<(u32, String, Vec<u8>)> = Vec::new();
    for g in order {
        let mut bits = vec![0u8; ncols];
        for &i in &g.members {
            bits[member_col[i]] = 1;
        }
        match auditor.try_add(bits.clone(), format!("Release #{} {}", q.id, g.label)) {
            Outcome::Added => {
                new_rows.push((q.id, g.label.clone(), bits));
                released.push(g);
            }
            Outcome::Known => released.push(g),
            Outcome::Refused(witness) => {
                suppressed.push(Suppressed { key: g.key.clone(), reason: Reason::Differencing, witness });
            }
        }
    }
    for g in &released {
        cells.push(Cell { key: g.key.clone(), n: g.members.len() as u32, mean_eur: mean_eur(members, &g.members) });
    }
    cells.sort_by(|a, b| a.key.cmp(&b.key));
    suppressed.sort_by(|a, b| a.key.cmp(&b.key));

    let status = if cells.is_empty() {
        Status::Refused
    } else if suppressed.is_empty() {
        Status::Released
    } else {
        Status::PartiallyReleased
    };
    Ok(ReleaseResult { status, cells, suppressed, history: next_history(hist, &cols, new_rows) })
}

/// Old rows plus the new ones, over only the columns some row still uses.
fn next_history(old: &History, cols: &[Col], new_rows: Vec<(u32, String, Vec<u8>)>) -> History {
    let ncols = cols.len();
    let mut rows: Vec<(u32, String, Vec<u8>)> = old
        .rows
        .iter()
        .map(|r| (r.release, r.label.clone(), decode_bits(&r.members, old.cols.len(), ncols).unwrap_or_else(|_| vec![0; ncols])))
        .collect();
    rows.extend(new_rows);
    let used: Vec<bool> = (0..ncols).map(|c| rows.iter().any(|(_, _, b)| b[c] == 1)).collect();
    let keep: Vec<usize> = (0..ncols).filter(|&c| used[c]).collect();
    History {
        v: 1,
        cols: keep.iter().map(|&c| cols[c].clone()).collect(),
        rows: rows
            .into_iter()
            .map(|(release, label, bits)| HistoryRow {
                release,
                label,
                members: encode_bits(&keep.iter().map(|&c| bits[c]).collect::<Vec<u8>>()),
            })
            .collect(),
    }
}
