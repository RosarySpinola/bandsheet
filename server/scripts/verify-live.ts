/**
 * Live check against NEAR AI Cloud (needs NEARAI_API_KEY in ../.env.local). Spends real, tiny money
 * through the spend guard (cap USD 2.50). Runs, with full attestation + signature verification:
 *   1. payslip image -> Qwen/Qwen3-VL-30B-A3B-Instruct  (extraction)
 *   2. "Where do I stand?" -> z-ai/glm-5.3-flash       (text)
 * Add --pdf to also run the PDF text-layer path (one more verified call).
 * Saves the verified objects and the recorded stand exchange under fixtures/ (synthetic data only).
 * Usage: pnpm --filter server verify:live
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createApp } from "../src/app";
import type { Deps } from "../src/deps";
import { SERVER_DIR, apiKey, getConfig } from "../src/env";
import { type RecordedExchange, NearAiClient } from "../src/nearai/client";
import { verifyGpuNras, verifyQuoteDcap } from "../src/nearai/dcap";
import { createPriceSource } from "../src/nearai/models";
import { DEFAULT_ACCEPTED_TCB } from "../src/nearai/verify";
import { SpendGuard } from "../src/spend";

const out = (s: string): void => void process.stdout.write(`${s}\n`);
const cfg = getConfig();
if (!cfg.hasKey) {
  out("PENDING: NEARAI_API_KEY is not set in .env.local; live verification not run.");
  process.exit(2);
}

const prices = createPriceSource(cfg.baseUrl);
const guard = new SpendGuard({ path: cfg.ledgerPath, getPrice: prices.getPrice });
const exchanges: RecordedExchange[] = [];
const client = new NearAiClient({
  baseUrl: cfg.baseUrl, guard, apiKey, ownedBy: prices.ownedBy,
  deps: { verifyQuote: verifyQuoteDcap, verifyGpu: verifyGpuNras, acceptedTcb: DEFAULT_ACCEPTED_TCB },
  record: (r) => exchanges.push(r),
});
const deps: Deps = { config: cfg, guard, chat: (r) => client.verifiedChat(r), view: async () => [], chain: undefined as never, chainCfg: undefined as never };
const app = createApp(deps);

const BANDS = [
  { key: { grade: "Senior" }, n: 9, mean_eur: 62400 },
  { key: { grade: "Reporter" }, n: 11, mean_eur: 43000 },
];
let failed = 0;
function show(title: string, body: { verified?: { all_passed: boolean; checks: { pass: boolean; id: string; detail?: string }[]; model: string; owned_by?: string } }): void {
  const v = body.verified;
  out(`\n== ${title}: model ${v?.model} (owned_by ${v?.owned_by ?? "?"}) all_passed=${v?.all_passed}`);
  for (const c of v?.checks ?? []) out(`  ${c.pass ? "PASS" : "FAIL"} ${c.id}${c.detail ? `  ${c.detail}` : ""}`);
  if (!v?.all_passed) failed++;
}

async function extract(file: string, mime: string, dir = resolve(SERVER_DIR, "fixtures/payslips")): Promise<Record<string, unknown>> {
  const fd = new FormData();
  fd.set("file", new File([new Uint8Array(readFileSync(resolve(dir, file)))], file, { type: mime }));
  const res = await app.request("/api/extract", { method: "POST", body: fd });
  const body = (await res.json()) as Record<string, unknown>;
  if (res.status !== 200) {
    out(`extract ${file} -> HTTP ${res.status} ${JSON.stringify(body)}`);
    failed++;
  }
  return body;
}

// --only-eml: one verified call on a DKIM-signed .eml payslip (fixtures/dkim/emails), recorded as fixtures/recorded-eml.json.
if (process.argv.includes("--only-eml")) {
  const ex = await extract("leila-benali.eml", "message/rfc822", resolve(SERVER_DIR, "../fixtures/dkim/emails"));
  out(`extracted: ${JSON.stringify(ex.extracted)}`);
  out(`dkim_preview: ${JSON.stringify(ex.dkim_preview)}`);
  show("extract (.eml)", ex as never);
  const ok = (ex.extracted as { gross_annual_eur?: number } | undefined)?.gross_annual_eur === 41200;
  out(`extraction correct (41200 expected): ${ok}`);
  const rec = exchanges[exchanges.length - 1];
  if (rec && !process.argv.includes("--no-save")) {
    writeFileSync(resolve(SERVER_DIR, "fixtures/recorded-eml.json"), JSON.stringify({ recorded_at: new Date().toISOString(), model: cfg.textModel, ...rec }, null, 1));
  }
  const t = await guard.summary();
  out(`spend ledger: USD ${t.total_usd.toFixed(6)} of ${t.cap_usd} over ${t.calls} entries`);
  process.exit(ok && failed === 0 ? 0 : 1);
}

// --skip-extract re-runs only the text path (saves a paid vision call while iterating).
const ex1: Record<string, unknown> = process.argv.includes("--skip-extract") ? {} : await extract("payslip-senior-monthly.png", "image/png");
if (ex1.extracted) {
  out(`extracted: ${JSON.stringify(ex1.extracted)}`);
  show("extract (image)", ex1 as never);
  const extractedOk = (ex1.extracted as { gross_annual_eur?: number }).gross_annual_eur === 70000;
  out(`extraction correct (70000 expected): ${extractedOk}`);
  if (!extractedOk) failed++;
}

const res2 = await app.request("/api/stand", {
  method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify({ gross_annual_eur: 70000, grade: "Senior", gender: "F", site: "City", bands: BANDS }),
});
const stand = (await res2.json()) as Record<string, unknown>;
out(`stand HTTP ${res2.status} source=${stand.source}`);
out(`answer: ${stand.answer}`);
out(`letter subject: ${(stand.letter as { subject?: string } | undefined)?.subject}`);
show("stand (text)", stand as never);
if (res2.status !== 200 || stand.source !== "model") failed++;

const standEx = exchanges[exchanges.length - 1];
if (standEx && !process.argv.includes("--no-save")) {
  writeFileSync(resolve(SERVER_DIR, "fixtures/recorded-stand.json"), JSON.stringify({ recorded_at: new Date().toISOString(), model: cfg.textModel, ...standEx }, null, 1));
  writeFileSync(resolve(SERVER_DIR, "fixtures/live-verify-result.json"), JSON.stringify({ at: new Date().toISOString(), extract: ex1, stand }, null, 1));
}

if (process.argv.includes("--pdf")) {
  const ex3 = await extract("payslip-editor.pdf", "application/pdf");
  out(`extracted (pdf): ${JSON.stringify(ex3.extracted)}`);
  show("extract (pdf text layer)", ex3 as never);
}

const s = await guard.summary();
out(`\nspend ledger: USD ${s.total_usd.toFixed(6)} of ${s.cap_usd} over ${s.calls} ledger entries`);
out(failed === 0 ? "LIVE VERIFICATION: ALL PASSED" : `LIVE VERIFICATION: ${failed} problem(s)`);
process.exit(failed === 0 ? 0 : 1);
