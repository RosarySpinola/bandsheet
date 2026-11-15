import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Mail, MailCheck } from "lucide-react"
import { Spinner } from "@/components/ui/spinner"
import { ErrorState, TxLink } from "@/components/unit"
import type { ExtractResponse } from "@/lib/api"
import { units, type EntryKind, type Unit } from "@/lib/units"
import { EntryBadge, badgeNote } from "./badges"
import { SupplyIssuerKey } from "./supply-issuer"

type Preview = NonNullable<ExtractResponse["dkim_preview"]>

/** The issuer route takes the raw .eml text; the flow holds it as base64 for sealing. */
const emlText = (b64: string) => new TextDecoder().decode(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)))

/**
 * A payroll email from one of the unit's listed employer domains: the server fetches that selector's key over DNS and
 * the registrar records it on the unit, so the engine can verify the signature. Anything else is self-attested.
 */
export function useUnitIssuer(unit: Unit | undefined, emlB64: string | null, preview: Preview | null | undefined) {
  const domain = preview?.domain?.toLowerCase() ?? null
  const listed = Boolean(unit && domain && unit.dkimDomains.includes(domain))
  const q = useQuery({
    queryKey: ["units", "issuer", unit?.id, emlB64 ? `${emlB64.length}:${emlB64.slice(-48)}` : null, domain, preview?.selector],
    queryFn: () => units.issuer(unit!.id, emlText(emlB64!)),
    enabled: Boolean(unit && emlB64 && listed && preview?.has_signature),
    staleTime: Infinity,
    retry: 1,
  })
  // A council seat may supply the key when the listed domain has no DNS record (test domains); then it counts too.
  const [supplied, setSupplied] = useState<{ eml: string; tx: string | null } | null>(null)
  const eml = emlB64 ? emlText(emlB64) : null
  const suppliedHere = Boolean(supplied && eml && supplied.eml === eml)
  const kind: EntryKind = emlB64 && listed && (q.isSuccess || suppliedHere) ? "dkim" : "self"
  return { domain, listed, issuer: q, kind, eml, supplied: suppliedHere ? supplied : null, setSupplied }
}

export function UnitDkimCard({ unit, email, preview, state }: { unit: Unit; email: boolean; preview?: Preview | null; state: ReturnType<typeof useUnitIssuer> }) {
  const box = "flex flex-col gap-3 border-l-2 px-5 py-4 text-[0.9375rem] leading-relaxed"
  if (!email)
    return (
      <div className={`${box} border-ink bg-band`}>
        <span className="flex flex-wrap items-center gap-3 font-semibold text-ink">This entry will be <EntryBadge kind="self" /></span>
        <span className="text-foreground">{badgeNote("self")} For DKIM-verified, upload the payslip email your payroll sent, from a domain the unit lists{unit.dkimDomains.length ? ` (${unit.dkimDomains.join(", ")})` : ""}.</span>
      </div>
    )
  if (!preview?.has_signature || !state.domain)
    return (
      <div className={`${box} border-ink bg-band`}>
        <span className="flex items-center gap-2 font-semibold text-ink"><Mail className="size-4" /> This email carries no employer signature.</span>
        <span className="text-foreground">It is read like any payslip and counted as <strong>self-attested</strong>.</span>
      </div>
    )
  if (!state.listed)
    return (
      <div className={`${box} border-ink bg-band`}>
        <span className="flex items-center gap-2 font-semibold text-ink"><Mail className="size-4" /> Signed by {state.domain}, which this unit does not list.</span>
        <span className="text-foreground">
          It counts as <strong>self-attested</strong>. A council seat can add {state.domain} on the Invite and council page; submit again afterwards to count as DKIM-verified.
        </span>
      </div>
    )
  const q = state.issuer
  return (
    <div className={`${box} border-ink bg-band`}>
      <span className="flex flex-wrap items-center gap-2 font-semibold text-ink">
        <MailCheck className="size-4" /> Signed by {state.domain} (selector {preview.selector}), a listed employer domain.
      </span>
      {q.isPending && (
        <span className="flex items-center gap-2 text-foreground"><Spinner className="size-3.5" /> Fetching {preview.selector}._domainkey.{state.domain} over DNS and recording the key on the unit…</span>
      )}
      {q.isSuccess && (
        <span className="flex flex-col gap-2 text-foreground">
          <span className="flex flex-wrap items-center gap-2">Employer key recorded. This entry will be <EntryBadge kind="dkim" /></span>
          <span className="text-[0.875rem] text-muted-foreground">
            The sealed engine verifies the signature at each release; a forged or edited email is refused there.
            {q.data.tx?.hash && <> Recorded in <TxLink tx={q.data.tx.hash} className="text-[0.875rem]" />.</>}
          </span>
        </span>
      )}
      {q.isError && !state.supplied && <ErrorState error={q.error} title="The employer's key could not be recorded, so this entry would count as self-attested." onRetry={() => void q.refetch()} className="bg-white" />}
      {q.isError && state.eml && preview.selector && !state.supplied && (
        <SupplyIssuerKey unit={unit} domain={state.domain} selector={preview.selector} eml={state.eml} onRecorded={(r) => state.setSupplied({ eml: state.eml!, tx: r.tx?.hash ?? null })} />
      )}
      {state.supplied && (
        <span className="flex flex-col gap-2 text-foreground">
          <span className="flex flex-wrap items-center gap-2">Employer key recorded (supplied, not DNS). This entry will be <EntryBadge kind="dkim" /></span>
          {state.supplied.tx && <span className="text-[0.875rem] text-muted-foreground">Recorded in <TxLink tx={state.supplied.tx} className="text-[0.875rem]" />.</span>}
        </span>
      )}
    </div>
  )
}
