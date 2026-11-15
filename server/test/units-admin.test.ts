import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { KeyPair } from "near-api-js";
import { describe, expect, it } from "vitest";
import type { KeyStatus } from "../src/auth/keys";
import { dkimKeyFromTxt, dkimSignatures, fetchDkimKey } from "../src/units/dkim";
import { syntheticGrades } from "../src/units/synthetic";
import { CREATOR, ENCLAVE_PUB, REGISTRAR, setupUnits, walletSign } from "./units-helpers";

const kp = KeyPair.fromRandom("ed25519");
const council = { [`${CREATOR}|${kp.getPublicKey().toString()}`]: "full_access" as KeyStatus };
const OUTSIDER = "pedro-alves.testnet";
const okp = KeyPair.fromRandom("ed25519");
const both = { ...council, [`${OUTSIDER}|${okp.getPublicKey().toString()}`]: "full_access" as KeyStatus };
const FIX = resolve(__dirname, "../../fixtures/dkim");
const eml = readFileSync(resolve(FIX, "emails/noor-haddad.eml"), "utf8");
const issuer = JSON.parse(readFileSync(resolve(FIX, "issuer.json"), "utf8")) as { domain: string; selector: string; rsa_pubkey_spki_b64: string };

const synthetic = async (s: ReturnType<typeof setupUnits>, n: number, who = kp, account = CREATOR, extra: Record<string, unknown> = {}) => {
  const nonce = await s.nonce("unit_synthetic");
  return s.post("/units/1/synthetic", { ...(await walletSign(who, account, `Bandsheet synthetic 1: ${n}`, nonce)), n, ...extra });
};

describe("POST /api/units/:id/synthetic", () => {
  it("a council-signed request adds n flagged synthetic members, each with one sealed entry", async () => {
    const s = setupUnits(council);
    const r = await synthetic(s, 4);
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ unit_id: 1, synthetic: true, added: 4, submitted: 4, synthetic_total: 4 });
    // one single-action transaction per key (the registrar holds a function-call key)
    expect(s.calls).toHaveLength(4);
    expect(s.calls.every((t) => t.signer === REGISTRAR.accountId && t.calls.length === 1)).toBe(true);
    expect(s.calls.every((t) => t.calls[0]!.method === "unit_add_member" && (t.calls[0]!.args as { synthetic: boolean }).synthetic === true)).toBe(true);
    expect(s.submits).toHaveLength(4);
    const ct = s.submits[0]!.ciphertext as Record<string, string>;
    expect(Object.keys(ct).sort()).toEqual(["ct", "epk", "nonce"]);
    // the pay figures exist only inside the seal: nothing in the reply or the calls carries them
    expect(JSON.stringify(r.body) + JSON.stringify(s.calls)).not.toMatch(/gross_annual_eur|Senior/);
    expect(s.units.get(1)!.synthetic_added).toBe(4);
  });

  it("is capped at 8 per unit, counting earlier adds", async () => {
    const s = setupUnits(council);
    expect((await synthetic(s, 6)).status).toBe(200);
    const r = await synthetic(s, 3);
    expect(r).toMatchObject({ status: 409, body: { code: "SYNTHETIC_CAP" } });
    expect((await synthetic(s, 2)).status).toBe(200);
    expect((await synthetic(s, 1)).body.code).toBe("SYNTHETIC_CAP");
    const n = await s.nonce("unit_synthetic");
    expect((await s.post("/units/1/synthetic", { ...(await walletSign(kp, CREATOR, "Bandsheet synthetic 1: 9", n)), n: 9 })).status).toBe(400);
  });

  it("refuses an account that is not on the council, and a signature over another n", async () => {
    const s = setupUnits(both);
    expect((await synthetic(s, 2, okp, OUTSIDER)).body.code).toBe("NOT_COUNCIL");
    const n = await s.nonce("unit_synthetic");
    const r = await s.post("/units/1/synthetic", { ...(await walletSign(kp, CREATOR, "Bandsheet synthetic 1: 2", n)), n: 8 });
    expect(r.body.code).toBe("SIGNATURE_INVALID");
    expect(s.calls).toHaveLength(0);
  });

  it("picks grades in groups of three or more", () => {
    expect(syntheticGrades(4)).toEqual(["Senior", "Senior", "Senior", "Senior"]);
    const g = syntheticGrades(8);
    expect(g.filter((x) => x === "Reporter").length).toBeGreaterThanOrEqual(3);
    expect(g.filter((x) => x === "Senior").length).toBeGreaterThanOrEqual(3);
    expect(syntheticGrades(3, "Editor")).toEqual(["Editor", "Editor", "Editor"]);
    expect(ENCLAVE_PUB).toHaveLength(44);
  });
});

describe("POST /api/units/:id/issuer", () => {
  const txt = (p: string) => ({ Status: 0, Answer: [{ type: 16, data: `"v=DKIM1; k=rsa; " "p=${p.slice(0, 100)}" "${p.slice(100)}"` }] });
  const doh = (answer: unknown) => (async () => new Response(JSON.stringify(answer), { status: 200 })) as unknown as typeof fetch;

  it("reads d= and s= from the email, fetches the key over DoH and records it", async () => {
    const seen: string[] = [];
    const fetchFn = (async (url: string) => {
      seen.push(url);
      return new Response(JSON.stringify(txt(issuer.rsa_pubkey_spki_b64)), { status: 200 });
    }) as unknown as typeof fetch;
    const s = setupUnits({}, { doh: fetchFn });
    const r = await s.post("/units/1/issuer", { eml });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ domain: "harbourcourier.example", selector: "payroll2026", source: "dns" });
    expect(seen[0]).toContain("name=payroll2026._domainkey.harbourcourier.example");
    expect(s.units.get(1)!.issuers[0]).toMatchObject({ source: "dns", key: issuer.rsa_pubkey_spki_b64 });
  });

  it("refuses an email whose signing domain is not listed, and one with no DKIM signature", async () => {
    const s = setupUnits({}, { doh: doh(txt(issuer.rsa_pubkey_spki_b64)) });
    const untrusted = readFileSync(resolve(FIX, "emails/untrusted.eml"), "utf8");
    expect((await s.post("/units/1/issuer", { eml: untrusted })).body.code).toBe("DOMAIN_NOT_LISTED");
    const unsigned = readFileSync(resolve(FIX, "emails/unsigned.eml"), "utf8");
    expect((await s.post("/units/1/issuer", { eml: unsigned })).body.code).toBe("NO_DKIM");
    expect(s.calls).toHaveLength(0);
  });

  it("answers DNS_NO_KEY when the selector has no record (the fictional domain)", async () => {
    const s = setupUnits({}, { doh: doh({ Status: 3 }) });
    expect((await s.post("/units/1/issuer", { eml })).body.code).toBe("DNS_NO_KEY");
  });

  it("test seam: a council member supplies the key for a listed domain, recorded as supplied", async () => {
    const s = setupUnits(both, { doh: doh({ Status: 3 }) });
    const pem = `-----BEGIN PUBLIC KEY-----\n${issuer.rsa_pubkey_spki_b64.match(/.{1,64}/g)!.join("\n")}\n-----END PUBLIC KEY-----\n`;
    let n = await s.nonce("unit_issuer");
    let r = await s.post("/units/1/issuer", { eml, supplied_key: pem, claim: await walletSign(kp, CREATOR, "Bandsheet issuer 1: harbourcourier.example payroll2026", n) });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ source: "supplied" });
    expect(String(r.body.note)).toMatch(/not read from DNS/);
    expect(s.units.get(1)!.issuers[0]).toMatchObject({ source: "supplied", key: issuer.rsa_pubkey_spki_b64 });
    n = await s.nonce("unit_issuer");
    r = await s.post("/units/1/issuer", { eml, supplied_key: pem, claim: await walletSign(okp, OUTSIDER, "Bandsheet issuer 1: harbourcourier.example payroll2026", n) });
    expect(r.body.code).toBe("NOT_COUNCIL");
    expect((await s.post("/units/1/issuer", { eml, supplied_key: pem })).status).toBe(400);
  });
});

describe("DKIM parsing", () => {
  it("finds d= and s= in folded headers", () => {
    const raw = "From: a@x.example\r\nDKIM-Signature: v=1; a=rsa-sha256; c=relaxed/relaxed;\r\n\td=Payroll.Example.com; s=sel1;\r\n h=from:to; bh=abc; b=def\r\n\r\nbody";
    expect(dkimSignatures(raw)).toEqual([{ domain: "payroll.example.com", selector: "sel1" }]);
    expect(dkimSignatures("From: a@b\n\nDKIM-Signature: d=x.example; s=s")).toEqual([]);
  });
  it("joins split TXT strings and refuses non-RSA or empty keys", () => {
    const p = issuer.rsa_pubkey_spki_b64;
    expect(dkimKeyFromTxt(`"v=DKIM1; k=rsa; p=${p.slice(0, 50)}" "${p.slice(50)}"`)).toBe(p);
    expect(dkimKeyFromTxt(`v=DKIM1; p=${p}`)).toBe(p);
    expect(dkimKeyFromTxt(`"v=DKIM1; k=ed25519; p=${p}"`)).toBeUndefined();
    expect(dkimKeyFromTxt(`"v=DKIM1; k=rsa; p="`)).toBeUndefined();
  });
  it("falls back to the second resolver and reports an outage as DNS_UNAVAILABLE", async () => {
    const calls: string[] = [];
    const flaky = (async (url: string) => {
      calls.push(url);
      if (url.includes("cloudflare")) return new Response("busy", { status: 503 });
      return new Response(JSON.stringify({ Status: 0, Answer: [{ type: 16, data: `"v=DKIM1; k=rsa; p=${issuer.rsa_pubkey_spki_b64}"` }] }), { status: 200 });
    }) as unknown as typeof fetch;
    expect(await fetchDkimKey("harbourcourier.example", "payroll2026", flaky)).toBe(issuer.rsa_pubkey_spki_b64);
    expect(calls[1]).toContain("dns.google");
    const down = (async () => { throw new Error("offline"); }) as unknown as typeof fetch;
    await expect(fetchDkimKey("a.example", "s", down)).rejects.toMatchObject({ code: "DNS_UNAVAILABLE" });
  });
});
