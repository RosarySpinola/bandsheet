import { eur, int } from "@/lib/format"
import { cn } from "@/lib/utils"
import { NAIVE_MEMBERS, choiceLabel, naiveSubtract, type CellChoice, type HeroId, type Term } from "./attack-math"
import { ParticleFigure, Step } from "./particle-figure"

/** Timeline of the left-hand reveal, in seconds; the Bandsheet panel starts after it. */
export const NAIVE_DONE_AT = 2.3

function PublishedRow({ t, choice }: { t: Term; choice: CellChoice }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line py-3">
      <span className="text-[0.9375rem] text-text">
        Release #{t.release} · {choiceLabel(choice)}
        <span className="text-muted-foreground max-sm:block sm:ml-2">{int(t.n)} members</span>
      </span>
      <span className="flex shrink-0 flex-col items-end">
        <span className="gl-num text-[1.25rem] text-ink">{eur(t.mean ?? t.product)}</span>
        {t.mean === null && <span className="text-[0.75rem] text-muted-foreground">total pay, Σ n × mean</span>}
      </span>
    </div>
  )
}

function Line({ sign, t }: { sign: string; t: Term }) {
  return (
    <div className="grid grid-cols-[1.25rem_1fr_auto] items-baseline gap-x-2">
      <span className="text-muted-foreground">{sign}</span>
      <span>
        {t.mean === null ? (
          <>Σ release #{t.release} <span className="text-muted-foreground">({int(t.n)} members)</span></>
        ) : (
          <>
            {int(t.n)} × {eur(t.mean)}
          </>
        )}
      </span>
      <span className="text-right">{eur(t.product)}</span>
    </div>
  )
}

/** Left side: what a typical n≥3 tool publishes, and what one subtraction does to it. */
export function NaivePanel({ from, minus, choice, run }: { from: HeroId; minus: HeroId; choice: CellChoice; run: number }) {
  const r = naiveSubtract(from, minus, choice)
  return (
    <section className="flex min-w-0 flex-col gap-5 bg-band p-6 md:p-8">
      <header className="flex flex-col gap-1.5">
        <p className="text-[0.8125rem] font-semibold tracking-[0.04em] text-ink uppercase">A typical n≥3 tool</p>
        <h2 className="font-serif text-[1.5rem] leading-tight text-ink md:text-[1.625rem]">Publishes every group of three or more.</h2>
      </header>

      {!r ? (
        <p className="text-[0.9375rem] text-text">This tool did not publish {choiceLabel(choice)} in one of the releases, so there is nothing to subtract.</p>
      ) : (
        <>
          <div>
            <PublishedRow t={r.minus.release < r.from.release ? r.minus : r.from} choice={choice} />
            <PublishedRow t={r.minus.release < r.from.release ? r.from : r.minus} choice={choice} />
          </div>

          {run === 0 ? (
            <p className="min-h-[14.5rem] text-[0.9375rem] text-muted-foreground">Both figures are public. Press Subtract to see what they say together.</p>
          ) : (
            <div key={`${run}-${from}-${minus}-${choice}`} className="flex min-h-[14.5rem] flex-col gap-2 font-serif text-[1.25rem] text-ink tabular md:text-[1.4375rem]">
              <Step at={0}>
                <Line sign="" t={r.from} />
              </Step>
              <Step at={0.35}>
                <Line sign="−" t={r.minus} />
              </Step>
              <Step at={0.7} className="my-1 h-[2px] bg-ink" />
              {r.revealed !== null ? (
                <div className="flex flex-col gap-3 pt-2">
                  <ParticleFigure
                    text={eur(r.revealed)}
                    delay={0.9}
                    className="gl-num w-fit text-[3.25rem] leading-none text-alarm md:text-[4.25rem]"
                  />
                  <Step at={NAIVE_DONE_AT - 0.4} className="font-sans">
                    <p className="text-[1.0625rem] font-semibold text-alarm">
                      {r.who ? `${r.who}'s salary, exposed.` : "One member's salary, exposed."}
                    </p>
                    <p className="mt-1 text-[0.875rem] text-muted-foreground">
                      {r.who ? `Synthetic member who joined between the releases; ${int(Math.abs(r.dn))} member apart, nothing else changed.` : "The two figures differ by exactly one member."}
                    </p>
                  </Step>
                </div>
              ) : (
                <Step at={0.9} className="flex flex-col gap-2 pt-2 font-sans">
                  <span className={cn("gl-num text-[2.5rem] leading-none text-ink")}>{eur(r.diff)}</span>
                  <p className="text-[1rem] font-semibold text-ink">Nobody isolated.</p>
                  <p className="text-[0.875rem] text-muted-foreground">
                    {r.dn === 0
                      ? `${choiceLabel(choice)} has ${int(r.from.n)} members in both releases, so the difference names no one.`
                      : `The two figures are ${int(Math.abs(r.dn))} members apart, so the difference is a group's pay, not a person's.`}
                  </p>
                </Step>
              )}
            </div>
          )}
        </>
      )}
      <p className="mt-auto border-t border-line pt-4 text-[0.8125rem] text-muted-foreground">
        Simulated in your browser from the same synthetic payroll ({NAIVE_MEMBERS[1]} members, then {NAIVE_MEMBERS[2]}) with the naive rule in packages/core.
      </p>
    </section>
  )
}
