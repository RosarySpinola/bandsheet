import { TESTNET_RPCS } from "@bandsheet/core/near";

/** What NEAR says about a (account, public key) pair. */
export type KeyStatus = "full_access" | "function_call" | "no_such_key" | "no_such_account";

/** Read-only access-key lookups; injectable so tests never touch the network. */
export interface KeyLookup {
  status(accountId: string, publicKey: string): Promise<KeyStatus>;
}

interface RpcReply {
  /** nearcore still answers a missing access key with a *result* carrying `error` (seen 14 Nov 2026), not a JSON-RPC error. */
  result?: { permission?: unknown; error?: string; amount?: string };
  error?: { cause?: { name?: string }; data?: string; message?: string };
}

const causeOf = (r: RpcReply): string =>
  `${r.error?.cause?.name ?? ""} ${r.error?.data ?? ""} ${r.error?.message ?? ""} ${r.result?.error ?? ""}`;
/** A real answer: the key's permission, or the account's state. */
const answered = (r: RpcReply): boolean => Boolean(r.result && !r.result.error);

/**
 * view_access_key over JSON-RPC with failover across the testnet endpoints. UNKNOWN_ACCESS_KEY and UNKNOWN_ACCOUNT
 * are answers; anything else (rate limit, timeout) moves to the next endpoint and finally throws, so a flaky RPC
 * is never mistaken for "this account does not exist".
 */
export function createKeyLookup(urls: readonly string[] = TESTNET_RPCS, fetchFn: typeof fetch = fetch): KeyLookup {
  for (const u of urls) if (/mainnet/i.test(u)) throw new Error("refusing non-testnet RPC");
  const query = async (params: Record<string, unknown>): Promise<RpcReply> => {
    let last = "no RPC answered";
    for (const url of urls) {
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const res = await fetchFn(url, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ jsonrpc: "2.0", id: "bandsheet-auth", method: "query", params: { finality: "final", ...params } }),
            signal: AbortSignal.timeout(10_000),
          });
          const body = (await res.json().catch(() => ({}))) as RpcReply;
          if (answered(body)) return body;
          const cause = causeOf(body);
          if (/UNKNOWN_ACCESS_KEY|UNKNOWN_ACCOUNT|does not exist/i.test(cause)) return body;
          last = cause.trim() || `HTTP ${res.status}`;
        } catch (e) {
          last = e instanceof Error ? e.message : String(e);
        }
        await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
      }
    }
    throw new Error(`testnet RPC unavailable: ${last.slice(0, 120)}`);
  };

  return {
    async status(accountId, publicKey) {
      const r = await query({ request_type: "view_access_key", account_id: accountId, public_key: publicKey });
      if (answered(r)) {
        const p = r.result!.permission;
        if (p === "FullAccess") return "full_access";
        if (p && typeof p === "object" && "FunctionCall" in p) return "function_call";
        throw new Error("unexpected access key permission");
      }
      const cause = causeOf(r);
      if (/UNKNOWN_ACCOUNT/i.test(cause) || /account \S+ does not exist/i.test(cause)) return "no_such_account";
      // Missing key: confirm the account exists, so an implicit account that was never funded is told apart.
      const acct = await query({ request_type: "view_account", account_id: accountId });
      return answered(acct) ? "no_such_key" : "no_such_account";
    },
  };
}
