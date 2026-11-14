import { Wallet } from "lucide-react"
import { Spinner } from "@/components/ui/spinner"
import { CONTRACT } from "@/lib/chain"
import { shortAccount } from "@/lib/wallet/identity"
import { HashValue } from "../copy-button"
import { CtaButton, SquareButton, TxLink } from "../links"
import { UNIT_NAME } from "../nav"
import { ErrorState } from "../states"
import { PassMark } from "../verified-panel"
import { useAccountJoin, type JoinPhase } from "./use-account-join"

const BUSY: Partial<Record<JoinPhase["s"], string>> = {
  wallet: "Choose your wallet in the NEAR Connect window and approve the signature…",
}

const Label = ({ children }: { children: string }) => (
  <span className="text-[0.8125rem] font-medium tracking-[0.02em] text-muted-foreground uppercase">{children}</span>
)

/** The way in: the member's own wallet through NEAR Connect (NEAR wallets, or an Ethereum wallet). */
export function SignInOptions({ onEnter }: { onEnter: () => void }) {
  const { phase, startWallet, reset } = useAccountJoin()
  const busy = phase.s in BUSY || phase.s === "joining"
  const showStart = phase.s === "idle" || phase.s === "cancelled" || phase.s === "error"

  return (
    <section aria-labelledby="own-wallet" className="flex flex-col gap-5 border-2 border-ink bg-white p-6 md:p-8">
      <div className="flex items-start gap-4">
        <span className="grid size-11 shrink-0 place-items-center bg-ink text-white">
          <Wallet className="size-5" />
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <h2 id="own-wallet" className="text-[1.25rem] leading-snug font-semibold text-ink">Connect your NEAR wallet</h2>
          <p className="text-[0.9375rem] text-muted-foreground">Meteor, Intear, Nightly, Ledger, NEAR CLI or an Ethereum wallet (MetaMask) · NEAR testnet · via NEAR Connect</p>
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
        {phase.s === "cancelled" && (
          <p className="border-l-2 border-ink bg-band px-5 py-3 text-[0.9375rem] text-ink">
            Cancelled in the wallet. Nothing was signed and no key was added.
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
          One message, <code className="font-mono break-all">Bandsheet join: ed25519:…</code> (your new posting key), for{" "}
          <code className="font-mono">{CONTRACT}</code> with a single-use nonce: NEP-413 from a NEAR wallet, or EIP-191 personal_sign from an
          Ethereum wallet. The server checks the signature (and, for NEAR, that the key is a full-access key of your account), then registers the
          posting key. Later, your wallet signs each entry's hash before it is posted. Which wallet owns which slot stays in
          Bandsheet's private database, never on chain.
        </p>
      </details>

    </section>
  )
}
