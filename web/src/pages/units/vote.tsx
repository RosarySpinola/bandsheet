import { useEffect } from "react"
import { useLocation } from "react-router"
import { Reveal } from "@/components/gl/reveal"
import { AccountLink, EmptyState, Page, PageHeader } from "@/components/unit"
import { UnitProposalCard } from "@/components/units/unit-proposal"
import { UnitQueryBuilder, threshold } from "@/components/units/unit-query-builder"
import { UnitGate } from "@/components/units/unit-states"
import { GasNotice, WalletGate } from "@/components/units/wallet-gate"
import { units, type Conn, type UnitView } from "@/lib/units"
import { useGas } from "@/lib/units/hooks"
import { useWallet } from "@/lib/units/wallet-store"
import { useUnitOutlet } from "./shell"

export default function UnitVote() {
  const { view } = useUnitOutlet()
  return (
    <Page>
      <UnitGate view={view}>{view.data && <Body v={view.data} />}</UnitGate>
    </Page>
  )
}

function Body({ v }: { v: UnitView }) {
  const { unit } = v
  const w = useWallet()
  const conn: Conn | null = w.status === "connected" ? w.conn : null
  const gas = useGas(conn?.accountId)
  const seat = conn ? unit.council.indexOf(conn.accountId) : -1
  const list = [...v.proposals].sort((a, b) => b.id - a.id)
  const { hash } = useLocation()
  useEffect(() => {
    if (/^#p\d+$/.test(hash)) document.getElementById(hash.slice(1))?.scrollIntoView({ block: "start" })
  }, [hash])

  return (
    <>
      <PageHeader
        glyph="vote"
        eyebrow={`Council vote · ${unit.name} · votes on the units contract`}
        title="Releases are asked for, then voted."
        lede={`Every release starts as a proposal from a council seat's own wallet. It runs when more than half the council approves: ${threshold(unit.council.length)} of ${unit.council.length} here. Each vote is a real transaction, signed by that seat.`}
        actions={<AccountLink id={units.contract} className="text-[0.9375rem]" />}
      />

      <section aria-label="Your seat" className="-mt-4 flex flex-col gap-3 border-b border-border pb-6 md:-mt-8">
        {conn ? (
          <>
            <p className="text-[1rem] text-ink">
              {seat >= 0 ? <>You hold <strong>council seat {seat + 1}</strong> of {unit.council.length}. Propose and vote from this wallet.</> : "This wallet holds no seat on this unit's council. You can read every proposal; a seat can add you on the Invite and council page."}
            </p>
            <GasNotice gas={gas} />
          </>
        ) : (
          <WalletGate title="Hold a council seat? Connect to propose and vote." body="Reading proposals needs no wallet. Proposing and voting are transactions from your own wallet; Bandsheet sends gas if you have none.">
            {() => null}
          </WalletGate>
        )}
      </section>

      <div className="grid grid-cols-1 items-start gap-12 lg:grid-cols-[minmax(0,1fr)_24rem] lg:gap-10">
        <Reveal className="flex min-w-0 flex-col gap-12">
          {list.length === 0 ? (
            <EmptyState
              title="No release requests yet."
              body={unit.council.length === 1 ? "With a one-seat council, your proposal is the majority: proposing starts the engine straight away." : "File one on the right. It appears here as soon as the contract records it."}
            />
          ) : (
            list.map((p) => <UnitProposalCard key={p.id} p={p} unit={unit} conn={conn} gasReady={gas.ready} />)
          )}
        </Reveal>
        <Reveal delay={200} className="lg:sticky lg:top-8">
          {conn ? (
            <UnitQueryBuilder conn={conn} unit={unit} gasReady={gas.ready} />
          ) : (
            <div className="flex flex-col gap-3 bg-band p-6 md:p-8">
              <p className="font-serif text-[1.75rem] leading-tight text-ink">Propose a release</p>
              <p className="text-[0.9375rem] text-muted-foreground">Connect a council wallet to choose a table and file it.</p>
            </div>
          )}
        </Reveal>
      </div>
    </>
  )
}
