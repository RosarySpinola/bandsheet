//! An independent attacker. It shares no code with the auditor: exact rational Gaussian
//! elimination (BigRational), run on whatever was published. It reports
//!  - exact recoveries: members whose pay is a linear consequence of the published cells, and the
//!    value the attacker would read off (from the integer-rounded published means);
//!  - small-support leaks: published-cell combinations that isolate fewer than k (here: 1 or 2) members.

use num_bigint::BigInt;
use num_rational::BigRational;
use num_traits::{One, Zero};
use std::collections::{BTreeMap, BTreeSet};

/// One published cell as the attacker sees it: the unknowns it summed (slot, fingerprint) and the
/// published sum n x mean_eur.
pub struct Published {
    pub members: BTreeSet<(String, String)>,
    pub sum: u64,
}

pub struct Findings {
    /// (column, recovered pay as the attacker computes it)
    pub exact: Vec<((String, String), BigRational)>,
    /// Number of column pairs {i, j} with a vector of the row space supported on them (excluding
    /// pairs that contain an exactly recovered column).
    pub pairs: usize,
}

fn q(n: i64) -> BigRational {
    BigRational::from_integer(BigInt::from(n))
}

pub fn analyse(published: &[Published]) -> Findings {
    let cols: Vec<(String, String)> = published.iter().flat_map(|p| p.members.iter().cloned()).collect::<BTreeSet<_>>().into_iter().collect();
    let idx: BTreeMap<&(String, String), usize> = cols.iter().enumerate().map(|(i, c)| (c, i)).collect();
    let n = cols.len();
    // Augmented matrix [R | sum].
    let mut m: Vec<Vec<BigRational>> = published
        .iter()
        .map(|p| {
            let mut row = vec![q(0); n + 1];
            for c in &p.members {
                row[idx[c]] = q(1);
            }
            row[n] = q(p.sum as i64);
            row
        })
        .collect();
    // Reduced row echelon form on the first n columns.
    let mut pivots: Vec<usize> = Vec::new();
    let mut r = 0;
    for c in 0..n {
        let Some(p) = (r..m.len()).find(|&i| !m[i][c].is_zero()) else { continue };
        m.swap(r, p);
        let inv = BigRational::one() / m[r][c].clone();
        for x in m[r].iter_mut() {
            *x = x.clone() * inv.clone();
        }
        for i in 0..m.len() {
            if i != r && !m[i][c].is_zero() {
                let f = m[i][c].clone();
                let src = m[r].clone();
                for (x, s) in m[i].iter_mut().zip(src) {
                    *x = x.clone() - f.clone() * s;
                }
            }
        }
        pivots.push(c);
        r += 1;
    }
    let mut exact = Vec::new();
    let mut exact_cols = BTreeSet::new();
    for (row, &pc) in pivots.iter().enumerate() {
        if (0..n).filter(|&c| !m[row][c].is_zero()).count() == 1 {
            exact.push((cols[pc].clone(), m[row][n].clone()));
            exact_cols.insert(pc);
        }
    }
    // Kernel of R: free column f gives y with y_f = 1, y_pivot = -R[row][f]. A vector of the row
    // space is supported inside S iff the columns of the kernel matrix at S are linearly dependent
    // in the sense of having a nonzero x_S with x_S . K_S = 0; for |S| = 2 that is: col_i and col_j
    // of K (as vectors over the kernel basis) are parallel (or one is zero).
    let free: Vec<usize> = (0..n).filter(|c| !pivots.contains(c)).collect();
    let kern_col = |c: usize| -> Vec<BigRational> {
        free.iter()
            .map(|&f| {
                if c == f {
                    q(1)
                } else if let Some(row) = pivots.iter().position(|&p| p == c) {
                    -m[row][f].clone()
                } else {
                    q(0)
                }
            })
            .collect()
    };
    let kcols: Vec<Vec<BigRational>> = (0..n).map(kern_col).collect();
    let mut pairs = 0;
    for i in 0..n {
        for j in (i + 1)..n {
            if exact_cols.contains(&i) || exact_cols.contains(&j) {
                continue;
            }
            let parallel = (0..free.len()).all(|a| (a + 1..free.len()).all(|b| kcols[i][a].clone() * kcols[j][b].clone() == kcols[i][b].clone() * kcols[j][a].clone()));
            if parallel {
                pairs += 1;
            }
        }
    }
    Findings { exact, pairs }
}
