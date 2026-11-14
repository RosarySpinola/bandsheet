//! The auditor: keeps every released row (as a 0/1 membership vector over unknowns) and answers
//! "may this candidate row be released?" with an exact check over two large primes.
//!
//! Refusal rule: after adding the candidate, no nonzero vector in the row space of all released
//! rows may have fewer than k nonzero entries. That covers the unit vectors e_i (one member's pay
//! solvable) and every difference or complement that isolates fewer than k members.

use crate::echelon::Echelon;
use crate::witness;

pub const PRIMES: [u64; 2] = [(1u64 << 61) - 1, 18_446_744_073_709_551_557];

#[derive(Clone)]
pub struct Auditor {
    k: usize,
    echelons: [Echelon; 2],
    rows: Vec<Vec<u8>>,
    labels: Vec<String>,
    independent: Vec<bool>,
    m: usize,
}

#[derive(Debug, PartialEq, Eq)]
pub enum Outcome {
    /// Added; it carried new information and is safe.
    Added,
    /// Already implied by what was released; nothing new, safe.
    Known,
    /// Would isolate fewer than k members; the witness says how.
    Refused(String),
}

impl Auditor {
    /// `m` is an upper bound on the number of rows that will be offered.
    pub fn new(k: usize, ncols: usize, m: usize) -> Auditor {
        Auditor {
            k,
            echelons: [Echelon::new(PRIMES[0], ncols, m), Echelon::new(PRIMES[1], ncols, m)],
            rows: Vec::new(),
            labels: Vec::new(),
            independent: Vec::new(),
            m,
        }
    }

    /// Loads a row that was already released earlier. It is trusted, not checked.
    pub fn load_known(&mut self, bits: Vec<u8>, label: String) {
        self.push(bits, label);
    }

    /// Whether row `i` (in load/add order) carried information when it entered.
    pub fn is_independent(&self, i: usize) -> bool {
        self.independent[i]
    }

    pub fn row_count(&self) -> usize {
        self.rows.len()
    }

    fn push(&mut self, bits: Vec<u8>, label: String) -> bool {
        assert!(self.rows.len() < self.m, "auditor capacity exceeded");
        let id = self.rows.len();
        let a = self.echelons[0].add_row(&bits, id);
        let b = self.echelons[1].add_row(&bits, id);
        // Disagreement between the primes is astronomically unlikely; treat it as information.
        let indep = a || b;
        self.rows.push(bits);
        self.labels.push(label);
        self.independent.push(indep);
        indep
    }

    /// Offers a candidate row. On `Refused` the auditor is unchanged.
    pub fn try_add(&mut self, bits: Vec<u8>, label: String) -> Outcome {
        let limit = self.k.saturating_sub(1);
        let mut trial = self.clone();
        if !trial.push(bits.clone(), label.clone()) {
            // Dependent: the row space is unchanged. Keep the row for witnesses only.
            *self = trial;
            return Outcome::Known;
        }
        let violation = trial.echelons.iter().find_map(|e| e.find_violation(limit));
        if let Some(v) = violation {
            let cand = trial.rows.len() - 1;
            return Outcome::Refused(witness::explain(&trial.rows, &trial.labels, &v, limit, cand));
        }
        *self = trial;
        Outcome::Added
    }
}
