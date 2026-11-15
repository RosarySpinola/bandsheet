import { useState } from "react"
import { KeyRound } from "lucide-react"
import { SquareButton } from "@/components/unit"
import { Spinner } from "@/components/ui/spinner"
import type { Unit } from "@/lib/units"
import type { IssuerResult } from "@/lib/units/schemas"
import { prepareSuppliedIssuer } from "@/lib/units/actions"
import { useTap } from "@/lib/units/use-tap"
import { TxState } from "./tx-state"
import { WalletGate } from "./wallet-gate"

/** Base64 SPKI from a PEM block or bare base64; anything else is left for the server to refuse. */
const spkiOf = (text: string) => text.replace(/-----(BEGIN|END) PUBLIC KEY-----/g, "").replace(/\s+/g, "")

/**
 * When a listed employer domain has no DNS record (a test domain), a council seat can supply the employer's public key.
 * The wallet signs "Bandsheet issuer <id>: <domain> <selector>"; the key is recorded on the unit as "supplied, not DNS".
 */
export function SupplyIssuerKey({ unit, domain, selector, eml, onRecorded }: {
  unit: Unit
  domain: string
  selector: string
  eml: string
  onRecorded: (r: IssuerResult) => void
}) {
  return (
    <div className="flex flex-col gap-3 border-t border-border pt-3">
      <p className="flex items-center gap-2 font-semibold text-ink"><KeyRound className="size-4" /> No DNS record for {selector}._domainkey.{domain}</p>
      <p className="text-[0.875rem] text-foreground">
        A council seat can supply the employer's public key instead. It is recorded on the unit as <strong>supplied, not DNS</strong>, and the sealed engine
        still checks the email's signature against it.
      </p>
      <WalletGate title="Connect a council wallet" body="Only a council seat can supply an employer key. Your wallet signs a message (free, no gas).">
        {(conn) =>
          unit.council.includes(conn.accountId) ? (
            <SupplyForm unit={unit} domain={domain} selector={selector} eml={eml} conn={conn} onRecorded={onRecorded} />
          ) : (
            <p className="text-[0.875rem] text-muted-foreground">Only the unit's council seats can supply an employer key.</p>
          )
        }
      </WalletGate>
    </div>
  )
}

function SupplyForm({ unit, domain, selector, eml, conn, onRecorded }: Parameters<typeof SupplyIssuerKey>[0] & { conn: Parameters<typeof prepareSuppliedIssuer>[0] }) {
  const [text, setText] = useState("")
  const key = spkiOf(text)
  const ok = /^[A-Za-z0-9+/=]{200,2048}$/.test(key)
  const t = useTap(ok ? `${conn.accountId}:${unit.id}:${domain}:${selector}:${key.slice(-24)}` : null, () => prepareSuppliedIssuer(conn, unit.id, domain, selector, eml, key))
  const busy = t.phase.s === "busy"
  const go = () => t.tap()?.then(onRecorded, () => undefined)
  return (
    <div className="flex flex-col gap-3">
      <label htmlFor="issuer-key" className="text-[0.875rem] font-medium text-ink">Employer public key (PEM or base64 SPKI)</label>
      <textarea
        id="issuer-key"
        rows={4}
        spellCheck={false}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="-----BEGIN PUBLIC KEY----- MIIBIjANBgkq…"
        className="w-full resize-y border-b border-ink bg-transparent py-2 font-mono text-[0.8125rem] text-ink outline-none placeholder:text-muted-foreground/70 focus-visible:border-b-2"
      />
      <SquareButton onClick={go} disabled={!t.canTap || busy} className="w-full sm:w-fit">
        {busy ? <Spinner className="size-4" /> : <KeyRound className="size-4" />}
        {busy ? (t.phase.s === "busy" && t.phase.stage === "posting" ? "Recording the key…" : "Sign in your wallet…") : "Sign and record this key"}
      </SquareButton>
      <TxState
        phase={t.phase}
        tx={t.phase.s === "done" ? (t.phase.result.tx?.hash ?? null) : null}
        onRetry={go}
        onRetryPrepare={t.retryPrepare}
        words={{
          what: `the message "Bandsheet issuer ${unit.id}: ${domain} ${selector}"`,
          busy: "Sign the issuer message in your wallet…",
          posting: "Signed. The registrar is recording the key on the unit…",
          done: "Employer key recorded on the unit (supplied, not DNS).",
        }}
      />
    </div>
  )
}
