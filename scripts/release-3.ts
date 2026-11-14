// Release #3: same table, DKIM required. The enclave counts only entries whose payslip email verifies against a
// trusted issuer; the forged entry is rejected with a reason and a count, never an identity.
// Usage: tsx release-3.ts        (needs the engine adopted via governance.ts set-engine, and OutLayer pointing at it)
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { runRelease, type Query } from "./dao";
import { ROOT, loadState, say, step, view } from "./lib";

const LOG = `${ROOT}/scripts/demo-log.json`;
const st = loadState();
const n = await view<number>(st.unit, "release_count");
if (n >= 3) { say(`release #3 already logged (${n} releases)`); process.exit(0); }
step(`DKIM required: ${await view<boolean>(st.unit, "get_require_dkim")}; issuers: ${(await view<unknown[]>(st.unit, "get_issuers")).length}`);
const q: Query = { group_by: ["grade"], stat: "mean" };
const r = await runRelease(q, "Release #3: mean pay by grade (DKIM-verified payslips only)");
const log: Record<string, string[]> = existsSync(LOG) ? JSON.parse(readFileSync(LOG, "utf8")) : {};
log["release_3"] = [...(log["release_3"] ?? []), ...r.links];
writeFileSync(LOG, JSON.stringify(log, null, 2) + "\n");
if (r.record) {
  say(`rejections: ${JSON.stringify(r.record.rejections)}   entries_verified: ${r.record.entries_verified}   engine ${String(r.record.wasm_sha256).slice(0, 12)}...`);
}
