import type { ReactNode } from "react"
import { Lock } from "lucide-react"
import type { Cell } from "@bandsheet/core"
import { TxLink } from "@/components/unit"
import { REASON_LABEL } from "@/components/unit-b/format"
import { ReleaseProof } from "@/components/unit-b/release-proof"
import { prettyWitness } from "@/components/unit-b/release-cells"
import { eur, int } from "@/lib/format"
import { units } from "@/lib/units"
import type { Attack, UnitProposal, UnitRelease } from "@/lib/units/schemas"
import { keyOf, useProposalTxs } from "./use-unit-attack"

const sameKey = (a: Record<string, string>, b: Record<string, string>) => keyOf(a) === keyOf(b) && Object.keys(a).length === Object.keys(b).length

/**
 * What a typical n≥3 tool would have published for the same request: both tables, the second one computed from the
 * first plus the one colleague the lab changed. Its subtraction gives that colleague's pay back.
 */
function naive(attack: Attack, cell: Cell) {
  const x = attack.colleague.gross_annual_eur
  const add = attack.action === "add"
  const n1 = cell.n
  const n2 = add ? n1 + 1 : n1 - 1
  const m2 = Math.round((n1 * cell.mean_eur + (add ? x : -x)) / n2)
  const revealed = add ? n2 * m2 - n1 * cell.mean_eur : n1 * cell.mean_eur - n2 * m2
  return { x, add, n1, n2, m1: cell.mean_eur, m2, revealed }
}

function Row({ label, n, value, note }: { label: string; n: number; value: ReactNode; note?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border py-3">
      <span className="text-[0.9375rem] text-foreground">
        {label}
        <span className="text-muted-foreground max-sm:block sm:ml-2">{int(n)} members</span>
      </span>
      <span className="flex shrink-0 flex-col items-end">
        <span className="gl-num text-[1.25rem] text-ink">{value}</span>
        {note && <span className="text-[0.75rem] text-muted-foreground">{note}</span>}
      </span>
    </div>
  )
}

function Line({ sign, n, mean }: { sign: string; n: number; mean: number }) {
  return (
    <div className="grid grid-cols-[1.25rem_1fr_auto] items-baseline gap-x-2">
      <span className="text-muted-foreground">{sign}</span>
      <span>
        {int(n)} × {eur(mean)}
      </span>
      <span className="text-right">{eur(n * mean)}</span>
    </div>
  )
}

export function NaiveSide({ attack, base, cell, newId }: { attack: Attack; base: UnitRelease; cell: Cell; newId: number }) {
  const r = naive(attack, cell)
  const label = keyOf(attack.cell)
  const [big, small] = r.add ? [{ n: r.n2, m: r.m2 }, { n: r.n1, m: r.m1 }] : [{ n: r.n1, m: r.m1 }, { n: r.n2, m: r.m2 }]
  return (
    <section className="flex min-w-0 flex-col gap-5 bg-band p-6 md:p-8">
      <header className="flex flex-col gap-1.5">
        <p className="text-[0.8125rem] font-semibold tracking-[0.04em] text-ink uppercase">A typical n≥3 tool</p>
        <h2 className="font-serif text-[1.5rem] leading-tight text-ink md:text-[1.625rem]">Publishes both tables.</h2>
      </header>
      <div>
        <Row label={`Release #${base.id} · ${label}`} n={r.n1} value={eur(r.m1)} />
        <Row label={`Release #${newId} · ${label}`} n={r.n2} value={eur(r.m2)} note="what it would publish" />
      </div>
      <div className="flex flex-col gap-2 font-serif text-[1.25rem] text-ink tabular md:text-[1.4375rem]">
        <Line sign="" n={big.n} mean={big.m} />
        <Line sign="−" n={small.n} mean={small.m} />
        <div className="my-1 h-[2px] bg-ink" />
        <p className="gl-num w-fit pt-1 text-[3.25rem] leading-none text-alarm md:text-[4.25rem]">
          {r.revealed === r.x ? "" : "≈ "}
          {eur(r.revealed)}
        </p>
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="w-fit bg-lav-mid px-2 py-0.5 text-[0.75rem] font-semibold tracking-[0.04em] text-indigo uppercase">Synthetic colleague · sample figure</span>
        <p className="text-[1.0625rem] font-semibold text-alarm">One colleague's pay, recovered by subtraction.</p>
        <p className="text-[0.9375rem] leading-relaxed text-foreground">
          Synthetic colleague, sample figure: the server generated {eur(r.x)} for the colleague the lab {r.add ? "added" : "removed"}, which is the only reason
          it can be shown. With a real colleague, this line would be their salary.{r.revealed === r.x ? "" : " The published mean is rounded to the euro, so the subtraction lands within a few euros."}
        </p>
      </div>
    </section>
  )
}

function Hash({ label, tx }: { label: string; tx: string | null | undefined }) {
  return (
    <li className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-border py-2.5 text-[0.9375rem]">
      <span className="text-foreground">{label}</span>
      {tx ? (
        <TxLink tx={tx} className="text-[0.9375rem]" />
      ) : (
        <span className="text-muted-foreground">{tx === undefined ? "looking it up on nearblocks…" : "not on nearblocks yet"}</span>
      )}
    </li>
  )
}

export function EngineSide({ attack, release, proposal, unitId }: { attack: Attack; release: UnitRelease; proposal: UnitProposal; unitId: number }) {
  const published = release.cells.find((c) => sameKey(c.key, attack.cell))
  const held = release.suppressed.find((s) => sameKey(s.key, attack.cell))
  const txs = useProposalTxs(unitId, proposal)
  const label = keyOf(attack.cell)
  return (
    <section className="flex min-w-0 flex-col gap-5 border-2 border-ink bg-white p-6 md:p-8">
      <header className="flex flex-col gap-1.5">
        <p className="text-[0.8125rem] font-semibold tracking-[0.04em] text-ink uppercase">Bandsheet's engine</p>
        <h2 className="font-serif text-[1.5rem] leading-tight text-ink md:text-[1.625rem]">Ran the same request, release #{release.id}.</h2>
      </header>
      {held ? (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-4">
            <span className="grid size-12 place-items-center bg-ink text-white"><Lock className="size-5" /></span>
            <p className="font-serif text-[2.25rem] leading-none text-ink md:text-[2.75rem]">Withheld</p>
          </div>
          <p className="text-[0.8125rem] font-semibold tracking-[0.04em] text-indigo uppercase">{REASON_LABEL[held.reason] ?? held.reason} · {label}</p>
          <p className="font-serif text-[1.25rem] leading-snug text-ink italic">{prettyWitness(held.witness)}.</p>
          <p className="text-[0.9375rem] leading-relaxed text-foreground">
            The engine saw the subtraction coming and refused the {label} cell. There is nothing to subtract, and the refusal itself is on chain.
          </p>
        </div>
      ) : published ? (
        <div className="flex flex-col gap-3">
          <p className="font-serif text-[2.25rem] leading-none text-ink">Published</p>
          <p className="text-[0.9375rem] leading-relaxed text-foreground">
            The engine published {label}: {int(published.n)} members, mean {eur(published.mean_eur)}. Shown as it is: this run did not withhold the cell, and the
            subtraction on the left would work against it.
          </p>
        </div>
      ) : (
        <p className="text-[0.9375rem] leading-relaxed text-foreground">Release #{release.id} has no row for {label}: the engine neither published nor withheld it.</p>
      )}
      <div className="flex flex-col gap-2">
        <p className="text-[0.8125rem] font-semibold tracking-[0.04em] text-ink uppercase">Every step, on chain</p>
        <ul className="flex flex-col">
          {attack.txs.map((t, i) => (
            <Hash key={t.hash} label={i === 0 ? `${attack.action === "add" ? "Synthetic colleague added" : "Synthetic colleague removed"}` : "Its sealed entry"} tx={t.hash} />
          ))}
          <Hash label={`Proposal #${proposal.id}, same request`} tx={txs.data ? txs.data.propose : txs.isError ? null : undefined} />
          {(txs.data?.votes ?? proposal.approvals.filter((a) => a !== proposal.proposer).map((account) => ({ account, tx: undefined }))).map((v) => (
            <Hash key={v.account} label={`Vote, ${v.account}`} tx={v.tx} />
          ))}
          <Hash label="Engine run (unit_run)" tx={release.txHash} />
        </ul>
      </div>
      <ReleaseProof release={release} tx={release.txHash ?? undefined} contract={units.contract} />
    </section>
  )
}
