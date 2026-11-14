import { createHash } from "node:crypto";
import { z } from "zod";
import { AppError } from "./errors";
import snapshot from "../data/eurostat-snapshot.json";

export const DATASET = "earn_ses_monthly";
const API = "https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data";
const HUMAN = "https://ec.europa.eu/eurostat/databrowser/view/earn_ses_monthly/default/table";

/** Country codes callers use; Eurostat spells Greece "EL". */
export const COUNTRIES = {
  MT: { geo: "MT", name: "Malta" },
  GR: { geo: "EL", name: "Greece" },
  DE: { geo: "DE", name: "Germany" },
  FR: { geo: "FR", name: "France" },
  IE: { geo: "IE", name: "Ireland" },
} as const;
export type CountryCode = keyof typeof COUNTRIES;

export const ContextQuerySchema = z.object({
  country: z.enum(["MT", "GR", "DE", "FR", "IE"]),
  isco: z.string().regex(/^OC[0-9]$/, "ISCO-08 major group such as OC2").default("OC2"),
});

/** Query string of the exact Eurostat request: median monthly earnings, all ages and working times, NACE B-S excl. O. */
export function eurostatUrl(geo: string, isco: string): string {
  const q = new URLSearchParams({
    format: "JSON", lang: "EN", geo, isco08: isco, nace_r2: "B-S_X_O", worktime: "TOTAL", age: "TOTAL", indic_se: "MED_E_EUR",
  });
  return `${API}/${DATASET}?${q}`;
}

interface JsonStat {
  id: string[];
  size: number[];
  value: Record<string, number>;
  updated?: string;
  dimension: Record<string, { category: { index: Record<string, number> | string[]; label?: Record<string, string> } }>;
}

const sha256 = (s: string): string => createHash("sha256").update(s).digest("hex");
/** Hash of the JSON-stat response as stored: JSON.stringify of the parsed object (stable across live and snapshot). */
export const snapshotHash = (raw: unknown): string => sha256(JSON.stringify(raw));

function codes(cat: JsonStat["dimension"][string]["category"]): string[] {
  if (Array.isArray(cat.index)) return cat.index;
  return Object.entries(cat.index).sort((a, b) => a[1] - b[1]).map(([c]) => c);
}

/** Flatten a JSON-stat cube into {sex, year, value} rows. */
export function decode(raw: JsonStat): { sex: string; year: number; value: number }[] {
  const dims = raw.id.map((d) => ({ d, codes: codes(raw.dimension[d]!.category) }));
  const rows: { sex: string; year: number; value: number }[] = [];
  for (const [k, value] of Object.entries(raw.value)) {
    let i = Number(k);
    const at: Record<string, string> = {};
    for (let j = dims.length - 1; j >= 0; j--) {
      const size = raw.size[j]!;
      at[dims[j]!.d] = dims[j]!.codes[i % size]!;
      i = Math.floor(i / size);
    }
    rows.push({ sex: at.sex!, year: Number(at.time), value });
  }
  return rows;
}

export interface WageContext {
  country: string;
  country_name: string;
  isco08: string;
  isco_label: string;
  /** What to call this figure in a UI: one country's median, never an EU-wide one. e.g. "Malta median · Professionals · Eurostat SES 2018". */
  label: string;
  indicator: string;
  dataset: string;
  year: number;
  unit: string;
  median_monthly_eur: number;
  by_sex: { male: number | null; female: number | null };
  female_vs_male_pct: number | null;
  series: { year: number; median_monthly_eur: number }[];
  population: string;
  source_url: string;
  api_url: string;
  snapshot_sha256: string;
  data_source: "live" | "snapshot" | "cache";
  updated: string | null;
  fetched_at: string;
  caveat: string;
}

export function summarise(code: CountryCode, isco: string, raw: JsonStat, hash: string, dataSource: WageContext["data_source"], fetchedAt: string): WageContext {
  const c = COUNTRIES[code];
  const rows = decode(raw);
  const total = rows.filter((r) => r.sex === "T").sort((a, b) => a.year - b.year);
  const latest = total.at(-1);
  if (!latest) throw new AppError(502, "Eurostat has no median earnings for that country and occupation", "CONTEXT_EMPTY");
  const at = (sex: string): number | null => rows.find((r) => r.sex === sex && r.year === latest.year)?.value ?? null;
  const male = at("M");
  const female = at("F");
  const label = raw.dimension.isco08?.category.label?.[isco] ?? isco;
  return {
    country: code,
    country_name: c.name,
    isco08: isco,
    isco_label: label,
    label: `${c.name} median · ${label} · Eurostat SES ${latest.year}`,
    indicator: `Median gross monthly earnings in ${c.name}`,
    dataset: DATASET,
    year: latest.year,
    unit: "EUR per month",
    median_monthly_eur: latest.value,
    by_sex: { male, female },
    female_vs_male_pct: male && female ? Math.round(((female - male) / male) * 1000) / 10 : null,
    series: total.map((r) => ({ year: r.year, median_monthly_eur: r.value })),
    population: "Employees in enterprises with 10+ staff, NACE B-S excl. O, all ages, all working times (Structure of Earnings Survey)",
    source_url: HUMAN,
    api_url: eurostatUrl(c.geo, isco),
    snapshot_sha256: hash,
    data_source: dataSource,
    updated: raw.updated ?? null,
    fetched_at: fetchedAt,
    caveat: `${latest.year} is the latest survey year Eurostat publishes for this series, so it is dated: it describes pay in ${latest.year}, not today.`,
  };
}

interface SnapshotFile {
  fetched_at: string;
  entries: Record<string, { raw: JsonStat; sha256: string }>;
}
const SNAP = snapshot as unknown as SnapshotFile;

export interface ContextDeps {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  now?: () => number;
  ttlMs?: number;
}

const cache = new Map<string, { at: number; value: WageContext }>();
export const clearContextCache = (): void => cache.clear();

/** Eurostat live (4 s budget), else the committed snapshot. Cached in memory for a day. */
export async function getWageContext(code: CountryCode, isco: string, d: ContextDeps = {}): Promise<WageContext> {
  const now = d.now ?? Date.now;
  const key = `${code}|${isco}`;
  const hit = cache.get(key);
  if (hit && now() - hit.at < (d.ttlMs ?? 86_400_000)) return { ...hit.value, data_source: "cache" };

  const url = eurostatUrl(COUNTRIES[code].geo, isco);
  const f = d.fetchImpl ?? ((u: string, i?: RequestInit) => fetch(u, i));
  let value: WageContext | undefined;
  try {
    const res = await f(url, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(d.timeoutMs ?? 4000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const raw = (await res.json()) as JsonStat;
    if (!raw.value || Object.keys(raw.value).length === 0) throw new Error("empty");
    value = summarise(code, isco, raw, snapshotHash(raw), "live", new Date(now()).toISOString());
  } catch {
    const snap = SNAP.entries[key];
    if (snap) value = summarise(code, isco, snap.raw, snap.sha256, "snapshot", SNAP.fetched_at);
  }
  if (!value) throw new AppError(503, "Eurostat is not reachable and there is no snapshot for that request", "CONTEXT_UNAVAILABLE");
  cache.set(key, { at: now(), value });
  return value;
}
