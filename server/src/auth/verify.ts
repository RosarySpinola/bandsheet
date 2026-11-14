import { ed25519 } from "@noble/curves/ed25519.js";
import { AppError } from "../errors";
import type { KeyLookup } from "./keys";
import { type Purpose, ed25519Bytes, implicitAccountOf, nep413Hash, statementText, statementTxHash } from "./statement";

/**
 * How the account signed:
 *  - nep413: a wallet's signMessage (NEAR Connect), the NEP-413 SignedMessage.
 *  - near-tx: NEAR Auth (FastAuth) signed the statement transaction (see statement.ts for why).
 */
export type Scheme = "nep413" | "near-tx";

export interface SignedClaim {
  scheme: Scheme;
  account_id: string;
  public_key: string;
  /** base64 ed25519 signature (64 bytes). */
  signature: string;
}

/** Values the server holds itself; the client never supplies the recipient or the nonce bytes. */
export interface Expected {
  purpose: Purpose;
  subject: string;
  nonce: Uint8Array;
  recipient: string;
}

export interface Verified {
  account_id: string;
  public_key: string;
  /** True when the account is an implicit account that does not exist on chain yet (accepted per NEAR Auth docs). */
  implicit_unfunded: boolean;
}

/** The exact 32-byte digest the account had to sign for this scheme. */
export function digestFor(claim: Pick<SignedClaim, "scheme" | "account_id" | "public_key">, e: Expected): Uint8Array {
  if (claim.scheme === "nep413") return nep413Hash({ message: statementText(e.purpose, e.subject), nonce: e.nonce, recipient: e.recipient });
  return statementTxHash({ accountId: claim.account_id, publicKey: claim.public_key, recipient: e.recipient, purpose: e.purpose, subject: e.subject, nonce: e.nonce });
}

/**
 * Verify a signed join/entry claim:
 *  1. the ed25519 signature is over our own re-encoding (our recipient, our nonce, the expected message), so a
 *     wrong recipient, another nonce or any edited byte fails here;
 *  2. the key is a FullAccess key of the account (view_access_key). The only exception, taken from the NEAR Auth
 *     docs: an implicit account that does not exist yet, whose id is the hex of that same key.
 */
export async function verifyClaim(claim: SignedClaim, e: Expected, keys: KeyLookup): Promise<Verified> {
  let pub: Uint8Array;
  try {
    pub = ed25519Bytes(claim.public_key);
  } catch {
    throw new AppError(400, "only ed25519 account keys are accepted", "BAD_PUBLIC_KEY");
  }
  const sig = Buffer.from(claim.signature, "base64");
  if (sig.length !== 64) throw new AppError(400, "signature must be 64 bytes (base64)", "BAD_SIGNATURE");

  let ok = false;
  try {
    ok = ed25519.verify(sig, digestFor(claim, e), pub);
  } catch {
    ok = false;
  }
  if (!ok) {
    throw new AppError(401, "the signature does not cover this message, nonce and recipient", "SIGNATURE_INVALID");
  }

  let status;
  try {
    status = await keys.status(claim.account_id, claim.public_key);
  } catch {
    throw new AppError(502, "could not read the account's keys from NEAR testnet", "CHAIN_READ");
  }
  if (status === "full_access") return { account_id: claim.account_id, public_key: claim.public_key, implicit_unfunded: false };
  if (status === "no_such_account" && claim.account_id === implicitAccountOf(claim.public_key)) {
    return { account_id: claim.account_id, public_key: claim.public_key, implicit_unfunded: true };
  }
  if (status === "function_call") throw new AppError(401, "that key is only a function-call key of the account", "NOT_FULL_ACCESS");
  if (status === "no_such_account") throw new AppError(401, "that account does not exist on NEAR testnet", "UNKNOWN_ACCOUNT");
  throw new AppError(401, "that key is not on the account", "KEY_NOT_ON_ACCOUNT");
}
