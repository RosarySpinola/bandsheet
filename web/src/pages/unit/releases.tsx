import { useMemo, useState } from "react"
import { useLocation } from "react-router"
import { Accordion as A } from "radix-ui"
import { Reveal } from "@/components/gl/reveal"
import { Timeline } from "@/components/reui/timeline"
import { useReleases } from "@/lib/chain"
import { int } from "@/lib/format"
import { useReleaseTxs } from "@/components/unit-b/data"
import { ReleaseItem } from "@/components/unit-b/release-item"
import { Page, Figure, PageHeader, EmptyState, ErrorState, Shimmer, CtaLink } from "@/components/unit"

function LedgerSkeleton() {
  return (
    <div className="flex flex-col" aria-label="Loading the release ledger">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex gap-6 border-b border-line py-7 pl-10 max-sm:pl-7">
          <div className="flex flex-1 flex-col gap-3">
            <Shimmer className="h-4 w-48" />
            <Shimmer className="h-8 w-[min(26rem,80%)]" />
            <Shimmer className="h-4 w-64 max-w-full" />
          </div>
          <Shimmer className="h-6 w-28" />
        </div>
      ))}
    </div>
  )
}

export default function ReleasesPage() {
  const { data, isPending, isError, error, refetch, isRefetching } = useReleases()
  const txs = useReleaseTxs()
  const location = useLocation()
  const newestFirst = useMemo(() => [...(data?.releases ?? [])].sort((a, b) => b.id - a.id), [data])
  const fromHash = /^#r\d+$/.test(location.hash) ? location.hash.slice(1) : null
  const [open, setOpen] = useState<string[] | null>(null)
  const openValues = open ?? (fromHash ? [fromHash] : newestFirst[0] ? [`r${newestFirst[0].id}`] : [])

  const published = newestFirst.reduce((s, r) => s + r.cells.length, 0)
  const withheld = newestFirst.reduce((s, r) => s + r.suppressed.length, 0)

  return (
    <Page>
      <PageHeader
        glyph="ledger"
        eyebrow="Release ledger · NEAR testnet · synthetic demo unit"
        title={<>Every release, every refusal.</>}
        lede="Each record was written on chain by the Bandsheet contract once the sealed engine answered. Withheld cells say why, with the equation that would have exposed someone."
        actions={
          data && newestFirst.length > 0 ? (
            <div className="flex gap-8">
              <Figure value={int(newestFirst.length)} caption={newestFirst.length === 1 ? "record" : "records"} />
              <Figure value={int(published)} caption="cells published" />
              <Figure value={int(withheld)} caption="withheld" />
            </div>
          ) : undefined
        }
      />

      {isPending ? (
        <LedgerSkeleton />
      ) : isError ? (
        <ErrorState error={error} title="The ledger could not be read." onRetry={() => void refetch()} />
      ) : newestFirst.length === 0 ? (
        <EmptyState
          title="No releases yet."
          body="A record appears here once the council approves a release request and the sealed engine answers."
          action={<CtaLink to="/unit/vote">Ask for a release</CtaLink>}
        />
      ) : (
        <Reveal>
          <A.Root type="multiple" value={openValues} onValueChange={setOpen}>
            <Timeline value={newestFirst.length} orientation="vertical">
              {newestFirst.map((r, i) => (
                <ReleaseItem key={r.id} release={r} step={newestFirst.length - i} tx={txs[r.id]} />
              ))}
            </Timeline>
          </A.Root>
          <p className="mt-6 text-[0.875rem] text-muted-foreground">
            Read from {data.via === "server" ? "the Bandsheet server, which views" : "NEAR testnet directly:"} contract{" "}
            <code className="font-mono">bandsheet-3f36b7.testnet</code>.{" "}
            <button type="button" onClick={() => void refetch()} className="wipe cursor-pointer font-semibold text-ink" disabled={isRefetching}>
              {isRefetching ? "Refreshing…" : "Refresh"}
            </button>
          </p>
        </Reveal>
      )}
    </Page>
  )
}
