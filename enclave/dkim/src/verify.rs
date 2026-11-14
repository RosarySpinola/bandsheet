//! DKIM verification against caller-supplied issuer keys (no DNS). rsa-sha256 only.

use crate::canon::{self, Canon};
use crate::message::{self, Message};
use crate::sig;
use base64::{engine::general_purpose::STANDARD, Engine};
use rsa::{pkcs8::DecodePublicKey, traits::PublicKeyParts, Pkcs1v15Sign, RsaPublicKey};
use sha2::{Digest, Sha256};

pub struct Issuer {
    pub domain: String,
    pub selector: String,
    pub key: RsaPublicKey,
}

impl Issuer {
    /// `rsa_pubkey_spki_b64` is the DER SubjectPublicKeyInfo, base64 (what a DKIM record's `p=` holds).
    pub fn from_spki_b64(domain: &str, selector: &str, rsa_pubkey_spki_b64: &str) -> Result<Issuer, &'static str> {
        let der = STANDARD.decode(rsa_pubkey_spki_b64.trim()).map_err(|_| "issuer key is not base64")?;
        let key = RsaPublicKey::from_public_key_der(&der).map_err(|_| "issuer key is not an RSA SPKI")?;
        if !(1024..=4096).contains(&(key.size() * 8)) {
            return Err("issuer key must be 1024 to 4096 bits");
        }
        if domain.trim().is_empty() || selector.trim().is_empty() {
            return Err("issuer needs a domain and a selector");
        }
        Ok(Issuer { domain: domain.trim().to_ascii_lowercase(), selector: selector.trim().to_ascii_lowercase(), key })
    }
}

#[derive(Debug, PartialEq, Eq, Clone, Copy)]
pub enum Failure {
    /// No DKIM-Signature from a trusted domain and selector (or the From domain does not align with it).
    UntrustedIssuer,
    /// A signature from a trusted issuer exists but does not verify.
    BadSignature,
}

pub struct Verified {
    pub domain: String,
    pub selector: String,
    /// The signed body in relaxed canonical form: exactly the bytes whose hash the signature covers.
    pub body: Vec<u8>,
}

fn canon_pair(c: Option<&String>) -> Option<(Canon, Canon)> {
    let one = |s: &str| match s {
        "simple" => Some(Canon::Simple),
        "relaxed" => Some(Canon::Relaxed),
        _ => None,
    };
    match c.map(String::as_str).unwrap_or("simple/simple").split_once('/') {
        Some((h, b)) => Some((one(h)?, one(b)?)),
        None => Some((one(c.map(String::as_str).unwrap_or("simple"))?, Canon::Simple)),
    }
}

/// Domain of the single From header's address, lowercase.
fn from_domain(msg: &Message) -> Option<String> {
    let froms = msg.all("from");
    if froms.len() != 1 {
        return None;
    }
    let v = String::from_utf8_lossy(froms[0].value()).to_string();
    let addr = match (v.rfind('<'), v.rfind('>')) {
        (Some(a), Some(b)) if a < b => v[a + 1..b].to_string(),
        _ => v,
    };
    let dom = addr.rsplit_once('@')?.1.trim().to_ascii_lowercase();
    (!dom.is_empty()).then_some(dom)
}

fn check_one(msg: &Message, field: &message::Field, issuer: &Issuer) -> bool {
    let Some(sg) = sig::parse(field.value()) else { return false };
    let t = &sg.tags;
    if t.get("v").map(String::as_str) != Some("1") || t.get("a").map(String::as_str) != Some("rsa-sha256") || t.contains_key("l") {
        return false;
    }
    if t.get("q").is_some_and(|q| !q.eq_ignore_ascii_case("dns/txt")) {
        return false;
    }
    let Some((hc, bc)) = canon_pair(t.get("c")) else { return false };
    let (Some(h), Some(bh), Some(b)) = (t.get("h"), t.get("bh"), t.get("b")) else { return false };
    let names: Vec<String> = h.split(':').map(|n| n.trim().to_ascii_lowercase()).collect();
    if !names.iter().any(|n| n == "from") {
        return false;
    }
    let body_hash = Sha256::digest(canon::body(bc, &msg.body));
    if STANDARD.decode(bh).ok().as_deref() != Some(body_hash.as_slice()) {
        return false;
    }
    // Header data: each listed name picks the lowest not-yet-used instance; a missing one adds nothing.
    let mut used = vec![false; msg.fields.len()];
    let mut data = Vec::new();
    for n in &names {
        if let Some(i) = (0..msg.fields.len()).rev().find(|&i| !used[i] && msg.fields[i].name.eq_ignore_ascii_case(n)) {
            used[i] = true;
            data.extend(canon::header(hc, &msg.fields[i].raw));
        }
    }
    let mut own = field.raw[..field.raw.len() - field.value().len()].to_vec();
    own.extend_from_slice(&sg.value_without_b);
    let mut own = canon::header(hc, &own);
    own.truncate(own.len() - 2);
    data.extend(own);
    let Ok(sigbytes) = STANDARD.decode(b) else { return false };
    issuer.key.verify(Pkcs1v15Sign::new::<Sha256>(), &Sha256::digest(&data), &sigbytes).is_ok()
}

/// Verifies `raw` (an .eml) against the trusted issuers. The first signature that verifies wins.
pub fn verify(raw: &[u8], issuers: &[Issuer]) -> Result<Verified, Failure> {
    let msg = message::parse(raw);
    let from = from_domain(&msg);
    let mut trusted_seen = false;
    for field in msg.all("dkim-signature") {
        let Some(parsed) = sig::parse(field.value()) else { continue };
        let (Some(d), Some(s)) = (parsed.tags.get("d"), parsed.tags.get("s")) else { continue };
        let (d, s) = (d.to_ascii_lowercase(), s.to_ascii_lowercase());
        let Some(issuer) = issuers.iter().find(|i| i.domain == d && i.selector == s) else { continue };
        if from.as_deref() != Some(d.as_str()) {
            continue; // not aligned: the signer is not who the email claims to be from
        }
        trusted_seen = true;
        if check_one(&msg, field, issuer) {
            return Ok(Verified { domain: d, selector: s, body: canon::body(Canon::Relaxed, &msg.body) });
        }
    }
    Err(if trusted_seen { Failure::BadSignature } else { Failure::UntrustedIssuer })
}
