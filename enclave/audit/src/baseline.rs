//! The "typical tool": publish every cell with at least k members. Used only by the demo
//! comparison and the tests; the enclave never calls it.

use crate::release::{groups, mean_eur};
use crate::types::*;

pub fn naive_release(k: usize, q: &Query, members: &[Member]) -> Result<(Vec<Cell>, Vec<Suppressed>), AuditError> {
    let mut cells = Vec::new();
    let mut suppressed = Vec::new();
    for g in groups(q, members)? {
        if g.members.len() >= k {
            cells.push(Cell { key: g.key, n: g.members.len() as u32, mean_eur: mean_eur(members, &g.members) });
        } else {
            suppressed.push(Suppressed {
                key: g.key,
                reason: Reason::SmallCell,
                witness: format!("fewer than {k} members in this group"),
            });
        }
    }
    Ok((cells, suppressed))
}
