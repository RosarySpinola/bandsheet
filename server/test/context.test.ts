import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app";
import { clearContextCache, decode, eurostatUrl, getWageContext, snapshotHash } from "../src/context";
import { SERVER_DIR } from "../src/env";
import { chainCfg, config, mockChain } from "./helpers";
import { SpendGuard } from "../src/spend";

const snap = JSON.parse(readFileSync(resolve(SERVER_DIR, "data/eurostat-snapshot.json"), "utf8")) as {
  fetched_at: string;
  entries: Record<string, { raw: never; sha256: string }>;
};
const app = createApp({
  config, guard: new SpendGuard({ path: config.ledgerPath, getPrice: async () => ({ prompt: 0, completion: 0 }) }),
  chat: async () => { throw new Error("n/a"); }, view: async () => [], chain: mockChain().chain, chainCfg: chainCfg(),
});
const liveFetch = (code: string) => (async () => Response.json(snap.entries[`${code}|OC2`]!.raw)) as unknown as typeof fetch;

beforeEach(() => clearContextCache());

describe("committed snapshot", () => {
  it("covers the five countries, with hashes that match their content", () => {
    expect(Object.keys(snap.entries).sort()).toEqual(["DE|OC2", "FR|OC2", "GR|OC2", "IE|OC2", "MT|OC2"]);
    for (const e of Object.values(snap.entries)) expect(snapshotHash(e.raw)).toBe(e.sha256);
    expect(snap.fetched_at).toMatch(/^2026-/);
  });
  it("holds the verified Eurostat medians (OC2, EUR/month, 2018)", async () => {
    const want: Record<string, [number, number, number]> = { MT: [2189, 2347, 2123], GR: [1682, 1811, 1617], DE: [4665, 5117, 4284], FR: [3315, 3900, 2941], IE: [4524, 4902, 4346] };
    for (const [code, [t, m, f]] of Object.entries(want)) {
      const rows = decode(snap.entries[`${code}|OC2`]!.raw).filter((r) => r.year === 2018);
      expect([rows.find((r) => r.sex === "T")?.value, rows.find((r) => r.sex === "M")?.value, rows.find((r) => r.sex === "F")?.value]).toEqual([t, m, f]);
    }
  });
});

describe("getWageContext", () => {
  it("builds the request Eurostat expects", () => {
    const u = new URL(eurostatUrl("EL", "OC2"));
    expect(u.pathname).toMatch(/earn_ses_monthly$/);
    expect(Object.fromEntries(u.searchParams)).toMatchObject({ geo: "EL", isco08: "OC2", indic_se: "MED_E_EUR", nace_r2: "B-S_X_O", worktime: "TOTAL", age: "TOTAL" });
  });
  it("returns the latest year, unit, source and hash from a live response", async () => {
    const c = await getWageContext("MT", "OC2", { fetchImpl: liveFetch("MT") });
    expect(c).toMatchObject({
      country: "MT", country_name: "Malta", isco08: "OC2", isco_label: "Professionals", year: 2018, unit: "EUR per month",
      median_monthly_eur: 2189, by_sex: { male: 2347, female: 2123 }, data_source: "live", dataset: "earn_ses_monthly",
    });
    expect(c.female_vs_male_pct).toBeCloseTo(-9.5, 1);
    expect(c.series.map((s) => s.year)).toEqual([2006, 2010, 2014, 2018]);
    expect(c.source_url).toContain("ec.europa.eu/eurostat");
    expect(c.snapshot_sha256).toBe(createHash("sha256").update(JSON.stringify(snap.entries["MT|OC2"]!.raw)).digest("hex"));
    expect(c.caveat).toContain("2018");
    expect(c.label).toBe("Malta median · Professionals · Eurostat SES 2018");
    expect(JSON.stringify(c)).not.toMatch(/EU median/i);
  });
  it("maps GR to Eurostat's EL", async () => {
    const f = vi.fn(liveFetch("GR"));
    const c = await getWageContext("GR", "OC2", { fetchImpl: f as unknown as typeof fetch });
    expect([c.country, c.median_monthly_eur]).toEqual(["GR", 1682]);
    expect(String((f.mock.calls[0] as unknown[])[0])).toContain("geo=EL");
  });
  it("falls back to the snapshot when Eurostat is slow, errors, or returns nothing", async () => {
    for (const impl of [
      async () => { throw new DOMException("timeout", "TimeoutError"); },
      async () => new Response("nope", { status: 500 }),
      async () => Response.json({ id: [], size: [], value: {}, dimension: {} }),
    ]) {
      clearContextCache();
      const c = await getWageContext("DE", "OC2", { fetchImpl: impl as unknown as typeof fetch });
      expect([c.data_source, c.median_monthly_eur, c.snapshot_sha256]).toEqual(["snapshot", 4665, snap.entries["DE|OC2"]!.sha256]);
      expect(c.fetched_at).toBe(snap.fetched_at);
    }
  });
  it("caches in memory and 503s when there is neither live data nor a snapshot", async () => {
    const f = vi.fn(liveFetch("IE"));
    await getWageContext("IE", "OC2", { fetchImpl: f as unknown as typeof fetch });
    expect((await getWageContext("IE", "OC2", { fetchImpl: f as unknown as typeof fetch })).data_source).toBe("cache");
    expect(f).toHaveBeenCalledTimes(1);
    const down = (async () => { throw new Error("down"); }) as unknown as typeof fetch;
    await expect(getWageContext("IE", "OC5", { fetchImpl: down })).rejects.toMatchObject({ code: "CONTEXT_UNAVAILABLE", status: 503 });
  });
});

describe("GET /api/context", () => {
  beforeEach(() => { vi.stubGlobal("fetch", async () => { throw new Error("offline in tests"); }); });
  afterEach(() => { vi.unstubAllGlobals(); });
  it("serves a country from the snapshot when Eurostat is unreachable, validates input", async () => {
    const res = await app.request("/api/context?country=MT&isco=OC2");
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ country: "MT", year: 2018, median_monthly_eur: 2189, unit: "EUR per month", data_source: "snapshot" });
    const dflt = await app.request("/api/context?country=FR");
    expect((await dflt.json()).isco08).toBe("OC2");
    for (const q of ["", "?country=US", "?country=MT&isco=Q9", "?country=MT&isco=OC22"]) {
      const r = await app.request(`/api/context${q}`);
      expect([r.status, (await r.json()).code]).toEqual([400, "BAD_REQUEST"]);
    }
  });
});

describe("GET /api/demo/naive", () => {
  it("shows the typical tool revealing EUR 70,000 on the synthetic chapel", async () => {
    const b = await (await app.request("/api/demo/naive")).json();
    expect(b.synthetic).toBe(true);
    expect(b.before.cells.find((c: { key: { grade: string } }) => c.key.grade === "Senior")).toMatchObject({ n: 9, mean_eur: 62400 });
    expect(b.after.cells.find((c: { key: { grade: string } }) => c.key.grade === "Senior")).toMatchObject({ n: 10, mean_eur: 63160 });
    expect(b.reveals).toEqual([{ key: { grade: "Senior" }, revealed_eur: 70000, equation: "10 x 63160 - 9 x 62400 = 70000" }]);
    expect((await app.request("/api/demo/naive?group_by=salary")).status).toBe(400);
  });
});

describe("Article 7 letter deadline", () => {
  it("cites only the Directive, with Article 7(4)'s two months, and names Maltese law generically", async () => {
    const { templateLetter } = await import("../src/letter");
    const mt = templateLetter("Senior").body;
    expect(mt).toContain("Article 7 of Directive (EU) 2023/970 (the Pay Transparency Directive), as transposed into Maltese law.");
    expect(mt).toContain("within a reasonable period, and in any event within two months of this request");
    expect(mt).not.toMatch(/legal notice|173|eight days|8 days/i);
    expect(templateLetter("Senior", "DE").body).toContain("as transposed into German law");
    expect(templateLetter("Senior", "DE").body).not.toContain("Malta");
  });
  it("rejects a model letter that cites a legal notice or an eight-day deadline", async () => {
    const { isAcceptableLetter, templateLetter } = await import("../src/letter");
    const ok = templateLetter("Senior");
    expect(isAcceptableLetter(ok)).toBe(true);
    expect(isAcceptableLetter({ ...ok, body: `${ok.body}\nUnder Legal Notice 173 of 2026.` })).toBe(false);
    expect(isAcceptableLetter({ ...ok, body: ok.body.replace("two months", "8 days") })).toBe(false);
  });
});
