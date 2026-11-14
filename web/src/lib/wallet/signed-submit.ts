import type { Ciphertext } from "@bandsheet/core"
import type { Invite } from "@bandsheet/core/near"
import { ApiError } from "@/lib/api"
import { postWalletEntry, sha256Hex, type WalletEntry } from "./auth-api"
import type { Identity } from "./identity"
import { WalletCancelled, prepareStatement, type PreparedStatement } from "./near-connect"

/** Everything a wallet-signed entry needs before the tap: the posting key's unsent submit and a loaded wallet call. */
export type PreparedEntry = { signedTxB64: string; hash: string; statement: PreparedStatement; who: Identity }

/**
 * Step 1, right after sealing (no tap needed): the posting key signs `submit(ciphertext)` in this browser but does not
 * send it, and the wallet call for "Bandsheet entry: <sha256 of the ciphertext JSON>" is prepared.
 */
export async function prepareWalletEntry(invite: Invite, sealed: Ciphertext, who: Identity): Promise<PreparedEntry> {
  if (!who.wallet_id) throw new ApiError("Reconnect your wallet on the join page, then send again.", "WALLET_NOT_CONNECTED")
  const near = await import("@bandsheet/core/near")
  const { signedTxB64, ctText } = await near.signSubmitTx(invite, sealed)
  const hash = await sha256Hex(ctText)
  const statement = await prepareStatement(who.wallet_id, "entry", hash, who.account_id)
  return { signedTxB64, hash, statement, who }
}

/**
 * Step 2, on the tap: the wallet call starts synchronously (so a web wallet's tab is not blocked), then the server
 * verifies the signature and only then broadcasts the posting key's transaction and records the binding.
 * If the wallet refuses, nothing is posted.
 */
export function signAndPostWalletEntry(p: PreparedEntry, onPosting: () => void): Promise<WalletEntry> {
  const signing = p.statement.sign()
  return signing.then(
    (claim) => {
      if (claim.account_id !== p.who.account_id) {
        throw new ApiError(`The wallet signed as ${claim.account_id}, not ${p.who.account_id}. Nothing was posted.`, "WRONG_ACCOUNT")
      }
      onPosting()
      return postWalletEntry(claim, p.signedTxB64, p.who.method)
    },
    (e) => {
      if (e instanceof WalletCancelled) throw new ApiError("Your wallet did not sign, so nothing was posted.", "WALLET_REFUSED")
      throw e
    },
  )
}
