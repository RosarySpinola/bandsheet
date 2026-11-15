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

/** A unit on the units contract: one real member, four synthetic colleagues (shape of GET /api/units/:id). */
export const unitFixture = {
  contract: "bandsheet-units-test.testnet",
  unit: { id: 1, name: "Night desk", council: ["maria-lopes.testnet", "joao-ferreira.testnet"], members: 5, synthetic_members: 4, entries: 5, releases: 1 },
  policy: { k: 3, wasm_sha256: "69d5616cacc61ce82d3b412ffaf76399f8bbfb6bbd853f604283316ce4643b26" },
  proposals: [{ id: 1, status: "executed", query: '{"group_by":["grade"],"stat":"mean","id":0}', release_id: 1 }],
  releases: [{
    id: 1, unit_id: 1, proposal_id: 1, status: "released", query: { group_by: ["grade"], stat: "mean", id: 1 }, requested_by: "joao-ferreira.testnet",
    cells: [{ key: { grade: "Senior" }, n: 5, mean_eur: 58_200 }], suppressed: [], input_hash: "ab".repeat(32), input_sha256: "ab".repeat(32),
    output_hash: "cd".repeat(32), output_sha256: "ef".repeat(32), proof: {}, wasm_sha256: "69d5616cacc61ce82d3b412ffaf76399f8bbfb6bbd853f604283316ce4643b26",
    entries_verified: 0, counts: { entries: 5, synthetic: 4, dkim_verified: 0, self_attested: 1, rejected: 0 },
  }],
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
    if (u.pathname === "/api/units/1") return send(200, unitFixture);
    if (u.pathname.startsWith("/api/units/")) return send(404, { error: "there is no unit 9", code: "UNIT_NOT_FOUND" });
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
