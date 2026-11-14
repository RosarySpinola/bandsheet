import type { ReleaseRecord } from "@bandsheet/core"
import { useReleases, explorer } from "@/lib/chain"
import { eur, int } from "@/lib/format"
import { choiceLabel, guardSubtract, type CellChoice, type GuardResult, type HeroId } from "./attack-math"
import { useReleaseTxs } from "./data"
import { NAIVE_DONE_AT } from "./naive-panel"
import { SettlingLock, Step } from "./particle-figure"
import { prettyWitness } from "./release-cells"
import { ErrorState, Shimmer, ExtLink, TxLink } from "@/components/unit"

const T0 = NAIVE_DONE_AT + 0.2

function ChainRow({ r, choice }: { r: ReleaseRecord; choice: CellChoice }) {
  if (choice === "all") {
    const n = r.cells.reduce((s, c) => s + c.n, 0)
    return (
      <div className="flex items-baseline justify-between gap-4 border-b border-border py-3">
        <span className="text-[0.9375rem] text-foreground">
          Release #{r.id} · all published cells<span className="text-muted-foreground max-sm:block sm:ml-2">{int(n)} members</span>
        </span>
        <span className="text-[0.875rem] text-muted-foreground">{r.suppressed.length ? `${r.suppressed.length} withheld` : "complete"}</span>
      </div>
    )
  }
  const cell = r.cells.find((c) => c.key.grade === choice)
  const held = r.suppressed.find((s) => s.key.grade === choice)
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border py-3">
      <span className="text-[0.9375rem] text-foreground">
        Release #{r.id} · {choice}
        {cell && <span className="text-muted-foreground max-sm:block sm:ml-2">{int(cell.n)} members</span>}
      </span>
      {cell ? (
        <span className="gl-num text-[1.25rem] text-ink">{eur(cell.mean_eur)}</span>
      ) : (
        <span className="font-serif text-[1.25rem] text-indigo italic">{held ? "Withheld" : "Not published"}</span>
      )}
    </div>
  )
}

function Outcome({ g, choice }: { g: GuardResult; choice: CellChoice }) {
  switch (g.kind) {
    case "withheld":
      return (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-4">
            <SettlingLock at={T0} />
            <Step at={T0 + 0.1}>
              <p className="font-serif text-[2.25rem] leading-none text-ink md:text-[2.75rem]">Withheld</p>
            </Step>
          </div>
          <Step at={T0 + 0.5}>
            <p className="font-serif text-[1.25rem] leading-snug text-ink italic">{prettyWitness(g.witness)}.</p>
            <p className="mt-2 text-[0.9375rem] text-foreground">
              The engine saw the subtraction coming and refused the cell in release #{g.release}. There is nothing to subtract, and the refusal itself is on chain.
            </p>
          </Step>
        </div>
      )
    case "nobody":
      return (
        <Step at={T0}>
          <span className="gl-num text-[2.5rem] leading-none text-ink">{eur(g.from.n * g.from.mean_eur - g.minus.n * g.minus.mean_eur)}</span>
          <p className="mt-2 text-[1rem] font-semibold text-ink">Nobody isolated, so it was published.</p>
          <p className="mt-1 text-[0.875rem] text-muted-foreground">{choiceLabel(choice)} has {int(g.from.n)} members in both releases. The difference names no one.</p>
        </Step>
      )
    case "group":
      return (
        <Step at={T0}>
          <p className="text-[1rem] font-semibold text-ink">Nobody isolated.</p>
          <p className="mt-1 text-[0.875rem] text-muted-foreground">The two cells are {int(Math.abs(g.dn))} members apart, so the difference is a group average, not a salary.</p>
        </Step>
      )
    case "totals":
      return (
        <div className="flex flex-col gap-4">
          {g.missing.length > 0 && (
            <div className="flex items-center gap-4">
              <SettlingLock at={T0} />
              <Step at={T0 + 0.1}>
                <p className="font-serif text-[1.75rem] leading-tight text-ink">The totals never line up.</p>
              </Step>
            </div>
          )}
          <Step at={T0 + 0.4}>
            <p className="text-[0.9375rem] text-foreground">
              {g.missing.length
                ? `${g.missing.join(", ")} is withheld, so the published cells cover ${int(g.fromN)} and ${int(g.minusN)} members. Their difference spans ${int(Math.abs(g.fromN - g.minusN))} people, not one.`
                : `Both releases publish every cell; the totals differ by ${int(Math.abs(g.fromN - g.minusN))} members.`}
            </p>
          </Step>
        </div>
      )
    case "leak":
      return <p className="text-[0.9375rem] font-semibold text-alarm">These two published cells differ by one member. Report this: the audit should have refused it.</p>
    case "missing":
      return <p className="text-[0.9375rem] text-foreground">One of these releases has no {choiceLabel(choice)} cell on chain, so there is nothing to subtract.</p>
  }
}

/** Right side: the same request against the real records on NEAR testnet. */
export function GuardPanel({ from, minus, choice, run }: { from: HeroId; minus: HeroId; choice: CellChoice; run: number }) {
  const { data, isPending, isError, error, refetch } = useReleases()
  const txs = useReleaseTxs()
  const rFrom = data?.releases.find((r) => r.id === from)
  const rMinus = data?.releases.find((r) => r.id === minus)
  const g = guardSubtract(rFrom, rMinus, choice)
  const proofId = g.kind === "withheld" ? g.release : Math.max(from, minus)
  const tx = txs[proofId]

  return (
    <section className="flex min-w-0 flex-col gap-5 border-2 border-ink bg-white p-6 md:p-8">
      <header className="flex flex-col gap-1.5">
        <p className="text-[0.8125rem] font-semibold tracking-[0.04em] text-ink uppercase">Bandsheet · live on NEAR testnet</p>
        <h2 className="font-serif text-[1.5rem] leading-tight text-ink md:text-[1.625rem]">Checks against every earlier release.</h2>
      </header>

      {isPending ? (
        <div className="flex flex-col gap-3">
          <Shimmer className="h-11 w-full" />
          <Shimmer className="h-11 w-full" />
          <Shimmer className="h-40 w-full" />
        </div>
      ) : isError ? (
        <ErrorState error={error} title="The on-chain releases could not be read." onRetry={() => void refetch()} />
      ) : !rFrom || !rMinus ? (
        <p className="text-[0.9375rem] text-foreground">Release #{!rFrom ? from : minus} is not on chain yet. Run the hero vote first.</p>
      ) : (
        <>
          <div>
            <ChainRow r={rMinus.id < rFrom.id ? rMinus : rFrom} choice={choice} />
            <ChainRow r={rMinus.id < rFrom.id ? rFrom : rMinus} choice={choice} />
          </div>
          {run === 0 ? (
            <p className="min-h-[14.5rem] text-[0.9375rem] text-muted-foreground">Same two requests, same chapel. Press Subtract.</p>
          ) : (
            <div key={`${run}-${from}-${minus}-${choice}`} className="flex min-h-[14.5rem] flex-col justify-between gap-6">
              <Outcome g={g} choice={choice} />
              {tx && (
                <Step at={T0 + 1} className="flex flex-wrap gap-x-6 gap-y-2 border-t border-border pt-4 text-[0.9375rem]">
                  <TxLink tx={tx} label={`Release #${proofId} transaction`} />
                  <ExtLink href={explorer.attestation(tx)}>OutLayer attestation</ExtLink>
                </Step>
              )}
            </div>
          )}
        </>
      )}
    </section>
  )
}
