import { ApiError } from "@/lib/api"
import { statementText, type Purpose } from "./auth-api"
import { WalletCancelled } from "./near-connect"

/** NEAR Connect's id for the Ethereum Wallets executor (eth-implicit NEAR accounts named by the 0x address). */
export const EVM_WALLET = "ethereum-wallets"

/** The EIP-191 text an Ethereum wallet signs: the same statement as NEP-413, with the recipient and nonce in the text. */
export const evmStatement = (purpose: Purpose, subject: string, recipient: string, nonce: string) =>
  `${statementText(purpose, subject)}\nRecipient: ${recipient}\nNonce: ${nonce}`

type Eip1193 = { request(args: { method: string; params?: unknown[] }): Promise<unknown> }

const hexUtf8 = (s: string) => `0x${Array.from(new TextEncoder().encode(s), (b) => b.toString(16).padStart(2, "0")).join("")}`

/**
 * personal_sign through the browser's EIP-1193 provider (MetaMask and similar). The account must be the one the
 * Ethereum Wallets executor signed in with; the server checks the recovered address against it.
 */
/** Prepare a personal_sign: account access is checked first, so the returned call can start inside the tap. */
export async function evmPreparedSign(address: string, text: string): Promise<() => Promise<string>> {
  const eth = (window as unknown as { ethereum?: Eip1193 }).ethereum
  if (!eth) throw new ApiError("No Ethereum wallet in this browser. Open Bandsheet where MetaMask (or another extension) is installed.", "NO_EVM_PROVIDER")
  const accounts = ((await eth.request({ method: "eth_requestAccounts" })) as string[]).map((a) => a.toLowerCase())
  if (!accounts.includes(address.toLowerCase())) throw new ApiError(`Switch your Ethereum wallet to ${address}, the account you connected with.`, "WRONG_ACCOUNT")
  return () =>
    (eth.request({ method: "personal_sign", params: [hexUtf8(text), address] }) as Promise<unknown>).then(String, (e: unknown) => {
      const code = (e as { code?: number })?.code
      if (code === 4001 || /reject|denied|cancel/i.test(String((e as Error)?.message))) throw new WalletCancelled()
      throw e
    })
}

export async function evmPersonalSign(address: string, text: string): Promise<string> {
  const eth = (window as unknown as { ethereum?: Eip1193 }).ethereum
  if (!eth) throw new ApiError("No Ethereum wallet in this browser. Open Bandsheet where MetaMask (or another extension) is installed.", "NO_EVM_PROVIDER")
  try {
    const accounts = ((await eth.request({ method: "eth_requestAccounts" })) as string[]).map((a) => a.toLowerCase())
    if (!accounts.includes(address.toLowerCase())) {
      throw new ApiError(`Switch your Ethereum wallet to ${address}, the account you connected with.`, "WRONG_ACCOUNT")
    }
    return String(await eth.request({ method: "personal_sign", params: [hexUtf8(text), address] }))
  } catch (e) {
    if (e instanceof ApiError) throw e
    const code = (e as { code?: number })?.code
    if (code === 4001 || /reject|denied|cancel/i.test(String((e as Error)?.message))) throw new WalletCancelled()
    throw e
  }
}
