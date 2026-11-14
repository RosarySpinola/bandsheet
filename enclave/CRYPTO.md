# Enclave crypto (matches packages/core/CRYPTO.md)

Scheme: X25519 ECDH with an ephemeral sender key -> HKDF-SHA256 -> ChaCha20-Poly1305 (RFC 8439).

| Constant | Entries (members -> enclave) | History blob (enclave -> enclave) |
|---|---|---|
| HKDF hash | SHA-256 | SHA-256 |
| HKDF salt | empty (`Hkdf::new(None, ikm)`, same as noble `new Uint8Array(0)`) | empty |
| HKDF info | ASCII `bandsheet-entry-v1` | ASCII `bandsheet-history-v1` |
| IKM | 32-byte raw X25519 shared secret | same |
| Derived key | 32 bytes | 32 bytes |
| Nonce | 12 random bytes | 12 random bytes |
| AEAD associated data | none | none |

Wire format: JSON `{"epk","nonce","ct"}`, each standard base64 with padding. `ct` = ciphertext || 16-byte
Poly1305 tag. `epk` is the sender's ephemeral X25519 public key (32 bytes). The enclave public key is 32 raw bytes.

In the enclave input an entry (and the history) may be that JSON object, or a base64 string of that JSON.

Entry plaintext: UTF-8 JSON `{"slot","gross_annual_eur","grade","gender","site","submitted_at"}`.
The history blob is opaque to everyone except the enclave (it is encrypted to the enclave's own public
key); pass `output.history` back as `input.history` unchanged. It contains membership bitmaps and
group labels only, never a pay value.

The two infos differ on purpose: a history blob can never be accepted as an entry or the reverse.

## Enclave key

The X25519 private key exists only as an OutLayer secret inside the TEE. Two sources, in this order:

1. `PROTECTED_ENCLAVE_SEED` generated inside the TEE (`secrets set --generate PROTECTED_ENCLAVE_SEED:hex32`).
   Nobody, including the deployer, ever sees it. The scalar is `HKDF-SHA256(ikm = seed bytes, salt = empty,
   info = "bandsheet-enclave-x25519-from-seed-v1")`, 32 bytes.
2. `ENCLAVE_X25519_SK`, 64 hex characters, the scalar itself (fallback and test seam).

The public key comes from the module itself: invoke `{"op":"pubkey"}`; the reply has `pubkey_hex` and `pubkey_b64`.
That value goes into the contract policy; the server encrypts every entry to it.

## Cross-language check

`test-vectors/entry-v1.json` was made by TypeScript (`@noble`, same derivation as `packages/core/src/crypto.ts`)
with fixed test keys. `cargo test` proves Rust opens it and reproduces the exact ciphertext bytes. The same
test writes `test-vectors/rust-sealed.json`; `node test-vectors/crosscheck.mjs verify` proves TypeScript opens a
Rust-sealed entry. Both directions run under `make test`.
