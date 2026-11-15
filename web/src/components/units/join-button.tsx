import { useQueryClient } from "@tanstack/react-query"
import { PenLine } from "lucide-react"
import { SquareButton } from "@/components/unit"
import { Spinner } from "@/components/ui/spinner"
import { prepareJoin, type Joined } from "@/lib/units/actions"
import { useTap } from "@/lib/units/use-tap"
import type { Conn } from "@/lib/units"
import { TxState } from "./tx-state"

/**
 * Join a unit: a posting key is made in this browser, the wallet signs "Bandsheet join unit <id>: <key>" (NEP-413,
 * free, no gas), and the registrar adds the key. The wallet's account never sits beside the slot on chain.
 */
export function JoinButton({ conn, unitId, code, label = "Join with your wallet", onJoined, errors }: {
  conn: Conn
  unitId: number
  code: string
  label?: string
  onJoined?: (j: Joined) => void
  errors?: Record<string, React.ReactNode>
}) {
  const qc = useQueryClient()
  const t = useTap<Joined>(`${conn.accountId}:${unitId}:${code}`, () => prepareJoin(conn, unitId, code))
  const busy = t.phase.s === "busy"
  const go = () => {
    const run = t.tap()
    run?.then((j) => {
      void qc.invalidateQueries({ queryKey: ["units"] })
      onJoined?.(j)
    }, () => undefined)
  }
  return (
    <div className="flex flex-col gap-4">
      {t.phase.s !== "done" && (
        <SquareButton onClick={go} disabled={!t.canTap || busy} className="w-full sm:w-fit">
        {busy ? <Spinner className="size-4" /> : <PenLine className="size-4" />}
        {busy ? (t.phase.s === "busy" && t.phase.stage === "posting" ? "Adding your posting key…" : "Sign in your wallet…") : t.phase.s === "preparing" ? "Getting ready…" : label}
        </SquareButton>
      )}
      <TxState
        phase={t.phase}
        tx={t.phase.s === "done" ? t.phase.result.tx : null}
        onRetry={t.canTap ? go : t.retryPrepare}
        onRetryPrepare={t.retryPrepare}
        words={{
          what: "a message, not a transaction",
          busy: "Sign the join message in your wallet…",
          posting: "Signed. Bandsheet's registrar is adding your posting key to the unit…",
          done: "You're a member. Your posting key is registered; it can only call submit.",
          errors,
        }}
      />
    </div>
  )
}
