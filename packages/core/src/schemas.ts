import { z } from "zod";
import { GENDERS, GRADES, GROUP_FIELDS, SITES } from "./constants";

export const GradeSchema = z.enum(GRADES);
export const GenderSchema = z.enum(GENDERS);
export const SiteSchema = z.enum(SITES);
export const GroupFieldSchema = z.enum(GROUP_FIELDS);

/** Slot id = hex(sha256(member ed25519 public key bytes)): 64 lowercase hex chars. */
export const SlotIdSchema = z.string().regex(/^[0-9a-f]{64}$/, "slot must be 64 lowercase hex chars");

export const EntrySchema = z.object({
  slot: SlotIdSchema,
  gross_annual_eur: z.number().int().min(1).max(10_000_000),
  grade: GradeSchema,
  gender: GenderSchema,
  site: SiteSchema,
  submitted_at: z.number().int().nonnegative(),
});
export type Entry = z.infer<typeof EntrySchema>;

const b64 = z.string().regex(/^[A-Za-z0-9+/]+={0,2}$/, "must be base64");
/** Ciphertext as stored on chain: base64 {epk, nonce, ct}. */
export const CiphertextSchema = z.object({ epk: b64, nonce: b64, ct: b64 });
export type Ciphertext = z.infer<typeof CiphertextSchema>;

export const QuerySchema = z.object({
  id: z.number().int().nonnegative(),
  group_by: z.array(GroupFieldSchema).min(1),
  filter: z.record(z.string(), z.string()).optional(),
  stat: z.literal("mean"),
});
export type Query = z.infer<typeof QuerySchema>;

/** Opaque encrypted history carried between releases (shape owned by the enclave). */
export const HistoryBlobSchema = z.unknown();

export const EnclaveInputSchema = z.object({
  policy: z.object({ k: z.number().int().min(2) }),
  query: QuerySchema,
  entries: z.array(CiphertextSchema),
  history: HistoryBlobSchema.nullable(),
});
export type EnclaveInput = z.infer<typeof EnclaveInputSchema>;

export const CellKeySchema = z.record(z.string(), z.string());
export const CellSchema = z.object({
  key: CellKeySchema,
  n: z.number().int().nonnegative(),
  mean_eur: z.number().int(),
});
export type Cell = z.infer<typeof CellSchema>;

export const SuppressedSchema = z.object({
  key: CellKeySchema,
  reason: z.enum(["small_cell", "differencing"]),
  witness: z.string(),
});
export type Suppressed = z.infer<typeof SuppressedSchema>;

export const ReleaseStatusSchema = z.enum(["released", "partially_released", "refused"]);

export const EnclaveOutputSchema = z.object({
  release_id: z.union([z.number().int(), z.string()]),
  status: ReleaseStatusSchema,
  cells: z.array(CellSchema),
  suppressed: z.array(SuppressedSchema),
  history: HistoryBlobSchema,
  input_hash: z.string(),
  output_hash: z.string(),
});
export type EnclaveOutput = z.infer<typeof EnclaveOutputSchema>;

/** Contract-side status set: the enclave's three plus "error" (OutLayer failed or unreadable). */
export const ReleaseViewStatusSchema = z.enum(["released", "partially_released", "refused", "error"]);

/**
 * `ReleaseView` as returned by the contract's get_releases / get_release (see
 * contracts/bandsheet/src/types.rs). Tolerant: unknown keys are preserved.
 */
export const ReleaseRecordSchema = z
  .object({
    id: z.number().int(),
    status: ReleaseViewStatusSchema,
    query: z.unknown().optional(),
    requested_by: z.string().optional(),
    cells: z.array(CellSchema).default([]),
    suppressed: z.array(SuppressedSchema).default([]),
    input_hash: z.string().optional(),
    output_hash: z.string().optional(),
    input_sha256: z.string().optional(),
    output_sha256: z.string().optional(),
    proof: z.unknown().optional(),
    note: z.string().optional(),
    block_timestamp: z.union([z.string(), z.number()]).optional(),
  })
  .passthrough();
export type ReleaseRecord = z.infer<typeof ReleaseRecordSchema>;
