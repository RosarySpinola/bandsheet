#!/usr/bin/env node
/**
 * Gate for S7's truth rules. Exits 1 if any fails.
 *  1. The chat card's answer (mcp-answer.json) equals a live explain_refusal call through the real bandsheet-mcp server.
 *  2. The median label is "Malta · Professionals (ISCO 2) · Eurostat SES 2018 · €26,268 / yr" and €26,268 = 12 × the live
 *     pay_context MT monthly median.
 *  3. No S7/S8 source says "EU median", "legal notice", "eight days" or "8 days" (unverified claims removed from the app).
 *  4. The letter text (letter-template.json) equals server/src/letter.ts templateLetter("Reporter", "MT") today.
 * Run from film/studio: node src/scenes/s78/check-s78.mjs   (needs network; the MCP server reads bandsheet.pages.dev/api)
 */
import { readFileSync, readdirSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

const here = dirname(fileURLToPath(import.meta.url))
const MCP = resolve(here, "../../../../../mcp")
const sdk = (p) => import(pathToFileURL(join(MCP, "node_modules/@modelcontextprotocol/sdk/dist/esm", p)).href)
const { Client } = await sdk("client/index.js")
const { StdioClientTransport } = await sdk("client/stdio.js")

const LABEL = "Malta · Professionals (ISCO 2) · Eurostat SES 2018 · €26,268 / yr"
const saved = JSON.parse(readFileSync(join(here, "mcp-answer.json"), "utf8"))
const fails = []
const pass = (m) => process.stdout.write(`PASS  ${m}\n`)

const client = new Client({ name: "film-s78-check", version: "0.0.0" })
await client.connect(new StdioClientTransport({ command: process.execPath, args: [join(MCP, "dist/index.js")], env: process.env }))
const live = await client.callTool({ name: saved.tool, arguments: saved.arguments })
const ctx = await client.callTool({ name: "pay_context", arguments: { country: "MT" } })
await client.close()

if (live.isError || live.content[0].text !== saved.text) fails.push("explain_refusal text differs from mcp-answer.json (re-capture it)")
else pass("chat answer equals live explain_refusal(release 3, Senior)")

const monthly = ctx.structuredContent?.median_monthly_eur
const year = ctx.structuredContent?.year
if (monthly * 12 !== 26268 || year !== 2018 || ctx.structuredContent?.isco08 !== "OC2") fails.push(`pay_context MT changed: ${monthly}/month, ${year}`)
else pass(`pay_context MT: €${monthly} × 12 = €26,268, SES ${year}, OC2`)

const src = readdirSync(here).filter((f) => /\.tsx?$/.test(f)).map((f) => [f, readFileSync(join(here, f), "utf8")])
const all = src.concat(["S7.tsx", "S8.tsx"].map((f) => [f, readFileSync(join(here, "..", f), "utf8")]))
const letterJson = readFileSync(join(here, "letter-template.json"), "utf8")
const scanned = all.concat([["letter-template.json", letterJson], ["mcp-answer.json", readFileSync(join(here, "mcp-answer.json"), "utf8")]])
for (const [name, re] of [["EU median", /EU median/i], ["legal notice", /legal notice/i], ["eight days / 8 days", /\b(eight|8)\s+days\b/i]]) {
  const hit = scanned.filter(([, t]) => re.test(t)).map(([f]) => f)
  if (hit.length) fails.push(`"${name}" appears in ${hit.join(", ")}`)
  else pass(`no S7/S8 source says "${name}"`)
}
const { templateLetter } = await import(pathToFileURL(resolve(here, "../../../../../server/src/letter.ts")).href)
const savedLetter = JSON.parse(letterJson)
const liveLetter = templateLetter(savedLetter.args.grade, savedLetter.args.country)
if (liveLetter.subject !== savedLetter.subject || liveLetter.body !== savedLetter.body) fails.push("letter-template.json differs from server/src/letter.ts templateLetter (regenerate it)")
else pass(`letter equals templateLetter("${savedLetter.args.grade}", "${savedLetter.args.country}")`)
if (!src.some(([, t]) => t.includes(LABEL))) fails.push("median label string not found in s78 sources")
else pass(`median label reads "${LABEL}"`)

for (const f of fails) process.stdout.write(`FAIL  ${f}\n`)
process.exit(fails.length ? 1 : 0)
