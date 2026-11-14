import { DEFAULT_K } from "./constants";
import type { Cell, Entry, Query } from "./schemas";

function keyOf(e: Entry, fields: readonly string[]): Record<string, string> {
  const rec = e as unknown as Record<string, string | number>;
  return Object.fromEntries(fields.map((f) => [f, String(rec[f])]));
}

function matches(e: Entry, filter: Record<string, string> | undefined): boolean {
  if (!filter) return true;
  const rec = e as unknown as Record<string, string | number>;
  return Object.entries(filter).every(([f, v]) => String(rec[f]) === v);
}

export const cellId = (key: Record<string, string>): string =>
  Object.keys(key)
    .sort()
    .map((f) => `${f}=${key[f]}`)
    .join("|");

/**
 * The "typical tool": group, drop cells with fewer than k members, publish n and mean.
 * This is deliberately the naive n>=k rule that Bandsheet improves on.
 */
export function naiveRelease(entries: readonly Entry[], query: Query, k: number = DEFAULT_K): Cell[] {
  const groups = new Map<string, { key: Record<string, string>; sum: number; n: number }>();
  for (const e of entries) {
    if (!matches(e, query.filter)) continue;
    const key = keyOf(e, query.group_by);
    const id = cellId(key);
    const g = groups.get(id) ?? { key, sum: 0, n: 0 };
    g.sum += e.gross_annual_eur;
    g.n += 1;
    groups.set(id, g);
  }
  return [...groups.values()]
    .filter((g) => g.n >= k)
    .map((g) => ({ key: g.key, n: g.n, mean_eur: Math.round(g.sum / g.n) }))
    .sort((a, b) => cellId(a.key).localeCompare(cellId(b.key)));
}

export interface Revealed {
  key: Record<string, string>;
  revealed_eur: number;
  equation: string;
}

/**
 * Subtraction attack on two naive releases: where a cell gained exactly one member,
 * n2 x mean2 - n1 x mean1 equals that member's salary (exact when the means are exact).
 */
export function subtractionAttack(release1: readonly Cell[], release2: readonly Cell[]): Revealed[] {
  const prev = new Map(release1.map((c) => [cellId(c.key), c]));
  const out: Revealed[] = [];
  for (const c2 of release2) {
    const c1 = prev.get(cellId(c2.key));
    if (!c1) continue;
    const dn = c2.n - c1.n;
    if (dn !== 1 && dn !== -1) continue;
    const diff = c2.n * c2.mean_eur - c1.n * c1.mean_eur;
    out.push({
      key: c2.key,
      revealed_eur: dn === 1 ? diff : -diff,
      equation: `${c2.n} x ${c2.mean_eur} - ${c1.n} x ${c1.mean_eur} = ${diff}`,
    });
  }
  return out;
}
