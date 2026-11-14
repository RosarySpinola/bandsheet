mod common;

use bandsheet_audit::*;
use common::*;

fn people(n_f: usize, n_m: usize) -> Vec<Member> {
    let mut v = Vec::new();
    for i in 0..n_f {
        v.push(member(&format!("f{i}"), "Reporter", "F", "City", 40_000 + 100 * i as u64));
    }
    for i in 0..n_m {
        v.push(member(&format!("m{i}"), "Reporter", "M", "Port", 45_000 + 100 * i as u64));
    }
    v
}

#[test]
fn complement_via_known_total_is_suppressed() {
    let ms = people(2, 34);
    let r1 = release(3, &query(1, &[]), &ms, &History::default()).unwrap();
    assert_eq!(r1.status, Status::Released);
    let r2 = release(3, &query(2, &[Field::Gender]), &ms, &r1.history).unwrap();
    let f = r2.suppressed.iter().find(|s| s.key["gender"] == "F").unwrap();
    assert_eq!(f.reason, Reason::SmallCell);
    let m = r2.suppressed.iter().find(|s| s.key["gender"] == "M").unwrap();
    assert_eq!(m.reason, Reason::Differencing);
    assert_eq!(m.witness, "Release #1 All members - Release #2 M isolates 2 members");
    assert_eq!(r2.status, Status::Refused);
}

#[test]
fn total_after_a_partition_with_a_singleton_is_refused_not_the_partition() {
    // Gender table: F has 1 member (primary-suppressed), M has 35 and is published. A later total
    // minus M would be F's pay, so the total is the cell that is held back.
    let ms = people(1, 35);
    let r1 = release(3, &query(1, &[Field::Gender]), &ms, &History::default()).unwrap();
    assert_eq!(r1.cells.len(), 1);
    assert_eq!(r1.cells[0].n, 35);
    let r2 = release(3, &query(2, &[]), &ms, &r1.history).unwrap();
    assert!(r2.cells.is_empty());
    assert_eq!(r2.suppressed[0].witness, "Release #2 All members - Release #1 M isolates 1 member");
}

#[test]
fn identical_release_is_free_and_history_stays_the_same_size() {
    let ms = people(10, 26);
    let q = query(1, &[Field::Gender]);
    let r1 = release(3, &q, &ms, &History::default()).unwrap();
    assert_eq!(r1.status, Status::Released);
    let r2 = release(3, &query(2, &[Field::Gender]), &ms, &r1.history).unwrap();
    assert_eq!(r2.status, Status::Released);
    assert_eq!(r2.cells, r1.cells);
    assert_eq!(r2.history, r1.history);
}

#[test]
fn history_survives_json_and_is_validated() {
    let ms = people(10, 26);
    let r1 = release(3, &query(1, &[Field::Gender]), &ms, &History::default()).unwrap();
    let json = serde_json::to_string(&r1.history).unwrap();
    assert!(!json.contains("40000") && !json.contains("45000"), "history carries no pay");
    let back: History = serde_json::from_str(&json).unwrap();
    assert_eq!(back, r1.history);
    let mut bad = back.clone();
    bad.rows[0].members = "AAAAAAAAAAAAAAAA".into();
    assert!(matches!(release(3, &query(2, &[Field::Gender]), &ms, &bad), Err(AuditError::BadHistory(_))));
    let mut dupcols = back;
    dupcols.cols.push(dupcols.cols[0].clone());
    assert!(matches!(release(3, &query(2, &[Field::Gender]), &ms, &dupcols), Err(AuditError::BadHistory(_))));
}

#[test]
fn inputs_are_validated() {
    let ms = people(10, 26);
    assert!(matches!(release(1, &query(1, &[]), &ms, &History::default()), Err(AuditError::BadQuery(_))));
    assert!(matches!(
        release(3, &query(1, &[Field::Gender, Field::Gender]), &ms, &History::default()),
        Err(AuditError::BadQuery(_))
    ));
    let mut dup = ms.clone();
    dup.push(ms[0].clone());
    assert!(matches!(release(3, &query(1, &[]), &dup, &History::default()), Err(AuditError::BadQuery(_))));
    let mut q = query(1, &[]);
    q.stat = "median".into();
    assert!(matches!(release(3, &q, &ms, &History::default()), Err(AuditError::BadQuery(_))));
}

#[test]
fn rounding_is_half_up_and_means_are_whole_euros() {
    let ms = vec![member("a", "Junior", "F", "City", 30_001), member("b", "Junior", "F", "City", 30_002), member("c", "Junior", "F", "City", 30_002)];
    let r = release(3, &query(1, &[]), &ms, &History::default()).unwrap();
    assert_eq!(r.cells[0].mean_eur, 30_002); // 90,005 / 3 = 30,001.67
}

#[test]
fn leaver_pay_stays_protected_after_leaving() {
    // The leaver's old row stays in history, so a later join into the same group is still caught.
    let mut ms = people(12, 24);
    let r1 = release(3, &query(1, &[Field::Gender]), &ms, &History::default()).unwrap();
    let i = ms.iter().position(|m| m.gender == "F").unwrap();
    ms.remove(i);
    let r2 = release(3, &query(2, &[Field::Gender]), &ms, &r1.history).unwrap();
    // 12 -> 11 women: Release #2 F - Release #1 F isolates 1 member (the leaver)
    let s = r2.suppressed.iter().find(|s| s.key["gender"] == "F").unwrap();
    assert_eq!(s.witness, "Release #1 F - Release #2 F isolates 1 member");
}
