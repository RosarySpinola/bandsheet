//! 100 generated adversarial scenarios: join / leave / swap / raise between releases, repeated and
//! overlapping group-bys, filters, totals next to partitions. For each, the same sequence of release
//! requests goes to the typical n >= k tool and to Bandsheet, and an independent exact attacker
//! (no shared code) works on everything each one published.

mod common;

use bandsheet_audit::*;
use common::attacker::{analyse, Published};
use common::*;

const K: usize = 3;
const CASES: u64 = 100;
const PATTERNS: [&str; 10] = [
    "same table repeated across joins and leaves", "same table repeated across joins and leaves", "same table repeated across joins and leaves", "same table repeated across joins and leaves",
    "overlapping group-bys (gender, site, grade, grade x gender)", "overlapping group-bys (gender, site, grade, grade x gender)",
    "total next to partitions", "site-filtered tables next to the all-sites table",
    "mixed queries with churn", "mixed queries with churn",
];

fn pool(pattern: u64, first: &Query) -> Vec<Query> {
    let q = |g: &[Field]| query(0, g);
    let filtered = |f: Field, v: &str, g: &[Field]| Query { filter: Some([(f, v.to_string())].into()), ..query(0, g) };
    match pattern {
        0..=3 => vec![first.clone()],
        4..=5 => vec![q(&[Field::Gender]), q(&[Field::Site]), q(&[Field::Grade]), q(&[Field::Grade, Field::Gender])],
        6 => vec![q(&[]), q(&[Field::Gender]), q(&[Field::Grade]), q(&[Field::Site])],
        7 => vec![
            filtered(Field::Site, "Port", &[Field::Grade]),
            filtered(Field::Site, "City", &[Field::Grade]),
            q(&[Field::Grade]),
        ],
        _ => vec![
            q(&[Field::Grade]),
            q(&[Field::Gender]),
            q(&[Field::Site]),
            q(&[Field::Grade, Field::Site]),
            q(&[Field::Gender, Field::Site]),
            q(&[]),
            filtered(Field::Site, "Port", &[Field::Grade]),
        ],
    }
}

fn mutate(rng: &mut Rng, members: &mut Vec<Member>, counter: &mut u32) {
    *counter += 1;
    let tag = format!("joiner-{counter}");
    match rng.below(6) {
        0 => members.push(random_member(rng, &tag, None)),
        1 => {
            let i = rng.below(members.len());
            members.remove(i);
        }
        2 => {
            // swap within a grade: n stays the same
            let i = rng.below(members.len());
            let g = members[i].grade.clone();
            members.remove(i);
            members.push(random_member(rng, &tag, Some(&g)));
        }
        3 => {
            // a raise for one member (resubmission with a different pay)
            let i = rng.below(members.len());
            let m = members[i].clone();
            members[i] = Member::new(&m.slot, &m.grade, &m.gender, &m.site, m.pay_eur + 1_000 + 50 * rng.below(60) as u64);
        }
        4 => {
            for _ in 0..2 {
                *counter += 1;
                members.push(random_member(rng, &format!("joiner-{counter}"), None));
            }
        }
        _ => {
            let i = rng.below(members.len());
            members.remove(i);
            members.push(random_member(rng, &tag, None));
        }
    }
}

#[derive(Default)]
struct Tally {
    naive_cells: usize,
    band_cells: usize,
    naive_exact: usize,
    band_exact: usize,
    naive_exact_cases: usize,
    naive_pair_cases: usize,
    naive_any_cases: usize,
    band_bad_cases: usize,
    band_suppressed_differencing: usize,
    max_err: f64,
}

#[test]
fn hundred_adversarial_cases_naive_leaks_bandsheet_does_not() {
    let mut t = Tally::default();
    let mut records = Vec::new();
    for seed in 0..CASES {
        let mut rng = Rng(0x9E3779B97F4A7C15 ^ (seed + 1).wrapping_mul(0xD1B54A32D192ED03));
        for _ in 0..4 {
            rng.next();
        }
        let n0 = 30 + rng.below(20);
        let mut counter = 0u32;
        let mut members: Vec<Member> = (0..n0).map(|i| random_member(&mut rng, &format!("seed{seed}-m{i}"), None)).collect();
        let first = query(0, &[*rng.pick(&[Field::Grade, Field::Gender, Field::Site])]);
        let queries = pool(seed % 10, &first);
        let steps = 3 + rng.below(3);

        let mut history = History::default();
        let (mut naive_seen, mut band_seen): (Vec<Published>, Vec<Published>) = (vec![], vec![]);
        let mut truth = std::collections::BTreeMap::new();
        let mut releases = Vec::new();
        for step in 0..steps {
            if step > 0 {
                for _ in 0..(1 + rng.below(2)) {
                    mutate(&mut rng, &mut members, &mut counter);
                }
            }
            for m in &members {
                truth.insert((m.slot.clone(), m.fp.clone()), m.pay_eur);
            }
            let mut q = if seed % 10 <= 3 { queries[0].clone() } else { rng.pick(&queries).clone() };
            q.id = step as u32 + 1;
            let (ncells, _) = naive_release(K, &q, &members).unwrap();
            let b = release(K, &q, &members, &history).unwrap();
            history = b.history.clone();
            t.naive_cells += ncells.len();
            t.band_cells += b.cells.len();
            t.band_suppressed_differencing += b.suppressed.iter().filter(|s| s.reason == Reason::Differencing).count();
            releases.push(serde_json::json!({
                "release": q.id,
                "group_by": q.group_by.iter().map(|f| f.name()).collect::<Vec<_>>(),
                "filter": q.filter,
                "members": members.len(),
                "naive_cells_published": ncells.len(),
                "bandsheet_cells_published": b.cells.len(),
                "bandsheet_status": b.status,
                "bandsheet_suppressed": b.suppressed.iter().map(|s| serde_json::json!({"key": s.key, "reason": s.reason, "witness": s.witness})).collect::<Vec<_>>(),
            }));
            naive_seen.extend(published_from(&q, &members, &ncells));
            band_seen.extend(published_from(&q, &members, &b.cells));
        }
        let (nf, bf) = (analyse(&naive_seen), analyse(&band_seen));
        for (col, val) in &nf.exact {
            use num_traits::ToPrimitive;
            let err = (val.to_f64().unwrap() - truth[col] as f64).abs();
            t.max_err = t.max_err.max(err);
        }
        let worst = nf.exact.iter().map(|(c, v)| { use num_traits::ToPrimitive; (v.to_f64().unwrap() - truth[c] as f64).abs() }).fold(0.0, f64::max);
        records.push(serde_json::json!({
            "case": seed,
            "pattern": PATTERNS[(seed % 10) as usize],
            "start_members": n0,
            "releases": releases,
            "naive": {"exact_recoveries": nf.exact.len(), "isolated_pairs": nf.pairs, "leaked": !nf.exact.is_empty() || nf.pairs > 0, "worst_recovery_error_eur": worst},
            "bandsheet": {"exact_recoveries": bf.exact.len(), "isolated_pairs": bf.pairs, "leaked": !bf.exact.is_empty() || bf.pairs > 0},
        }));
        t.naive_exact += nf.exact.len();
        t.band_exact += bf.exact.len();
        t.naive_exact_cases += usize::from(!nf.exact.is_empty());
        t.naive_pair_cases += usize::from(nf.exact.is_empty() && nf.pairs > 0);
        t.naive_any_cases += usize::from(!nf.exact.is_empty() || nf.pairs > 0);
        if !bf.exact.is_empty() || bf.pairs > 0 {
            t.band_bad_cases += 1;
            eprintln!("case {seed}: bandsheet leaked exact={} pairs={}", bf.exact.len(), bf.pairs);
        }
    }
    println!(
        "ADVERSARIAL SUITE ({CASES} cases, k={K}): naive n>=k leaks in {} cases ({} with an exact recovery, {} more with an isolated pair); \
         members exactly recovered from the naive tool: {} (worst recovery error from integer-rounded means: EUR {:.1}); \
         Bandsheet exact recoveries: {}, isolated pairs/small groups: {} cases; cells published naive {} vs bandsheet {} ({} secondary suppressions)",
        t.naive_any_cases, t.naive_exact_cases, t.naive_pair_cases, t.naive_exact, t.max_err, t.band_exact, t.band_bad_cases, t.naive_cells, t.band_cells,
        t.band_suppressed_differencing
    );
    if let Ok(path) = std::env::var("EVAL_OUT") {
        let summary = serde_json::json!({
            "cases": CASES, "k": K,
            "naive": {"cases_leaking": t.naive_any_cases, "cases_with_exact_recovery": t.naive_exact_cases, "cases_with_isolated_pair_only": t.naive_pair_cases,
                      "members_exactly_recovered": t.naive_exact, "worst_recovery_error_eur": t.max_err, "cells_published": t.naive_cells},
            "bandsheet": {"cases_leaking": t.band_bad_cases, "exact_recoveries": t.band_exact, "cells_published": t.band_cells,
                          "secondary_suppressions": t.band_suppressed_differencing},
            "attacker": "independent exact rational Gaussian elimination (num-rational); shares no code with the auditor",
            "generator": "audit/tests/adversarial.rs, deterministic seeds 0..99",
        });
        let doc = serde_json::json!({"summary": summary, "cases": records});
        std::fs::write(path, serde_json::to_string_pretty(&doc).unwrap() + "\n").unwrap();
    }
    assert_eq!(t.band_exact, 0, "Bandsheet must never let an individual be solved");
    assert_eq!(t.band_bad_cases, 0, "Bandsheet must never expose fewer than k members");
    assert!(t.naive_exact_cases >= 50, "the generated cases are not adversarial enough: naive leaks in only {}", t.naive_exact_cases);
    assert!(t.band_cells * 100 >= t.naive_cells * 55, "Bandsheet suppresses too much to be useful");
}
