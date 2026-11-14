//! Verifies the generated fixtures (fixtures/dkim, made by enclave/scripts/dkim-fixtures.mjs with an
//! independent signer and cross-checked with dkimpy) against the Rust verifier.
use bandsheet_dkim::{canon, nullifier, payslip, verify, Failure, Issuer};
use serde_json::Value;

const ROOT: &str = concat!(env!("CARGO_MANIFEST_DIR"), "/../../fixtures/dkim");

fn read(rel: &str) -> Vec<u8> {
    std::fs::read(format!("{ROOT}/{rel}")).unwrap_or_else(|e| panic!("{rel}: {e}"))
}
fn text(rel: &str) -> String {
    String::from_utf8(read(rel)).unwrap()
}
fn manifest() -> Value {
    serde_json::from_slice(&read("manifest.json")).unwrap()
}
fn issuer() -> Issuer {
    let m = manifest();
    let i = &m["issuer"];
    Issuer::from_spki_b64(i["domain"].as_str().unwrap(), i["selector"].as_str().unwrap(), i["rsa_pubkey_spki_b64"].as_str().unwrap()).unwrap()
}

#[test]
fn every_seeded_member_and_variant_verifies_and_parses() {
    let m = manifest();
    let issuers = [issuer()];
    let mut n = 0;
    for e in m["members"].as_array().unwrap() {
        let v = verify(&read(e["eml"].as_str().unwrap()), &issuers).unwrap_or_else(|f| panic!("{}: {f:?}", e["slug"]));
        assert_eq!(v.domain, "harbourcourier.example");
        let p = payslip::parse(&v.body).expect("payslip parses");
        assert_eq!(p.employee_id, e["employee_id"].as_str().unwrap());
        assert_eq!(p.grade, e["grade"].as_str().unwrap());
        assert_eq!(p.period, "2026-10");
        assert!(p.annual_matches(e["gross_annual_eur"].as_u64().unwrap()), "{}", e["slug"]);
        n += 1;
    }
    assert_eq!(n, 37);
    for e in m["variants"].as_array().unwrap() {
        let v = verify(&read(e["eml"].as_str().unwrap()), &issuers).unwrap_or_else(|f| panic!("{}: {f:?}", e["file"]));
        assert_eq!(payslip::parse(&v.body).unwrap().monthly_cents, 583_333);
    }
}

#[test]
fn noor_haddad_is_senior_at_5833_33() {
    let v = verify(&read("emails/noor-haddad.eml"), &[issuer()]).unwrap();
    let p = payslip::parse(&v.body).unwrap();
    assert_eq!((p.employee_id.as_str(), p.grade.as_str(), p.monthly_cents), ("HC-0412", "Senior", 583_333));
    assert!(p.annual_matches(70_000) && p.annual_matches(69_999) && !p.annual_matches(69_998) && !p.annual_matches(70_002));
}

#[test]
fn negatives_fail_with_the_right_reason() {
    let issuers = [issuer()];
    for n in manifest()["negatives"].as_array().unwrap() {
        let file = n["file"].as_str().unwrap();
        let got = verify(&read(n["eml"].as_str().unwrap()), &issuers);
        match n["expect"].as_str().unwrap() {
            "dkim_bad_signature" => assert_eq!(got.err(), Some(Failure::BadSignature), "{file}"),
            "untrusted_issuer" => assert_eq!(got.err(), Some(Failure::UntrustedIssuer), "{file}"),
            // the re-issued payslip is a genuine signature; the enclave rejects it by nullifier
            "duplicate_payslip" => assert!(got.is_ok(), "{file}"),
            other => panic!("unknown expectation {other}"),
        }
    }
}

#[test]
fn nullifier_is_the_same_for_a_reissued_payslip() {
    let a = verify(&read("emails/declan-murphy.eml"), &[issuer()]).unwrap();
    let b = verify(&read("emails/duplicate.eml"), &[issuer()]).unwrap();
    let (pa, pb) = (payslip::parse(&a.body).unwrap(), payslip::parse(&b.body).unwrap());
    assert_eq!(nullifier(&a.domain, &pa.employee_id, &pa.period), nullifier(&b.domain, &pb.employee_id, &pb.period));
    assert_eq!(nullifier("harbourcourier.example", "HC-0412", "2026-10").len(), 64);
}

#[test]
fn any_edit_after_signing_breaks_it() {
    let issuers = [issuer()];
    let good = text("emails/noor-haddad.eml");
    for (from, to) in [("Grade: Senior", "Grade: Editor"), ("EUR 5,833.33", "EUR 5,833.34"), ("HC-0412", "HC-0413"), ("Subject: Your payslip", "Subject: Your Payslip"), ("Date: Fri", "Date: Sat")] {
        let edited = good.replace(from, to);
        assert_ne!(edited, good, "{from}");
        assert_eq!(verify(edited.as_bytes(), &issuers).err(), Some(Failure::BadSignature), "{from}");
    }
    // appended text changes the body hash; a stripped signature leaves no trusted signature
    assert_eq!(verify(format!("{good}\r\nEmployee ID: HC-9999\r\n").as_bytes(), &issuers).err(), Some(Failure::BadSignature));
    let unsigned = good.split_once("\r\nFrom:").map(|(_, r)| format!("From:{r}")).unwrap();
    assert_eq!(verify(unsigned.as_bytes(), &issuers).err(), Some(Failure::UntrustedIssuer));
}

#[test]
fn unix_line_endings_and_wsp_changes_in_relaxed_mode_still_verify() {
    let issuers = [issuer()];
    let lf = text("emails/noor-haddad.eml").replace("\r\n", "\n");
    assert!(verify(lf.as_bytes(), &issuers).is_ok());
    let spaced = text("emails/noor-haddad.eml").replace("Grade: Senior", "Grade:   Senior  ");
    assert!(verify(spaced.as_bytes(), &issuers).is_ok(), "relaxed body canonicalisation ignores wsp runs");
}

#[test]
fn a_different_trusted_key_or_selector_or_from_domain_is_not_enough() {
    let m = manifest();
    let i = &m["issuer"];
    let other = serde_json::from_slice::<Value>(&read("issuer.json")).unwrap();
    let o = &other["other_issuer"];
    let wrong = Issuer::from_spki_b64(i["domain"].as_str().unwrap(), i["selector"].as_str().unwrap(), o["rsa_pubkey_spki_b64"].as_str().unwrap()).unwrap();
    assert_eq!(verify(&read("emails/noor-haddad.eml"), &[wrong]).err(), Some(Failure::BadSignature));
    let wrong_sel = Issuer::from_spki_b64(i["domain"].as_str().unwrap(), "other", i["rsa_pubkey_spki_b64"].as_str().unwrap()).unwrap();
    assert_eq!(verify(&read("emails/noor-haddad.eml"), &[wrong_sel]).err(), Some(Failure::UntrustedIssuer));
    // From header domain different from d=: a trusted signature cannot vouch for another sender
    let spoof = text("emails/noor-haddad.eml").replace("From: Harbour Courier Payroll <payroll@harbourcourier.example>", "From: Harbour Courier Payroll <payroll@evil.example>");
    assert_eq!(verify(spoof.as_bytes(), &[issuer()]).err(), Some(Failure::UntrustedIssuer));
    assert!(Issuer::from_spki_b64("a.example", "s", "AAAA").is_err());
}

#[test]
fn payslip_parser_is_strict() {
    let ok = "Employee ID: HC-1\nGrade: Senior\nPeriod: 2026-10\nGross pay (month): EUR 5,833.33\n";
    assert!(payslip::parse(ok.as_bytes()).is_some());
    for bad in [
        ok.replace("EUR 5,833.33", "EUR 5833,33"),
        ok.replace("EUR 5,833.33", "EUR 58,33.33"),
        ok.replace("EUR 5,833.33", "USD 5,833.33"),
        ok.replace("2026-10", "2026-13"),
        ok.replace("HC-1", "HC|1"),
        format!("{ok}Grade: Chief\n"),
        ok.replace("Grade: Senior\n", ""),
    ] {
        assert!(payslip::parse(bad.as_bytes()).is_none(), "{bad}");
    }
    assert_eq!(payslip::parse(ok.replace("EUR 5,833.33", "EUR 5833.33").as_bytes()).unwrap().monthly_cents, 583_333);
    assert_eq!(canon::body(canon::Canon::Relaxed, b"a  b \r\n\r\n\r\n"), b"a b\r\n");
    assert_eq!(canon::body(canon::Canon::Simple, b""), b"\r\n");
}
