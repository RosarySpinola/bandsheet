// Builds an enclave input from the DKIM payslip fixtures (fixtures/dkim), entries sealed to the enclave key.
//
//   node enclave/scripts/make-dkim-input.mjs --pubkey <hex|b64> [--release 1|2] [--require-dkim true|false]
//        [--members N] [--negatives] [--history file] > input.json
//
// --members N     first N seeded members (default all 36); --release 2 adds Noor Haddad (the joiner)
// --negatives     also submit forged, untrusted, wrongkey, unsigned and duplicate emails
// Entries carry eml_b64; the policy carries trusted_issuers (from issuer.json) and require_dkim.
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "../..");
const require = createRequire(join(root, "packages/core/package.json"));
const { chacha20poly1305 } = await import(require.resolve("@noble/ciphers/chacha.js"));
const { x25519 } = await import(require.resolve("@noble/curves/ed25519.js"));
const { hkdf } = await import(require.resolve("@noble/hashes/hkdf.js"));
const { sha256 } = await import(require.resolve("@noble/hashes/sha2.js"));
const { randomBytes } = await import(require.resolve("@noble/hashes/utils.js"));

const args = {};
for (let i = 2; i < process.argv.length; i++) {
  if (!process.argv[i].startsWith("--")) continue;
  const next = process.argv[i + 1];
  args[process.argv[i].slice(2)] = next === undefined || next.startsWith("--") ? true : next;
}
if (!args.pubkey) {
  console.error("usage: make-dkim-input.mjs --pubkey <hex|b64> [--release 1|2] [--require-dkim true|false] [--members N] [--negatives] [--history file]");
  process.exit(2);
}
const pub = /^[0-9a-f]{64}$/i.test(args.pubkey) ? Buffer.from(args.pubkey, "hex") : Buffer.from(args.pubkey, "base64");
const b64 = (b) => Buffer.from(b).toString("base64");
const fx = (rel) => join(root, "fixtures/dkim", rel);

function seal(obj) {
  const esk = x25519.utils.randomSecretKey();
  const key = hkdf(sha256, x25519.getSharedSecret(esk, pub), new Uint8Array(0), new TextEncoder().encode("bandsheet-entry-v1"), 32);
  const nonce = randomBytes(12);
  const ct = chacha20poly1305(key, nonce).encrypt(new TextEncoder().encode(JSON.stringify(obj)));
  return { epk: b64(x25519.getPublicKey(esk)), nonce: b64(nonce), ct: b64(ct) };
}

const manifest = JSON.parse(readFileSync(fx("manifest.json"), "utf8"));
const release = Number(args.release ?? 1);
const requireDkim = args["require-dkim"] !== "false";
const seeded = manifest.members.filter((m) => !m.joiner).slice(0, Number(args.members ?? 36));
const people = release === 2 ? [...seeded, manifest.members.find((m) => m.joiner)] : seeded;
const T = 1762000000;
const eml = (rel) => readFileSync(fx(rel)).toString("base64");

const entries = people.map((m) => seal({ slot: m.slot, gross_annual_eur: m.gross_annual_eur, grade: m.grade, gender: m.gender, site: m.site, submitted_at: T, eml_b64: eml(m.eml) }));
if (args.negatives) for (const n of manifest.negatives) entries.push(seal({ ...n.claim, eml_b64: eml(n.eml) }));

const policy = { k: 3, require_dkim: requireDkim, trusted_issuers: [manifest.issuer] };
const history = args.history ? JSON.parse(readFileSync(args.history, "utf8")) : null;
process.stdout.write(JSON.stringify({ policy, query: { id: release, group_by: ["grade"], stat: "mean" }, entries, history }));
