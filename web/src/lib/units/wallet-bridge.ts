import { ApiError } from "@/lib/api"

/** The units layer's one doorway into the shared wallet code (lib/wallet), so the demo's wallet files stay untouched. */
export { WalletCancelled, connectVoter, disconnectVoter, getConnector, restoreVoter, warmWallet } from "@/lib/wallet/near-connect"
export { nonceBytes as nonceBytesOf } from "@/lib/wallet/auth-api"

/** The chain ran the transaction and the contract refused it; the hash still links to nearblocks. */
export class ChainRefused extends ApiError {
  readonly txHash: string | null
  constructor(message: string, txHash: string | null) {
    super(message, "CHAIN_REJECTED")
    this.name = "ChainRefused"
    this.txHash = txHash
  }
}
