import { KeyPair } from "near-api-js";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { describe, expect, it } from "vitest";
import { slotIdFromNearPublicKey } from "@bandsheet/core";
import { createApp } from "../src/app";
import { evmStatement } from "../src/auth/evm";
import { MemoryAuthStore, NONCE_TTL_MS } from "../src/auth/store";
import type { ChainPort } from "../src/chain/port";
import type { Deps } from "../src/deps";
import { SpendGuard } from "../src/spend";
import { UNIT, chainCfg, config, mockChain } from "./helpers";

const evm = privateKeyToAccount(generatePrivateKey());
const ACCOUNT = evm.address.toLowerCase();
const OWNER = { accountId: "c0ffee".repeat(10) + "abcd", privateKey: KeyPair.fromRandom("ed25519").toString() };

function setup() {
  let t = 1_763_000_000_000;
  const base = mockChain({ balances: { [OWNER.accountId]: 2 } });
  const members = new Set<string>();
  const sent: string[] = [];
  const chain: ChainPort = {
    ...base.chain,
    async view<T>(c: string, m: string, a: Record<string, unknown> = {}) {
      return (m === "is_member" ? members.has(String(a.slot)) : base.chain.view(c, m, a)) as T;
    },
    async send(_s, _r, method, args) {
      sent.push(method);
      if (method === "add_members") for (const pk of (args as { public_keys: string[] }).public_keys) members.add(slotIdFromNearPublicKey(pk));
      return { hash: "ADDHASH", ok: true, error: "", value: 39 };
    },
  };
  const deps: Deps = {
    config, guard: new SpendGuard({ path: config.ledgerPath, getPrice: async () => ({ prompt: 0, completion: 0 }) }),
    chat: async () => { throw new Error("no AI here"); }, view: async () => [], chain, chainCfg: chainCfg(),
    auth: { store: new MemoryAuthStore(), keys: { status: async () => "no_such_account" }, owner: OWNER, now: () => t },
  };
  const app = createApp(deps);
  const post = async (path: string, body: unknown) => {
    const res = await app.request(`/api/auth/${path}`, { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": `10.2.0.${Math.floor(Math.random() * 250)}` }, body: JSON.stringify(body) });
    return { status: res.status, body: (await res.json()) as Record<string, unknown> };
  };
  const nonce = async () => String((await post("nonce", { purpose: "join" })).body.nonce);
  return { post, nonce, sent, advance: (ms: number) => (t += ms) };
}

/** An Ethereum wallet's personal_sign (EIP-191) over the join statement. */
async function evmJoin(n: string, memberKey: string, opts: { recipient?: string; signer?: typeof evm; text?: string } = {}) {
  const text = opts.text ?? evmStatement("join", memberKey, opts.recipient ?? UNIT, n);
  const signature = await (opts.signer ?? evm).signMessage({ message: text });
  return { scheme: "eip191", account_id: ACCOUNT, signature, nonce: n, member_public_key: memberKey, method: "near-connect" };
}
const memberKey = () => KeyPair.fromRandom("ed25519").getPublicKey().toString();

describe("POST /api/auth/join with an Ethereum wallet (EIP-191)", () => {
  it("a personal_sign by the 0x account registers the posting key", async () => {
    const s = setup();
    const mk = memberKey();
    const r = await s.post("join", await evmJoin(await s.nonce(), mk));
    expect(r).toMatchObject({ status: 200, body: { account_id: ACCOUNT, slot: slotIdFromNearPublicKey(mk) } });
    expect(s.sent).toEqual(["add_members"]);
  });

  it("refuses a signature from another address", async () => {
    const s = setup();
    const r = await s.post("join", await evmJoin(await s.nonce(), memberKey(), { signer: privateKeyToAccount(generatePrivateKey()) }));
    expect(r).toMatchObject({ status: 401, body: { code: "SIGNATURE_INVALID" } });
    expect(s.sent).toHaveLength(0);
  });

  it("refuses a replayed nonce", async () => {
    const s = setup();
    const body = await evmJoin(await s.nonce(), memberKey());
    expect((await s.post("join", body)).status).toBe(200);
    expect(await s.post("join", body)).toMatchObject({ status: 409, body: { code: "NONCE_USED" } });
  });

  it("refuses a statement for another recipient, and an expired nonce", async () => {
    const s = setup();
    expect(await s.post("join", await evmJoin(await s.nonce(), memberKey(), { recipient: "evil-app.testnet" }))).toMatchObject({ status: 401, body: { code: "SIGNATURE_INVALID" } });
    const n = await s.nonce();
    s.advance(NONCE_TTL_MS + 1);
    expect(await s.post("join", await evmJoin(n, memberKey()))).toMatchObject({ status: 401, body: { code: "NONCE_EXPIRED" } });
  });

  it("refuses a tampered message (signed for one posting key, sent with another)", async () => {
    const s = setup();
    const n = await s.nonce();
    const signed = await evmJoin(n, memberKey());
    const r = await s.post("join", { ...signed, member_public_key: memberKey() });
    expect(r).toMatchObject({ status: 401, body: { code: "SIGNATURE_INVALID" } });
    expect(s.sent).toHaveLength(0);
  });

  it("an upper-case or malformed 0x account is refused", async () => {
    const s = setup();
    const body = await evmJoin(await s.nonce(), memberKey());
    const r = await s.post("join", { ...body, account_id: evm.address });
    expect(r.status).toBe(400);
  });
});
