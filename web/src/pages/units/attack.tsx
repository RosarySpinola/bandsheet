import { useState } from "react"
import { Link } from "react-router"
import { ArrowRight, RotateCcw } from "lucide-react"
import { Reveal } from "@/components/gl/reveal"
import { CtaLink, EmptyState, ErrorState, Page, PageHeader, Shimmer } from "@/components/unit"
import { ChangeDone, PickStep, ProposeStep, Step } from "@/components/units/attack/attack-steps"
import { EngineSide, NaiveSide } from "@/components/units/attack/attack-result"
import { attackStage, keyOf, useUnitAttacks, type AttackStage } from "@/components/units/attack/use-unit-attack"
import { UnitProposalCard } from "@/components/units/unit-proposal"
import { UnitGate } from "@/components/units/unit-states"
import { ReadyWallet } from "@/components/units/wallet-gate"
import { type UnitView } from "@/lib/units"
import { useWallet } from "@/lib/units/wallet-store"
import { useUnitOutlet } from "./shell"

export default function UnitAttack() {
  const { view } = useUnitOutlet()
  return (
    <Page className="gap-8 md:gap-10">
      <PageHeader
        glyph="attack"
        eyebrow={view.data ? `Attack lab · ${view.data.unit.name}` : "Attack lab"}
        title="Try to single someone out."
        lede="Change one published group by exactly one synthetic colleague, ask for the same table again, and subtract. A typical n≥3 tool hands that colleague's pay over. Here is what your unit's engine does."
        actions={
          <Link to="/unit/attack" className="wipe inline-flex items-center gap-1.5 text-[0.9375rem] font-semibold text-ink">
            See it on the example chapel <ArrowRight className="size-4" />
          </Link>
        }
      />
      <UnitGate view={view}>{view.data && <Body v={view.data} />}</UnitGate>
    </Page>
  )
}

function Body({ v }: { v: UnitView }) {
  const attacks = useUnitAttacks(v.unit.id)
  /** "Run the lab again": show step 1 until a change newer than this moment is on record. */
  const [againSince, setAgainSince] = useState<number | null>(null)
  if (attacks.isPending) return <Shimmer className="h-64" />
  if (attacks.isError) return <ErrorState error={attacks.error} onRetry={() => void attacks.refetch()} />
  const newest = attacks.data[0]?.started_at ?? 0
  const stage = attackStage(v, attacks.data, againSince !== null && newest <= againSince)
  if (stage.s === "none") return <NotYet v={v} />
  if (stage.s === "result")
    return (
      <>
        <Reveal>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <NaiveSide attack={stage.attack} base={stage.base} cell={stage.cell} newId={stage.release.id} />
            <EngineSide attack={stage.attack} release={stage.release} proposal={stage.proposal} unitId={v.unit.id} />
          </div>
        </Reveal>
        <div className="flex flex-wrap items-center gap-x-8 gap-y-3 border-t border-border pt-6">
          <button type="button" onClick={() => setAgainSince(Date.now())} className="wipe inline-flex cursor-pointer items-center gap-2 text-[1rem] font-semibold text-ink">
            <RotateCcw className="size-4" /> Run the lab again
          </button>
          <Link to={`/u/${v.unit.id}/releases`} className="wipe text-[1rem] text-ink">Open the release ledger</Link>
        </div>
      </>
    )
  return <Bench v={v} stage={stage} />
}

/** The steps, in order: change the group, ask again, the council approves, the engine runs. */
function Bench({ v, stage }: { v: UnitView; stage: Exclude<AttackStage, { s: "none" } | { s: "result" }> }) {
  const w = useWallet()
  const at = stage.s === "pick" ? 1 : stage.s === "propose" ? 2 : 3
  const state = (n: number) => (n < at ? "done" : n === at ? "now" : "later") as "done" | "now" | "later"
  const label = stage.s === "pick" ? null : keyOf(stage.attack.cell)
  return (
    <div className="grid grid-cols-1 items-start gap-10 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <ol className="flex min-w-0 flex-col">
        <Step n={1} title={label ? `Change ${label} by one synthetic colleague` : "Change one published group by one synthetic colleague"} state={state(1)}>
          {stage.s === "pick" ? (
            <ReadyWallet title="Connect a council wallet" body="The lab changes your unit, so a council seat signs for it: a message for the change (free), then a transaction to ask again.">
              {(conn) => <PickStep unit={v.unit} base={stage.base} cells={stage.cells} conn={conn} />}
            </ReadyWallet>
          ) : (
            <ChangeDone attack={stage.attack} cell={stage.cell} />
          )}
        </Step>
        <Step n={2} title={stage.s === "pick" ? "Ask for the same table again" : `Ask for release #${stage.base.id}'s table again`} state={state(2)}>
          {stage.s === "propose" && (
            <ReadyWallet title="Connect a council wallet" body="Asking again is a unit_propose_release transaction from a council seat's wallet.">
              {(conn, gasReady) => <ProposeStep unit={v.unit} attack={stage.attack} conn={conn} gasReady={gasReady} refusedId={stage.refused?.id} />}
            </ReadyWallet>
          )}
          {stage.s === "vote" && <p className="text-[0.9375rem] text-foreground">Proposal #{stage.proposal.id} asks for the same request as release #{stage.base.id}.</p>}
        </Step>
        <Step n={3} title="The council approves, then the engine runs" state={state(3)}>
          {stage.s === "vote" && (
            <UnitProposalCard p={stage.proposal} unit={v.unit} conn={w.status === "connected" ? w.conn : null} gasReady={true} />
          )}
        </Step>
      </ol>
      <aside className="flex flex-col gap-4 bg-band p-6">
        <p className="text-[0.8125rem] font-semibold tracking-[0.04em] text-ink uppercase">Why this is an attack</p>
        <p className="text-[0.9375rem] leading-relaxed text-foreground">
          Two honest averages of the same group, one member apart, give that member's pay away: n₂ × mean₂ − n₁ × mean₁. Real unions see this when someone joins
          or leaves between two reports.
        </p>
        <p className="text-[0.9375rem] leading-relaxed text-foreground">
          The lab uses a synthetic colleague, so the figure it recovers is sample data the server made up, flagged synthetic on chain. No member's pay is touched.
        </p>
      </aside>
    </div>
  )
}

function NotYet({ v }: { v: UnitView }) {
  const real = Math.max(0, v.unit.entries - v.unit.synthetic)
  return (
    <div className="flex flex-col gap-6">
      <EmptyState
        title="The lab needs one published group of three or more."
        body={`Your unit has ${v.unit.entries} sealed ${v.unit.entries === 1 ? "entry" : "entries"} (${real} real) and no release that published a group yet. File entries or add synthetic colleagues, then ask the council for a release; once a group of three or more is published, come back and try to single one of them out.`}
      />
      <div className="flex flex-wrap gap-x-8 gap-y-3">
        <CtaLink to={`/u/${v.unit.id}`}>Add synthetic colleagues</CtaLink>
        <CtaLink to={`/u/${v.unit.id}/vote`}>Ask for a release</CtaLink>
        <Link to="/unit/attack" className="wipe self-center text-[1rem] text-ink">See it on the example chapel</Link>
      </div>
    </div>
  )
}
