//! Exact row-space bookkeeping over GF(p) (p a large prime), with provenance.
//!
//! The basis is kept in fully reduced row echelon form. Every basis row also carries `c`, the
//! combination of the original rows (by id) that produced it, so a violation can be explained as
//! an equation over released cells.
//!
//! Key fact used for the check: in reduced echelon form, any vector of the row space is
//! `sum_j a_j * row_j` and has `a_j` at pivot column j. A vector of support <= s therefore uses at
//! most s basis rows. Singles and pairs are enumerated (exact for s <= 2, i.e. k <= 3).

pub fn mulmod(a: u64, b: u64, p: u64) -> u64 {
    ((a as u128 * b as u128) % p as u128) as u64
}

pub fn submod(a: u64, b: u64, p: u64) -> u64 {
    ((a as u128 + p as u128 - b as u128) % p as u128) as u64
}

pub fn addmod(a: u64, b: u64, p: u64) -> u64 {
    ((a as u128 + b as u128) % p as u128) as u64
}

pub fn powmod(mut a: u64, mut e: u64, p: u64) -> u64 {
    let mut r = 1u64;
    while e > 0 {
        if e & 1 == 1 {
            r = mulmod(r, a, p);
        }
        a = mulmod(a, a, p);
        e >>= 1;
    }
    r
}

pub fn invmod(a: u64, p: u64) -> u64 {
    powmod(a, p - 2, p)
}

pub fn signed(x: u64, p: u64) -> i128 {
    if x > p / 2 {
        x as i128 - p as i128
    } else {
        x as i128
    }
}

#[derive(Clone)]
struct Row {
    pivot: usize,
    v: Vec<u64>,
    c: Vec<u64>,
}

/// Something in the row space with fewer than k nonzero entries.
#[derive(Clone, Debug)]
pub struct Violation {
    /// (original row id, small signed coefficient) of the combination producing the vector.
    pub combo: Vec<(usize, i128)>,
    /// Number of nonzero entries (members the combination isolates).
    pub weight: usize,
}

#[derive(Clone)]
pub struct Echelon {
    p: u64,
    ncols: usize,
    m: usize,
    rows: Vec<Row>,
}

impl Echelon {
    pub fn new(p: u64, ncols: usize, m: usize) -> Echelon {
        Echelon { p, ncols, m, rows: Vec::new() }
    }

    /// Adds original row `id` (0/1 entries). Returns true when it was independent of what is known.
    pub fn add_row(&mut self, bits: &[u8], id: usize) -> bool {
        let p = self.p;
        let mut v: Vec<u64> = (0..self.ncols).map(|i| u64::from(bits.get(i).copied().unwrap_or(0))).collect();
        let mut c = vec![0u64; self.m];
        c[id] = 1;
        for b in &self.rows {
            let f = v[b.pivot];
            if f != 0 {
                axpy(&mut v, &b.v, f, p);
                axpy(&mut c, &b.c, f, p);
            }
        }
        let Some(pivot) = v.iter().position(|&x| x != 0) else {
            return false;
        };
        let inv = invmod(v[pivot], p);
        for x in v.iter_mut().chain(c.iter_mut()) {
            *x = mulmod(*x, inv, p);
        }
        for b in &mut self.rows {
            let f = b.v[pivot];
            if f != 0 {
                axpy(&mut b.v, &v, f, p);
                axpy(&mut b.c, &c, f, p);
            }
        }
        self.rows.push(Row { pivot, v, c });
        true
    }

    /// First vector in the row space with at most `limit` nonzero entries, if any.
    pub fn find_violation(&self, limit: usize) -> Option<Violation> {
        if limit == 0 {
            return None;
        }
        let p = self.p;
        for r in &self.rows {
            let w = r.v.iter().filter(|&&x| x != 0).count();
            if w <= limit {
                return Some(self.violation(&[(r, 1)], w));
            }
        }
        if limit < 2 {
            return None;
        }
        let np: Vec<Vec<usize>> = self
            .rows
            .iter()
            .map(|r| (0..self.ncols).filter(|&q| q != r.pivot && r.v[q] != 0).collect())
            .collect();
        for i in 0..self.rows.len() {
            for j in (i + 1)..self.rows.len() {
                if 2 + sym_diff(&np[i], &np[j]) > limit {
                    continue;
                }
                let (ri, rj) = (&self.rows[i], &self.rows[j]);
                let mut ratios = vec![1u64];
                for &q in np[i].iter().filter(|q| np[j].binary_search(q).is_ok()) {
                    ratios.push(mulmod(submod(0, rj.v[q], p), invmod(ri.v[q], p), p));
                }
                for a in ratios {
                    let w = (0..self.ncols).filter(|&q| addmod(mulmod(a, ri.v[q], p), rj.v[q], p) != 0).count();
                    if w <= limit {
                        return Some(self.violation(&[(ri, a), (rj, 1)], w));
                    }
                }
            }
        }
        None
    }

    fn violation(&self, parts: &[(&Row, u64)], weight: usize) -> Violation {
        let p = self.p;
        let mut acc = vec![0u64; self.m];
        for (r, a) in parts {
            for (x, c) in acc.iter_mut().zip(&r.c) {
                *x = addmod(*x, mulmod(*a, *c, p), p);
            }
        }
        let combo = acc.iter().enumerate().filter(|(_, &x)| x != 0).map(|(i, &x)| (i, signed(x, p))).collect();
        Violation { combo, weight }
    }
}

/// target -= f * src  (mod p)
fn axpy(target: &mut [u64], src: &[u64], f: u64, p: u64) {
    for (t, s) in target.iter_mut().zip(src) {
        if *s != 0 {
            *t = submod(*t, mulmod(f, *s, p), p);
        }
    }
}

fn sym_diff(a: &[usize], b: &[usize]) -> usize {
    let (mut i, mut j, mut d) = (0, 0, 0);
    while i < a.len() && j < b.len() {
        match a[i].cmp(&b[j]) {
            std::cmp::Ordering::Equal => {
                i += 1;
                j += 1;
            }
            std::cmp::Ordering::Less => {
                d += 1;
                i += 1;
            }
            std::cmp::Ordering::Greater => {
                d += 1;
                j += 1;
            }
        }
    }
    d + (a.len() - i) + (b.len() - j)
}
