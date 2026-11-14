import { createHash } from "node:crypto";
import { GENDERS, GRADES, GROUP_FIELDS, SITES } from "@bandsheet/core";
import { z } from "zod";
import { AppError } from "../errors";
import type { ChainConfig } from "./config";
import type { ChainPort, SentTx } from "./port";

/** Gas for request_release: the DAO forwards most of it on to OutLayer. */
const RELEASE_GAS = "200000000000000";
const VOTE_TGAS = 270;
/** Refuse writes when the acting account holds less than this (override with MIN_BALANCE_NEAR). */
export const MIN_BALANCE_NEAR = Number(process.env.MIN_BALANCE_NEAR ?? 0.3);

const VALUES: Record<string, readonly string[]> = { grade: GRADES, gender: GENDERS, site: SITES };

export const ProposeSchema = z
  .object({
    group_by: z.array(z.enum(GROUP_FIELDS)).min(1).max(3).refine((a) => new Set(a).size === a.length, "duplicate field"),
    filter: z.partialRecord(z.enum(GROUP_FIELDS), z.string()).optional(),
  })
  .superRefine((v, ctx) => {
    for (const [f, val] of Object.entries(v.filter ?? {})) {
      if (!VALUES[f]!.includes(val)) ctx.addIssue({ code: "custom", message: `bad value for ${f}`, path: ["filter", f] });
    }
  });
export type ProposeInput = z.infer<typeof ProposeSchema>;

export const VoteSchema = z.object({
  proposal_id: z.number().int().min(0),
  member: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  action: z.enum(["approve", "reject"]),
});

interface RawProposal {
  id: number;
  proposer: string;
  description: string;
  kind: unknown;
  status: string;
  vote_counts?: Record<string, number[]>;
  votes?: Record<string, string>;
  submission_time?: string;
}

interface FnCallKind {
  FunctionCall: { receiver_id: string; actions: { method_name: string; args: string }[] };
}

export type ProposalKind = "release" | "trust_employer" | "require_dkim" | "engine" | "poll" | "council" | "other";

interface Decoded {
  kind: ProposalKind;
  summary: string;
  query: unknown;
}

const fingerprint = (spkiB64: string): string => createHash("sha256").update(Buffer.from(spkiB64, "base64")).digest("hex").slice(0, 8);

/**
 * Decode a DAO proposal that calls the unit contract: a request_release, or a governance call
 * (add_issuer, remove_issuer, set_require_dkim, set_engine). Anything not targeting the unit returns undefined.
 */
export function decodeProposal(kind: unknown, unit: string, description = ""): Decoded | undefined {
  // The chapel's own business that is not a contract call: signalling polls and council seat changes.
  if (kind === "Vote") return { kind: "poll", summary: description, query: null };
  const role = kind as { AddMemberToRole?: { member_id: string; role: string }; RemoveMemberFromRole?: { member_id: string; role: string } };
  if (role?.AddMemberToRole) return { kind: "council", summary: `Give ${role.AddMemberToRole.member_id} a ${role.AddMemberToRole.role} seat`, query: null };
  if (role?.RemoveMemberFromRole) return { kind: "council", summary: `Remove ${role.RemoveMemberFromRole.member_id} from the ${role.RemoveMemberFromRole.role}`, query: null };
  const fc = (kind as FnCallKind | undefined)?.FunctionCall;
  const act = fc?.actions?.[0];
  if (!fc || fc.receiver_id !== unit || !act) return undefined;
  let args: Record<string, unknown> = {};
  try {
    args = JSON.parse(Buffer.from(act.args, "base64").toString("utf8")) as Record<string, unknown>;
  } catch {
    // undecodable args: fall through to "other" below
  }
  const str = (k: string): string => (typeof args[k] === "string" ? (args[k] as string) : "");
  switch (act.method_name) {
    case "request_release": {
      let query: unknown = null;
      try {
        query = typeof args.query === "string" ? JSON.parse(args.query) : null;
      } catch {
        query = null;
      }
      return { kind: "release", summary: description, query };
    }
    case "add_issuer": {
      const id = `${str("selector")}._domainkey.${str("domain")}`;
      const fp = str("rsa_pubkey_spki_b64") ? `, key ${fingerprint(str("rsa_pubkey_spki_b64"))}` : "";
      return { kind: "trust_employer", summary: `Trust ${id}${fp}`, query: null };
    }
    case "remove_issuer":
      return { kind: "trust_employer", summary: `Stop trusting ${str("selector")}._domainkey.${str("domain")}`, query: null };
    case "set_require_dkim":
      return { kind: "require_dkim", summary: `Require employer-signed payslips: ${args.on === true ? "on" : "off"}`, query: null };
    case "set_engine":
      return { kind: "engine", summary: `Adopt engine ${str("wasm_sha256").slice(0, 8)}\u2026`, query: null };
    default:
      return { kind: "other", summary: `${act.method_name}${description ? `: ${description}` : ""}`, query: null };
  }
}

/** Decode a request_release proposal's query, or undefined when the proposal is something else. */
export function releaseQueryOf(kind: unknown, unit: string): unknown | undefined {
  const d = decodeProposal(kind, unit);
  return d?.kind === "release" ? d.query : undefined;
}

export interface ProposalView {
  id: number;
  description: string;
  proposer: string;
  status: string;
  query: unknown;
  votes: Record<string, string>;
  vote_counts: Record<string, number[]>;
  submission_time: string | null;
  kind: ProposalKind;
  summary: string;
}

/** The chapel's proposals that call the unit contract (releases and governance), newest first. */
export async function listReleaseProposals(chain: ChainPort, cfg: ChainConfig, limit = 50): Promise<ProposalView[]> {
  const last = await chain.view<number>(cfg.dao, "get_last_proposal_id");
  if (!last) return [];
  const from = Math.max(0, last - limit);
  const raw = await chain.view<RawProposal[]>(cfg.dao, "get_proposals", { from_index: from, limit: last - from });
  return raw
    .map((p): ProposalView | undefined => {
      const d = decodeProposal(p.kind, cfg.unit, p.description);
      if (!d) return undefined;
      return {
        id: p.id,
        description: p.description,
        proposer: p.proposer,
        status: p.status,
        query: d.query,
        votes: p.votes ?? {},
        vote_counts: p.vote_counts ?? {},
        submission_time: p.submission_time ? new Date(Number(BigInt(p.submission_time) / 1_000_000n)).toISOString() : null,
        kind: d.kind,
        summary: d.summary,
      };
    })
    .filter((p): p is ProposalView => p !== undefined)
    .sort((a, b) => b.id - a.id);
}

export async function assertFunded(chain: ChainPort, accountId: string): Promise<void> {
  let bal: number;
  try {
    bal = await chain.balanceNear(accountId);
  } catch {
    throw new AppError(502, "could not read the account balance from NEAR testnet", "CHAIN_READ");
  }
  if (bal < MIN_BALANCE_NEAR) {
    throw new AppError(503, `account ${accountId} is below ${MIN_BALANCE_NEAR} NEAR; top it up from the faucet`, "LOW_GAS_BALANCE");
  }
}

const chainFailure = (tx: SentTx): AppError =>
  new AppError(422, tx.error ? `the chain refused: ${tx.error}` : "the chain refused the transaction", "CHAIN_REJECTED");

const describe = (q: ProposeInput): string =>
  `Release mean pay by ${q.group_by.join(" and ")}${q.filter ? ` (filtered: ${Object.entries(q.filter).map(([k, v]) => `${k}=${v}`).join(", ")})` : ""}`;

export async function proposeRelease(
  chain: ChainPort,
  cfg: ChainConfig,
  signer: { accountId: string; privateKey: string },
  input: ProposeInput,
): Promise<{ proposal_id: number; tx: SentTx; description: string }> {
  await assertFunded(chain, signer.accountId);
  // The DAO policy sets the bond a proposal must attach; read it rather than assume zero.
  const policy = await chain.view<{ proposal_bond?: string }>(cfg.dao, "get_policy").catch(() => undefined);
  const bond = BigInt(policy?.proposal_bond ?? "0");
  const query = { group_by: input.group_by, ...(input.filter ? { filter: input.filter } : {}), stat: "mean" };
  const description = describe(input);
  const kind = {
    FunctionCall: {
      receiver_id: cfg.unit,
      actions: [{
        method_name: "request_release",
        args: Buffer.from(JSON.stringify({ query: JSON.stringify(query) })).toString("base64"),
        deposit: "0",
        gas: RELEASE_GAS,
      }],
    },
  };
  const tx = await chain.send(signer, cfg.dao, "add_proposal", { proposal: { description, kind } }, { tgas: 60, depositYocto: bond });
  if (!tx.ok) throw chainFailure(tx);
  if (typeof tx.value !== "number") throw new AppError(502, "the DAO did not return a proposal id", "CHAIN_READ");
  return { proposal_id: tx.value, tx, description };
}

export async function voteRelease(
  chain: ChainPort,
  cfg: ChainConfig,
  signer: { accountId: string; privateKey: string },
  input: z.infer<typeof VoteSchema>,
): Promise<{ tx: SentTx; status: string; votes: Record<string, string> }> {
  await assertFunded(chain, signer.accountId);
  const p = await chain.view<RawProposal | null>(cfg.dao, "get_proposal", { id: input.proposal_id }).catch(() => null);
  if (!p) throw new AppError(404, "no such proposal", "PROPOSAL_NOT_FOUND");
  if (releaseQueryOf(p.kind, cfg.unit) === undefined) {
    throw new AppError(422, "that proposal is not a release request for this unit", "NOT_A_RELEASE_PROPOSAL");
  }
  if (p.status !== "InProgress") throw new AppError(409, `proposal is already ${p.status}`, "PROPOSAL_CLOSED");
  if (p.votes?.[signer.accountId]) throw new AppError(409, "this council member already voted", "ALREADY_VOTED");
  const tx = await chain.send(
    signer, cfg.dao, "act_proposal",
    { id: input.proposal_id, action: input.action === "approve" ? "VoteApprove" : "VoteReject", proposal: p.kind },
    { tgas: VOTE_TGAS },
  );
  if (!tx.ok) throw chainFailure(tx);
  const after = await chain.view<RawProposal>(cfg.dao, "get_proposal", { id: input.proposal_id }).catch(() => p);
  return { tx, status: after.status, votes: after.votes ?? {} };
}
