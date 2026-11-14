import type { ReleaseRecord } from "@bandsheet/core"
import { explorer, txHashOf, useDemoLog } from "@/lib/chain"
import { extras } from "@/lib/dkim"
import { shortHash } from "@/lib/format"
import { cn } from "@/lib/utils"
import { ExtLink } from "../links"
import { useAttestation } from "./data"

type Run = { id: number; exec?: string }

/** Which engine build ran each release: recorded on the release (from #3) or attested by OutLayer (earlier). */
export function EngineHistory({ runs, releases, current }: { runs: Run[]; releases: ReleaseRecord[]; current?: string }) {
  const log = useDemoLog().data
  const engineTx = Object.entries(log ?? {}).find(([k]) => /engine/i.test(k))?.[1]?.at(-1)
  const ids = [...new Set([...releases.map((r) => r.id), ...runs.map((r) => r.id)])].sort((a, b) => a - b)

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col">
        {ids.map((id) => (
          <EngineRow key={id} id={id} release={releases.find((r) => r.id === id)} exec={runs.find((r) => r.id === id)?.exec} current={current} />
        ))}
        {current && (
          <li className="grid grid-cols-[minmax(0,7rem)_minmax(0,1fr)] items-baseline gap-3 py-3">
            <span className="text-[0.9375rem] font-semibold text-ink">Next release</span>
            <span className="text-[0.875rem] text-foreground">
              <code className="font-mono text-ink" title={current}>{shortHash(current, 10, 6)}</code> · the engine the contract policy names now
            </span>
          </li>
        )}
      </ul>
      {engineTx && <ExtLink href={explorer.tx(txHashOf(engineTx))} className="w-fit text-[0.9375rem]">The vote that changed the engine</ExtLink>}
    </div>
  )
}

function EngineRow({ id, release, exec, current }: { id: number; release?: ReleaseRecord; exec?: string; current?: string }) {
  const recorded = release ? extras(release).wasm : null
  const att = useAttestation(recorded ? undefined : exec ? txHashOf(exec) : undefined)
  const hash = recorded ?? att.data?.executed_wasm_sha256 ?? att.data?.wasm_hash
  return (
    <li className="grid grid-cols-[minmax(0,7rem)_minmax(0,1fr)] items-baseline gap-3 border-b border-border py-3">
      <span className="text-[0.9375rem] font-semibold text-ink">Release #{id}</span>
      <span className="text-[0.875rem] text-muted-foreground">
        {hash ? (
          <>
            <code className={cn("font-mono", hash === current ? "text-ink" : "text-foreground")} title={hash}>
              {shortHash(hash, 10, 6)}
            </code>{" "}
            · {recorded ? "recorded with the release" : "attested by OutLayer"}
          </>
        ) : att.isPending && !recorded && exec ? (
          "Reading OutLayer's attestation…"
        ) : (
          "No engine hash on file for this record"
        )}
      </span>
    </li>
  )
}
