import { KeyPair, KeyPairSigner, actions, createTransaction } from "near-api-js";
import { describe, expect, it } from "vitest";
import { createBroadcast, signedTxHash } from "../src/auth/posting";

const UNIT = "bandsheet-3f36b7.testnet";

async function signedSubmit(): Promise<{ bytes: Uint8Array; hash: string }> {
  const k = KeyPair.fromRandom("ed25519");
  const tx = createTransaction(UNIT, k.getPublicKey(), UNIT, 9n, [actions.functionCall("submit", { ciphertext: { epk: "YQ==", nonce: "Yg==", ct: "Yw==" } }, 10n ** 13n, 0n)], new Uint8Array(32).fill(4));
  const { signedTransaction, txHash } = await new KeyPairSigner(k).signTransaction(tx);
  const { baseEncode } = await import("near-api-js");
  return { bytes: signedTransaction.encode(), hash: baseEncode(txHash) };
}

/** A fake RPC: each method answers from a queue of replies. */
function rpc(replies: Record<string, unknown[]>) {
  const calls: string[] = [];
  const f = (async (_u: string, init: RequestInit) => {
    const { method } = JSON.parse(String(init.body)) as { method: string };
    calls.push(method);
    const q = replies[method] ?? [];
    return new Response(JSON.stringify(q.length > 1 ? q.shift() : q[0]), { status: 200 });
  }) as unknown as typeof fetch;
  return { f, calls };
}

const success = (hash: string) => ({
  result: { status: { SuccessValue: Buffer.from('"39"').toString("base64") }, transaction: { hash }, transaction_outcome: { outcome: { status: { SuccessReceiptId: "x" } } }, receipts_outcome: [{ outcome: { status: { SuccessValue: "" } } }] },
});

describe("createBroadcast", () => {
  it("computes the transaction hash from the signed bytes", async () => {
    const t = await signedSubmit();
    expect(signedTxHash(t.bytes)).toBe(t.hash);
  });

  it("a provider timeout on send_tx does not hide a submit that landed: the outcome is polled by hash", async () => {
    const t = await signedSubmit();
    const r = rpc({
      send_tx: [{ error: { message: "Request timeout on the free plan, please upgrade to paid plan" } }],
      tx: [{ error: { cause: { name: "UNKNOWN_TRANSACTION" } } }, success(t.hash)],
    });
    const out = await createBroadcast(["https://rpc.test"], r.f, 1)(t.bytes);
    expect(out).toMatchObject({ hash: t.hash, ok: true, value: "39" });
    expect(r.calls.filter((c) => c === "send_tx")).toHaveLength(1);
  });

  it("a rate-limited RPC (429 inside a 200 reply) passes the submit to the next one", async () => {
    const t = await signedSubmit();
    const sent: string[] = [];
    const f = (async (url: string, init: RequestInit) => {
      const { method } = JSON.parse(String(init.body)) as { method: string };
      sent.push(`${url} ${method}`);
      const body = url === "https://a.test" ? { error: { code: -429, message: "Too Many Requests" } } : method === "send_tx" ? { result: { final_execution_status: "NONE" } } : success(t.hash);
      return new Response(JSON.stringify(body), { status: 200 });
    }) as unknown as typeof fetch;
    const out = await createBroadcast(["https://a.test", "https://b.test"], f, 1)(t.bytes);
    expect(out).toMatchObject({ ok: true, hash: t.hash });
    expect(sent.slice(0, 2)).toEqual(["https://a.test send_tx", "https://b.test send_tx"]);
  });

  it("an invalid transaction is a definite refusal and is not polled", async () => {
    const t = await signedSubmit();
    const r = rpc({ send_tx: [{ error: { name: "HANDLER_ERROR", data: { TxExecutionError: { InvalidTxError: "InvalidNonce" } } } }] });
    const out = await createBroadcast(["https://rpc.test"], r.f, 1)(t.bytes);
    expect(out.ok).toBe(false);
    expect(out.error).toContain("InvalidNonce");
    expect(r.calls).toEqual(["send_tx"]);
  });
});
