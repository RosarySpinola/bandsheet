import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Invite } from "@bandsheet/core/near";
import type { ChainConfig } from "../src/chain/config";
import type { ChainPort, SentTx, Signer } from "../src/chain/port";
import type { Config } from "../src/env";

export const UNIT = "bandsheet-test.testnet";
export const DAO = "chapel-test.sputnik-v2.testnet";
export const COUNCIL = ["bs-c1-test.testnet", "bs-c2-test.testnet", "bs-c3-test.testnet"];

export const config: Config = {
  hasKey: true, baseUrl: "https://example.invalid", contract: UNIT, releasesMethod: "get_releases",
  rpcUrl: "https://example.invalid", port: 0, visionModel: "Qwen/Qwen3-VL-30B-A3B-Instruct", textModel: "z-ai/glm-5.3-flash",
  ledgerPath: join(mkdtempSync(join(tmpdir(), "app-")), ".spend.json"), corsOrigin: "*",
};

export const demoInvite: Invite = {
  accountId: UNIT, contractId: UNIT, privateKey: "ed25519:DEMOPRIVATEKEYFORTESTSONLY", publicKey: "ed25519:DemoPub", slot: "ab".repeat(32), rpcUrl: "https://example.invalid",
};

export const chainCfg = (over: Partial<ChainConfig> = {}): ChainConfig => ({
  unit: UNIT, dao: DAO, council: COUNCIL,
  councilKeys: Object.fromEntries(COUNCIL.map((c, i) => [c, `ed25519:KEY${i + 1}`])),
  demoInvite,
  explorer: { base: "https://testnet.nearblocks.io", address: "https://testnet.nearblocks.io/address/", tx: "https://testnet.nearblocks.io/txns/" },
  ...over,
});

export interface Sent { signer: Signer; receiver: string; method: string; args: Record<string, unknown>; deposit: bigint; tgas: number }

const b64 = (o: unknown): string => Buffer.from(JSON.stringify(o)).toString("base64");
export const releaseKind = (query: object) => ({
  FunctionCall: { receiver_id: UNIT, actions: [{ method_name: "request_release", args: b64({ query: JSON.stringify(query) }), deposit: "0", gas: "200000000000000" }] },
});
export const otherKind = { Transfer: { receiver_id: "x.testnet", amount: "1" } };

/** In-memory mock of NEAR testnet: the unit contract, a Sputnik-like DAO (2-of-3), balances. */
export function mockChain(opts: { balances?: Record<string, number>; failMethod?: string } = {}) {
  const sent: Sent[] = [];
  const proposals: Record<string, unknown>[] = [
    { id: 0, proposer: COUNCIL[0], description: "Release mean pay by grade", kind: releaseKind({ group_by: ["grade"], stat: "mean" }), status: "Approved", vote_counts: { council: [2, 0, 0] }, votes: { [COUNCIL[0]!]: "Approve", [COUNCIL[1]!]: "Approve" }, submission_time: "1760000000000000000" },
    { id: 1, proposer: COUNCIL[0], description: "Pay the caterer", kind: otherKind, status: "InProgress", votes: {}, submission_time: "1760000100000000000" },
    { id: 2, proposer: COUNCIL[0], description: "Release by gender", kind: releaseKind({ group_by: ["gender"], stat: "mean" }), status: "InProgress", votes: {}, submission_time: "1760000200000000000" },
  ];
  const balances: Record<string, number> = { ...Object.fromEntries([UNIT, ...COUNCIL].map((a) => [a, 5])), ...opts.balances };
  let n = 38;
  const chain: ChainPort = {
    async view<T>(contract: string, method: string, args: Record<string, unknown> = {}): Promise<T> {
      if (contract === UNIT && method === "get_policy") {
        return { unit: UNIT, owner: "owner.testnet", dao: DAO, policy: { k: 3, enclave_pubkey: "cd".repeat(32), wasm_sha256: "ee" }, outlayer: { account: "outlayer.testnet", source: "src", secrets_ref: "SECRET" }, members: 38, entries: 37, releases: 2, in_flight: null } as T;
      }
      if (contract === DAO && method === "get_policy") return { proposal_bond: "100000000000000000000000" } as T;
      if (contract === DAO && method === "get_last_proposal_id") return proposals.length as T;
      if (contract === DAO && method === "get_proposals") {
        const from = Number(args.from_index), lim = Number(args.limit);
        return proposals.slice(from, from + lim) as T;
      }
      if (contract === DAO && method === "get_proposal") return (proposals.find((p) => p.id === args.id) ?? null) as T;
      throw new Error(`unmocked view ${contract}.${method}`);
    },
    async send(signer, receiver, method, args, o): Promise<SentTx> {
      sent.push({ signer, receiver, method, args: args as Record<string, unknown>, deposit: o.depositYocto ?? 0n, tgas: o.tgas });
      if (method === opts.failMethod) return { hash: "FAILHASH", ok: false, error: "Refused: this key is not a registered member of the union", value: undefined };
      if (method === "add_proposal") {
        const p = args as { proposal: { description: string; kind: unknown } };
        proposals.push({ id: proposals.length, proposer: signer.accountId, description: p.proposal.description, kind: p.proposal.kind, status: "InProgress", votes: {}, submission_time: "1760000300000000000" });
        return { hash: "PROPOSEHASH", ok: true, error: "", value: proposals.length - 1 };
      }
      if (method === "act_proposal") {
        const a = args as { id: number; action: string };
        const p = proposals.find((x) => x.id === a.id) as { votes: Record<string, string>; status: string };
        p.votes[signer.accountId] = a.action === "VoteApprove" ? "Approve" : "Reject";
        const approvals = Object.values(p.votes).filter((v) => v === "Approve").length;
        const rejects = Object.values(p.votes).filter((v) => v === "Reject").length;
        if (approvals >= 2) p.status = "Approved";
        else if (rejects >= 2) p.status = "Rejected";
        return { hash: "VOTEHASH", ok: true, error: "", value: undefined };
      }
      if (method === "submit") return { hash: "SUBMITHASH", ok: true, error: "", value: String(++n) };
      throw new Error(`unmocked send ${method}`);
    },
    async balanceNear(id) {
      const b = balances[id];
      if (b === undefined) throw new Error("no such account");
      return b;
    },
  };
  return { chain, sent, proposals, balances };
}
