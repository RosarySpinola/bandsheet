import { useCallback, useEffect, useState } from "react"
import { CONTRACT } from "@/lib/chain"
import { joinWithAccount, type JoinResult, type SignedClaim } from "@/lib/wallet/auth-api"
import { setIdentity } from "@/lib/wallet/identity"
import { WalletCancelled, getConnector, walletJoinClaim } from "@/lib/wallet/near-connect"
import { nearLib } from "../key-check"
import { setMember } from "../session"

type PostingKey = { privateKey: string; publicKey: string; slot: string }

export type JoinPhase =
  | { s: "idle" }
  | { s: "wallet" }
  | { s: "joining"; account: string }
  | { s: "done"; result: JoinResult }
  | { s: "cancelled" }
  | { s: "error"; error: unknown }

/**
 * Join with the member's own wallet (NEAR Connect). The browser makes a posting key (it never leaves this tab); the
 * wallet signs one statement naming that key (NEP-413, or EIP-191 for an Ethereum wallet); the server checks it and
 * registers the posting key on the unit.
 */
export function useAccountJoin() {
  const [phase, setPhase] = useState<JoinPhase>({ s: "idle" })

  // Load NEAR Connect and its wallet manifest early, so the modal opens straight from the click.
  useEffect(() => {
    void getConnector().catch(() => undefined)
  }, [])

  const finish = useCallback(async (claim: SignedClaim & { walletId: string }, k: PostingKey) => {
    setPhase({ s: "joining", account: claim.account_id })
    const result = await joinWithAccount(claim, k.publicKey, "near-connect")
    setMember({ invite: { account_id: CONTRACT, contract_id: CONTRACT, private_key: k.privateKey }, slot: result.slot, publicKey: k.publicKey, demo: false, joinedAt: Date.now() })
    setIdentity({ account_id: result.account_id, method: "near-connect", public_key: claim.public_key ?? "", wallet_id: claim.walletId, slot: result.slot })
    setPhase({ s: "done", result })
  }, [])

  const startWallet = useCallback(() => {
    setPhase({ s: "wallet" })
    void (async () => {
      try {
        const k = (await nearLib()).generateMemberKey()
        await finish(await walletJoinClaim(k.publicKey), k)
      } catch (e) {
        setPhase(e instanceof WalletCancelled ? { s: "cancelled" } : { s: "error", error: e })
      }
    })()
  }, [finish])

  const reset = useCallback(() => setPhase({ s: "idle" }), [])
  return { phase, startWallet, reset }
}
