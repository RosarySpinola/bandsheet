//! RFC 6376 section 3.4 canonicalisation, plus the line-ending normalisation applied before parsing.

pub const CRLF: &[u8] = b"\r\n";

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Canon {
    Simple,
    Relaxed,
}

fn is_wsp(b: u8) -> bool {
    b == b' ' || b == b'\t'
}

/// A bare LF becomes CRLF (an .eml saved on Unix has them). Everything else is untouched.
pub fn normalise_newlines(raw: &[u8]) -> Vec<u8> {
    let mut out = Vec::with_capacity(raw.len() + 64);
    let mut prev = 0u8;
    for &b in raw {
        if b == b'\n' && prev != b'\r' {
            out.push(b'\r');
        }
        out.push(b);
        prev = b;
    }
    out
}

fn split_lines(body: &[u8]) -> Vec<&[u8]> {
    let mut lines = Vec::new();
    let mut start = 0;
    let mut i = 0;
    while i + 1 < body.len() {
        if body[i] == b'\r' && body[i + 1] == b'\n' {
            lines.push(&body[start..i]);
            start = i + 2;
            i += 2;
        } else {
            i += 1;
        }
    }
    if start < body.len() {
        lines.push(&body[start..]);
    }
    lines
}

/// Body canonicalisation. An empty body is "" for relaxed and CRLF for simple.
pub fn body(canon: Canon, raw: &[u8]) -> Vec<u8> {
    let mut lines: Vec<Vec<u8>> = split_lines(raw)
        .into_iter()
        .map(|l| match canon {
            Canon::Simple => l.to_vec(),
            Canon::Relaxed => {
                let mut out = Vec::with_capacity(l.len());
                for &b in l {
                    if is_wsp(b) {
                        if out.last().is_some_and(|&p| p != b' ') {
                            out.push(b' ');
                        }
                    } else {
                        out.push(b);
                    }
                }
                while out.last() == Some(&b' ') {
                    out.pop();
                }
                out
            }
        })
        .collect();
    while lines.last().is_some_and(|l| l.is_empty()) {
        lines.pop();
    }
    if lines.is_empty() {
        return if canon == Canon::Simple { CRLF.to_vec() } else { Vec::new() };
    }
    let mut out = Vec::new();
    for l in lines {
        out.extend_from_slice(&l);
        out.extend_from_slice(CRLF);
    }
    out
}

/// Header canonicalisation of one field; `raw` is the field as it appears (name, colon, value, folds
/// inside, no final CRLF). The result ends with CRLF.
pub fn header(canon: Canon, raw: &[u8]) -> Vec<u8> {
    match canon {
        Canon::Simple => [raw, CRLF].concat(),
        Canon::Relaxed => {
            let colon = raw.iter().position(|&b| b == b':').unwrap_or(raw.len());
            let name: Vec<u8> = raw[..colon].iter().filter(|b| !is_wsp(**b)).map(u8::to_ascii_lowercase).collect();
            let value = raw.get(colon + 1..).unwrap_or(&[]);
            let mut v: Vec<u8> = Vec::with_capacity(value.len());
            for &b in value.iter().filter(|b| **b != b'\r' && **b != b'\n') {
                if is_wsp(b) {
                    if v.last().is_some_and(|&p| p != b' ') {
                        v.push(b' ');
                    }
                } else {
                    v.push(b);
                }
            }
            while v.last() == Some(&b' ') {
                v.pop();
            }
            let mut out = name;
            out.push(b':');
            out.extend_from_slice(&v);
            out.extend_from_slice(CRLF);
            out
        }
    }
}
