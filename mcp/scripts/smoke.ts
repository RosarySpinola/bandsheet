/**
 * Calls every tool over stdio against the real API (BANDSHEET_API, default https://bandsheet.pages.dev/api).
 * Usage: pnpm --filter bandsheet-mcp build && pnpm --filter bandsheet-mcp smoke
 */
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const client = new Client({ name: "bandsheet-smoke", version: "0.0.0" });
await client.connect(new StdioClientTransport({ command: process.execPath, args: [resolve(root, "dist/index.js")], env: process.env as Record<string, string> }));
const out = (s: string): void => void process.stdout.write(`${s}\n`);

const calls: [string, Record<string, unknown>][] = [
  ["get_bands", {}], ["list_releases", {}],
  ["explain_refusal", { release_id: 2, cell: "Senior" }], ["verify_release", { release_id: 2 }],
  ["try_subtraction", { release_a: 1, release_b: 2, cell: "Senior" }], ["pay_context", { country: "MT" }],
];
let bad = 0;
for (const [name, args] of calls) {
  const r = (await client.callTool({ name, arguments: args })) as { isError?: boolean; content: { text: string }[] };
  if (r.isError) bad++;
  out(`\n== ${name} ${JSON.stringify(args)} ${r.isError ? "ERROR" : "ok"}\n${r.content[0]?.text}`);
}
await client.close();
process.exit(bad ? 1 : 0);
