import { useState } from "react"
import { Link, useNavigate, useParams, useSearchParams } from "react-router"
import { CtaButton, CtaLink, ErrorState, GlField, Shimmer } from "@/components/unit"
import { EntryFrame } from "@/components/units/entry-frame"
import { JoinButton } from "@/components/units/join-button"
import { WalletGate } from "@/components/units/wallet-gate"
import { plainError } from "@/lib/api"
import { CODE_EXAMPLE, looksLikeCode, normaliseCode } from "@/lib/units/invite"
import { useUnitKey } from "@/lib/units/keys"
import { useUnitView } from "@/lib/units/hooks"
import { shortAccount } from "@/lib/wallet/identity"

/** A card for the two invite failures a colleague can hit: a wrong code, or a wallet that already joined. */
function InviteProblem({ title, body, children }: { title: string; body: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 border-t-2 border-ink bg-lav-soft p-6" role="alert">
      <p className="text-[1.125rem] font-semibold text-ink">{title}</p>
      <p className="text-[0.9375rem] leading-relaxed text-foreground">{body}</p>
      {children}
    </div>
  )
}

/** /join/:unitId?code=…: the invite link a council member shares. */
export default function JoinUnit() {
  const { unitId: raw } = useParams()
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const unitId = raw && /^\d{1,9}$/.test(raw) ? Number(raw) : null
  const view = useUnitView(unitId)
  const key = useUnitKey(unitId ?? -1)
  const code = normaliseCode(params.get("code") ?? "")
  const codeOk = looksLikeCode(code)
  const [typed, setTyped] = useState("")
  const unit = view.data?.unit

  const notFound = unitId === null || plainError(view.error).code === "UNIT_NOT_FOUND"

  return (
    <EntryFrame
      eyebrow={unit ? `Unit #${unit.id} · ${unit.members} ${unit.members === 1 ? "member" : "members"} · NEAR testnet` : "An invite to a Bandsheet unit"}
      title={unit ? <>Join {unit.name}</> : notFound ? "No such unit" : "Join a unit"}
      lede="Membership lets you add your pay privately and see where you stand. It cannot read anyone's figure, yours included. Joining is free: your wallet signs a message, no transaction."
      footer="Your posting key is made in this browser and kept here. It can only call submit on the units contract and holds no funds. Your wallet's account is never written next to your entry on chain."
    >
      {notFound ? (
        <InviteProblem title="This invite points to a unit that does not exist." body="Check the link with the colleague who sent it. Unit numbers are small whole numbers, like /join/4.">
          <CtaLink to="/start">Start your own unit instead</CtaLink>
        </InviteProblem>
      ) : view.isPending ? (
        <div className="flex flex-col gap-3" aria-busy="true">
          <Shimmer className="h-6 w-2/3 bg-white" />
          <Shimmer className="h-28 bg-white" />
        </div>
      ) : view.isError ? (
        <ErrorState error={view.error} title="The unit could not be read from NEAR testnet." onRetry={() => void view.refetch()} className="bg-white" />
      ) : key ? (
        <div className="flex flex-col gap-4 border-t-2 border-ink bg-white p-6">
          <p className="text-[1.125rem] font-semibold text-ink">You're already a member of {unit?.name}.</p>
          <p className="text-[0.9375rem] text-foreground">This browser holds your posting key for this unit (joined as {shortAccount(key.accountId)}).</p>
          <CtaLink to={`/u/${unitId}/submit`} size="lg">Submit your payslip</CtaLink>
        </div>
      ) : !codeOk ? (
        <InviteProblem
          title={code ? "This invite code is not in the right form." : "This link has no invite code."}
          body={`An invite code is 22 letters, digits, dashes or underscores, like ${CODE_EXAMPLE}. Paste the one your colleague sent, or the whole link.`}
        >
          <GlField label="Invite code" placeholder={CODE_EXAMPLE} value={typed} onChange={(e) => setTyped(e.target.value)} invalid={typed !== "" && !looksLikeCode(typed)} />
          <CtaButton disabled={!looksLikeCode(typed)} onClick={() => setParams({ code: normaliseCode(typed) })} className="w-fit">
            Use this code
          </CtaButton>
        </InviteProblem>
      ) : (
        <WalletGate body="Join with any NEAR testnet wallet. It signs one message and pays no gas." className="bg-white">
          {(conn) => (
            <div className="flex flex-col gap-6">
              <p className="text-[0.9375rem] text-muted-foreground">
                Joining as <code className="font-mono text-ink" title={conn.accountId}>{shortAccount(conn.accountId)}</code> with invite <code className="font-mono text-ink">{code.slice(0, 6)}…</code>
              </p>
              <JoinButton
                conn={conn}
                unitId={unitId!}
                code={code}
                onJoined={() => navigate(`/u/${unitId}/submit`)}
                errors={{
                  INVITE_INVALID: "This invite link no longer works. The code may be mistyped, or a council seat has made a new invite link since. Ask them for the current one.",
                  ALREADY_MEMBER: "This posting key is already registered for this unit.",
                  NOT_COUNCIL: "Only a council seat can do that.",
                }}
              />
            </div>
          )}
        </WalletGate>
      )}
      {!notFound && unit && (
        <p className="text-[0.875rem] text-muted-foreground">
          Created by {shortAccount(unit.creator)} · council of {unit.council.length}.{" "}
          <Link to={`/u/${unit.id}`} className="wipe font-semibold text-ink">Look around the unit first</Link>
        </p>
      )}
    </EntryFrame>
  )
}
