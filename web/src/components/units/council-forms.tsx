import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { Check, Plus, RefreshCw } from "lucide-react"
import { GlField, SquareButton } from "@/components/unit"
import { Spinner } from "@/components/ui/spinner"
import { shortAccount } from "@/lib/wallet/identity"
import { LIMITS, type Conn, type Unit } from "@/lib/units"
import { parseDomains, prepareAddCouncil, prepareAddDomain, prepareRotateInvite, type Landed } from "@/lib/units/actions"
import { useTap, type Prepared } from "@/lib/units/use-tap"
import { TxState } from "./tx-state"
import { threshold } from "./unit-query-builder"

const ACCOUNT = /^(([a-z\d]+[-_])*[a-z\d]+\.)+testnet$|^[0-9a-f]{64}$|^0x[0-9a-f]{40}$/

type FieldTxProps<T> = {
  label: string
  placeholder: string
  hint: string
  invalidHint: string
  valid: (v: string) => boolean
  normalise: (v: string) => string
  prepare: (v: string) => Promise<Prepared<Landed<T>>>
  what: string
  method: string
  done: (v: string, value: T) => string
  disabled?: string | null
}

/** One field plus one wallet transaction, under the tap rule. */
function OneFieldTx<T>({ label, placeholder, hint, invalidHint, valid, normalise, prepare, what, method, done, disabled }: FieldTxProps<T>) {
  const qc = useQueryClient()
  const [text, setText] = useState("")
  const v = normalise(text)
  const ok = valid(v)
  const t = useTap<Landed<T>>(ok && !disabled ? v : null, () => prepare(v))
  const busy = t.phase.s === "busy"
  const go = () => t.tap()?.then(() => void qc.invalidateQueries({ queryKey: ["units"] }), () => undefined)
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:gap-6">
        <GlField label={label} placeholder={placeholder} value={text} onChange={(e) => setText(e.target.value)} invalid={text !== "" && !ok} hint={text !== "" && !ok ? invalidHint : hint} className="sm:flex-1" disabled={busy || Boolean(disabled)} />
        <SquareButton onClick={go} disabled={!t.canTap || busy} className="w-full sm:mb-7 sm:w-fit">
          {busy ? <Spinner className="size-4" /> : <Plus className="size-4" />} {busy ? "Approve in your wallet…" : "Add"}
        </SquareButton>
      </div>
      {disabled && <p className="text-[0.9375rem] text-muted-foreground">{disabled}</p>}
      <TxState phase={t.phase} tx={t.phase.s === "done" ? t.phase.result.tx : null} onRetry={go} onRetryPrepare={t.retryPrepare} words={{ what, busy: `Approve ${method} in your wallet…`, done: t.phase.s === "done" ? done(v, t.phase.result.value) : undefined }} />
    </div>
  )
}

const seatDone = (unit: Unit) => (v: string, value: "added" | "pending") =>
  value === "added"
    ? `${v} now holds a council seat.`
    : `Your approval for ${v} is recorded. The seat lands once ${threshold(unit.council.length)} of the ${unit.council.length} seats have approved it.`

export function AddSeat({ conn, unit }: { conn: Conn; unit: Unit }) {
  const full = unit.council.length >= LIMITS.councilSeats
  const n = unit.council.length
  return (
    <OneFieldTx
      label="Add a council seat"
      placeholder="colleague.testnet"
      hint={n === 1 ? "A NEAR testnet account. As the only seat, your call adds it at once." : `A NEAR testnet account. Each seat's call is one approval; it lands when ${threshold(n)} of ${n} seats have called it.`}
      invalidHint="Use a testnet account id, like colleague.testnet, that is not already a seat."
      valid={(v) => ACCOUNT.test(v) && !unit.council.includes(v)}
      normalise={(v) => v.trim().toLowerCase()}
      prepare={(v) => prepareAddCouncil(conn, unit.id, v)}
      what="a unit_add_council transaction"
      method="unit_add_council"
      done={seatDone(unit)}
      disabled={full ? `The council has ${LIMITS.councilSeats} seats, the most allowed.` : null}
    />
  )
}

/** Seats asked for but not yet approved by more than half the council; a seat that has not approved can add its call. */
export function PendingSeats({ unit, conn }: { unit: Unit; conn: Conn | null }) {
  if (unit.pendingSeats.length === 0) return null
  const need = threshold(unit.council.length)
  return (
    <div className="flex flex-col gap-3">
      <p className="text-[0.8125rem] font-medium tracking-[0.02em] text-muted-foreground uppercase">Pending seats</p>
      <ul className="flex flex-col border-t border-border">
        {unit.pendingSeats.map((p) => (
          <li key={p.accountId} className="flex flex-col gap-3 border-b border-border py-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <code className="font-mono text-[0.9375rem] text-ink" title={p.accountId}>{shortAccount(p.accountId)}</code>
              <span className="bg-lav-mid px-2 py-1 text-[0.75rem] font-semibold text-indigo">
                {p.approvals.length} of {need} approvals
              </span>
            </div>
            {conn && unit.council.includes(conn.accountId) && !p.approvals.includes(conn.accountId) && <ApproveSeat conn={conn} unit={unit} account={p.accountId} />}
            {conn && p.approvals.includes(conn.accountId) && <p className="text-[0.875rem] text-muted-foreground">You approved this seat.</p>}
          </li>
        ))}
      </ul>
    </div>
  )
}

function ApproveSeat({ conn, unit, account }: { conn: Conn; unit: Unit; account: string }) {
  const qc = useQueryClient()
  const t = useTap<Landed<"added" | "pending">>(`${conn.accountId}:${unit.id}:${account}`, () => prepareAddCouncil(conn, unit.id, account))
  const busy = t.phase.s === "busy"
  const go = () => t.tap()?.then(() => void qc.invalidateQueries({ queryKey: ["units"] }), () => undefined)
  return (
    <div className="flex flex-col gap-3">
      {t.phase.s !== "done" && (
        <button type="button" onClick={go} disabled={!t.canTap || busy} className="inline-flex w-fit cursor-pointer items-center gap-2 text-[0.9375rem] font-semibold text-ink disabled:opacity-40">
          {busy ? <Spinner className="size-4" /> : <Check className="size-4" />} <span className="wipe">Approve this seat</span>
        </button>
      )}
      <TxState phase={t.phase} tx={t.phase.s === "done" ? t.phase.result.tx : null} onRetry={go} onRetryPrepare={t.retryPrepare} words={{ what: "a unit_add_council transaction", busy: "Approve unit_add_council in your wallet…", done: t.phase.s === "done" ? seatDone(unit)(account, t.phase.result.value) : undefined }} />
    </div>
  )
}

/** "New invite link": rotates the invite secret; the old link stops working and members stay. */
export function RotateInvite({ conn, unit, onNew }: { conn: Conn; unit: Unit; onNew: () => void }) {
  const qc = useQueryClient()
  const t = useTap<Landed<string>>(`${conn.accountId}:${unit.id}:rotate`, () => prepareRotateInvite(conn, unit.id))
  const busy = t.phase.s === "busy"
  const go = () =>
    t.tap()?.then(() => {
      void qc.invalidateQueries({ queryKey: ["units"] })
      onNew()
    }, () => undefined)
  return (
    <div className="flex flex-col gap-3">
      <SquareButton variant="line" onClick={go} disabled={!t.canTap || busy} className="w-full sm:w-fit">
        {busy ? <Spinner className="size-4" /> : <RefreshCw className="size-4" />} {busy ? "Approve in your wallet…" : "New invite link"}
      </SquareButton>
      <p className="text-[0.875rem] text-muted-foreground">The old link stops working. Everyone who already joined stays a member.</p>
      <TxState phase={t.phase} tx={t.phase.s === "done" ? t.phase.result.tx : null} onRetry={go} onRetryPrepare={t.retryPrepare} words={{ what: "a unit_rotate_invite transaction", busy: "Approve unit_rotate_invite in your wallet…", done: "New invite link made. Copy it above; it is shown once." }} />
    </div>
  )
}

export function AddDomain({ conn, unit }: { conn: Conn; unit: Unit }) {
  return (
    <OneFieldTx
      label="Add an employer email domain"
      placeholder="payroll.example.com"
      hint={`The d= domain your payroll emails are signed with (up to ${LIMITS.domains}). Payslip emails from it count as DKIM-verified.`}
      invalidHint="Use a domain like payroll.example.com (already-listed domains are skipped)."
      valid={(v) => parseDomains(v).domains.length === 1 && !unit.dkimDomains.includes(v)}
      normalise={(v) => parseDomains(v).domains[0] ?? v.trim().toLowerCase()}
      prepare={(v) => prepareAddDomain(conn, unit.id, v)}
      what="a unit_add_dkim_domain transaction"
      method="unit_add_dkim_domain"
      done={(v) => `${v} is listed. Payslip emails signed by it count as DKIM-verified.`}
      disabled={unit.dkimDomains.length >= LIMITS.domains ? `The unit lists ${LIMITS.domains} domains, the most allowed.` : null}
    />
  )
}
