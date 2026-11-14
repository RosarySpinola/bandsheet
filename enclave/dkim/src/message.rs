//! Splits a raw RFC 5322 message into header fields and body. No MIME decoding: DKIM signs raw bytes.

use crate::canon::normalise_newlines;

#[derive(Debug, Clone)]
pub struct Field {
    /// Name as written, without the colon.
    pub name: String,
    /// The whole field as written: name, colon, value, with any folding CRLFs, no final CRLF.
    pub raw: Vec<u8>,
}

impl Field {
    /// The value after the first colon (folding whitespace kept).
    pub fn value(&self) -> &[u8] {
        let at = self.raw.iter().position(|&b| b == b':').map_or(self.raw.len(), |i| i + 1);
        &self.raw[at..]
    }
}

pub struct Message {
    pub fields: Vec<Field>,
    pub body: Vec<u8>,
}

fn find(hay: &[u8], needle: &[u8]) -> Option<usize> {
    hay.windows(needle.len()).position(|w| w == needle)
}

pub fn parse(raw: &[u8]) -> Message {
    let raw = normalise_newlines(raw);
    let (head, body) = if raw.starts_with(b"\r\n") {
        (&raw[..0], raw[2..].to_vec())
    } else {
        match find(&raw, b"\r\n\r\n") {
            Some(i) => (&raw[..i], raw[i + 4..].to_vec()),
            None => (&raw[..], Vec::new()),
        }
    };
    let mut fields: Vec<Field> = Vec::new();
    let mut lines = head.split(|&b| b == b'\n').map(|l| l.strip_suffix(b"\r").unwrap_or(l));
    for line in &mut lines {
        if line.first().is_some_and(|b| *b == b' ' || *b == b'\t') {
            if let Some(f) = fields.last_mut() {
                f.raw.extend_from_slice(b"\r\n");
                f.raw.extend_from_slice(line);
            }
            continue;
        }
        let Some(colon) = line.iter().position(|&b| b == b':') else { continue };
        let name = String::from_utf8_lossy(&line[..colon]).trim().to_string();
        fields.push(Field { name, raw: line.to_vec() });
    }
    Message { fields, body }
}

impl Message {
    /// All fields with this name (case-insensitive), top to bottom.
    pub fn all(&self, name: &str) -> Vec<&Field> {
        self.fields.iter().filter(|f| f.name.eq_ignore_ascii_case(name)).collect()
    }
}
