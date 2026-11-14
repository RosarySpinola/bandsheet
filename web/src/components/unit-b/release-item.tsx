import type { ReleaseRecord } from "@bandsheet/core"
import { Accordion as A } from "radix-ui"
import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { fromNanos, plural, when } from "@/lib/format"
import { TimelineContent, TimelineIndicator, TimelineItem, TimelineSeparator } from "@/components/reui/timeline"
import { StatusTag } from "@/components/unit"
import { asQuery, describeQuery, type ReleaseStatus } from "./format"
import { ReleaseCells } from "./release-cells"
import { ReleaseProof } from "./release-proof"

const INDICATOR: Record<ReleaseStatus, string> = {
  released: "bg-ink border-ink",
  partially_released: "bg-lav border-lav",
  refused: "bg-white border-ink",
  error: "bg-white border-inactive",
}

const requesterLabel = (id?: string) => (!id ? "the chapel" : id.includes("sputnik") ? "the chapel DAO" : id)

/** One ledger record: a ReUI timeline step whose body is a Greenlock accordion (200ms, chevron 180°). */
export function ReleaseItem({ release, step, tx }: { release: ReleaseRecord; step: number; tx?: string }) {
  const status = release.status as ReleaseStatus
  const q = asQuery(release.query)
  const withheld = release.suppressed.length
  const d = fromNanos(release.block_timestamp ?? null)

  return (
    <TimelineItem step={step} className="group-data-[orientation=vertical]/timeline:ms-10 group-data-[orientation=vertical]/timeline:not-last:pb-0 max-sm:group-data-[orientation=vertical]/timeline:ms-7">
      <TimelineSeparator className="!w-px bg-line group-data-[orientation=vertical]/timeline:-left-7 group-data-[orientation=vertical]/timeline:h-[calc(100%-1.25rem)] group-data-[orientation=vertical]/timeline:translate-y-[2.4rem] max-sm:group-data-[orientation=vertical]/timeline:-left-[1.25rem]" />
      <TimelineIndicator
        className={cn(
          "!size-3.5 !rounded-none border-2 group-data-[orientation=vertical]/timeline:-left-7 group-data-[orientation=vertical]/timeline:top-[1.85rem] max-sm:group-data-[orientation=vertical]/timeline:-left-[1.25rem]",
          INDICATOR[status],
        )}
      />
      <TimelineContent className="text-text">
        <A.Item value={`r${release.id}`} id={`r${release.id}`} className="scroll-mt-24 border-b border-line">
          <A.Header>
            <A.Trigger className="group/tr flex w-full cursor-pointer items-start gap-4 py-6 text-left outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-lav">
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.875rem] text-muted-foreground">
                  <span className="gl-num text-[0.9375rem] text-ink">No. {String(release.id).padStart(2, "0")}</span>
                  <span>{when(d)}</span>
                </div>
                <h3 className="font-serif text-[1.625rem] leading-tight font-medium text-[var(--gray-300)] transition-colors duration-[400ms] ease-gl group-hover/tr:text-ink group-data-[state=open]/tr:text-ink md:text-[2rem]">
                  {describeQuery(q)}
                </h3>
                <p className="text-[0.9375rem] text-muted-foreground">
                  Requested by {requesterLabel(release.requested_by)} · {plural(release.cells.length, "cell")} published
                  {withheld > 0 && ` · ${withheld} withheld`}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-3 pt-0.5 sm:flex-row sm:items-center sm:gap-5">
                <StatusTag status={status} />
                <ChevronDown className="size-6 text-ink transition-transform duration-200 ease-gl group-data-[state=open]/tr:rotate-180" strokeWidth={1.5} />
              </div>
            </A.Trigger>
          </A.Header>
          <A.Content className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
            <div className="grid grid-cols-1 gap-10 pb-10 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-12">
              <div className="flex min-w-0 flex-col gap-4">
                {release.status === "error" && (
                  <p className="border-l-2 border-ink bg-band px-5 py-4 text-[0.9375rem] text-text">
                    {release.note || "OutLayer did not return a readable answer, so nothing was published. The request can be retried."}
                  </p>
                )}
                {release.status === "refused" && release.cells.length === 0 && (
                  <p className="text-[0.9375rem] text-text">Nothing was published: every cell in this request would have let someone solve a colleague's pay.</p>
                )}
                {release.status !== "error" && <ReleaseCells cells={release.cells} suppressed={release.suppressed} groupBy={q?.group_by} />}
              </div>
              <div className="flex min-w-0 flex-col gap-4 lg:border-l lg:border-line lg:pl-10">
                <p className="text-[0.8125rem] font-semibold tracking-[0.04em] text-ink uppercase">Verify it yourself</p>
                <ReleaseProof release={release} tx={tx} />
              </div>
            </div>
          </A.Content>
        </A.Item>
      </TimelineContent>
    </TimelineItem>
  )
}
