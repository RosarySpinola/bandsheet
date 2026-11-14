import { cn } from "@/lib/utils"
import { UNIT_NAME } from "../nav"
import { Fact } from "../page-header"
import { HashValue } from "../copy-button"
import { CtaLink, SquareButton } from "../links"
import { ErrorState, Shimmer } from "../states"
import { PassMark } from "../verified-panel"
import { joinHref } from "../session"
import type { SubmitFlow } from "./use-submit-flow"

/** Step 1: the key opened on /unit/join, re-checked live against the contract's member list. */
export function StepKey({ flow }: { flow: SubmitFlow }) {
  const s = flow.invite
  return (
    <div className="flex flex-col gap-8">
      <p className="max-w-[38rem] text-[1.0625rem] leading-relaxed text-foreground">
        Your key can only call <code className="font-mono text-[0.9375rem]">submit</code> on the chapel's contract. Your entry is filed
        under a slot derived from it, so the ledger never links an entry to a name.
      </p>

      {(s.status === "busy" || s.status === "idle") && (
        <div className="flex flex-col gap-3 bg-band p-6 md:p-8" aria-busy="true" aria-label="Checking your key on NEAR testnet">
          <p className="text-[0.9375rem] text-muted-foreground">Asking the contract whether your key belongs to a member…</p>
          <Shimmer className="h-6 w-2/3 bg-white" />
          <Shimmer className="h-6 w-1/2 bg-white" />
        </div>
      )}
      {s.status === "error" && <ErrorState error={s.error} onRetry={flow.resetInvite} />}
      {s.status === "done" && s.data && (
        <div className={cn("flex flex-col gap-6 border-t-2 p-6 md:p-8", s.data.member ? "border-ink bg-band" : "border-ink bg-lav-soft")}>
          <div className="flex items-start gap-4">
            <PassMark pass={s.data.member} className="mt-0.5 size-8" />
            <div className="flex flex-col gap-1">
              <p className={"text-[1.125rem] font-semibold text-ink"}>
                {s.data.member ? `A registered member of ${UNIT_NAME}` : "Refused: this key is not a member"}
              </p>
              <p className="text-[0.9375rem] text-foreground">
                {s.data.member
                  ? s.data.demo
                    ? "This is the synthetic demo member. Its key can only call submit, on testnet."
                    : "The contract recognises this key's slot."
                  : "The contract checked its member list and this slot is not on it. It will refuse any entry signed with this key."}
              </p>
            </div>
          </div>
          <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
            <Fact label="Your slot id">
              <HashValue value={s.data.invite.slot} head={12} tail={6} />
            </Fact>
            <Fact label="Public key">
              <HashValue value={s.data.invite.publicKey} head={16} tail={6} />
            </Fact>
          </dl>
          <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
            {s.data.member && <SquareButton onClick={() => flow.go(2)}>Continue to the payslip</SquareButton>}
            <CtaLink to={joinHref("/unit/submit")}>Switch key</CtaLink>
          </div>
        </div>
      )}
    </div>
  )
}
