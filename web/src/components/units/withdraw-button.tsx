import { useQueryClient } from "@tanstack/react-query"
import { Undo2 } from "lucide-react"
import { Spinner } from "@/components/ui/spinner"
import type { Conn, Unit, UnitProposal } from "@/lib/units"
import { prepareWithdraw, type Landed } from "@/lib/units/actions"
import { useTap } from "@/lib/units/use-tap"
import { TxState } from "./tx-state"

/** The proposer takes back an open proposal (unit_withdraw_proposal). */
export function WithdrawButton({ p, unit, conn, onTap }: { p: UnitProposal; unit: Unit; conn: Conn; onTap: () => void }) {
  const qc = useQueryClient()
  const t = useTap<Landed<null>>(p.status === "open" ? `${conn.accountId}:${unit.id}:${p.id}:withdraw` : null, () => prepareWithdraw(conn, unit.id, p.id))
  const busy = t.phase.s === "busy"
  const go = () => {
    const run = t.tap()
    if (run) onTap()
    run?.then(() => void qc.invalidateQueries({ queryKey: ["units"] }), () => undefined)
  }
  return (
    <div className="flex flex-col gap-3">
      {t.phase.s !== "done" && (
        <button type="button" onClick={go} disabled={!t.canTap || busy} className="inline-flex w-fit cursor-pointer items-center gap-2 text-[0.9375rem] text-muted-foreground transition-colors duration-[400ms] hover:text-ink disabled:opacity-40">
          {busy ? <Spinner className="size-4" /> : <Undo2 className="size-4" />} <span className="wipe">Withdraw this proposal</span>
        </button>
      )}
      <TxState
        phase={t.phase}
        tx={t.phase.s === "done" ? t.phase.result.tx : null}
        onRetry={go}
        onRetryPrepare={t.retryPrepare}
        words={{ what: "a unit_withdraw_proposal transaction", busy: "Approve unit_withdraw_proposal in your wallet…", done: `Proposal #${p.id} withdrawn. Nothing ran.` }}
      />
    </div>
  )
}
