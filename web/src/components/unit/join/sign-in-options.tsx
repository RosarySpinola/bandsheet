import { Wallet } from "lucide-react"
import { Spinner } from "@/components/ui/spinner"
import { CONTRACT } from "@/lib/chain"
import { shortAccount } from "@/lib/wallet/identity"
import { nearAuthAvailable } from "@/lib/wallet/near-auth"
import { HashValue } from "../copy-button"
import { CtaButton, SquareButton, TxLink } from "../links"
import { UNIT_NAME } from "../nav"
import { ErrorState } from "../states"
import { PassMark } from "../verified-panel"
import { useAccountJoin, type JoinPhase } from "./use-account-join"

const BUSY: Partial<Record<JoinPhase["s"], string>> = {
  "auth-login": "Waiting for the NEAR Auth window. Sign in there with email or a passkey…",
  "auth-preparing": "Signed in. Making your posting key in this browser…",
  "auth-approving": "Approve the statement in the NEAR Auth window…",
  wallet: "Choose your wallet in the NEAR Connect window and approve the signature…",
}

const Label = ({ children }: { children: string }) => (
  <span className="text-[0.8125rem] font-medium tracking-[0.02em] text-muted-foreground uppercase">{children}</span>
)

/** The primary way in: the member's own NEAR wallet (NEAR Connect). NEAR Auth sits underneath as a small note. */
export function SignInOptions({ onEnter }: { onEnter: () => void }) {
  const { phase, startNearAuth, approveNearAuth, startWallet, reset } = useAccountJoin()
  const busy = phase.s in BUSY || phase.s === "joining"
  const showStart = phase.s === "idle" || phase.s === "cancelled" || phase.s === "error"
  const authHere = nearAuthAvailable()

  return (
    <section aria-labelledby="own-wallet" className="flex flex-col gap-5 border-2 border-ink bg-white p-6 md:p-8">
      <div className="flex items-start gap-4">
        <span className="grid size-11 shrink-0 place-items-center bg-ink text-white">
          <Wallet className="size-5" />
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <h2 id="own-wallet" className="text-[1.25rem] leading-snug font-semibold text-ink">Connect your NEAR wallet</h2>
          <p className="text-[0.9375rem] text-muted-foreground">Meteor, Intear, Nightly or Ledger · NEAR testnet · via NEAR Connect</p>
        </div>
      </div>
      <p className="text-[0.9375rem] leading-relaxed text-foreground">
        Your wallet is your identity in the chapel. It signs once to vouch for a <strong className="font-semibold">posting key</strong> this browser makes: a
        key that can only post your sealed entry to <code className="font-mono text-[0.8125rem]">{CONTRACT}</code>, and cannot hold or move funds. Nothing
        is spent.
      </p>

      {showStart && (
        <SquareButton onClick={startWallet} disabled={busy} className="w-full">
          <Wallet className="size-4" /> Connect your NEAR wallet
        </SquareButton>
      )}

      <div aria-live="polite" className="flex flex-col gap-4">
        {BUSY[phase.s] && (
          <p className="flex items-start gap-2.5 text-[0.9375rem] text-ink" role="status">
            <Spinner className="mt-1 size-3.5 shrink-0" /> {BUSY[phase.s]}
          </p>
        )}
        {phase.s === "joining" && (
          <p className="flex items-start gap-2.5 text-[0.9375rem] text-ink" role="status">
            <Spinner className="mt-1 size-3.5 shrink-0" /> Signature checked. The chapel is adding your posting key (5 to 20 seconds)…
          </p>
        )}
        {phase.s === "auth-ready" && (
          <div className="flex flex-col gap-3 border-l-2 border-ink bg-band p-4">
            <p className="text-[0.9375rem] text-ink">
              Signed in with NEAR Auth as <code className="font-mono text-[0.8125rem]" title={phase.account.accountId}>{shortAccount(phase.account.accountId)}</code>.
              Approve one statement naming your posting key; it can never run on chain.
            </p>
            <SquareButton onClick={approveNearAuth} className="w-full">Approve with NEAR Auth</SquareButton>
          </div>
        )}
        {phase.s === "cancelled" && (
          <p className="border-l-2 border-ink bg-band px-5 py-3 text-[0.9375rem] text-ink">
            {phase.timedOut ? "The sign-in window timed out." : "Cancelled in the wallet."} Nothing was signed and no key was added.
          </p>
        )}
        {phase.s === "error" && <ErrorState error={phase.error} title="You were not added." onRetry={reset} />}
        {phase.s === "done" && (
          <div className="flex flex-col gap-5 border-t-2 border-ink pt-5">
            <div className="flex items-start gap-3">
              <PassMark pass className="mt-0.5 size-7" />
              <p className="text-[1.0625rem] leading-snug font-semibold text-ink">You're a member of {UNIT_NAME}</p>
            </div>
            <dl className="grid grid-cols-1 gap-4 text-[0.9375rem] sm:grid-cols-2">
              <div className="flex min-w-0 flex-col gap-1">
                <dt><Label>Your wallet</Label></dt>
                <dd className="truncate font-mono text-[0.875rem] text-ink" title={phase.result.account_id}>{shortAccount(phase.result.account_id)}</dd>
              </div>
              <div className="flex flex-col gap-1">
                <dt><Label>Posting key added</Label></dt>
                <dd><TxLink tx={phase.result.tx.hash} /></dd>
              </div>
              {phase.relayTx && (
                <div className="flex flex-col gap-1">
                  <dt><Label>NEAR Auth signature</Label></dt>
                  <dd><TxLink tx={phase.relayTx} /></dd>
                </div>
              )}
              <div className="flex flex-col gap-1 sm:col-span-2">
                <dt><Label>Slot id</Label></dt>
                <dd><HashValue value={phase.result.slot} head={14} tail={8} /></dd>
              </div>
            </dl>
            {phase.result.replaced && (
              <p className="text-[0.875rem] text-muted-foreground">
                This wallet had joined before, so its earlier posting key was revoked
                {phase.result.replaced.tx ? <> (<TxLink tx={phase.result.replaced.tx.hash} />)</> : null}. One key per wallet.
              </p>
            )}
            <CtaButton size="lg" onClick={onEnter}>Enter the chapel</CtaButton>
          </div>
        )}
      </div>

      <details className="text-[0.875rem] leading-relaxed text-muted-foreground">
        <summary className="wipe w-fit cursor-pointer list-none font-medium text-ink">What your wallet signs</summary>
        <p className="mt-2">
          One NEP-413 message, <code className="font-mono break-all">Bandsheet join: ed25519:…</code> (your new posting key), for{" "}
          <code className="font-mono">{CONTRACT}</code> with a single-use nonce. The server checks the signature and that the key is a full-access key of your
          account, then registers the posting key. Later, your wallet signs each entry's hash before it is posted. Which wallet owns which slot stays in
          Bandsheet's private database, never on chain.
        </p>
      </details>

      <p className="border-t border-border pt-4 text-[0.8125rem] leading-relaxed text-muted-foreground">
        {authHere ? (
          <button type="button" onClick={startNearAuth} disabled={busy} className="wipe cursor-pointer font-medium text-ink disabled:opacity-40">
            No wallet? Use email or a passkey (NEAR Auth)
          </button>
        ) : (
          <>Email or passkey sign-in (NEAR Auth) is coming: its shared testnet login only allows <code className="font-mono">localhost:3000</code> until the NEAR Auth team allowlists this site.</>
        )}
      </p>
    </section>
  )
}
