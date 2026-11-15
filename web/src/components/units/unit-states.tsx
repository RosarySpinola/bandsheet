import { Lock } from "lucide-react"
import { CtaLink, ErrorState, Shimmer } from "@/components/unit"
import { plainError } from "@/lib/api"
import { LIMITS, type Unit } from "@/lib/units"
import { plural } from "@/lib/format"

/** Loading, missing and unreadable units: the three ways a /u/:unitId page can fail to have a unit. */
export function UnitGate({ view, children }: { view: { isPending: boolean; isError: boolean; error: unknown; refetch: () => unknown; data?: { unit: Unit } }; children: React.ReactNode }) {
  if (view.isPending)
    return (
      <div className="flex flex-col gap-8" aria-busy="true" aria-label="Reading the unit">
        <Shimmer className="h-4 w-48" />
        <Shimmer className="h-14 w-[min(32rem,90%)]" />
        <Shimmer className="h-40" />
        <Shimmer className="h-64" />
      </div>
    )
  if (view.isError && plainError(view.error).code === "UNIT_NOT_FOUND")
    return (
      <div className="flex flex-col items-start gap-4 bg-band px-6 py-10 md:px-10">
        <p className="font-serif text-[2rem] leading-tight text-ink">There is no such unit.</p>
        <p className="max-w-[36rem] text-[1rem] text-muted-foreground">Unit numbers are small whole numbers given out in order. Check the link, or start your own.</p>
        <div className="flex flex-wrap gap-x-8 gap-y-3">
          <CtaLink to="/start">Start your unit</CtaLink>
          <CtaLink to="/unit">Explore the example chapel</CtaLink>
        </div>
      </div>
    )
  if (view.isError || !view.data)
    return <ErrorState error={view.error} title="The unit could not be read from NEAR testnet. Nothing has changed; it is the read that failed." onRetry={() => void view.refetch()} />
  return <>{children}</>
}

/**
 * The honest one-member (n < k) result: every cell is withheld, and that refusal is the privacy working, not a bug.
 */
export function TooFewState({ unit, refused }: { unit: Unit; refused: boolean }) {
  const real = unit.entries - unit.synthetic
  return (
    <div className="flex flex-col gap-5 border-t-2 border-ink bg-lav-soft p-6 md:p-8">
      <div className="flex items-start gap-4">
        <span className="grid size-11 shrink-0 place-items-center bg-ink text-white">
          <Lock className="size-5" />
        </span>
        <div className="flex flex-col gap-2">
          <p className="font-serif text-[1.625rem] leading-tight text-ink md:text-[1.875rem]">
            {refused ? "All cells withheld: n < 3." : unit.entries === 0 ? "No entries yet." : `${plural(unit.entries, "entry", "entries")}: every group is under k = ${LIMITS.k}.`}
          </p>
          <p className="max-w-[40rem] text-[1rem] leading-relaxed text-foreground">
            {unit.entries <= 1
              ? `With ${unit.entries === 0 ? "no one" : "one person"} in the unit, any average would be ${unit.entries === 0 ? "empty" : "that person's own pay"}. The engine never publishes a group of fewer than ${LIMITS.k}, so ${refused ? "it refused every cell and logged why" : "a release would publish nothing"}. That refusal is the honest result: it is the privacy working.`
              : `The engine publishes a group only when at least ${LIMITS.k} people are in it. Below that, an average narrows down to someone's pay, so the cell is withheld and the refusal is logged on chain.`}
          </p>
          <p className="max-w-[40rem] text-[0.9375rem] leading-relaxed text-muted-foreground">
            Real colleagues joining is the way bands publish. To see it work now, the council can add synthetic colleagues, labelled as sample data everywhere.
            {real > 0 && ` Your unit has ${plural(real, "real entry", "real entries")}.`}
          </p>
        </div>
      </div>
    </div>
  )
}
