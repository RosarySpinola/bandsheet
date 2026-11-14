import { createHash } from "node:crypto";
import { decodeSignedTransaction } from "near-api-js";
import { CiphertextSchema, slotIdFromNearPublicKey } from "@bandsheet/core";
import { type SentTx, decodeValue, failureText } from "../chain/port";
import { AppError } from "../errors";

/**
 * A wallet member's entry arrives as a `submit` transaction already signed by their posting key (a function-call
 * key on the unit that can call only `submit`), together with the wallet's signature over the entry's hash.
 * The server checks the wallet signature first and only then broadcasts the posting transaction, so an entry the
 * wallet did not sign is never posted. On chain the signer is the unit account, never the member's wallet.
 */
export interface PostingTx {
  bytes: Uint8Array;
  /** The posting key's slot (sha256 of the key). */
  slot: string;
  /** The ciphertext JSON exactly as the contract will store it, and its sha256. */
  ctText: string;
  ctSha256: string;
}

const bad = (why: string) => new AppError(400, `the posting transaction is not a single submit to the unit: ${why}`, "BAD_POSTING_TX");

export function readPostingTx(b64: string, unit: string): PostingTx {
  const bytes = Uint8Array.from(Buffer.from(b64, "base64"));
  let st;
  try {
    st = decodeSignedTransaction(bytes);
  } catch {
    throw bad("it could not be decoded");
  }
  const tx = st.transaction;
  if (tx.signerId !== unit || tx.receiverId !== unit) throw bad("signer and receiver must be the unit");
  const fc = tx.actions.length === 1 ? tx.actions[0]!.functionCall : undefined;
  if (!fc || fc.methodName !== "submit" || fc.deposit !== 0n) throw bad("expected one submit call with no deposit");
  let ciphertext: unknown;
  try {
    // Borsh decoding gives the args as a plain number array, not a Uint8Array.
    ciphertext = (JSON.parse(new TextDecoder().decode(Uint8Array.from(fc.args as ArrayLike<number>))) as { ciphertext?: unknown }).ciphertext;
  } catch {
    throw bad("its arguments are not JSON");
  }
  if (!CiphertextSchema.safeParse(ciphertext).success) throw bad("its ciphertext is not {epk, nonce, ct}");
  const ctText = JSON.stringify(ciphertext);
  let slot: string;
  try {
    slot = slotIdFromNearPublicKey(tx.publicKey.toString());
  } catch {
    throw bad("the posting key must be ed25519");
  }
  return { bytes, slot, ctText, ctSha256: createHash("sha256").update(ctText).digest("hex") };
}

export type Broadcast = (signed: Uint8Array) => Promise<SentTx>;

interface SendTxReply {
  result?: {
    status: unknown;
    transaction: { hash: string };
    transaction_outcome?: { outcome?: { status?: unknown } };
    receipts_outcome?: { outcome?: { status?: unknown } }[];
  };
  error?: { message?: string; data?: unknown; cause?: { name?: string } };
}

/**
 * Broadcast the exact signed bytes (`send_tx`, wait until executed) over the testnet RPCs; the bytes are never
 * re-encoded, so the posting key's signature stays valid. A transport failure moves to the next RPC; an answer
 * (success, contract panic or invalid transaction) is final, so a submit is never sent twice by retrying.
 */
export function createBroadcast(urls: readonly string[], fetchFn: typeof fetch = fetch): Broadcast {
  for (const u of urls) if (/mainnet/i.test(u)) throw new Error("refusing non-testnet RPC");
  return async (bytes) => {
    const body = JSON.stringify({ jsonrpc: "2.0", id: "bandsheet-post", method: "send_tx", params: { signed_tx_base64: Buffer.from(bytes).toString("base64"), wait_until: "EXECUTED" } });
    let last = "no RPC answered";
    for (const url of urls) {
      let reply: SendTxReply;
      try {
        const res = await fetchFn(url, { method: "POST", headers: { "content-type": "application/json" }, body, signal: AbortSignal.timeout(45_000) });
        if (res.status === 429 || res.status >= 500) throw new Error(`HTTP ${res.status}`);
        reply = (await res.json()) as SendTxReply;
      } catch (e) {
        last = e instanceof Error ? e.message : String(e);
        continue;
      }
      const r = reply.result;
      if (!r) return { hash: "", ok: false, error: JSON.stringify(reply.error?.data ?? reply.error?.message ?? "rejected").slice(0, 240), value: undefined };
      const outcomes = [r.transaction_outcome, ...(r.receipts_outcome ?? [])];
      const failed = outcomes.map((o) => failureText(o?.outcome?.status)).find(Boolean) ?? failureText(r.status);
      return { hash: r.transaction.hash, ok: !failed, error: failed, value: decodeValue(r.status) };
    }
    throw new Error(`testnet RPC unavailable: ${last.slice(0, 120)}`);
  };
}
