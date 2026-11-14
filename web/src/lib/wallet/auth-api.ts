import { z } from "zod"
import { api, postJson } from "@/lib/api"

/** Client side of /api/auth. Every response is parsed; failures arrive as ApiError with the server's code. */

export type Purpose = "join" | "entry"
export type Method = "near-auth" | "near-connect"

/** What the account signed: a wallet's NEP-413 message, or the NEAR Auth statement transaction. */
export type SignedClaim = {
  scheme: "nep413" | "near-tx"
  account_id: string
  public_key: string
  signature: string
  nonce: string
}

const TxOut = z.object({ hash: z.string(), url: z.string() })

const NonceResponse = z.object({ nonce: z.string(), purpose: z.enum(["join", "entry"]), recipient: z.string(), expires_at: z.string() })
export type IssuedNonce = z.infer<typeof NonceResponse>

const RelayResponse = z.object({ signature: z.string(), tx: TxOut })

const JoinResponse = z.object({
  account_id: z.string(),
  implicit_unfunded: z.boolean(),
  member_public_key: z.string(),
  slot: z.string(),
  tx: TxOut,
  replaced: z.object({ slot: z.string(), tx: TxOut.nullable() }).nullable(),
})
export type JoinResult = z.infer<typeof JoinResponse>

const EntryResponse = z.object({
  account_id: z.string(),
  slot: z.string(),
  ct_sha256: z.string(),
  signed_at: z.string(),
  tx: TxOut,
  entry_count: z.number().nullable(),
})
export type WalletEntry = z.infer<typeof EntryResponse>

export const statementText = (purpose: Purpose, subject: string) =>
  purpose === "join" ? `Bandsheet join: ${subject}` : `Bandsheet entry: ${subject}`

export const getNonce = (purpose: Purpose) => api("/auth/nonce", NonceResponse, postJson({ purpose }))

export const relayNearAuth = (body: {
  purpose: Purpose
  subject: string
  nonce: string
  account_id: string
  public_key: string
  guard_id: string
  verify_payload: string
  sign_payload: string
}) => api("/auth/near-auth/sign", RelayResponse, postJson(body))

export const joinWithAccount = (claim: SignedClaim, memberPublicKey: string, method: Method) =>
  api("/auth/join", JoinResponse, postJson({ ...claim, member_public_key: memberPublicKey, method }))

/** The wallet's claim over the entry hash plus the posting key's signed, unsent submit; the server posts it only if the claim verifies. */
export const postWalletEntry = (claim: SignedClaim, signedTxB64: string, method: Method) =>
  api("/auth/entry", EntryResponse, postJson({ ...claim, signed_tx: signedTxB64, method }))

export const nonceBytes = (nonce: string): Uint8Array => {
  const b64 = nonce.replace(/-/g, "+").replace(/_/g, "/")
  const bin = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4))
  return Uint8Array.from(bin, (c) => c.charCodeAt(0))
}

/** sha256 hex of the ciphertext JSON exactly as it was submitted. */
export async function sha256Hex(text: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text))
  return Array.from(new Uint8Array(d), (b) => b.toString(16).padStart(2, "0")).join("")
}
