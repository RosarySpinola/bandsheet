import { useEffect, useMemo, useState } from "react"
import { useLocation, useSearchParams } from "react-router"
import { ToggleGroup as TG } from "radix-ui"
import { cn } from "@/lib/utils"
import type { ReleaseRecord } from "@bandsheet/core"
import { Reveal } from "@/components/gl/reveal"
import { AccountLink, EmptyState, ErrorState, Page, PageHeader, Shimmer } from "@/components/unit"
import { DAO, useDeployed, usePolicy, useReleases } from "@/lib/chain"
import { useQuery } from "@tanstack/react-query"
import { councilMembers } from "@/lib/wallet/dao-seat"
import { useDaoActions, type VoteInput } from "@/components/unit-b/dao-actions"
import { useDaoProposals, type DaoProposal, type ProposeResult } from "@/components/unit-b/data"
import { ProposalCard, type VoteState } from "@/components/unit-b/proposal-card"
import { QueryBuilder } from "@/components/unit-b/query-builder"
import { WalletSeat } from "@/components/unit-b/wallet-seat"

/** Approved release proposals, in order, line up with release records in order. */
function linkReleases(proposals: DaoProposal[], releases: ReleaseRecord[]): Map<number, ReleaseRecord> {
  const approved = proposals.filter((p) => p.kind === "release" && p.status === "Approved").sort((a, b) => a.id - b.id)
  const recs = [...releases].sort((a, b) => a.id - b.id)
  return new Map(approved.flatMap((p, i) => (recs[i] ? [[p.id, recs[i]] as const] : [])))
}

type Filter = "all" | "releases" | "governance"

/** Radix ToggleGroup as a Greenlock segmented control: square, 2px ink frame, ink fill when on. */
function FilterBar({ value, onChange, counts }: { value: Filter; onChange: (f: Filter) => void; counts: Record<Filter, number> }) {
  const items: { v: Filter; label: string }[] = [
    { v: "all", label: "All" },
    { v: "releases", label: "Releases" },
    { v: "governance", label: "Governance" },
  ]
  return (
    <TG.Root
      type="single"
      value={value}
      onValueChange={(v) => v && onChange(v as Filter)}
      aria-label="Show proposals"
      className="-mb-4 flex w-full border-2 border-ink sm:w-fit"
    >
      {items.map((i) => (
        <TG.Item
          key={i.v}
          value={i.v}
          className={cn(
            "flex flex-1 cursor-pointer items-center justify-center gap-2 px-4 py-2.5 text-[0.9375rem] font-semibold text-ink transition-colors duration-[400ms] ease-gl not-last:border-r-2 not-last:border-ink sm:flex-none",
            "hover:bg-lav-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lav data-[state=on]:bg-ink data-[state=on]:text-white",
          )}
        >
          {i.label}
          <span className="tabular text-[0.8125rem] opacity-70">{counts[i.v]}</span>
        </TG.Item>
      ))}
    </TG.Root>
  )
}

function ListSkeleton() {
  return (
    <div className="flex flex-col gap-10" aria-label="Loading proposals">
      {[0, 1].map((i) => (
        <div key={i} className="flex flex-col gap-4 border-t-2 border-border pt-6">
          <Shimmer className="h-4 w-40" />
          <Shimmer className="h-8 w-72 max-w-full" />
          <div className="grid gap-3 sm:grid-cols-3">
            <Shimmer className="h-24" />
            <Shimmer className="h-24" />
            <Shimmer className="h-24" />
          </div>
          <Shimmer className="h-14" />
        </div>
      ))}
    </div>
  )
}

export default function VotePage() {
  const [params] = useSearchParams()
  const mock = params.get("mock")
  const deployed = useDeployed()
  /** Seats the demo server holds keys for (it can vote for these); the seat list itself is read from the DAO. */
  const serverSeats = deployed.data?.council ?? []
  const chainCouncil = useQuery({ queryKey: ["dao", "council"], queryFn: councilMembers, staleTime: 60_000 })
  const council = chainCouncil.data?.length === 3 ? chainCouncil.data : serverSeats
  const policy = usePolicy()
  const releases = useReleases()
  const [polling, setPolling] = useState(false)
  const proposals = useDaoProposals({ frozen: Boolean(mock), poll: polling ? 8000 : false })
  const { propose, vote } = useDaoActions({ mock, council: serverSeats })
  const [voteErr, setVoteErr] = useState<VoteState["error"]>(null)
  const [lastTx, setLastTx] = useState<VoteState["lastTx"]>(null)
  const [proposed, setProposed] = useState<(ProposeResult & { mock: boolean }) | null>(null)

  const list = proposals.data ?? []
  const links = useMemo(() => linkReleases(list, releases.data?.releases ?? []), [list, releases.data])
  const waitingIds = list.filter((p) => p.kind === "release" && p.status === "Approved" && !links.has(p.id)).map((p) => p.id)
  const [filter, setFilter] = useState<Filter>("all")
  const shown = list.filter((p) => filter === "all" || (filter === "releases" ? p.kind === "release" : p.kind !== "release"))
  const { hash } = useLocation()
  useEffect(() => {
    if (/^#p\d+$/.test(hash) && proposals.isSuccess) document.getElementById(hash.slice(1))?.scrollIntoView({ block: "start" })
  }, [hash, proposals.isSuccess])
  const waiting = waitingIds.length > 0 && !mock

  // While an approved proposal has no record yet, poll for the release OutLayer will write.
  const { refetch: refetchReleases } = releases
  useEffect(() => {
    setPolling(waiting)
    if (!waiting) return
    const t = window.setInterval(() => void refetchReleases(), 8000)
    return () => window.clearInterval(t)
  }, [waiting, refetchReleases])

  const onVote = (v: VoteInput) => {
    setVoteErr(null)
    vote.mutate(v, {
      onSuccess: (r) => setLastTx({ proposal_id: v.proposal_id, hash: r.tx.hash, mock: Boolean(mock) }),
      onError: (err) => setVoteErr({ proposal_id: v.proposal_id, err }),
    })
  }
  const voteState: VoteState = { pending: vote.isPending ? (vote.variables ?? null) : null, error: voteErr, lastTx }

  return (
    <Page>
      <PageHeader
        glyph="vote"
        eyebrow="Chapel vote · Sputnik DAO on NEAR testnet"
        title="Releases are asked for, then voted."
        lede="Every table is a proposal on the chapel's DAO, and so is every rule: which employers to trust, whether payslips must be signed, which engine build runs. Two of the three council seats must approve."
        actions={<AccountLink id={DAO} className="text-[0.9375rem]" />}
      />

      {mock && (
        <p className="-mt-6 border-l-2 border-lav bg-lav-soft px-5 py-3 text-[0.9375rem] text-indigo md:-mt-10">
          Mock mode{mock !== "1" ? ` (${mock})` : ""}: proposals and votes are simulated in your browser. Nothing is sent to NEAR testnet.
        </p>
      )}

      {!mock && <WalletSeat proposals={list} />}

      <div className="grid grid-cols-1 items-start gap-12 lg:grid-cols-[minmax(0,1fr)_24rem] lg:gap-10">
        <Reveal className="flex min-w-0 flex-col gap-12">
          {proposals.isPending ? (
            <ListSkeleton />
          ) : proposals.isError ? (
            <ErrorState error={proposals.error} title="The DAO's proposals could not be read." onRetry={() => void proposals.refetch()} />
          ) : list.length === 0 ? (
            <EmptyState title="No release requests yet." body="Ask for a table on the right. It appears here as soon as the DAO records it." />
          ) : (
            <>
              <FilterBar value={filter} onChange={setFilter} counts={{
                all: list.length,
                releases: list.filter((p) => p.kind === "release").length,
                governance: list.filter((p) => p.kind !== "release").length,
              }} />
              {shown.length === 0 ? (
                <EmptyState title={filter === "governance" ? "No governance votes yet." : "No release requests yet."} body="Switch the filter to see the other proposals." />
              ) : (
                shown.map((p) => (
                  <ProposalCard
                    key={p.id}
                    p={p}
                    council={council}
                    serverSeats={serverSeats}
                    release={links.get(p.id)}
                    waiting={!mock && p.kind === "release" && p.status === "Approved" && !links.has(p.id)}
                    vote={voteState}
                    onVote={onVote}
                  />
                ))
              )}
            </>
          )}
        </Reveal>

        <Reveal delay={200} className="lg:sticky lg:top-8">
          <QueryBuilder
            k={policy.data?.policy.k ?? 3}
            mock={Boolean(mock)}
            pending={propose.isPending}
            error={propose.error}
            result={proposed}
            onPropose={(q) => propose.mutate(q, { onSuccess: (r) => setProposed({ ...r, mock: Boolean(mock) }) })}
          />
        </Reveal>
      </div>
    </Page>
  )
}
