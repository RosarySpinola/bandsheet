import { readFileSync } from "node:fs";
import { type Server, createServer } from "node:http";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Release } from "../src/api.js";

const here = dirname(fileURLToPath(import.meta.url));
const load = <T>(name: string): T => JSON.parse(readFileSync(resolve(here, "fixtures", name), "utf8")) as T;

/** Recorded from the live API on 14 Nov 2026 (synthetic chapel data). */
export const fixtures = {
  releases: load<{ releases: Release[] }>("releases.json"),
  unit: load<Record<string, unknown>>("unit.json"),
  proposals: load<Record<string, unknown>>("dao_proposals.json"),
  naive: load<Record<string, unknown>>("demo_naive.json"),
  context: load<Record<string, unknown>>("context_country_MT_isco_OC2.json"),
};

export interface MockApi {
  url: string;
  hits: string[];
  close(): Promise<void>;
}

export async function startMockApi(over: { releases?: unknown } = {}): Promise<MockApi> {
  const hits: string[] = [];
  const server: Server = createServer((req, res) => {
    const u = new URL(req.url ?? "/", "http://x");
    hits.push(`${u.pathname}${u.search}`);
    const send = (status: number, body: unknown) => {
      res.writeHead(status, { "content-type": "application/json" });
      res.end(JSON.stringify(body));
    };
    if (u.pathname === "/api/releases") return send(200, over.releases ?? fixtures.releases);
    if (u.pathname === "/api/unit") return send(200, fixtures.unit);
    if (u.pathname === "/api/dao/proposals") return send(200, fixtures.proposals);
    if (u.pathname === "/api/demo/naive") return send(200, fixtures.naive);
    if (u.pathname === "/api/context") {
      const c = u.searchParams.get("country");
      return c === "MT" ? send(200, fixtures.context) : send(400, { error: "country must be one of MT, GR, DE, FR, IE; isco like OC2", code: "BAD_REQUEST" });
    }
    send(404, { error: "not found", code: "NOT_FOUND" });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const port = (server.address() as { port: number }).port;
  return { url: `http://127.0.0.1:${port}/api`, hits, close: () => new Promise((r) => server.close(() => r())) };
}
