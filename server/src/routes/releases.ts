import { Hono } from "hono";
import { type Cell, type ReleaseRecord, ReleaseRecordSchema, cellId } from "@bandsheet/core";
import type { Deps } from "../deps";
import { AppError } from "../errors";

/** Contract records may nest the enclave output under `output`; flatten it so cells surface. */
function normalise(raw: unknown): unknown {
  if (raw && typeof raw === "object" && "output" in raw && typeof (raw as { output: unknown }).output === "object") {
    const { output, ...rest } = raw as { output: Record<string, unknown> };
    return { ...output, ...rest };
  }
  return raw;
}

export async function readReleases(deps: Deps): Promise<{ contract: string; releases: ReleaseRecord[] }> {
  const { contract, releasesMethod } = deps.config;
  if (!contract) throw new AppError(503, "BANDSHEET_CONTRACT is not configured", "CONTRACT_NOT_CONFIGURED");
  let args: Record<string, unknown> = {};
  try {
    args = process.env.BANDSHEET_RELEASES_ARGS ? (JSON.parse(process.env.BANDSHEET_RELEASES_ARGS) as Record<string, unknown>) : {};
  } catch {
    throw new AppError(500, "BANDSHEET_RELEASES_ARGS is not valid JSON", "CONFIG");
  }
  let raw: unknown;
  try {
    raw = await deps.view(contract, releasesMethod, args);
  } catch {
    throw new AppError(502, "could not read releases from NEAR testnet", "CHAIN_READ");
  }
  const list = Array.isArray(raw) ? raw : Array.isArray((raw as { releases?: unknown })?.releases) ? (raw as { releases: unknown[] }).releases : [];
  const releases: ReleaseRecord[] = [];
  for (const item of list) {
    const parsed = ReleaseRecordSchema.safeParse(normalise(item));
    if (parsed.success) releases.push(parsed.data);
  }
  return { contract, releases };
}

/**
 * The latest public band for each cell: walk releases newest to oldest and keep the first cell seen
 * per key. A cell suppressed in a newer release therefore still shows its last safely published value.
 */
export function latestBands(releases: readonly ReleaseRecord[]): { release_id: number; cells: Cell[] } | undefined {
  const seen = new Map<string, Cell>();
  let newest: number | undefined;
  for (let i = releases.length - 1; i >= 0; i--) {
    const r = releases[i]!;
    if (r.status !== "released" && r.status !== "partially_released") continue;
    for (const cell of r.cells) {
      if (newest === undefined) newest = r.id;
      if (!seen.has(cellId(cell.key))) seen.set(cellId(cell.key), cell);
    }
  }
  return newest === undefined ? undefined : { release_id: newest, cells: [...seen.values()] };
}

/**
 * Where a grade's public band comes from: the newest release that published the grade-only cell, and the
 * newer releases that withheld it (for example #2 and #3 withholding Senior because #1 already published it).
 */
export function bandSource(releases: readonly ReleaseRecord[], grade: string): { release_id: number; withheld_in: number[] } | undefined {
  const withheld: number[] = [];
  const isGrade = (key: Record<string, unknown>) => Object.keys(key).length === 1 && key.grade === grade;
  for (let i = releases.length - 1; i >= 0; i--) {
    const r = releases[i]!;
    if (r.status !== "released" && r.status !== "partially_released") continue;
    if (r.cells.some((c) => isGrade(c.key))) return { release_id: r.id, withheld_in: withheld.reverse() };
    if (r.suppressed.some((s) => isGrade(s.key))) withheld.push(r.id);
  }
  return undefined;
}

export function releasesRoutes(deps: Deps): Hono {
  const app = new Hono();
  app.get("/", async (c) => {
    const { contract, releases } = await readReleases(deps);
    return c.json({ contract, network: "testnet", releases, latest_bands: latestBands(releases) ?? null });
  });
  return app;
}
