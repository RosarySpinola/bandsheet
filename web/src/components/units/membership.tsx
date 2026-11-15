import { useState } from "react"
import { useNavigate } from "react-router"
import { CtaButton, CtaLink, GlField, HashValue } from "@/components/unit"
import { relative } from "@/lib/format"
import type { Unit } from "@/lib/units"
import { CODE_EXAMPLE, looksLikeCode, normaliseCode, shownInvite } from "@/lib/units/invite"
import { useUnitKey } from "@/lib/units/keys"
import { useWallet } from "@/lib/units/wallet-store"
import { EntryBadge } from "./badges"
import { JoinButton } from "./join-button"
import { roleIn } from "./unit-identity"

/** "You in this unit": council role, membership in this browser, and how your last entry is attested. */
export function Membership({ unit }: { unit: Unit }) {
  const key = useUnitKey(unit.id)
  const w = useWallet()
  const navigate = useNavigate()
  const [typed, setTyped] = useState("")
  const account = w.status === "connected" ? w.conn.accountId : undefined
  const role = roleIn(unit, account)
  const code = shownInvite(unit.id)

  if (key) {
    return (
      <div className="flex flex-col gap-4 bg-band p-6 md:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[1.0625rem] font-semibold text-ink">You're a member{account && role.startsWith("council") ? ` and ${role}` : ""}.</p>
          {key.last ? <EntryBadge kind={key.last.kind} /> : <span className="text-[0.875rem] text-muted-foreground">No entry yet</span>}
        </div>
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <dt className="text-[0.8125rem] font-medium tracking-[0.02em] text-muted-foreground uppercase">Your slot</dt>
            <dd><HashValue value={key.slot} head={12} tail={6} /></dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="text-[0.8125rem] font-medium tracking-[0.02em] text-muted-foreground uppercase">Your entry</dt>
            <dd className="text-[1rem] text-ink">{key.last ? `Sealed ${relative(new Date(key.last.at))}; a newer one replaces it` : "Not submitted yet"}</dd>
          </div>
        </dl>
        <CtaLink to={`/u/${unit.id}/submit`}>{key.last ? "Replace your entry" : "Submit your payslip"}</CtaLink>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 bg-band p-6 md:p-8">
      <p className="text-[1.0625rem] font-semibold text-ink">{role.startsWith("council") ? `You hold ${role}, but this browser has no member key yet.` : "You're not a member in this browser."}</p>
      {w.status === "connected" && code ? (
        <>
          <p className="text-[0.9375rem] text-foreground">Join with the invite you just made, to submit your own payslip.</p>
          <JoinButton conn={w.conn} unitId={unit.id} code={code} label="Join as a member" />
        </>
      ) : (
        <>
          <p className="max-w-[38rem] text-[0.9375rem] leading-relaxed text-foreground">
            Members join with the invite link a council seat shares. Have the code? Paste it here.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-6">
            <GlField label="Invite code" placeholder={CODE_EXAMPLE} value={typed} onChange={(e) => setTyped(e.target.value)} className="sm:w-80" />
            <CtaButton disabled={!looksLikeCode(typed)} onClick={() => navigate(`/join/${unit.id}?code=${encodeURIComponent(normaliseCode(typed))}`)} className="pb-3">
              Join with this code
            </CtaButton>
          </div>
        </>
      )}
    </div>
  )
}
