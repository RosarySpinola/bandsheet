import type { Cell, Entry, Suppressed } from "@bandsheet/core"
import { LIMITS } from "./config"
import type { EntryKind } from "./types"

/**
 * Mock mode's stand-in for the units contract and its engine: one JSON document in localStorage, so a judge-style
 * walk-through (create, invite, submit, synthetic, propose, vote, release) works with no chain. Never used on chain.
 */

export type MEntry = { slot: string; kind: EntryKind; grade: Entry["grade"]; gender: Entry["gender"]; site: Entry["site"]; gross: number }
export type MProposal = {
  id: number
  proposer: string
  query: { group_by: string[]; filter?: Record<string, string> }
  approvals: string[]
  rejections: string[]
  status: "Open" | "Approved" | "Running" | "Released" | "Rejected" | "Withdrawn" | "Expired"
  release_id: number | null
  created_at: number
  run_at?: number
}
export type MRelease = Record<string, unknown> & { id: number; proposal_id: number }
export type MUnit = {
  id: number
  name: string
  creator: string
  council: string[]
  dkim_domains: string[]
  invite_code_hash: string
  pending_seats?: { account_id: string; approvals: string[] }[]
  members: { slot: string; synthetic: boolean; account?: string }[]
  entries: MEntry[]
  proposals: MProposal[]
  releases: MRelease[]
  created_at: number
}
type State = { units: MUnit[]; next: number }

const KEY = "bandsheet.units.mock.v1"
let memory: State = { units: [], next: 1 }

export function load(): State {
  try {
    const raw = window.localStorage.getItem(KEY)
    if (raw) memory = JSON.parse(raw) as State
  } catch {
    // storage blocked: the mock lives in memory for this page
  }
  return memory
}

export function save(s: State): void {
  memory = s
  try {
    window.localStorage.setItem(KEY, JSON.stringify(s))
  } catch {
    // storage blocked
  }
}

export const hex = (n = 32) => Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) => b.toString(16).padStart(2, "0")).join("")
const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"
export const fakeTx = () => Array.from(crypto.getRandomValues(new Uint8Array(44)), (b) => B58[b % 58]).join("")

/** Release engine stand-in: group, publish cells with n >= k, withhold the rest with the small-cell witness. */
function runEngine(u: MUnit, p: MProposal, wasm: string): MRelease {
  const filt = Object.entries(p.query.filter ?? {})
  const pool = u.entries.filter((e) => filt.every(([f, v]) => (e as unknown as Record<string, string>)[f] === v))
  const groups = new Map<string, { key: Record<string, string>; xs: MEntry[] }>()
  for (const e of pool) {
    const key = Object.fromEntries(p.query.group_by.map((f) => [f, String((e as unknown as Record<string, unknown>)[f])]))
    const id = JSON.stringify(key)
    const g = groups.get(id) ?? { key, xs: [] }
    g.xs.push(e)
    groups.set(id, g)
  }
  const cells: Cell[] = []
  const suppressed: Suppressed[] = []
  for (const g of groups.values()) {
    if (g.xs.length >= LIMITS.k) cells.push({ key: g.key, n: g.xs.length, mean_eur: Math.round(g.xs.reduce((s, e) => s + e.gross, 0) / g.xs.length) })
    else suppressed.push({ key: g.key, reason: "small_cell", witness: `n = ${g.xs.length} < k = ${LIMITS.k}` })
  }
  const status = cells.length === 0 ? "refused" : suppressed.length ? "partially_released" : "released"
  const count = (k: EntryKind) => pool.filter((e) => e.kind === k).length
  return {
    id: u.releases.length + 1,
    proposal_id: p.id,
    status,
    query: { id: p.id, ...p.query, stat: "mean" },
    requested_by: "the unit council",
    cells,
    suppressed,
    input_sha256: hex(),
    output_sha256: hex(),
    wasm_sha256: wasm,
    entries_verified: count("dkim"),
    counts: { dkim_verified: count("dkim"), self_attested: count("self"), synthetic: count("synthetic") },
    rejections: [],
    tx_hash: fakeTx(),
    block_timestamp: `${Date.now()}000000`,
  }
}

/** Advance time: a proposal whose engine run is due gets its release. Returns whether anything changed. */
export function tick(s: State, wasm: string): boolean {
  let changed = false
  for (const u of s.units) {
    for (const p of u.proposals) {
      if (p.status === "Running" && (p.run_at ?? 0) <= Date.now()) {
        const r = runEngine(u, p, wasm)
        u.releases.push(r)
        p.status = "Released"
        p.release_id = r.id
        changed = true
      }
    }
  }
  return changed
}

/** Approvals strictly more than half the council approve; /run then starts the engine (about nine seconds in mock mode). */
export function settle(u: MUnit, p: MProposal): void {
  if (p.status !== "Open") return
  if (p.approvals.length * 2 > u.council.length) {
    p.status = "Approved"
  } else if (p.rejections.length * 2 >= u.council.length) {
    p.status = "Rejected"
  }
}

const CYCLE: Entry["grade"][] = ["Senior", "Reporter", "Senior", "Editor", "Reporter", "Senior", "Editor", "Reporter"]
const BASE: Record<Entry["grade"], number> = { Junior: 31000, Reporter: 42000, Senior: 56000, Editor: 68000, Chief: 88000 }

/** Synthetic colleagues: realistic grades and pay, spread so several grades reach k. Flagged synthetic, always. */
export function syntheticEntries(n: number, have: number): MEntry[] {
  return Array.from({ length: n }, (_, i) => {
    const j = have + i
    const grade = CYCLE[j % CYCLE.length]!
    return { slot: hex(), kind: "synthetic" as const, grade, gender: (["F", "M", "X"] as const)[j % 3]!, site: j % 2 ? "Port" : "City", gross: BASE[grade] + ((j * 2371) % 7000) }
  })
}
