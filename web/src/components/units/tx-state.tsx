import type { ReactNode } from "react"
import { Check, Wallet } from "lucide-react"
import { Spinner } from "@/components/ui/spinner"
import { ErrorState, TxLink } from "@/components/unit"
import { WebWalletTip } from "@/components/unit/web-wallet-tip"
import { plainError } from "@/lib/api"
import { cn } from "@/lib/utils"
import { isMock } from "@/lib/units"
import type { TapPhase } from "@/lib/units/use-tap"
import { ChainRefused } from "@/lib/units/wallet-bridge"

const RPC_CODES = new Set(["CHAIN_READ", "NETWORK", "SERVER_DOWN"])

/** Which way a wallet action failed: the person declined, the contract refused, or the network did not answer. */
export function failureKind(error: unknown): "chain" | "rpc" | "other" {
  if (error instanceof ChainRefused || plainError(error).code === "CHAIN_REJECTED") return "chain"
  if (RPC_CODES.has(plainError(error).code) || /fetch|network|timeout|429|503/i.test(String((error as Error)?.message ?? ""))) return "rpc"
  return "other"
}

type Words = { busy?: string; posting?: string; done?: ReactNode; what?: string; errors?: Record<string, ReactNode> }

/**
 * The life of one wallet action, in place under its button: getting ready, approve in the wallet, landing, landed with
 * a nearblocks link; or declined, refused by the contract (with the tx), or the network down. Every state is designed.
 */
export function TxState<R>({ phase, words = {}, tx, onRetry, onRetryPrepare, className }: {
  phase: TapPhase<R>
  words?: Words
  tx?: string | null
  onRetry?: () => void
  onRetryPrepare?: () => void
  className?: string
}) {
  const what = words.what ?? "the transaction"
  const line = "flex items-start gap-3 border-l-2 px-5 py-4 text-[0.9375rem] leading-relaxed"
  return (
    <div aria-live="polite" className={cn("flex flex-col gap-3", className)}>
      {phase.s === "preparing" && (
        <p className={cn(line, "border-border text-muted-foreground")}>
          <Spinner className="mt-1 size-3.5" /> Getting your wallet ready, so it opens the moment you tap.
        </p>
      )}
      {phase.s === "busy" && phase.stage === "wallet" && (
        <div className={cn(line, "flex-col border-ink bg-lav-soft text-ink")}>
          <span className="flex items-center gap-3 font-semibold">
            <Wallet className="size-4" /> {words.busy ?? "Approve in your wallet…"}
          </span>
          <span className="text-foreground">
            {isMock() ? "Mock wallet: approving automatically in a moment." : `Your wallet shows ${what} for you to approve. Once approved, it lands on NEAR testnet in a few seconds.`}
          </span>
          {!isMock() && <WebWalletTip />}
        </div>
      )}
      {phase.s === "busy" && phase.stage === "posting" && (
        <p className={cn(line, "border-ink bg-band text-ink")}>
          <Spinner className="mt-1 size-3.5" /> {words.posting ?? "Signed. Sending it to NEAR testnet…"}
        </p>
      )}
      {phase.s === "done" && (
        <div className={cn(line, "border-ink bg-band text-ink")}>
          <span className="grid size-6 shrink-0 place-items-center bg-ink text-white">
            <Check className="size-4" strokeWidth={2.5} />
          </span>
          <span className="flex flex-col gap-1">
            <span className="font-semibold">{words.done ?? "Landed on NEAR testnet."}</span>
            {tx ? (
              <span className="text-foreground">
                Transaction <TxLink tx={tx} className="text-[0.9375rem]" /> {isMock() && <span className="text-muted-foreground">(mock hash, not on chain)</span>}
              </span>
            ) : null}
          </span>
        </div>
      )}
      {phase.s === "rejected" && (
        <div className={cn(line, "flex-col border-ink bg-band text-ink")}>
          <span className="font-semibold">You declined in your wallet. Nothing was signed or sent.</span>
          {onRetry && (
            <button type="button" onClick={onRetry} className="wipe w-fit cursor-pointer font-semibold">
              Try again
            </button>
          )}
        </div>
      )}
      {phase.s === "error" && <TxError error={phase.error} onRetry={onRetry} what={what} titles={words.errors} />}
      {phase.s === "unprepared" && <ErrorState error={phase.error} title="Your wallet could not be made ready for this." onRetry={onRetryPrepare} />}
    </div>
  )
}

export function TxError({ error, onRetry, what = "the transaction", titles }: { error: unknown; onRetry?: () => void; what?: string; titles?: Record<string, ReactNode> }) {
  const special = titles?.[plainError(error).code]
  if (special)
    return (
      <div role="alert" className="flex flex-col gap-2 border-l-2 border-ink bg-lav-soft px-6 py-5">
        <p className="text-[1.0625rem] leading-snug font-semibold text-ink">{special}</p>
        <p className="text-[0.8125rem] text-muted-foreground">
          <code className="font-mono">{plainError(error).code}</code> · {error instanceof Error ? error.message : String(error)}
        </p>
      </div>
    )
  const kind = failureKind(error)
  if (kind === "chain") {
    const hash = error instanceof ChainRefused ? error.txHash : null
    const why = error instanceof Error ? error.message : String(error)
    return (
      <div role="alert" className="flex flex-col gap-2.5 border-l-2 border-ink bg-lav-soft px-6 py-5">
        <p className="text-[1.0625rem] leading-snug font-semibold text-ink">The contract refused {what}.</p>
        <p className="text-[0.9375rem] text-foreground">{why.charAt(0).toUpperCase() + why.slice(1)}</p>
        {hash && (
          <p className="text-[0.9375rem] text-foreground">
            The chain recorded the refusal: <TxLink tx={hash} />
            {isMock() && <span className="text-muted-foreground"> (mock hash)</span>}
          </p>
        )}
        {onRetry && (
          <button type="button" onClick={onRetry} className="wipe w-fit cursor-pointer text-[0.9375rem] font-semibold text-ink">
            Try again
          </button>
        )}
      </div>
    )
  }
  if (kind === "rpc") return <ErrorState error={error} title="NEAR testnet did not answer. Nothing was changed." onRetry={onRetry} />
  return <ErrorState error={error} onRetry={onRetry} />
}
