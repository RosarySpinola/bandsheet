// Shared helpers for the Bandsheet verifier: JSON-RPC with fallback and backoff, hashing, base58.
import { createHash } from "node:crypto";

export const RPCS = ["https://test.rpc.fastnear.com", "https://archival-rpc.testnet.near.org"];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const sha256Hex = (buf) => createHash("sha256").update(buf).digest("hex");

const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
export function base58ToHex(s) {
  let n = 0n;
  for (const c of s) {
    const i = B58.indexOf(c);
    if (i < 0) throw new Error("invalid base58 character");
    n = n * 58n + BigInt(i);
  }
  return n.toString(16).padStart(64, "0");
}

/** GET/POST with retries. Rotates through `urls` on every failure; exponential backoff between rounds. */
export async function fetchRetry(urls, init = {}, { rounds = 3, timeoutMs = 20000, accept } = {}) {
  const list = Array.isArray(urls) ? urls : [urls];
  let last = "no attempt";
  for (let round = 0; round < rounds; round++) {
    for (const url of list) {
      try {
        const res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
        if (res.ok) {
          const body = await res.text();
          if (!accept || accept(body)) return { url, body };
          last = `${url}: unexpected body`;
        } else {
          last = `${url}: HTTP ${res.status}`;
          if (res.status === 404) return { url, body: null, status: 404 };
        }
      } catch (e) {
        last = `${url}: ${e.name === "TimeoutError" ? "timeout" : e.message}`;
      }
    }
    await sleep(600 * 2 ** round);
  }
  throw new Error(last);
}

export async function rpc(params) {
  const payload = JSON.stringify({ jsonrpc: "2.0", id: "bandsheet-verify", method: "query", params });
  const ok = (b) => {
    try { const j = JSON.parse(b); return !!j.result; } catch { return false; }
  };
  const { body } = await fetchRetry(
    RPCS,
    { method: "POST", headers: { "content-type": "application/json" }, body: payload },
    { accept: ok },
  );
  return JSON.parse(body).result;
}

export async function viewAccount(account) {
  return rpc({ request_type: "view_account", finality: "final", account_id: account });
}

export async function viewCall(account, method, args = {}) {
  const r = await rpc({
    request_type: "call_function", finality: "final", account_id: account, method_name: method,
    args_base64: Buffer.from(JSON.stringify(args)).toString("base64"),
  });
  return JSON.parse(Buffer.from(r.result).toString("utf8"));
}

export async function getJson(url) {
  const { body, status } = await fetchRetry(url, { headers: { accept: "application/json" } }, { rounds: 2 });
  if (status === 404) return null;
  return JSON.parse(body);
}
