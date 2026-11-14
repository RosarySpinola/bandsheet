import type { Position } from "@/lib/api"
import { eur, int, signedEur, signedPct } from "@/lib/format"
import { cn } from "@/lib/utils"

const WORD = { below: "below", near: "about level with", above: "above" } as const

/** Delta, percentage and a small band bar: band mean as an ink tick, the member as a lavender marker. */
export function PositionCard({ p }: { p: Position }) {
  const lo = Math.min(p.your_eur, p.band_mean_eur) * 0.8
  const hi = Math.max(p.your_eur, p.band_mean_eur) * 1.15
  const pct = (v: number) => ((v - lo) / (hi - lo)) * 100
  const at = (v: number) => `${pct(v)}%`
  return (
    <div className="flex flex-col gap-8 bg-band p-6 md:p-10">
      <div className="flex flex-col gap-2">
        <p className="text-[0.8125rem] font-medium tracking-[0.02em] text-muted-foreground uppercase">Your position · {p.grade}</p>
        <p className="gl-num text-[3rem] leading-none text-ink md:text-[4rem]">{signedEur(p.delta_eur)}</p>
        <p className="text-[1.0625rem] text-foreground">
          {signedPct(p.delta_pct)}, {WORD[p.relation]} the {p.grade} band mean of {eur(p.band_mean_eur)}
        </p>
      </div>

      <div className="flex flex-col gap-3" aria-hidden="true">
        <div className="relative h-16">
          <div className="absolute inset-x-0 top-7 h-2 bg-white" />
          <div
            className="absolute top-7 h-2 bg-lav-mid"
            style={{ left: at(Math.min(p.your_eur, p.band_mean_eur)), right: `calc(100% - ${at(Math.max(p.your_eur, p.band_mean_eur))})` }}
          />
          <Marker pct={pct(p.band_mean_eur)} label={`Band mean ${eur(p.band_mean_eur)}`} tone="ink" />
          <Marker pct={pct(p.your_eur)} label={`You ${eur(p.your_eur)}`} tone="lav" />
        </div>
      </div>
      <p className="text-[0.9375rem] text-muted-foreground">
        The band is the average of {int(p.band_n)} members' gross annual pay. It is a mean, not a range, so a gap is a prompt to ask, not
        proof of unfair pay.
      </p>
    </div>
  )
}

function Marker({ pct, label, tone }: { pct: number; label: string; tone: "ink" | "lav" }) {
  return (
    <div className="absolute top-0 h-full w-0" style={{ left: `${pct}%` }}>
      <div className={cn("absolute top-5 h-6 w-[3px] -translate-x-1/2", tone === "ink" ? "bg-ink" : "bg-lav")} />
      <span
        className={cn(
          "absolute text-[0.8125rem] font-semibold whitespace-nowrap",
          tone === "ink" ? "top-0 text-ink" : "bottom-0 text-indigo",
          pct < 50 ? "left-0" : "right-0",
        )}
      >
        {label}
      </span>
    </div>
  )
}
