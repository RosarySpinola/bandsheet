import type { ReleaseRecord } from "@bandsheet/core"
import { Check, X } from "lucide-react"
import { Spinner } from "@/components/ui/spinner"
import { CtaLink, ErrorState, StatusTag, TxLink } from "@/components/unit"
import { cn } from "@/lib/utils"
import { relative } from "@/lib/format"
import type { DaoProposal } from "./data"
import { describeQuery } from "./format"
import type { VoteInput } from "./dao-actions"

export type VoteState = {
  pending: VoteInput | null
  error: { proposal_id: number; err: unknown } | null
  lastTx: { proposal_id: number; hash: string; mock: boolean } | null
}

const NEEDED = 2

function Seat({ n, account, vote, open, busy, disabled, onVote }: {
  n: 1 | 2 | 3
  account: string
  vote: string | undefined
  open: boolean
  busy: "approve" | "reject" | null
  disabled: boolean
  onVote: (action: "approve" | "reject") => void
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5 border p-3 sm:gap-3 sm:p-4", vote === "Approve" ? "border-ink" : "border-line")}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col">
          <span className="text-[0.8125rem] font-semibold tracking-[0.04em] text-ink uppercase">Seat {n}</span>
          <span className="truncate font-mono text-[0.75rem] text-muted-foreground" title={account}>{account.replace(/\.testnet$/, "")}</span>
        </div>
        <span
          className={cn(
            "grid size-6 shrink-0 place-items-center transition-colors duration-500 ease-gl",
            vote === "Approve" ? "bg-ink text-white" : vote === "Reject" ? "border-2 border-ink text-ink" : "border border-dashed border-inactive",
          )}
          aria-label={vote ?? "not voted"}
        >
          {vote === "Approve" ? <Check className="size-3.5" strokeWidth={3} /> : vote === "Reject" ? <X className="size-3.5" strokeWidth={3} /> : null}
        </span>
      </div>
      {vote ? (
        <p className="text-[0.9375rem] text-ink">{vote === "Approve" ? "Approved" : vote === "Reject" ? "Rejected" : vote}</p>
      ) : open ? (
        busy ? (
          <p className="flex items-center gap-2 text-[0.9375rem] text-ink" role="status">
            <Spinner className="size-3.5" /> Sending {busy}…
          </p>
        ) : (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <button type="button" disabled={disabled} onClick={() => onVote("approve")} className="wipe cursor-pointer text-[0.9375rem] font-semibold text-ink disabled:cursor-not-allowed disabled:opacity-40">
              Vote approve
            </button>
            <button type="button" disabled={disabled} onClick={() => onVote("reject")} className="wipe cursor-pointer text-[0.875rem] text-muted-foreground transition-colors duration-[400ms] ease-gl hover:text-ink disabled:cursor-not-allowed disabled:opacity-40">
              Reject
            </button>
          </div>
        )
      ) : (
        <p className="text-[0.9375rem] text-muted-foreground">Did not vote</p>
      )}
    </div>
  )
}

/** One Sputnik proposal: what it asks, the three council seats, the tally, and the release it produced. */
export function ProposalCard({ p, council, release, waiting, vote, onVote }: {
  p: DaoProposal
  council: string[]
  release: ReleaseRecord | undefined
  waiting: boolean
  vote: VoteState
  onVote: (v: VoteInput) => void
}) {
  const open = p.status === "InProgress"
  const approvals = Object.values(p.votes).filter((v) => v === "Approve").length
  const mine = vote.pending?.proposal_id === p.id
  const errHere = vote.error?.proposal_id === p.id ? vote.error.err : null
  const txHere = vote.lastTx?.proposal_id === p.id ? vote.lastTx : null
  const when = p.submission_time ? relative(new Date(p.submission_time)) : null

  return (
    <article className="flex flex-col gap-6 border-t-2 border-ink pt-6">
      <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="flex min-w-0 flex-col gap-2">
          <p className="flex flex-wrap items-center gap-x-3 text-[0.875rem] text-muted-foreground">
            <span className="gl-num text-[0.9375rem] text-ink">Proposal #{p.id}</span>
            {when && <span>opened {when}</span>}
          </p>
          <h3 className="font-serif text-[1.625rem] leading-tight text-ink md:text-[1.875rem]">{describeQuery(p.query)}</h3>
          {p.description && <p className="text-[0.9375rem] text-muted-foreground">“{p.description}”</p>}
        </div>
        <StatusTag status={p.status} />
      </header>

      <div className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-4 text-[0.9375rem]">
          <span className="text-ink">
            <span className="gl-num text-[1.25rem]">{approvals}</span> of 3 seats approve
          </span>
          <span className="text-muted-foreground">{NEEDED} needed</span>
        </div>
        <div className="grid grid-cols-3 gap-3" aria-hidden>
          {[0, 1, 2].map((i) => (
            <span key={i} className={cn("h-[2px] transition-colors duration-500 ease-gl", i < approvals ? "bg-ink" : "bg-line")} />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {([1, 2, 3] as const).map((n) => {
            const account = council[n - 1] ?? `council seat ${n}`
            return (
              <Seat
                key={n}
                n={n}
                account={account}
                vote={p.votes[account]}
                open={open}
                busy={mine && vote.pending?.member === n ? vote.pending.action : null}
                disabled={vote.pending !== null}
                onVote={(action) => onVote({ proposal_id: p.id, member: n, action })}
              />
            )
          })}
        </div>
        {mine && <p className="text-[0.875rem] text-muted-foreground">Testnet transactions usually take 5 to 20 seconds.</p>}
        {txHere && (
          <p className="text-[0.875rem] text-text">
            Vote recorded{" "}
            {txHere.mock ? <span className="text-muted-foreground">(mock, not sent)</span> : <TxLink tx={txHere.hash} />}
          </p>
        )}
        {errHere !== null && <ErrorState error={errHere} title="The vote was not recorded." />}
      </div>

      <footer className="flex flex-wrap items-center gap-x-6 gap-y-2 bg-band px-5 py-4">
        {release ? (
          <>
            <span className="text-[0.9375rem] text-text">Produced release #{release.id}</span>
            <StatusTag status={release.status} />
            <CtaLink to={`/unit/releases#r${release.id}`}>Open in the ledger</CtaLink>
          </>
        ) : waiting ? (
          <span className="flex items-start gap-2 text-[0.9375rem] text-ink" role="status">
            <Spinner className="mt-1 size-3.5 shrink-0" /> Approved. Waiting for the sealed engine on OutLayer; the record usually lands within a minute or two.
          </span>
        ) : p.status === "Approved" ? (
          <span className="text-[0.9375rem] text-muted-foreground">Approved. No release record is linked to this proposal.</span>
        ) : open ? (
          <span className="text-[0.9375rem] text-muted-foreground">When {NEEDED} seats approve, the DAO calls the contract and the engine runs.</span>
        ) : (
          <span className="text-[0.9375rem] text-muted-foreground">Closed without a release.</span>
        )}
      </footer>
    </article>
  )
}
