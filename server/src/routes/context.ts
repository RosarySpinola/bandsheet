import { Hono } from "hono";
import { type Cell, QuerySchema, SEED_JOINER, SEED_MEMBERS, naiveRelease, seedEntry, subtractionAttack } from "@bandsheet/core";
import { z } from "zod";
import { ContextQuerySchema, getWageContext } from "../context";
import { AppError } from "../errors";

const NaiveQuery = z.object({ group_by: z.enum(["grade", "gender", "site"]).default("grade") });

const entries = (withJoiner: boolean) =>
  [...SEED_MEMBERS, ...(withJoiner ? [SEED_JOINER] : [])].map((m, i) => seedEntry(m, i.toString(16).padStart(64, "0"), 0));

/** Public context: Eurostat wages, and the synthetic-data subtraction demo the MCP tool explains. */
export function contextRoutes(): Hono {
  const app = new Hono();

  app.get("/context", async (c) => {
    const q = ContextQuerySchema.safeParse({ country: c.req.query("country"), isco: c.req.query("isco") ?? undefined });
    if (!q.success) throw new AppError(400, "country must be one of MT, GR, DE, FR, IE; isco like OC2", "BAD_REQUEST");
    return c.json(await getWageContext(q.data.country, q.data.isco));
  });

  /**
   * What a typical n>=3 tool publishes on the SYNTHETIC seed chapel before and after the joiner (36 then 37 members),
   * and what subtracting the two reveals. Same data the demo's releases #1 and #2 were computed from.
   */
  app.get("/demo/naive", (c) => {
    const q = NaiveQuery.safeParse({ group_by: c.req.query("group_by") ?? undefined });
    if (!q.success) throw new AppError(400, "group_by must be grade, gender or site", "BAD_REQUEST");
    const query = (id: number) => QuerySchema.parse({ id, group_by: [q.data.group_by], stat: "mean" });
    const before: Cell[] = naiveRelease(entries(false), query(1));
    const after: Cell[] = naiveRelease(entries(true), query(2));
    return c.json({
      synthetic: true,
      note: "Synthetic Harbour Courier chapel. 'before' = release #1 members (36), 'after' = release #2 members (37, one Senior joined).",
      group_by: [q.data.group_by],
      before: { members: SEED_MEMBERS.length, cells: before },
      after: { members: SEED_MEMBERS.length + 1, cells: after },
      reveals: subtractionAttack(before, after),
    });
  });
  return app;
}
