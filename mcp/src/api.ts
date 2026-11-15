/** Thin client for the Bandsheet HTTP API (default: the deployed Pages app). */
export const DEFAULT_API = "https://bandsheet.pages.dev/api";

export interface Cell {
  key: Record<string, string>;
  n: number;
  mean_eur: number;
}
export interface Suppressed {
  key: Record<string, string>;
  reason: string;
  witness: string;
}
export interface Release {
  id: number;
  status: string;
  query?: { group_by?: string[]; filter?: Record<string, string> };
  requested_by?: string;
  cells: Cell[];
  suppressed: Suppressed[];
  input_hash?: string;
  output_hash?: string;
  input_sha256?: string;
  output_sha256?: string;
  proof?: Record<string, unknown>;
  note?: string;
  block_timestamp?: string | number;
  /** DKIM-era fields (absent or null on releases that predate them). */
  entries_verified?: number | null;
  rejections?: { reason: string; count: number }[] | null;
  wasm_sha256?: string | null;
  require_dkim?: boolean | null;
}
export interface Proposal {
  id: number;
  status: string;
  query: { group_by?: string[] } | null;
  description: string;
  /** Absent on older API versions, where every proposal was a release. */
  kind?: string;
}
export interface UnitInfo {
  unit: string;
  dao: string;
  policy: { k?: number; wasm_sha256?: string } & Record<string, unknown>;
  member_count: number;
  entry_count: number;
  release_count: number;
  explorer?: { unit_url?: string };
}
export interface NaiveDemo {
  synthetic: boolean;
  group_by: string[];
  before: { members: number; cells: Cell[] };
  after: { members: number; cells: Cell[] };
  reveals: { key: Record<string, string>; revealed_eur: number; equation: string }[];
}
export interface WageContext {
  country: string;
  country_name: string;
  isco08: string;
  isco_label: string;
  indicator: string;
  year: number;
  unit: string;
  median_monthly_eur: number;
  by_sex: { male: number | null; female: number | null };
  female_vs_male_pct: number | null;
  source_url: string;
  snapshot_sha256: string;
  data_source: string;
  caveat: string;
}

export class ApiError extends Error {}

export interface Api {
  releases(): Promise<Release[]>;
  unit(): Promise<UnitInfo>;
  proposals(): Promise<Proposal[]>;
  naive(groupBy: string): Promise<NaiveDemo>;
  context(country: string, isco?: string): Promise<WageContext>;
}

export function createApi(base: string = process.env.BANDSHEET_API || DEFAULT_API, fetchImpl: typeof fetch = fetch): Api {
  const root = base.replace(/\/$/, "");
  async function get<T>(path: string): Promise<T> {
    let res: Response;
    try {
      res = await fetchImpl(`${root}${path}`, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(20_000) });
    } catch {
      throw new ApiError(`Could not reach the Bandsheet API at ${root}. Check BANDSHEET_API and your network.`);
    }
    const body = (await res.json().catch(() => ({}))) as { error?: string; code?: string };
    if (!res.ok) throw new ApiError(`Bandsheet API error ${res.status}: ${body.error ?? "unknown"}${body.code ? ` (${body.code})` : ""}`);
    return body as T;
  }
  return {
    releases: async () => (await get<{ releases: Release[] }>("/releases")).releases,
    unit: () => get<UnitInfo>("/unit"),
    proposals: async () => (await get<{ proposals: Proposal[] }>("/dao/proposals")).proposals.filter((p) => !p.kind || p.kind === "release"),
    naive: (g) => get<NaiveDemo>(`/demo/naive?group_by=${encodeURIComponent(g)}`),
    context: (country, isco = "OC2") => get<WageContext>(`/context?country=${encodeURIComponent(country)}&isco=${encodeURIComponent(isco)}`),
  };
}
