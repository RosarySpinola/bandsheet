import type { ReleaseRecord } from "@bandsheet/core"
import { fromNanos, plural, relative, when } from "@/lib/format"
import { Fact } from "../page-header"
import { HashValue } from "../copy-button"
import { AccountLink, CtaLink } from "../links"
import { StatusTag } from "../status"

const SUMMARY: Record<string, string> = {
  released: "Every cell passed the audit and was published.",
  partially_released: "Some cells were published. The engine withheld the rest because they would expose a member.",
  refused: "The engine refused the whole table. Nothing was published.",
  error: "The sealed engine did not return a readable result. Nothing was published.",
}

/** The newest release: status, when, who asked, cell counts and the output hash. */
export function ReleaseStatus({ release }: { release: ReleaseRecord }) {
  const at = fromNanos(release.block_timestamp ?? null)
  const outHash = release.output_sha256 ?? release.output_hash
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <span className="gl-num text-[2.25rem] leading-none text-ink">#{release.id}</span>
        <StatusTag status={release.status} />
        <span className="text-[0.9375rem] text-muted-foreground" title={when(at)}>
          {relative(at)}
        </span>
      </div>
      <p className="text-[1rem] leading-relaxed text-foreground">{SUMMARY[release.status] ?? ""}</p>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
        <Fact label="Published">{plural(release.cells.length, "cell")}</Fact>
        <Fact label="Withheld">
          <span className={release.suppressed.length ? "font-semibold text-ink" : ""}>{plural(release.suppressed.length, "cell")}</span>
        </Fact>
        {release.requested_by && (
          <Fact label="Asked for by" className="col-span-2">
            <AccountLink id={release.requested_by} />
          </Fact>
        )}
        {outHash && (
          <Fact label="Output sha256" className="col-span-2">
            <HashValue value={outHash} />
          </Fact>
        )}
      </dl>
      <CtaLink to="/unit/releases">Open the release ledger</CtaLink>
    </div>
  )
}
