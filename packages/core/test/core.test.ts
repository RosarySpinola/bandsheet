import { describe, expect, it } from "vitest";
import {
  CRYPTO_INFO, EntrySchema, QuerySchema, SEED_JOINER, SEED_MEMBERS, decryptEntry, encryptEntry,
  generateX25519Keypair, naiveRelease, seedEntry, slotIdFromNearPublicKey, slotIdFromPublicKey,
  subtractionAttack, EnclaveOutputSchema, ReleaseRecordSchema, encryptBytes, decryptBytes,
} from "../src/index";
import { generateMemberKey, parseInvite } from "../src/near";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";

const slot = "ab".repeat(32);
const entries = (extra = false) => {
  const all = extra ? [...SEED_MEMBERS, SEED_JOINER] : [...SEED_MEMBERS];
  return all.map((m, i) => seedEntry(m, i.toString(16).padStart(64, "0"), 1_700_000_000));
};
const q = QuerySchema.parse({ id: 1, group_by: ["grade"], stat: "mean" });

describe("crypto", () => {
  it("round-trips an entry", () => {
    const kp = generateX25519Keypair();
    const e = { slot, gross_annual_eur: 70000, grade: "Senior", gender: "F", site: "City", submitted_at: 1 } as const;
    const c = encryptEntry(kp.publicKey, e);
    expect(Object.keys(c).sort()).toEqual(["ct", "epk", "nonce"]);
    expect(decryptEntry(kp.secretKey, c)).toEqual(e);
  });
  it("uses fresh randomness and rejects a wrong key or tampering", () => {
    const kp = generateX25519Keypair();
    const other = generateX25519Keypair();
    const a = encryptBytes(kp.publicKey, new Uint8Array([1, 2, 3]));
    const b = encryptBytes(kp.publicKey, new Uint8Array([1, 2, 3]));
    expect(a.ct).not.toEqual(b.ct);
    expect(() => decryptBytes(other.secretKey, a)).toThrow();
    const t = { ...a, ct: Buffer.from(Buffer.from(a.ct, "base64").map((x, i) => (i === 0 ? x ^ 1 : x))).toString("base64") };
    expect(() => decryptBytes(kp.secretKey, t)).toThrow();
  });
  it("pins the HKDF info string", () => expect(CRYPTO_INFO).toBe("bandsheet-entry-v1"));
});

describe("slot", () => {
  it("is hex(sha256(pubkey bytes))", () => {
    const k = generateMemberKey();
    expect(k.slot).toMatch(/^[0-9a-f]{64}$/);
    const raw = new Uint8Array(32).fill(7);
    expect(slotIdFromPublicKey(raw)).toBe(bytesToHex(sha256(raw)));
    expect(slotIdFromNearPublicKey(k.publicKey)).toBe(k.slot);
  });
  it("parses an invite and derives its slot", () => {
    const k = generateMemberKey();
    const inv = parseInvite({ account_id: "m1.testnet", contract_id: "bandsheet.testnet", private_key: k.privateKey });
    expect(inv.slot).toBe(k.slot);
    expect(() => parseInvite({ account_id: "x" })).toThrow();
  });
});

describe("schemas", () => {
  it("validates entries and rejects bad ones", () => {
    expect(EntrySchema.safeParse({ slot, gross_annual_eur: 1, grade: "Boss", gender: "F", site: "City", submitted_at: 1 }).success).toBe(false);
    expect(EntrySchema.safeParse({ slot: "short", gross_annual_eur: 1, grade: "Senior", gender: "F", site: "City", submitted_at: 1 }).success).toBe(false);
    expect(QuerySchema.safeParse({ id: 1, group_by: [], stat: "mean" }).success).toBe(false);
  });
  it("accepts enclave output and release records", () => {
    const out = {
      release_id: 2, status: "partially_released", cells: [{ key: { grade: "Chief" }, n: 3, mean_eur: 109333 }],
      suppressed: [{ key: { grade: "Senior" }, reason: "differencing", witness: "Release #2 row Senior - Release #1 row Senior isolates 1 member" }],
      history: "blob", input_hash: "aa", output_hash: "bb",
    };
    expect(EnclaveOutputSchema.parse(out).status).toBe("partially_released");
    expect(ReleaseRecordSchema.parse({ id: 2, status: "error", extra: 1 })).toMatchObject({ extra: 1 });
  });
});

describe("seed and the naive tool", () => {
  it("has 36 realistic members across all grades, with a gender gap", () => {
    expect(SEED_MEMBERS).toHaveLength(36);
    expect(new Set(SEED_MEMBERS.map((m) => m.grade)).size).toBe(5);
    expect(new Set(SEED_MEMBERS.map((m) => m.name)).size).toBe(36);
    const mean = (g: string, s: string) => {
      const xs = SEED_MEMBERS.filter((m) => m.grade === g && m.gender === s).map((m) => m.gross_annual_eur);
      return xs.reduce((a, b) => a + b, 0) / xs.length;
    };
    for (const g of ["Reporter", "Senior", "Editor"]) expect(mean(g, "M")).toBeGreaterThan(mean(g, "F") * 1.05);
  });
  it("release #1 passes n>=3 for every grade", () => {
    const r1 = naiveRelease(entries(), q);
    expect(r1.map((c) => c.n).sort((a, b) => a - b)).toEqual([3, 5, 8, 9, 11]);
  });
  it("hero: the typical n>=3 tool reveals exactly EUR 70,000", () => {
    const r1 = naiveRelease(entries(), q);
    const r2 = naiveRelease(entries(true), q);
    const s1 = r1.find((c) => c.key.grade === "Senior")!;
    const s2 = r2.find((c) => c.key.grade === "Senior")!;
    expect([s1.n, s1.mean_eur, s2.n, s2.mean_eur]).toEqual([9, 62400, 10, 63160]);
    const revealed = subtractionAttack(r1, r2);
    expect(revealed).toHaveLength(1);
    expect(revealed[0]).toMatchObject({ key: { grade: "Senior" }, revealed_eur: 70000 });
    expect(revealed[0]!.equation).toBe("10 x 63160 - 9 x 62400 = 70000");
  });
  it("small cells are dropped by the naive rule", () => {
    const two = entries().filter((e) => e.grade === "Chief").slice(0, 2);
    expect(naiveRelease(two, q)).toEqual([]);
  });
});
