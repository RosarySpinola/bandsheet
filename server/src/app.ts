import { Hono } from "hono";
import { cors } from "hono/cors";
import { ZodError } from "zod";
import type { Deps } from "./deps";
import { AppError, SpendCapError } from "./errors";
import { rateLimit } from "./ratelimit";
import { chainRoutes } from "./routes/chain";
import { contextRoutes } from "./routes/context";
import { demoRoutes } from "./routes/demo";
import { extractRoutes } from "./routes/extract";
import { releasesRoutes } from "./routes/releases";
import { standRoutes } from "./routes/stand";
import { authRoutes } from "./routes/auth";
import { sponsorRoutes } from "./routes/sponsor";
import { unitsRoutes } from "./routes/units";

/** Nothing from a request is written anywhere except the token/cost ledger and the sign-in store (/api/auth, D1). */
export function createApp(deps: Deps): Hono {
  const app = new Hono();
  app.use("/api/*", cors({ origin: deps.config.corsOrigin }));

  app.get("/api/health", async (c) => {
    const spend = await deps.guard.summary().catch(() => undefined);
    const reads = await deps.guard.reads().catch(() => undefined);
    return c.json({
      ok: true,
      live: deps.config.hasKey,
      contract: deps.config.contract ?? null,
      models: { vision: deps.config.visionModel, text: deps.config.textModel },
      spend: spend ?? null,
      payslip_reads: reads ? { used_this_month: reads.used, monthly_limit: reads.limit, month_from: reads.since } : null,
    });
  });
  // Write endpoints share one bucket (10/min/IP). The AI routes cost money, so they get their own.
  const writes = rateLimit({ limit: 10 });
  const ai = rateLimit({ limit: 20 });
  for (const path of ["/api/dao/propose", "/api/dao/vote", "/api/demo/submit"]) app.use(path, writes);
  for (const path of ["/api/extract", "/api/stand"]) app.use(path, ai);
  // Sign-in: joins and NEAR Auth relays spend the owner's testnet gas, so they get the tightest bucket.
  app.use("/api/auth/nonce", rateLimit({ limit: 20 }));
  for (const path of ["/api/auth/join", "/api/auth/near-auth/sign"]) app.use(path, rateLimit({ limit: 5 }));
  app.use("/api/auth/entry", rateLimit({ limit: 10 }));
  // Units: registrar writes spend the registrar's testnet gas; the sponsor pays out NEAR, so it is the tightest.
  app.use("/api/units/nonce", rateLimit({ limit: 30 }));
  for (const path of ["/api/units/:id/join", "/api/units/:id/issuer"]) app.use(path, rateLimit({ limit: 5 }));
  app.use("/api/units/:id/synthetic", rateLimit({ limit: 3 }));
  app.use("/api/units/:id/run", rateLimit({ limit: 5 }));
  app.use("/api/units/:id/entry", rateLimit({ limit: 10 }));
  app.use("/api/sponsor", rateLimit({ limit: 5 }));

  app.route("/api", chainRoutes(deps));
  app.route("/api", contextRoutes());
  app.route("/api/demo", demoRoutes(deps));
  app.route("/api/extract", extractRoutes(deps));
  app.route("/api/stand", standRoutes(deps));
  app.route("/api/releases", releasesRoutes(deps));
  app.route("/api/auth", authRoutes(deps));
  app.route("/api/units", unitsRoutes(deps));
  app.route("/api/sponsor", sponsorRoutes(deps));

  app.notFound((c) => c.json({ error: "not found", code: "NOT_FOUND" }, 404));
  app.onError((err, c) => {
    if (err instanceof AppError) return c.json(err.body(), err.status);
    if (err instanceof ZodError) return c.json({ error: "invalid request", code: "BAD_REQUEST" }, 400);
    console.error("unhandled error", err instanceof Error ? `${err.name}: ${err.message}` : String(err));
    return c.json({ error: "internal error", code: "INTERNAL" }, 500);
  });
  return app;
}

export { SpendCapError };
