import type { Ciphertext } from "@bandsheet/core"
import type { Invite } from "@bandsheet/core/near"
import { ApiError } from "@/lib/api"
import { postWalletEntry, sha256Hex, type WalletEntry } from "./auth-api"
import type { Identity } from "./identity"
import { WalletCancelled, walletSignStatement } from "./near-connect"

export type SignedSubmitStage = "preparing" | "wallet" | "posting"

/**
 * A wallet member's submit, in one flow:
 *  1. the posting key signs `submit(ciphertext)` in this browser, but it is not sent;
 *  2. the member's wallet signs NEP-413 "Bandsheet entry: <sha256 of the ciphertext JSON>" (required);
 *  3. the server verifies that signature, then broadcasts the posting key's transaction and records the binding.
 * If the wallet refuses, nothing is posted. On chain the entry is signed by the unit's posting key, never the wallet.
 */
export async function walletSignedSubmit(
  invite: Invite,
  sealed: Ciphertext,
  who: Identity,
  onStage: (s: SignedSubmitStage) => void,
): Promise<WalletEntry> {
  if (!who.wallet_id) throw new ApiError("Reconnect your wallet on the join page, then send again.", "WALLET_NOT_CONNECTED")
  onStage("preparing")
  const near = await import("@bandsheet/core/near")
  const { signedTxB64, ctText } = await near.signSubmitTx(invite, sealed)
  const hash = await sha256Hex(ctText)
  onStage("wallet")
  let claim
  try {
    claim = await walletSignStatement(who.wallet_id, "entry", hash, who.account_id)
  } catch (e) {
    if (e instanceof WalletCancelled) throw new ApiError("Your wallet did not sign, so nothing was posted.", "WALLET_REFUSED")
    throw e
  }
  if (claim.account_id !== who.account_id) {
    throw new ApiError(`The wallet signed as ${claim.account_id}, not ${who.account_id}. Nothing was posted.`, "WRONG_ACCOUNT")
  }
  onStage("posting")
  return postWalletEntry(claim, signedTxB64, who.method)
}
