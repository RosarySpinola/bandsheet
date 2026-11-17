import { Hono } from "hono";
import { z } from "zod";
import { type Cell, CellSchema, GenderSchema, GradeSchema, SiteSchema } from "@bandsheet/core";
import type { Deps } from "../deps";
import { AppError } from "../errors";
import { parseModelJson } from "../json";
import { type Letter, isAcceptableLetter, replyDeadline, templateLetter } from "../letter";
import { need, readUnit } from "../units/deps";
import { bandSource, latestBands, readReleases } from "./releases";
import { readUnitReleases } from "./units";

async function unitReleases(deps: Deps, id: number) {
  const u = need(deps);
  const unit = await readUnit(u, id);
  return { releases: await readUnitReleases(u, id, unit.releases) };
}

export const StandRequestSchema = z.object({
  gross_annual_eur: z.number().int().min(1).max(10_000_000),
  grade: GradeSchema,
  gender: GenderSchema.optional(),
  site: SiteSchema.optional(),
  /** Where the chapel is; sets the reply deadline in the letter. The demo chapel is in Malta. */
  country: z.enum(["MT", "GR", "DE", "FR", "IE"]).default("MT"),
  /** Public released bands. If omitted the server reads the latest release from the contract. */
  bands: z.array(CellSchema).max(200).optional(),
  /** A unit on the units contract (start-your-own-unit); bands are read from its releases instead of the demo chapel's. */
  unit_id: z.number().int().min(1).max(100_000).optional(),
});

const ModelOut = z.object({
  answer: z.string().min(20).max(1600),
  letter: z.object({ subject: z.string().min(5).max(200), body: z.string().min(50).max(4000) }).optional(),
});

export interface Position {
  grade: string;
  your_eur: number;
  band_mean_eur: number;
  band_n: number;
  delta_eur: number;
  delta_pct: number;
  relation: "below" | "near" | "above";
}

/** The member's grade cell, matched on the grade-only grouping. */
export function positionFor(grade: string, eur: number, cells: readonly Cell[]): Position | undefined {
  const cell = cells.find((c) => Object.keys(c.key).length === 1 && c.key.grade === grade);
  if (!cell) return undefined;
  const delta = eur - cell.mean_eur;
  const pct = Math.round((delta / cell.mean_eur) * 1000) / 10;
  return {
    grade, your_eur: eur, band_mean_eur: cell.mean_eur, band_n: cell.n,
    delta_eur: delta, delta_pct: pct, relation: Math.abs(pct) < 2 ? "near" : delta < 0 ? "below" : "above",
  };
}

/** The system prompt, naming who pooled the bands ("the chapel" or "your unit") in the words the answer should use. */
const systemFor = (pool: string) => [
  "You are a private pay-transparency assistant for a union member. You get JSON facts and reply with ONLY a JSON object.",
  'Keys: "answer" (plain language, at most 110 words, second person, no jargon; use only the numbers in the facts and say',
  `that bands are averages of n members; if position is null say ${pool} could not publish that band safely) and`,
  '"letter" ({subject, body}) a polite Article 7 pay-information request under Directive (EU) 2023/970 asking the employer for',
  "the member's individual pay level, the average pay levels broken down by sex for workers doing the same work or work of equal",
  "value, and the criteria used to set pay, asking for a reply within facts.reply_deadline and citing facts.law. Use bracketed",
  "placeholders for name, employer, job title, date. Do NOT put the member's pay figure in the letter. Never invent legal text beyond Article 7:",
  "cite no national statute, legal notice, regulation number or deadline other than facts.reply_deadline.",
  "If facts.band_release_id is set, the band comes from that release; facts.band_withheld_in lists newer releases that withheld it",
  "because publishing it again would have exposed a colleague. Do not call it the latest release when it is not.",
].join(" ");

function fallbackAnswer(p: Position | undefined, pool: string): string {
  if (!p) {
    return `${pool[0]!.toUpperCase()}${pool.slice(1)} could not publish a safe average for your grade in the latest release, so there is no band to compare with. The pay-information request below asks your employer for the numbers directly.`;
  }
  const dir = p.relation === "near" ? "about the same as" : p.relation === "below" ? "below" : "above";
  return `Your gross annual pay of EUR ${p.your_eur.toLocaleString("en-IE")} is ${dir} the ${p.grade} average of EUR ${p.band_mean_eur.toLocaleString("en-IE")} (${p.delta_pct > 0 ? "+" : ""}${p.delta_pct}%, an average of ${p.band_n} members).`;
}

export function standRoutes(deps: Deps): Hono {
  const app = new Hono();
  app.post("/", async (c) => {
    const parsed = StandRequestSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) throw new AppError(400, "invalid request", "BAD_REQUEST");
    const req = parsed.data;

    let cells = req.bands;
    let releaseId: string | number | undefined;
    let source: ReturnType<typeof bandSource>;
    if (!cells) {
      const { releases } = req.unit_id === undefined ? await readReleases(deps) : await unitReleases(deps, req.unit_id);
      const latest = latestBands(releases);
      if (!latest) throw new AppError(422, "no released bands yet", "NO_RELEASED_BANDS");
      cells = latest.cells;
      releaseId = latest.release_id;
      source = bandSource(releases, req.grade);
    }
    const position = positionFor(req.grade, req.gross_annual_eur, cells);
    /** Who pooled the bands: the demo chapel, or the member's own unit (so the answer never calls a unit "the chapel"). */
    const pool = req.unit_id === undefined ? "the chapel" : "your unit";
    const facts = {
      member: { grade: req.grade, gender: req.gender ?? null, site: req.site ?? null, gross_annual_eur: req.gross_annual_eur },
      position: position ?? null,
      released_bands: cells.filter((x) => x.key.grade === req.grade),
      reply_deadline: replyDeadline(req.country).text,
      law: replyDeadline(req.country).law,
      band_release_id: source?.release_id ?? null,
      band_withheld_in: source?.withheld_in ?? [],
    };
    const content = JSON.stringify(facts);
    const system = systemFor(pool);
    const chat = await deps.chat({
      model: deps.config.textModel,
      messages: [{ role: "system", content: system }, { role: "user", content }],
      max_tokens: 1800,
      temperature: 0.2,
      reasoning_effort: "low",
      estimatedInputTokens: Math.ceil((system.length + content.length) / 2.5) + 200,
    });

    let answer = fallbackAnswer(position, pool);
    let letter: Letter = templateLetter(req.grade, req.country);
    let letterSource: "model" | "fallback" = "fallback";
    try {
      const out = parseModelJson(chat.content, ModelOut);
      answer = out.answer;
      if (isAcceptableLetter(out.letter)) {
        letter = out.letter;
        letterSource = "model";
      }
    } catch {
      // keep deterministic fallbacks; the UI shows `source`
    }
    return c.json({
      position: position ?? null, answer, letter, source: letterSource, release_id: releaseId ?? null, unit_id: req.unit_id ?? null,
      band_release_id: source?.release_id ?? null, band_withheld_in: source?.withheld_in ?? [], verified: chat.verified,
    });
  });
  return app;
}
