import type { Context, MiddlewareHandler } from "hono";
import { AppError } from "./errors";

export interface RateLimitOptions {
  /** Max requests per window per client. */
  limit: number;
  windowMs?: number;
  now?: () => number;
}

/** Client address: Cloudflare's header, then the first X-Forwarded-For hop, then the socket. */
export function clientIp(c: Context): string {
  const h = c.req.header.bind(c.req);
  const fwd = h("cf-connecting-ip") ?? h("x-forwarded-for")?.split(",")[0]?.trim();
  const sock = (c.env as { incoming?: { socket?: { remoteAddress?: string } } } | undefined)?.incoming?.socket?.remoteAddress;
  return fwd || sock || "unknown";
}

/**
 * Fixed-window per-IP limiter (in memory: per process or isolate, so approximate when scaled out).
 * Behind a proxy that does not set cf-connecting-ip/x-forwarded-for, every client shares one bucket.
 */
export function rateLimit(opts: RateLimitOptions): MiddlewareHandler {
  const windowMs = opts.windowMs ?? 60_000;
  const now = opts.now ?? Date.now;
  const hits = new Map<string, { start: number; n: number }>();
  return async (c, next) => {
    const t = now();
    const ip = clientIp(c);
    const cur = hits.get(ip);
    if (!cur || t - cur.start >= windowMs) hits.set(ip, { start: t, n: 1 });
    else if (++cur.n > opts.limit) {
      c.header("retry-after", String(Math.ceil((cur.start + windowMs - t) / 1000)));
      throw new AppError(429, "too many requests; slow down", "RATE_LIMITED");
    }
    if (hits.size > 5000) for (const [k, v] of hits) if (t - v.start >= windowMs) hits.delete(k);
    await next();
  };
}
