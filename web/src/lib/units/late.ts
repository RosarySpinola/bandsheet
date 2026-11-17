import { view } from "@/lib/chain"
import { UNITS_CONTRACT } from "./config"

/**
 * Late approvals. A wallet can report a decline, or lose touch with the page, while the transaction still lands: a web
 * wallet's tab approved after the connector was closed, or a NEAR CLI command sent after the prompt was dismissed.
 * After any failure that is not a contract refusal, the action's `late` check reads contract state (never the
 * wallet's word) for about a minute. These are those checks.
 */

const WATCH_MS = 60_000
const EVERY_MS = 4_000

/** Runs `check` now and every few seconds for a minute; null when nothing landed or the page stopped caring. */
export async function watchLate<R>(check: () => Promise<R | null>, alive: () => boolean): Promise<R | null> {
  const until = Date.now() + WATCH_MS
  for (;;) {
    const r = await check().catch(() => null)
    if (r !== null) return r
    if (!alive() || Date.now() + EVERY_MS > until) return null
    await new Promise((ok) => setTimeout(ok, EVERY_MS))
  }
}

type NbTx = { transaction_hash?: string; receiver_account_id?: string; block_timestamp?: string; actions?: { method?: string | null }[] }

/**
 * The account's call to `method` on the units contract since `sinceMs`, from nearblocks' public API, so a late landing
 * still shows its transaction. Best effort: the indexer can lag a few seconds, so it asks up to three times.
 */
export async function findTx(accountId: string, method: string, sinceMs: number): Promise<string | null> {
  const since = BigInt(Math.floor(sinceMs - 120_000)) * 1_000_000n
  for (let i = 0; i < 3; i++) {
    try {
      const res = await fetch(`https://api-testnet.nearblocks.io/v1/account/${encodeURIComponent(accountId)}/txns-only?per_page=10`)
      const body = res.ok ? ((await res.json()) as { txns?: NbTx[] }) : {}
      const hit = body.txns?.find(
        (t) => t.receiver_account_id === UNITS_CONTRACT && t.actions?.some((a) => a.method === method) && t.block_timestamp !== undefined && BigInt(t.block_timestamp) >= since,
      )
      if (hit?.transaction_hash) return hit.transaction_hash
    } catch {
      // indexer unreachable: try again, then go without the link
    }
    await new Promise((ok) => setTimeout(ok, 2_500))
  }
  return null
}

type UnitRow = { id: number }
type UnitFull = { invite_code_hash?: string; council?: string[] } | null
type ProposalRow = { id: number; proposer: string; query: string; created_at: string; approvals: string[]; rejections: string[]; status: string }

/** The account's unit whose invite hash is this one (the invite secret never leaves the page). */
export async function unitWithInvite(accountId: string, inviteHash: string): Promise<number | null> {
  const mine = await view<UnitRow[]>(UNITS_CONTRACT, "get_units_of", { account_id: accountId })
  for (const u of mine ?? []) {
    const full = await view<UnitFull>(UNITS_CONTRACT, "get_unit", { unit_id: u.id })
    if (full?.invite_code_hash === inviteHash) return u.id
  }
  return null
}

/** True once the unit's invite hash is this one (a rotation that landed late). */
export async function inviteIs(unitId: number, inviteHash: string): Promise<boolean> {
  const full = await view<UnitFull>(UNITS_CONTRACT, "get_unit", { unit_id: unitId })
  return full?.invite_code_hash === inviteHash
}

/** A query's meaning: the contract stores it with an added "id", so compare group_by, filter and stat only. */
export function sameQuery(stored: string, sent: string): boolean {
  try {
    const pick = (t: string) => {
      const q = JSON.parse(t) as { group_by?: unknown; filter?: unknown; stat?: unknown }
      return JSON.stringify([q.group_by ?? null, q.filter ?? null, q.stat ?? "mean"])
    }
    return pick(stored) === pick(sent)
  } catch {
    return false
  }
}

/** The account's proposal with this query, filed since `sinceMs`. */
export async function proposalSince(unitId: number, accountId: string, query: string, sinceMs: number): Promise<number | null> {
  const rows = await view<ProposalRow[]>(UNITS_CONTRACT, "get_unit_proposals", { unit_id: unitId, from: 0, limit: 50 })
  const since = BigInt(Math.floor(sinceMs - 120_000)) * 1_000_000n
  const hit = (rows ?? []).filter((p) => p.proposer === accountId && sameQuery(p.query, query) && BigInt(p.created_at) >= since).at(-1)
  return hit?.id ?? null
}

/** The proposal's status once this account's vote is on it, else null. */
export async function voteOn(unitId: number, proposalId: number, accountId: string, approve: boolean): Promise<string | null> {
  const [p] = await view<ProposalRow[]>(UNITS_CONTRACT, "get_unit_proposals", { unit_id: unitId, from: proposalId - 1, limit: 1 })
  if (!p || p.id !== proposalId) return null
  return (approve ? p.approvals : p.rejections).includes(accountId) ? p.status : null
}
