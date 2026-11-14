// Builds enclave input JSON for the hero scenario (synthetic data: "Harbour Courier newsroom chapel").
//
//   node enclave/scripts/make-input.mjs --pubkey <64 hex or base64> --release 1
//   node enclave/scripts/make-input.mjs --pubkey <..> --release 2 --history <file holding the history envelope JSON>
//
// Release 1: 36 members. Release 2: the same 36 plus a Senior at EUR 70,000. Encryption follows
// packages/core/CRYPTO.md (same @noble primitives as packages/core/src/crypto.ts).
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(join(here, "../../packages/core/package.json"));
const { chacha20poly1305 } = await import(require.resolve("@noble/ciphers/chacha.js"));
const { x25519 } = await import(require.resolve("@noble/curves/ed25519.js"));
const { hkdf } = await import(require.resolve("@noble/hashes/hkdf.js"));
const { sha256 } = await import(require.resolve("@noble/hashes/sha2.js"));
const { randomBytes } = await import(require.resolve("@noble/hashes/utils.js"));

const args = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, all) => (x.startsWith("--") ? [...a, [x.slice(2), all[i + 1]]] : a), []));
if (!args.pubkey || !["1", "2"].includes(args.release)) {
  console.error("usage: make-input.mjs --pubkey <hex|b64> --release 1|2 [--history file]");
  process.exit(2);
}
const pub = /^[0-9a-f]{64}$/i.test(args.pubkey) ? Buffer.from(args.pubkey, "hex") : Buffer.from(args.pubkey, "base64");
const b64 = (b) => Buffer.from(b).toString("base64");

function seal(obj) {
  const esk = x25519.utils.randomSecretKey();
  const key = hkdf(sha256, x25519.getSharedSecret(esk, pub), new Uint8Array(0), new TextEncoder().encode("bandsheet-entry-v1"), 32);
  const nonce = randomBytes(12);
  const ct = chacha20poly1305(key, nonce).encrypt(new TextEncoder().encode(JSON.stringify(obj)));
  return { epk: b64(x25519.getPublicKey(esk)), nonce: b64(nonce), ct: b64(ct) };
}

const slot = (name) => createHash("sha256").update(`harbour-courier-chapel/${name}`).digest("hex");
const T = 1763078400;
// grade, head count, base pay (EUR); the 12 Seniors sum to exactly 815,976 so every mean is whole euros.
const spec = [["Junior", 8, 28_400, 800], ["Reporter", 11, 38_500, 1_150], ["Senior", 12, 58_000, 1_700], ["Editor", 4, 66_000, 5_400], ["Chief", 1, 112_000, 0]];
const people = [];
for (const [grade, n, base, step] of spec) {
  for (let i = 0; i < n; i++) {
    people.push({ name: `${grade}-${i}`, grade, pay: base + step * i, gender: ["F", "M", "F", "X"][people.length % 4], site: people.length % 3 === 0 ? "Port" : "City" });
  }
}
const seniors = people.filter((p) => p.grade === "Senior");
seniors[11].pay = 815_976 - seniors.slice(0, 11).reduce((s, p) => s + p.pay, 0);
if (args.release === "2") people.push({ name: "Senior-joiner", grade: "Senior", pay: 70_000, gender: "F", site: "City" });

const entries = people.map((p) => seal({ slot: slot(p.name), gross_annual_eur: p.pay, grade: p.grade, gender: p.gender, site: p.site, submitted_at: T }));
const history = args.history ? JSON.parse(readFileSync(args.history, "utf8")) : null;
const input = { policy: { k: 3 }, query: { id: Number(args.release), group_by: ["grade"], stat: "mean" }, entries, history };
process.stdout.write(JSON.stringify(input));
