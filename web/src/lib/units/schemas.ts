import { z } from "zod"
import { CellSchema, ReleaseRecordSchema, type Cell, type ReleaseRecord } from "@bandsheet/core"

/**
 * Shapes of the units contract views and the /api/units routes (UNITS-BRIEF interfaces). Every response is parsed
 * here and normalised to the camel-case types below, so the pages never read raw chain JSON.
 * Tolerant on purpose: snake_case and alternative names are accepted until contracts/units/INTERFACE.md pins them.
 */

const num = z.union([z.number(), z.string().regex(/^\d+$/).transform(Number)])
const strs = z.array(z.string()).catch([])

export const UnitRaw = z
  .object({
    id: num.optional(),
    unit_id: num.optional(),
    name: z.string(),
    creator: z.string(),
    council: strs.default([]),
    dkim_domains: strs.default([]),
    member_count: num.optional(),
    members: num.optional(),
    entry_count: num.optional(),
    entries: num.optional(),
    synthetic_count: num.optional(),
    synthetic_members: num.optional(),
    synthetic: num.optional(),
    threshold: num.optional(),
    in_flight: z.unknown().optional(),
    issuers: z.array(z.object({ domain: z.string(), selector: z.string(), source: z.string().optional(), key_sha256: z.string().optional() }).passthrough()).catch([]).default([]),
    release_count: num.optional(),
    releases: num.optional(),
    created_at: z.union([z.string(), z.number()]).optional(),
    pending_seats: z.array(z.object({ account_id: z.string(), approvals: strs.default([]) })).catch([]).default([]),
    joins: num.optional(),
  })
  .passthrough()

export type Unit = {
  id: number
  name: string
  creator: string
  council: string[]
  dkimDomains: string[]
  members: number
  entries: number
  synthetic: number
  releases: number
  createdAt: string | number | null
  issuers: { domain: string; selector: string; source?: string; key_sha256?: string }[]
  /** Seats asked for but not yet approved by more than half the council (unit_add_council on a 2+ seat council). */
  pendingSeats: { accountId: string; approvals: string[] }[]
}

export const toUnit = (u: z.infer<typeof UnitRaw>, fallbackId = 0): Unit => ({
  id: u.unit_id ?? u.id ?? fallbackId,
  name: u.name,
  creator: u.creator,
  council: u.council,
  dkimDomains: u.dkim_domains,
  members: u.member_count ?? u.members ?? 0,
  entries: u.entry_count ?? u.entries ?? 0,
  synthetic: u.synthetic_members ?? u.synthetic_count ?? u.synthetic ?? 0,
  releases: u.release_count ?? u.releases ?? 0,
  createdAt: u.created_at ?? null,
  issuers: u.issuers,
  pendingSeats: u.pending_seats.map((p) => ({ accountId: p.account_id, approvals: p.approvals })),
})

export const UnitSchema = UnitRaw.transform((u) => toUnit(u))

/* ---------- proposals ---------- */

export type ProposalStatus = "open" | "approved" | "running" | "done" | "rejected" | "withdrawn" | "expired" | "failed"

/**
 * open → approved → running → executed, or rejected, withdrawn, expired (open proposals expire after 7 days).
 * "approved" waits for POST /api/units/:id/run, which pays the 300 Tgas unit_run.
 */
function proposalStatus(s: string, hasRelease: boolean): ProposalStatus {
  const v = s.toLowerCase().replace(/[^a-z]/g, "")
  if (hasRelease || /released|done|executed|published|complete/.test(v)) return "done"
  if (/reject/.test(v)) return "rejected"
  if (/withdrawn/.test(v)) return "withdrawn"
  if (/expired/.test(v)) return "expired"
  if (/fail|error/.test(v)) return "failed"
  if (/approved/.test(v)) return "approved"
  if (/running|inflight|pending|engine/.test(v)) return "running"
  return "open"
}

export const ProposalRaw = z
  .object({
    id: num.optional(),
    proposal_id: num.optional(),
    proposer: z.string().default(""),
    query: z.unknown(),
    approvals: strs.default([]),
    rejections: strs.default([]),
    status: z.string().default("Open"),
    release_id: num.nullish(),
    created_at: z.union([z.string(), z.number()]).nullish(),
    council: strs.optional(),
  })
  .passthrough()

/** The units contract stores a query as JSON text ({"group_by":["grade"]}); pages want the object. */
export function parseQuery(q: unknown): unknown {
  if (typeof q !== "string") return q
  try {
    return JSON.parse(q)
  } catch {
    return null
  }
}

export const UnitProposalSchema = ProposalRaw.transform((p) => ({
  id: p.proposal_id ?? p.id ?? 0,
  proposer: p.proposer,
  query: parseQuery(p.query),
  approvals: p.approvals,
  rejections: p.rejections,
  /** Seats that existed when the proposal was made: only they can vote on it. */
  council: p.council ?? null,
  status: proposalStatus(p.status, p.release_id != null),
  rawStatus: p.status,
  releaseId: p.release_id ?? null,
  createdAt: p.created_at ?? null,
}))
export type UnitProposal = z.output<typeof UnitProposalSchema>

/* ---------- releases (the demo ReleaseRecord plus where each counted entry came from) ---------- */

const CountsRaw = z
  .object({
    entries: num.nullish(),
    dkim_verified: num.nullish(),
    entries_verified: num.nullish(),
    self_attested: num.nullish(),
    synthetic: num.nullish(),
    rejected: num.nullish(),
  })
  .passthrough()

/** dkim and self are null when the release's DKIM count run failed (INTERFACE.md); the page says "not counted". */
export type EntryCounts = { dkim: number | null; self: number | null; synthetic: number; rejected?: number; entries?: number }

const toCounts = (c: z.infer<typeof CountsRaw> | undefined): EntryCounts => ({
  dkim: c ? (c.dkim_verified ?? c.entries_verified ?? null) : 0,
  self: c ? (c.self_attested ?? null) : 0,
  synthetic: c?.synthetic ?? 0,
  rejected: c?.rejected ?? undefined,
  entries: c?.entries ?? undefined,
})

export type UnitRelease = ReleaseRecord & { counts: EntryCounts; proposalId: number | null; txHash: string | null }

export const UnitReleaseSchema = z
  .unknown()
  .transform((x, ctx): UnitRelease => {
    const r = ReleaseRecordSchema.safeParse(x)
    if (!r.success) {
      ctx.addIssue({ code: "custom", message: "not a release record" })
      return z.NEVER
    }
    const o = x as Record<string, unknown>
    const counts = CountsRaw.safeParse(o.counts ?? o)
    const pid = num.safeParse(o.proposal_id)
    const tx = z.string().safeParse(o.tx_hash ?? o.tx)
    const proofTx = z.object({ tx: z.string() }).partial().passthrough().safeParse(o.proof)
    return {
      ...r.data,
      query: parseQuery(r.data.query),
      counts: toCounts(counts.success ? counts.data : undefined),
      proposalId: pid.success ? pid.data : null,
      txHash: tx.success ? tx.data : proofTx.success && proofTx.data.tx ? proofTx.data.tx : null,
    }
  })

/* ---------- contract policy (shared engine, so the same enclave key and engine hash as the demo) ---------- */

/** get_policy's outlayer is {account, source: '{"Project":{"project_id":…}}'}; pages show the project id. */
function outlayerProjectOf(o: unknown): string | null {
  if (typeof o === "string") return o
  const source = (o as { source?: unknown } | null)?.source
  if (typeof source !== "string") return null
  try {
    return (JSON.parse(source) as { Project?: { project_id?: string } }).Project?.project_id ?? null
  } catch {
    return null
  }
}

const PolicyInner = z.object({ k: num, enclave_pubkey: z.string(), wasm_sha256: z.string(), policy_hash: z.string().optional() }).passthrough()
export const UnitsPolicySchema = z
  .union([z.object({ policy: PolicyInner }).passthrough().transform((p) => ({ ...p.policy, outlayer: p.outlayer })), PolicyInner.extend({ outlayer: z.unknown().optional() })])
  .transform((p) => ({
    k: p.k,
    enclavePubkey: p.enclave_pubkey,
    wasmSha256: p.wasm_sha256,
    policyHash: p.policy_hash ?? null,
    outlayer: outlayerProjectOf(p.outlayer),
  }))
export type UnitsPolicy = z.output<typeof UnitsPolicySchema>

/* ---------- GET /api/units/:id (aggregated view) ---------- */

export type UnitView = {
  unit: Unit
  proposals: UnitProposal[]
  releases: UnitRelease[]
  latest: { release_id: number; cells: Cell[] } | null
}

export const UnitViewSchema = z
  .object({
    unit: UnitRaw,
    proposals: z.array(UnitProposalSchema).default([]),
    releases: z.array(UnitReleaseSchema).default([]),
    latest_bands: z.object({ release_id: num, cells: z.array(CellSchema) }).nullish(),
  })
  .passthrough()
  .transform((v): UnitView => ({ unit: toUnit(v.unit), proposals: v.proposals, releases: v.releases, latest: v.latest_bands ?? null }))

/* ---------- server routes ---------- */

const TxOut = z.object({ hash: z.string(), url: z.string().optional() })

export const SponsorSchema = z.object({ funded: z.boolean(), tx: TxOut.nullish(), balance: z.union([z.string(), z.number()]).optional() })
export type SponsorResult = z.infer<typeof SponsorSchema>

export const JoinSchema = z.object({ slot: z.string(), tx: TxOut.nullish(), unit_id: num.optional() }).passthrough()
export type UnitJoinResult = z.infer<typeof JoinSchema>

export const SyntheticSchema = z.object({ added: num, txs: z.array(TxOut).default([]), synthetic_total: num.optional() }).passthrough()
export type SyntheticResult = z.infer<typeof SyntheticSchema>

export const IssuerSchema = z.object({ domain: z.string(), selector: z.string(), tx: TxOut.nullish(), already: z.boolean().optional() }).passthrough()
export type IssuerResult = z.infer<typeof IssuerSchema>

export const NonceSchema = z.object({ nonce: z.string(), recipient: z.string() }).passthrough()

export const RunSchema = z.object({ status: z.string(), tx: TxOut.nullish(), proposal_id: num.optional() }).passthrough()
export type RunResult = z.infer<typeof RunSchema>

export const EntryReplySchema = z.object({ slot: z.string(), ct_sha256: z.string().optional(), tx: TxOut.nullish(), entry_count: num.nullish() }).passthrough()

export const UnitOfSlotSchema = z
  .object({ unit_id: num, synthetic: z.boolean().default(false), has_entry: z.boolean().default(false) })
  .passthrough()
  .nullable()
  .transform((s) => (s ? { unitId: s.unit_id, synthetic: s.synthetic, hasEntry: s.has_entry } : null))

export const UnitsListSchema = z.object({ units: z.array(UnitRaw) }).transform((v) => v.units.map((u) => toUnit(u)))
