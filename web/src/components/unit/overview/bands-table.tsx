import { Lock } from "lucide-react"
import type { Cell, ReleaseRecord, Suppressed } from "@bandsheet/core"
import { cellLabel, eur, gradeRank, int } from "@/lib/format"
import { cn } from "@/lib/utils"
import { Tip } from "../tip"
import { Shimmer } from "../states"

type Row = { key: Record<string, string>; cell?: Cell; withheld?: Suppressed; previous?: { cell: Cell; release: number } }

/** The newest release's cells plus its withheld cells, in grade order; a withheld cell names its last safe figure. */
export function rowsFor(release: ReleaseRecord, all: ReleaseRecord[]): Row[] {
  const rows: Row[] = [
    ...release.cells.map((c) => ({ key: c.key, cell: c })),
    ...release.suppressed.map((s) => {
      const id = JSON.stringify(s.key)
      for (let i = all.length - 1; i >= 0; i--) {
        const r = all[i]!
        if (r.id >= release.id) continue
        const hit = r.cells.find((c) => JSON.stringify(c.key) === id)
        if (hit) return { key: s.key, withheld: s, previous: { cell: hit, release: r.id } }
      }
      return { key: s.key, withheld: s }
    }),
  ]
  return rows.sort((a, b) => gradeRank(a.key.grade) - gradeRank(b.key.grade) || cellLabel(a.key).localeCompare(cellLabel(b.key)))
}

const COLS =
  "grid grid-cols-[minmax(0,1.3fr)_minmax(0,0.6fr)_minmax(0,1.4fr)] items-center gap-4 md:grid-cols-[minmax(0,1.1fr)_5rem_minmax(0,1fr)_minmax(0,1.3fr)]"

export function BandsTable({ release, all }: { release: ReleaseRecord; all: ReleaseRecord[] }) {
  const rows = rowsFor(release, all)
  const max = Math.max(1, ...rows.map((r) => r.cell?.mean_eur ?? r.previous?.cell.mean_eur ?? 0))
  return (
    <div role="table" aria-label={`Release ${release.id} bands`} className="flex flex-col">
      <div role="row" className={cn(COLS, "border-b-2 border-ink pb-3 text-[0.8125rem] font-medium tracking-[0.02em] text-muted-foreground uppercase")}>
        <span role="columnheader">Grade</span>
        <span role="columnheader">Members</span>
        <span role="columnheader" className="text-right md:text-left">
          Mean gross pay
        </span>
        <span role="columnheader" className="hidden md:block" aria-hidden="true" />
      </div>
      {rows.map((r) => (
        <div
          role="row"
          key={JSON.stringify(r.key)}
          className={cn(COLS, "min-h-[4.5rem] border-b border-border py-3 transition-colors duration-[400ms] ease-gl hover:bg-band")}
        >
          <span role="cell" className="truncate text-[1.0625rem] font-semibold text-ink">
            {cellLabel(r.key)}
          </span>
          {r.cell ? (
            <>
              <span role="cell" className="tabular text-[1rem] text-foreground">
                {int(r.cell.n)}
              </span>
              <span role="cell" className="gl-num text-right text-[1.375rem] text-ink md:text-left md:text-[1.625rem]">
                {eur(r.cell.mean_eur)}
              </span>
              <span role="cell" className="hidden h-2 bg-band md:block" aria-hidden="true">
                <span className="block h-full bg-lav" style={{ width: `${(r.cell.mean_eur / max) * 100}%` }} />
              </span>
            </>
          ) : (
            <WithheldCells row={r} />
          )}
        </div>
      ))}
    </div>
  )
}

function WithheldCells({ row }: { row: Row }) {
  const w = row.withheld!
  const why =
    w.reason === "differencing" ? "Withheld: subtracting releases would expose one member." : "Withheld: fewer than k members in this group."
  return (
    <>
      <span role="cell" className="text-[1rem] text-muted-foreground">
        —
      </span>
      <span role="cell" className="flex justify-end md:col-span-2 md:justify-start">
        <Tip
          content={
            <span className="flex flex-col gap-2">
              <span className="font-semibold">{why}</span>
              <code className="font-mono text-[0.8125rem] text-lav-mid">{w.witness}</code>
              {row.previous && (
                <span className="text-white/80">
                  Release #{row.previous.release}'s figure ({eur(row.previous.cell.mean_eur)}, n = {row.previous.cell.n}) stays the public
                  band.
                </span>
              )}
            </span>
          }
        >
          <button
            type="button"
            className="group inline-flex cursor-help items-center gap-2 border border-ink bg-lav-soft px-3 py-1.5 text-[0.9375rem] font-semibold text-ink"
          >
            <Lock className="size-4" strokeWidth={2.25} />
            <span className="wipe group-hover:after:scale-x-100">Withheld</span>
          </button>
        </Tip>
      </span>
    </>
  )
}

export function BandsTableSkeleton() {
  return (
    <div className="flex flex-col" aria-busy="true" aria-label="Loading bands">
      <Shimmer className="mb-3 h-5 w-2/3" />
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="flex h-[4.5rem] items-center gap-4 border-b border-border">
          <Shimmer className="h-5 w-24" />
          <Shimmer className="h-5 w-10" />
          <Shimmer className="ml-auto h-7 w-28 md:ml-0" />
        </div>
      ))}
    </div>
  )
}
