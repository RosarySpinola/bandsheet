import type { Cell, Suppressed } from "@bandsheet/core"
import { cn } from "@/lib/utils"
import { eur, int } from "@/lib/format"
import { REASON_LABEL, fieldHeading, keyLabel, keySort } from "./format"

type Row = { kind: "cell"; cell: Cell } | { kind: "withheld"; s: Suppressed; note: number }

/** Witness strings use ASCII minus; set them as a real minus sign. */
export const prettyWitness = (w: string) => w.replace(/ - /g, " − ")

const SUP = ["¹", "²", "³", "⁴", "⁵", "⁶", "⁷", "⁸", "⁹"]
const sup = (n: number) => (n <= 9 ? SUP[n - 1] : `(${n})`)

/**
 * The release table: published cells in ink, withheld cells inline as "Withheld" with a footnote
 * mark; the witness equations are set underneath in serif, like footnotes in a printed report.
 */
export function ReleaseCells({ cells, suppressed, groupBy }: { cells: Cell[]; suppressed: Suppressed[]; groupBy?: string[] }) {
  const withheld = [...suppressed].sort((a, b) => keySort(a.key, b.key))
  const rows: Row[] = [
    ...cells.map((cell) => ({ kind: "cell" as const, cell })),
    ...withheld.map((s, i) => ({ kind: "withheld" as const, s, note: i + 1 })),
  ].sort((a, b) => keySort(a.kind === "cell" ? a.cell.key : a.s.key, b.kind === "cell" ? b.cell.key : b.s.key))

  if (rows.length === 0) {
    return <p className="bg-band px-5 py-6 text-[0.9375rem] text-muted-foreground">The engine returned no cells for this request.</p>
  }

  return (
    <div className="flex flex-col gap-5">
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="border-b-2 border-ink text-[0.8125rem] font-medium tracking-[0.02em] text-muted-foreground uppercase">
            <th scope="col" className="py-2.5 pr-3 font-medium">{fieldHeading(groupBy)}</th>
            <th scope="col" className="w-[5.5rem] py-2.5 pr-3 text-right font-medium">Members</th>
            <th scope="col" className="w-[8.5rem] py-2.5 text-right font-medium max-sm:w-[7rem]">Mean, EUR</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) =>
            r.kind === "cell" ? (
              <tr key={keyLabel(r.cell.key)} className="border-b border-line text-ink">
                <th scope="row" className="py-3 pr-3 text-[1rem] font-medium">{keyLabel(r.cell.key)}</th>
                <td className="tabular py-3 pr-3 text-right text-[1rem]">{int(r.cell.n)}</td>
                <td className="gl-num py-3 text-right text-[1.1875rem]">{eur(r.cell.mean_eur)}</td>
              </tr>
            ) : (
              <tr key={`w-${keyLabel(r.s.key)}`} className="border-b border-line bg-lav-soft/60">
                <th scope="row" className="py-3 pr-3 pl-0 text-[1rem] font-medium text-ink">{keyLabel(r.s.key)}</th>
                <td colSpan={2} className="py-3 text-right">
                  <span className="font-serif text-[1.125rem] text-ink italic">Withheld</span>
                  <sup className="ml-0.5 font-serif text-[0.8125rem] text-indigo">{sup(r.note)}</sup>
                  <span className="ml-3 inline-block border border-lav px-1.5 py-0.5 align-middle text-[0.6875rem] font-semibold tracking-[0.04em] text-indigo uppercase max-sm:hidden">
                    {REASON_LABEL[r.s.reason] ?? r.s.reason}
                  </span>
                </td>
              </tr>
            ),
          )}
        </tbody>
      </table>
      {withheld.length > 0 && (
        <ol className="flex flex-col gap-2 border-t border-line pt-4">
          {withheld.map((s, i) => (
            <li key={keyLabel(s.key)} className="flex gap-2 font-serif text-[1.0625rem] leading-snug text-ink">
              <span className="w-4 shrink-0 text-indigo">{sup(i + 1)}</span>
              <span>
                <span className="text-muted-foreground">{REASON_LABEL[s.reason] ?? s.reason}. </span>
                <span className={cn(s.reason === "differencing" && "italic")}>{prettyWitness(s.witness)}.</span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
