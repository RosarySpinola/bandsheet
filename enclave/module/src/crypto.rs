//! Sealed boxes: X25519 ephemeral ECDH -> HKDF-SHA256 -> ChaCha20-Poly1305.
//! Matches packages/core/CRYPTO.md byte for byte (info "bandsheet-entry-v1", empty salt, no AAD).
//! The history blob uses the same construction with its own info string, so a blob made for one
//! purpose can never be opened as the other.

use base64::{engine::general_purpose::STANDARD, Engine};
use chacha20poly1305::{aead::{Aead, KeyInit}, ChaCha20Poly1305, Nonce};
use hkdf::Hkdf;
use serde::{Deserialize, Serialize};
use sha2::Sha256;
use x25519_dalek::{PublicKey, StaticSecret};

pub const INFO_ENTRY: &[u8] = b"bandsheet-entry-v1";
pub const INFO_HISTORY: &[u8] = b"bandsheet-history-v1";
const SEED_INFO: &[u8] = b"bandsheet-enclave-x25519-from-seed-v1";

/// `{"epk","nonce","ct"}`, every field standard base64 with padding.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct Envelope {
    pub epk: String,
    pub nonce: String,
    pub ct: String,
}

#[derive(Debug, PartialEq, Eq)]
pub enum CryptoError {
    Format(&'static str),
    Open,
    Random,
}

impl std::fmt::Display for CryptoError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            CryptoError::Format(m) => write!(f, "{m}"),
            CryptoError::Open => write!(f, "could not decrypt (wrong key, wrong purpose or tampered)"),
            CryptoError::Random => write!(f, "no randomness available"),
        }
    }
}

fn derive_key(shared: &[u8; 32], info: &[u8]) -> [u8; 32] {
    let mut key = [0u8; 32];
    Hkdf::<Sha256>::new(None, shared).expand(info, &mut key).expect("32 bytes is a valid HKDF length");
    key
}

pub fn public_key(sk: &[u8; 32]) -> [u8; 32] {
    PublicKey::from(&StaticSecret::from(*sk)).to_bytes()
}

/// Enclave scalar derived from a TEE-generated seed.
pub fn secret_from_seed(seed: &[u8]) -> [u8; 32] {
    let mut sk = [0u8; 32];
    Hkdf::<Sha256>::new(None, seed).expand(SEED_INFO, &mut sk).expect("32 bytes is a valid HKDF length");
    sk
}

pub fn seal(info: &[u8], recipient: &[u8; 32], plaintext: &[u8]) -> Result<Envelope, CryptoError> {
    let mut esk = [0u8; 32];
    let mut nonce = [0u8; 12];
    getrandom::fill(&mut esk).map_err(|_| CryptoError::Random)?;
    getrandom::fill(&mut nonce).map_err(|_| CryptoError::Random)?;
    seal_with(info, recipient, plaintext, &esk, &nonce)
}

/// Deterministic core, exposed so tests and the cross-language vector can pin every input.
pub fn seal_with(info: &[u8], recipient: &[u8; 32], plaintext: &[u8], esk: &[u8; 32], nonce: &[u8; 12]) -> Result<Envelope, CryptoError> {
    let secret = StaticSecret::from(*esk);
    let epk = PublicKey::from(&secret).to_bytes();
    let shared = secret.diffie_hellman(&PublicKey::from(*recipient));
    if !shared.was_contributory() {
        return Err(CryptoError::Format("recipient key is a low-order point"));
    }
    let key = derive_key(shared.as_bytes(), info);
    let ct = ChaCha20Poly1305::new((&key).into())
        .encrypt(Nonce::from_slice(nonce), plaintext)
        .map_err(|_| CryptoError::Open)?;
    Ok(Envelope { epk: STANDARD.encode(epk), nonce: STANDARD.encode(nonce), ct: STANDARD.encode(ct) })
}

fn fixed<const N: usize>(s: &str, what: &'static str) -> Result<[u8; N], CryptoError> {
    STANDARD.decode(s).map_err(|_| CryptoError::Format(what))?.try_into().map_err(|_| CryptoError::Format(what))
}

pub fn open(info: &[u8], sk: &[u8; 32], env: &Envelope) -> Result<Vec<u8>, CryptoError> {
    let epk: [u8; 32] = fixed(&env.epk, "epk must be 32 bytes of base64")?;
    let nonce: [u8; 12] = fixed(&env.nonce, "nonce must be 12 bytes of base64")?;
    let ct = STANDARD.decode(&env.ct).map_err(|_| CryptoError::Format("ct is not base64"))?;
    let shared = StaticSecret::from(*sk).diffie_hellman(&PublicKey::from(epk));
    if !shared.was_contributory() {
        return Err(CryptoError::Open);
    }
    let key = derive_key(shared.as_bytes(), info);
    ChaCha20Poly1305::new((&key).into()).decrypt(Nonce::from_slice(&nonce), ct.as_slice()).map_err(|_| CryptoError::Open)
}
