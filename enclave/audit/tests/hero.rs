//! The hero case from BRIEF.md: 36 members, release #1 "mean pay by grade", a Senior at EUR 70,000
//! joins, release #2 asks for the same table.

mod common;

use bandsheet_audit::*;
use common::attacker::analyse;
use common::*;

fn chapel() -> Vec<Member> {
    // Harbour Courier newsroom chapel (synthetic). Senior pay sums to 815,976 over 12 people so that
    // every published mean is a whole number of euros (the differencing is then exact to the cent).
    let junior = [28_400, 29_100, 30_250, 31_000, 31_800, 32_500, 33_200, 34_900];
    let reporter = [38_500, 39_900, 41_200, 42_000, 43_300, 44_100, 45_600, 46_200, 47_900, 49_000, 50_800];
    let senior = [58_000, 61_500, 63_200, 64_800, 66_000, 67_400, 68_900, 70_100, 72_600, 74_300, 75_700, 60_000];
    let editor = [66_000, 71_500, 78_200, 82_300];
    let chief = [112_000];
    let mut out = Vec::new();
    let mut add = |grade: &str, pays: &[u64]| {
        for (i, &p) in pays.iter().enumerate() {
            let g = ["F", "M", "F", "X"][(out.len() + i) % 4];
            let site = if (out.len() + i) % 3 == 0 { "Port" } else { "City" };
            let m = member(&format!("chapel-{grade}-{i}"), grade, g, site, p);
            out.push(m);
        }
    };
    add("Junior", &junior);
    add("Reporter", &reporter);
    add("Senior", &senior);
    add("Editor", &editor);
    add("Chief", &chief);
    out
}

#[test]
fn naive_reveals_the_new_senior_and_bandsheet_refuses_the_changed_cell() {
    let mut members = chapel();
    // Fix the last senior so the 12 seniors sum to exactly 815,976 (mean 67,998).
    let sen: Vec<usize> = (0..members.len()).filter(|&i| members[i].grade == "Senior").collect();
    assert_eq!(sen.len(), 12);
    let others: u64 = sen[..11].iter().map(|&i| members[i].pay_eur).sum();
    let last = sen[11];
    let g = members[last].clone();
    members[last] = member("chapel-Senior-11", "Senior", &g.gender, &g.site, 815_976 - others);
    assert_eq!(members.len(), 36);
    let q1 = query(1, &[Field::Grade]);
    let k = 3;

    // Release #1.
    let r1 = release(k, &q1, &members, &History::default()).unwrap();
    let senior1 = r1.cells.iter().find(|c| c.key["grade"] == "Senior").unwrap().clone();
    assert_eq!((senior1.n, senior1.mean_eur), (12, 67_998));
    assert_eq!(r1.cells.len(), 4);
    assert_eq!(r1.suppressed.len(), 1);
    assert_eq!(r1.suppressed[0].key["grade"], "Chief");
    assert_eq!(r1.suppressed[0].reason, Reason::SmallCell);
    let (naive1, _) = naive_release(k, &q1, &members).unwrap();
    assert_eq!(naive1, r1.cells, "the first release is identical for both tools");

    // A Senior Reporter at EUR 70,000 joins.
    let newcomer = member("chapel-Senior-new", "Senior", "F", "City", 70_000);
    let mut members2 = members.clone();
    members2.push(newcomer.clone());
    let q2 = query(2, &[Field::Grade]);

    // Typical tool: #2 minus #1 reveals the 70,000.
    let (naive2, _) = naive_release(k, &q2, &members2).unwrap();
    let senior2 = naive2.iter().find(|c| c.key["grade"] == "Senior").unwrap();
    assert_eq!((senior2.n, senior2.mean_eur), (13, 68_152));
    assert_eq!(senior2.n as u64 * senior2.mean_eur - senior1.n as u64 * senior1.mean_eur, 70_000);
    let mut seen = published_from(&q1, &members, &naive1);
    seen.extend(published_from(&q2, &members2, &naive2));
    let f = analyse(&seen);
    let hit = f.exact.iter().find(|((slot, _), _)| *slot == newcomer.slot).expect("naive tool exposes the newcomer");
    assert_eq!(hit.1, num_rational::BigRational::from_integer(70_000.into()));

    // Bandsheet: the changed cell is refused, with a witness that names cells, not people.
    let r2 = release(k, &q2, &members2, &r1.history).unwrap();
    assert_eq!(r2.status, Status::PartiallyReleased);
    assert!(r2.cells.iter().all(|c| c.key["grade"] != "Senior"));
    let refused: Vec<_> = r2.suppressed.iter().filter(|s| s.reason == Reason::Differencing).collect();
    assert_eq!(refused.len(), 1);
    assert_eq!(refused[0].key["grade"], "Senior");
    assert_eq!(refused[0].witness, "Release #2 Senior - Release #1 Senior isolates 1 member");
    assert!(!refused[0].witness.contains("70000") && !refused[0].witness.contains(&newcomer.slot));
    // The unchanged cells are still published (nothing new is learned from them).
    for g in ["Junior", "Reporter", "Editor"] {
        let a = r1.cells.iter().find(|c| c.key["grade"] == g).unwrap();
        let b = r2.cells.iter().find(|c| c.key["grade"] == g).unwrap();
        assert_eq!(a, b);
    }
    let mut seen = published_from(&q1, &members, &r1.cells);
    seen.extend(published_from(&q2, &members2, &r2.cells));
    let f = analyse(&seen);
    assert!(f.exact.is_empty() && f.pairs == 0, "bandsheet leaves nothing solvable");

    // Release #3 after the newcomer is no longer new still has to be refused: the old Senior row
    // and the 13-person row stay in history, so the same table keeps the Senior cell back.
    let r3 = release(k, &query(3, &[Field::Grade]), &members2, &r2.history).unwrap();
    assert!(r3.cells.iter().all(|c| c.key["grade"] != "Senior"));
}

#[test]
fn a_member_who_leaves_and_one_who_joins_do_not_slip_past() {
    let mut members = chapel();
    let q1 = query(1, &[Field::Grade]);
    let r1 = release(3, &q1, &members, &History::default()).unwrap();
    // One Reporter leaves, a new one joins: n stays 11 but the set changed.
    let gone = members.iter().position(|m| m.grade == "Reporter").unwrap();
    members.remove(gone);
    members.push(member("chapel-Reporter-new", "Reporter", "M", "City", 61_000));
    let r2 = release(3, &query(2, &[Field::Grade]), &members, &r1.history).unwrap();
    let s = r2.suppressed.iter().find(|s| s.reason == Reason::Differencing).expect("changed cell suppressed");
    assert_eq!(s.key["grade"], "Reporter");
    assert_eq!(s.witness, "Release #2 Reporter - Release #1 Reporter isolates 2 members");
}

#[test]
fn a_raise_for_one_member_is_not_published_as_a_changed_mean() {
    let mut members = chapel();
    let r1 = release(3, &query(1, &[Field::Grade]), &members, &History::default()).unwrap();
    let i = members.iter().position(|m| m.grade == "Editor").unwrap();
    let old = members[i].clone();
    members[i] = member("chapel-Editor-0", "Editor", &old.gender, &old.site, old.pay_eur + 5_000);
    let r2 = release(3, &query(2, &[Field::Grade]), &members, &r1.history).unwrap();
    assert!(r2.suppressed.iter().any(|s| s.key["grade"] == "Editor" && s.reason == Reason::Differencing));
}
