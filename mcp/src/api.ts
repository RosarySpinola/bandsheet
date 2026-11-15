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
  /** Units contract releases ("start your own unit"). Synthetic entries are sample data and always labelled. */
  unit_id?: number;
  proposal_id?: number;
  counts?: { entries: number; synthetic: number; dkim_verified: number | null; self_attested: number | null; rejected: number };
}
export interface Proposal {
  id: number;
  status: string;
  query: { group_by?: string[] } | null;
  description: string;
  /** Absent on older API versions, where every proposal was a release. */
  kind?: string;
  /** Units: the release this proposal produced. */
  release_id?: number | null;
}
export interface UnitInfo {
  unit: string;
  dao: string;
  policy: { k?: number; wasm_sha256?: string } & Record<string, unknown>;
  member_count: number;
  entry_count: number;
  release_count: number;
  explorer?: { unit_url?: string };
  /** Set when the scope is a unit on the units contract: its id and council (votes are in-contract, no DAO). */
  unit_id?: number;
  council?: string[];
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
  /** GET /units/:id (start-your-own-unit). */
  unitView?(id: number): Promise<UnitView>;
}

export interface UnitView {
  contract: string;
  unit: { id: number; name: string; council: string[]; members: number; synthetic_members: number; entries: number; releases: number };
  policy: { k: number; wasm_sha256: string };
  proposals: { id: number; status: string; query: string; release_id: number | null }[];
  releases: Release[];
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
    unitView: (id) => get<UnitView>(`/units/${id}`),
  };
}

/** The same tools over one unit of the units contract instead of the demo chapel. */
export function forUnit(api: Api, id: number): Api {
  if (!api.unitView) throw new ApiError("This API client cannot read units.");
  const view = api.unitView.bind(api);
  const parseQuery = (q: string) => {
    try {
      return JSON.parse(q) as { group_by?: string[] };
    } catch {
      return null;
    }
  };
  return {
    ...api,
    releases: async () => (await view(id)).releases,
    unit: async () => {
      const v = await view(id);
      return {
        unit: `${v.contract} unit ${id} (${v.unit.name})`, dao: "", unit_id: id, council: v.unit.council, policy: v.policy,
        member_count: v.unit.members, entry_count: v.unit.entries, release_count: v.unit.releases,
      };
    },
    proposals: async () =>
      (await view(id)).proposals.map((p) => ({ id: p.id, status: p.status, query: parseQuery(p.query), description: `Unit ${id} proposal ${p.id}`, kind: "release", release_id: p.release_id })),
  };
}

/** "includes 4 synthetic (sample data) entries" or "". */
export function syntheticNote(r: Release | undefined): string {
  const n = r?.counts?.synthetic ?? 0;
  return n > 0 ? `SYNTHETIC: ${n} of ${r!.counts!.entries} entries in release #${r!.id} are synthetic colleagues (sample data), not real pay.` : "";
}
