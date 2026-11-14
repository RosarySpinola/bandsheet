import type { Proposal } from "@/lib/chain"
import { explorer } from "@/lib/chain"
import { fromNanos, relative } from "@/lib/format"
import { CtaLink, ExtLink } from "../links"
import { EmptyState, Shimmer } from "../states"
import { StatusTag } from "../status"

function tally(p: Proposal): { yes: number; no: number } {
  let yes = 0
  let no = 0
  for (const v of Object.values(p.vote_counts ?? {})) {
    yes += Number(v[0] ?? 0)
    no += Number(v[1] ?? 0)
  }
  return { yes, no }
}

/** Open Sputnik proposals first, then the latest few closed ones for context. */
export function Proposals({ proposals }: { proposals: Proposal[] }) {
  const open = proposals.filter((p) => p.status === "InProgress").sort((a, b) => b.id - a.id)
  const closed = proposals.filter((p) => p.status !== "InProgress").sort((a, b) => b.id - a.id).slice(0, 3)

  return (
    <div className="flex flex-col gap-5">
      {open.length === 0 ? (
        <EmptyState
          className="py-8"
          title="No votes open"
          body="Any member can ask for a release. It reaches the sealed engine only after the chapel votes it through."
          action={<CtaLink to="/unit/vote">Ask for a release</CtaLink>}
        />
      ) : (
        <ul className="flex flex-col">
          {open.map((p) => (
            <ProposalRow key={p.id} p={p} />
          ))}
        </ul>
      )}
      {closed.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-[0.8125rem] font-medium tracking-[0.02em] text-muted-foreground uppercase">Recently closed</p>
          <ul className="flex flex-col">
            {closed.map((p) => (
              <ProposalRow key={p.id} p={p} />
            ))}
          </ul>
        </div>
      )}
      <ExtLink href={explorer.dao()} className="text-[0.9375rem]">
        The chapel DAO on nearblocks
      </ExtLink>
    </div>
  )
}

function ProposalRow({ p }: { p: Proposal }) {
  const { yes, no } = tally(p)
  const at = fromNanos(p.submission_time ?? null)
  return (
    <li className="flex flex-col gap-2 border-b border-border py-4 first:pt-0">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[0.9375rem] font-semibold text-ink">Proposal #{p.id}</span>
        <StatusTag status={p.status} />
      </div>
      <p className="line-clamp-2 text-[0.9375rem] leading-relaxed text-foreground">{p.description || "No description"}</p>
      <p className="text-[0.8125rem] text-muted-foreground">
        {yes} for · {no} against · {relative(at)}
      </p>
    </li>
  )
}

export function ProposalsSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label="Loading proposals">
      {[0, 1].map((i) => (
        <div key={i} className="flex flex-col gap-2 border-b border-border pb-4">
          <Shimmer className="h-5 w-1/3" />
          <Shimmer className="h-4 w-full" />
          <Shimmer className="h-4 w-1/2" />
        </div>
      ))}
    </div>
  )
}
