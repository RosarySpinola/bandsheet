import { describe, expect, it } from "vitest";
import { createKeyLookup } from "../src/auth/keys";

/** RPC replies recorded from test.rpc.fastnear.com on 14 Nov 2026 (block fields trimmed). */
const MISSING_KEY = { jsonrpc: "2.0", id: 1, result: { block_height: 277679096, error: "access key ed25519:4mWD does not exist while viewing", logs: [] } };
const UNKNOWN_ACCOUNT = {
  jsonrpc: "2.0", id: 1,
  error: { name: "HANDLER_ERROR", cause: { name: "UNKNOWN_ACCOUNT" }, code: -32000, message: "Server error", data: "account 0608 does not exist while viewing" },
};
const ACCOUNT = { jsonrpc: "2.0", id: 1, result: { amount: "926696509001413700000000", code_hash: "11111111111111111111111111111111" } };
const FULL = { jsonrpc: "2.0", id: 1, result: { nonce: 277000000000001, permission: "FullAccess" } };
const FN = { jsonrpc: "2.0", id: 1, result: { nonce: 1, permission: { FunctionCall: { allowance: "1", receiver_id: "x.testnet", method_names: ["submit"] } } } };

function rpc(replies: Record<string, unknown>) {
  const calls: string[] = [];
  const f = (async (_url: string, init: RequestInit) => {
    const kind = (JSON.parse(String(init.body)) as { params: { request_type: string } }).params.request_type;
    calls.push(kind);
    const r = replies[kind];
    if (r === "throw") throw new Error("ECONNRESET");
    return new Response(JSON.stringify(r), { status: 200 });
  }) as unknown as typeof fetch;
  return { f, calls };
}

describe("createKeyLookup (view_access_key)", () => {
  const PK = "ed25519:4mWDk9PmYkzSu2Yhh6aZ2FvLULUm7ZfYJwTt7QjqVHsD";
  it("reads FullAccess and FunctionCall permissions", async () => {
    expect(await createKeyLookup(["https://rpc.test"], rpc({ view_access_key: FULL }).f).status("a.testnet", PK)).toBe("full_access");
    expect(await createKeyLookup(["https://rpc.test"], rpc({ view_access_key: FN }).f).status("a.testnet", PK)).toBe("function_call");
  });

  it("a missing key on an existing account is no_such_key (the RPC's result.error shape)", async () => {
    const r = rpc({ view_access_key: MISSING_KEY, view_account: ACCOUNT });
    expect(await createKeyLookup(["https://rpc.test"], r.f).status("bs-guest-3f36b7.testnet", PK)).toBe("no_such_key");
    expect(r.calls).toEqual(["view_access_key", "view_account"]);
  });

  it("a missing account is no_such_account", async () => {
    const r = rpc({ view_access_key: MISSING_KEY, view_account: UNKNOWN_ACCOUNT });
    expect(await createKeyLookup(["https://rpc.test"], r.f).status("0608", PK)).toBe("no_such_account");
  });

  it("an unreachable RPC throws instead of answering 'no such account'", async () => {
    await expect(createKeyLookup(["https://rpc.test"], rpc({ view_access_key: "throw" }).f).status("a.testnet", PK)).rejects.toThrow(/unavailable/);
  });
});
