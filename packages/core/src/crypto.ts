import { chacha20poly1305 } from "@noble/ciphers/chacha.js";
import { x25519 } from "@noble/curves/ed25519.js";
import { hkdf } from "@noble/hashes/hkdf.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { randomBytes } from "@noble/hashes/utils.js";
import { CRYPTO_INFO, CRYPTO_SALT, KEY_LEN, NONCE_LEN } from "./constants";
import { type Ciphertext, type Entry, EntrySchema } from "./schemas";

const enc = new TextEncoder();
const dec = new TextDecoder();

/* Runtime-neutral (browser + Node): no Buffer. */
export function toB64(b: Uint8Array): string {
  let s = "";
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s);
}
export function fromB64(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
export function fromHex(s: string): Uint8Array {
  const h = s.replace(/^0x/i, "");
  if (h.length % 2 !== 0 || /[^0-9a-f]/i.test(h)) throw new Error("invalid hex");
  const out = new Uint8Array(h.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16);
  return out;
}

function deriveKey(shared: Uint8Array): Uint8Array {
  return hkdf(sha256, shared, CRYPTO_SALT, enc.encode(CRYPTO_INFO), KEY_LEN);
}

/** Generate an X25519 keypair (the enclave does this once; tests and scripts reuse it). */
export function generateX25519Keypair(): { secretKey: Uint8Array; publicKey: Uint8Array } {
  const secretKey = x25519.utils.randomSecretKey();
  return { secretKey, publicKey: x25519.getPublicKey(secretKey) };
}

/** Encrypt a plaintext to the enclave public key. Fresh ephemeral key and nonce per call. */
export function encryptBytes(enclavePublicKey: Uint8Array, plaintext: Uint8Array): Ciphertext {
  const esk = x25519.utils.randomSecretKey();
  const epk = x25519.getPublicKey(esk);
  const key = deriveKey(x25519.getSharedSecret(esk, enclavePublicKey));
  const nonce = randomBytes(NONCE_LEN);
  const ct = chacha20poly1305(key, nonce).encrypt(plaintext);
  return { epk: toB64(epk), nonce: toB64(nonce), ct: toB64(ct) };
}

export function decryptBytes(enclaveSecretKey: Uint8Array, c: Ciphertext): Uint8Array {
  const key = deriveKey(x25519.getSharedSecret(enclaveSecretKey, fromB64(c.epk)));
  return chacha20poly1305(key, fromB64(c.nonce)).decrypt(fromB64(c.ct));
}

/** Validates the entry, then encrypts its JSON to the enclave key. */
export function encryptEntry(enclavePublicKey: Uint8Array, entry: Entry): Ciphertext {
  const valid = EntrySchema.parse(entry);
  return encryptBytes(enclavePublicKey, enc.encode(JSON.stringify(valid)));
}

export function decryptEntry(enclaveSecretKey: Uint8Array, c: Ciphertext): Entry {
  return EntrySchema.parse(JSON.parse(dec.decode(decryptBytes(enclaveSecretKey, c))));
}

/** Accepts the enclave public key as 64-char hex or base64. */
export function parseEnclavePublicKey(s: string): Uint8Array {
  const raw = /^[0-9a-f]{64}$/i.test(s) ? fromHex(s) : fromB64(s);
  if (raw.length !== 32) throw new Error("enclave public key must be 32 bytes");
  return raw;
}
