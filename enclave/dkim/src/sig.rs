//! The DKIM-Signature tag list (RFC 6376 section 3.2 and 3.5).

use std::collections::BTreeMap;

pub struct Signature {
    pub tags: BTreeMap<String, String>,
    /// The header value with the `b=` value removed (the `b=` itself stays), for hashing.
    pub value_without_b: Vec<u8>,
}

fn is_fws(b: u8) -> bool {
    matches!(b, b' ' | b'\t' | b'\r' | b'\n')
}

/// Returns None for a malformed list (duplicate tag, missing `=`, non-UTF-8).
pub fn parse(value: &[u8]) -> Option<Signature> {
    let mut tags = BTreeMap::new();
    let mut stripped = Vec::with_capacity(value.len());
    let mut at = 0;
    for seg in value.split(|&b| b == b';') {
        at += seg.len() + 1;
        let is_last = at > value.len();
        if seg.iter().all(|&b| is_fws(b)) {
            stripped.extend_from_slice(seg);
            if !is_last {
                stripped.push(b';');
            }
            continue;
        }
        let eq = seg.iter().position(|&b| b == b'=')?;
        let name = std::str::from_utf8(&seg[..eq]).ok()?.trim().to_ascii_lowercase();
        let mut val: String = std::str::from_utf8(&seg[eq + 1..]).ok()?.trim_matches(|c: char| c.is_ascii_whitespace()).to_string();
        if name == "b" || name == "bh" {
            val.retain(|c| !c.is_ascii_whitespace());
        }
        if tags.insert(name.clone(), val).is_some() {
            return None;
        }
        if name == "b" {
            // keep everything up to and including '=' and the folding space before the value
            let mut keep = eq + 1;
            while keep < seg.len() && is_fws(seg[keep]) {
                keep += 1;
            }
            let mut end = seg.len();
            while end > keep && is_fws(seg[end - 1]) {
                end -= 1;
            }
            stripped.extend_from_slice(&seg[..keep]);
            stripped.extend_from_slice(&seg[end..]);
        } else {
            stripped.extend_from_slice(seg);
        }
        if !is_last {
            stripped.push(b';');
        }
    }
    Some(Signature { tags, value_without_b: stripped })
}
