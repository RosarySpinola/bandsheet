/**
 * NEAR testnet RPCs for browser reads, tried in order. 14 Nov 2026: FastNEAR answered 429 to busy client IPs, so dRPC
 * leads, FastNEAR follows and FastNEAR's archival node (separate quota) is the last resort.
 */
export const READ_RPCS = ["https://near-testnet.drpc.org", "https://test.rpc.fastnear.com", "https://archival-rpc.testnet.fastnear.com"]
/** Endpoints wallets may use to send transactions (archival nodes are for reads). */
export const TX_RPCS = ["https://near-testnet.drpc.org", "https://test.rpc.fastnear.com"]

/** POST a JSON-RPC body, rotating to the next endpoint on a 429, a 5xx or a network error. */
export async function rpcPost(body: string): Promise<Response> {
  let last: unknown = new Error("no RPC endpoint answered")
  for (const url of READ_RPCS) {
    try {
      const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body })
      if (res.status === 429 || res.status >= 500) {
        last = new Error(`${url} answered ${res.status}`)
        continue
      }
      return res
    } catch (e) {
      last = e
    }
  }
  throw last
}
