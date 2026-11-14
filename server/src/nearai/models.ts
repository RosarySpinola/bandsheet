import type { Price } from "../spend";

interface ModelRow {
  id: string;
  owned_by?: string;
  pricing?: { prompt?: string; completion?: string };
}

/** Last-resort prices (USD/token, from the public /v1/models list on 2026-11-14). */
const FALLBACK: Record<string, Price> = {
  "Qwen/Qwen3-VL-30B-A3B-Instruct": { prompt: 0.00000015, completion: 0.00000055 },
  "z-ai/glm-5.3-flash": { prompt: 0.00000008, completion: 0.0000005 },
};

export interface PriceSource {
  getPrice: (model: string) => Promise<Price>;
  ownedBy: (model: string) => Promise<string | undefined>;
}

/** Fetches the public model list (no key needed) and caches it for 10 minutes. */
export function createPriceSource(baseUrl: string, fetchImpl: typeof fetch = fetch): PriceSource {
  let cache: { at: number; rows: Map<string, ModelRow> } | undefined;
  async function rows(): Promise<Map<string, ModelRow>> {
    if (cache && Date.now() - cache.at < 600_000) return cache.rows;
    try {
      const r = await fetchImpl(`${baseUrl}/v1/models`, { headers: { accept: "application/json" } });
      if (!r.ok) throw new Error(`models ${r.status}`);
      const body = (await r.json()) as { data?: ModelRow[] };
      cache = { at: Date.now(), rows: new Map((body.data ?? []).map((m) => [m.id, m])) };
      return cache.rows;
    } catch {
      return cache?.rows ?? new Map();
    }
  }
  return {
    async getPrice(model) {
      const row = (await rows()).get(model);
      const p = Number(row?.pricing?.prompt);
      const c = Number(row?.pricing?.completion);
      if (row?.pricing?.prompt !== undefined && Number.isFinite(p) && Number.isFinite(c)) {
        return { prompt: p, completion: c };
      }
      const fb = FALLBACK[model];
      if (fb) return fb;
      throw new Error(`no price known for model ${model}`);
    },
    async ownedBy(model) {
      return (await rows()).get(model)?.owned_by;
    },
  };
}
