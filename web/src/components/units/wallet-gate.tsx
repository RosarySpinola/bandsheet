import type { ReactNode } from "react"
import { Fuel, Wallet } from "lucide-react"
import { Spinner } from "@/components/ui/spinner"
import { ErrorState, SquareButton, TxLink } from "@/components/unit"
import { cn } from "@/lib/utils"
import { SPONSOR_AMOUNT_NEAR, SPONSOR_THRESHOLD_NEAR, isMock, type Conn } from "@/lib/units"
import { useGas, type GasState } from "@/lib/units/hooks"
import { connectWallet, useWallet } from "@/lib/units/wallet-store"

/**
 * Renders children with the connected wallet, or a designed "connect your wallet" panel. Reading a unit never needs
 * a wallet; acting in one does.
 */
export function WalletGate({ children, title, body, className }: { children: (conn: Conn) => ReactNode; title?: string; body?: string; className?: string }) {
  const w = useWallet()
  if (w.status === "connected") return <>{children(w.conn)}</>
  const busy = w.status === "connecting" || w.status === "restoring"
  return (
    <div className={cn("flex flex-col gap-5 bg-band p-6 md:p-8", className)}>
      <div className="flex items-start gap-4">
        <span className="grid size-11 shrink-0 place-items-center bg-ink text-white">
          <Wallet className="size-5" />
        </span>
        <div className="flex flex-col gap-1.5">
          <p className="text-[1.125rem] font-semibold text-ink">{title ?? "Connect your NEAR wallet"}</p>
          <p className="max-w-[36rem] text-[0.9375rem] leading-relaxed text-foreground">
            {body ?? "Any NEAR testnet wallet works: Meteor, Intear, HOT, NEAR CLI and more. If your account holds no testnet NEAR, Bandsheet sends it a little for gas."}
          </p>
        </div>
      </div>
      <SquareButton onClick={connectWallet} disabled={busy} className="w-full sm:w-fit">
        {busy ? <Spinner className="size-4" /> : <Wallet className="size-4" />}
        {w.status === "connecting" ? "Choose a wallet…" : w.status === "restoring" ? "Checking for a connected wallet…" : isMock() ? "Connect the mock wallet" : "Connect wallet"}
      </SquareButton>
      {w.status === "idle" && w.note === "cancelled" && <p className="text-[0.9375rem] text-muted-foreground">Cancelled. No wallet was connected.</p>}
      {w.status === "error" && <ErrorState error={w.error} title="The wallet did not connect." onRetry={connectWallet} className="bg-white" />}
    </div>
  )
}

/** The gas line: checking, sending 0.05 testnet NEAR, sent (with its tx), or why it could not. */
export function GasNotice({ gas, className }: { gas: GasState; className?: string }) {
  const base = cn("flex items-start gap-3 border-l-2 px-5 py-3 text-[0.9375rem] leading-relaxed", className)
  if (gas.status === "none" || gas.status === "ok") return null
  if (gas.status === "checking")
    return (
      <p className={cn(base, "border-border text-muted-foreground")} role="status">
        <Spinner className="mt-1 size-3.5" /> Checking your testnet balance for gas…
      </p>
    )
  if (gas.status === "sponsoring")
    return (
      <p className={cn(base, "border-ink bg-lav-soft text-ink")} role="status">
        <Spinner className="mt-1 size-3.5" />
        <span>
          Your wallet holds under {SPONSOR_THRESHOLD_NEAR} testnet NEAR, so Bandsheet is sending it {SPONSOR_AMOUNT_NEAR} for gas. One moment…
        </span>
      </p>
    )
  if (gas.status === "sponsored")
    return (
      <p className={cn(base, "border-ink bg-band text-ink")} role="status">
        <Fuel className="mt-0.5 size-4 shrink-0" />
        <span>
          We sent your wallet {SPONSOR_AMOUNT_NEAR} testnet NEAR for gas.{gas.tx?.hash ? <> <TxLink tx={gas.tx.hash} className="text-[0.9375rem]" /></> : null}
          {isMock() && <span className="text-muted-foreground"> (mock)</span>}
        </span>
      </p>
    )
  return (
    <p className={cn(base, "border-border bg-band text-foreground")} role="status">
      <Fuel className="mt-0.5 size-4 shrink-0" />
      <span>
        {gas.during === "balance"
          ? "Your testnet balance could not be read just now. If the wallet has no NEAR for gas, the transaction will say so."
          : "Bandsheet could not send gas just now (it sends once per account). If your wallet holds testnet NEAR, carry on; otherwise try the testnet faucet."}
      </span>
    </p>
  )
}

/** Wallet + gas in one: children get the connection once gas is sorted (or known not to be needed). */
export function ReadyWallet({ children, ...gate }: { children: (conn: Conn, gasReady: boolean) => ReactNode; title?: string; body?: string; className?: string }) {
  return <WalletGate {...gate}>{(conn) => <WithGas conn={conn}>{children}</WithGas>}</WalletGate>
}

function WithGas({ conn, children }: { conn: Conn; children: (conn: Conn, gasReady: boolean) => ReactNode }) {
  const gas = useGas(conn.accountId)
  return (
    <div className="flex flex-col gap-4">
      <GasNotice gas={gas} />
      {children(conn, gas.ready)}
    </div>
  )
}
