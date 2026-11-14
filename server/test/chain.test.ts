import { describe, expect, it } from "vitest";
import { makeProvider } from "@bandsheet/core/near";
import { createApp } from "../src/app";
import { SpendGuard } from "../src/spend";
import { COUNCIL, DAO, UNIT, chainCfg, config, mockChain } from "./helpers";

function setup(opts: Parameters<typeof mockChain>[0] = {}, cfgOver: Parameters<typeof chainCfg>[0] = {}) {
  const m = mockChain(opts);
  const app = createApp({
    config,
    guard: new SpendGuard({ path: config.ledgerPath, getPrice: async () => ({ prompt: 0, completion: 0 }) }),
    chat: async () => { throw new Error("not used"); },
    view: async () => [],
    chain: m.chain,
    chainCfg: chainCfg(cfgOver),
  });
  const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
    app.request(path, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) });
  return { app, post, ...m };
}

describe("GET /api/unit", () => {
  it("returns policy, counts, dao, council and explorer links without leaking OutLayer secrets", async () => {
    const { app } = setup();
    const res = await app.request("/api/unit");
    const b = await res.json();
    expect(res.status).toBe(200);
    expect(b).toMatchObject({ network: "testnet", unit: UNIT, dao: DAO, council: COUNCIL, member_count: 38, entry_count: 37, release_count: 2, enclave_pubkey: "cd".repeat(32) });
    expect(b.policy.k).toBe(3);
    expect(b.explorer.tx).toBe("https://testnet.nearblocks.io/txns/");
    expect(b.explorer.unit_url).toBe(`https://testnet.nearblocks.io/address/${UNIT}`);
    expect(JSON.stringify(b)).not.toContain("SECRET");
  });
  it("maps an RPC failure to CHAIN_READ", async () => {
    const m = mockChain();
    m.chain.view = async () => { throw new Error("429"); };
    const app = createApp({ config, guard: new SpendGuard({ path: config.ledgerPath, getPrice: async () => ({ prompt: 0, completion: 0 }) }), chat: async () => { throw new Error(); }, view: async () => [], chain: m.chain, chainCfg: chainCfg() });
    const r = await app.request("/api/unit");
    expect([r.status, await r.json()]).toEqual([502, { error: "could not read NEAR testnet", code: "CHAIN_READ" }]);
  });
});

describe("GET /api/dao/proposals", () => {
  it("lists only request_release proposals, newest first, with decoded queries", async () => {
    const { app } = setup();
    const b = await (await app.request("/api/dao/proposals")).json();
    expect(b.proposals.map((p: { id: number }) => p.id)).toEqual([2, 0]);
    expect(b.proposals[1]).toMatchObject({ id: 0, status: "Approved", query: { group_by: ["grade"], stat: "mean" }, submission_time: new Date(1760000000000).toISOString() });
    expect(b.proposals[1].votes[COUNCIL[0]!]).toBe("Approve");
  });
  it("tolerates a bad limit", async () => {
    const { app } = setup();
    expect((await app.request("/api/dao/proposals?limit=abc")).status).toBe(200);
  });
});

describe("POST /api/dao/propose", () => {
  it("submits request_release as council member 1, attaching the DAO's bond", async () => {
    const { post, sent } = setup();
    const res = await post("/api/dao/propose", { group_by: ["grade", "site"], filter: { gender: "F" } });
    const b = await res.json();
    expect(res.status).toBe(200);
    expect(b).toMatchObject({ proposal_id: 3, proposer: COUNCIL[0], tx: { hash: "PROPOSEHASH", url: "https://testnet.nearblocks.io/txns/PROPOSEHASH" } });
    const s = sent[0]!;
    expect([s.signer.accountId, s.receiver, s.method, s.deposit, s.tgas]).toEqual([COUNCIL[0], DAO, "add_proposal", 100000000000000000000000n, 60]);
    const fc = (s.args.proposal as { kind: { FunctionCall: { receiver_id: string; actions: { method_name: string; args: string; gas: string }[] } } }).kind.FunctionCall;
    expect(fc.receiver_id).toBe(UNIT);
    expect(fc.actions[0]!.method_name).toBe("request_release");
    expect(fc.actions[0]!.gas).toBe("200000000000000");
    const inner = JSON.parse(Buffer.from(fc.actions[0]!.args, "base64").toString());
    expect(JSON.parse(inner.query)).toEqual({ group_by: ["grade", "site"], filter: { gender: "F" }, stat: "mean" });
  });
  it("validates input with zod", async () => {
    const { post, sent } = setup();
    for (const body of [{}, { group_by: [] }, { group_by: ["salary"] }, { group_by: ["grade", "grade"] }, { group_by: ["grade"], filter: { grade: "Boss" } }, { group_by: ["grade"], filter: { dept: "x" } }]) {
      const r = await post("/api/dao/propose", body);
      expect([r.status, (await r.json()).code]).toEqual([400, "BAD_REQUEST"]);
    }
    expect(sent).toHaveLength(0);
  });
  it("refuses with LOW_GAS_BALANCE below 0.3 NEAR and sends nothing", async () => {
    const { post, sent } = setup({ balances: { [COUNCIL[0]!]: 0.29 } });
    const r = await post("/api/dao/propose", { group_by: ["grade"] });
    expect([r.status, (await r.json()).code]).toEqual([503, "LOW_GAS_BALANCE"]);
    expect(sent).toHaveLength(0);
  });
  it("reports a missing council key and a chain refusal", async () => {
    const noKey = setup({}, { councilKeys: {} });
    expect((await (await noKey.post("/api/dao/propose", { group_by: ["grade"] })).json()).code).toBe("COUNCIL_KEY_MISSING");
    const refused = setup({ failMethod: "add_proposal" });
    const r = await refused.post("/api/dao/propose", { group_by: ["grade"] });
    expect([r.status, (await r.json()).code]).toEqual([422, "CHAIN_REJECTED"]);
  });
});

describe("POST /api/dao/vote", () => {
  it("casts a vote with the chosen council key and reports status; the second approval passes", async () => {
    const { post, sent } = setup();
    const r1 = await (await post("/api/dao/vote", { proposal_id: 2, member: 2, action: "approve" })).json();
    expect(r1).toMatchObject({ voter: COUNCIL[1], status: "InProgress", tx: { hash: "VOTEHASH" } });
    expect(sent[0]).toMatchObject({ method: "act_proposal", args: { id: 2, action: "VoteApprove" }, tgas: 270 });
    expect(sent[0]!.signer.accountId).toBe(COUNCIL[1]);
    const r2 = await (await post("/api/dao/vote", { proposal_id: 2, member: 3, action: "approve" })).json();
    expect(r2.status).toBe("Approved");
    expect(r2.note).toMatch(/OutLayer/);
  });
  it("supports reject", async () => {
    const { post, sent } = setup();
    await post("/api/dao/vote", { proposal_id: 2, member: 1, action: "reject" });
    expect(sent[0]!.args.action).toBe("VoteReject");
  });
  it("refuses double votes, closed, unknown and non-release proposals", async () => {
    const { post, sent } = setup();
    await post("/api/dao/vote", { proposal_id: 2, member: 1, action: "approve" });
    const code = async (body: unknown) => { const r = await post("/api/dao/vote", body); return [r.status, (await r.json()).code]; };
    expect(await code({ proposal_id: 2, member: 1, action: "approve" })).toEqual([409, "ALREADY_VOTED"]);
    expect(await code({ proposal_id: 0, member: 2, action: "approve" })).toEqual([409, "PROPOSAL_CLOSED"]);
    expect(await code({ proposal_id: 99, member: 2, action: "approve" })).toEqual([404, "PROPOSAL_NOT_FOUND"]);
    expect(await code({ proposal_id: 1, member: 2, action: "approve" })).toEqual([422, "NOT_A_RELEASE_PROPOSAL"]);
    expect(sent).toHaveLength(1);
  });
  it("validates input and balance", async () => {
    const { post } = setup({ balances: { [COUNCIL[2]!]: 0.1 } });
    for (const body of [{ proposal_id: -1, member: 1, action: "approve" }, { proposal_id: 2, member: 4, action: "approve" }, { proposal_id: 2, member: 1, action: "abstain" }, { proposal_id: "2", member: 1, action: "approve" }]) {
      expect((await post("/api/dao/vote", body)).status).toBe(400);
    }
    expect((await (await post("/api/dao/vote", { proposal_id: 2, member: 3, action: "approve" })).json()).code).toBe("LOW_GAS_BALANCE");
  });
});

describe("demo member", () => {
  const ct = { epk: "AAAA", nonce: "BBBB", ct: "CCCC" };
  it("hands out the submit-only demo invite, and 503s when none is configured", async () => {
    const { app } = setup();
    const b = await (await app.request("/api/demo/invite")).json();
    expect(b).toMatchObject({ account_id: UNIT, contract_id: UNIT, network: "testnet", submit_method: "submit", slot: "ab".repeat(32) });
    expect(b.private_key).toMatch(/^ed25519:/);
    expect(b.rpc_urls[0]).toContain("fastnear");
    const none = setup({}, { demoInvite: undefined });
    const r = await none.app.request("/api/demo/invite");
    expect([r.status, (await r.json()).code]).toEqual([503, "DEMO_NOT_CONFIGURED"]);
  });
  it("signs submit server-side with the demo key as the unit account", async () => {
    const { post, sent } = setup();
    const r = await post("/api/demo/submit", { ciphertext: ct });
    const b = await r.json();
    expect([r.status, b.entry_count, b.tx.hash]).toEqual([200, 39, "SUBMITHASH"]);
    expect(sent[0]).toMatchObject({ receiver: UNIT, method: "submit", args: { ciphertext: ct } });
    expect(sent[0]!.signer).toEqual({ accountId: UNIT, privateKey: "ed25519:DEMOPRIVATEKEYFORTESTSONLY" });
  });
  it("validates the ciphertext, surfaces contract refusals, and checks the unit balance", async () => {
    const { post } = setup();
    expect((await post("/api/demo/submit", { ciphertext: { epk: "not base64!", nonce: "B", ct: "C" } })).status).toBe(400);
    expect((await post("/api/demo/submit", {})).status).toBe(400);
    const refused = setup({ failMethod: "submit" });
    const r = await refused.post("/api/demo/submit", { ciphertext: ct });
    expect([r.status, (await r.json()).code]).toEqual([422, "CHAIN_REJECTED"]);
    const poor = setup({ balances: { [UNIT]: 0.1 } });
    expect((await (await poor.post("/api/demo/submit", { ciphertext: ct })).json()).code).toBe("LOW_GAS_BALANCE");
  });
});

describe("rate limiting", () => {
  it("allows 10 writes per minute per IP, then 429 RATE_LIMITED with Retry-After", async () => {
    const { post, sent } = setup();
    const body = { proposal_id: 99, member: 1, action: "approve" };
    for (let i = 0; i < 10; i++) expect((await post("/api/dao/vote", body, { "x-forwarded-for": "9.9.9.9" })).status).toBe(404);
    const r = await post("/api/dao/vote", body, { "x-forwarded-for": "9.9.9.9" });
    expect([r.status, (await r.json()).code]).toEqual([429, "RATE_LIMITED"]);
    expect(Number(r.headers.get("retry-after"))).toBeGreaterThan(0);
    expect((await post("/api/dao/vote", body, { "x-forwarded-for": "8.8.8.8" })).status).toBe(404); // another IP is unaffected
    expect(sent).toHaveLength(0);
  });
  it("shares one bucket across the write endpoints and leaves reads alone", async () => {
    const { app, post } = setup();
    const h = { "x-forwarded-for": "7.7.7.7" };
    for (let i = 0; i < 5; i++) await post("/api/dao/propose", { group_by: [] }, h);
    for (let i = 0; i < 5; i++) await post("/api/demo/submit", {}, h);
    expect((await post("/api/dao/vote", {}, h)).status).toBe(429);
    for (let i = 0; i < 15; i++) expect((await app.request("/api/unit", { headers: h })).status).toBe(200);
  });
});

describe("RPC provider", () => {
  it("fails over across testnet endpoints and refuses mainnet", () => {
    const p = makeProvider() as unknown as { providers: { connection: { url: string } }[] };
    expect(p.providers.map((x) => x.connection.url)).toEqual(["https://test.rpc.fastnear.com", "https://archival-rpc.testnet.near.org"]);
    expect(() => makeProvider(["https://rpc.mainnet.near.org"])).toThrow(/non-testnet/);
    expect(() => makeProvider(["https://rpc.near.org"])).toThrow(/non-testnet/);
  });
});
