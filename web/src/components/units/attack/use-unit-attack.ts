import { useQuery } from "@tanstack/react-query"
import type { Cell } from "@bandsheet/core"
import { units, type UnitView } from "@/lib/units"
import { findTx, sameQuery } from "@/lib/units/late"
import type { Attack, UnitProposal, UnitRelease } from "@/lib/units/schemas"

/**
 * Where the attack lab stands on a unit, read from the chain (releases, proposals) and the server's record of the
 * lab's own one-member changes. Nothing is kept only in this tab, so a reload lands on the same step.
 */
export type AttackStage =
  | { s: "none" }
  | { s: "pick"; base: UnitRelease; cells: Cell[] }
  | { s: "propose"; attack: Attack; base: UnitRelease; cell: Cell; refused?: UnitProposal }
  | { s: "vote"; attack: Attack; base: UnitRelease; cell: Cell; proposal: UnitProposal }
  | { s: "result"; attack: Attack; base: UnitRelease; cell: Cell; proposal: UnitProposal; release: UnitRelease }

export const keyOf = (k: Record<string, string>) => [k.grade, k.gender, k.site].filter(Boolean).join(" · ")
const sameKey = (a: Record<string, string>, b: Record<string, string>) => {
  const ka = Object.keys(a).sort()
  return ka.length === Object.keys(b).length && ka.every((k) => a[k] === b[k])
}
const publishable = (r: UnitRelease) => r.cells.filter((c) => c.n >= 3)
const ns = (v: string | number | null) => (v === null ? 0n : BigInt(String(v).split(".")[0]!))

export const useUnitAttacks = (unitId: number) =>
  useQuery({ queryKey: ["units", "attacks", unitId], queryFn: () => units.attacks(unitId), refetchInterval: 15_000 })

/** The newest release that published at least one group of three or more: the table the lab asks for again. */
export const baseRelease = (v: UnitView): UnitRelease | null => [...v.releases].sort((a, b) => b.id - a.id).find((r) => publishable(r).length > 0) ?? null

export function attackStage(v: UnitView, attacks: Attack[], fresh: boolean): AttackStage {
  const latest = attacks[0]
  const base = latest && v.releases.find((r) => r.id === latest.release_id)
  const cell = base?.cells.find((c) => sameKey(c.key, latest!.cell))
  if (!fresh && latest && base && cell) {
    // Only a request filed after the change counts (a few seconds of clock skew at most), never the base release's own.
    const after = ns(latest.started_at) * 1_000_000n - 5_000_000_000n
    const asked = [...v.proposals]
      .sort((a, b) => a.id - b.id)
      .filter((p) => p.id !== base.proposalId && p.proposer && sameQuery(JSON.stringify(p.query ?? {}), latest.query) && ns(p.createdAt) >= after)
    const live = asked.find((p) => !["rejected", "withdrawn", "expired", "failed"].includes(p.status))
    if (!live) return { s: "propose", attack: latest, base, cell, refused: asked.at(-1) }
    const release = v.releases.find((r) => r.proposalId === live.id && r.id > base.id)
    if (release) return { s: "result", attack: latest, base, cell, proposal: live, release }
    return { s: "vote", attack: latest, base, cell, proposal: live }
  }
  const b = baseRelease(v)
  return b ? { s: "pick", base: b, cells: publishable(b).sort((x, y) => y.n - x.n) } : { s: "none" }
}

/** The proposal's own transactions, found on nearblocks (best effort): who proposed, and each other seat's vote. */
export function useProposalTxs(unitId: number, p: UnitProposal) {
  const since = Number(ns(p.createdAt) / 1_000_000n) - 5_000
  const voters = p.approvals.filter((a) => a !== p.proposer)
  return useQuery({
    queryKey: ["units", "proposal-txs", unitId, p.id, voters.join(",")],
    enabled: p.createdAt !== null,
    staleTime: Infinity,
    queryFn: async () => ({
      propose: p.proposer ? await findTx(p.proposer, "unit_propose_release", since) : null,
      votes: await Promise.all(voters.map(async (a) => ({ account: a, tx: await findTx(a, "unit_vote", since) }))),
    }),
  })
}
