/** Refreshes server/data/eurostat-snapshot.json from Eurostat (keyless). Run: pnpm --filter server tsx scripts/fetch-eurostat.ts */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { COUNTRIES, type CountryCode, eurostatUrl, snapshotHash } from "../src/context";
import { SERVER_DIR } from "../src/env";

const entries: Record<string, { raw: unknown; sha256: string }> = {};
for (const code of Object.keys(COUNTRIES) as CountryCode[]) {
  const res = await fetch(eurostatUrl(COUNTRIES[code].geo, "OC2"), { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`${code}: HTTP ${res.status}`);
  const raw = await res.json();
  entries[`${code}|OC2`] = { raw, sha256: snapshotHash(raw) };
  process.stdout.write(`${code} ok ${entries[`${code}|OC2`]!.sha256.slice(0, 12)}\n`);
  await new Promise((r) => setTimeout(r, 500));
}
writeFileSync(resolve(SERVER_DIR, "data/eurostat-snapshot.json"), `${JSON.stringify({ fetched_at: new Date().toISOString(), dataset: "earn_ses_monthly", entries }, null, 1)}\n`);
