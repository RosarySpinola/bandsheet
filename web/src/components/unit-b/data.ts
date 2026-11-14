import { z } from "zod"
import { useQuery } from "@tanstack/react-query"
import { ApiError, api } from "@/lib/api"
import { CONTRACT, DAO, txHashOf, useDemoLog, view } from "@/lib/chain"
import type { QueryLike } from "./format"

/** Release id -> hash of the tx that executed it (the approving vote that called OutLayer). */
export function useReleaseTxs(): Record<number, string> {
  const { data } = useDemoLog()
  const map: Record<number, string> = {}
  for (const [k, links] of Object.entries(data ?? {})) {
    const m = /^release_(\d+)$/.exec(k)
    const last = links.at(-1)
    if (m && last) map[Number(m[1])] = txHashOf(last)
  }
  return map
}

const AttestationSchema = z
  .object({
    transaction_hash: z.string(),
    executed_wasm_sha256: z.string().optional(),
    wasm_hash: z.string().optional(),
    input_hash: z.string().optional(),
    output_hash: z.string().optional(),
    project_id: z.string().optional(),
    timestamp: z.number().optional(),
  })
  .passthrough()
export type Attestation = z.infer<typeof AttestationSchema>

/** OutLayer's TEE attestation for the tx that ran the engine (public endpoint, CORS open). */
export function useAttestation(tx: string | undefined) {
  return useQuery({
    queryKey: ["outlayer", "attestation", tx],
    enabled: Boolean(tx),
    staleTime: Infinity,
    retry: 1,
    queryFn: async () => {
      const res = await fetch(`https://testnet-api.outlayer.ai/attestations/by-tx/${tx}`)
      if (!res.ok) throw new ApiError("OutLayer has no attestation for this transaction.", "NOT_FOUND", res.status)
      return AttestationSchema.parse(await res.json())
    },
  })
}

const EvalSide = z.object({ leaked: z.boolean(), exact_recoveries: z.number(), isolated_pairs: z.number(), worst_recovery_error_eur: z.number().optional() })
const EvaluationSchema = z.object({
  summary: z.object({
    cases: z.number(),
    k: z.number(),
    attacker: z.string(),
    generator: z.string(),
    naive: z.object({ cases_leaking: z.number(), cases_with_exact_recovery: z.number(), members_exactly_recovered: z.number(), cells_published: z.number() }),
    bandsheet: z.object({ cases_leaking: z.number(), cells_published: z.number(), secondary_suppressions: z.number() }),
  }),
  cases: z.array(
    z.object({
      case: z.number(),
      pattern: z.string(),
      naive: EvalSide,
      bandsheet: EvalSide,
      releases: z.array(z.object({ release: z.number(), members: z.number(), naive_cells_published: z.number(), bandsheet_cells_published: z.number() }).passthrough()),
    }),
  ),
})
export type Evaluation = z.infer<typeof EvaluationSchema>
export type EvalCase = Evaluation["cases"][number]

export const useEvaluation = () =>
  useQuery({
    queryKey: ["static", "evaluation"],
    staleTime: Infinity,
    queryFn: async () => {
      const res = await fetch("/data/evaluation.json")
      if (!res.ok) throw new ApiError("The evaluation file is missing.", "NOT_FOUND", res.status)
      return EvaluationSchema.parse(await res.json())
    },
  })

/* ---------- Sputnik DAO release proposals ---------- */

export type ProposalKind = "release" | "trust_employer" | "require_dkim" | "engine" | "other"

export type DaoProposal = {
  id: number
  kind: ProposalKind
  /** decoded one-line summary for governance proposals; release proposals fall back to the query */
  summary: string | null
  description: string
  proposer: string
  status: string
  query: QueryLike
  votes: Record<string, string>
  submission_time: string | null
}

const KindSchema = z.enum(["release", "trust_employer", "require_dkim", "engine", "other"]).catch("other")

const DaoProposalSchema = z.object({
  id: z.number(),
  kind: KindSchema.optional(),
  summary: z.string().nullable().optional(),
  description: z.string(),
  proposer: z.string(),
  status: z.string(),
  query: z.unknown(),
  votes: z.record(z.string(), z.string()).default({}),
  submission_time: z.string().nullable().default(null),
})
const ProposalsResponse = z.object({ proposals: z.array(DaoProposalSchema) })

type RawProposal = { id: number; proposer: string; description: string; status: string; kind: unknown; votes?: Record<string, string>; submission_time?: string }

const METHOD_KIND: Record<string, ProposalKind> = {
  request_release: "release",
  add_issuer: "trust_employer",
  set_require_dkim: "require_dkim",
  set_engine: "engine",
}

function decodeKind(kind: unknown): ProposalKind {
  const fc = (kind as { FunctionCall?: { receiver_id: string; actions: { method_name: string }[] } })?.FunctionCall
  const m = fc?.receiver_id === CONTRACT ? fc.actions?.[0]?.method_name : undefined
  return (m && METHOD_KIND[m]) || "other"
}

function decodeQuery(kind: unknown): QueryLike | undefined {
  const fc = (kind as { FunctionCall?: { receiver_id: string; actions: { method_name: string; args: string }[] } })?.FunctionCall
  const act = fc?.actions?.[0]
  if (!fc || fc.receiver_id !== CONTRACT || act?.method_name !== "request_release") return undefined
  try {
    const args = JSON.parse(atob(act.args)) as { query?: string }
    return typeof args.query === "string" ? (JSON.parse(args.query) as QueryLike) : null
  } catch {
    return null
  }
}

async function proposalsFromChain(): Promise<DaoProposal[]> {
  const raw = await view<RawProposal[]>(DAO, "get_proposals", { from_index: 0, limit: 100 })
  return raw.map((p) => {
    const kind = decodeKind(p.kind)
    const query = kind === "release" ? (decodeQuery(p.kind) ?? null) : null
    const ts = p.submission_time ? new Date(Number(BigInt(p.submission_time) / 1_000_000n)).toISOString() : null
    return { id: p.id, kind, summary: kind === "release" ? null : p.description, description: p.description, proposer: p.proposer, status: p.status, query, votes: p.votes ?? {}, submission_time: ts }
  })
}

/** Every proposal on the chapel's DAO (releases and governance), newest first. Server route first, chain view as fallback. */
export function useDaoProposals(opts: { poll?: number | false; frozen?: boolean } = {}) {
  return useQuery({
    queryKey: ["dao", "release-proposals"],
    staleTime: opts.frozen ? Infinity : 20_000,
    refetchOnWindowFocus: !opts.frozen,
    refetchInterval: opts.frozen ? false : (opts.poll ?? false),
    retry: 2,
    queryFn: async (): Promise<DaoProposal[]> => {
      let list: DaoProposal[]
      try {
        list = (await api("/dao/proposals", ProposalsResponse)).proposals.map((p) => ({
          ...p,
          // older servers listed release proposals only, without a kind
          kind: p.kind ?? (p.query ? "release" : "other"),
          summary: p.summary ?? null,
          query: p.query as QueryLike,
        }))
      } catch (err) {
        if (err instanceof ApiError && err.status === 429) throw err
        list = await proposalsFromChain()
      }
      return list.sort((a, b) => b.id - a.id)
    },
  })
}

export const ProposeResponse = z.object({
  proposal_id: z.number(),
  description: z.string(),
  proposer: z.string().optional(),
  tx: z.object({ hash: z.string(), url: z.string() }),
})
export type ProposeResult = z.infer<typeof ProposeResponse>

export const VoteResponse = z.object({
  proposal_id: z.number(),
  voter: z.string(),
  action: z.enum(["approve", "reject"]),
  status: z.string(),
  votes: z.record(z.string(), z.string()).optional(),
  tx: z.object({ hash: z.string(), url: z.string() }),
  note: z.string().optional(),
})
export type VoteResult = z.infer<typeof VoteResponse>

const UnitResponse = z.object({ policy: z.object({ k: z.number(), wasm_sha256: z.string() }).passthrough() }).passthrough()

/** The engine WASM hash the contract policy pins. Server's /api/unit first; direct chain view as fallback. */
export function usePolicyWasm() {
  return useQuery({
    queryKey: ["unit-b", "policy-wasm"],
    staleTime: 10 * 60_000,
    retry: 2,
    queryFn: async (): Promise<string> => {
      try {
        return (await api("/unit", UnitResponse)).policy.wasm_sha256
      } catch {
        const p = await view<{ policy: { wasm_sha256: string } }>(CONTRACT, "get_policy")
        return p.policy.wasm_sha256
      }
    },
  })
}
