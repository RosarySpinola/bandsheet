/**
 * Live check of /api/auth on a deployed Bandsheet (testnet only). Spends a little of the owner's testnet gas.
 * Usage: BANDSHEET_KEYS_DIR=<repo>/keys tsx server/scripts/auth-live.ts https://wallet.bandsheet.pages.dev
 *
 *  1. refusals (no gas): malformed body, wrong recipient, a key that is not on an existing account
 *  2. join as an unfunded implicit account (the NEAR Auth case) with a NEP-413 signature -> add_members tx
 *  3. replay of the same signed join -> NONCE_USED
 *  4. submit a sealed synthetic entry with the new member key (gas-free) -> tx read back on RPC
 *  5. bind that entry (NEP-413 "Bandsheet entry: <sha256>") -> recorded
 *  6. join as an existing full-access account (the owner account) -> view_access_key FullAccess path
 *  7. re-join the implicit account with a new key -> old key revoked, new key added
 *  8. cleanup: the owner revokes every member key this run added, so the chapel's member count is unchanged
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { KeyPair, KeyPairSigner, type KeyPairString } from "near-api-js";
import { encryptEntry, parseEnclavePublicKey, slotIdFromNearPublicKey } from "@bandsheet/core";
import { TESTNET_RPCS, generateMemberKey, makeProvider, submitEntry, viewCall } from "@bandsheet/core/near";
import { createChainPort } from "../src/chain/port";

const BASE = (process.argv[2] ?? "").replace(/\/$/, "");
if (!/^https:\/\/[a-z0-9.-]+\.pages\.dev$/.test(BASE) && !BASE.startsWith("http://localhost")) throw new Error("usage: auth-live.ts <preview URL>");
const UNIT = "bandsheet-3f36b7.testnet";
const KEYS = process.env.BANDSHEET_KEYS_DIR ?? resolve(import.meta.dirname, "../../keys");
const owner = JSON.parse(readFileSync(resolve(KEYS, "owner", `${JSON.parse(readFileSync(resolve(import.meta.dirname, "../../scripts/deployed.json"), "utf8")).owner}.json`), "utf8")) as { account_id: string; private_key: KeyPairString };

const out = (s: string) => void process.stdout.write(`${s}\n`);
const results: { step: string; pass: boolean; detail: string }[] = [];
const check = (step: string, pass: boolean, detail: string) => {
  results.push({ step, pass, detail });
  out(`${pass ? "PASS" : "FAIL"}  ${step}  ${detail}`);
};

async function post(path: string, body: unknown): Promise<{ status: number; body: Record<string, unknown> }> {
  const res = await fetch(`${BASE}/api/auth/${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  return { status: res.status, body: (await res.json().catch(() => ({}))) as Record<string, unknown> };
}
const nonce = async (purpose: "join" | "entry") => String((await post("nonce", { purpose })).body.nonce);
const nb = (n: string) => Uint8Array.from(Buffer.from(n, "base64url"));

async function sign(kp: KeyPair, accountId: string, message: string, n: string, recipient = UNIT) {
  const s = await new KeyPairSigner(kp).signNep413Message(accountId, { message, recipient, nonce: nb(n) });
  return { scheme: "nep413", account_id: accountId, public_key: kp.getPublicKey().toString(), signature: Buffer.from(s.signature).toString("base64"), nonce: n };
}
const joinBody = async (kp: KeyPair, accountId: string, mk: string, recipient = UNIT) =>
  ({ ...(await sign(kp, accountId, `Bandsheet join: ${mk}`, await nonce("join"), recipient)), member_public_key: mk, method: "near-connect" });

const added: string[] = [];
const user = KeyPair.fromRandom("ed25519");
const implicit = Buffer.from(user.getPublicKey().data).toString("hex");
out(`run account (implicit, unfunded): ${implicit}`);

// 1. refusals
check("malformed body", (await post("join", { scheme: "nep413" })).body.code === "BAD_REQUEST", "BAD_REQUEST");
const wr = await post("join", await joinBody(user, implicit, generateMemberKey().publicKey, "evil-app.testnet"));
check("wrong recipient refused", wr.body.code === "SIGNATURE_INVALID", `${wr.status} ${String(wr.body.code)}`);
const stranger = KeyPair.fromRandom("ed25519");
const nk = await post("join", await joinBody(stranger, "bs-guest-3f36b7.testnet", generateMemberKey().publicKey));
check("key not on an existing account refused", nk.body.code === "KEY_NOT_ON_ACCOUNT", `${nk.status} ${String(nk.body.code)}`);

// 2. join (implicit, unfunded)
const m1 = generateMemberKey();
const body1 = await joinBody(user, implicit, m1.publicKey);
const j1 = await post("join", body1);
const tx1 = (j1.body.tx as { hash?: string } | undefined)?.hash;
check("join as unfunded implicit account", j1.status === 200 && j1.body.slot === m1.slot && Boolean(tx1), `${j1.status} add_members tx ${tx1 ?? String(j1.body.code)}`);
if (j1.status === 200) added.push(m1.publicKey);

// 3. replay
const rp = await post("join", body1);
check("replayed nonce refused", rp.body.code === "NONCE_USED", `${rp.status} ${String(rp.body.code)}`);

// 4. submit with the new member key, read back from RPC
let stored = "";
if (j1.status === 200) {
  const policy = await viewCall<{ policy: { enclave_pubkey: string } }>(UNIT, "get_policy");
  const ct = encryptEntry(parseEnclavePublicKey(policy.policy.enclave_pubkey), {
    slot: m1.slot, gross_annual_eur: 51_400, grade: "Reporter", gender: "F", site: "Port", submitted_at: Math.floor(Date.now() / 1000),
  });
  stored = JSON.stringify(ct);
  const inv = { accountId: UNIT, contractId: UNIT, privateKey: m1.privateKey, publicKey: m1.publicKey, slot: m1.slot, rpcUrl: TESTNET_RPCS[0]! };
  const sub = await submitEntry(inv, ct, { provider: makeProvider() });
  const txs = (await makeProvider().viewTransactionStatus({ txHash: sub.txHash!, accountId: UNIT, waitUntil: "FINAL" })) as { status?: Record<string, unknown> };
  check("submit with the joined key, read back", Boolean(txs.status && "SuccessValue" in txs.status), `tx ${sub.txHash} entries=${String(sub.result)}`);

  // 5. bind the entry
  const h = createHash("sha256").update(stored).digest("hex");
  const en = await nonce("entry");
  const b = await post("entry", { ...(await sign(user, implicit, `Bandsheet entry: ${h}`, en)), ct_sha256: h, slot: m1.slot, method: "near-connect" });
  check("bind entry to account", b.status === 200 && b.body.ct_sha256 === h, `${b.status} ${String(b.body.code ?? h.slice(0, 16))}`);
}

// The join route allows 5 calls a minute per IP; wait out the window before the next two joins.
await new Promise((r) => setTimeout(r, 61_000));

// 6. existing full-access account (the owner account itself)
const ownerKp = KeyPair.fromString(owner.private_key);
const m3 = generateMemberKey();
const j3 = await post("join", await joinBody(ownerKp, owner.account_id, m3.publicKey));
check("join as an existing account with a FullAccess key", j3.status === 200 && j3.body.implicit_unfunded === false, `${j3.status} tx ${String((j3.body.tx as { hash?: string } | undefined)?.hash ?? j3.body.code)}`);
if (j3.status === 200) added.push(m3.publicKey);

// 7. re-join revokes the earlier key
const m2 = generateMemberKey();
const j2 = await post("join", await joinBody(user, implicit, m2.publicKey));
const rep = j2.body.replaced as { tx?: { hash?: string } } | null | undefined;
const m1Still = await viewCall<boolean>(UNIT, "is_member", { slot: m1.slot });
check("re-join revokes the old key (one per account)", j2.status === 200 && Boolean(rep?.tx?.hash) && !m1Still, `revoke tx ${rep?.tx?.hash ?? "-"} add tx ${String((j2.body.tx as { hash?: string } | undefined)?.hash ?? j2.body.code)}`);
if (j2.status === 200) {
  added.splice(added.indexOf(m1.publicKey), 1);
  added.push(m2.publicKey);
}

// 8. cleanup
const chain = createChainPort();
for (const pk of added) {
  if (!(await viewCall<boolean>(UNIT, "is_member", { slot: slotIdFromNearPublicKey(pk) }))) continue;
  const r = await chain.send({ accountId: owner.account_id, privateKey: owner.private_key }, UNIT, "revoke_member", { public_key: pk }, { tgas: 60 });
  out(`cleanup revoke ${pk.slice(0, 16)}… ${r.ok ? "ok" : r.error} tx ${r.hash}`);
}
out(`run accounts for D1 cleanup: ${implicit} ${owner.account_id}`);
const failed = results.filter((r) => !r.pass).length;
out(`${results.length - failed}/${results.length} passed`);
process.exitCode = failed ? 1 : 0;
