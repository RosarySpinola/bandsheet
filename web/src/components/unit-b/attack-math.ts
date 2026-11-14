import { GRADES, SEED_JOINER, SEED_MEMBERS, naiveRelease, type Cell, type Entry, type ReleaseRecord, type SeedMember } from "@bandsheet/core"

/**
 * The "typical n>=3 tool", simulated in the browser from the same synthetic payroll the chain demo
 * seeded (packages/core seed.ts + naive.ts): release #1 before Noor Haddad joins, #2 after.
 */
const toEntry = (m: SeedMember, i: number): Entry => ({
  slot: i.toString(16).padStart(64, "0"),
  gross_annual_eur: m.gross_annual_eur,
  grade: m.grade,
  gender: m.gender,
  site: m.site,
  submitted_at: 0,
})

const before = SEED_MEMBERS.map(toEntry)
const after = [...SEED_MEMBERS, SEED_JOINER].map(toEntry)

export const HERO_RELEASES = [1, 2] as const
export type HeroId = (typeof HERO_RELEASES)[number]

export const NAIVE: Record<HeroId, Cell[]> = {
  1: naiveRelease(before, { id: 1, group_by: ["grade"], stat: "mean" }),
  2: naiveRelease(after, { id: 2, group_by: ["grade"], stat: "mean" }),
}
export const NAIVE_MEMBERS: Record<HeroId, number> = { 1: before.length, 2: after.length }
export const JOINER = SEED_JOINER

/** A cell choice: one grade, or every cell added together ("whole unit"). */
export type CellChoice = (typeof GRADES)[number] | "all"
export const CELL_CHOICES: CellChoice[] = [...GRADES, "all"]
export const choiceLabel = (c: CellChoice) => (c === "all" ? "Whole unit" : c)

export type Term = { release: number; n: number; mean: number | null; product: number }

export type NaiveResult = {
  from: Term
  minus: Term
  diff: number
  dn: number
  /** set when the two terms differ by exactly one member */
  revealed: number | null
  /** the synthetic person the revealed figure belongs to */
  who: string | null
}

function term(release: HeroId, choice: CellChoice): Term | null {
  const cells = NAIVE[release]
  if (choice === "all") {
    return { release, n: cells.reduce((s, c) => s + c.n, 0), mean: null, product: cells.reduce((s, c) => s + c.n * c.mean_eur, 0) }
  }
  const c = cells.find((x) => x.key.grade === choice)
  return c ? { release, n: c.n, mean: c.mean_eur, product: c.n * c.mean_eur } : null
}

export function naiveSubtract(from: HeroId, minus: HeroId, choice: CellChoice): NaiveResult | null {
  const a = term(from, choice)
  const b = term(minus, choice)
  if (!a || !b) return null
  const diff = a.product - b.product
  const dn = a.n - b.n
  const revealed = Math.abs(dn) === 1 ? Math.abs(diff) : null
  const joinerIn = choice === "all" || choice === JOINER.grade
  return { from: a, minus: b, diff, dn, revealed, who: revealed !== null && joinerIn ? JOINER.name : null }
}

export type GuardResult =
  | { kind: "withheld"; release: number; witness: string; reason: string }
  | { kind: "nobody"; from: Cell; minus: Cell }
  | { kind: "group"; from: Cell; minus: Cell; dn: number }
  | { kind: "totals"; fromN: number; minusN: number; missing: string[] }
  | { kind: "leak"; from: Cell; minus: Cell }
  | { kind: "missing"; release: number }

/** What the same subtraction yields against the real on-chain records. */
export function guardSubtract(rFrom: ReleaseRecord | undefined, rMinus: ReleaseRecord | undefined, choice: CellChoice): GuardResult {
  if (!rFrom) return { kind: "missing", release: 0 }
  if (!rMinus) return { kind: "missing", release: 0 }
  if (choice === "all") {
    const missing = [...rFrom.suppressed, ...rMinus.suppressed].map((s) => Object.values(s.key).join(" · "))
    const fromN = rFrom.cells.reduce((s, c) => s + c.n, 0)
    const minusN = rMinus.cells.reduce((s, c) => s + c.n, 0)
    return { kind: "totals", fromN, minusN, missing: [...new Set(missing)] }
  }
  for (const r of [rFrom, rMinus]) {
    const s = r.suppressed.find((x) => x.key.grade === choice)
    if (s) return { kind: "withheld", release: r.id, witness: s.witness, reason: s.reason }
  }
  const a = rFrom.cells.find((c) => c.key.grade === choice)
  const b = rMinus.cells.find((c) => c.key.grade === choice)
  if (!a || !b) return { kind: "missing", release: a ? rMinus.id : rFrom.id }
  const dn = a.n - b.n
  if (dn === 0) return { kind: "nobody", from: a, minus: b }
  if (Math.abs(dn) === 1) return { kind: "leak", from: a, minus: b }
  return { kind: "group", from: a, minus: b, dn }
}
