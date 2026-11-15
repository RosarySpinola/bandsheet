import { Cpu } from "lucide-react"
import { describeQuery, asQuery } from "@/components/unit-b/format"
import { isMock, type UnitProposal } from "@/lib/units"

/** Approved, engine running: the contract has asked OutLayer to run the sealed engine; the page polls for its answer. */
export function EngineRunning({ proposal }: { proposal: UnitProposal }) {
  return (
    <div className="flex flex-col gap-4 bg-ink p-6 text-white md:p-8" role="status" aria-live="polite">
      <div className="flex items-center gap-3">
        <span className="grid size-10 place-items-center bg-lav-mid text-ink">
          <Cpu className="size-5" />
        </span>
        <div className="flex flex-col">
          <p className="text-[1.0625rem] font-semibold">Approved. The sealed engine is running.</p>
          <p className="text-[0.875rem] text-white/70">
            Proposal #{proposal.id} · {describeQuery(asQuery(proposal.query))}
          </p>
        </div>
      </div>
      <div className="h-[2px] w-full overflow-hidden bg-white/15">
        <div className="h-full w-1/3 animate-[bs-run_1.8s_ease-in-out_infinite] bg-lav-mid" />
      </div>
      <p className="max-w-[40rem] text-[0.9375rem] leading-relaxed text-white/80">
        The units contract handed this unit's sealed entries and its earlier releases to the OutLayer engine. It decrypts them in its TEE, withholds any cell that could expose someone, and the contract records the answer. {isMock() ? "Mock mode answers in about ten seconds." : "This usually takes under a minute; the page checks every five seconds."}
      </p>
    </div>
  )
}
