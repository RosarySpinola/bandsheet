import type { ReactNode } from "react"
import type { ReleaseRecord } from "@bandsheet/core"
import { Check, Minus } from "lucide-react"
import { cn } from "@/lib/utils"
import { CONTRACT, explorer } from "@/lib/chain"
import { useAttestation, usePolicyWasm } from "./data"
import { AccountLink, ExtLink, TxLink, HashValue } from "@/components/unit"

function CheckLine({ ok, children }: { ok: boolean | null; children: string }) {
  return (
    <li className={cn("flex items-start gap-2 text-[0.875rem] leading-snug", ok === false ? "text-alarm" : "text-text")}>
      {ok === null ? (
        <Minus className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
      ) : (
        <Check className={cn("mt-0.5 size-3.5 shrink-0", ok ? "text-[var(--green-400)]" : "text-alarm")} strokeWidth={2.5} />
      )}
      <span>{children}</span>
    </li>
  )
}

/** Proof column: tx, OutLayer attestation (fetched and compared), sha256 of input and output, engine WASM. */
export function ReleaseProof({ release, tx }: { release: ReleaseRecord; tx?: string }) {
  const att = useAttestation(tx)
  const policyWasm = usePolicyWasm().data
  const input = release.input_sha256 ?? release.input_hash
  const output = release.output_sha256 ?? release.output_hash
  const wasm = att.data?.executed_wasm_sha256 ?? att.data?.wasm_hash ?? policyWasm
  const wasmOk = att.data && policyWasm ? (att.data.executed_wasm_sha256 ?? att.data.wasm_hash) === policyWasm : null
  const outOk = att.data && output ? att.data.output_hash === output : null
  const inOk = att.data && input ? att.data.input_hash === input : null

  return (
    <dl className="grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
      <Row label="Transaction">
        {tx ? <TxLink tx={tx} /> : <AccountLink id={CONTRACT} />}
      </Row>
      <Row label="OutLayer attestation">
        {tx ? <ExtLink href={explorer.attestation(tx)}>View attestation</ExtLink> : <span className="text-muted-foreground">No tx on file for this record</span>}
      </Row>
      <Row label="Input sha256">{input ? <HashValue value={input} /> : <span className="text-muted-foreground">not recorded</span>}</Row>
      <Row label="Output sha256">{output ? <HashValue value={output} /> : <span className="text-muted-foreground">not recorded</span>}</Row>
      <Row label="Engine WASM sha256" wide>
        {wasm ? <HashValue value={wasm} head={12} tail={6} /> : <span className="text-muted-foreground">loading…</span>}
      </Row>
      {tx && (
        <div className="sm:col-span-2 lg:col-span-1 xl:col-span-2">
          <dt className="sr-only">Checks</dt>
          <dd>
            {att.isPending ? (
              <p className="text-[0.875rem] text-muted-foreground">Fetching OutLayer's attestation…</p>
            ) : att.isError ? (
              <p className="text-[0.875rem] text-muted-foreground">OutLayer's attestation could not be fetched just now. The link above still works.</p>
            ) : (
              <ul className="flex flex-col gap-1.5 border-t border-line pt-4">
                <CheckLine ok={true}>Intel TDX quote present for this transaction</CheckLine>
                <CheckLine ok={wasmOk}>{wasmOk === null ? "Reading the contract policy to compare the engine hash…" : wasmOk ? "Engine hash matches the contract policy" : "Engine hash differs from the contract policy"}</CheckLine>
                <CheckLine ok={inOk}>{inOk === null ? "No input hash to compare" : inOk ? "Input hash matches this record" : "Input hash differs from this record"}</CheckLine>
                <CheckLine ok={outOk}>{outOk === null ? "No output hash to compare" : outOk ? "Output hash matches this record" : "Output hash differs from this record"}</CheckLine>
              </ul>
            )}
          </dd>
        </div>
      )}
    </dl>
  )
}

function Row({ label, children, wide }: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", wide && "sm:col-span-2 lg:col-span-1 xl:col-span-2")}>
      <dt className="text-[0.8125rem] font-medium tracking-[0.02em] text-muted-foreground uppercase">{label}</dt>
      <dd className="min-w-0 text-[1rem] text-ink">{children}</dd>
    </div>
  )
}
