import { SpendCapError } from "./errors";
import type { LedgerEntry, LedgerStore } from "./spend";

/** The slice of Cloudflare D1 we use, so the Node build needs no Workers types. */
export interface D1Like {
  prepare(sql: string): {
    bind(...values: unknown[]): { run(): Promise<unknown>; first<T = unknown>(): Promise<T | null> };
  };
}

/** NEAR AI spend ledger in D1 (table spend_ledger, see deploy/migrations). Any read failure fails closed. */
export class D1LedgerStore implements LedgerStore {
  constructor(private readonly db: D1Like) {}

  async totals(): Promise<{ total_usd: number; calls: number }> {
    try {
      const row = await this.db
        .prepare("SELECT COALESCE(SUM(cost_usd), 0) AS total_usd, COUNT(*) AS calls FROM spend_ledger")
        .bind()
        .first<{ total_usd: number; calls: number }>();
      const total = Number(row?.total_usd);
      if (!row || !Number.isFinite(total)) throw new Error("bad row");
      return { total_usd: total, calls: Number(row.calls) };
    } catch {
      throw new SpendCapError("spend ledger unreadable; refusing (fail closed)");
    }
  }

  async append(e: LedgerEntry): Promise<void> {
    await this.db
      .prepare("INSERT INTO spend_ledger (ts, model, kind, prompt_tokens, completion_tokens, cost_usd) VALUES (?, ?, ?, ?, ?, ?)")
      .bind(e.ts, e.model, e.kind, e.prompt_tokens, e.completion_tokens, e.cost_usd)
      .run();
  }
}
