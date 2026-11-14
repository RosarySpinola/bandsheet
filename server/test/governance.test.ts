import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { decodeProposal, listReleaseProposals } from "../src/chain/dao";
import { REPO_ROOT } from "../src/env";
import { COUNCIL, DAO, UNIT, chainCfg, otherKind, releaseKind } from "./helpers";

// Real issuer key from the DKIM fixtures (synthetic employer).
const issuer = JSON.parse(readFileSync(resolve(REPO_ROOT, "fixtures/dkim/issuer.json"), "utf8")) as { domain: string; selector: string; rsa_pubkey_spki_b64: string };
const fp = createHash("sha256").update(Buffer.from(issuer.rsa_pubkey_spki_b64, "base64")).digest("hex").slice(0, 8);

const call = (method: string, args: object, receiver = UNIT) => ({
  FunctionCall: { receiver_id: receiver, actions: [{ method_name: method, args: Buffer.from(JSON.stringify(args)).toString("base64"), deposit: "0", gas: "100000000000000" }] },
});
const WASM = "69d5616c" + "ab".repeat(28);
const raw = (id: number, description: string, kind: unknown) => ({
  id, proposer: COUNCIL[0], description, kind, status: "Approved", votes: { [COUNCIL[0]!]: "Approve" }, vote_counts: {}, submission_time: `${1760000000000 + id * 1000}000000`,
});
const proposals = [
  raw(0, "Release #1", releaseKind({ group_by: ["grade"], stat: "mean" })),
  raw(1, "Trust payroll", call("add_issuer", issuer)),
  raw(2, "Require DKIM", call("set_require_dkim", { on: true })),
  raw(3, "Adopt engine", call("set_engine", { wasm_sha256: WASM, enclave_pubkey: null })),
  raw(4, "Pay caterer", otherKind),
  raw(5, "Drop payroll", call("remove_issuer", { domain: issuer.domain, selector: issuer.selector })),
  raw(6, "Elsewhere", call("add_issuer", issuer, "other.testnet")),
  raw(7, "Odd call", call("set_demo_owner_override", { on: true })),
  raw(8, "Require off", call("set_require_dkim", { on: false })),
];
const chain = {
  async view<T>(contract: string, method: string, args: Record<string, unknown> = {}): Promise<T> {
    if (contract !== DAO) throw new Error("unmocked");
    if (method === "get_last_proposal_id") return proposals.length as T;
    if (method === "get_proposals") return proposals.slice(Number(args.from_index), Number(args.from_index) + Number(args.limit)) as T;
    throw new Error("unmocked");
  },
  send: async () => { throw new Error("no"); },
  balanceNear: async () => 5,
};

describe("DAO proposals include governance", () => {
  it("lists releases and unit governance calls newest first, each with kind and summary", async () => {
    const list = await listReleaseProposals(chain, chainCfg());
    expect(list.map((p) => [p.id, p.kind])).toEqual([[8, "require_dkim"], [7, "other"], [5, "trust_employer"], [3, "engine"], [2, "require_dkim"], [1, "trust_employer"], [0, "release"]]);
    const by = Object.fromEntries(list.map((p) => [p.id, p]));
    expect(by[1]!.summary).toBe(`Trust ${issuer.selector}._domainkey.${issuer.domain}, key ${fp}`);
    expect(by[2]!.summary).toBe("Require employer-signed payslips: on");
    expect(by[8]!.summary).toBe("Require employer-signed payslips: off");
    expect(by[3]!.summary).toBe("Adopt engine 69d5616c…");
    expect(by[5]!.summary).toBe(`Stop trusting ${issuer.selector}._domainkey.${issuer.domain}`);
    expect(by[7]!.summary).toBe("set_demo_owner_override: Odd call");
    expect(by[0]).toMatchObject({ query: { group_by: ["grade"], stat: "mean" }, summary: "Release #1", description: "Release #1", status: "Approved" });
    expect(by[1]!.query).toBeNull();
    expect(by[1]).toHaveProperty("votes");
    expect(by[1]).toHaveProperty("submission_time");
  });
  it("ignores proposals aimed at other contracts or with undecodable args", () => {
    expect(decodeProposal(call("add_issuer", issuer, "other.testnet"), UNIT)).toBeUndefined();
    expect(decodeProposal(otherKind, UNIT)).toBeUndefined();
    const bad = { FunctionCall: { receiver_id: UNIT, actions: [{ method_name: "add_issuer", args: "!!!notjson", deposit: "0", gas: "1" }] } };
    expect(decodeProposal(bad, UNIT)?.kind).toBe("trust_employer");
  });
});
