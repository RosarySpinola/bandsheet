import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, randomBytes } from "@noble/hashes/utils.js";
import { z } from "zod";
import { encryptBytes } from "./crypto";
import { GRADES } from "./constants";
import { EntrySchema } from "./schemas";
import type { Ciphertext } from "./schemas";

/**
 * Units ("start your own unit", contracts/units). The invite link carries a random secret S; the contract stores
 * hex(sha256(invite_code)) where invite_code = hex(sha256(S)). Only the server ever sees S, so an invite code read
 * from an earlier join transaction on chain cannot be replayed through the server.
 */
const enc = new TextEncoder();
const hexSha = (s: string): string => bytesToHex(sha256(enc.encode(s)));

export const inviteCodeOf = (secret: string): string => hexSha(secret);
export const inviteHashOf = (secret: string): string => hexSha(inviteCodeOf(secret));

/** A fresh invite: 16 random bytes, base64url (22 chars), for the link `/join/<unit>?code=<secret>`. */
export function newUnitInvite(): { secret: string; code: string; hash: string } {
  let bin = "";
  for (const b of randomBytes(16)) bin += String.fromCharCode(b);
  const secret = btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return { secret, code: inviteCodeOf(secret), hash: inviteHashOf(secret) };
}

export const UNIT_PURPOSES = ["unit_join", "unit_synthetic", "unit_entry", "unit_issuer"] as const;
export type UnitPurpose = (typeof UNIT_PURPOSES)[number];

/** The exact sentence a wallet signs (NEP-413 message, or the first line of the EIP-191 text). */
export function unitStatement(purpose: UnitPurpose, unitId: number, subject: string): string {
  switch (purpose) {
    case "unit_join":
      return `Bandsheet join unit ${unitId}: ${subject}`;
    case "unit_synthetic":
      return `Bandsheet synthetic ${unitId}: ${subject}`;
    case "unit_entry":
      return `Bandsheet unit ${unitId} entry: ${subject}`;
    case "unit_issuer":
      return `Bandsheet issuer ${unitId}: ${subject}`;
  }
}

/** A published cell's key, the fields in a fixed order: {grade, gender, site} → "Senior F City". */
export type CellKey = { grade?: string; gender?: string; site?: string };
export const cellKeyText = (k: CellKey): string => [k.grade, k.gender, k.site].filter(Boolean).join(" ");

/**
 * The attack lab's council statement (signed as a unit_synthetic message): one synthetic colleague is added to (or
 * taken from) this cell of this release, so the same table can be asked for again. "attack release 1: Senior".
 */
export const attackSubject = (releaseId: number, cell: CellKey): string => `attack release ${releaseId}: ${cellKeyText(cell)}`;

/** A unit entry may carry the employer's payslip email (raw .eml, base64) so the engine can count it as DKIM-verified. */
export const UnitEntrySchema = EntrySchema.extend({ eml_b64: z.string().max(360_000).optional() });
export type UnitEntry = z.infer<typeof UnitEntrySchema>;

export function encryptUnitEntry(enclavePublicKey: Uint8Array, entry: UnitEntry): Ciphertext {
  return encryptBytes(enclavePublicKey, enc.encode(JSON.stringify(UnitEntrySchema.parse(entry))));
}

export type Grade = (typeof GRADES)[number];
