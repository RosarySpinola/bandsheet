import { z } from "zod"
import { useQuery } from "@tanstack/react-query"
import type { ReleaseRecord } from "@bandsheet/core"
import { CONTRACT, view } from "./chain"

/* ---------- release fields added with DKIM (null/absent on releases #1 and #2) ---------- */

export const RejectionSchema = z.object({ reason: z.string(), count: z.number().int().nonnegative() })
export type Rejection = z.infer<typeof RejectionSchema>

export const IssuerSchema = z.object({ domain: z.string(), selector: z.string(), rsa_pubkey_spki_b64: z.string() })
export type Issuer = z.infer<typeof IssuerSchema>

const ExtrasSchema = z.object({
  rejections: z.array(RejectionSchema).nullish().catch(null),
  entries_verified: z.number().int().nullish().catch(null),
  wasm_sha256: z.string().nullish().catch(null),
  require_dkim: z.boolean().nullish().catch(null),
  issuers: z.array(IssuerSchema).nullish().catch(null),
})

export type ReleaseExtras = {
  rejections: Rejection[]
  entriesVerified: number | null
  wasm: string | null
  requireDkim: boolean
  issuers: Issuer[]
}

/** Read the DKIM-era fields from a release record, tolerating their absence. */
export function extras(r: ReleaseRecord): ReleaseExtras {
  const p = ExtrasSchema.safeParse(r)
  const d = p.success ? p.data : {}
  return {
    rejections: (d.rejections ?? []).filter((x) => x.count > 0),
    entriesVerified: d.entries_verified ?? null,
    wasm: d.wasm_sha256 ?? null,
    requireDkim: Boolean(d.require_dkim),
    issuers: d.issuers ?? [],
  }
}

/* ---------- plain words for each rejection reason ---------- */

const REASONS: Record<string, { one: string; many: string; why: string }> = {
  dkim_bad_signature: { one: "forged payslip", many: "forged payslips", why: "signature didn't match the employer's key" },
  untrusted_issuer: { one: "payslip from an untrusted sender", many: "payslips from untrusted senders", why: "signed by a domain or key the chapel never trusted" },
  body_mismatch: { one: "entry that disagreed with its payslip", many: "entries that disagreed with their payslips", why: "the figures claimed didn't match the signed email" },
  no_email: { one: "entry without a signed payslip", many: "entries without a signed payslip", why: "no employer email was sealed with it" },
  duplicate_payslip: { one: "duplicate payslip", many: "duplicate payslips", why: "the same payslip was counted once" },
}

export function rejectionText(r: Rejection): string {
  const w = REASONS[r.reason] ?? { one: "entry", many: "entries", why: r.reason.replace(/_/g, " ") }
  return `${r.count} ${r.count === 1 ? w.one : w.many} refused: ${w.why}`
}

/* ---------- trust registry on the contract ---------- */

const chainQuery = { staleTime: 60_000, retry: 3, retryDelay: (n: number) => Math.min(1500 * 2 ** n, 8000) }

export function useIssuers() {
  return useQuery({
    queryKey: ["chain", "issuers"],
    queryFn: async () => z.array(IssuerSchema).parse(await view(CONTRACT, "get_issuers")),
    ...chainQuery,
  })
}

export function useRequireDkim() {
  return useQuery({
    queryKey: ["chain", "require_dkim"],
    queryFn: async () => z.boolean().parse(await view(CONTRACT, "get_require_dkim")),
    ...chainQuery,
  })
}

/** sha256 of the DER SPKI bytes, hex: the key fingerprint anyone can recompute with openssl. */
export async function spkiFingerprint(spkiB64: string): Promise<string> {
  const bin = atob(spkiB64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  const digest = await crypto.subtle.digest("SHA-256", bytes)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("")
}

export function useFingerprint(spkiB64: string | undefined) {
  return useQuery({
    queryKey: ["fingerprint", spkiB64],
    enabled: Boolean(spkiB64),
    queryFn: () => spkiFingerprint(spkiB64!),
    staleTime: Infinity,
  })
}

/* ---------- Eurostat context (GET /api/context) ---------- */

export const ContextSchema = z.object({
  country: z.string(),
  country_name: z.string(),
  isco08: z.string(),
  isco_label: z.string(),
  /** e.g. "Malta median · Professionals · Eurostat SES 2018" (one country, never "EU median"). */
  label: z.string().optional(),
  year: z.number(),
  unit: z.string(),
  median_monthly_eur: z.number(),
  source_url: z.string(),
  api_url: z.string().optional(),
  population: z.string().optional(),
  snapshot_sha256: z.string().optional(),
  caveat: z.string().optional(),
})
export type WageContext = z.infer<typeof ContextSchema>
