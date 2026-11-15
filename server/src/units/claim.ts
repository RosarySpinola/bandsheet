import { ed25519 } from "@noble/curves/ed25519.js";
import { z } from "zod";
import { type UnitPurpose, unitStatement } from "@bandsheet/core";
import { verifyEvmClaim } from "../auth/evm";
import type { KeyLookup } from "../auth/keys";
import { ed25519Bytes, implicitAccountOf, nep413Hash } from "../auth/statement";
import { AppError } from "../errors";

export const ACCOUNT = z.string().min(2).max(64).regex(/^[a-z0-9._-]+$/);
export const ED25519 = z.string().regex(/^ed25519:[1-9A-HJ-NP-Za-km-z]{32,50}$/);
const NONCE = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
const SIG = z.union([z.string().regex(/^[A-Za-z0-9+/=_-]+$/).max(200), z.string().regex(/^0x[0-9a-fA-F]{130}$/)]);

/** A wallet's signed statement: NEP-413 (NEAR wallets) or EIP-191 (Ethereum wallets), as on the demo join. */
export const UnitClaim = z.object({
  scheme: z.enum(["nep413", "eip191"]),
  account_id: ACCOUNT,
  public_key: ED25519.optional(),
  signature: SIG,
  nonce: NONCE,
});
export type UnitClaimT = z.infer<typeof UnitClaim>;

export interface UnitExpected {
  purpose: UnitPurpose;
  unitId: number;
  subject: string;
  /** The units contract (NEP-413 recipient). */
  recipient: string;
}

/** The EIP-191 text: the statement plus recipient and nonce, rebuilt from the server's own values. */
export const unitEvmText = (e: UnitExpected, nonce: string): string =>
  `${unitStatement(e.purpose, e.unitId, e.subject)}\nRecipient: ${e.recipient}\nNonce: ${nonce}`;

/**
 * Verify a unit statement. The digest is our own re-encoding (our message, recipient and nonce), so a signature over
 * anything else fails; then the key must be a full-access key of the account (or the account is the unfunded
 * implicit account of that key, as on the demo).
 */
export async function verifyUnitClaim(c: UnitClaimT, e: UnitExpected, keys: KeyLookup): Promise<string> {
  if (c.scheme === "eip191") {
    await verifyEvmClaim(c.account_id, c.signature, unitEvmText(e, c.nonce));
    return c.account_id;
  }
  if (!c.public_key) throw new AppError(400, "public_key is required for NEAR signatures", "BAD_REQUEST");
  let pub: Uint8Array;
  try {
    pub = ed25519Bytes(c.public_key);
  } catch {
    throw new AppError(400, "only ed25519 account keys are accepted", "BAD_PUBLIC_KEY");
  }
  const sig = Buffer.from(c.signature, "base64");
  if (sig.length !== 64) throw new AppError(400, "signature must be 64 bytes (base64)", "BAD_SIGNATURE");
  const digest = nep413Hash({ message: unitStatement(e.purpose, e.unitId, e.subject), nonce: Uint8Array.from(Buffer.from(c.nonce, "base64url")), recipient: e.recipient });
  let ok = false;
  try {
    ok = ed25519.verify(sig, digest, pub);
  } catch {
    ok = false;
  }
  if (!ok) throw new AppError(401, "the signature does not cover this message, nonce and recipient", "SIGNATURE_INVALID");
  let status;
  try {
    status = await keys.status(c.account_id, c.public_key);
  } catch {
    throw new AppError(502, "could not read the account's keys from NEAR testnet", "CHAIN_READ");
  }
  if (status === "full_access") return c.account_id;
  if (status === "no_such_account" && c.account_id === implicitAccountOf(c.public_key)) return c.account_id;
  if (status === "function_call") throw new AppError(401, "that key is only a function-call key of the account", "NOT_FULL_ACCESS");
  if (status === "no_such_account") throw new AppError(401, "that account does not exist on NEAR testnet", "UNKNOWN_ACCOUNT");
  throw new AppError(401, "that key is not on the account", "KEY_NOT_ON_ACCOUNT");
}
