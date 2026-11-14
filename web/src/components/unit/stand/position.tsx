import type { Position } from "@/lib/api"
import type { WageContext } from "@/lib/dkim"
import { ExtLink } from "../links"
import { eur, int, signedEur, signedPct } from "@/lib/format"
import { cn } from "@/lib/utils"

const WORD = { below: "below", near: "about level with", above: "above" } as const

/** Delta, percentage and a small band bar: band mean as an ink tick, the member as a lavender marker. */
export function PositionCard({ p, context, origin }: { p: Position; context?: WageContext; origin?: string }) {
  /** Eurostat gives a monthly median; x12 to sit on the same annual scale (no bonuses). */
  const median = context ? Math.round(context.median_monthly_eur * 12) : null
  /** One country's survey median, never an EU-wide figure. */
  const label = context ? (context.label ?? `${context.country_name} median · ${context.isco_label} · Eurostat SES ${context.year}`) : ""
  const vals = [p.your_eur, p.band_mean_eur, ...(median ? [median] : [])]
  const lo = Math.min(...vals) * 0.8
  const hi = Math.max(...vals) * 1.15
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
        <div className={cn("relative", median ? "h-[5.5rem]" : "h-16")}>
          <div className="absolute inset-x-0 top-7 h-2 bg-white" />
          <div
            className="absolute top-7 h-2 bg-lav-mid"
            style={{ left: at(Math.min(p.your_eur, p.band_mean_eur)), right: `calc(100% - ${at(Math.max(p.your_eur, p.band_mean_eur))})` }}
          />
          <Marker pct={pct(p.band_mean_eur)} label={`Band mean ${eur(p.band_mean_eur)}`} tone="ink" />
          <Marker pct={pct(p.your_eur)} label={`You ${eur(p.your_eur)}`} tone="lav" />
          {median && context && <Marker pct={pct(median)} label={`${context.country_name} median ${eur(median)}`} tone="gray" />}
        </div>
      </div>
      {origin && <p className="-mt-2 text-[0.9375rem] leading-relaxed text-foreground">{origin}</p>}
      {median && context && (
        <div className="flex flex-col gap-2 border-l-2 border-[var(--gray-350)] pl-4">
          <p className="text-[0.9375rem] font-medium text-ink">
            {label}: {eur(context.median_monthly_eur)} a month, about {eur(median)} a year
          </p>
          <p className="text-[0.875rem] leading-relaxed text-muted-foreground">
            A broad category: every professional in {context.country_name}, not newsroom pay, and {context.year} is the latest survey year
            Eurostat publishes. Use it as a rough outside reference; the chapel band is the closer comparison.
          </p>
          <ExtLink href={context.source_url} className="w-fit text-[0.875rem]">
            Eurostat earn_ses_monthly
          </ExtLink>
        </div>
      )}
      <p className="text-[0.9375rem] text-muted-foreground">
        The band is the average of {int(p.band_n)} members' gross annual pay. It is a mean, not a range, so a gap is a prompt to ask, not
        proof of unfair pay.
      </p>
    </div>
  )
}

function Marker({ pct, label, tone }: { pct: number; label: string; tone: "ink" | "lav" | "gray" }) {
  return (
    <div className="absolute top-0 h-full w-0" style={{ left: `${pct}%` }}>
      <div
        className={cn(
          "absolute top-5 h-6 -translate-x-1/2",
          tone === "ink" ? "w-[3px] bg-ink" : tone === "lav" ? "w-[3px] bg-lav" : "w-0 border-l-2 border-dashed border-[var(--gray-350)]",
        )}
      />
      <span
        className={cn(
          "absolute text-[0.8125rem] font-semibold whitespace-nowrap",
          tone === "ink" ? "top-0 text-ink" : tone === "lav" ? "top-12 text-indigo" : "bottom-0 text-[var(--gray-350)]",
          pct < 50 ? "left-0" : "right-0",
        )}
      >
        {label}
      </span>
    </div>
  )
}
