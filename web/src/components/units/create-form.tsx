import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { Plus } from "lucide-react"
import { GlField, SquareButton } from "@/components/unit"
import { Spinner } from "@/components/ui/spinner"
import { LIMITS, type Conn } from "@/lib/units"
import { parseDomains, prepareCreate, type Created, type Landed } from "@/lib/units/actions"
import { useTap } from "@/lib/units/use-tap"
import { TxState } from "./tx-state"

const NAME_OK = (s: string) => s.trim().length >= 3 && s.trim().length <= 60

/**
 * Create a unit: one create_unit transaction from the person's own wallet. They become council seat 1. The invite
 * code is made here and only its sha256 goes on chain.
 */
export function CreateForm({ conn, gasReady, atCap, onCreated }: { conn: Conn; gasReady: boolean; atCap: boolean; onCreated: (c: Landed<Created>) => void }) {
  const qc = useQueryClient()
  const [name, setName] = useState("")
  const [domainsText, setDomainsText] = useState("")
  const [tried, setTried] = useState(false)
  const { domains, bad } = parseDomains(domainsText)
  const valid = NAME_OK(name) && bad.length === 0 && domains.length <= 5
  const key = valid && gasReady && !atCap ? JSON.stringify([conn.accountId, name.trim(), domains]) : null
  const t = useTap<Landed<Created>>(key, () => prepareCreate(conn, name.trim(), domains))
  const busy = t.phase.s === "busy"

  const create = () => {
    setTried(true)
    const run = t.tap()
    run?.then((c) => {
      void qc.invalidateQueries({ queryKey: ["units"] })
      onCreated(c)
    }, () => undefined)
  }

  return (
    <div className="flex flex-col gap-7">
      <GlField
        label="Unit name"
        placeholder="Lisbon newsroom chapel"
        value={name}
        maxLength={60}
        onChange={(e) => setName(e.target.value)}
        invalid={tried && !NAME_OK(name)}
        hint={tried && !NAME_OK(name) ? "Between 3 and 60 characters. It is public on chain, so use a team name, not a person's." : "Public on chain. Your colleagues see it when they join."}
        disabled={busy}
      />
      <GlField
        label="Employer email domains (optional)"
        placeholder="payroll.example.com"
        value={domainsText}
        onChange={(e) => setDomainsText(e.target.value)}
        invalid={bad.length > 0}
        hint={
          bad.length > 0
            ? `Not a domain: ${bad.join(", ")}. Use the d= domain of your payroll emails, like payroll.example.com.`
            : "The d= domain your payroll emails are signed with. A payslip email from it counts as DKIM-verified; everything else is self-attested. Council seats can add more later."
        }
        disabled={busy}
      />
      {domains.length > 0 && (
        <ul className="-mt-3 flex flex-wrap gap-2" aria-label="Domains to list">
          {domains.map((d) => (
            <li key={d} className="bg-white px-2 py-1 font-mono text-[0.8125rem] text-ink">{d}</li>
          ))}
        </ul>
      )}

      <div className="flex flex-col gap-3 border-t-2 border-ink pt-5">
        <p className="text-[0.9375rem] leading-relaxed text-foreground">
          You become <strong>council seat 1</strong>. Releases need approval from more than half the council; you can add up to {LIMITS.councilSeats} seats. At most {LIMITS.unitsPerAccount} units per account.
        </p>
        <SquareButton onClick={create} disabled={busy || (!t.canTap && valid && !atCap)} className="w-full sm:w-fit">
          {busy ? <Spinner className="size-4" /> : <Plus className="size-4" />}
          {busy ? "Approve in your wallet…" : !gasReady && valid ? "Waiting for gas…" : t.phase.s === "preparing" ? "Getting ready…" : "Create the unit"}
        </SquareButton>
        {atCap && <p className="text-[0.9375rem] font-medium text-indigo">This account already has {LIMITS.unitsPerAccount} units, the most the contract allows.</p>}
        {tried && !valid && <p className="text-[0.9375rem] font-medium text-indigo" role="alert">Give the unit a name first.</p>}
      </div>
      <TxState
        phase={t.phase}
        tx={t.phase.s === "done" ? t.phase.result.tx : null}
        onRetry={create}
        onRetryPrepare={t.retryPrepare}
        words={{ what: "a create_unit transaction", busy: "Approve create_unit in your wallet…", done: "Unit created on NEAR testnet." }}
      />
    </div>
  )
}
