import { isMock } from "@/lib/units"

/** A thin line across units pages in mock mode, so a screenshot can never pass for a chain run. */
export function MockBanner() {
  if (!isMock()) return null
  return (
    <p className="border-b border-lav bg-lav-soft px-4 py-2 text-[0.8125rem] text-indigo sm:px-8 xl:px-16">
      Mock mode: the wallet, the units contract and the engine are simulated in this browser. Nothing is sent to NEAR testnet.
    </p>
  )
}
