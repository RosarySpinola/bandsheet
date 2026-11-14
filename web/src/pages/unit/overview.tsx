import { usePolicy, useProposals, useReleases } from "@/lib/chain"
import { plural } from "@/lib/format"
import { Page } from "@/components/unit/page"
import { PageHeader, Section } from "@/components/unit/page-header"
import { CtaLink } from "@/components/unit/links"
import { EmptyState, ErrorState } from "@/components/unit/states"
import { UNIT_NAME } from "@/components/unit/nav"
import { UnitCard, UnitCardSkeleton } from "@/components/unit/overview/unit-card"
import { BandsTable, BandsTableSkeleton } from "@/components/unit/overview/bands-table"
import { ReleaseStatus } from "@/components/unit/overview/release-status"
import { Proposals, ProposalsSkeleton } from "@/components/unit/overview/proposals"
import { QuickLinks } from "@/components/unit/overview/quick-links"
import { Shimmer } from "@/components/unit/states"

export default function Overview() {
  const policy = usePolicy()
  const releases = useReleases()
  const proposals = useProposals()

  const list = releases.data?.releases ?? []
  const newest = list.length ? list.reduce((a, b) => (b.id > a.id ? b : a)) : undefined

  return (
    <Page>
      <PageHeader
        glyph="overview"
        eyebrow="Overview · synthetic newsroom chapel"
        title={UNIT_NAME}
        lede={
          policy.data
            ? `${plural(policy.data.members, "member")} pool their pay privately. A sealed engine publishes average pay by group only when no one's salary can be worked out from it, now or by subtracting an earlier release.`
            : "Members pool their pay privately. A sealed engine publishes average pay by group only when no one's salary can be worked out from it."
        }
        actions={<CtaLink to="/unit/submit" size="lg">Submit a payslip</CtaLink>}
      />

      <Section title="The unit" aside="Read live from the contract on NEAR testnet">
        {policy.isPending ? (
          <UnitCardSkeleton />
        ) : policy.isError ? (
          <ErrorState error={policy.error} onRetry={() => policy.refetch()} />
        ) : (
          <UnitCard policy={policy.data} />
        )}
      </Section>

      <div className="grid grid-cols-1 gap-12 xl:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] xl:gap-14">
        <Section
          title={newest ? `Latest bands · release #${newest.id}` : "Latest bands"}
          aside={newest ? "Mean gross annual pay, EUR" : undefined}
          delay={200}
        >
          {releases.isPending ? (
            <BandsTableSkeleton />
          ) : releases.isError ? (
            <ErrorState error={releases.error} onRetry={() => releases.refetch()} />
          ) : !newest ? (
            <EmptyState
              title="Nothing published yet"
              body="The chapel has not voted for a release. Once it does, the sealed engine publishes the bands that are safe to show."
              action={<CtaLink to="/unit/vote">Ask for a release</CtaLink>}
            />
          ) : (
            <div className="flex flex-col gap-4">
              <BandsTable release={newest} all={list} />
              {newest.suppressed.length > 0 && (
                <p className="max-w-[40rem] text-[0.9375rem] leading-relaxed text-muted-foreground">
                  Hover or tap a withheld cell to see the equation that would have exposed a member. The engine logs that refusal on-chain
                  instead of the figure.
                </p>
              )}
            </div>
          )}
        </Section>

        <div className="flex flex-col gap-12">
          <Section title="Last release" delay={300}>
            {releases.isPending ? (
              <div className="flex flex-col gap-3" aria-busy="true">
                <Shimmer className="h-10 w-40" />
                <Shimmer className="h-16 w-full" />
                <Shimmer className="h-24 w-full" />
              </div>
            ) : newest ? (
              <ReleaseStatus release={newest} />
            ) : releases.isError ? (
              <p className="text-[0.9375rem] text-muted-foreground">Unavailable while the chain read is failing.</p>
            ) : (
              <p className="text-[0.9375rem] text-muted-foreground">No release yet.</p>
            )}
          </Section>

          <Section title="Chapel votes" delay={400}>
            {proposals.isPending ? (
              <ProposalsSkeleton />
            ) : proposals.isError ? (
              <ErrorState error={proposals.error} onRetry={() => proposals.refetch()} />
            ) : (
              <Proposals proposals={proposals.data} />
            )}
          </Section>
        </div>
      </div>

      <Section title="Explore the unit">
        <QuickLinks />
      </Section>
    </Page>
  )
}
