//! The enclave's X25519 key, read from OutLayer secrets (environment variables inside the TEE).
//!
//! `PROTECTED_ENCLAVE_SEED`  generated inside the TEE (`--generate PROTECTED_ENCLAVE_SEED:hex32`);
//!                           nobody, including the deployer, ever sees it. The scalar derives from it.
//! `ENCLAVE_X25519_SK`       64 hex chars: the scalar itself (fallback, and the test seam).

use crate::crypto::{public_key, secret_from_seed};

pub struct EnclaveKey {
    pub secret: [u8; 32],
    pub public: [u8; 32],
    pub source: &'static str,
}

pub fn load(get: &dyn Fn(&str) -> Option<String>) -> Result<EnclaveKey, String> {
    if let Some(v) = get("PROTECTED_ENCLAVE_SEED").filter(|v| !v.trim().is_empty()) {
        let seed = hex::decode(v.trim()).unwrap_or_else(|_| v.trim().as_bytes().to_vec());
        if seed.len() < 16 {
            return Err("PROTECTED_ENCLAVE_SEED is too short".into());
        }
        let secret = secret_from_seed(&seed);
        return Ok(EnclaveKey { secret, public: public_key(&secret), source: "PROTECTED_ENCLAVE_SEED" });
    }
    if let Some(v) = get("ENCLAVE_X25519_SK").filter(|v| !v.trim().is_empty()) {
        let bytes: [u8; 32] = hex::decode(v.trim())
            .ok()
            .and_then(|b| b.try_into().ok())
            .ok_or("ENCLAVE_X25519_SK must be 64 hex characters")?;
        return Ok(EnclaveKey { secret: bytes, public: public_key(&bytes), source: "ENCLAVE_X25519_SK" });
    }
    Err("enclave key missing: set the secret PROTECTED_ENCLAVE_SEED or ENCLAVE_X25519_SK".into())
}
