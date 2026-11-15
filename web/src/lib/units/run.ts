import { useEffect, useSyncExternalStore } from "react"
import type { QueryClient } from "@tanstack/react-query"
import { units } from "./index"
import type { UnitView } from "./schemas"

/**
 * Approved → engine starting. A passing vote leaves the proposal "approved"; the web then asks the server to send the
 * 300 Tgas unit_run (POST /api/units/:id/run), because a sponsored wallet cannot prepay that much gas. Each proposal
 * is started at most once per tab; a failure can be retried from the proposal card.
 */
export type RunState = { s: "starting" } | { s: "started"; tx: string | null } | { s: "error"; error: unknown }

const runs = new Map<string, RunState>()
const listeners = new Set<() => void>()
const key = (unitId: number, proposalId: number) => `${unitId}:${proposalId}`
const set = (k: string, v: RunState) => {
  runs.set(k, v)
  listeners.forEach((l) => l())
}

export function startRun(qc: QueryClient, unitId: number, proposalId: number, force = false): void {
  const k = key(unitId, proposalId)
  const cur = runs.get(k)
  if (cur && !force && cur.s !== "error") return
  if (cur?.s === "starting") return
  set(k, { s: "starting" })
  units.run(unitId, proposalId).then(
    (r) => {
      set(k, { s: "started", tx: r.tx?.hash ?? null })
      void qc.invalidateQueries({ queryKey: ["units"] })
    },
    (error) => {
      set(k, { s: "error", error })
      // Another tab (or the backend) may have started it already: the view says.
      void qc.invalidateQueries({ queryKey: ["units", "view", unitId] })
    },
  )
}

const subscribe = (cb: () => void) => {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

export const useRunState = (unitId: number, proposalId: number): RunState | null =>
  useSyncExternalStore(subscribe, () => runs.get(key(unitId, proposalId)) ?? null, () => null)

/** In the unit shell: any approved proposal this tab sees gets its engine started once. */
export function useAutoRun(qc: QueryClient, view: UnitView | undefined): void {
  const approved = view?.proposals.filter((p) => p.status === "approved").map((p) => p.id) ?? []
  const unitId = view?.unit.id
  const sig = approved.join(",")
  useEffect(() => {
    if (unitId === undefined || !sig) return
    for (const id of sig.split(",").map(Number)) {
      if (!runs.has(key(unitId, id))) startRun(qc, unitId, id)
    }
  }, [qc, unitId, sig])
}
