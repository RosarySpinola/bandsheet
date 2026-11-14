import { createHash } from "node:crypto";
import { sha256 } from "@noble/hashes/sha2.js";
import { baseEncode, decodeSignedTransaction } from "near-api-js";
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

interface TxResult {
  status: unknown;
  final_execution_status?: string;
  transaction: { hash: string };
  transaction_outcome?: { outcome?: { status?: unknown } };
  receipts_outcome?: { outcome?: { status?: unknown } }[];
}
interface RpcReply {
  result?: TxResult;
  error?: { message?: string; data?: unknown; name?: string; cause?: { name?: string } };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const errText = (e: RpcReply["error"]) => JSON.stringify(e?.data ?? e?.cause?.name ?? e?.message ?? "rejected").slice(0, 240);
/** "Not decided yet" answers: the provider gave up waiting (dRPC's free plan does) or the tx is not indexed yet. */
const pending = (e: RpcReply["error"]) => /timeout|TIMEOUT|UNKNOWN_TRANSACTION|not found|doesn't exist|does not exist/i.test(JSON.stringify(e ?? {}));

/** Hash of a signed transaction: sha256 of its Transaction bytes (the trailing 65 bytes are the ed25519 signature). */
export function signedTxHash(bytes: Uint8Array): string {
  return baseEncode(sha256(bytes.subarray(0, bytes.length - 65)));
}

function outcomeOf(r: TxResult): SentTx {
  const outcomes = [r.transaction_outcome, ...(r.receipts_outcome ?? [])];
  const failed = outcomes.map((o) => failureText(o?.outcome?.status)).find(Boolean) ?? failureText(r.status);
  return { hash: r.transaction.hash, ok: !failed, error: failed, value: decodeValue(r.status) };
}

/**
 * Broadcast the exact signed bytes and wait for the outcome. The bytes are never re-encoded, so the posting key's
 * signature stays valid. `send_tx` returns at once (wait_until NONE); a definite refusal (invalid transaction) ends
 * it, a timeout or transport error moves on. The outcome is then polled by hash on every RPC, so a provider that
 * times out while waiting (seen 15 Nov: dRPC "Request timeout on the free plan") cannot hide a submit that landed.
 * A submit is never sent twice once an RPC has accepted it.
 */
export function createBroadcast(urls: readonly string[], fetchFn: typeof fetch = fetch, pollMs = 1500): Broadcast {
  for (const u of urls) if (/mainnet/i.test(u)) throw new Error("refusing non-testnet RPC");
  const call = async (url: string, method: string, params: object): Promise<RpcReply> => {
    const res = await fetchFn(url, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: "bandsheet-post", method, params }), signal: AbortSignal.timeout(20_000),
    });
    if (res.status === 429 || res.status >= 500) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as RpcReply;
  };
  return async (bytes) => {
    const hash = signedTxHash(bytes);
    const signer = decodeSignedTransaction(bytes).transaction.signerId;
    const b64 = Buffer.from(bytes).toString("base64");
    let accepted = false;
    let last = "no RPC answered";
    for (const url of urls) {
      try {
        const r = await call(url, "send_tx", { signed_tx_base64: b64, wait_until: "NONE" });
        if (r.result || pending(r.error)) {
          accepted = true;
          break;
        }
        return { hash, ok: false, error: errText(r.error), value: undefined };
      } catch (e) {
        last = e instanceof Error ? e.message : String(e);
      }
    }
    if (!accepted) throw new Error(`testnet RPC unavailable: ${last.slice(0, 120)}`);
    for (let round = 0; round < 30; round++) {
      for (const url of urls) {
        try {
          const r = await call(url, "tx", { tx_hash: hash, sender_account_id: signer, wait_until: "EXECUTED_OPTIMISTIC" });
          if (r.result?.receipts_outcome) return outcomeOf(r.result);
          if (r.error && !pending(r.error)) return { hash, ok: false, error: errText(r.error), value: undefined };
        } catch {
          // rate limit or transport error: try the next RPC
        }
      }
      await sleep(pollMs);
    }
    throw new Error(`no outcome for ${hash} yet; check the transaction before retrying`);
  };
}
