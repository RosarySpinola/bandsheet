import type { ReactNode } from "react"
import { Fingerprint, Wallet } from "lucide-react"
import { Spinner } from "@/components/ui/spinner"
import { cn } from "@/lib/utils"
import { CONTRACT } from "@/lib/chain"
import { shortAccount } from "@/lib/wallet/identity"
import { HashValue } from "../copy-button"
import { CtaButton, SquareButton, TxLink } from "../links"
import { UNIT_NAME } from "../nav"
import { ErrorState } from "../states"
import { PassMark } from "../verified-panel"
import { useAccountJoin, type JoinPhase } from "./use-account-join"

const BUSY: Partial<Record<JoinPhase["s"], string>> = {
  "auth-login": "Waiting for the NEAR Auth window. Sign in there with email, a passkey or Google…",
  "auth-preparing": "Signed in. Making your member key in this browser…",
  "auth-approving": "Approve the statement in the NEAR Auth window. Bandsheet then asks NEAR Auth's MPC network for the signature…",
  wallet: "Choose a wallet in the NEAR Connect window and approve the signed message…",
}

function Option({ icon, title, sub, onClick, disabled, variant }: { icon: ReactNode; title: string; sub: string; onClick: () => void; disabled: boolean; variant: "ink" | "line" }) {
  return (
    <SquareButton variant={variant} onClick={onClick} disabled={disabled} className="w-full justify-start gap-4 py-3 text-left">
      <span className="shrink-0">{icon}</span>
      <span className="flex min-w-0 flex-col">
        <span>{title}</span>
        <span className={cn("text-[0.8125rem] font-medium", variant === "ink" ? "text-white/75" : "text-muted-foreground")}>{sub}</span>
      </span>
    </SquareButton>
  )
}

/** "Join with your own NEAR account": NEAR Auth (no wallet) or a NEAR Connect wallet. */
export function SignInOptions({ onEnter }: { onEnter: () => void }) {
  const { phase, startNearAuth, approveNearAuth, startWallet, reset } = useAccountJoin()
  const busy = phase.s in BUSY || phase.s === "joining"
  const showButtons = phase.s === "idle" || phase.s === "cancelled" || phase.s === "error"

  return (
    <section aria-labelledby="own-account" className="flex flex-col gap-4">
      <h2 id="own-account" className="text-[0.9375rem] font-medium text-ink">Join with your own NEAR account</h2>
      {showButtons && (
        <div className="flex flex-col gap-3">
          <Option variant="ink" icon={<Fingerprint className="size-5" />} title="Continue with email, passkey or Google" sub="NEAR Auth · no wallet or seed phrase" onClick={startNearAuth} disabled={busy} />
          <Option variant="line" icon={<Wallet className="size-5" />} title="Connect a NEAR wallet" sub="NEAR Connect · Meteor, Intear, Nightly, MyNearWallet, Ledger… on testnet" onClick={startWallet} disabled={busy} />
        </div>
      )}

      <div aria-live="polite" className="flex flex-col gap-4">
        {BUSY[phase.s] && (
          <p className="flex items-start gap-2.5 text-[0.9375rem] text-ink" role="status">
            <Spinner className="mt-1 size-3.5 shrink-0" /> {BUSY[phase.s]}
          </p>
        )}
        {phase.s === "joining" && (
          <p className="flex items-start gap-2.5 text-[0.9375rem] text-ink" role="status">
            <Spinner className="mt-1 size-3.5 shrink-0" /> Signature checked. The committee is adding your member key to {CONTRACT} (5 to 20 seconds)…
          </p>
        )}
        {phase.s === "auth-ready" && (
          <div className="flex flex-col gap-4 border-t-2 border-ink bg-white p-5">
            <p className="text-[1rem] text-ink">
              Signed in with NEAR Auth as <code className="font-mono text-[0.875rem]" title={phase.account.accountId}>{shortAccount(phase.account.accountId)}</code>
            </p>
            <p className="text-[0.9375rem] leading-relaxed text-foreground">
              One more window: approve a statement that names your new member key. It is a signed statement only, built so it can never run on chain, and it cannot move funds.
            </p>
            <SquareButton onClick={approveNearAuth} className="w-full">Approve joining with NEAR Auth</SquareButton>
          </div>
        )}
        {phase.s === "cancelled" && (
          <p className="border-l-2 border-ink bg-band px-5 py-3 text-[0.9375rem] text-ink">Cancelled. Nothing was signed and no key was added.</p>
        )}
        {phase.s === "error" && <ErrorState error={phase.error} title="You were not added." className="bg-white" onRetry={reset} />}
        {phase.s === "done" && (
          <div className="flex flex-col gap-5 border-t-2 border-ink bg-white p-6">
            <div className="flex items-start gap-3">
              <PassMark pass className="mt-0.5 size-7" />
              <p className="text-[1.0625rem] leading-snug font-semibold text-ink">You're a member of {UNIT_NAME}</p>
            </div>
            <dl className="grid grid-cols-1 gap-4 text-[0.9375rem] sm:grid-cols-2">
              <div className="flex min-w-0 flex-col gap-1">
                <dt className="text-[0.8125rem] font-medium tracking-[0.02em] text-muted-foreground uppercase">Signed in as</dt>
                <dd className="truncate font-mono text-[0.875rem] text-ink" title={phase.result.account_id}>{shortAccount(phase.result.account_id)}</dd>
              </div>
              <div className="flex flex-col gap-1">
                <dt className="text-[0.8125rem] font-medium tracking-[0.02em] text-muted-foreground uppercase">Key added</dt>
                <dd><TxLink tx={phase.result.tx.hash} /></dd>
              </div>
              <div className="flex flex-col gap-1 sm:col-span-2">
                <dt className="text-[0.8125rem] font-medium tracking-[0.02em] text-muted-foreground uppercase">Slot id</dt>
                <dd><HashValue value={phase.result.slot} head={14} tail={8} /></dd>
              </div>
            </dl>
            {phase.result.replaced && (
              <p className="text-[0.875rem] text-muted-foreground">
                This account had joined before, so its earlier key was revoked{phase.result.replaced.tx ? <> (<TxLink tx={phase.result.replaced.tx.hash} />)</> : null}. One key per account.
              </p>
            )}
            <CtaButton size="lg" onClick={onEnter}>Enter the chapel</CtaButton>
          </div>
        )}
      </div>

      <details className="group text-[0.875rem] leading-relaxed text-muted-foreground">
        <summary className="wipe w-fit cursor-pointer list-none font-medium text-ink">What your account signs</summary>
        <p className="mt-2">
          This browser makes a member key that can only call <code className="font-mono">submit</code>. Your account signs one statement,{" "}
          <code className="font-mono break-all">Bandsheet join: ed25519:…</code>, for <code className="font-mono">{CONTRACT}</code> with a single-use nonce
          (NEP-413 for wallets; a never-executable statement transaction for NEAR Auth). The server checks the signature and that the key is a full-access key
          of your account, then registers your member key. Which account owns which slot is kept in Bandsheet's private database, never on chain.
        </p>
      </details>
    </section>
  )
}
