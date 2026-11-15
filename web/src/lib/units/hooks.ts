import { useQuery } from "@tanstack/react-query"
import { units } from "./index"
import { SPONSOR_THRESHOLD_NEAR } from "./config"
import type { SponsorResult, UnitView } from "./schemas"

/** React Query hooks for units. Keys start with "units" so a wallet action can invalidate them all at once. */

const chainRetry = { retry: 2, retryDelay: (n: number) => Math.min(1500 * 2 ** n, 6000) }

export const useUnitsPolicy = () => useQuery({ queryKey: ["units", "policy"], queryFn: () => units.policy(), staleTime: 10 * 60_000, ...chainRetry })

/** True while an approved proposal has no release yet: the engine is running and the page should poll. */
export const engineRunning = (v: UnitView | undefined) => Boolean(v?.proposals.some((p) => p.status === "running"))

export function useUnitView(unitId: number | null) {
  return useQuery({
    queryKey: ["units", "view", unitId],
    queryFn: () => units.view(unitId!),
    enabled: unitId !== null && Number.isInteger(unitId) && unitId >= 0,
    staleTime: 10_000,
    refetchInterval: (q) => (engineRunning(q.state.data) ? 5000 : false),
    retry: (n, e) => (e as { code?: string })?.code !== "UNIT_NOT_FOUND" && n < 2,
  })
}

export const useMyUnits = (accountId: string | undefined) =>
  useQuery({ queryKey: ["units", "of", accountId], queryFn: () => units.unitsOf(accountId!), enabled: Boolean(accountId), staleTime: 30_000, ...chainRetry })

export type GasState =
  | { status: "none" }
  | { status: "checking" }
  | { status: "ok" }
  | { status: "sponsoring"; balance: number }
  | { status: "sponsored"; tx: SponsorResult["tx"] }
  | { status: "error"; error: unknown; during: "balance" | "sponsor" }

/**
 * Gas for wallet transactions. Once a wallet connects, its balance is read; under 0.02 testnet NEAR the server is
 * asked (once per account and tab) to send 0.05. This runs before any tap, so the tap itself never waits on it.
 */
export function useGas(accountId: string | undefined): GasState & { ready: boolean } {
  const balance = useQuery({ queryKey: ["units", "balance", accountId], queryFn: () => units.balance(accountId!), enabled: Boolean(accountId), staleTime: 60_000, retry: 1 })
  const low = balance.data !== undefined && balance.data < SPONSOR_THRESHOLD_NEAR
  const sponsor = useQuery({ queryKey: ["units", "sponsor", accountId], queryFn: () => units.sponsor(accountId!), enabled: Boolean(accountId) && low, staleTime: Infinity, gcTime: Infinity, retry: 0 })

  const s: GasState = !accountId
    ? { status: "none" }
    : sponsor.data?.funded
      ? { status: "sponsored", tx: sponsor.data.tx }
      : balance.isPending
        ? { status: "checking" }
        : balance.isError
          ? { status: "error", error: balance.error, during: "balance" }
          : !low || sponsor.data
            ? { status: "ok" }
            : sponsor.isError
              ? { status: "error", error: sponsor.error, during: "sponsor" }
              : { status: "sponsoring", balance: balance.data ?? 0 }
  // A failed balance read or sponsor call does not block: the wallet may hold gas anyway, and the chain will say if not.
  return { ...s, ready: s.status === "ok" || s.status === "sponsored" || s.status === "error" }
}
