import { z } from "zod"
import { useQuery } from "@tanstack/react-query"
import { ReleaseRecordSchema, type ReleaseRecord, type Cell } from "@bandsheet/core"
import { ApiError, api, getReleasesApi } from "./api"

/* ---------- constants ---------- */

export const NETWORK = "testnet"
export const CONTRACT = "bandsheet-3f36b7.testnet"
export const DAO = "harbour-chapel.sputnik-v2.testnet"
export const OUTLAYER_PROJECT = "bandsheet-enclave.testnet/bandsheet-enclave"
/** Public testnet RPCs, tried in order. Both rate-limit, so callers cache hard. */
const RPCS = ["https://test.rpc.fastnear.com", "https://archival-rpc.testnet.near.org"]

export const explorer = {
  tx: (hash: string) => `https://testnet.nearblocks.io/txns/${hash}`,
  account: (id: string) => `https://testnet.nearblocks.io/address/${id}`,
  attestation: (hash: string) => `https://testnet-api.outlayer.ai/attestations/by-tx/${hash}`,
  dao: (id: string = DAO) => `https://testnet.nearblocks.io/address/${id}`,
}

/** Pull a tx hash out of a nearblocks URL or return the input when it already is one. */
export function txHashOf(urlOrHash: string): string {
  const m = urlOrHash.match(/txns\/([1-9A-HJ-NP-Za-km-z]{43,44})/)
  return m ? m[1]! : urlOrHash
}

/* ---------- raw view call (light: no near-api-js on read-only pages) ---------- */

const RpcOk = z.object({ result: z.object({ result: z.array(z.number()) }) })
const RpcErr = z.object({ error: z.object({ message: z.string().optional(), cause: z.unknown().optional() }).passthrough() })

export async function view<T>(contractId: string, method: string, args: Record<string, unknown> = {}): Promise<T> {
  const body = JSON.stringify({
    jsonrpc: "2.0",
    id: "bandsheet",
    method: "query",
    params: { request_type: "call_function", finality: "final", account_id: contractId, method_name: method, args_base64: btoa(JSON.stringify(args)) },
  })
  let last: unknown
  for (const url of RPCS) {
    try {
      const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body })
      if (res.status === 429) throw new ApiError("rate limited", "CHAIN_READ", 429)
      const json: unknown = await res.json()
      const ok = RpcOk.safeParse(json)
      if (ok.success) return JSON.parse(new TextDecoder().decode(new Uint8Array(ok.data.result.result))) as T
      const err = RpcErr.safeParse(json)
      throw new ApiError(err.success ? (err.data.error.message ?? "view failed") : "view failed", "CHAIN_READ", res.status)
    } catch (e) {
      last = e
    }
  }
  throw last instanceof ApiError ? last : new ApiError("NEAR testnet did not answer.", "CHAIN_READ")
}

const chainQuery = { staleTime: 60_000, gcTime: 10 * 60_000, retry: 3, retryDelay: (n: number) => Math.min(1500 * 2 ** n, 8000) }

/* ---------- policy (one call carries the unit card) ---------- */

export const PolicySchema = z.object({
  unit: z.string(),
  owner: z.string(),
  dao: z.string(),
  policy: z.object({ k: z.number(), enclave_pubkey: z.string(), wasm_sha256: z.string(), policy_hash: z.string() }),
  outlayer: z
    .object({ account: z.string(), source: z.string(), secrets_ref: z.string().optional(), run_deposit: z.string().optional() })
    .passthrough(),
  members: z.number(),
  entries: z.number(),
  releases: z.number(),
  in_flight: z.unknown().nullable().optional(),
})
export type Policy = z.infer<typeof PolicySchema>

/** /api/unit (server-cached) carries the same facts under slightly different names. */
const ApiUnitSchema = z
  .object({
    unit: z.string(),
    owner: z.string(),
    dao: z.string(),
    policy: PolicySchema.shape.policy,
    outlayer: PolicySchema.shape.outlayer,
    member_count: z.number(),
    entry_count: z.number(),
    release_count: z.number(),
    in_flight: z.unknown().nullable().optional(),
  })
  .transform((u): Policy => ({ ...u, members: u.member_count, entries: u.entry_count, releases: u.release_count }))

export function usePolicy() {
  return useQuery({
    queryKey: ["chain", "policy"],
    queryFn: async () => {
      try {
        return await api("/unit", ApiUnitSchema)
      } catch {
        return PolicySchema.parse(await view(CONTRACT, "get_policy"))
      }
    },
    ...chainQuery,
  })
}

/** OutLayer source is stored as a JSON string: {"Project":{"project_id":...}}. */
export function outlayerProject(p: Policy | undefined): string {
  try {
    const src = JSON.parse(p?.outlayer.source ?? "") as { Project?: { project_id?: string } }
    return src.Project?.project_id ?? OUTLAYER_PROJECT
  } catch {
    return OUTLAYER_PROJECT
  }
}

/* ---------- releases (server first, chain fallback) ---------- */

export type ReleasesData = { releases: ReleaseRecord[]; latest: { release_id: number; cells: Cell[] } | null; via: "server" | "chain" }

function latestBands(releases: ReleaseRecord[]): ReleasesData["latest"] {
  const seen = new Map<string, Cell>()
  let newest: number | null = null
  for (let i = releases.length - 1; i >= 0; i--) {
    const r = releases[i]!
    if (r.status !== "released" && r.status !== "partially_released") continue
    for (const c of r.cells) {
      newest ??= r.id
      const id = JSON.stringify(Object.entries(c.key).sort())
      if (!seen.has(id)) seen.set(id, c)
    }
  }
  return newest === null ? null : { release_id: newest, cells: [...seen.values()] }
}

export function useReleases() {
  return useQuery({
    queryKey: ["releases"],
    queryFn: async (): Promise<ReleasesData> => {
      try {
        const r = await getReleasesApi()
        return { releases: r.releases, latest: r.latest_bands, via: "server" }
      } catch {
        const raw = await view<unknown[]>(CONTRACT, "get_releases", { from: 0, limit: 50 })
        const releases = (Array.isArray(raw) ? raw : []).flatMap((x) => {
          const p = ReleaseRecordSchema.safeParse(x)
          return p.success ? [p.data] : []
        })
        return { releases, latest: latestBands(releases), via: "chain" }
      }
    },
    ...chainQuery,
  })
}

/* ---------- Sputnik DAO proposals ---------- */

export const ProposalSchema = z
  .object({
    id: z.number(),
    proposer: z.string(),
    description: z.string(),
    status: z.string(),
    kind: z.unknown(),
    vote_counts: z.record(z.string(), z.array(z.union([z.number(), z.string()]))).optional(),
    submission_time: z.union([z.string(), z.number()]).optional(),
  })
  .passthrough()
export type Proposal = z.infer<typeof ProposalSchema>

export function useProposals() {
  return useQuery({
    queryKey: ["chain", "dao", "proposals"],
    queryFn: async () => {
      try {
        return (await api("/dao/proposals", z.object({ proposals: z.array(ProposalSchema) }))).proposals
      } catch {
        return z.array(ProposalSchema).parse(await view(DAO, "get_proposals", { from_index: 0, limit: 50 }))
      }
    },
    ...chainQuery,
  })
}

/* ---------- static demo records (written by the deploy and demo scripts) ---------- */

export const DeployedSchema = z
  .object({
    unit: z.string(),
    dao: z.string(),
    council: z.array(z.string()).default([]),
    outsider: z.string().optional(),
    outlayer: z.string().optional(),
    wasm_sha256: z.string().optional(),
    unit_deploy_tx: z.string().optional(),
    unit_upgrade_tx: z.string().optional(),
    dao_create_tx: z.string().optional(),
  })
  .passthrough()
export type Deployed = z.infer<typeof DeployedSchema>

export const DemoLogSchema = z.record(z.string(), z.array(z.string()))
export type DemoLog = z.infer<typeof DemoLogSchema>

async function staticJson<T>(path: string, schema: z.ZodType<T>): Promise<T> {
  const res = await fetch(path)
  if (!res.ok) throw new ApiError(`${path} is missing`, "NOT_FOUND", res.status)
  return schema.parse(await res.json())
}

export const useDeployed = () =>
  useQuery({ queryKey: ["static", "deployed"], queryFn: () => staticJson("/data/deployed.json", DeployedSchema), staleTime: Infinity })
export const useDemoLog = () =>
  useQuery({ queryKey: ["static", "demo-log"], queryFn: () => staticJson("/data/demo-log.json", DemoLogSchema), staleTime: Infinity })
