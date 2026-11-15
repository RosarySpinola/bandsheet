import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { GENDERS, GRADES, SITES } from "@bandsheet/core"
import { Spinner } from "@/components/ui/spinner"
import { SquareButton } from "@/components/unit"
import { ChoiceGroup, MultiChoiceGroup } from "@/components/unit-b/choice-group"
import { describeQuery, valueLabel } from "@/components/unit-b/format"
import { LIMITS, type Conn, type Unit } from "@/lib/units"
import { preparePropose, type Landed, type Query } from "@/lib/units/actions"
import { useTap } from "@/lib/units/use-tap"
import { TxState } from "./tx-state"

type Field = "grade" | "gender" | "site"
const FIELDS: { value: Field; label: string }[] = [
  { value: "grade", label: "Grade" },
  { value: "gender", label: "Gender" },
  { value: "site", label: "Site" },
]
const VALUES: Record<Field, readonly string[]> = { grade: GRADES, gender: GENDERS, site: SITES }
const Label = ({ children }: { children: string }) => <span className="text-[0.8125rem] font-semibold tracking-[0.04em] text-ink uppercase">{children}</span>

export const threshold = (seats: number) => Math.floor(seats / 2) + 1

/**
 * "Propose a release" for a judge's own unit: the council seat's own wallet sends unit_propose_release. The proposer's
 * approval counts, so a one-seat council's proposal goes straight to the engine.
 */
export function UnitQueryBuilder({ conn, unit, gasReady }: { conn: Conn; unit: Unit; gasReady: boolean }) {
  const qc = useQueryClient()
  const [groupBy, setGroupBy] = useState<Field[]>(["grade"])
  const [filterField, setFilterField] = useState<Field | "none">("none")
  const [filterValue, setFilterValue] = useState("")
  const activeFilter = filterField !== "none" && !groupBy.includes(filterField) && filterValue ? { [filterField]: filterValue } : undefined
  const query: Query = { group_by: groupBy, ...(activeFilter ? { filter: activeFilter } : {}) }
  const seat = unit.council.includes(conn.accountId)
  const t = useTap<Landed<number>>(seat && gasReady ? JSON.stringify([conn.accountId, unit.id, query]) : null, () => preparePropose(conn, unit.id, query))
  const busy = t.phase.s === "busy"
  const need = threshold(unit.council.length)

  const setGroups = (v: Field[]) => {
    if (v.length === 0) return
    const ordered = FIELDS.map((f) => f.value).filter((f) => v.includes(f))
    setGroupBy(ordered)
    if (filterField !== "none" && ordered.includes(filterField)) setFilterField("none")
  }
  const go = () => t.tap()?.then(() => void qc.invalidateQueries({ queryKey: ["units"] }), () => undefined)

  return (
    <section className="flex flex-col gap-6 bg-band p-6 md:p-8" aria-labelledby="propose-title">
      <header className="flex flex-col gap-2">
        <h2 id="propose-title" className="font-serif text-[1.75rem] leading-tight text-ink">Propose a release</h2>
        <p className="text-[0.9375rem] text-foreground">Choose the table. Your wallet files it on the units contract and your approval counts.</p>
      </header>
      <div className="flex flex-col gap-3">
        <Label>Group by</Label>
        <MultiChoiceGroup label="Group by" options={FIELDS} value={groupBy} onChange={setGroups} />
      </div>
      <div className="flex flex-col gap-3">
        <Label>Only include</Label>
        <ChoiceGroup
          label="Filter field"
          value={filterField}
          onChange={(f) => {
            setFilterField(f)
            setFilterValue(f === "none" ? "" : (VALUES[f][0] ?? ""))
          }}
          options={[{ value: "none" as const, label: "Everyone" }, ...FIELDS.filter((f) => !groupBy.includes(f.value))]}
        />
        {filterField !== "none" && (
          <ChoiceGroup label={`${filterField} value`} value={filterValue} onChange={setFilterValue} options={VALUES[filterField].map((v) => ({ value: v, label: valueLabel(filterField, v) }))} />
        )}
      </div>
      <div className="flex flex-col gap-2 border-t-2 border-ink pt-5">
        <span className="text-[0.8125rem] text-muted-foreground">The request</span>
        <p className="font-serif text-[1.375rem] leading-snug text-ink">{describeQuery(query)}</p>
        <p className="text-[0.875rem] text-muted-foreground">
          Groups under {LIMITS.k} members are withheld, and so is any cell that, with earlier releases, would single someone out. Needs {need} of {unit.council.length} {unit.council.length === 1 ? "seat" : "seats"}; at most {LIMITS.releasesPerDay} releases a day.
        </p>
      </div>
      {seat ? (
        <SquareButton onClick={go} disabled={!t.canTap || busy} className="w-full">
          {busy ? <><Spinner className="size-4" /> Approve in your wallet…</> : !gasReady ? "Waiting for gas…" : t.phase.s === "preparing" ? "Getting ready…" : need === 1 ? "Propose and approve" : "Propose to the council"}
        </SquareButton>
      ) : (
        <p className="border-l-2 border-ink bg-white px-4 py-3 text-[0.9375rem] text-ink">Only this unit's council seats can propose. You can read every proposal and release.</p>
      )}
      <TxState
        phase={t.phase}
        tx={t.phase.s === "done" ? t.phase.result.tx : null}
        onRetry={go}
        onRetryPrepare={t.retryPrepare}
        className="[&_[role=alert]]:bg-white"
        words={{
          what: "a unit_propose_release transaction",
          busy: "Approve unit_propose_release in your wallet…",
          done: t.phase.s === "done" ? `Proposal #${t.phase.result.value} filed.${need === 1 ? " Your approval is the majority, so it is approved and Bandsheet starts the engine." : ` It needs ${need - 1} more ${need - 1 === 1 ? "approval" : "approvals"}.`}` : undefined,
        }}
      />
    </section>
  )
}
