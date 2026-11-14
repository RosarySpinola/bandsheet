import { existsSync } from "node:fs";
import { readFile, rename, writeFile } from "node:fs/promises";
import { AppError, SpendCapError } from "./errors";

/** Hard cap for the whole project (USD). Refuse any NEAR AI call that would reach it. */
export const SPEND_CAP_USD = 2.5;

/** Chapel plan: payslip reads (POST /api/extract) per calendar month (UTC) for this deployment. */
export const MONTHLY_READS = 2000;
/** Ledger kind for one payslip read: a zero-cost marker row. The NEAR AI calls it makes are their own rows. */
export const READ_KIND = "read";

/** First instant of the UTC calendar month containing `d`, as the ISO string the ledger stores. */
export const monthStart = (d: Date): string => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString();

export interface Price {
  /** USD per input token */
  prompt: number;
  /** USD per output token */
  completion: number;
}
export type PriceFn = (model: string) => Promise<Price>;

export interface Usage {
  prompt_tokens?: number;
  completion_tokens?: number;
}
export interface LedgerEntry {
  ts: string;
  model: string;
  kind: string;
  prompt_tokens: number;
  completion_tokens: number;
  cost_usd: number;
}
interface Ledger {
  version: 1;
  entries: LedgerEntry[];
}

export interface Projection {
  /** Free calls (attestation, signature) cost nothing but are still refused past the cap. */
  free?: boolean;
  /** Upper-bound estimate of input tokens (text plus image). */
  inputTokens?: number;
  /** The max_tokens sent with the request. */
  maxOutputTokens?: number;
}

/** Where ledger rows live. The Node file store is the default; spend-d1.ts supplies a Cloudflare D1 one. */
export interface LedgerStore {
  /** Sum of every row and count of NEAR AI calls (read markers excluded). Must throw SpendCapError when unreadable (fail closed). */
  totals(): Promise<{ total_usd: number; calls: number }>;
  /** Rows of `kind` at or after `sinceIso`. Must throw SpendCapError when unreadable (fail closed). */
  countSince(kind: string, sinceIso: string): Promise<number>;
  append(entry: LedgerEntry): Promise<void>;
}

/** JSON file ledger (local dev and tests). Writes go through a temp file and rename. */
export class FileLedgerStore implements LedgerStore {
  constructor(private readonly path: string) {}

  private async read(): Promise<Ledger> {
    if (!existsSync(this.path)) return { version: 1, entries: [] };
    try {
      const l = JSON.parse(await readFile(this.path, "utf8")) as Ledger;
      if (l.version !== 1 || !Array.isArray(l.entries)) throw new Error("bad shape");
      return l;
    } catch {
      throw new SpendCapError("spend ledger unreadable; refusing (fail closed)");
    }
  }

  async totals(): Promise<{ total_usd: number; calls: number }> {
    const l = await this.read();
    return { total_usd: l.entries.reduce((s, e) => s + e.cost_usd, 0), calls: l.entries.filter((e) => e.kind !== READ_KIND).length };
  }

  async countSince(kind: string, sinceIso: string): Promise<number> {
    return (await this.read()).entries.filter((e) => e.kind === kind && e.ts >= sinceIso).length;
  }

  async append(entry: LedgerEntry): Promise<void> {
    const l = await this.read();
    l.entries.push(entry);
    const tmp = `${this.path}.tmp`;
    await writeFile(tmp, JSON.stringify(l, null, 2));
    await rename(tmp, this.path);
  }
}

export interface GuardOptions {
  /** Convenience: a JSON ledger file. Ignored when `store` is given. */
  path?: string;
  store?: LedgerStore;
  getPrice: PriceFn;
  cap?: number;
  /** Payslip reads allowed per UTC month (default MONTHLY_READS). */
  monthlyReads?: number;
}

/**
 * Ledger-backed spend guard. Every NEAR AI call goes through `call()`. It refuses with
 * SpendCapError (code SPEND_CAP) when the ledger total plus calls in flight plus this
 * call's projected cost would reach the cap. A corrupt ledger fails closed.
 */
export class SpendGuard {
  private readonly cap: number;
  private readonly readLimit: number;
  private pending = 0;
  private chain: Promise<unknown> = Promise.resolve();

  private readonly store: LedgerStore;

  constructor(private readonly opts: GuardOptions) {
    this.cap = opts.cap ?? SPEND_CAP_USD;
    this.readLimit = opts.monthlyReads ?? MONTHLY_READS;
    if (!opts.store && !opts.path) throw new Error("SpendGuard needs a store or a path");
    this.store = opts.store ?? new FileLedgerStore(opts.path as string);
  }

  private serial<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.chain.then(fn, fn);
    this.chain = run.catch(() => undefined);
    return run;
  }

  async total(): Promise<number> {
    return (await this.store.totals()).total_usd;
  }

  async summary(): Promise<{ total_usd: number; calls: number; cap_usd: number }> {
    return { ...(await this.store.totals()), cap_usd: this.cap };
  }

  /** Payslip reads used this UTC month against the plan limit. */
  async reads(now = new Date()): Promise<{ used: number; limit: number; since: string }> {
    const since = monthStart(now);
    return { used: await this.store.countSince(READ_KIND, since), limit: this.readLimit, since };
  }

  /**
   * Count one payslip read against the month, or refuse with 429 MONTHLY_READS once the month is used up.
   * Serialised with the spend checks so concurrent reads in one isolate cannot both take the last slot.
   */
  async takeRead(now = new Date()): Promise<void> {
    await this.serial(async () => {
      const { used, limit } = await this.reads(now);
      if (used >= limit) {
        throw new AppError(429, `this chapel has used its ${limit.toLocaleString("en-IE")} payslip reads for the month`, "MONTHLY_READS");
      }
      await this.store.append({ ts: now.toISOString(), model: "-", kind: READ_KIND, prompt_tokens: 0, completion_tokens: 0, cost_usd: 0 });
    });
  }

  private async project(model: string, p: Projection): Promise<number> {
    if (p.free) return 0;
    const price = await this.opts.getPrice(model);
    return (p.inputTokens ?? 0) * price.prompt + (p.maxOutputTokens ?? 0) * price.completion;
  }

  /** Throws SpendCapError instead of calling `fn` if the cap would be reached. */
  async call<T extends object>(
    model: string,
    kind: string,
    projection: Projection,
    fn: () => Promise<T>,
  ): Promise<T> {
    const projected = await this.project(model, projection);
    await this.serial(async () => {
      const total = (await this.total()) + this.pending;
      if (total >= this.cap || total + projected >= this.cap) {
        throw new SpendCapError(`ledger ${total.toFixed(4)} + projected ${projected.toFixed(4)} >= cap ${this.cap}`);
      }
      this.pending += projected;
    });
    let cost = projected;
    let usage: Usage = {};
    try {
      const out = await fn();
      usage = (out as { usage?: Usage }).usage ?? {};
      cost = projection.free ? 0 : await this.actualCost(model, usage, projected);
      return out;
    } catch (err) {
      // A failed call may still have billed: charge the projection unless it is flagged unbilled.
      cost = projection.free || (err as { unbilled?: boolean }).unbilled ? 0 : projected;
      throw err;
    } finally {
      await this.serial(async () => {
        this.pending -= projected;
        await this.store.append({
          ts: new Date().toISOString(),
          model,
          kind,
          prompt_tokens: usage.prompt_tokens ?? 0,
          completion_tokens: usage.completion_tokens ?? 0,
          cost_usd: Number(cost.toFixed(8)),
        });
      });
    }
  }

  private async actualCost(model: string, usage: Usage, projected: number): Promise<number> {
    if (usage.prompt_tokens === undefined && usage.completion_tokens === undefined) return projected;
    const price = await this.opts.getPrice(model);
    return (usage.prompt_tokens ?? 0) * price.prompt + (usage.completion_tokens ?? 0) * price.completion;
  }
}
