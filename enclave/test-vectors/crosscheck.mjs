// Cross-language check of the entry encryption (packages/core/CRYPTO.md), TypeScript side.
// Uses the same @noble primitives and the same derivation as packages/core/src/crypto.ts.
//
//   node enclave/test-vectors/crosscheck.mjs write    # (re)write entry-v1.json (the TypeScript-made vector)
//   node enclave/test-vectors/crosscheck.mjs verify   # TS decrypts the vector Rust made (rust-sealed.json)
//
// The Rust test `cross_language` checks entry-v1.json (TS -> Rust) and (re)writes rust-sealed.json
// (Rust -> TS). Run `verify` after `cargo test`.
import { createRequire } from "node:module";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(join(here, "../../packages/core/package.json"));
const { chacha20poly1305 } = await import(require.resolve("@noble/ciphers/chacha.js"));
const { x25519 } = await import(require.resolve("@noble/curves/ed25519.js"));
const { hkdf } = await import(require.resolve("@noble/hashes/hkdf.js"));
const { sha256 } = await import(require.resolve("@noble/hashes/sha2.js"));

const INFO = "bandsheet-entry-v1"; // packages/core/src/constants.ts CRYPTO_INFO
const SALT = new Uint8Array(0);
const hex = (b) => Buffer.from(b).toString("hex");
const unhex = (s) => new Uint8Array(Buffer.from(s, "hex"));
const b64 = (b) => Buffer.from(b).toString("base64");
const unb64 = (s) => new Uint8Array(Buffer.from(s, "base64"));
const key = (shared) => hkdf(sha256, shared, SALT, new TextEncoder().encode(INFO), 32);

const mode = process.argv[2];
if (mode === "write") {
  const sk = Uint8Array.from({ length: 32 }, (_, i) => i + 1);
  const esk = Uint8Array.from({ length: 32 }, (_, i) => 0xa0 + i);
  const nonce = Uint8Array.from({ length: 12 }, (_, i) => 0x10 + i);
  const plaintext = JSON.stringify({
    slot: "00".repeat(31) + "2a",
    gross_annual_eur: 70000,
    grade: "Senior",
    gender: "F",
    site: "City",
    submitted_at: 1763078400,
  });
  const pk = x25519.getPublicKey(sk);
  const k = key(x25519.getSharedSecret(esk, pk));
  const ct = chacha20poly1305(k, nonce).encrypt(new TextEncoder().encode(plaintext));
  const vector = {
    note: "Made by TypeScript (@noble) with fixed keys. Test keys only; never used for real data.",
    enclave_sk_hex: hex(sk),
    enclave_pk_hex: hex(pk),
    esk_hex: hex(esk),
    nonce_hex: hex(nonce),
    plaintext,
    envelope: { epk: b64(x25519.getPublicKey(esk)), nonce: b64(nonce), ct: b64(ct) },
  };
  writeFileSync(join(here, "entry-v1.json"), JSON.stringify(vector, null, 2) + "\n");
  console.log("wrote entry-v1.json");
} else if (mode === "verify") {
  const v = JSON.parse(readFileSync(join(here, "rust-sealed.json"), "utf8"));
  const sk = unhex(v.enclave_sk_hex);
  const e = v.envelope;
  const k = key(x25519.getSharedSecret(sk, unb64(e.epk)));
  const plain = new TextDecoder().decode(chacha20poly1305(k, unb64(e.nonce)).decrypt(unb64(e.ct)));
  if (plain !== v.plaintext) throw new Error("decrypted text differs");
  console.log("OK: TypeScript decrypted the Rust-sealed entry");
} else {
  console.error("usage: crosscheck.mjs write|verify");
  process.exit(2);
}
