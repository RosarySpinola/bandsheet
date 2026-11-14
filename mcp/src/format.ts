import type { Cell, Release } from "./api.js";

export interface ToolOut {
  text: string;
  data: Record<string, unknown>;
}

export const eur = (n: number): string => `EUR ${n.toLocaleString("en-IE")}`;

export const cellLabel = (key: Record<string, string>): string =>
  Object.entries(key).map(([k, v]) => `${k}=${v}`).join(", ");

export const cellId = (key: Record<string, string>): string =>
  Object.keys(key).sort().map((k) => `${k}=${key[k]}`).join("|");

export function when(r: Release): string {
  const ns = Number(r.block_timestamp);
  return Number.isFinite(ns) && ns > 0 ? new Date(ns / 1e6).toISOString() : "unknown time";
}

export function findRelease(releases: readonly Release[], id: number): Release {
  const r = releases.find((x) => x.id === id);
  if (!r) {
    const have = releases.map((x) => `#${x.id}`).join(", ") || "none yet";
    throw new Error(`There is no release #${id}. Releases on chain: ${have}.`);
  }
  return r;
}

/**
 * Match a free-text cell ("Senior", "grade=Senior", "grade=Senior, site=City") to a key. Every token must
 * match either a "field=value" pair or a bare value of that key, case-insensitively.
 */
export function matchesCell(key: Record<string, string>, text: string): boolean {
  const tokens = text.split(/[,|&]/).map((t) => t.trim().toLowerCase()).filter(Boolean);
  if (tokens.length === 0) return false;
  const pairs = Object.entries(key).map(([k, v]) => [k.toLowerCase(), v.toLowerCase()] as const);
  return tokens.every((t) => {
    const [a, b] = t.includes("=") ? t.split("=").map((x) => x.trim()) : [undefined, t];
    return pairs.some(([k, v]) => (a === undefined || a === k) && v === b);
  });
}

/** Newest-first merge: each cell with the release that last published it. */
export function latestPerCell(releases: readonly Release[]): { release_id: number; cell: Cell }[] {
  const seen = new Map<string, { release_id: number; cell: Cell }>();
  for (const r of [...releases].sort((a, b) => b.id - a.id)) {
    if (r.status !== "released" && r.status !== "partially_released") continue;
    for (const cell of r.cells) if (!seen.has(cellId(cell.key))) seen.set(cellId(cell.key), { release_id: r.id, cell });
  }
  return [...seen.values()];
}
