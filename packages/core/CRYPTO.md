# Entry encryption (Bandsheet)

Scheme: X25519 ECDH (ephemeral sender key) -> HKDF-SHA256 -> ChaCha20-Poly1305 (RFC 8439).

| Constant | Value |
|---|---|
| HKDF hash | SHA-256 |
| HKDF salt | empty (RFC 5869: HashLen zero bytes; Rust `Hkdf::new(None, ikm)`) |
| HKDF info | ASCII `bandsheet-entry-v1` |
| Derived key | 32 bytes |
| Nonce | 12 random bytes per entry |
| AEAD associated data | none |
| IKM | 32-byte raw X25519 shared secret (`x25519(esk, enclave_pub)`) |

Wire format: JSON `{"epk","nonce","ct"}`, each standard base64 (with padding).
`epk` = ephemeral X25519 public key (32 bytes); `ct` = ciphertext || 16-byte Poly1305 tag.
The enclave public key is 32 raw bytes; accepted by the helpers as 64 hex chars or base64.
Plaintext = UTF-8 JSON of the Entry (see `schemas.ts`).

Source of truth in code: `src/constants.ts`. Test: `test/core.test.ts`.
If `enclave/CRYPTO.md` differs, the enclave worker and this file must be reconciled.
