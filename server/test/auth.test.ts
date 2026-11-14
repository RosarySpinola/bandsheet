import { sha256 } from "@noble/hashes/sha2.js";
import { KeyPair, KeyPairSigner } from "near-api-js";
import { describe, expect, it } from "vitest";
import { slotIdFromNearPublicKey } from "@bandsheet/core";
import { createApp } from "../src/app";
import type { KeyLookup, KeyStatus } from "../src/auth/keys";
import { NEAR_AUTH_TESTNET } from "../src/auth/near-auth";
import { statementTxBytes } from "../src/auth/statement";
import { MemoryAuthStore, NONCE_TTL_MS } from "../src/auth/store";
import type { ChainPort, SentTx } from "../src/chain/port";
import type { Deps } from "../src/deps";
import type { AuthDeps } from "../src/routes/auth";
import { SpendGuard } from "../src/spend";
import { UNIT, chainCfg, config, mockChain } from "./helpers";

const OWNER = { accountId: "c0ffee".repeat(10) + "abcd", privateKey: KeyPair.fromRandom("ed25519").toString() };
const WALLET = "maria-lopes.testnet";

/** Mock chain: the unit's member list plus owner calls (add_members, revoke_member) and NEAR Auth `sign`. */
function authChain(mpcSign?: (payload: Uint8Array) => Uint8Array) {
  const base = mockChain({ balances: { [OWNER.accountId]: 2 } });
  const members = new Set<string>();
  const sent: { receiver: string; method: string; args: Record<string, unknown>; deposit: bigint }[] = [];
  const ok = (hash: string, value?: unknown): SentTx => ({ hash, ok: true, error: "", value });
  const chain: ChainPort = {
    ...base.chain,
    async view<T>(contract: string, method: string, args: Record<string, unknown> = {}) {
      if (method === "is_member") return members.has(String(args.slot)) as T;
      return base.chain.view<T>(contract, method, args);
    },
    async send(signer, receiver, method, args, o) {
      const a = args as Record<string, unknown>;
      sent.push({ receiver, method, args: a, deposit: o.depositYocto ?? 0n });
      if (method === "add_members") for (const pk of a.public_keys as string[]) members.add(slotIdFromNearPublicKey(pk));
      if (method === "revoke_member") members.delete(slotIdFromNearPublicKey(String(a.public_key)));
      if (method === "sign") return ok("SIGNHASH", { signature: Array.from(mpcSign!(Uint8Array.from(a.sign_payload as number[]))) });
      return ok(`${method.toUpperCase()}HASH`);
    },
  };
  return { chain, members, sent };
}

function setup(keys: Record<string, KeyStatus> = {}, opts: { mpcSign?: (p: Uint8Array) => Uint8Array; auth?: boolean } = {}) {
  let t = 1_763_000_000_000;
  const store = new MemoryAuthStore();
  const lookup: KeyLookup = { status: async (acct, pk) => keys[`${acct}|${pk}`] ?? keys[acct] ?? "no_such_account" };
  const auth: AuthDeps = { store, keys: lookup, owner: OWNER, now: () => t };
  const c = authChain(opts.mpcSign);
  const deps: Deps = {
    config, guard: new SpendGuard({ path: config.ledgerPath, getPrice: async () => ({ prompt: 0, completion: 0 }) }),
    chat: async () => { throw new Error("no AI here"); }, view: async () => [], chain: c.chain, chainCfg: chainCfg(),
    auth: opts.auth === false ? undefined : auth,
  };
  const app = createApp(deps);
  const post = async (path: string, body: unknown) => {
    const res = await app.request(`/api/auth/${path}`, { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": `10.0.0.${Math.floor(Math.random() * 250)}` }, body: JSON.stringify(body) });
    return { status: res.status, body: (await res.json()) as Record<string, unknown> };
  };
  const nonce = async (purpose: "join" | "entry" = "join") => String((await post("nonce", { purpose })).body.nonce);
  return { post, nonce, store, ...c, advance: (ms: number) => (t += ms) };
}

const memberKey = () => KeyPair.fromRandom("ed25519").getPublicKey().toString();
const nonceBytes = (n: string) => Uint8Array.from(Buffer.from(n, "base64url"));

/** A wallet's NEP-413 signMessage, done with near-api-js. */
async function walletSign(kp: KeyPair, accountId: string, message: string, nonce: string, recipient = UNIT) {
  const s = await new KeyPairSigner(kp).signNep413Message(accountId, { message, recipient, nonce: nonceBytes(nonce) });
  return { scheme: "nep413", account_id: accountId, public_key: kp.getPublicKey().toString(), signature: Buffer.from(s.signature).toString("base64"), nonce };
}

describe("POST /api/auth/join (NEP-413 from a wallet)", () => {
  const kp = KeyPair.fromRandom("ed25519");
  const full = { [`${WALLET}|${kp.getPublicKey().toString()}`]: "full_access" as KeyStatus };

  it("a valid signature registers the browser's member key and records account -> slot off chain", async () => {
    const s = setup(full);
    const n = await s.nonce();
    const mk = memberKey();
    const r = await s.post("join", { ...(await walletSign(kp, WALLET, `Bandsheet join: ${mk}`, n)), member_public_key: mk, method: "near-connect" });
    expect(r.status).toBe(200);
    expect(r.body.slot).toBe(slotIdFromNearPublicKey(mk));
    expect(s.sent.map((x) => x.method)).toEqual(["add_members"]);
    expect(s.sent[0]!.args).toEqual({ public_keys: [mk] });
    expect((await s.store.getMember(WALLET))?.slot).toBe(slotIdFromNearPublicKey(mk));
    // Nothing that names the account goes on chain.
    expect(JSON.stringify(s.sent.map((x) => x.args))).not.toContain(WALLET);
  });

  it("refuses a signature made for another recipient", async () => {
    const s = setup(full);
    const n = await s.nonce();
    const mk = memberKey();
    const r = await s.post("join", { ...(await walletSign(kp, WALLET, `Bandsheet join: ${mk}`, n, "evil-app.testnet")), member_public_key: mk, method: "near-connect" });
    expect(r).toMatchObject({ status: 401, body: { code: "SIGNATURE_INVALID" } });
    expect(s.sent).toHaveLength(0);
  });

  it("refuses a replayed nonce", async () => {
    const s = setup(full);
    const n = await s.nonce();
    const mk = memberKey();
    const claim = { ...(await walletSign(kp, WALLET, `Bandsheet join: ${mk}`, n)), member_public_key: mk, method: "near-connect" };
    expect((await s.post("join", claim)).status).toBe(200);
    expect(await s.post("join", claim)).toMatchObject({ status: 409, body: { code: "NONCE_USED" } });
    expect(s.sent).toHaveLength(1);
  });

  it("refuses an expired nonce", async () => {
    const s = setup(full);
    const n = await s.nonce();
    s.advance(NONCE_TTL_MS + 1);
    const mk = memberKey();
    const r = await s.post("join", { ...(await walletSign(kp, WALLET, `Bandsheet join: ${mk}`, n)), member_public_key: mk, method: "near-connect" });
    expect(r).toMatchObject({ status: 401, body: { code: "NONCE_EXPIRED" } });
  });

  it("refuses a key that is not on the account, and a function-call key", async () => {
    for (const [status, code] of [["no_such_key", "KEY_NOT_ON_ACCOUNT"], ["function_call", "NOT_FULL_ACCESS"]] as const) {
      const s = setup({ [WALLET]: status });
      const n = await s.nonce();
      const mk = memberKey();
      const r = await s.post("join", { ...(await walletSign(kp, WALLET, `Bandsheet join: ${mk}`, n)), member_public_key: mk, method: "near-connect" });
      expect(r).toMatchObject({ status: 401, body: { code } });
      expect(s.sent).toHaveLength(0);
    }
  });

  it("refuses a tampered message (signed for one member key, sent with another)", async () => {
    const s = setup(full);
    const n = await s.nonce();
    const signed = await walletSign(kp, WALLET, `Bandsheet join: ${memberKey()}`, n);
    const r = await s.post("join", { ...signed, member_public_key: memberKey(), method: "near-connect" });
    expect(r).toMatchObject({ status: 401, body: { code: "SIGNATURE_INVALID" } });
  });

  it("re-joining revokes the old key first: one active key per account", async () => {
    const s = setup(full);
    const first = memberKey();
    const second = memberKey();
    for (const mk of [first, second]) {
      const n = await s.nonce();
      expect((await s.post("join", { ...(await walletSign(kp, WALLET, `Bandsheet join: ${mk}`, n)), member_public_key: mk, method: "near-connect" })).status).toBe(200);
    }
    expect(s.sent.map((x) => x.method)).toEqual(["add_members", "revoke_member", "add_members"]);
    expect(s.sent[1]!.args).toEqual({ public_key: first });
    expect(s.members.has(slotIdFromNearPublicKey(first))).toBe(false);
    expect(s.members.has(slotIdFromNearPublicKey(second))).toBe(true);
  });

  it("validates input and answers {error, code}", async () => {
    const s = setup(full);
    expect(await s.post("join", { scheme: "nep413", account_id: "Bad Account" })).toMatchObject({ status: 400, body: { code: "BAD_REQUEST" } });
    expect(await setup({}, { auth: false }).post("nonce", { purpose: "join" })).toMatchObject({ status: 503, body: { code: "AUTH_NOT_CONFIGURED" } });
  });
});

describe("NEAR Auth path (statement transaction signed through fast-auth.testnet)", () => {
  // Stands in for the MPC network: it holds the user's derived key and signs sha256(payload), as NEAR does for a tx.
  const derived = KeyPair.fromRandom("ed25519");
  const pk = derived.getPublicKey().toString();
  const implicit = Buffer.from(derived.getPublicKey().data).toString("hex");
  const mpcSign = (payload: Uint8Array) => derived.sign(sha256(payload)).signature;
  const jwt = (payload: Uint8Array) => `e30.${Buffer.from(JSON.stringify({ fatxn: Array.from(payload) })).toString("base64url")}.sig`;

  async function relayAndJoin(s: ReturnType<typeof setup>, mk: string, tamper = false) {
    const n = await s.nonce();
    const bytes = statementTxBytes({ accountId: implicit, publicKey: pk, recipient: UNIT, purpose: "join", subject: mk, nonce: nonceBytes(n) });
    const sent = tamper ? statementTxBytes({ accountId: implicit, publicKey: pk, recipient: "evil-app.testnet", purpose: "join", subject: mk, nonce: nonceBytes(n) }) : bytes;
    const relay = await s.post("near-auth/sign", {
      purpose: "join", subject: mk, nonce: n, account_id: implicit, public_key: pk,
      guard_id: NEAR_AUTH_TESTNET.guardId, verify_payload: jwt(sent), sign_payload: Buffer.from(sent).toString("base64"),
    });
    if (relay.status !== 200) return { relay };
    const join = await s.post("join", { scheme: "near-tx", account_id: implicit, public_key: pk, signature: relay.body.signature, nonce: n, member_public_key: mk, method: "near-auth" });
    return { relay, join };
  }

  it("an unfunded implicit account joins: relay returns the MPC signature, join verifies it", async () => {
    const s = setup({}, { mpcSign });
    const { relay, join } = await relayAndJoin(s, memberKey());
    expect(relay.status).toBe(200);
    expect(join).toMatchObject({ status: 200, body: { account_id: implicit, implicit_unfunded: true } });
    const sign = s.sent.find((x) => x.method === "sign")!;
    expect(sign).toMatchObject({ receiver: "fast-auth.testnet", deposit: 1n });
    expect(sign.args.algorithm).toBe("eddsa");
  });

  it("the relay refuses to sign any payload but the issued statement", async () => {
    const s = setup({}, { mpcSign });
    const { relay } = await relayAndJoin(s, memberKey(), true);
    expect(relay).toMatchObject({ status: 400, body: { code: "PAYLOAD_MISMATCH" } });
    expect(s.sent.some((x) => x.method === "sign")).toBe(false);
  });

  it("an implicit-looking id that is not this key's account is refused", async () => {
    const s = setup({}, { mpcSign });
    const n = await s.nonce();
    const mk = memberKey();
    const other = "ab".repeat(32);
    const bytes = statementTxBytes({ accountId: other, publicKey: pk, recipient: UNIT, purpose: "join", subject: mk, nonce: nonceBytes(n) });
    const sig = Buffer.from(mpcSign(bytes)).toString("base64");
    const r = await s.post("join", { scheme: "near-tx", account_id: other, public_key: pk, signature: sig, nonce: n, member_public_key: mk, method: "near-auth" });
    expect(r).toMatchObject({ status: 401, body: { code: "UNKNOWN_ACCOUNT" } });
  });
});
