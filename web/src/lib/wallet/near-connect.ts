import type { NearConnector, NearWalletBase } from "@hot-labs/near-connect"
import { ApiError } from "@/lib/api"
import { CONTRACT } from "@/lib/chain"
import { getNonce, nonceBytes, statementText, type Purpose, type SignedClaim } from "./auth-api"
import { EVM_WALLET, evmPersonalSign, evmStatement } from "./evm"
import { TX_RPCS } from "@/lib/rpc"

/**
 * NEAR Connect (@hot-labs/near-connect) on testnet. Wallet code runs in sandboxed iframes loaded from the shared
 * manifest; every testnet wallet in it is offered. NEAR wallets sign NEP-413. The Ethereum Wallets executor has no
 * signMessage, so after it signs in (its 0x account) the same Ethereum wallet signs the statement with personal_sign.
 */
const RPCS = TX_RPCS

let connector: Promise<NearConnector> | null = null

export function getConnector(): Promise<NearConnector> {
  connector ??= import("@hot-labs/near-connect").then(
    ({ NearConnector }) => new NearConnector({ network: "testnet", features: { testnet: true }, providers: { testnet: RPCS } }),
  )
  return connector
}

/** Is this account id on testnet? Mainnet names end in .near; implicit (64 hex) and 0x ids are network-neutral. */
export const isTestnetAccount = (id: string) => id.endsWith(".testnet") || /^[0-9a-f]{64}$/.test(id) || /^0x[0-9a-f]{40}$/i.test(id)

export class WalletCancelled extends Error {
  constructor() {
    super("Cancelled in the wallet. Nothing was signed.")
    this.name = "WalletCancelled"
  }
}

const cancelled = (e: unknown) => /reject|cancel|closed|denied|user/i.test(e instanceof Error ? e.message : String(e))

/** Join: pick any testnet wallet; it signs the join statement (NEP-413, or EIP-191 for an Ethereum wallet). */
export async function walletJoinClaim(memberPublicKey: string): Promise<SignedClaim & { walletId: string }> {
  const [c, issued] = await Promise.all([getConnector(), getNonce("join")])
  if (issued.recipient !== CONTRACT) throw new ApiError("The server named a different contract.", "RECIPIENT_MISMATCH")
  let walletId: string
  try {
    walletId = await c.selectWallet({})
  } catch (e) {
    throw cancelled(e) ? new WalletCancelled() : e
  }
  if (walletId === EVM_WALLET) {
    let accountId: string | undefined
    try {
      const wallet = await c.connect({ walletId })
      accountId = (await wallet.getAccounts({ network: "testnet" }))[0]?.accountId?.toLowerCase()
    } catch (e) {
      throw cancelled(e) ? new WalletCancelled() : e
    }
    if (!accountId) throw new ApiError("The Ethereum wallet returned no account.", "WALLET_NO_ACCOUNT")
    const signature = await evmPersonalSign(accountId, evmStatement("join", memberPublicKey, CONTRACT, issued.nonce))
    return { scheme: "eip191", account_id: accountId, signature, nonce: issued.nonce, walletId }
  }
  const got = new Promise<{ accountId: string; publicKey: string; signature: string; walletId: string }>((resolve, reject) => {
    c.once("wallet:signInAndSignMessage", (e) => {
      const a = e.accounts[0]
      if (!a?.signedMessage) return reject(new ApiError("The wallet did not return a signed message.", "WALLET_NO_SIGNATURE"))
      resolve({ ...a.signedMessage, walletId: e.wallet.manifest.id })
    })
  })
  try {
    await c.connect({ walletId, signMessageParams: { message: statementText("join", memberPublicKey), recipient: CONTRACT, nonce: nonceBytes(issued.nonce) } })
  } catch (e) {
    c.removeAllListeners("wallet:signInAndSignMessage")
    throw cancelled(e) ? new WalletCancelled() : e
  }
  const s = await got
  return checked({ scheme: "nep413", account_id: s.accountId, public_key: s.publicKey, signature: s.signature, nonce: issued.nonce }, s.walletId)
}

/** Entry signing: the member's wallet signs "Bandsheet entry: <hash>" (NEP-413, or EIP-191 for an Ethereum wallet). */
export async function walletSignStatement(walletId: string, purpose: Purpose, subject: string, accountId: string): Promise<SignedClaim> {
  const [c, issued] = await Promise.all([getConnector(), getNonce(purpose)])
  if (walletId === EVM_WALLET) {
    const signature = await evmPersonalSign(accountId, evmStatement(purpose, subject, CONTRACT, issued.nonce))
    return { scheme: "eip191", account_id: accountId, signature, nonce: issued.nonce }
  }
  const wallet = await c.wallet(walletId)
  try {
    const s = await wallet.signMessage({ message: statementText(purpose, subject), recipient: CONTRACT, nonce: nonceBytes(issued.nonce), network: "testnet", signerId: accountId })
    return checked({ scheme: "nep413", account_id: s.accountId, public_key: s.publicKey, signature: s.signature, nonce: issued.nonce }, walletId)
  } catch (e) {
    throw cancelled(e) ? new WalletCancelled() : e
  }
}

function checked<T extends SignedClaim>(claim: T, walletId: string): T & { walletId: string } {
  if (!isTestnetAccount(claim.account_id)) {
    throw new ApiError(`The wallet signed as ${claim.account_id}, a mainnet account. Switch the wallet to NEAR testnet and try again.`, "WRONG_NETWORK")
  }
  return { ...claim, walletId }
}

/** Vote page: connect any testnet wallet that can send transactions. */
export async function connectVoter(): Promise<{ wallet: NearWalletBase; accountId: string }> {
  const c = await getConnector()
  let wallet: NearWalletBase
  try {
    wallet = await c.connect()
  } catch (e) {
    throw cancelled(e) ? new WalletCancelled() : e
  }
  const accounts = await wallet.getAccounts({ network: "testnet" })
  const accountId = accounts[0]?.accountId
  if (!accountId) throw new ApiError("The wallet returned no account.", "WALLET_NO_ACCOUNT")
  return { wallet, accountId }
}

/** The wallet already connected in this browser, if any (NEAR Connect remembers the choice). */
export async function restoreVoter(): Promise<{ wallet: NearWalletBase; accountId: string } | null> {
  const c = await getConnector()
  try {
    const { wallet, accounts } = await c.getConnectedWallet()
    return accounts[0] ? { wallet, accountId: accounts[0].accountId } : null
  } catch {
    return null
  }
}

export async function disconnectVoter(): Promise<void> {
  const c = await getConnector()
  await c.disconnect().catch(() => undefined)
}
