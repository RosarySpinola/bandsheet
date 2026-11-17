import { Hono } from "hono";
import { z } from "zod";
import { GradeSchema, attackSubject, type Grade, type UnitEntry } from "@bandsheet/core";
import type { Deps } from "../deps";
import { AppError } from "../errors";
import { UnitClaim, verifyUnitClaim } from "../units/claim";
import { SYNTHETIC_CAP, body, consume, need, nowOf, readFail, readUnit, registrarOf, sendOrFail, txOut, unitIdOf, type UnitsDeps } from "../units/deps";
import type { AttackRow } from "../units/store";
import { makeSynthetic } from "../units/synthetic";

/**
 * The attack lab on a judge's own unit. One tap changes a published group by exactly one synthetic colleague (added
 * below the synthetic cap; at the cap, one the lab added earlier is removed), so the council can ask for the same table
 * again and see what the engine does with the difference. The colleague is sample data the server generated, which is
 * the only reason its figure can be shown: a real member's pay is never known to anyone.
 */

const CellKey = z
  .object({ grade: GradeSchema.optional(), gender: z.enum(["F", "M", "X"]).optional(), site: z.enum(["City", "Port"]).optional() })
  .strict()
  .refine((k) => Object.keys(k).length > 0, "empty cell key");
const AttackBody = UnitClaim.extend({ release_id: z.number().int().min(1).max(100_000), cell: CellKey });

type Cell = { key: Record<string, string>; n: number; mean_eur: number };
type RawRelease = { id: number; query?: unknown; cells?: Cell[] };
type Query = { group_by?: string[]; filter?: Record<string, string> | null; stat?: string };

const sameKey = (a: Record<string, string>, b: Record<string, string>) => {
  const ka = Object.keys(a).sort();
  return ka.length === Object.keys(b).length && ka.every((k) => a[k] === b[k]);
};

function queryOf(q: unknown): Query {
  try {
    return (typeof q === "string" ? JSON.parse(q) : q ?? {}) as Query;
  } catch {
    return {};
  }
}

/** The query as the contract takes it again: group_by, filter, stat (never the contract's own "id"). */
const queryText = (q: Query) => JSON.stringify({ group_by: q.group_by ?? [], ...(q.filter && Object.keys(q.filter).length ? { filter: q.filter } : {}), stat: q.stat ?? "mean" });

const colleague = (r: Pick<AttackRow, "grade" | "gender" | "site" | "gross_annual_eur">) => ({
  grade: r.grade, gender: r.gender, site: r.site, gross_annual_eur: r.gross_annual_eur, synthetic: true, label: "synthetic colleague, sample figure",
});

const out = (u: UnitsDeps, row: AttackRow, cell: Cell) => ({
  unit_id: row.unit_id,
  started_at: row.started_at,
  action: row.action,
  release_id: row.release_id,
  query: row.query,
  cell: { key: row.cell, n: cell.n, mean_eur: cell.mean_eur },
  expected_n: row.action === "add" ? cell.n + 1 : cell.n - 1,
  colleague: colleague(row),
  txs: row.txs.map((h) => txOut(u, h)),
});

export function unitAttackRoutes(deps: Deps): Hono {
  const app = new Hono();

  app.post("/:id/attack-prep", async (c) => {
    const u = need(deps);
    const id = unitIdOf(c.req.param("id"));
    const b = await body(c, AttackBody);
    const key = b.cell as Record<string, string>;
    const registrar = registrarOf(u);
    await consume(u, b.nonce, "unit_synthetic");
    const account = await verifyUnitClaim(b, { purpose: "unit_synthetic", unitId: id, subject: attackSubject(b.release_id, b.cell), recipient: u.cfg.contract }, u.keys);
    const unit = await readUnit(u, id);
    if (!unit.council.includes(account)) throw new AppError(403, `${account} is not on unit ${id}'s council`, "NOT_COUNCIL");

    const releases = await u.chain.view<RawRelease[]>("get_unit_releases", { unit_id: id, from: 0, limit: 50 }).catch(() => {
      throw readFail();
    });
    const rel = (releases ?? []).find((r) => r.id === b.release_id);
    if (!rel) throw new AppError(404, `unit ${id} has no release ${b.release_id}`, "RELEASE_NOT_FOUND");
    const cell = (rel.cells ?? []).find((x) => sameKey(x.key, key));
    if (!cell || cell.n < 3) throw new AppError(409, "the lab needs a cell that release published with 3 or more members", "CELL_NOT_PUBLISHED");
    const query = queryOf(rel.query);
    // The colleague lands in the cell and passes the request's filter, so the same table counts them.
    const fields = { ...(query.filter ?? {}), ...key } as Partial<Record<"grade" | "gender" | "site", string>>;
    const now = nowOf(u);
    const base = { unit_id: id, started_at: now, account_id: account, release_id: rel.id, query: queryText(query), cell: key };

    if (unit.synthetic_added < SYNTHETIC_CAP) {
      const policy = await u.chain.view<{ enclave_pubkey: string }>("get_policy").catch(() => {
        throw readFail();
      });
      const [m] = makeSynthetic(1, policy.enclave_pubkey, fields.grade as Grade | undefined, now, {
        gender: fields.gender as UnitEntry["gender"] | undefined,
        site: fields.site as UnitEntry["site"] | undefined,
      });
      const add = await sendOrFail(u.chain.call(registrar, [{ method: "unit_add_member", args: { unit_id: id, public_key: m!.publicKey, invite_code: "", synthetic: true }, tgas: 30 }]));
      const sub = await u.chain.submitAs(m!.privateKey, m!.ciphertext).catch(() => null);
      if (!sub?.ok) throw new AppError(502, "the synthetic colleague was added but its entry did not land; try again", "CHAIN_WRITE");
      const e = m!.entry;
      const row: AttackRow = { ...base, action: "add", public_key: m!.publicKey, grade: e.grade, gender: e.gender, site: e.site, gross_annual_eur: e.gross_annual_eur, txs: [add.hash, sub.hash] };
      await u.store.putAttack(row);
      return c.json(out(u, row, cell));
    }

    // At the cap: take back a colleague this lab added to the same cell (its sample figure is on record).
    const rows = await u.store.attacksOf(id);
    const gone = new Set(rows.filter((r) => r.action === "remove").map((r) => r.public_key));
    const mine = rows.find((r) => r.action === "add" && !gone.has(r.public_key) && Object.entries(fields).every(([k, v]) => (r as unknown as Record<string, string>)[k] === v));
    if (!mine) {
      throw new AppError(409, `unit ${id} has its ${SYNTHETIC_CAP} synthetic colleagues and none in that group was added by the lab`, "ATTACK_CAP");
    }
    const rm = await sendOrFail(u.chain.call(registrar, [{ method: "unit_remove_member", args: { unit_id: id, public_key: mine.public_key }, tgas: 30 }]));
    const row: AttackRow = { ...base, action: "remove", public_key: mine.public_key, grade: mine.grade, gender: mine.gender, site: mine.site, gross_annual_eur: mine.gross_annual_eur, txs: [rm.hash] };
    await u.store.putAttack(row);
    return c.json(out(u, row, cell));
  });

  /** The lab's changes on this unit, newest first, so the result screen survives a reload. */
  app.get("/:id/attacks", async (c) => {
    const u = need(deps);
    const id = unitIdOf(c.req.param("id"));
    const rows = await u.store.attacksOf(id).catch(() => [] as AttackRow[]);
    return c.json({
      unit_id: id,
      attacks: rows.map((r) => ({
        started_at: r.started_at, account_id: r.account_id, action: r.action, release_id: r.release_id, query: r.query, cell: r.cell,
        colleague: colleague(r), txs: r.txs.map((h) => txOut(u, h)),
      })),
    });
  });

  return app;
}
