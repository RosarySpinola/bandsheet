import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { Api } from "./api.js";
import type { ToolOut } from "./format.js";
import { explainRefusal, getBands, listReleases } from "./tools-read.js";
import { payContext, trySubtraction, verifyRelease } from "./tools-verify.js";

const READ_ONLY = { readOnlyHint: true, openWorldHint: true } as const;

async function run(fn: () => Promise<ToolOut>) {
  try {
    const out = await fn();
    return { content: [{ type: "text" as const, text: out.text }], structuredContent: out.data };
  } catch (e) {
    return { content: [{ type: "text" as const, text: (e as Error).message }], isError: true };
  }
}

export function buildServer(api: Api): McpServer {
  const server = new McpServer({ name: "bandsheet", version: "0.1.0" });
  const release = z.number().int().min(1).describe("Release number, as listed by list_releases");
  const cell = z.string().min(1).describe('Cell to look at, e.g. "Senior" or "grade=Senior"');

  server.registerTool("get_bands", {
    title: "Latest pay bands",
    description: "The latest released pay bands (mean gross annual EUR per cell) from the Bandsheet chapel, and the cells withheld in the newest release with their witnesses.",
    inputSchema: {}, annotations: READ_ONLY,
  }, () => run(() => getBands(api)));

  server.registerTool("list_releases", {
    title: "List releases",
    description: "Every release logged on NEAR testnet: status, how many cells were released and withheld, and when.",
    inputSchema: {}, annotations: READ_ONLY,
  }, () => run(() => listReleases(api)));

  server.registerTool("explain_refusal", {
    title: "Explain a refusal",
    description: "Why Bandsheet withheld a cell in a release: the witness equation and a plain-words explanation.",
    inputSchema: { release_id: release, cell }, annotations: READ_ONLY,
  }, ({ release_id, cell: c }) => run(() => explainRefusal(api, release_id, c)));

  server.registerTool("verify_release", {
    title: "Verify a release",
    description: "Check one on-chain release record: hashes (enclave vs contract), small-cell rule, witnesses, DAO vote, and OutLayer attestation hashes when the record carries them. Returns a PASS/FAIL/SKIP list.",
    inputSchema: { release_id: release }, annotations: READ_ONLY,
  }, ({ release_id }) => run(() => verifyRelease(api, release_id)));

  server.registerTool("try_subtraction", {
    title: "Try the subtraction attack",
    description: "Subtract release A from release B for a cell: what a typical n>=3 tool would expose (on the synthetic demo chapel) versus what Bandsheet published.",
    inputSchema: { release_a: release, release_b: release, cell }, annotations: READ_ONLY,
  }, ({ release_a, release_b, cell: c }) => run(() => trySubtraction(api, release_a, release_b, c)));

  server.registerTool("pay_context", {
    title: "Public pay context",
    description: "Eurostat Structure of Earnings Survey median gross monthly earnings for ISCO-08 Professionals (OC2) in MT, GR, DE, FR or IE, with year and source. The latest survey year is dated.",
    inputSchema: { country: z.enum(["MT", "GR", "DE", "FR", "IE"]), isco: z.string().regex(/^OC[0-9]$/).optional().describe("ISCO-08 major group, default OC2 (Professionals)") },
    annotations: READ_ONLY,
  }, ({ country, isco }) => run(() => payContext(api, country, isco)));

  return server;
}

