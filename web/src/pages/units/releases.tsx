import { useMemo, useState } from "react"
import { useLocation } from "react-router"
import { Accordion as A } from "radix-ui"
import { FlaskConical } from "lucide-react"
import { Reveal } from "@/components/gl/reveal"
import { Timeline } from "@/components/reui/timeline"
import { CtaLink, EmptyState, Figure, Page, PageHeader } from "@/components/unit"
import { ReleaseItem } from "@/components/unit-b/release-item"
import { CountsStrip, SyntheticNotice } from "@/components/units/badges"
import { EngineRunning } from "@/components/units/engine-running"
import { UnitGate } from "@/components/units/unit-states"
import { int } from "@/lib/format"
import { isMock, units, type UnitRelease, type UnitView } from "@/lib/units"
import { useUnitOutlet } from "./shell"

export default function UnitReleases() {
  const { view } = useUnitOutlet()
  return (
    <Page>
      <UnitGate view={view}>{view.data && <Ledger v={view.data} refreshing={view.isRefetching} refetch={() => void view.refetch()} />}</UnitGate>
    </Page>
  )
}

/** The counts header every unit release carries: where its entries came from, synthetic named first. */
export function ReleaseCounts({ r }: { r: UnitRelease }) {
  return (
    <div className="flex flex-col gap-3 bg-band p-5">
      <SyntheticNotice n={r.counts.synthetic} className="bg-white" />
      <span className="text-[0.8125rem] font-medium tracking-[0.02em] text-muted-foreground uppercase">Entries counted in this release</span>
      <CountsStrip counts={r.counts} compact />
    </div>
  )
}

function Ledger({ v, refreshing, refetch }: { v: UnitView; refreshing: boolean; refetch: () => void }) {
  const { hash } = useLocation()
  const newestFirst = useMemo(() => [...v.releases].sort((a, b) => b.id - a.id), [v.releases])
  const fromHash = /^#r\d+$/.test(hash) ? hash.slice(1) : null
  const [open, setOpen] = useState<string[] | null>(null)
  const openValues = open ?? (fromHash ? [fromHash] : newestFirst[0] ? [`r${newestFirst[0].id}`] : [])
  const published = newestFirst.reduce((s, r) => s + r.cells.length, 0)
  const withheld = newestFirst.reduce((s, r) => s + r.suppressed.length, 0)
  const running = v.proposals.filter((p) => p.status === "running")

  return (
    <>
      <PageHeader
        glyph="ledger"
        eyebrow={`Release ledger · ${v.unit.name} · NEAR testnet`}
        title="Every release, every refusal."
        lede="Each record was written on chain by the units contract once the sealed engine answered. Withheld cells say why. Each release counts its DKIM-verified, self-attested and synthetic entries."
        actions={
          newestFirst.length > 0 ? (
            <div className="flex gap-8">
              <Figure value={int(newestFirst.length)} caption={newestFirst.length === 1 ? "record" : "records"} />
              <Figure value={int(published)} caption="cells published" />
              <Figure value={int(withheld)} caption="withheld" />
            </div>
          ) : undefined
        }
      />
      {running.map((p) => (
        <EngineRunning key={p.id} proposal={p} />
      ))}
      {newestFirst.length === 0 ? (
        <EmptyState
          title="No releases yet."
          body="A record appears here once the council approves a release and the sealed engine answers. A one-member unit's release is refused, and that refusal is logged here too."
          action={<CtaLink to={`/u/${v.unit.id}/vote`}>Propose a release</CtaLink>}
        />
      ) : (
        <Reveal>
          <A.Root type="multiple" value={openValues} onValueChange={setOpen}>
            <Timeline value={newestFirst.length} orientation="vertical">
              {newestFirst.map((r, i) => (
                <ReleaseItem
                  key={r.id}
                  release={r}
                  step={newestFirst.length - i}
                  tx={isMock() ? undefined : (r.txHash ?? undefined)}
                  contract={units.contract}
                  requester="the unit council"
                  badge={
                    r.counts.synthetic > 0 ? (
                      <span className="inline-flex items-center gap-1 bg-lav-mid px-1.5 py-0.5 text-[0.75rem] font-semibold text-indigo">
                        <FlaskConical className="size-3" /> Includes {r.counts.synthetic} synthetic
                      </span>
                    ) : null
                  }
                  extra={<ReleaseCounts r={r} />}
                />
              ))}
            </Timeline>
          </A.Root>
          <p className="mt-6 text-[0.875rem] text-muted-foreground">
            Read from the units contract <code className="font-mono">{units.contract}</code>.{" "}
            <button type="button" onClick={refetch} className="wipe cursor-pointer font-semibold text-ink" disabled={refreshing}>
              {refreshing ? "Refreshing…" : "Refresh"}
            </button>
          </p>
        </Reveal>
      )}
    </>
  )
}
