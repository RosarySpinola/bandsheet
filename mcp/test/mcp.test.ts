import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type Api, createApi, forUnit } from "../src/api.js";
import { matchesCell } from "../src/format.js";
import { explainRefusal, getBands, listReleases } from "../src/tools-read.js";
import { payContext, trySubtraction, verifyRelease } from "../src/tools-verify.js";
import { type MockApi, fixtures, startMockApi } from "./mock-api.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
let mock: MockApi;
let api: Api;

beforeAll(async () => {
  mock = await startMockApi();
  api = createApi(mock.url);
});
afterAll(() => mock.close());

describe("tools against recorded API responses", () => {
  it("get_bands: latest cells, with Senior carried from release #1 and the withheld witness", async () => {
    const out = await getBands(api);
    expect(out.text).toContain("grade=Senior: EUR 62,400 (average of 9 members)  [last published in release #1]");
    expect(out.text).toContain("Withheld in release #2");
    expect(out.text).toContain("Release #2 Senior - Release #1 Senior isolates 1 member");
    expect((out.data.withheld as unknown[]).length).toBe(1);
  });
  it("list_releases", async () => {
    const out = await listReleases(api);
    expect(out.text).toMatch(/#1 {2}RELEASED.*released 5, withheld 0/);
    expect(out.text).toMatch(/#2 {2}PARTIALLY_RELEASED.*released 4, withheld 1/);
  });
  it("explain_refusal: witness plus plain words, for several spellings of the cell", async () => {
    for (const cell of ["Senior", "grade=Senior", "senior", "GRADE=SENIOR"]) {
      const out = await explainRefusal(api, 2, cell);
      expect(out.text).toContain("Release #2 withheld grade=Senior.");
      expect(out.text).toContain("subtract an earlier release");
      expect(out.text).toContain("release #1 published grade=Senior as an average of 9 members at EUR 62,400");
    }
  });
  it("explain_refusal: says so when the cell was published or the release is unknown", async () => {
    expect((await explainRefusal(api, 2, "Chief")).text).toContain("was NOT refused");
    expect((await explainRefusal(api, 1, "Senior")).text).toContain("was NOT refused");
    await expect(explainRefusal(api, 9, "Senior")).rejects.toThrow(/no release #9/);
  });
  it("verify_release: PASS list for both real records, attestation honestly skipped", async () => {
    for (const id of [1, 2]) {
      const out = await verifyRelease(api, id);
      expect(out.data.overall).toBe("PASS");
      const ids = (out.data.checks as { id: string; verdict: string }[]).map((c) => `${c.id}:${c.verdict}`);
      expect(ids).toEqual(expect.arrayContaining(["input_hash:PASS", "no_small_cells:PASS", "requested_by_dao:PASS", "dao_vote:PASS", "attestation:SKIP"]));
    }
  });
  it("verify_release: FAILs a tampered record", async () => {
    const bad = structuredClone(fixtures.releases);
    bad.releases[0]!.input_hash = "00".repeat(32);
    bad.releases[0]!.cells[0]!.n = 2;
    const m2 = await startMockApi({ releases: bad });
    try {
      const out = await verifyRelease(createApi(m2.url), 1);
      expect(out.data.overall).toBe("FAIL");
      const failed = (out.data.checks as { id: string; verdict: string }[]).filter((c) => c.verdict === "FAIL").map((c) => c.id);
      expect(failed).toEqual(expect.arrayContaining(["input_hash", "no_small_cells"]));
    } finally {
      await m2.close();
    }
  });
  it("verify_release: compares attestation hashes when the record carries them", async () => {
    const withAtt = structuredClone(fixtures.releases);
    const r = withAtt.releases[0]!;
    r.proof = { attestation: { input_hash: r.input_sha256, output_hash: "ff".repeat(32) } };
    const m2 = await startMockApi({ releases: withAtt });
    try {
      const out = await verifyRelease(createApi(m2.url), 1);
      const v = Object.fromEntries((out.data.checks as { id: string; verdict: string }[]).map((c) => [c.id, c.verdict]));
      expect([v.attestation_input, v.attestation_output]).toEqual(["PASS", "FAIL"]);
    } finally {
      await m2.close();
    }
  });
  it("try_subtraction: typical tool reveals EUR 70,000; Bandsheet withheld it", async () => {
    const out = await trySubtraction(api, 1, 2, "Senior");
    expect(out.text).toContain("10 x 63160 - 9 x 62400 = 70000");
    expect(out.text).toContain("exactly one member's salary");
    expect(out.text).toContain("release #2 WITHHELD it [differencing]");
    expect(out.data).toMatchObject({ naive_revealed_eur: 70000, bandsheet_withheld: true });
  });
  it("try_subtraction: a cell published in both releases is reported plainly", async () => {
    const out = await trySubtraction(api, 1, 2, "Chief");
    expect(out.text).toContain("published grade=Chief in BOTH releases");
    expect(out.data.naive_revealed_eur).toBeNull();
  });
  it("try_subtraction: a cell withheld in both releases is not called published; an unknown cell says so plainly", async () => {
    const two = structuredClone(fixtures.releases);
    const r3 = structuredClone(two.releases[1]!);
    r3.id = 3;
    r3.suppressed = [{ key: { grade: "Senior" }, reason: "differencing", witness: "Release #3 Senior - Release #1 Senior isolates 1 member" }];
    two.releases.push(r3);
    const m2 = await startMockApi({ releases: two });
    try {
      const out = await trySubtraction(createApi(m2.url), 2, 3, "Senior");
      expect(out.text).toContain("release #2 also withheld grade=Senior");
      expect(out.text).not.toContain("release #2 published");
      expect(out.text).toContain("not reproduced for this pair");
      expect(out.text).not.toContain("single-field");
      const none = await trySubtraction(createApi(m2.url), 1, 2, "Nonexistent");
      expect(none.text).toContain('no cell matching "Nonexistent"');
      expect(none.text).not.toContain("not reproducible");
    } finally {
      await m2.close();
    }
  });
  it("verify_release: reports DKIM verification and the recorded engine when the record has them", async () => {
    const withDkim = structuredClone(fixtures.releases);
    const r = withDkim.releases[1]!;
    Object.assign(r, { require_dkim: true, entries_verified: 37, rejections: [{ reason: "dkim_bad_signature", count: 1 }], wasm_sha256: "69d5616cacc61ce82d3b412ffaf76399f8bbfb6bbd853f604283316ce4643b26" });
    const m2 = await startMockApi({ releases: withDkim });
    try {
      const out = await verifyRelease(createApi(m2.url), 2);
      expect(out.text).toContain("37 entries verified, 1 refused (dkim_bad_signature: 1)");
      expect(out.text).toContain("engine build recorded with this release: 69d5616cacc61ce8");
      expect(out.data.overall).toBe("PASS");
    } finally {
      await m2.close();
    }
  });
  it("pay_context: Eurostat median with year and source; API errors are readable", async () => {
    const out = await payContext(api, "mt");
    expect(out.text).toContain("Malta, Professionals (ISCO-08 OC2): median gross monthly earnings EUR 2,189");
    expect(out.text).toContain("survey year 2018");
    expect(out.text).toContain("ec.europa.eu/eurostat");
    await expect(payContext(api, "US")).rejects.toThrow(/Bandsheet API error 400: country must be one of/);
  });
  it("reports an unreachable API without a stack trace", async () => {
    await expect(getBands(createApi("http://127.0.0.1:1/api"))).rejects.toThrow(/Could not reach the Bandsheet API/);
  });
  it("matches cell text flexibly", () => {
    expect(matchesCell({ grade: "Senior", site: "City" }, "grade=Senior, site=City")).toBe(true);
    expect(matchesCell({ grade: "Senior", site: "City" }, "city")).toBe(true);
    expect(matchesCell({ grade: "Senior" }, "site=Senior")).toBe(false);
    expect(matchesCell({ grade: "Senior" }, "")).toBe(false);
  });
});

describe("over stdio (built server, real MCP client)", () => {
  let client: Client;
  beforeAll(async () => {
    execFileSync("npx", ["tsc", "-p", "tsconfig.json"], { cwd: root, stdio: "pipe" });
    client = new Client({ name: "test", version: "0.0.0" });
    await client.connect(new StdioClientTransport({
      command: process.execPath, args: [resolve(root, "dist/index.js")],
      env: { ...process.env, BANDSHEET_API: mock.url } as Record<string, string>,
    }));
  }, 60_000);
  afterAll(() => client.close());

  const text = (r: unknown) => ((r as { content: { text: string }[] }).content[0]!.text);

  it("lists the six tools", async () => {
    const tools = (await client.listTools()).tools.map((t) => t.name).sort();
    expect(tools).toEqual(["explain_refusal", "get_bands", "list_releases", "pay_context", "try_subtraction", "verify_release"]);
  });
  it("calls every tool and gets text plus structured content", async () => {
    const calls: [string, Record<string, unknown>, RegExp][] = [
      ["get_bands", {}, /Latest released pay bands/],
      ["list_releases", {}, /Releases logged on NEAR testnet/],
      ["explain_refusal", { release_id: 2, cell: "Senior" }, /isolates 1 member/],
      ["verify_release", { release_id: 2 }, /Release #2: PASS/],
      ["try_subtraction", { release_a: 1, release_b: 2, cell: "Senior" }, /70,000|70000/],
      ["pay_context", { country: "MT" }, /EUR 2,189/],
    ];
    for (const [name, args, re] of calls) {
      const r = await client.callTool({ name, arguments: args });
      expect(r.isError, name).toBeFalsy();
      expect(text(r), name).toMatch(re);
      expect(r.structuredContent, name).toBeTruthy();
    }
  });
  it("returns isError for bad input and API errors instead of crashing", async () => {
    const unknown = await client.callTool({ name: "explain_refusal", arguments: { release_id: 99, cell: "Senior" } });
    expect(unknown.isError).toBe(true);
    expect(text(unknown)).toMatch(/no release #99/);
    await expect(client.callTool({ name: "pay_context", arguments: { country: "US" } })).resolves.toMatchObject({ isError: true });
  });
});

describe("tools scoped to a unit (unit_id)", () => {
  it("get_bands and list_releases label synthetic entries", async () => {
    const u = forUnit(api, 1);
    const bands = await getBands(u);
    expect(bands.text).toContain("SYNTHETIC: 4 of 5 entries in release #1 are synthetic colleagues (sample data), not real pay.");
    expect(bands.text).toContain("grade=Senior: EUR 58,200 (average of 5 members)");
    expect((bands.data.counts as { synthetic: number }).synthetic).toBe(4);
    const list = await listReleases(u);
    expect(list.text).toContain("[SYNTHETIC: 4 sample-data entries]");
  });
  it("verify_release checks the in-contract council vote instead of a DAO, and reports entry kinds", async () => {
    const out = await verifyRelease(forUnit(api, 1), 1);
    expect(out.text).toContain("PASS  requested_by_council");
    expect(out.text).toContain("PASS  council_vote: in-contract proposal #1 passed");
    expect(out.text).toContain("0 DKIM-verified, 1 self-attested, 4 synthetic (sample data)");
    expect(out.text).toContain("SYNTHETIC: 4 of 5");
    expect(out.data.synthetic).toBe(true);
    expect(out.text).not.toContain("requested_by_dao");
  });
  it("an unknown unit is a plain error", async () => {
    await expect(getBands(forUnit(api, 9))).rejects.toThrow(/UNIT_NOT_FOUND/);
  });
});
