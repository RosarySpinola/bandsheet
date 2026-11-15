import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { FlaskConical } from "lucide-react"
import { SquareButton } from "@/components/unit"
import { Spinner } from "@/components/ui/spinner"
import { ChoiceGroup } from "@/components/unit-b/choice-group"
import { LIMITS, type Conn, type Unit } from "@/lib/units"
import { prepareSynthetic } from "@/lib/units/actions"
import { useTap } from "@/lib/units/use-tap"
import { TxState } from "./tx-state"
import { WalletGate } from "./wallet-gate"

/**
 * "Add synthetic colleagues (sample data)": a council seat signs "Bandsheet synthetic <id>: <n>" and the server seals
 * n made-up entries, each flagged synthetic on chain, so a one-person unit can see bands publish.
 */
export function SyntheticPanel({ unit }: { unit: Unit }) {
  const left = Math.max(0, LIMITS.synthetic - unit.synthetic)
  /** Keeps the signing panel (and its result) on screen after the unit reaches the cap. */
  const [touched, setTouched] = useState(false)
  return (
    <section aria-labelledby="synthetic-title" className="flex flex-col gap-4 border-2 border-dashed border-indigo/50 bg-white p-6 md:p-8">
      <div className="flex items-start gap-4">
        <span className="grid size-11 shrink-0 place-items-center bg-lav-mid text-indigo">
          <FlaskConical className="size-5" />
        </span>
        <div className="flex flex-col gap-1.5">
          <h2 id="synthetic-title" className="text-[1.125rem] font-semibold text-ink">Add synthetic colleagues (sample data)</h2>
          <p className="max-w-[38rem] text-[0.9375rem] leading-relaxed text-foreground">
            To see bands publish before colleagues join, the council can add up to {LIMITS.synthetic} made-up entries with realistic grades and pay. Each is flagged synthetic on chain and labelled as sample data everywhere: here, in every release and in verify. They never pass as real.
          </p>
        </div>
      </div>
      {left === 0 && !touched ? (
        <p className="text-[0.9375rem] text-muted-foreground">This unit already has {unit.synthetic} synthetic entries, the most allowed.</p>
      ) : (
        <WalletGate title="Connect a council wallet" body="Only a council seat can add synthetic entries. Your wallet signs a message (free, no gas).">
          {(conn) =>
            unit.council.includes(conn.accountId) ? (
              <AddSynthetic conn={conn} unit={unit} left={left} onTap={() => setTouched(true)} />
            ) : (
              <p className="text-[0.9375rem] text-muted-foreground">Only the unit's council seats can add synthetic entries.</p>
            )
          }
        </WalletGate>
      )}
    </section>
  )
}

function AddSynthetic({ conn, unit, left, onTap }: { conn: Conn; unit: Unit; left: number; onTap: () => void }) {
  const qc = useQueryClient()
  const options = [3, 5, 8].filter((n) => n <= left)
  const [n, setN] = useState(String(options.at(-1) ?? left))
  const count = Math.min(Number(n), left)
  const t = useTap(count > 0 ? `${conn.accountId}:${unit.id}:${count}` : null, () => prepareSynthetic(conn, unit.id, count))
  const busy = t.phase.s === "busy"
  const go = () => {
    const run = t.tap()
    if (run) onTap()
    run?.then(() => void qc.invalidateQueries({ queryKey: ["units"] }), () => undefined)
  }
  return (
    <div className="flex flex-col gap-4">
      {options.length > 1 && (
        <ChoiceGroup label="How many" value={n} onChange={setN} options={options.map((o) => ({ value: String(o), label: `${o} colleagues` }))} />
      )}
      {count > 0 && (
        <SquareButton onClick={go} disabled={!t.canTap || busy} className="w-full bg-indigo hover:bg-ink sm:w-fit">
          {busy ? <Spinner className="size-4" /> : <FlaskConical className="size-4" />}
          {busy ? (t.phase.s === "busy" && t.phase.stage === "posting" ? "Adding synthetic entries…" : "Sign in your wallet…") : `Add ${count} synthetic colleagues (sample data)`}
        </SquareButton>
      )}
      <TxState
        phase={t.phase}
        tx={t.phase.s === "done" ? (t.phase.result.txs[0] ?? null) : null}
        onRetry={go}
        onRetryPrepare={t.retryPrepare}
        words={{
          what: `the message "Bandsheet synthetic ${unit.id}: ${count}"`,
          busy: "Sign the synthetic-entries message in your wallet…",
          posting: `Signed. The server is sealing ${count} synthetic entries and adding them, flagged synthetic…`,
          done: t.phase.s === "done" ? `Added ${t.phase.result.added} synthetic entries, flagged synthetic on chain.` : undefined,
        }}
      />
    </div>
  )
}
