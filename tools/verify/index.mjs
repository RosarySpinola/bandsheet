#!/usr/bin/env node
// Bandsheet verifier: one command, no keys, read-only. Exit code 1 on any FAIL.
// Usage: pnpm verify [--json] [--offline] [--full] [--api <base url>]
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import * as c from "./checks.mjs";
import { checkUnits } from "./units.mjs";

const args = process.argv.slice(2);
const flag = (n) => args.includes(`--${n}`);
if (flag("help")) {
  console.log("pnpm verify [--json] [--offline] [--full] [--units] [--api <base url>]\n" +
    "  --units    also check the units contract (start your own unit); the judged checks are unchanged\n" +
    "  --offline  only the checks that need no network\n  --full     also re-run `make -C enclave evaluate` (needs Rust)");
  process.exit(0);
}
const apiBase = args[args.indexOf("--api") + 1]?.startsWith("http") ? args[args.indexOf("--api") + 1] : "https://bandsheet.pages.dev";
const json = flag("json");
const results = [];
const emit = (title, rows) => {
  if (!json) console.log(`\n${title}`);
  for (const r of rows) {
    results.push(r);
    if (!json) console.log(`  ${r.ok ? "PASS" : "FAIL"}  ${r.text}`);
  }
};
const guard = async (title, id, fn) => {
  try { emit(title, await fn()); } catch (e) { emit(title, [{ id, ok: false, text: `could not complete: ${String(e.message).slice(0, 140)}` }]); }
};

const deployed = JSON.parse(readFileSync(join(c.ROOT, "scripts/deployed.json"), "utf8"));
const log = JSON.parse(readFileSync(join(c.ROOT, "scripts/demo-log.json"), "utf8"));
const docs = c.loadDocs();
const unit = {};
if (!json) console.log(`Bandsheet verify  (${deployed.unit}, NEAR testnet, read-only, no keys)`);

if (!flag("offline")) {
  await guard("A. Deployed contract code", "a", () => c.checkCode(deployed, unit));
  await guard("B. Contract policy", "b", () => c.checkPolicy(deployed, docs, unit));
  await guard("C. Releases bound to OutLayer attestations", "c", () => c.checkReleases(deployed, log, unit));
  await guard("D. Differencing attack, re-derived", "d", async () => c.checkSubtraction(unit));
}
await guard("E. Offline evaluation (100 attack cases)", "e", async () => c.checkEvaluation(docs));
if (flag("full")) {
  const has = spawnSync("cargo", ["--version"], { encoding: "utf8" }).status === 0;
  if (!has) emit("E+. Full re-run", [{ id: "e3", ok: false, text: "--full needs a Rust toolchain (cargo not found)" }]);
  else {
    const r = spawnSync("make", ["-C", join(c.ROOT, "enclave"), "evaluate"], { encoding: "utf8" });
    const after = JSON.parse(readFileSync(join(c.ROOT, "enclave/evaluation/results.json"), "utf8")).summary;
    emit("E+. Full re-run", [{ id: "e3", ok: r.status === 0 && after.naive.cases_leaking === 95 && after.bandsheet.cases_leaking === 0,
      text: `make -C enclave evaluate exited ${r.status}; results: ${after.naive.cases_leaking}/100 vs ${after.bandsheet.cases_leaking}/100` }]);
  }
}
if (!flag("offline")) await guard("F. Deployed API", "f", () => c.checkApi(deployed, unit, apiBase));
if (flag("units") && !flag("offline")) await guard("U. Units contract (optional)", "u", () => checkUnits(c.ROOT, docs));

const failed = results.filter((r) => !r.ok).length;
if (json) console.log(JSON.stringify({ ok: failed === 0, passed: results.length - failed, failed, checks: results }, null, 2));
else console.log(`\n${failed === 0 ? "ALL CHECKS PASSED" : `${failed} CHECK(S) FAILED`}  (${results.length - failed}/${results.length})`);
process.exit(failed === 0 ? 0 : 1);
