import { randomInt } from "node:crypto";
import { GRADES, type Grade, type UnitEntry, encryptUnitEntry, parseEnclavePublicKey } from "@bandsheet/core";
import { generateMemberKey } from "@bandsheet/core/near";

/** Annual gross ranges (EUR) per grade, close to the demo chapel's synthetic newsroom. */
const RANGES: Record<Grade, [number, number]> = {
  Junior: [30_000, 36_000],
  Reporter: [38_000, 47_000],
  Senior: [52_000, 63_000],
  Editor: [60_000, 71_000],
  Chief: [78_000, 92_000],
};

export const isGrade = (g: string): g is Grade => (GRADES as readonly string[]).includes(g);

/** Grades for n synthetic colleagues: all in one grade if given, else groups of at least 3 so bands can publish. */
export function syntheticGrades(n: number, grade?: Grade): Grade[] {
  if (grade) return Array(n).fill(grade);
  if (n < 6) return Array(n).fill("Senior");
  const half = Math.floor(n / 2);
  return [...Array(half).fill("Reporter"), ...Array(n - half).fill("Senior")];
}

export interface SyntheticMember {
  privateKey: string;
  publicKey: string;
  slot: string;
  ciphertext: ReturnType<typeof encryptUnitEntry>;
}

/**
 * n fresh posting keys and their sealed entries. Pay is random within the grade's range and exists only inside the
 * sealed ciphertext: it is never logged, stored or returned, so nobody can subtract it from a published band.
 */
export function makeSynthetic(n: number, enclavePubkey: string, grade?: Grade, now = Date.now()): SyntheticMember[] {
  const pub = parseEnclavePublicKey(enclavePubkey);
  return syntheticGrades(n, grade).map((g) => {
    const k = generateMemberKey();
    const [lo, hi] = RANGES[g];
    const entry: UnitEntry = {
      slot: k.slot,
      gross_annual_eur: Math.round(randomInt(lo, hi) / 100) * 100,
      grade: g,
      gender: randomInt(2) === 0 ? "F" : "M",
      site: randomInt(2) === 0 ? "City" : "Port",
      submitted_at: Math.floor(now / 1000),
    };
    return { privateKey: k.privateKey, publicKey: k.publicKey, slot: k.slot, ciphertext: encryptUnitEntry(pub, entry) };
  });
}
