import { z } from "zod"
import { useQuery } from "@tanstack/react-query"
import { ApiError } from "@/lib/api"
import { CONTRACT, explorer, txHashOf } from "@/lib/chain"

const AccountView = z.object({ result: z.object({ code_hash: z.string() }) })

/** The contract's deployed code hash (base58 sha256), read live from testnet RPC. */
export function useCodeHash(account: string = CONTRACT) {
  return useQuery({
    queryKey: ["chain", "code_hash", account],
    queryFn: async () => {
      const res = await fetch("https://test.rpc.fastnear.com", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: "bandsheet",
          method: "query",
          params: { request_type: "view_account", finality: "final", account_id: account },
        }),
      })
      const p = AccountView.safeParse(await res.json().catch(() => null))
      if (!p.success) throw new ApiError("NEAR testnet did not answer.", "CHAIN_READ", res.status)
      return p.data.result.code_hash
    },
    staleTime: 5 * 60_000,
    retry: 2,
  })
}

export const AttestationSchema = z
  .object({
    transaction_hash: z.string(),
    project_id: z.string().optional(),
    wasm_hash: z.string().optional(),
    executed_wasm_sha256: z.string().optional(),
    input_hash: z.string().optional(),
    output_hash: z.string().optional(),
    worker_measurement: z.string().optional(),
    caller_account_id: z.string().optional(),
    build_target: z.string().optional(),
    timestamp: z.union([z.string(), z.number()]).optional(),
  })
  .passthrough()
export type Attestation = z.infer<typeof AttestationSchema>

/** OutLayer's public attestation for the transaction that ran the engine. CORS is open on this API. */
export function useAttestation(tx: string | undefined) {
  return useQuery({
    queryKey: ["outlayer", "attestation", tx],
    enabled: Boolean(tx),
    queryFn: async () => {
      const res = await fetch(explorer.attestation(txHashOf(tx!)))
      if (res.status === 404) throw new ApiError("OutLayer has no attestation for this transaction.", "NOT_FOUND", 404)
      const p = AttestationSchema.safeParse(await res.json().catch(() => null))
      if (!p.success) throw new ApiError("OutLayer answered in an unexpected shape.", "BAD_RESPONSE", res.status)
      return p.data
    },
    staleTime: Infinity,
    retry: 1,
  })
}

/** demo-log keys release_N hold [propose, vote, execute]; the execute tx is the one OutLayer attests. */
export function releaseTxs(log: Record<string, string[]> | undefined): { id: number; txs: string[]; exec?: string }[] {
  if (!log) return []
  return Object.entries(log)
    .flatMap(([k, v]) => {
      const m = k.match(/^release_(\d+)$/)
      return m ? [{ id: Number(m[1]), txs: v, exec: v[v.length - 1] }] : []
    })
    .sort((a, b) => a.id - b.id)
}
