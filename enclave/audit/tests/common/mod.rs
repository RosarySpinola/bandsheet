#![allow(dead_code)]
//! Shared test helpers: synthetic population, deterministic generator, attacker bridge.

pub mod attacker;

use attacker::Published;
use bandsheet_audit::*;
use sha2::{Digest, Sha256};
use std::collections::BTreeSet;

pub const GRADES: [&str; 5] = ["Junior", "Reporter", "Senior", "Editor", "Chief"];

pub fn slot_of(name: &str) -> String {
    hex::encode(Sha256::digest(name.as_bytes()))
}

pub fn member(name: &str, grade: &str, gender: &str, site: &str, pay: u64) -> Member {
    Member::new(&slot_of(name), grade, gender, site, pay)
}

pub fn query(id: u32, group_by: &[Field]) -> Query {
    Query { id, group_by: group_by.to_vec(), filter: None, stat: "mean".into() }
}

/// xorshift64*: deterministic, dependency-free.
pub struct Rng(pub u64);

impl Rng {
    pub fn next(&mut self) -> u64 {
        self.0 ^= self.0 >> 12;
        self.0 ^= self.0 << 25;
        self.0 ^= self.0 >> 27;
        self.0.wrapping_mul(0x2545F4914F6CDD1D)
    }
    pub fn below(&mut self, n: usize) -> usize {
        (self.next() % n as u64) as usize
    }
    pub fn pick<'a, T>(&mut self, xs: &'a [T]) -> &'a T {
        &xs[self.below(xs.len())]
    }
}

pub fn pay_for(rng: &mut Rng, grade: &str) -> u64 {
    let (lo, hi): (u64, u64) = match grade {
        "Junior" => (27_000, 36_000),
        "Reporter" => (37_000, 52_000),
        "Senior" => (54_000, 76_000),
        "Editor" => (62_000, 84_000),
        _ => (96_000, 128_000),
    };
    lo + (rng.below(((hi - lo) / 50) as usize) as u64) * 50
}

pub fn random_member(rng: &mut Rng, tag: &str, grade: Option<&str>) -> Member {
    let grade = grade.unwrap_or_else(|| {
        let w = [8usize, 11, 10, 4, 1];
        let mut r = rng.below(w.iter().sum());
        let mut i = 0;
        while r >= w[i] {
            r -= w[i];
            i += 1;
        }
        GRADES[i]
    });
    let gender = *rng.pick(&["F", "F", "M", "M", "X"]);
    let site = *rng.pick(&["City", "City", "Port"]);
    let pay = pay_for(rng, grade);
    member(tag, grade, gender, site, pay)
}

/// What an attacker holds from the released cells of one release.
pub fn published_from(q: &Query, members: &[Member], cells: &[Cell]) -> Vec<Published> {
    let gs = groups(q, members).unwrap();
    cells
        .iter()
        .map(|c| {
            let g = gs.iter().find(|g| g.key == c.key).expect("cell has a group");
            Published {
                members: g.members.iter().map(|&i| (members[i].slot.clone(), members[i].fp.clone())).collect::<BTreeSet<_>>(),
                sum: c.n as u64 * c.mean_eur,
            }
        })
        .collect()
}
