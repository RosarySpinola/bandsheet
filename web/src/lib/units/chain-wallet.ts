import type { NearWalletBase } from "@hot-labs/near-connect"
import { traceSignCall } from "@/lib/wallet/gesture"
import { EVM_WALLET, evmPreparedSign } from "@/lib/wallet/evm"
import { ChainRefused, WalletCancelled, connectVoter, disconnectVoter, getConnector, nonceBytesOf, restoreVoter, warmWallet } from "./wallet-bridge"
import { UNITS_CONTRACT } from "./config"
import type { Conn, ContractCall, PreparedCall, PreparedMessage, TxResult, UnitsWallet } from "./types"

/**
 * The connected NEAR wallet (NEAR Connect, testnet) for units actions. Tap rule: prepare*() does every await first
 * (wallet code loaded, args built); the returned send()/sign() starts the wallet call synchronously in the click, so
 * Meteor Web's tab opens inside the browser's user-gesture allowance. window.__bsSignTrace records each start.
 */

const cancelled = (e: unknown) => /reject|cancel|closed|denied|user/i.test(e instanceof Error ? e.message : String(e))

const asConn = (c: { wallet: NearWalletBase; accountId: string }): Conn => ({
  accountId: c.accountId,
  walletId: (c.wallet as { manifest?: { id?: string } }).manifest?.id ?? "near",
  handle: c.wallet,
})

/** The chain's answer to a transaction: the return value on success, the contract's panic text on failure. */
export function readOutcome(out: unknown): TxResult {
  const o = out as { status?: unknown; transaction?: { hash?: string }; transaction_outcome?: { id?: string }; receipts_outcome?: { outcome?: { status?: unknown } }[] } | undefined
  const hash = o?.transaction?.hash ?? o?.transaction_outcome?.id ?? null
  const failures = [o?.status, ...(o?.receipts_outcome ?? []).map((r) => r.outcome?.status)].filter(
    (s): s is { Failure: unknown } => typeof s === "object" && s !== null && "Failure" in s,
  )
  if (failures.length) {
    const text = JSON.stringify(failures[0]!.Failure)
    const why = /"ExecutionError":"([^"]+)"/.exec(text)?.[1] ?? /panicked at[^"]*"?([^"\\]+)/.exec(text)?.[1] ?? "the contract refused it"
    throw new ChainRefused(why.replace(/^Smart contract panicked:\s*/i, ""), hash)
  }
  const raw = (o?.status as { SuccessValue?: string } | undefined)?.SuccessValue
  let value: unknown = null
  if (raw) {
    const text = atob(raw)
    try {
      value = JSON.parse(text)
    } catch {
      value = text
    }
  }
  return { hash, value }
}

export const chainWallet: UnitsWallet = {
  restore: async () => {
    const c = await restoreVoter()
    return c ? asConn(c) : null
  },
  connect: async () => asConn(await connectVoter()),
  disconnect: () => disconnectVoter(),

  prepareCall: async (conn, call: ContractCall): Promise<PreparedCall> => {
    const wallet = conn.handle as NearWalletBase
    await warmWallet(wallet)
    const params = {
      network: "testnet" as const,
      signerId: conn.accountId,
      receiverId: UNITS_CONTRACT,
      actions: [{ type: "FunctionCall" as const, params: { methodName: call.method, args: call.args, gas: call.gas, deposit: call.deposit ?? "0" } }],
    }
    return {
      send: () => {
        traceSignCall("signAndSendTransaction")
        return wallet.signAndSendTransaction(params).then(readOutcome, (e: unknown) => {
          throw cancelled(e) ? new WalletCancelled() : e
        })
      },
    }
  },

  prepareMessage: async (conn, msg): Promise<PreparedMessage> => {
    if (conn.walletId === EVM_WALLET) {
      const sign = await evmPreparedSign(conn.accountId, `${msg.message}\nRecipient: ${msg.recipient}\nNonce: ${msg.nonce}`)
      return {
        sign: () => {
          traceSignCall("personal_sign")
          return sign().then((signature) => ({ accountId: conn.accountId, signature, scheme: "eip191" as const }))
        },
      }
    }
    await getConnector()
    const wallet = conn.handle as NearWalletBase
    await warmWallet(wallet)
    const params = { message: msg.message, recipient: msg.recipient, nonce: nonceBytesOf(msg.nonce), network: "testnet" as const, signerId: conn.accountId }
    return {
      sign: () => {
        traceSignCall("signMessage")
        return wallet.signMessage(params).then(
          (s) => ({ accountId: s.accountId, publicKey: s.publicKey, signature: s.signature, scheme: "nep413" as const }),
          (e: unknown) => {
            throw cancelled(e) ? new WalletCancelled() : e
          },
        )
      },
    }
  },
}
