import { KeyPair } from "near-api-js";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { describe, expect, it } from "vitest";
import { inviteCodeOf, slotIdFromNearPublicKey } from "@bandsheet/core";
import type { KeyStatus } from "../src/auth/keys";
import { NONCE_TTL_MS } from "../src/auth/store";
import { CREATOR, REGISTRAR, SECRET, UNITS, memberKey, setupUnits, walletSign } from "./units-helpers";

const WALLET = "joao-ferreira.testnet";
const kp = KeyPair.fromRandom("ed25519");
const full = { [`${WALLET}|${kp.getPublicKey().toString()}`]: "full_access" as KeyStatus };
const join = async (s: ReturnType<typeof setupUnits>, mk = memberKey(), over: Record<string, unknown> = {}, unit = 1) => {
  const n = await s.nonce("unit_join");
  return s.post(`/units/${unit}/join`, { ...(await walletSign(kp, WALLET, `Bandsheet join unit ${unit}: ${mk}`, n)), member_public_key: mk, invite_code: SECRET, ...over });
};

describe("POST /api/units/:id/join (NEP-413)", () => {
  it("a signed join with the link secret adds the posting key through the registrar, and keeps account -> slot off chain", async () => {
    const s = setupUnits(full);
    const mk = memberKey();
    const r = await join(s, mk);
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ unit_id: 1, account_id: WALLET, member_public_key: mk, slot: slotIdFromNearPublicKey(mk), replaced: null });
    expect((r.body.tx as { url: string }).url).toMatch(/^https:\/\/testnet\.nearblocks\.io\/txns\//);
    const call = s.calls[0]!;
    expect(call.signer).toBe(REGISTRAR.accountId);
    expect(call.calls[0]).toMatchObject({ method: "unit_add_member", args: { unit_id: 1, public_key: mk, invite_code: inviteCodeOf(SECRET), synthetic: false } });
    // the chain sees the code (sha256 of the secret) and never the wallet
    expect(JSON.stringify(s.calls)).not.toContain(WALLET);
    expect(JSON.stringify(s.calls)).not.toContain(SECRET);
    expect((await s.store.getMember(WALLET, 1))?.slot).toBe(slotIdFromNearPublicKey(mk));
  });

  it("the nonce reply names the units contract as recipient", async () => {
    const s = setupUnits(full);
    const r = await s.post("/units/nonce", { purpose: "unit_join" });
    expect(r.body).toMatchObject({ purpose: "unit_join", recipient: UNITS });
    expect((await s.post("/units/nonce", { purpose: "join" })).status).toBe(400);
  });

  it("refuses a wrong invite code before any chain write", async () => {
    const s = setupUnits(full);
    const r = await join(s, memberKey(), { invite_code: "not-the-link-secret" });
    expect(r).toMatchObject({ status: 403, body: { code: "INVITE_INVALID" } });
    // the on-chain invite code itself is not accepted as the link secret
    const r2 = await join(s, memberKey(), { invite_code: inviteCodeOf(SECRET) });
    expect(r2.body.code).toBe("INVITE_INVALID");
    expect(s.calls).toHaveLength(0);
  });

  it("refuses a signature over another unit, another recipient, another key or a reused nonce", async () => {
    const s = setupUnits(full);
    const mk = memberKey();
    let n = await s.nonce("unit_join");
    let r = await s.post("/units/1/join", { ...(await walletSign(kp, WALLET, `Bandsheet join unit 2: ${mk}`, n)), member_public_key: mk, invite_code: SECRET });
    expect(r.body.code).toBe("SIGNATURE_INVALID");
    n = await s.nonce("unit_join");
    r = await s.post("/units/1/join", { ...(await walletSign(kp, WALLET, `Bandsheet join unit 1: ${mk}`, n, "bandsheet-3f36b7.testnet")), member_public_key: mk, invite_code: SECRET });
    expect(r.body.code).toBe("SIGNATURE_INVALID");
    n = await s.nonce("unit_join");
    r = await s.post("/units/1/join", { ...(await walletSign(kp, WALLET, `Bandsheet join unit 1: ${mk}`, n)), member_public_key: memberKey(), invite_code: SECRET });
    expect(r.body.code).toBe("SIGNATURE_INVALID");
    // replay
    n = await s.nonce("unit_join");
    const claim = { ...(await walletSign(kp, WALLET, `Bandsheet join unit 1: ${mk}`, n)), member_public_key: mk, invite_code: SECRET };
    expect((await s.post("/units/1/join", claim)).status).toBe(200);
    expect((await s.post("/units/1/join", claim)).body.code).toBe("NONCE_USED");
    // a nonce for another purpose, and an expired one
    n = await s.nonce("unit_entry");
    r = await s.post("/units/1/join", { ...(await walletSign(kp, WALLET, `Bandsheet join unit 1: ${mk}`, n)), member_public_key: mk, invite_code: SECRET });
    expect(r.body.code).toBe("NONCE_WRONG_PURPOSE");
    n = await s.nonce("unit_join");
    s.advance(NONCE_TTL_MS + 1);
    r = await s.post("/units/1/join", { ...(await walletSign(kp, WALLET, `Bandsheet join unit 1: ${mk}`, n)), member_public_key: mk, invite_code: SECRET });
    expect(r.body.code).toBe("NONCE_EXPIRED");
  });

  it("refuses a key that is not the account's full-access key", async () => {
    const s = setupUnits({ [WALLET]: "function_call" });
    expect((await join(s)).body.code).toBe("NOT_FULL_ACCESS");
    const s2 = setupUnits({});
    expect((await join(s2)).body.code).toBe("UNKNOWN_ACCOUNT");
  });

  it("re-joining from a new device revokes the old posting key first", async () => {
    const s = setupUnits(full);
    const first = memberKey();
    await join(s, first);
    expect((await join(s, first)).body.code).toBe("ALREADY_MEMBER");
    const second = memberKey();
    const r = await join(s, second);
    expect(r.status).toBe(200);
    expect((r.body.replaced as { slot: string }).slot).toBe(slotIdFromNearPublicKey(first));
    expect(s.calls.map((c) => c.calls[0]!.method)).toEqual(["unit_add_member", "unit_remove_member", "unit_add_member"]);
  });

  it("answers 404 for a missing unit, 400 for a bad id, 503 without a registrar key", async () => {
    const s = setupUnits(full);
    expect((await join(s, memberKey(), {}, 9)).body.code).toBe("UNIT_NOT_FOUND");
    expect((await s.post("/units/abc/join", {})).body.code).toBe("BAD_UNIT_ID");
    const s2 = setupUnits(full, { registrar: false });
    expect((await join(s2)).body.code).toBe("REGISTRAR_KEY_MISSING");
  });

  it("Ethereum wallets join with EIP-191 over the same statement", async () => {
    const evm = privateKeyToAccount(generatePrivateKey());
    const s = setupUnits();
    const mk = memberKey();
    const n = await s.nonce("unit_join");
    const text = `Bandsheet join unit 1: ${mk}\nRecipient: ${UNITS}\nNonce: ${n}`;
    const id = evm.address.toLowerCase();
    const r = await s.post("/units/1/join", { scheme: "eip191", account_id: id, signature: await evm.signMessage({ message: text }), nonce: n, member_public_key: mk, invite_code: SECRET });
    expect(r.status).toBe(200);
    expect(r.body.account_id).toBe(id);
    const n2 = await s.nonce("unit_join");
    const other = privateKeyToAccount(generatePrivateKey());
    const bad = await s.post("/units/1/join", { scheme: "eip191", account_id: id, signature: await other.signMessage({ message: text.replace(n, n2) }), nonce: n2, member_public_key: memberKey(), invite_code: SECRET });
    expect(bad.body.code).toBe("SIGNATURE_INVALID");
  });
});

describe("GET /api/units", () => {
  it("returns the unit, its releases with counts, and the latest bands, without the invite hash", async () => {
    const s = setupUnits(full);
    const r = await s.get("/units/1");
    expect(r.status).toBe(200);
    expect((r.body.unit as Record<string, unknown>).invite_code_hash).toBeUndefined();
    expect((r.body.latest_bands as { cells: unknown[] }).cells).toHaveLength(1);
    expect((r.body.counts as { latest_release: { synthetic: number } }).latest_release.synthetic).toBe(4);
    expect((await s.get("/units/7")).status).toBe(404);
    const list = await s.get(`/units?account_id=${CREATOR}`);
    expect((list.body.units as unknown[]).length).toBe(1);
    expect((await s.get("/units?account_id=BAD!")).status).toBe(400);
  });
});

describe("POST /api/units/:id/run", () => {
  it("starts an approved proposal's run from the sponsor account, and refuses anything not approved", async () => {
    const s = setupUnits();
    const r = await s.post("/units/1/run", { proposal_id: 2 });
    expect(r).toMatchObject({ status: 200, body: { status: "running", proposal_id: 2 } });
    expect(s.calls[0]).toMatchObject({ signer: "bsu-sponsor-test.testnet", calls: [{ method: "unit_run", tgas: 300 }] });
    // a run the contract refused (still approved after the send) is reported, not claimed
    s.proposals.push({ id: 4, status: "approved" });
    const origCall = s.chain.call.bind(s.chain);
    s.chain.call = async (signer, cs) => ({ ...(await origCall(signer, cs.map((c) => ({ ...c, method: "noop" })))), ok: false });
    expect((await s.post("/units/1/run", { proposal_id: 4 })).body.code).toBe("RUN_NOT_STARTED");
    expect((await s.post("/units/1/run", { proposal_id: 2 })).body.code).toBe("NOT_APPROVED");
    expect((await s.post("/units/1/run", { proposal_id: 3 })).body.code).toBe("NOT_APPROVED");
    expect((await s.post("/units/1/run", { proposal_id: 7 })).body.code).toBe("PROPOSAL_NOT_FOUND");
    expect((await s.post("/units/1/run", { proposal_id: "2" })).status).toBe(400);
  });

  it("keeps the unit_run transaction and links it from the release it produced", async () => {
    const s = setupUnits();
    const r = await s.post("/units/1/run", { proposal_id: 2 });
    const hash = (r.body.tx as { hash: string }).hash;
    expect(s.store.runs).toEqual([expect.objectContaining({ unit_id: 1, proposal_id: 2, tx: hash })]);
    s.releases[0]!.proposal_id = 2;
    const v = await s.get("/units/1");
    expect((v.body.releases as { run_tx?: { hash: string; url: string } }[])[0]!.run_tx).toEqual({ hash, url: expect.stringContaining(hash) });
  });
});
