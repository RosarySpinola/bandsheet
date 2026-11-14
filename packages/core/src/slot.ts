import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";

const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

export function base58Decode(s: string): Uint8Array {
  let n = 0n;
  for (const ch of s) {
    const i = B58.indexOf(ch);
    if (i < 0) throw new Error("invalid base58 character");
    n = n * 58n + BigInt(i);
  }
  const bytes: number[] = [];
  while (n > 0n) {
    bytes.unshift(Number(n & 0xffn));
    n >>= 8n;
  }
  for (const ch of s) {
    if (ch !== "1") break;
    bytes.unshift(0);
  }
  return Uint8Array.from(bytes);
}

/** Slot id = hex(sha256(ed25519 public key bytes)). */
export function slotIdFromPublicKey(pub: Uint8Array): string {
  if (pub.length !== 32) throw new Error("ed25519 public key must be 32 bytes");
  return bytesToHex(sha256(pub));
}

/** Accepts a NEAR-style "ed25519:<base58>" public key string. */
export function slotIdFromNearPublicKey(key: string): string {
  const m = /^ed25519:(.+)$/.exec(key);
  if (!m) throw new Error('expected "ed25519:<base58>" public key');
  return slotIdFromPublicKey(base58Decode(m[1]!));
}
