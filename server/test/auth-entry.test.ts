import { createHash } from "node:crypto";
import { KeyPair, KeyPairSigner, actions, createTransaction } from "near-api-js";
import { describe, expect, it } from "vitest";
import { slotIdFromNearPublicKey } from "@bandsheet/core";
import { createApp } from "../src/app";
import type { KeyStatus } from "../src/auth/keys";
import { MemoryAuthStore } from "../src/auth/store";
import type { SentTx } from "../src/chain/port";
import type { Deps } from "../src/deps";
import { SpendGuard } from "../src/spend";
import { UNIT, chainCfg, config, mockChain } from "./helpers";

const WALLET = "ilse-vandenberg.testnet";
const wallet = KeyPair.fromRandom("ed25519");
const posting = KeyPair.fromRandom("ed25519");
const CT = { epk: "bWFyaWEtZXBr", nonce: "bm9uY2UtMTIz", ct: "c2VhbGVkLWVudHJ5" };
const hex = (s: string) => createHash("sha256").update(s).digest("hex");

/** A `submit` signed by a posting key and never broadcast, as the browser builds it. */
async function postingTx(key: KeyPair, opts: { method?: string; receiver?: string; ciphertext?: object } = {}) {
  const tx = createTransaction(UNIT, key.getPublicKey(), opts.receiver ?? UNIT, 7n,
    [actions.functionCall(opts.method ?? "submit", { ciphertext: opts.ciphertext ?? CT }, 30n * 10n ** 12n, 0n)], new Uint8Array(32).fill(3));
  const { signedTransaction } = await new KeyPairSigner(key).signTransaction(tx);
  return Buffer.from(signedTransaction.encode()).toString("base64");
}

function setup(chainSays: Partial<SentTx> = {}) {
  const store = new MemoryAuthStore();
  const broadcasts: Uint8Array[] = [];
  const keys: Record<string, KeyStatus> = { [WALLET]: "full_access" };
  const deps: Deps = {
    config, guard: new SpendGuard({ path: config.ledgerPath, getPrice: async () => ({ prompt: 0, completion: 0 }) }),
    chat: async () => { throw new Error("no AI here"); }, view: async () => [], chain: mockChain().chain, chainCfg: chainCfg(),
    auth: {
      store, owner: undefined, now: () => 1_763_000_000_000,
      keys: { status: async (acct) => keys[acct] ?? "no_such_account" },
      broadcast: async (bytes) => {
        broadcasts.push(bytes);
        return { hash: "POSTHASH", ok: true, error: "", value: "39", ...chainSays };
      },
    },
  };
  void store.putMember({ account_id: WALLET, member_public_key: posting.getPublicKey().toString(), slot: slotIdFromNearPublicKey(posting.getPublicKey().toString()), method: "near-connect", joined_at: 1, add_tx: "ADDHASH" });
  const app = createApp(deps);
  const post = async (path: string, body: unknown) => {
    const res = await app.request(`/api/auth/${path}`, { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": `10.1.0.${Math.floor(Math.random() * 250)}` }, body: JSON.stringify(body) });
    return { status: res.status, body: (await res.json()) as Record<string, unknown> };
  };
  const nonce = async (purpose: "join" | "entry" = "entry") => String((await post("nonce", { purpose })).body.nonce);
  return { post, nonce, store, broadcasts };
}

/** The wallet's NEP-413 signature over "Bandsheet entry: <hash>". */
async function walletClaim(n: string, hash: string) {
  const s = await new KeyPairSigner(wallet).signNep413Message(WALLET, { message: `Bandsheet entry: ${hash}`, recipient: UNIT, nonce: Uint8Array.from(Buffer.from(n, "base64url")) });
  return { scheme: "nep413", account_id: WALLET, public_key: wallet.getPublicKey().toString(), signature: Buffer.from(s.signature).toString("base64"), nonce: n, method: "near-connect" };
}

describe("POST /api/auth/entry: the wallet signs, then the posting key posts", () => {
  it("verifies the wallet signature, then broadcasts the posting tx and records (account, slot, hash)", async () => {
    const s = setup();
    const signed_tx = await postingTx(posting);
    const r = await s.post("entry", { ...(await walletClaim(await s.nonce(), hex(JSON.stringify(CT)))), signed_tx });
    expect(r).toMatchObject({ status: 200, body: { account_id: WALLET, ct_sha256: hex(JSON.stringify(CT)), tx: { hash: "POSTHASH" }, entry_count: 39 } });
    expect(s.broadcasts).toHaveLength(1);
    expect(Buffer.from(s.broadcasts[0]!).toString("base64")).toBe(signed_tx);
    expect(s.store.bindings).toEqual([expect.objectContaining({ account_id: WALLET, ct_sha256: hex(JSON.stringify(CT)) })]);
  });

  it("without a wallet signature nothing is posted", async () => {
    const s = setup();
    const { signature: _drop, ...noSig } = await walletClaim(await s.nonce(), hex(JSON.stringify(CT)));
    const r = await s.post("entry", { ...noSig, signed_tx: await postingTx(posting) });
    expect(r).toMatchObject({ status: 400, body: { code: "BAD_REQUEST" } });
    expect(s.broadcasts).toHaveLength(0);
  });

  it("a wallet signature over another entry is refused and nothing is posted", async () => {
    const s = setup();
    const r = await s.post("entry", { ...(await walletClaim(await s.nonce(), hex("some other entry"))), signed_tx: await postingTx(posting) });
    expect(r).toMatchObject({ status: 401, body: { code: "SIGNATURE_INVALID" } });
    expect(s.broadcasts).toHaveLength(0);
    expect(s.store.bindings).toHaveLength(0);
  });

  it("a posting key that is not this account's is refused and nothing is posted", async () => {
    const s = setup();
    const r = await s.post("entry", { ...(await walletClaim(await s.nonce(), hex(JSON.stringify(CT)))), signed_tx: await postingTx(KeyPair.fromRandom("ed25519")) });
    expect(r).toMatchObject({ status: 409, body: { code: "SLOT_MISMATCH" } });
    expect(s.broadcasts).toHaveLength(0);
  });

  it("only a single submit to the unit is relayed", async () => {
    const s = setup();
    for (const opts of [{ method: "revoke_member" }, { receiver: "elsewhere.testnet" }, { ciphertext: { epk: "a" } }]) {
      const r = await s.post("entry", { ...(await walletClaim(await s.nonce(), hex(JSON.stringify(CT)))), signed_tx: await postingTx(posting, opts) });
      expect(r).toMatchObject({ status: 400, body: { code: "BAD_POSTING_TX" } });
    }
    expect(s.broadcasts).toHaveLength(0);
  });

  it("a chain refusal records no binding", async () => {
    const s = setup({ ok: false, error: "Refused: this key is not a registered member of the union" });
    const r = await s.post("entry", { ...(await walletClaim(await s.nonce(), hex(JSON.stringify(CT)))), signed_tx: await postingTx(posting) });
    expect(r).toMatchObject({ status: 422, body: { code: "CHAIN_REJECTED" } });
    expect(s.store.bindings).toHaveLength(0);
  });

  it("a replayed or join nonce is refused", async () => {
    const s = setup();
    const claim = await walletClaim(await s.nonce(), hex(JSON.stringify(CT)));
    const signed_tx = await postingTx(posting);
    expect((await s.post("entry", { ...claim, signed_tx })).status).toBe(200);
    expect(await s.post("entry", { ...claim, signed_tx })).toMatchObject({ status: 409, body: { code: "NONCE_USED" } });
    const wrong = await s.post("entry", { ...(await walletClaim(await s.nonce("join"), hex(JSON.stringify(CT)))), signed_tx });
    expect(wrong).toMatchObject({ status: 400, body: { code: "NONCE_WRONG_PURPOSE" } });
    expect(s.broadcasts).toHaveLength(1);
  });
});
