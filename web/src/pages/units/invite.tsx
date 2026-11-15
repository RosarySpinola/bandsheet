import { useState } from "react"
import { KeyRound } from "lucide-react"
import { Page, PageHeader, Section } from "@/components/unit"
import { AddDomain, AddSeat, PendingSeats, RotateInvite } from "@/components/units/council-forms"
import { useWallet } from "@/lib/units/wallet-store"
import { InviteReveal } from "@/components/units/invite-reveal"
import { UnitGate } from "@/components/units/unit-states"
import { GasNotice, WalletGate } from "@/components/units/wallet-gate"
import { threshold } from "@/components/units/unit-query-builder"
import { shortAccount } from "@/lib/wallet/identity"
import { LIMITS, type Conn, type Unit } from "@/lib/units"
import { useGas } from "@/lib/units/hooks"
import { shownInvite } from "@/lib/units/invite"
import { useUnitOutlet } from "./shell"

export default function UnitInvite() {
  const { view } = useUnitOutlet()
  return (
    <Page width="narrow">
      <PageHeader glyph="invite" eyebrow={view.data ? `${view.data.unit.name} · unit #${view.data.unit.id}` : "Your unit"} title="Invite and council" lede="Share the invite with colleagues, add council seats, and list your employer's email domains so signed payslips count as DKIM-verified." />
      <UnitGate view={view}>{view.data && <Body unit={view.data.unit} />}</UnitGate>
    </Page>
  )
}

function Body({ unit }: { unit: Unit }) {
  const [, setFresh] = useState(0)
  const code = shownInvite(unit.id)
  const w = useWallet()
  return (
    <>
      <Section title="Invite colleagues">
        {code ? (
          <InviteReveal unitId={unit.id} code={code} />
        ) : (
          <div className="flex items-start gap-4 bg-band p-6 md:p-8">
            <span className="grid size-11 shrink-0 place-items-center bg-white text-ink">
              <KeyRound className="size-5" />
            </span>
            <div className="flex flex-col gap-2">
              <p className="text-[1.0625rem] font-semibold text-ink">The invite is shown once, when it is made.</p>
              <p className="max-w-[38rem] text-[0.9375rem] leading-relaxed text-foreground">
                The contract keeps only a hash of the code, so nobody can show it again, Bandsheet included. Share the link you copied then (it looks like /join/{unit.id}?code=…). Lost it? A council seat can make a new invite link below.
              </p>
            </div>
          </div>
        )}
        <CouncilOnly unit={unit}>{(conn) => <RotateInvite conn={conn} unit={unit} onNew={() => setFresh((n) => n + 1)} />}</CouncilOnly>
      </Section>

      <Section title="Council" aside={`${unit.council.length} of ${LIMITS.councilSeats} seats · ${threshold(unit.council.length)} must approve a release`}>
        <ol className="flex flex-col border-t border-border">
          {unit.council.map((s, i) => (
            <li key={s} className="flex items-center justify-between gap-4 border-b border-border py-3">
              <span className="text-[1rem] text-ink">
                Seat {i + 1} · <code className="font-mono text-[0.9375rem]" title={s}>{shortAccount(s)}</code>
              </span>
              {s === unit.creator && <span className="text-[0.8125rem] text-muted-foreground">created the unit</span>}
            </li>
          ))}
        </ol>
        <PendingSeats unit={unit} conn={w.status === "connected" ? w.conn : null} />
        <CouncilOnly unit={unit}>{(conn) => <AddSeat conn={conn} unit={unit} />}</CouncilOnly>
      </Section>

      <Section title="Employer email domains" aside="DKIM signing domains (d=)">
        {unit.dkimDomains.length ? (
          <ul className="flex flex-wrap gap-2">
            {unit.dkimDomains.map((d) => (
              <li key={d} className="bg-band px-3 py-1.5 font-mono text-[0.875rem] text-ink">{d}</li>
            ))}
          </ul>
        ) : (
          <p className="text-[0.9375rem] text-muted-foreground">None listed, so every entry counts as self-attested.</p>
        )}
        <CouncilOnly unit={unit}>{(conn) => <AddDomain conn={conn} unit={unit} />}</CouncilOnly>
      </Section>
    </>
  )
}

function CouncilOnly({ unit, children }: { unit: Unit; children: (conn: Conn) => React.ReactNode }) {
  return (
    <WalletGate title="Council seats change these" body="Connect a council wallet to add seats or domains. Each change is a transaction from your own wallet.">
      {(conn) => (unit.council.includes(conn.accountId) ? <WithGas conn={conn}>{children(conn)}</WithGas> : <p className="text-[0.9375rem] text-muted-foreground">Only council seats can change the council or the domains.</p>)}
    </WalletGate>
  )
}

function WithGas({ conn, children }: { conn: Conn; children: React.ReactNode }) {
  const gas = useGas(conn.accountId)
  return (
    <div className="flex flex-col gap-4">
      <GasNotice gas={gas} />
      {children}
    </div>
  )
}
