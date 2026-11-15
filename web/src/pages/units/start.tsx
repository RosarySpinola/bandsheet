import { useState } from "react"
import { Link, useNavigate } from "react-router"
import { ArrowRight } from "lucide-react"
import { CtaLink } from "@/components/unit"
import { Shimmer } from "@/components/unit/states"
import { EntryFrame } from "@/components/units/entry-frame"
import { CreateForm } from "@/components/units/create-form"
import { InviteReveal } from "@/components/units/invite-reveal"
import { JoinButton } from "@/components/units/join-button"
import { ReadyWallet } from "@/components/units/wallet-gate"
import { TxLink } from "@/components/unit/links"
import { LIMITS, isMock, type Conn, type Unit } from "@/lib/units"
import type { Created, Landed } from "@/lib/units/actions"
import { useMyUnits } from "@/lib/units/hooks"
import { shortAccount } from "@/lib/wallet/identity"

function YourUnits({ conn }: { conn: Conn }) {
  const mine = useMyUnits(conn.accountId)
  if (mine.isPending) return <Shimmer className="h-16 bg-white" />
  if (mine.isError) return <p className="text-[0.9375rem] text-muted-foreground">Your existing units could not be read just now. You can still create one.</p>
  const list = mine.data
  if (list.length === 0)
    return (
      <p className="border-l-2 border-border pl-4 text-[0.9375rem] leading-relaxed text-muted-foreground">
        {shortAccount(conn.accountId)} has no units yet. Create your first below.
      </p>
    )
  return <UnitList units={list} />
}

function UnitList({ units }: { units: Unit[] }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-[0.8125rem] font-medium tracking-[0.02em] text-muted-foreground uppercase">Your units</p>
      <ul className="flex flex-col border-t border-border">
        {units.map((u) => (
          <li key={u.id}>
            <Link to={`/u/${u.id}`} className="group flex items-center justify-between gap-4 border-b border-border py-3 text-ink transition-colors duration-[400ms] ease-gl hover:bg-white">
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-[1.0625rem] font-semibold">{u.name}</span>
                <span className="text-[0.8125rem] text-muted-foreground">
                  #{u.id} · {u.members} {u.members === 1 ? "member" : "members"} · {u.releases} {u.releases === 1 ? "release" : "releases"}
                </span>
              </span>
              <ArrowRight className="size-4 shrink-0 transition-transform duration-500 ease-gl group-hover:translate-x-1" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** After create_unit lands: the invite (shown once) and the creator's own join, then into the unit. */
function CreatedStep({ conn, created }: { conn: Conn; created: Landed<Created> }) {
  const navigate = useNavigate()
  const { unitId, code } = created.value
  const [joined, setJoined] = useState(false)
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2 border-t-2 border-ink pt-5">
        <p className="font-serif text-[2rem] leading-tight text-ink">Unit #{unitId} is yours.</p>
        <p className="text-[0.9375rem] leading-relaxed text-foreground">
          You hold council seat 1. {created.tx && <>create_unit landed: <TxLink tx={created.tx} className="text-[0.9375rem]" />{isMock() && " (mock)"}.</>}
        </p>
      </div>
      <InviteReveal unitId={unitId} code={code} />
      <div className="flex flex-col gap-3">
        <p className="text-[1.0625rem] font-semibold text-ink">Next: join as its first member</p>
        <p className="text-[0.9375rem] leading-relaxed text-foreground">
          A council seat governs; a member submits pay. To submit your own payslip, join with the same invite. Your wallet signs a message (free); no transaction.
        </p>
        <JoinButton conn={conn} unitId={unitId} code={code} label="Join my unit as member 1" onJoined={() => setJoined(true)} />
      </div>
      <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
        <CtaLink to={joined ? `/u/${unitId}/submit` : `/u/${unitId}`} size="lg">
          {joined ? "Submit your payslip" : "Open the unit"}
        </CtaLink>
        {!joined && (
          <button type="button" onClick={() => navigate(`/u/${unitId}/invite`)} className="wipe cursor-pointer text-[0.9375rem] text-muted-foreground hover:text-ink">
            Invite and council settings
          </button>
        )}
      </div>
    </div>
  )
}

export default function Start() {
  const [created, setCreated] = useState<Landed<Created> | null>(null)
  return (
    <EntryFrame
      eyebrow="Your own unit · NEAR testnet · free"
      title="Start your unit"
      lede="Pool your team's pay privately, with your own payslips. You create the unit from your wallet and invite colleagues; a sealed engine publishes average pay by group only when no one can be singled out."
      footer={
        <>
          Testnet only: no real money moves. Your posting key stays in this browser and can only call <code className="font-mono">submit</code>. At most {LIMITS.unitsPerAccount} units per account. Prefer to look first?{" "}
          <Link to="/unit" className="wipe font-semibold text-ink">Explore the example chapel</Link>.
        </>
      }
    >
      <ReadyWallet
        title="Connect your NEAR wallet to start"
        body="Your wallet creates the unit and holds its first council seat. Any NEAR testnet wallet works. If it holds no testnet NEAR, Bandsheet sends it 0.05 for gas."
        className="bg-white"
      >
        {(conn, gasReady) =>
          created ? (
            <CreatedStep conn={conn} created={created} />
          ) : (
            <StartBody conn={conn} gasReady={gasReady} onCreated={setCreated} />
          )
        }
      </ReadyWallet>
    </EntryFrame>
  )
}

function StartBody({ conn, gasReady, onCreated }: { conn: Conn; gasReady: boolean; onCreated: (c: Landed<Created>) => void }) {
  const mine = useMyUnits(conn.accountId)
  const created = (mine.data ?? []).filter((u) => u.creator === conn.accountId).length
  return (
    <div className="flex flex-col gap-8">
      <p className="text-[0.9375rem] text-muted-foreground">
        Connected as <code className="font-mono text-ink" title={conn.accountId}>{shortAccount(conn.accountId)}</code>
      </p>
      <YourUnits conn={conn} />
      <CreateForm conn={conn} gasReady={gasReady} atCap={created >= LIMITS.unitsPerAccount} onCreated={onCreated} />
    </div>
  )
}
