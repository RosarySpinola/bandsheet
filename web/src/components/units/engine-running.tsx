import { useQueryClient } from "@tanstack/react-query"
import { Cpu } from "lucide-react"
import { Spinner } from "@/components/ui/spinner"
import { TxLink } from "@/components/unit"
import { describeQuery, asQuery } from "@/components/unit-b/format"
import { plainError } from "@/lib/api"
import { isMock, type UnitProposal } from "@/lib/units"
import { startRun, useRunState } from "@/lib/units/run"

/**
 * Approved → engine starting → running. The vote leaves the proposal approved; Bandsheet's sponsor then sends the
 * 300 Tgas unit_run, the contract hands this unit's sealed entries and earlier releases to the OutLayer engine, and
 * the page polls until the release is recorded.
 */
export function EngineRunning({ proposal, unitId }: { proposal: UnitProposal; unitId: number }) {
  const qc = useQueryClient()
  const run = useRunState(unitId, proposal.id)
  const approved = proposal.status === "approved"
  const title = approved ? (run?.s === "error" ? "Approved. The engine did not start." : "Approved → engine starting.") : "Approved. The sealed engine is running."
  return (
    <div className="flex flex-col gap-4 bg-ink p-6 text-white md:p-8" role="status" aria-live="polite">
      <div className="flex items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center bg-lav-mid text-ink">
          <Cpu className="size-5" />
        </span>
        <div className="flex min-w-0 flex-col">
          <p className="text-[1.0625rem] font-semibold">{title}</p>
          <p className="text-[0.875rem] text-white/70">
            Proposal #{proposal.id} · {describeQuery(asQuery(proposal.query))}
          </p>
        </div>
      </div>
      {!(approved && run?.s === "error") && (
        <div className="h-[2px] w-full overflow-hidden bg-white/15">
          <div className="h-full w-1/3 animate-[bs-run_1.8s_ease-in-out_infinite] bg-lav-mid" />
        </div>
      )}
      {approved ? (
        run?.s === "error" ? (
          <div className="flex flex-col gap-2 text-[0.9375rem] text-white/85">
            <p>{plainError(run.error).title}</p>
            <button type="button" onClick={() => startRun(qc, unitId, proposal.id, true)} className="wipe w-fit cursor-pointer font-semibold text-white">
              Start the engine again
            </button>
          </div>
        ) : (
          <p className="flex items-start gap-2 text-[0.9375rem] leading-relaxed text-white/80">
            {run?.s !== "started" && <Spinner className="mt-1 size-3.5 shrink-0" />}
            <span>
              {run?.s === "started" ? (
                <>
                  Bandsheet's sponsor sent unit_run{run.tx ? <> (<TxLink tx={run.tx} className="text-white" />{isMock() ? ", mock" : ""})</> : null}. Waiting for the contract to report the engine running…
                </>
              ) : (
                "Bandsheet's gas sponsor is sending unit_run (300 Tgas, more than a sponsored wallet can prepay). Nobody needs to sign anything."
              )}
            </span>
          </p>
        )
      ) : (
        <p className="max-w-[40rem] text-[0.9375rem] leading-relaxed text-white/80">
          The units contract handed this unit's sealed entries and its earlier releases to the OutLayer engine. It decrypts them in its TEE, withholds any cell that could expose someone, and the contract records the answer. {isMock() ? "Mock mode answers in about ten seconds." : "This usually takes about a minute; the page checks every five seconds."}
        </p>
      )}
    </div>
  )
}
