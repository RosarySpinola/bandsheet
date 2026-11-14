import { useCallback, useEffect, useState } from "react"
import { CONTRACT } from "@/lib/chain"
import { joinWithAccount, type JoinResult, type Method } from "@/lib/wallet/auth-api"
import { setIdentity } from "@/lib/wallet/identity"
import { approveStatement, nearAuthLogin, preloadNearAuth, prepareStatement, type NearAuthAccount, type PreparedStatement } from "@/lib/wallet/near-auth"
import { WalletCancelled, getConnector, walletJoinClaim } from "@/lib/wallet/near-connect"
import { nearLib } from "../key-check"
import { setMember } from "../session"

type MemberKey = { privateKey: string; publicKey: string; slot: string }

export type JoinPhase =
  | { s: "idle" }
  | { s: "auth-login" }
  | { s: "auth-preparing"; account: NearAuthAccount }
  | { s: "auth-ready"; account: NearAuthAccount; prepared: PreparedStatement }
  | { s: "auth-approving"; account: NearAuthAccount }
  | { s: "wallet" }
  | { s: "joining"; via: Method; account: string }
  | { s: "done"; via: Method; result: JoinResult }
  | { s: "cancelled"; via: Method }
  | { s: "error"; via: Method; error: unknown }

const newKey = async (): Promise<MemberKey> => (await nearLib()).generateMemberKey()

/**
 * Join with a NEAR account. The browser makes the member key (it never leaves this tab); the account signs one
 * statement naming that key; the server checks it and registers the key on the unit. Two routes:
 *  - NEAR Auth: Auth0 login popup, then a consent popup for the statement (each straight from a click);
 *  - NEAR Connect: the wallet modal signs in and signs the NEP-413 statement in one step.
 */
export function useAccountJoin() {
  const [phase, setPhase] = useState<JoinPhase>({ s: "idle" })
  const [key, setKey] = useState<MemberKey | null>(null)

  // Load the SDKs early so the popups open inside the click and are not blocked.
  useEffect(() => {
    void preloadNearAuth().catch(() => undefined)
    void getConnector().catch(() => undefined)
  }, [])

  const finish = useCallback(async (via: Method, account: string, claim: Parameters<typeof joinWithAccount>[0], k: MemberKey, walletId?: string) => {
    setPhase({ s: "joining", via, account })
    const result = await joinWithAccount(claim, k.publicKey, via)
    setMember({ invite: { account_id: CONTRACT, contract_id: CONTRACT, private_key: k.privateKey }, slot: result.slot, publicKey: k.publicKey, demo: false, joinedAt: Date.now() })
    setIdentity({ account_id: result.account_id, method: via, public_key: claim.public_key, wallet_id: walletId, slot: result.slot })
    setPhase({ s: "done", via, result })
  }, [])

  /** Closing a popup or declining in the wallet is a cancel, not an error; a blocked popup stays an error. */
  const fail = (via: Method, error: unknown) => {
    const msg = String((error as Error)?.message ?? error)
    const cancel = error instanceof WalletCancelled || /popup closed|cancelled|user rejected|access_denied|timeout/i.test(msg)
    setPhase(cancel ? { s: "cancelled", via } : { s: "error", via, error })
  }

  /** Step 1 of NEAR Auth: sign in (popup), then prepare the statement for the approve click. */
  const startNearAuth = useCallback(() => {
    setPhase({ s: "auth-login" })
    nearAuthLogin()
      .then(async (account) => {
        setPhase({ s: "auth-preparing", account })
        const k = await newKey()
        setKey(k)
        const prepared = await prepareStatement("join", k.publicKey, account)
        setPhase({ s: "auth-ready", account, prepared })
      })
      .catch((e) => fail("near-auth", e))
  }, [])

  /** Step 2 of NEAR Auth: approve the statement (consent popup), relay it, then join. */
  const approveNearAuth = useCallback(() => {
    if (phase.s !== "auth-ready" || !key) return
    const { account, prepared } = phase
    setPhase({ s: "auth-approving", account })
    approveStatement(prepared)
      .then((claim) => finish("near-auth", account.accountId, claim, key))
      .catch((e) => fail("near-auth", e))
  }, [phase, key, finish])

  const startWallet = useCallback(() => {
    setPhase({ s: "wallet" })
    void (async () => {
      try {
        const k = await newKey()
        setKey(k)
        const claim = await walletJoinClaim(k.publicKey)
        await finish("near-connect", claim.account_id, claim, k, claim.walletId)
      } catch (e) {
        fail("near-connect", e)
      }
    })()
  }, [finish])

  const reset = useCallback(() => setPhase({ s: "idle" }), [])
  return { phase, startNearAuth, approveNearAuth, startWallet, reset }
}
