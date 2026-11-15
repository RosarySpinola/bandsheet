/**
 * Units ("Start your own unit") configuration. The units contract is a separate account from the judged demo
 * contract (bandsheet-3f36b7.testnet), which this code never writes to.
 *
 * Mock mode keeps every units call in this browser (no wallet, no chain, no server). It is on when no units contract
 * is configured, or when the URL carries ?mock=1; ?mock=0 turns it off for the rest of the tab.
 */
export const UNITS_CONTRACT: string = import.meta.env.VITE_UNITS_CONTRACT ?? ""
/** Planned id (contracts/units/INTERFACE.md); used as the mock's contract name until the deploy lands. */
export const PLANNED_UNITS_CONTRACT = "bandsheet-units-2d3f96.testnet"

/** The account balance under which the server sends gas (POST /api/sponsor), and what it sends. */
export const SPONSOR_THRESHOLD_NEAR = 0.04
export const SPONSOR_AMOUNT_NEAR = 0.05

/** Contract caps (UNITS-BRIEF "Costs"); shown in copy, enforced by the contract. */
export const LIMITS = { unitsPerAccount: 3, releasesPerDay: 5, councilSeats: 5, synthetic: 8, k: 3, domains: 4, openProposals: 5 } as const

/**
 * Gas per call (INTERFACE.md). Wallets must hold prepaid gas at the pessimistic price (about 10x), so a sponsored wallet
 * can sign 30 Tgas calls only: propose and vote are 30 Tgas, and the 300 Tgas unit_run goes through POST /api/units/:id/run.
 */
export const GAS = { create: "30000000000000", council: "30000000000000", propose: "30000000000000", vote: "30000000000000" } as const

const FLAG = "bandsheet.units.mock"

function readFlag(): "1" | "0" | null {
  try {
    const q = new URLSearchParams(window.location.search).get("mock")
    if (q === "1" || q === "0") window.sessionStorage.setItem(FLAG, q)
    const v = window.sessionStorage.getItem(FLAG)
    return v === "1" || v === "0" ? v : null
  } catch {
    return null
  }
}

let resolved: boolean | null = null

/** Decided once per page load, so a mid-flow navigation cannot switch a flow between mock and chain. */
export function isMock(): boolean {
  if (resolved === null) {
    const flag = readFlag()
    resolved = flag === "1" ? true : flag === "0" ? !UNITS_CONTRACT : !UNITS_CONTRACT
  }
  return resolved
}

/** QA only, mock mode only: ?fail=reject|chain|rpc makes the next wallet or read call fail that way. */
export function mockFailure(): "reject" | "chain" | "rpc" | null {
  try {
    const f = new URLSearchParams(window.location.search).get("fail")
    return f === "reject" || f === "chain" || f === "rpc" ? f : null
  } catch {
    return null
  }
}
