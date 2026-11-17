import { useState, type ReactNode } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { Check, FlaskConical, Search } from "lucide-react"
import type { Cell } from "@bandsheet/core"
import { SquareButton, TxLink } from "@/components/unit"
import { Spinner } from "@/components/ui/spinner"
import { ChoiceGroup } from "@/components/unit-b/choice-group"
import { eur, int } from "@/lib/format"
import { LIMITS, type Conn, type Unit } from "@/lib/units"
import { prepareAttackPrep, preparePropose, type Query } from "@/lib/units/actions"
import type { Attack, AttackPrep, UnitRelease } from "@/lib/units/schemas"
import { useTap } from "@/lib/units/use-tap"
import { cn } from "@/lib/utils"
import { TxState } from "../tx-state"
import { keyOf } from "./use-unit-attack"

/** One numbered step of the lab: done (ink check), current (filled number) or still to come. */
export function Step({ n, title, state, children }: { n: number; title: string; state: "done" | "now" | "later"; children?: ReactNode }) {
  return (
    <li className="grid grid-cols-[2.25rem_minmax(0,1fr)] gap-x-4">
      <span
        className={cn(
          "grid size-9 place-items-center font-serif text-[1.0625rem] tabular",
          state === "done" ? "bg-ink text-white" : state === "now" ? "border-2 border-ink text-ink" : "border border-border text-muted-foreground",
        )}
        aria-hidden
      >
        {state === "done" ? <Check className="size-4" strokeWidth={2.5} /> : n}
      </span>
      <div className={cn("flex min-w-0 flex-col gap-3 pb-8", state === "later" && "opacity-55")}>
        <p className="pt-1.5 text-[1.0625rem] leading-snug font-semibold text-ink">{title}</p>
        {children}
      </div>
    </li>
  )
}

const change = (unit: Unit) => (unit.syntheticAdded < LIMITS.synthetic ? "add" : "remove")

/** Step 1: pick a published group and change it by exactly one synthetic colleague (a signed message, no gas). */
export function PickStep({ unit, base, cells, conn }: { unit: Unit; base: UnitRelease; cells: Cell[]; conn: Conn }) {
  const qc = useQueryClient()
  const [pick, setPick] = useState(keyOf(cells[0]!.key))
  const cell = cells.find((c) => keyOf(c.key) === pick) ?? cells[0]!
  const seat = unit.council.includes(conn.accountId)
  const how = change(unit)
  const t = useTap<AttackPrep>(seat ? `${conn.accountId}:${unit.id}:${base.id}:${pick}` : null, () => prepareAttackPrep(conn, unit.id, base.id, cell.key))
  const busy = t.phase.s === "busy"
  const go = () => t.tap()?.then(() => void qc.invalidateQueries({ queryKey: ["units"] }), () => undefined)
  if (!seat) return <p className="text-[0.9375rem] text-muted-foreground">Only this unit's council seats can run the lab, because it adds a colleague to the unit. You can read the result once a seat has.</p>
  return (
    <div className="flex flex-col gap-4">
      {cells.length > 1 && (
        <ChoiceGroup label="Group to attack" value={pick} onChange={setPick} options={cells.map((c) => ({ value: keyOf(c.key), label: `${keyOf(c.key)} · ${int(c.n)}` }))} />
      )}
      <p className="text-[0.9375rem] leading-relaxed text-foreground">
        Release #{base.id} published <strong>{keyOf(cell.key)}</strong>: {int(cell.n)} members, mean {eur(cell.mean_eur)}.{" "}
        {how === "add"
          ? <>The lab adds one synthetic colleague to that group ({int(cell.n)} → {int(cell.n + 1)}), with a figure only the server knows. It is flagged synthetic on chain.</>
          : <>This unit has used its {LIMITS.synthetic} synthetic colleagues, so the lab takes back one it added to that group earlier ({int(cell.n)} → {int(cell.n - 1)}).</>}
      </p>
      <SquareButton onClick={go} disabled={!t.canTap || busy} className="w-full bg-indigo hover:bg-ink sm:w-fit">
        {busy ? <Spinner className="size-4" /> : <FlaskConical className="size-4" />}
        {busy ? (t.phase.s === "busy" && t.phase.stage === "posting" ? (how === "add" ? "Adding the colleague…" : "Removing the colleague…") : "Sign in your wallet…") : "Try to single someone out"}
      </SquareButton>
      <TxState
        phase={t.phase}
        tx={t.phase.s === "done" ? (t.phase.result.txs[0]?.hash ?? null) : null}
        onRetry={go}
        onRetryPrepare={t.retryPrepare}
        words={{
          what: `the message "Bandsheet synthetic ${unit.id}: attack release ${base.id}: ${keyOf(cell.key).replace(/ · /g, " ")}"`,
          busy: "Sign the lab's message in your wallet (free, no gas)…",
          posting: how === "add" ? "Signed. The server is adding one synthetic colleague to that group…" : "Signed. The registrar is removing the lab's colleague…",
          done: "Done. Next, ask for the same table again.",
        }}
      />
    </div>
  )
}

/** What step 1 changed, with its transactions. */
export function ChangeDone({ attack, cell }: { attack: Attack; cell: Cell }) {
  const add = attack.action === "add"
  return (
    <p className="text-[0.9375rem] leading-relaxed text-foreground">
      {add ? "Added" : "Removed"} one synthetic colleague {add ? "to" : "from"} <strong>{keyOf(attack.cell)}</strong> ({int(cell.n)} → {int(add ? cell.n + 1 : cell.n - 1)} members).{" "}
      {attack.txs.map((t, i) => (
        <span key={t.hash} className="whitespace-nowrap">
          {i > 0 && " · "}
          <TxLink tx={t.hash} className="text-[0.9375rem]" />
        </span>
      ))}
    </p>
  )
}

const queryOf = (text: string): Query => {
  const q = JSON.parse(text) as { group_by: Query["group_by"]; filter?: Record<string, string> }
  return { group_by: q.group_by, ...(q.filter ? { filter: q.filter } : {}) }
}

/** Step 2: the same request as the earlier release, filed from the seat's wallet (a transaction). */
export function ProposeStep({ unit, attack, conn, gasReady, refusedId }: { unit: Unit; attack: Attack; conn: Conn; gasReady: boolean; refusedId?: number }) {
  const qc = useQueryClient()
  const seat = unit.council.includes(conn.accountId)
  const t = useTap(seat && gasReady ? `${conn.accountId}:${unit.id}:${attack.started_at}:again` : null, () => preparePropose(conn, unit.id, queryOf(attack.query)))
  const busy = t.phase.s === "busy"
  const go = () => t.tap()?.then(() => void qc.invalidateQueries({ queryKey: ["units"] }), () => undefined)
  if (!seat) return <p className="text-[0.9375rem] text-muted-foreground">A council seat files this request from its own wallet.</p>
  return (
    <div className="flex flex-col gap-4">
      {refusedId !== undefined && <p className="border-l-2 border-ink bg-band px-4 py-3 text-[0.9375rem] text-ink">Proposal #{refusedId} for this table did not pass. File it again to finish the lab.</p>}
      <SquareButton onClick={go} disabled={!t.canTap || busy} className="w-full sm:w-fit">
        {busy ? <Spinner className="size-4" /> : <Search className="size-4" />} {busy ? "Approve in your wallet…" : !gasReady ? "Waiting for gas…" : "Ask for the same table again"}
      </SquareButton>
      <TxState
        phase={t.phase}
        tx={t.phase.s === "done" ? t.phase.result.tx : null}
        onRetry={go}
        onRetryPrepare={t.retryPrepare}
        words={{
          what: "a unit_propose_release transaction",
          busy: "Approve unit_propose_release in your wallet…",
          done: t.phase.s === "done" ? `Proposal #${t.phase.result.value} filed with the same request as release #${attack.release_id}.` : undefined,
          late: t.phase.s === "done" ? `Proposal #${t.phase.result.value} was filed after all.` : undefined,
        }}
      />
    </div>
  )
}
