import { verifyMessage } from "viem";
import { AppError } from "../errors";
import { type Purpose, statementText } from "./statement";

/**
 * Ethereum wallets (NEAR Connect's "Ethereum Wallets", eth-implicit NEAR accounts named by the 0x address) cannot do
 * NEP-413, so they sign the same statement as an EIP-191 personal_sign text. The text carries the recipient and the
 * server-issued nonce, exactly like the NEP-413 payload, and the server rebuilds it from its own values.
 */
export function evmStatement(purpose: Purpose, subject: string, recipient: string, nonce: string): string {
  return `${statementText(purpose, subject)}\nRecipient: ${recipient}\nNonce: ${nonce}`;
}

export const isEvmAccount = (id: string): boolean => /^0x[0-9a-f]{40}$/.test(id);

/** The recovered signer must be the NEAR account itself (lower-case 0x address); anything else is refused. */
export async function verifyEvmClaim(accountId: string, signature: string, text: string): Promise<void> {
  if (!isEvmAccount(accountId)) throw new AppError(400, "an Ethereum wallet's account must be its lower-case 0x address", "BAD_EVM_ACCOUNT");
  if (!/^0x[0-9a-fA-F]{130}$/.test(signature)) throw new AppError(400, "an Ethereum signature is 65 bytes of 0x hex", "BAD_SIGNATURE");
  let ok = false;
  try {
    ok = await verifyMessage({ address: accountId as `0x${string}`, message: text, signature: signature as `0x${string}` });
  } catch {
    ok = false;
  }
  if (!ok) throw new AppError(401, "the signature does not cover this message, nonce and recipient for this address", "SIGNATURE_INVALID");
}
