import { z } from "zod"
import { CellSchema, ReleaseRecordSchema, GradeSchema } from "@bandsheet/core"

/* ---------- errors ---------- */

const ErrorBody = z.object({ error: z.string(), code: z.string().optional() })

/** Every failure the UI shows is one of these, already in plain words. */
export class ApiError extends Error {
  readonly code: string
  readonly status: number
  constructor(message: string, code = "UNKNOWN", status = 0) {
    super(message)
    this.name = "ApiError"
    this.code = code
    this.status = status
  }
}

const PLAIN: Record<string, string> = {
  SPEND_CAP: "The demo's NEAR AI Cloud budget is used up, so nothing more can be read for now. Nothing was sent.",
  ATTESTATION_FAILED: "NEAR AI Cloud's enclave could not prove what it is, so your payslip was never sent to it.",
  EXTRACT_UNREADABLE: "The figures on this payslip could not be read. Try a clearer image, or enter them by hand.",
  PDF_NO_TEXT_LAYER: "This PDF is a scan with no text inside. Upload a photo or PNG of the page instead.",
  PDF_UNREADABLE: "This PDF could not be opened. Upload a PNG or JPEG of the page instead.",
  UNSUPPORTED_TYPE: "Upload a PNG, JPEG or PDF payslip.",
  TOO_LARGE: "That file is over 6 MB. A phone photo or a one-page PDF is plenty.",
  NO_RELEASED_BANDS: "The chapel has not published any bands yet, so there is nothing to compare with.",
  CHAIN_READ: "NEAR testnet did not answer just now. It rate-limits public reads; try again in a moment.",
  CONTRACT_NOT_CONFIGURED: "The server does not know which contract to read yet.",
  NOT_MEMBER: "This key is not a registered member of the chapel, so the contract refused the entry.",
  NETWORK: "The Bandsheet server could not be reached. Check that it is running and try again.",
  SERVER_DOWN: "The Bandsheet server did not answer just now, perhaps mid-restart. Nothing was stored; try again in a moment.",
  NOT_FOUND: "This part of the demo server is not available yet.",
  DEMO_NOT_CONFIGURED: "This server has no demo member key. Paste an invite instead.",
  CHAIN_REJECTED: "The contract refused the entry.",
  INVITE_INVALID: "That invite could not be read. It needs account_id, contract_id and an ed25519 private_key.",
  BAD_REQUEST: "The request was not in the expected shape.",
  INTERNAL: "Something went wrong on the server. Nothing was stored.",
}

export function plainError(err: unknown): { title: string; detail: string; code: string } {
  if (err instanceof ApiError) {
    return { title: PLAIN[err.code] ?? sentence(err.message), detail: err.message, code: err.code }
  }
  const msg = err instanceof Error ? err.message : String(err)
  if (/not a registered member|outside the union/i.test(msg)) {
    return { title: PLAIN.NOT_MEMBER, detail: msg, code: "NOT_MEMBER" }
  }
  if (/refused on chain/i.test(msg)) return { title: PLAIN.CHAIN_REJECTED!, detail: msg, code: "CHAIN_REJECTED" }
  if (/429|rate limit/i.test(msg)) return { title: PLAIN.CHAIN_READ, detail: msg, code: "CHAIN_READ" }
  return { title: "Something went wrong. Nothing was stored.", detail: msg, code: "UNKNOWN" }
}

const sentence = (s: string) => (s ? s[0]!.toUpperCase() + s.slice(1).replace(/\.?$/, ".") : "Something went wrong.")

/* ---------- fetch ---------- */

export async function api<T>(path: string, schema: z.ZodType<T>, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(`/api${path}`, init)
  } catch {
    throw new ApiError(PLAIN.NETWORK!, "NETWORK")
  }
  const body: unknown = await res.json().catch(() => null)
  if (!res.ok) {
    const e = ErrorBody.safeParse(body)
    if (!e.success) throw new ApiError(PLAIN.SERVER_DOWN!, "SERVER_DOWN", res.status)
    throw new ApiError(e.data.error, e.data.code ?? "UNKNOWN", res.status)
  }
  const parsed = schema.safeParse(body)
  if (!parsed.success) throw new ApiError("The server answered in an unexpected shape.", "BAD_RESPONSE", res.status)
  return parsed.data
}

export const postJson = (body: unknown): RequestInit => ({
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
})

/* ---------- shapes (mirrors server/src/routes/*.ts) ---------- */

export const CheckSchema = z.object({ id: z.string(), label: z.string(), pass: z.boolean(), detail: z.string().optional() })
export type Check = z.infer<typeof CheckSchema>

export const VerifiedSchema = z.object({
  all_passed: z.boolean(),
  model: z.string(),
  owned_by: z.string().optional(),
  nonce: z.string(),
  chat_id: z.string().optional(),
  signature_kind: z.string().optional(),
  signers: z.object({ gateway: z.string().optional(), model: z.array(z.string()) }),
  checks: z.array(CheckSchema),
  verified_at: z.string(),
})
export type Verified = z.infer<typeof VerifiedSchema>

export const ExtractResponseSchema = z.object({
  extracted: z.object({
    gross_annual_eur: z.number().nullable(),
    gross_amount: z.number(),
    period: z.enum(["monthly", "annual", "weekly", "biweekly", "fourweekly"]),
    currency: z.string(),
    grade_guess: GradeSchema.nullable(),
    role_text: z.string().nullable(),
    source: z.enum(["image", "pdf_text"]),
    warnings: z.array(z.string()),
  }),
  verified: VerifiedSchema,
})
export type ExtractResponse = z.infer<typeof ExtractResponseSchema>

export const PositionSchema = z.object({
  grade: z.string(),
  your_eur: z.number(),
  band_mean_eur: z.number(),
  band_n: z.number(),
  delta_eur: z.number(),
  delta_pct: z.number(),
  relation: z.enum(["below", "near", "above"]),
})
export type Position = z.infer<typeof PositionSchema>

export const StandResponseSchema = z.object({
  position: PositionSchema.nullable(),
  answer: z.string(),
  letter: z.object({ subject: z.string(), body: z.string() }),
  source: z.enum(["model", "fallback"]),
  release_id: z.union([z.number(), z.string()]).nullable(),
  verified: VerifiedSchema,
})
export type StandResponse = z.infer<typeof StandResponseSchema>

export const ReleasesResponseSchema = z.object({
  contract: z.string(),
  network: z.string(),
  releases: z.array(ReleaseRecordSchema),
  latest_bands: z.object({ release_id: z.number(), cells: z.array(CellSchema) }).nullable(),
})
export type ReleasesResponse = z.infer<typeof ReleasesResponseSchema>

/** /api/demo/invite is tolerant: the invite itself, or {invite}. */
export const DemoInviteSchema = z.union([
  z.object({ invite: z.record(z.string(), z.unknown()) }).transform((v) => v.invite),
  z.record(z.string(), z.unknown()),
])

/** POST /api/demo/submit: the server signs `submit` with the same demo member key. */
export const DemoSubmitSchema = z.object({
  slot: z.string(),
  entry_count: z.number().nullable(),
  tx: z.object({ hash: z.string(), url: z.string().optional() }),
})
export type DemoSubmit = z.infer<typeof DemoSubmitSchema>

/* ---------- calls ---------- */

export const extractPayslip = (file: File) => {
  const fd = new FormData()
  fd.append("file", file)
  return api("/extract", ExtractResponseSchema, { method: "POST", body: fd })
}

export const StandRequestSchema = z.object({
  gross_annual_eur: z.number().int().min(1).max(10_000_000),
  grade: GradeSchema,
})
export type StandRequest = z.infer<typeof StandRequestSchema>

export const askStand = (req: StandRequest) => api("/stand", StandResponseSchema, postJson(StandRequestSchema.parse(req)))
export const getReleasesApi = () => api("/releases", ReleasesResponseSchema)
export const getDemoInvite = () => api("/demo/invite", DemoInviteSchema)
export const demoSubmit = (ciphertext: { epk: string; nonce: string; ct: string }) =>
  api("/demo/submit", DemoSubmitSchema, postJson({ ciphertext }))
