//! Membership bitmaps for the history blob.

use crate::types::AuditError;
use base64::{engine::general_purpose::STANDARD, Engine};

pub fn encode_bits(bits: &[u8]) -> String {
    let mut bytes = vec![0u8; bits.len().div_ceil(8)];
    for (i, &b) in bits.iter().enumerate() {
        if b != 0 {
            bytes[i / 8] |= 1 << (i % 8);
        }
    }
    STANDARD.encode(bytes)
}

/// Decodes a bitmap that was written over `old_len` columns into a 0/1 vector of `new_len` columns.
pub fn decode_bits(s: &str, old_len: usize, new_len: usize) -> Result<Vec<u8>, AuditError> {
    let bytes = STANDARD.decode(s).map_err(|_| AuditError::BadHistory("row bitmap is not base64".into()))?;
    if bytes.len() != old_len.div_ceil(8) || new_len < old_len {
        return Err(AuditError::BadHistory("row bitmap has the wrong length".into()));
    }
    let mut out = vec![0u8; new_len];
    for (i, slot) in out.iter_mut().enumerate().take(old_len) {
        *slot = (bytes[i / 8] >> (i % 8)) & 1;
    }
    if (old_len..bytes.len() * 8).any(|i| (bytes[i / 8] >> (i % 8)) & 1 == 1) {
        return Err(AuditError::BadHistory("row bitmap sets bits past the last column".into()));
    }
    Ok(out)
}
