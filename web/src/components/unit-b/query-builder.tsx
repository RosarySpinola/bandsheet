import { useState } from "react"
import { GENDERS, GRADES, SITES } from "@bandsheet/core"
import { Spinner } from "@/components/ui/spinner"
import { ErrorState, SquareButton, TxLink } from "@/components/unit"
import { ChoiceGroup, MultiChoiceGroup } from "./choice-group"
import type { ProposeInput } from "./dao-actions"
import type { ProposeResult } from "./data"
import { describeQuery, valueLabel } from "./format"

type Field = "grade" | "gender" | "site"
const FIELDS: { value: Field; label: string }[] = [
  { value: "grade", label: "Grade" },
  { value: "gender", label: "Gender" },
  { value: "site", label: "Site" },
]
const VALUES: Record<Field, readonly string[]> = { grade: GRADES, gender: GENDERS, site: SITES }

function Label({ children }: { children: string }) {
  return <span className="text-[0.8125rem] font-semibold tracking-[0.04em] text-ink uppercase">{children}</span>
}

/** "Ask for a release": group by one to three fields, optionally filter, then propose to the DAO. */
export function QueryBuilder({ onPropose, pending, error, result, mock, k }: {
  onPropose: (q: ProposeInput) => void
  pending: boolean
  error: unknown
  result: (ProposeResult & { mock: boolean }) | null
  mock: boolean
  k: number
}) {
  const [groupBy, setGroupBy] = useState<Field[]>(["grade"])
  const [filterField, setFilterField] = useState<Field | "none">("none")
  const [filterValue, setFilterValue] = useState<string>("")

  const filterOptions = FIELDS.filter((f) => !groupBy.includes(f.value))
  const activeFilter = filterField !== "none" && !groupBy.includes(filterField) && filterValue ? { [filterField]: filterValue } : undefined
  const query: ProposeInput = { group_by: groupBy, ...(activeFilter ? { filter: activeFilter } : {}) }

  const setGroups = (v: Field[]) => {
    if (v.length === 0) return
    const ordered = FIELDS.map((f) => f.value).filter((f) => v.includes(f))
    setGroupBy(ordered)
    if (filterField !== "none" && ordered.includes(filterField)) setFilterField("none")
  }
  const pickFilterField = (f: Field | "none") => {
    setFilterField(f)
    setFilterValue(f === "none" ? "" : (VALUES[f][0] ?? ""))
  }

  return (
    <section className="flex flex-col gap-6 bg-band p-6 md:p-8" aria-labelledby="ask-title">
      <header className="flex flex-col gap-2">
        <h2 id="ask-title" className="font-serif text-[1.75rem] leading-tight text-ink">Ask for a release</h2>
        <p className="text-[0.9375rem] text-text">Choose the table you want. Council seat 1 files it as a proposal on the chapel's DAO.</p>
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
          onChange={pickFilterField}
          options={[{ value: "none", label: "Everyone" }, ...filterOptions]}
        />
        {filterField !== "none" && (
          <ChoiceGroup
            label={`${filterField} value`}
            value={filterValue}
            onChange={setFilterValue}
            options={VALUES[filterField].map((v) => ({ value: v, label: valueLabel(filterField, v) }))}
          />
        )}
      </div>

      <div className="flex flex-col gap-2 border-t-2 border-ink pt-5">
        <span className="text-[0.8125rem] text-muted-foreground">The request</span>
        <p className="font-serif text-[1.375rem] leading-snug text-ink">{describeQuery(query)}</p>
        <p className="text-[0.875rem] text-muted-foreground">
          Groups under {k} members are withheld, and so is any cell that, with earlier releases, would single someone out.
        </p>
      </div>

      <SquareButton onClick={() => onPropose(query)} disabled={pending} className="w-full">
        {pending ? (
          <>
            <Spinner className="size-4" /> Filing the proposal…
          </>
        ) : (
          "Propose to the council"
        )}
      </SquareButton>
      {pending && <p className="-mt-3 text-[0.875rem] text-muted-foreground" role="status">Sending to the DAO on testnet; this usually takes 5 to 20 seconds.</p>}
      {result && !pending && (
        <p className="-mt-2 text-[0.9375rem] text-ink" role="status">
          Proposal #{result.proposal_id} is open. Two seats must approve it.{" "}
          {result.mock ? <span className="text-muted-foreground">(mock, not sent)</span> : <TxLink tx={result.tx.hash} />}
        </p>
      )}
      {error !== null && error !== undefined && !pending && <ErrorState error={error} title="The proposal was not filed." className="bg-white" />}
      {mock && <p className="text-[0.8125rem] text-indigo">Mock mode: nothing here is sent to NEAR testnet.</p>}
    </section>
  )
}
