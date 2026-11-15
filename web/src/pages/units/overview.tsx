import { Link } from "react-router"
import { CtaLink, EmptyState, Figure, Page, PageHeader, Section, StatusTag } from "@/components/unit"
import { AccountLink } from "@/components/unit/links"
import { BandsTable } from "@/components/unit/overview/bands-table"
import { CountsStrip, SyntheticNotice } from "@/components/units/badges"
import { Membership } from "@/components/units/membership"
import { SyntheticPanel } from "@/components/units/synthetic-panel"
import { TooFewState, UnitGate } from "@/components/units/unit-states"
import { int, plural } from "@/lib/format"
import { LIMITS, units, type UnitView } from "@/lib/units"
import { describeQuery, asQuery } from "@/components/unit-b/format"
import { useUnitOutlet } from "./shell"

export default function UnitOverview() {
  const { view } = useUnitOutlet()
  return (
    <Page>
      <UnitGate view={view}>{view.data && <Body v={view.data} />}</UnitGate>
    </Page>
  )
}

function Body({ v }: { v: UnitView }) {
  const { unit } = v
  const newest = [...v.releases].sort((a, b) => b.id - a.id)[0]
  const open = v.proposals.filter((p) => p.status === "open" || p.status === "approved" || p.status === "running")
  const tooFew = !newest ? unit.entries < LIMITS.k : newest.cells.length === 0
  /** Offered while the unit is small; the panel itself says when the synthetic cap is reached. */
  const canAddSynthetic = unit.entries - unit.synthetic < 2 * LIMITS.k

  return (
    <>
      <PageHeader
        glyph="overview"
        eyebrow={`Unit #${unit.id} · your own unit on NEAR testnet`}
        title={unit.name}
        lede={`${plural(unit.members - unit.synthetic, "real member")}${unit.synthetic ? ` and ${unit.synthetic} synthetic sample entries` : ""}, pooled privately. The sealed engine publishes average pay by group only when no one's salary can be worked out from it.`}
        actions={<CtaLink to={`/u/${unit.id}/submit`} size="lg">Submit a payslip</CtaLink>}
      />

      <div className="grid grid-cols-1 gap-12 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] xl:gap-14">
        <Section title="You in this unit">
          <Membership unit={unit} />
        </Section>
        <Section title="The unit" aside="Read live from the units contract" delay={100}>
          <div className="flex flex-col gap-6 bg-band p-6 md:p-8">
            <div className="grid grid-cols-3 gap-6">
              <Figure value={int(unit.members)} caption={unit.members === 1 ? "member" : "members"} />
              <Figure value={int(unit.entries)} caption="sealed entries" />
              <Figure value={int(unit.synthetic)} caption="synthetic (sample data)" />
            </div>
            {newest ? (
              <div className="flex flex-col gap-2 border-t border-border pt-4">
                <span className="text-[0.8125rem] font-medium tracking-[0.02em] text-muted-foreground uppercase">Counted in release #{newest.id}</span>
                <CountsStrip counts={newest.counts} compact />
              </div>
            ) : (
              <p className="border-t border-border pt-4 text-[0.9375rem] text-foreground">
                {plural(unit.entries - unit.synthetic, "real entry", "real entries")} · {plural(unit.synthetic, "synthetic entry", "synthetic entries")} (sample data). Each release counts how many were DKIM-verified, self-attested and synthetic.
              </p>
            )}
            <p className="text-[0.875rem] leading-relaxed text-muted-foreground">
              k = {LIMITS.k}: no group smaller than {LIMITS.k} is ever shown · council of {unit.council.length} (releases need more than half) · {unit.dkimDomains.length ? `employer domains: ${unit.dkimDomains.join(", ")}` : "no employer domains listed, so every entry is self-attested"} · contract <AccountLink id={units.contract} className="text-[0.875rem]" />
            </p>
          </div>
        </Section>
      </div>

      <Section title={newest ? `Latest bands · release #${newest.id}` : "Latest bands"} aside={newest ? "Mean gross annual pay, EUR" : undefined} delay={150}>
        <div className="flex flex-col gap-6">
          {newest && <SyntheticNotice n={newest.counts.synthetic} />}
          {tooFew ? (
            <TooFewState unit={unit} refused={Boolean(newest)} />
          ) : !newest ? (
            <EmptyState title="Nothing published yet" body="Enough entries are in. A council seat proposes a release, the council votes, and the sealed engine publishes what is safe." action={<CtaLink to={`/u/${unit.id}/vote`}>Propose a release</CtaLink>} />
          ) : null}
          {newest && <BandsTable release={newest} all={v.releases} />}
          {canAddSynthetic && <SyntheticPanel unit={unit} />}
        </div>
      </Section>

      <Section title="Council votes" aside={<Link to={`/u/${unit.id}/vote`} className="wipe font-semibold text-ink">Open the vote</Link>} delay={200}>
        {open.length === 0 ? (
          <p className="text-[0.9375rem] text-muted-foreground">Nothing is waiting for a vote. {v.releases.length ? `${plural(v.releases.length, "release")} logged so far.` : "No release has been asked for yet."}</p>
        ) : (
          <ul className="flex flex-col border-t border-border">
            {open.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-border py-4">
                <span className="text-[1rem] text-ink">
                  <span className="gl-num">#{p.id}</span> {describeQuery(asQuery(p.query))}
                </span>
                <span className="flex items-center gap-3 text-[0.875rem] text-muted-foreground">
                  {p.approvals.length} of {unit.council.length} approved
                  <StatusTag status={p.status === "running" ? "Running" : p.status === "approved" ? "Approved" : "InProgress"} />
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </>
  )
}
