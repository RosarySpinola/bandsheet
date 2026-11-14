import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import type { Deps } from "../src/deps";
import { dkimPreview, parseEml } from "../src/eml";
import { REPO_ROOT, SERVER_DIR } from "../src/env";
import type { ChatRequest, Verified } from "../src/nearai/client";
import { SpendGuard } from "../src/spend";
import { chainCfg, config, mockChain } from "./helpers";

const eml = (n: string) => readFileSync(resolve(REPO_ROOT, "fixtures/dkim/emails", `${n}.eml`));
const verified: Verified = { all_passed: true, model: "m", nonce: "n", signers: { model: [] }, checks: [], verified_at: "t" };
const MODEL_JSON = '{"gross_amount":3433.33,"period":"monthly","currency":"EUR","grade_guess":"Reporter","role_text":null}';

function makeApp() {
  const calls: ChatRequest[] = [];
  const deps: Deps = {
    config, guard: new SpendGuard({ path: config.ledgerPath, getPrice: async () => ({ prompt: 0, completion: 0 }) }),
    chat: async (req) => { calls.push(req); return { content: MODEL_JSON, usage: {}, verified }; },
    view: async () => [], chain: mockChain().chain, chainCfg: chainCfg(),
  };
  return { app: createApp(deps), calls };
}
const upload = (bytes: Uint8Array, type: string, name: string) => {
  const fd = new FormData();
  fd.set("file", new File([new Uint8Array(bytes)], name, { type }));
  return { method: "POST", body: fd };
};

describe("dkim preview", () => {
  it("reads domain, selector and signed headers from a real signed fixture", () => {
    expect(dkimPreview(eml("leila-benali").toString("utf8"))).toEqual({
      has_signature: true, domain: "harbourcourier.example", selector: "payroll2026",
      signed_headers: ["from", "to", "subject", "date", "message-id"],
    });
  });
  it("reports a signature on the forged fixture too (display only; the enclave rejects it)", () => {
    expect(dkimPreview(eml("forged").toString("utf8")).has_signature).toBe(true);
  });
  it("handles unsigned and header-less input without throwing", () => {
    expect(dkimPreview("From: a@b.c\r\nSubject: x\r\n\r\nbody")).toEqual({ has_signature: false, domain: null, selector: null, signed_headers: [] });
    expect(dkimPreview("").has_signature).toBe(false);
    expect(dkimPreview("Subject: x\n\nDKIM-Signature: d=evil.example; s=x; h=from").has_signature).toBe(false); // only the header block counts
  });
});

describe("parseEml", () => {
  it("returns the text/plain body and subject", async () => {
    const p = await parseEml(eml("leila-benali"));
    expect(p.subject).toBe("Your payslip for October 2026");
    expect(p.text).toContain("Gross pay (month): EUR 3,433.33");
    expect(p.pdf).toBeUndefined();
  });
});

describe("POST /api/extract with .eml", () => {
  it("sends the body text to the TEE text model with low reasoning and returns dkim_preview", async () => {
    const { app, calls } = makeApp();
    const res = await app.request("/api/extract", upload(eml("leila-benali"), "message/rfc822", "payslip.eml"));
    const b = await res.json();
    expect(res.status).toBe(200);
    expect(b.extracted).toMatchObject({ gross_annual_eur: 41200, source: "eml", grade_guess: "Reporter" });
    expect(b.dkim_preview).toEqual({ has_signature: true, domain: "harbourcourier.example", selector: "payroll2026", signed_headers: ["from", "to", "subject", "date", "message-id"] });
    expect(b.verified.all_passed).toBe(true);
    expect(calls[0]).toMatchObject({ model: "z-ai/glm-5.3-flash", reasoning_effort: "low" });
    const prompt = JSON.stringify(calls[0]!.messages);
    expect(prompt).toContain("Employee ID: HC-8407");
    expect(prompt).not.toContain("DKIM-Signature"); // headers are not sent to the model
  });
  it("detects .eml by filename when the browser sends a generic type, and accepts JSON uploads", async () => {
    const { app } = makeApp();
    expect((await app.request("/api/extract", upload(eml("amara-nwosu"), "application/octet-stream", "slip.eml"))).status).toBe(200);
    const r = await app.request("/api/extract", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ file_base64: eml("amara-nwosu").toString("base64"), mime: "message/rfc822" }) });
    expect(r.status).toBe(200);
  });
  it("adds the text layer of an attached PDF", async () => {
    const pdf = readFileSync(resolve(SERVER_DIR, "fixtures/payslips/payslip-editor.pdf")).toString("base64");
    const mime = ["From: Payroll <p@harbourcourier.example>", "To: a@harbourcourier.example", "Subject: Payslip", "MIME-Version: 1.0",
      'Content-Type: multipart/mixed; boundary="B"', "", "--B", "Content-Type: text/plain", "", "Your payslip is attached. Please keep it safe for your records.", "--B",
      'Content-Type: application/pdf; name="slip.pdf"', 'Content-Disposition: attachment; filename="slip.pdf"', "Content-Transfer-Encoding: base64", "", pdf.replace(/(.{76})/g, "$1\r\n"), "--B--", ""].join("\r\n");
    const { app, calls } = makeApp();
    const res = await app.request("/api/extract", upload(Buffer.from(mime), "message/rfc822", "x.eml"));
    expect(res.status).toBe(200);
    expect(JSON.stringify(calls[0]!.messages)).toContain("Fatima Al-Sayed");
    expect((await res.json()).dkim_preview.has_signature).toBe(false);
  });
  it("rejects oversized, text-less and non-email bodies with { error, code }", async () => {
    const { app } = makeApp();
    const big = await app.request("/api/extract", upload(Buffer.alloc(1024 * 1024 + 1, 97), "message/rfc822", "big.eml"));
    expect([big.status, (await big.json()).code]).toEqual([413, "TOO_LARGE"]);
    const empty = await app.request("/api/extract", upload(Buffer.from("From: a@b.c\r\nSubject: hi\r\n\r\nok"), "message/rfc822", "e.eml"));
    expect([empty.status, (await empty.json()).code]).toEqual([422, "EML_NO_TEXT"]);
    const other = await app.request("/api/extract", upload(Buffer.from("x"), "text/plain", "x.txt"));
    expect(other.status).toBe(415);
  });
});
