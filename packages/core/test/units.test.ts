import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { decryptBytes, encryptUnitEntry, generateX25519Keypair, inviteCodeOf, inviteHashOf, newUnitInvite, unitStatement } from "../src";

const sha = (s: string) => createHash("sha256").update(s).digest("hex");

describe("units", () => {
  it("invite hash is sha256 of the code, and the code is sha256 of the secret", () => {
    const inv = newUnitInvite();
    expect(inv.secret).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(inv.code).toBe(sha(inv.secret));
    expect(inv.hash).toBe(sha(inv.code));
    expect(inviteHashOf("sandbox-link-secret")).toBe("a34124e4238b812497b96d0a2e96636a13c7000337b5caa98b25fbb691ccea46");
    expect(inviteCodeOf("sandbox-link-secret")).toBe("817e0e35f1e4a352a00b2eb0632bd700b76a180e2fa301d6a2ccecca203a2060");
  });
  it("statements are fixed sentences", () => {
    expect(unitStatement("unit_join", 4, "ed25519:abc")).toBe("Bandsheet join unit 4: ed25519:abc");
    expect(unitStatement("unit_synthetic", 4, "3")).toBe("Bandsheet synthetic 4: 3");
  });
  it("a unit entry keeps its email inside the seal", () => {
    const kp = generateX25519Keypair();
    const ct = encryptUnitEntry(kp.publicKey, { slot: "a".repeat(64), gross_annual_eur: 50000, grade: "Senior", gender: "F", site: "City", submitted_at: 1, eml_b64: "RW1haWw=" });
    const plain = JSON.parse(new TextDecoder().decode(decryptBytes(kp.secretKey, ct)));
    expect(plain.eml_b64).toBe("RW1haWw=");
  });
});
