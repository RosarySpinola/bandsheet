import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app";
import type { Deps } from "../src/deps";
import { SERVER_DIR } from "../src/env";
import { chainCfg, config, mockChain } from "./helpers";
import { SpendCapError } from "../src/errors";
import type { ChatRequest, Verified, VerifiedChat } from "../src/nearai/client";
import { toAnnual } from "../src/routes/extract";
import { positionFor } from "../src/routes/stand";
import { SpendGuard } from "../src/spend";

const verified: Verified = { all_passed: true, model: "m", nonce: "n", signers: { model: [] }, checks: [], verified_at: "t" };
const BANDS = [
  { key: { grade: "Senior" }, n: 9, mean_eur: 62400 },
  { key: { grade: "Reporter" }, n: 11, mean_eur: 43000 },
];

function makeApp(content: string | ((r: ChatRequest) => string), over: Partial<Deps> = {}) {
  const calls: ChatRequest[] = [];
  const deps: Deps = {
    config,
    guard: new SpendGuard({ path: config.ledgerPath, getPrice: async () => ({ prompt: 0, completion: 0 }) }),
    chat: async (req): Promise<VerifiedChat> => {
      calls.push(req);
      return { content: typeof content === "function" ? content(req) : content, usage: {}, verified };
    },
    view: async () => [],
    chain: mockChain().chain,
    chainCfg: chainCfg(),
    ...over,
  };
  return { app: createApp(deps), calls };
}
const png = readFileSync(resolve(SERVER_DIR, "fixtures/payslips/payslip-senior-monthly.png"));
const pdf = readFileSync(resolve(SERVER_DIR, "fixtures/payslips/payslip-editor.pdf"));
const upload = (bytes: Buffer, type: string, name: string) => {
  const fd = new FormData();
  fd.set("file", new File([new Uint8Array(bytes)], name, { type }));
  return { method: "POST", body: fd };
};

describe("pure helpers", () => {
  it("annualises by period and flags non-EUR", () => {
    expect(toAnnual(5833.33, "monthly", "EUR").annual).toBe(70000);
    expect(toAnnual(1350, "weekly", "EUR").annual).toBe(70200);
    expect(toAnnual(5833, "monthly", "GBP").annual).toBeNull();
  });
  it("positions a figure against the grade band", () => {
    expect(positionFor("Senior", 70000, BANDS)).toMatchObject({ band_mean_eur: 62400, delta_eur: 7600, relation: "above", band_n: 9 });
    expect(positionFor("Chief", 1, BANDS)).toBeUndefined();
  });
});

describe("POST /api/extract", () => {
  const modelJson = '```json\n{"gross_amount":5833.33,"period":"monthly","currency":"EUR","grade_guess":"Senior","role_text":"Senior Reporter, Investigations"}\n```';
  it("reads an image payslip with the TEE vision model and returns the verified object", async () => {
    const { app, calls } = makeApp(modelJson);
    const res = await app.request("/api/extract", upload(png, "image/png", "p.png"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.extracted).toMatchObject({ gross_annual_eur: 70000, period: "monthly", currency: "EUR", grade_guess: "Senior", source: "image" });
    expect(body.verified.all_passed).toBe(true);
    expect(calls[0]!.model).toBe("Qwen/Qwen3-VL-30B-A3B-Instruct");
  });
  it("uses the text model for a PDF with a text layer", async () => {
    const { app, calls } = makeApp(modelJson);
    const res = await app.request("/api/extract", upload(pdf, "application/pdf", "p.pdf"));
    expect(res.status).toBe(200);
    expect((await res.json()).extracted.source).toBe("pdf_text");
    expect(calls[0]!.model).toBe("z-ai/glm-5.3-flash");
    expect(JSON.stringify(calls[0]!.messages)).toContain("Fatima Al-Sayed");
  });
  it("accepts JSON base64 uploads too", async () => {
    const { app } = makeApp(modelJson);
    const res = await app.request("/api/extract", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ file_base64: png.toString("base64"), mime: "image/png" }) });
    expect(res.status).toBe(200);
  });
  it("rejects unsupported types and empty bodies as { error, code }", async () => {
    const { app } = makeApp(modelJson);
    const r1 = await app.request("/api/extract", upload(Buffer.from("x"), "text/plain", "x.txt"));
    expect([r1.status, await r1.json()]).toEqual([415, { error: "upload a PNG, JPEG, WebP or PDF payslip", code: "UNSUPPORTED_TYPE" }]);
    const r2 = await app.request("/api/extract", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
    expect(r2.status).toBe(400);
  });
  it("returns EXTRACT_UNREADABLE (not the raw model output) when the model rambles", async () => {
    const { app } = makeApp("I cannot read this");
    const res = await app.request("/api/extract", upload(png, "image/png", "p.png"));
    expect([res.status, (await res.json()).code]).toEqual([422, "EXTRACT_UNREADABLE"]);
  });
  it("maps the spend cap to 402 SPEND_CAP", async () => {
    const { app } = makeApp("", { chat: async () => { throw new SpendCapError(); } });
    const res = await app.request("/api/extract", upload(png, "image/png", "p.png"));
    expect([res.status, await res.json()]).toEqual([402, { error: "spend cap reached", code: "SPEND_CAP" }]);
  });
  it("never leaks internal errors", async () => {
    const { app } = makeApp("", { chat: async () => { throw new Error("secret stack detail"); } });
    const res = await app.request("/api/extract", upload(png, "image/png", "p.png"));
    expect([res.status, await res.json()]).toEqual([500, { error: "internal error", code: "INTERNAL" }]);
  });
});

describe("POST /api/stand", () => {
  const good = JSON.stringify({
    answer: "You earn EUR 7,600 more than the Senior average of EUR 62,400, an average of 9 members.",
    letter: { subject: "Article 7 pay information request", body: "Dear HR, under Article 7 of Directive (EU) 2023/970 I request my individual pay level and average pay levels by sex for equal work. ".repeat(3) },
  });
  const post = (app: ReturnType<typeof createApp>, body: unknown) =>
    app.request("/api/stand", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

  it("answers and drafts an Article 7 letter without echoing the figure into the letter", async () => {
    const { app, calls } = makeApp(good);
    const res = await post(app, { gross_annual_eur: 70000, grade: "Senior", bands: BANDS });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.position).toMatchObject({ delta_eur: 7600, relation: "above" });
    expect(body.source).toBe("model");
    expect(body.letter.body).toContain("2023/970");
    expect(calls[0]!.model).toBe("z-ai/glm-5.3-flash");
  });
  it("falls back to the template letter when the model's letter is not an Article 7 request", async () => {
    const { app } = makeApp(JSON.stringify({ answer: "x".repeat(40), letter: { subject: "Hello", body: "Give me money. ".repeat(20) } }));
    const body = await (await post(app, { gross_annual_eur: 41000, grade: "Reporter", bands: BANDS })).json();
    expect(body.letter.body).toContain("Directive (EU) 2023/970");
  });
  it("still answers when the grade cell was suppressed", async () => {
    const { app } = makeApp("not json");
    const body = await (await post(app, { gross_annual_eur: 50000, grade: "Chief", bands: BANDS })).json();
    expect(body.position).toBeNull();
    expect(body.answer).toMatch(/could not publish/);
    expect(body.source).toBe("fallback");
  });
  it("reads the latest released bands from the contract when none are sent", async () => {
    const view = vi.fn(async () => [
      { id: 1, status: "released", cells: BANDS, suppressed: [] },
      { id: 2, status: "partially_released", cells: [BANDS[1]], suppressed: [{ key: { grade: "Senior" }, reason: "differencing", witness: "w" }] },
    ]);
    const { app } = makeApp(good, { view });
    const body = await (await post(app, { gross_annual_eur: 44000, grade: "Reporter" })).json();
    expect(body.release_id).toBe(2);
    expect(body.position.band_mean_eur).toBe(43000);
    const senior = await (await post(app, { gross_annual_eur: 70000, grade: "Senior" })).json();
    expect(senior.position.band_mean_eur).toBe(62400); // suppressed in #2, last published value from #1
    expect(view).toHaveBeenCalledWith("bandsheet-test.testnet", "get_releases", {});
  });
  it("validates input", async () => {
    const { app } = makeApp(good);
    expect((await post(app, { gross_annual_eur: -5, grade: "Senior" })).status).toBe(400);
    expect((await post(app, { gross_annual_eur: 5, grade: "Boss" })).status).toBe(400);
  });
});

describe("GET /api/releases and /api/health", () => {
  it("returns releases and the latest bands, tolerating a nested output", async () => {
    const view = async () => ({ releases: [{ id: 1, status: "released", output: { cells: BANDS, suppressed: [] } }, { id: 2, status: "refused" }] });
    const { app } = makeApp("", { view });
    const body = await (await app.request("/api/releases")).json();
    expect(body.releases).toHaveLength(2);
    expect(body.latest_bands.release_id).toBe(1);
  });
  it("reports chain read failures as CHAIN_READ and a missing contract as 503", async () => {
    const bad = makeApp("", { view: async () => { throw new Error("rpc down"); } });
    expect([(await bad.app.request("/api/releases")).status]).toEqual([502]);
    const none = makeApp("", { config: { ...config, contract: undefined } });
    const r = await none.app.request("/api/releases");
    expect([r.status, (await r.json()).code]).toEqual([503, "CONTRACT_NOT_CONFIGURED"]);
  });
  it("serves health with the spend summary", async () => {
    const body = await (await makeApp("").app.request("/api/health")).json();
    expect(body).toMatchObject({ ok: true, live: true });
    expect(body.spend.cap_usd).toBe(2.5);
  });
});
