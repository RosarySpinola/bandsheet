import { ApiError } from "@/lib/api"
import { CONTRACT, view } from "@/lib/chain"
import { getNonce, relayNearAuth, statementText, type Purpose, type SignedClaim } from "./auth-api"

/**
 * NEAR Auth (FastAuth) on testnet: Google, email or a passkey through the shared testnet Auth0 tenant, keys held by
 * the MPC network. Values from docs.auth.near.org/resources/testnet.
 *
 * The published provider (@fast-auth-near/javascript-provider 1.4.1) signs transactions and delegate actions but has
 * no NEP-413 message signing, so the account signs a statement transaction: one FunctionCall
 * `bandsheet_join|bandsheet_entry` to the unit, with args {message, nonce}, access-key nonce 0 and an all-zero block
 * hash. It can never be included on chain; the server re-encodes it and verifies the MPC signature over it.
 */
export const NEAR_AUTH = {
  clientId: "np8paqIpMWmNbzT4xAvOOapZBjsOpptl",
  contractId: "fast-auth.testnet",
  mpcContractId: "v1.signer-prod.testnet",
} as const

const METHOD: Record<Purpose, string> = { join: "bandsheet_join", entry: "bandsheet_entry" }

type Libs = {
  provider: import("@fast-auth-near/javascript-provider").JavascriptProvider
  near: typeof import("near-api-js-v5")
}
let libs: Promise<Libs> | null = null
let ready: Libs | null = null

/** Load the SDK ahead of the click, so the Auth0 popup opens inside the user's gesture and is not blocked. */
export function preloadNearAuth(): Promise<Libs> {
  libs ??= Promise.all([import("@fast-auth-near/javascript-provider"), import("near-api-js-v5")]).then(([p, near]) => {
    ready = { provider: new p.JavascriptProvider({ network: "testnet", clientId: NEAR_AUTH.clientId }), near }
    return ready
  })
  return libs
}

const loaded = async (): Promise<Libs> => ready ?? (await preloadNearAuth())

export type NearAuthAccount = { accountId: string; publicKey: string }

const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"
function b58decode(s: string): Uint8Array {
  let n = 0n
  for (const ch of s) {
    const i = B58.indexOf(ch)
    if (i < 0) throw new Error("bad base58")
    n = n * 58n + BigInt(i)
  }
  const out: number[] = []
  while (n > 0n) {
    out.unshift(Number(n & 0xffn))
    n >>= 8n
  }
  for (const ch of s) {
    if (ch !== "1") break
    out.unshift(0)
  }
  return Uint8Array.from(out)
}

/** The account NEAR Auth derives for this login: the MPC key for its path, and the implicit account of that key. */
async function derivedAccount(l: Libs): Promise<NearAuthAccount> {
  const path = await l.provider.getPath()
  const pk = await view<string>(NEAR_AUTH.mpcContractId, "derived_public_key", { path, predecessor: NEAR_AUTH.contractId, domain_id: 1 })
  const m = /^ed25519:([1-9A-HJ-NP-Za-km-z]+)$/.exec(String(pk))
  if (!m) throw new ApiError("NEAR Auth returned a key that is not ed25519.", "NEAR_AUTH_KEY")
  const hex = Array.from(b58decode(m[1]!), (b) => b.toString(16).padStart(2, "0")).join("")
  return { accountId: hex, publicKey: String(pk) }
}

/** Sign in (Auth0 popup). Call straight from a click handler. */
export async function nearAuthLogin(): Promise<NearAuthAccount> {
  const l = ready
  const p = l ? l.provider.login() : (await loaded()).provider.login()
  await p
  return derivedAccount(await loaded())
}

/** The session survives a reload in Auth0's cache; returns the account if still signed in. */
export async function nearAuthCurrent(): Promise<NearAuthAccount | null> {
  const l = await loaded()
  return (await l.provider.isLoggedIn()) ? derivedAccount(l) : null
}

export async function nearAuthLogout(): Promise<void> {
  const l = await loaded()
  await l.provider.logout({ openUrl: false } as never)
}

export type PreparedStatement = { purpose: Purpose; subject: string; nonce: string; account: NearAuthAccount; tx: unknown }

/** Fetch a nonce and build the statement transaction before the approve click. */
export async function prepareStatement(purpose: Purpose, subject: string, account: NearAuthAccount): Promise<PreparedStatement> {
  const l = await loaded()
  const issued = await getNonce(purpose)
  if (issued.recipient !== CONTRACT) throw new ApiError("The server named a different contract.", "RECIPIENT_MISMATCH")
  const { transactions, utils } = l.near
  const args = new TextEncoder().encode(JSON.stringify({ message: statementText(purpose, subject), nonce: toB64(issued.nonce) }))
  const tx = transactions.createTransaction(
    account.accountId,
    utils.PublicKey.fromString(account.publicKey),
    CONTRACT,
    0n,
    [transactions.functionCall(METHOD[purpose], args, 10n ** 12n, 0n)],
    new Uint8Array(32),
  )
  return { purpose, subject, nonce: issued.nonce, account, tx }
}

/** base64url (server nonce) to standard base64, the form the server re-encodes into the statement args. */
function toB64(nonce: string): string {
  const s = nonce.replace(/-/g, "+").replace(/_/g, "/")
  return s + "=".repeat((4 - (s.length % 4)) % 4)
}

/**
 * Approve the statement (Auth0 consent popup; call straight from a click), then have the server relay the approved
 * request to fast-auth.testnet and hand back the MPC signature. Returns a claim for /api/auth/join or /entry.
 */
export async function approveStatement(s: PreparedStatement): Promise<SignedClaim & { relayTx: string }> {
  const l = ready ?? (await loaded())
  await l.provider.requestTransactionSignature({ transaction: s.tx as never })
  const { signatureRequest } = await l.provider.getSignatureRequest()
  const payload = Uint8Array.from(signatureRequest.signPayload as ArrayLike<number>)
  let bin = ""
  for (const b of payload) bin += String.fromCharCode(b)
  const relay = await relayNearAuth({
    purpose: s.purpose,
    subject: s.subject,
    nonce: s.nonce,
    account_id: s.account.accountId,
    public_key: s.account.publicKey,
    guard_id: signatureRequest.guardId,
    verify_payload: signatureRequest.verifyPayload,
    sign_payload: btoa(bin),
  })
  return { scheme: "near-tx", account_id: s.account.accountId, public_key: s.account.publicKey, signature: relay.signature, nonce: s.nonce, relayTx: relay.tx.url }
}
