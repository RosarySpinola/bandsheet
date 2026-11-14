import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { SpendCapError } from "../src/errors";
import { SPEND_CAP_USD, SpendGuard } from "../src/spend";

const price = async () => ({ prompt: 0.00000015, completion: 0.00000055 });
const newGuard = (seedTotal?: number) => {
  const path = join(mkdtempSync(join(tmpdir(), "spend-")), ".spend.json");
  if (seedTotal !== undefined) {
    writeFileSync(path, JSON.stringify({ version: 1, entries: [{ ts: "t", model: "m", kind: "seed", prompt_tokens: 0, completion_tokens: 0, cost_usd: seedTotal }] }));
  }
  return { path, guard: new SpendGuard({ path, getPrice: price }) };
};

describe("spend guard", () => {
  it("has a USD 2.50 cap", () => expect(SPEND_CAP_USD).toBe(2.5));

  it("refuses with SPEND_CAP once the ledger is at the cap, without calling out", async () => {
    const { guard } = newGuard(2.5);
    const fn = vi.fn(async () => ({ usage: { prompt_tokens: 1, completion_tokens: 1 } }));
    const err = await guard.call("m", "chat", { inputTokens: 10, maxOutputTokens: 10 }, fn).catch((e) => e);
    expect(err).toBeInstanceOf(SpendCapError);
    expect(err.status).toBe(402);
    expect(err.body()).toEqual({ error: "spend cap reached", code: "SPEND_CAP" });
    expect(fn).not.toHaveBeenCalled();
  });

  it("refuses when the projected cost would cross the cap", async () => {
    const { guard } = newGuard(2.4999);
    const fn = vi.fn(async () => ({}));
    // 100k output tokens x 0.00000055 = USD 0.055 projected
    await expect(guard.call("m", "chat", { inputTokens: 0, maxOutputTokens: 100_000 }, fn)).rejects.toMatchObject({ code: "SPEND_CAP" });
    expect(fn).not.toHaveBeenCalled();
  });

  it("refuses even free calls once the cap is reached", async () => {
    const { guard } = newGuard(2.5);
    await expect(guard.call("m", "attestation", { free: true }, async () => ({}))).rejects.toMatchObject({ code: "SPEND_CAP" });
  });

  it("allows a call under the cap and records usage x price", async () => {
    const { guard, path } = newGuard(0);
    await guard.call("m", "chat", { inputTokens: 5000, maxOutputTokens: 400 }, async () => ({ usage: { prompt_tokens: 1000, completion_tokens: 100 } }));
    const ledger = JSON.parse(readFileSync(path, "utf8"));
    expect(ledger.entries.at(-1).cost_usd).toBeCloseTo(1000 * 0.00000015 + 100 * 0.00000055, 8);
    expect((await guard.summary()).total_usd).toBeCloseTo(0.000205, 8);
  });

  it("counts a failed (non-4xx) call at its projected cost, and a 4xx as free", async () => {
    const { guard } = newGuard(0);
    await guard.call("m", "chat", { inputTokens: 1000, maxOutputTokens: 1000 }, async () => { throw new Error("boom"); }).catch(() => undefined);
    const t1 = await guard.total();
    expect(t1).toBeGreaterThan(0);
    await guard.call("m", "chat", { inputTokens: 1000, maxOutputTokens: 1000 }, async () => { throw Object.assign(new Error("bad"), { unbilled: true }); }).catch(() => undefined);
    expect(await guard.total()).toBe(t1);
  });

  it("fails closed on a corrupt ledger", async () => {
    const { guard, path } = newGuard();
    writeFileSync(path, "{not json");
    await expect(guard.call("m", "chat", { inputTokens: 1, maxOutputTokens: 1 }, async () => ({}))).rejects.toMatchObject({ code: "SPEND_CAP" });
  });

  it("serialises concurrent calls so in-flight projections count toward the cap", async () => {
    const { guard } = newGuard(2.49);
    const slow = () => new Promise<object>((r) => setTimeout(() => r({ usage: { prompt_tokens: 1, completion_tokens: 1 } }), 30));
    // each projects 0.0055; two together stay under 2.5 (2.49 + 0.011 = 2.501 crosses) so the second must refuse
    const p = { inputTokens: 0, maxOutputTokens: 10_000 };
    const results = await Promise.allSettled([guard.call("m", "a", p, slow), guard.call("m", "b", p, slow)]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  });
});
