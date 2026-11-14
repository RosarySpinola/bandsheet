import { sha256 } from "@noble/hashes/sha2.js";
import { PublicKey, actions, createTransaction, encodeTransaction } from "near-api-js";

/**
 * What a signed-in account signs. Two purposes, each a fixed sentence plus one subject:
 *  - join:  "Bandsheet join: <member ed25519 public key>"
 *  - entry: "Bandsheet entry: <sha256 hex of the ciphertext JSON>"
 * The recipient is always the unit contract and the nonce is a single-use 32-byte value the server issued.
 */
export type Purpose = "join" | "entry";
export const PURPOSES = ["join", "entry"] as const;

export const statementText = (purpose: Purpose, subject: string): string =>
  purpose === "join" ? `Bandsheet join: ${subject}` : `Bandsheet entry: ${subject}`;

/** NEP-413 prefix tag, 2^31 + 413. */
export const NEP413_TAG = 2 ** 31 + 413;

const utf8 = new TextEncoder();

function u32(n: number): Uint8Array {
  const b = new Uint8Array(4);
  new DataView(b.buffer).setUint32(0, n, true);
  return b;
}

function borshString(s: string): Uint8Array {
  const bytes = utf8.encode(s);
  return concat(u32(bytes.length), bytes);
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

export interface Nep413Payload {
  message: string;
  nonce: Uint8Array;
  recipient: string;
  callbackUrl?: string;
}

/**
 * NEP-413 bytes to hash: borsh(u32 tag) ‖ borsh(Payload{message, nonce:[u8;32], recipient, callbackUrl: Option<String>}).
 * Written out by hand so the server does not depend on a wallet library's encoder.
 */
export function nep413Bytes(p: Nep413Payload): Uint8Array {
  if (p.nonce.length !== 32) throw new Error("NEP-413 nonce must be 32 bytes");
  const cb = p.callbackUrl === undefined ? new Uint8Array([0]) : concat(new Uint8Array([1]), borshString(p.callbackUrl));
  return concat(u32(NEP413_TAG), borshString(p.message), p.nonce, borshString(p.recipient), cb);
}

export const nep413Hash = (p: Nep413Payload): Uint8Array => sha256(nep413Bytes(p));

/** The method a statement transaction names. No contract has it, and the transaction can never execute anyway. */
export const STATEMENT_METHOD: Record<Purpose, string> = { join: "bandsheet_join", entry: "bandsheet_entry" };

export interface StatementTx {
  accountId: string;
  publicKey: string;
  recipient: string;
  purpose: Purpose;
  subject: string;
  nonce: Uint8Array;
}

/**
 * NEAR Auth path. The published FastAuth SDK (browser-sdk 1.4.2, javascript-provider 1.4.1) can sign transactions
 * but has no NEP-413 message signing, so the account signs a statement transaction instead:
 *   signer = the account, receiver = the unit, one FunctionCall `bandsheet_join|bandsheet_entry`
 *   with args {message, nonce(base64)}, access-key nonce 0 and an all-zero block hash.
 * Nonce 0 and an unknown block hash make it impossible to include on chain, so it is a signed statement only.
 * The signature is ed25519 over sha256(borsh(transaction)), exactly as for any NEAR transaction.
 */
export function statementTxBytes(s: StatementTx): Uint8Array {
  const args = { message: statementText(s.purpose, s.subject), nonce: Buffer.from(s.nonce).toString("base64") };
  const tx = createTransaction(
    s.accountId,
    PublicKey.fromString(s.publicKey),
    s.recipient,
    0n,
    [actions.functionCall(STATEMENT_METHOD[s.purpose], args, 10n ** 12n, 0n)],
    new Uint8Array(32),
  );
  return encodeTransaction(tx);
}

export const statementTxHash = (s: StatementTx): Uint8Array => sha256(statementTxBytes(s));

/** ed25519 public key bytes from "ed25519:<base58>"; throws on any other key type. */
export function ed25519Bytes(publicKey: string): Uint8Array {
  const pk = PublicKey.fromString(publicKey);
  if (pk.keyType !== 0) throw new Error("only ed25519 keys are accepted");
  return pk.data;
}

/** Implicit account id for an ed25519 key: hex of its 32 bytes. */
export const implicitAccountOf = (publicKey: string): string => Buffer.from(ed25519Bytes(publicKey)).toString("hex");
