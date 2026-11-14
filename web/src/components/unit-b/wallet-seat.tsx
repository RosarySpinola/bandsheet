import { useEffect, useState } from "react"
import type { NearWalletBase } from "@hot-labs/near-connect"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Wallet } from "lucide-react"
import { Spinner } from "@/components/ui/spinner"
import { ErrorState, SquareButton, TxLink } from "@/components/unit"
import { DAO } from "@/lib/chain"
import { councilMembers, readProposal, voteFromWallet } from "@/lib/wallet/dao-seat"
import { shortAccount } from "@/lib/wallet/identity"
import { WalletCancelled, connectVoter, disconnectVoter, restoreVoter } from "@/lib/wallet/near-connect"
import type { DaoProposal } from "./data"
import { describeQuery } from "./format"

type Conn = { wallet: NearWalletBase; accountId: string }
type Voting = { id: number; action: "VoteApprove" | "VoteReject" } | null
type Outcome = { id: number; tx: string | null; status: string } | { id: number; error: unknown } | null

/**
 * A council seat votes from its own wallet (NEAR Connect, testnet). The seat list comes from the DAO's
 * get_policy "council" role; the wallet signs act_proposal; the proposal is read back from the chain.
 */
export function WalletSeat({ proposals }: { proposals: DaoProposal[] }) {
  const qc = useQueryClient()
  const [conn, setConn] = useState<Conn | null>(null)
  const [connecting, setConnecting] = useState(false)
  const [connErr, setConnErr] = useState<unknown>(null)
  const [cancelled, setCancelled] = useState(false)
  const [voting, setVoting] = useState<Voting>(null)
  const [outcome, setOutcome] = useState<Outcome>(null)
  const council = useQuery({ queryKey: ["dao", "council"], queryFn: councilMembers, staleTime: 60_000, enabled: conn !== null })

  useEffect(() => {
    void restoreVoter().then((c) => c && setConn(c)).catch(() => undefined)
  }, [])

  const connect = () => {
    setConnecting(true)
    setConnErr(null)
    setCancelled(false)
    connectVoter()
      .then(setConn)
      .catch((e) => (e instanceof WalletCancelled ? setCancelled(true) : setConnErr(e)))
      .finally(() => setConnecting(false))
  }
  const disconnect = () => {
    void disconnectVoter()
    setConn(null)
    setOutcome(null)
  }
  const vote = (id: number, action: "VoteApprove" | "VoteReject") => {
    const before = chainOpen.data?.find((p) => p.id === id)
    if (!conn || !before) return
    // Synchronous in the tap: the proposal was read beforehand, so the wallet's tab opens without being blocked.
    const sending = voteFromWallet(conn.wallet, conn.accountId, before, action)
    setVoting({ id, action })
    setOutcome(null)
    sending
      .then((r) => {
        setOutcome({ id, tx: r.txHash, status: r.status })
        void qc.invalidateQueries({ queryKey: ["dao", "release-proposals"] })
        void chainOpen.refetch()
      })
      .catch((error) => setOutcome(error instanceof WalletCancelled ? null : { id, error }))
      .finally(() => setVoting(null))
  }

  const open = proposals.filter((p) => p.status === "InProgress")
  const seat = conn && council.data ? council.data.includes(conn.accountId) : null
  // Read each open proposal (its kind) ahead of the tap.
  const chainOpen = useQuery({
    queryKey: ["dao", "open-proposals", open.map((p) => p.id).join(",")],
    queryFn: () => Promise.all(open.map((p) => readProposal(p.id))),
    enabled: seat === true && open.length > 0,
    staleTime: 15_000,
  })

  return (
    <section aria-labelledby="wallet-seat" className="-mt-4 flex flex-col gap-4 border-b border-border pb-6 md:-mt-8">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 id="wallet-seat" className="text-[1rem] font-semibold text-ink">Hold a council seat? Vote from your own wallet.</h2>
          <p className="text-[0.9375rem] text-muted-foreground">
            {conn ? <>Connected as <code className="font-mono text-[0.875rem]" title={conn.accountId}>{shortAccount(conn.accountId)}</code> through NEAR Connect (testnet).</> : "NEAR Connect, testnet. The seat buttons below are the demo's server-held council keys."}
          </p>
        </div>
        {conn ? (
          <button type="button" onClick={disconnect} className="wipe cursor-pointer text-[0.9375rem] text-muted-foreground hover:text-ink">Disconnect</button>
        ) : (
          <SquareButton variant="line" onClick={connect} disabled={connecting} className="w-full sm:w-auto">
            {connecting ? <Spinner className="size-4" /> : <Wallet className="size-4" />} {connecting ? "Choose a wallet…" : "Connect wallet"}
          </SquareButton>
        )}
      </div>

      {cancelled && <p className="text-[0.9375rem] text-muted-foreground">Cancelled. No wallet was connected.</p>}
      {connErr !== null && <ErrorState error={connErr} title="The wallet did not connect." onRetry={connect} />}

      {conn && council.isPending && (
        <p className="flex items-center gap-2 text-[0.9375rem] text-ink" role="status"><Spinner className="size-3.5" /> Reading the council from {DAO}…</p>
      )}
      {conn && council.isError && <ErrorState error={council.error} title="The DAO's council could not be read." onRetry={() => void council.refetch()} />}
      {seat === false && (
        <p className="border-l-2 border-ink bg-lav-soft px-5 py-3 text-[0.9375rem] text-ink">
          This account holds no seat on the chapel council. Only the three council accounts in the DAO's policy can vote; you can still read every proposal below.
        </p>
      )}
      {seat === true && (
        <div className="flex flex-col gap-3">
          <p className="text-[0.9375rem] text-ink">This account holds a council seat. Open proposals:</p>
          {open.length === 0 && <p className="text-[0.9375rem] text-muted-foreground">No open proposals right now.</p>}
          {open.map((p) => {
            const busy = voting?.id === p.id
            const out = outcome?.id === p.id ? outcome : null
            return (
              <div key={p.id} className="flex flex-col gap-2 border-l-2 border-ink bg-band px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="min-w-0 text-[0.9375rem] text-ink">
                    <span className="gl-num">#{p.id}</span> {p.kind === "release" ? describeQuery(p.query) : (p.summary ?? p.description)}
                  </span>
                  {busy ? (
                    <span className="flex items-center gap-2 text-[0.9375rem] text-ink" role="status"><Spinner className="size-3.5" /> Confirm in your wallet…</span>
                  ) : (
                    <span className="flex items-center gap-4">
                      <button type="button" disabled={voting !== null || !chainOpen.data} onClick={() => vote(p.id, "VoteApprove")} className="wipe cursor-pointer text-[0.9375rem] font-semibold text-ink disabled:opacity-40">Approve</button>
                      <button type="button" disabled={voting !== null || !chainOpen.data} onClick={() => vote(p.id, "VoteReject")} className="wipe cursor-pointer text-[0.9375rem] text-muted-foreground hover:text-ink disabled:opacity-40">Reject</button>
                    </span>
                  )}
                </div>
                {out && "status" in out && (
                  <p className="text-[0.875rem] text-foreground">Vote sent{out.tx ? <> (<TxLink tx={out.tx} />)</> : null}. The chain now says: <strong>{out.status}</strong>.</p>
                )}
                {out && "error" in out && <ErrorState error={out.error} title="The vote was not recorded." />}
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
