import type { ReleaseRecord } from "@bandsheet/core"
import { explorer, txHashOf, type Policy } from "@/lib/chain"
import { shortHash } from "@/lib/format"
import { ExtLink, TxLink } from "../links"
import { ErrorState, Shimmer } from "../states"
import { PassMark } from "../verified-panel"
import { useAttestation } from "./data"

type Row = { label: string; attested?: string; expected?: string; source: string }

/** For one release: fetch OutLayer's attestation live and compare it with the contract's record. */
export function ReleaseAttestation({ id, exec, txs, release, policy, project }: {
  id: number
  exec: string
  txs: string[]
  release?: ReleaseRecord
  policy?: Policy
  project: string
}) {
  const att = useAttestation(exec)
  const rows: Row[] = att.data
    ? [
        { label: "Engine build it ran", attested: att.data.executed_wasm_sha256 ?? att.data.wasm_hash, expected: policy?.policy.wasm_sha256, source: "contract policy" },
        { label: "Sealed input", attested: att.data.input_hash, expected: release?.input_sha256 ?? release?.input_hash, source: `release #${id} on-chain` },
        { label: "Published output", attested: att.data.output_hash, expected: release?.output_sha256 ?? release?.output_hash, source: `release #${id} on-chain` },
        { label: "Project", attested: att.data.project_id, expected: project, source: "contract policy" },
      ]
    : []

  return (
    <div className="flex flex-col gap-4 border-t-2 border-ink pt-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <p className="text-[1.125rem] font-semibold text-ink">Release #{id}</p>
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-[0.875rem]">
          {txs.map((t, i) => (
            <TxLink key={t} tx={t} label={i === txs.length - 1 ? "engine run tx" : i === 0 ? "proposal tx" : "vote tx"} />
          ))}
          <ExtLink href={explorer.attestation(txHashOf(exec))}>attestation JSON</ExtLink>
        </div>
      </div>
      {att.isPending ? (
        <div className="flex flex-col gap-2" aria-busy="true">
          {[0, 1, 2, 3].map((i) => (
            <Shimmer key={i} className="h-9" />
          ))}
        </div>
      ) : att.isError ? (
        <ErrorState error={att.error} onRetry={() => att.refetch()} />
      ) : (
        <ul className="flex flex-col">
          {rows.map((r) => {
            const match = Boolean(r.attested && r.expected && r.attested === r.expected)
            return (
              <li key={r.label} className="grid grid-cols-[1.25rem_minmax(0,1fr)] items-start gap-x-3 gap-y-1 border-b border-border py-3 sm:grid-cols-[1.25rem_10rem_minmax(0,1fr)]">
                <PassMark pass={match} className="mt-0.5 size-5" />
                <span className="text-[0.9375rem] font-medium text-ink">{r.label}</span>
                <span className="col-start-2 text-[0.875rem] text-muted-foreground sm:col-start-3">
                  <code className="font-mono text-ink" title={r.attested}>{r.label === "Project" ? r.attested : shortHash(r.attested, 10, 6)}</code>{" "}
                  {match ? `matches the ${r.source}` : r.expected ? `differs from the ${r.source}` : `has nothing to compare against`}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
