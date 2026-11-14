import { useState } from "react"
import { cn } from "@/lib/utils"
import { eur, int } from "@/lib/format"
import { useInViewOnce } from "@/components/gl/reveal"
import { useEvaluation, type EvalCase, type Evaluation } from "./data"
import { ErrorState, Shimmer } from "@/components/unit"

type Side = "naive" | "bandsheet"

function DotGrid({ cases, side, active, onActive, inView }: { cases: EvalCase[]; side: Side; active: number | null; onActive: (n: number | null) => void; inView: boolean }) {
  return (
    <div className="grid w-fit grid-cols-10 gap-[7px] sm:gap-2" role="list" aria-label={side === "naive" ? "Typical tool, 100 cases" : "Bandsheet, 100 cases"}>
      {cases.map((c, i) => {
        const leaked = c[side].leaked
        return (
          <button
            key={c.case}
            type="button"
            role="listitem"
            aria-label={`Case ${c.case}: ${leaked ? "leaked" : "safe"}`}
            onMouseEnter={() => onActive(c.case)}
            onFocus={() => onActive(c.case)}
            onClick={() => onActive(c.case)}
            className={cn(
              "size-[18px] cursor-pointer rounded-full border-2 transition-[background-color,border-color,transform,opacity] duration-500 ease-gl sm:size-5",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lav",
              leaked ? "border-alarm" : "border-ink",
              inView ? "opacity-100" : "opacity-0",
              inView && leaked ? "bg-alarm" : "bg-transparent",
              active === c.case && "scale-125 border-lav",
            )}
            style={{ transitionDelay: inView ? `${i * 8}ms` : "0ms" }}
          />
        )
      })}
    </div>
  )
}

function CaseCaption({ c }: { c: EvalCase | undefined }) {
  if (!c) {
    return <p className="text-[0.9375rem] text-muted-foreground">Hover or tap a dot to read that case.</p>
  }
  const naiveCells = c.releases.reduce((s, r) => s + r.naive_cells_published, 0)
  const guardCells = c.releases.reduce((s, r) => s + r.bandsheet_cells_published, 0)
  return (
    <div className="grid gap-x-10 gap-y-2 md:grid-cols-[auto_1fr_1fr]">
      <p className="font-serif text-[1.25rem] text-ink">Case {c.case}</p>
      <p className="text-[0.9375rem] text-foreground md:col-span-2">
        {c.pattern.charAt(0).toUpperCase() + c.pattern.slice(1)}; {c.releases.length} releases over {int(c.releases[0]?.members ?? 0)}–{int(Math.max(...c.releases.map((r) => r.members)))} members.
      </p>
      <span className="max-md:hidden" />
      <p className={cn("text-[0.9375rem]", c.naive.leaked ? "text-alarm" : "text-foreground")}>
        Typical tool: {c.naive.leaked ? `leaked. ${int(c.naive.exact_recoveries)} salaries recovered, ${int(c.naive.isolated_pairs)} pairs isolated` : "no leak"}
        {c.naive.leaked && c.naive.worst_recovery_error_eur !== undefined ? ` (worst error ${eur(c.naive.worst_recovery_error_eur)})` : ""}. {int(naiveCells)} cells.
      </p>
      <p className="text-[0.9375rem] text-ink">
        Bandsheet: {c.bandsheet.leaked ? "leaked" : "nobody exposed"}. {int(guardCells)} of {int(naiveCells)} cells published.
      </p>
    </div>
  )
}

/** The 100-case evaluation as a calm Greenlock numbers band: big serif figures and two dot grids. */
export function EvalFigure() {
  const { data, isPending, isError, error, refetch } = useEvaluation()
  if (isPending) return <Shimmer className="h-[34rem] w-full" />
  if (isError) return <ErrorState error={error} title="The evaluation could not be loaded." onRetry={() => void refetch()} />
  return <EvalBody data={data} />
}

function EvalBody({ data }: { data: Evaluation }) {
  const { ref, inView } = useInViewOnce<HTMLDivElement>(0.2)
  const [active, setActive] = useState<number | null>(null)
  const s = data.summary
  const pct = Math.round((s.bandsheet.cells_published / s.naive.cells_published) * 100)
  const activeCase = data.cases.find((c) => c.case === active)

  return (
    <div ref={ref} className="flex flex-col gap-10 bg-band px-5 py-10 md:px-10 md:py-14" onMouseLeave={() => setActive(null)}>
      <header className="flex max-w-[44rem] flex-col gap-3">
        <p className="text-[0.8125rem] font-semibold tracking-[0.04em] text-ink uppercase">Evaluation · {int(s.cases)} simulated chapels</p>
        <h2 className="font-serif text-[2rem] leading-tight text-ink md:text-[2.75rem]">One subtraction is a demo. Here are a hundred.</h2>
        <p className="text-[1rem] leading-relaxed text-foreground">
          Joins, leaves, repeated tables and overlapping group-bys at k = {s.k}. An independent attacker, exact rational Gaussian elimination that shares
          no code with the audit, tried to solve every member's pay from what each tool published.
        </p>
      </header>

      <div className="grid gap-12 md:grid-cols-2 md:gap-10">
        {(["naive", "bandsheet"] as const).map((side) => (
          <div key={side} className="flex flex-col gap-6">
            <div className="flex items-end gap-5">
              <span className={cn("gl-num text-[5rem] leading-[0.85] md:text-[6.5rem]", side === "naive" ? "text-alarm" : "text-ink")}>
                {side === "naive" ? s.naive.cases_leaking : s.bandsheet.cases_leaking}
              </span>
              <div className="flex flex-col pb-1">
                <span className="text-[0.8125rem] font-semibold tracking-[0.04em] text-ink uppercase">{side === "naive" ? "A typical n≥3 tool" : "Bandsheet"}</span>
                <span className="text-[1rem] text-foreground">of {int(s.cases)} cases leaked a salary</span>
              </div>
            </div>
            <DotGrid cases={data.cases} side={side} active={active} onActive={setActive} inView={inView} />
            <p className="text-[0.9375rem] text-foreground">
              {side === "naive"
                ? `${int(s.naive.cases_with_exact_recovery)} cases gave up a salary to the euro; ${int(s.naive.members_exactly_recovered)} members exposed in all.`
                : `Nobody exposed, while still publishing ${int(s.bandsheet.cells_published)} of the typical tool's ${int(s.naive.cells_published)} cells (${pct}%).`}
            </p>
          </div>
        ))}
      </div>

      <div className="flex min-h-[5.5rem] flex-col justify-center border-t-2 border-ink pt-5" aria-live="polite">
        <CaseCaption c={activeCase} />
      </div>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[0.8125rem] text-muted-foreground">
        <span className="inline-flex items-center gap-2"><span className="size-3 rounded-full bg-alarm" /> leaked</span>
        <span className="inline-flex items-center gap-2"><span className="size-3 rounded-full border-2 border-ink" /> nobody exposed</span>
        <span>Seeds 0–99 from the enclave's adversarial test suite; synthetic data.</span>
      </div>
    </div>
  )
}
