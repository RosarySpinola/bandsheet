/**
 * Records one real attestation report (free call, no completion) as a test fixture.
 * Usage: pnpm --filter server exec tsx scripts/record-attestation.ts [model] [outfile]
 * Counts as one live NEAR AI call and goes through the spend guard like any other.
 */
import { randomBytes } from "node:crypto";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { SERVER_DIR, apiKey, getConfig } from "../src/env";
import { NearAiClient } from "../src/nearai/client";
import { createPriceSource } from "../src/nearai/models";
import { DEFAULT_ACCEPTED_TCB } from "../src/nearai/verify";
import { verifyGpuNras, verifyQuoteDcap } from "../src/nearai/dcap";
import { SpendGuard } from "../src/spend";

const cfg = getConfig();
const model = process.argv[2] ?? cfg.visionModel;
const out = resolve(SERVER_DIR, process.argv[3] ?? "fixtures/attestation-qwen.json");
const prices = createPriceSource(cfg.baseUrl);
const guard = new SpendGuard({ path: cfg.ledgerPath, getPrice: prices.getPrice });
const client = new NearAiClient({
  baseUrl: cfg.baseUrl,
  guard,
  apiKey,
  deps: { verifyQuote: verifyQuoteDcap, verifyGpu: verifyGpuNras, acceptedTcb: DEFAULT_ACCEPTED_TCB },
});
const nonce = randomBytes(32).toString("hex");
const report = await guard.call(model, "attestation-record", { free: true }, async () => ({ r: await client.fetchAttestation(model, nonce) }));
writeFileSync(out, JSON.stringify({ recorded_at: new Date().toISOString(), model, nonce, report: report.r }, null, 1));
process.stdout.write(`recorded ${out} (${Object.keys(report.r).join(", ")})\n`);
