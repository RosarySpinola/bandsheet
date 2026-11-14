import { Hono } from "hono";
import { cors } from "hono/cors";
import { ZodError } from "zod";
import type { Deps } from "./deps";
import { AppError, SpendCapError } from "./errors";
import { extractRoutes } from "./routes/extract";
import { releasesRoutes } from "./routes/releases";
import { standRoutes } from "./routes/stand";

/** Stateless by design: nothing from a request is written anywhere except the token/cost ledger. */
export function createApp(deps: Deps): Hono {
  const app = new Hono();
  app.use("/api/*", cors({ origin: deps.config.corsOrigin }));

  app.get("/api/health", async (c) => {
    const spend = await deps.guard.summary().catch(() => undefined);
    return c.json({
      ok: true,
      live: deps.config.hasKey,
      contract: deps.config.contract ?? null,
      models: { vision: deps.config.visionModel, text: deps.config.textModel },
      spend: spend ?? null,
    });
  });
  app.route("/api/extract", extractRoutes(deps));
  app.route("/api/stand", standRoutes(deps));
  app.route("/api/releases", releasesRoutes(deps));

  app.notFound((c) => c.json({ error: "not found", code: "NOT_FOUND" }, 404));
  app.onError((err, c) => {
    if (err instanceof AppError) return c.json(err.body(), err.status);
    if (err instanceof ZodError) return c.json({ error: "invalid request", code: "BAD_REQUEST" }, 400);
    return c.json({ error: "internal error", code: "INTERNAL" }, 500);
  });
  return app;
}

export { SpendCapError };
