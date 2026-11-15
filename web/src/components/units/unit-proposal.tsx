import { useState } from "react"
import { Link } from "react-router"
import { useQueryClient } from "@tanstack/react-query"
import { Check, Minus, X } from "lucide-react"
import { Spinner } from "@/components/ui/spinner"
import { StatusTag } from "@/components/unit"
import { asQuery, describeQuery } from "@/components/unit-b/format"
import { fromNanos, when } from "@/lib/format"
import { cn } from "@/lib/utils"
import { shortAccount } from "@/lib/wallet/identity"
import type { Conn, Unit, UnitProposal } from "@/lib/units"
import { prepareVote, type Landed } from "@/lib/units/actions"
import { useTap } from "@/lib/units/use-tap"
import { EngineRunning } from "./engine-running"
import { TxState } from "./tx-state"
import { WithdrawButton } from "./withdraw-button"
import { threshold } from "./unit-query-builder"

const STATUS: Record<UnitProposal["status"], string> = { open: "InProgress", running: "Approved", done: "released", rejected: "Rejected", withdrawn: "Withdrawn", expired: "Expired", failed: "Failed" }

/** One release proposal: the request, each seat's vote, and (for a seat that has not voted) Approve / Reject. */
export function UnitProposalCard({ p, unit, conn, gasReady }: { p: UnitProposal; unit: Unit; conn: Conn | null; gasReady: boolean }) {
  // Only the seats that existed when the proposal was made can vote on it, and they set its threshold.
  const seats = p.council ?? unit.council
  const need = threshold(seats.length)
  const voted = conn ? p.approvals.includes(conn.accountId) || p.rejections.includes(conn.accountId) : false
  const canVote = Boolean(conn && seats.includes(conn.accountId) && p.status === "open" && !voted)
  const d = fromNanos(p.createdAt ?? null)
  /** Keeps the vote panel (and its landed-tx line) on screen after this seat's vote is counted. */
  const [touched, setTouched] = useState(false)
  const [withdrawing, setWithdrawing] = useState(false)
  return (
    <article id={`p${p.id}`} className="flex scroll-mt-24 flex-col gap-5 border-t-2 border-ink pt-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1.5">
          <span className="text-[0.875rem] text-muted-foreground">
            <span className="gl-num text-ink">#{p.id}</span> · proposed by {p.proposer ? shortAccount(p.proposer) : "a council seat"}
            {d ? ` · ${when(d)}` : ""}
          </span>
          <h3 className="font-serif text-[1.625rem] leading-tight text-ink md:text-[1.875rem]">{describeQuery(asQuery(p.query))}</h3>
        </div>
        <StatusTag status={STATUS[p.status]} />
      </div>
      <div className="flex flex-col gap-2">
        <p className="text-[0.9375rem] text-foreground">
          <strong className="font-semibold text-ink">{p.approvals.length} of {need}</strong> approvals needed ({seats.length} {seats.length === 1 ? "seat" : "seats"} when proposed, more than half must approve)
        </p>
        <ul className="flex flex-col gap-1.5">
          {seats.map((seat, i) => {
            const v = p.approvals.includes(seat) ? "approve" : p.rejections.includes(seat) ? "reject" : null
            return (
              <li key={seat} className={cn("flex items-center gap-3 text-[0.9375rem]", v ? "text-ink" : "text-muted-foreground")}>
                <span className={cn("grid size-5 shrink-0 place-items-center", v === "approve" ? "bg-ink text-white" : v === "reject" ? "border-2 border-ink" : "bg-band")}>
                  {v === "approve" ? <Check className="size-3.5" strokeWidth={3} /> : v === "reject" ? <X className="size-3" strokeWidth={3} /> : <Minus className="size-3" />}
                </span>
                <span className="shrink-0">Seat {i + 1}</span>
                <code className="min-w-0 truncate font-mono text-[0.875rem]" title={seat}>{shortAccount(seat)}</code>
                {conn?.accountId === seat && <span className="shrink-0 text-[0.8125rem] text-muted-foreground">(you)</span>}
                <span className="ml-auto shrink-0 text-[0.8125rem]">{v === "approve" ? "approved" : v === "reject" ? "rejected" : "not voted"}</span>
              </li>
            )
          })}
        </ul>
      </div>
      {p.status === "running" && <EngineRunning proposal={p} />}
      {p.status === "done" && p.releaseId !== null && (
        <Link to={`/u/${unit.id}/releases#r${p.releaseId}`} className="wipe w-fit text-[1rem] font-semibold text-ink">
          See release #{p.releaseId} and what it withheld
        </Link>
      )}
      {(canVote || touched) && conn && <VoteButtons p={p} unit={unit} conn={conn} gasReady={gasReady} voted={voted} onTap={() => setTouched(true)} />}
      {conn && p.proposer === conn.accountId && (p.status === "open" || withdrawing) && <WithdrawButton p={p} unit={unit} conn={conn} onTap={() => setWithdrawing(true)} />}
      {p.status === "expired" && <p className="text-[0.9375rem] text-muted-foreground">Expired: open proposals close after 7 days without a majority. Propose it again to ask once more.</p>}
      {p.status === "withdrawn" && <p className="text-[0.9375rem] text-muted-foreground">Withdrawn by its proposer before it passed. Nothing ran.</p>}
      {voted && !touched && p.status === "open" && <p className="text-[0.9375rem] text-muted-foreground">You have voted. Waiting for {need - p.approvals.length} more {need - p.approvals.length === 1 ? "approval" : "approvals"}.</p>}
    </article>
  )
}

function VoteButtons({ p, unit, conn, gasReady, voted, onTap }: { p: UnitProposal; unit: Unit; conn: Conn; gasReady: boolean; voted: boolean; onTap: () => void }) {
  const qc = useQueryClient()
  const base = gasReady && !voted ? `${conn.accountId}:${unit.id}:${p.id}` : null
  const yes = useTap<Landed<string | null>>(base && `${base}:y`, () => prepareVote(conn, unit.id, p.id, true))
  const no = useTap<Landed<string | null>>(base && `${base}:n`, () => prepareVote(conn, unit.id, p.id, false))
  const active = yes.phase.s !== "ready" && yes.phase.s !== "preparing" && yes.phase.s !== "idle" ? yes : no.phase.s !== "ready" && no.phase.s !== "preparing" && no.phase.s !== "idle" ? no : yes
  const busy = yes.phase.s === "busy" || no.phase.s === "busy"
  const after = () => void qc.invalidateQueries({ queryKey: ["units"] })
  const vote = (t: typeof yes) => {
    const run = t.tap()
    if (run) onTap()
    run?.then(after, () => undefined)
  }
  const last = p.approvals.length + 1 >= threshold((p.council ?? unit.council).length)
  return (
    <div className="flex flex-col gap-3 border-l-2 border-ink bg-band px-5 py-4">
      {!voted && <p className="text-[0.9375rem] text-ink">Your seat has not voted.{last ? " Your approval reaches the majority and starts the engine." : ""}</p>}
      {!voted && <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
        <button type="button" onClick={() => vote(yes)} disabled={!yes.canTap || busy} className="inline-flex min-h-11 cursor-pointer items-center gap-2 bg-ink px-5 font-semibold text-white transition-colors duration-[400ms] ease-gl hover:bg-indigo disabled:cursor-not-allowed disabled:opacity-40">
          {yes.phase.s === "busy" ? <Spinner className="size-4" /> : <Check className="size-4" />} Approve
        </button>
        <button type="button" onClick={() => vote(no)} disabled={!no.canTap || busy} className="wipe cursor-pointer text-[1rem] text-muted-foreground hover:text-ink disabled:opacity-40">
          Reject
        </button>
        {!gasReady && <span className="text-[0.875rem] text-muted-foreground">Waiting for gas…</span>}
      </div>}
      <TxState
        phase={active.phase}
        tx={active.phase.s === "done" ? active.phase.result.tx : null}
        onRetry={() => vote(active)}
        onRetryPrepare={active.retryPrepare}
        className="[&_[role=alert]]:bg-white"
        words={{ what: "a unit_vote transaction", busy: "Approve unit_vote in your wallet…", done: "Vote landed on NEAR testnet." }}
      />
    </div>
  )
}
