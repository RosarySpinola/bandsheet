import { z } from "zod"
import { StandResponseSchema, api, postJson, ApiError } from "@/lib/api"
import { view } from "@/lib/chain"
import { rpcPost } from "@/lib/rpc"
import { UNITS_CONTRACT } from "./config"
import {
  AttackPrepSchema, AttacksSchema, EntryReplySchema, IssuerSchema, JoinSchema, NonceSchema, RunSchema, SponsorSchema, SyntheticSchema, UnitOfSlotSchema, UnitProposalSchema, UnitRaw,
  UnitReleaseSchema, UnitViewSchema, UnitsListSchema, UnitsPolicySchema, toUnit, type Unit, type UnitView,
} from "./schemas"
import type { UnitsClient } from "./types"

/** Live client (contracts/units/INTERFACE.md): /api/units first, contract views over public RPC as the fallback. */

const C = UNITS_CONTRACT
const notFound = (id: number) => new ApiError(`There is no unit ${id} on the units contract.`, "UNIT_NOT_FOUND", 404)

async function viewFromChain(unitId: number): Promise<UnitView> {
  const raw = await view<unknown>(C, "get_unit", { unit_id: unitId })
  if (raw === null || raw === undefined) throw notFound(unitId)
  const u = UnitRaw.safeParse(raw)
  if (!u.success) throw new ApiError("The units contract answered in an unexpected shape.", "BAD_RESPONSE")
  const [proposals, releases] = await Promise.all([
    view<unknown>(C, "get_unit_proposals", { unit_id: unitId, from: 0, limit: 50 }).then((x) => z.array(UnitProposalSchema).parse(x ?? [])),
    view<unknown>(C, "get_unit_releases", { unit_id: unitId, from: 0, limit: 50 }).then((x) => z.array(UnitReleaseSchema).parse(x ?? [])),
  ])
  return { unit: toUnit(u.data, unitId), proposals, releases, latest: null }
}

const AccountView = z.object({ result: z.object({ amount: z.string() }) })
const RpcError = z.object({ error: z.object({ cause: z.object({ name: z.string() }).partial().optional() }).passthrough() })

/** Server first; a server that is down or answers 5xx falls back to the chain. A 4xx is the answer. */
async function serverFirst<T>(server: () => Promise<T>, chain: () => Promise<T>): Promise<T> {
  try {
    return await server()
  } catch (e) {
    if (e instanceof ApiError && e.status >= 400 && e.status < 500 && e.status !== 404) throw e
    if (e instanceof ApiError && e.code === "UNIT_NOT_FOUND") throw e
    return chain()
  }
}

export const chainClient: UnitsClient = {
  mode: "chain",
  contract: C,

  policy: () =>
    serverFirst(
      () => api("/units/policy", UnitsPolicySchema),
      async () => UnitsPolicySchema.parse(await view(C, "get_policy")),
    ),

  view: (unitId) =>
    serverFirst(
      () => api(`/units/${unitId}`, UnitViewSchema),
      () => viewFromChain(unitId),
    ),

  unitsOf: (accountId) =>
    serverFirst(
      () => api(`/units?account_id=${encodeURIComponent(accountId)}`, UnitsListSchema),
      async () => {
        const raw = await view<unknown>(C, "get_units_of", { account_id: accountId })
        return (Array.isArray(raw) ? raw : []).flatMap((x): Unit[] => {
          const p = UnitRaw.safeParse(x)
          return p.success ? [toUnit(p.data)] : []
        })
      },
    ),

  balance: async (accountId) => {
    const body = JSON.stringify({ jsonrpc: "2.0", id: "bs", method: "query", params: { request_type: "view_account", finality: "final", account_id: accountId } })
    let json: unknown
    try {
      json = await (await rpcPost(body)).json()
    } catch {
      throw new ApiError("NEAR testnet did not answer the balance check.", "CHAIN_READ")
    }
    const ok = AccountView.safeParse(json)
    if (ok.success) return Number(BigInt(ok.data.result.amount) / 10n ** 18n) / 1e6
    // A brand-new implicit account does not exist until it is funded: that is a zero balance, not an error.
    const err = RpcError.safeParse(json)
    if (err.success && err.data.error.cause?.name === "UNKNOWN_ACCOUNT") return 0
    throw new ApiError("NEAR testnet did not answer the balance check.", "CHAIN_READ")
  },

  sponsor: (accountId) => api("/sponsor", SponsorSchema, postJson({ account_id: accountId })),

  nonce: async (purpose) => {
    const n = await api("/units/nonce", NonceSchema, postJson({ purpose }))
    if (n.recipient !== C) throw new ApiError("The server named a different contract.", "RECIPIENT_MISMATCH")
    return n
  },

  join: (unitId, body) => api(`/units/${unitId}/join`, JoinSchema, postJson(body)),
  synthetic: (unitId, body) => api(`/units/${unitId}/synthetic`, SyntheticSchema, postJson(body)),
  issuer: (unitId, emlText) => api(`/units/${unitId}/issuer`, IssuerSchema, postJson({ eml: emlText })),
  issuerSupplied: (unitId, body) => api(`/units/${unitId}/issuer`, IssuerSchema, postJson(body)),

  unitOfSlot: async (slot) => UnitOfSlotSchema.parse((await view<unknown>(C, "unit_of_slot", { slot })) ?? null),

  entry: async (unitId, body) => {
    const r = await api(`/units/${unitId}/entry`, EntryReplySchema, postJson(body))
    return { tx: r.tx?.hash ?? null, count: r.entry_count ?? null }
  },

  stand: (body) => api("/stand", StandResponseSchema, postJson(body)),
  run: (unitId, proposalId) => api(`/units/${unitId}/run`, RunSchema, postJson({ proposal_id: proposalId })),
  attackPrep: (unitId, body) => api(`/units/${unitId}/attack-prep`, AttackPrepSchema, postJson(body)),
  attacks: (unitId) => api(`/units/${unitId}/attacks`, AttacksSchema),
}
