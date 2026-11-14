/** Offline-ish check: run the real verification logic (DCAP via PCCS, NRAS) over the recorded fixture. */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { SERVER_DIR } from "../src/env";
import { verifyGpuNras, verifyQuoteDcap } from "../src/nearai/dcap";
import { DEFAULT_ACCEPTED_TCB, verifyReport } from "../src/nearai/verify";

const f = JSON.parse(readFileSync(resolve(SERVER_DIR, process.argv[2] ?? "fixtures/attestation-qwen.json"), "utf8"));
const deps = { verifyQuote: verifyQuoteDcap, verifyGpu: verifyGpuNras, acceptedTcb: DEFAULT_ACCEPTED_TCB };
const results = [await verifyReport("gateway", f.report.gateway_attestation, f.nonce, deps)];
for (const m of f.report.model_attestations) results.push(await verifyReport("model", m, f.nonce, deps));
for (const r of results) for (const c of r.checks) process.stdout.write(`${c.pass ? "PASS" : "FAIL"} ${c.id} ${c.detail ?? ""}\n`);
