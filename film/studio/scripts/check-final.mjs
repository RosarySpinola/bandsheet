// Refuses a FINAL render while any placeholder survives. Usage: node scripts/check-final.mjs
// Prints the segment start frames to still-check (one still per segment) when it passes.
import fs from "fs"

const src = fs.readFileSync("src/take/segments.ts", "utf8")
const fail = []
if (!/export const SOURCE: [^=]+= "take"/.test(src)) fail.push('segments.ts SOURCE is not "take"')
if (/footage\//.test(src)) fail.push("segments.ts still references public/footage placeholder clips")
for (const f of fs.readdirSync("src/take")) {
  const t = fs.readFileSync(`src/take/${f}`, "utf8")
  for (const bad of [/take pending/i, /\bstub\b/i, /\bTODO\b/, /\bdebug\b/i, /lorem/i]) if (bad.test(t)) fail.push(`src/take/${f}: matches ${bad}`)
}
const take = JSON.parse(fs.readFileSync("src/take/take.json", "utf8"))
if (!take.tabs.length) fail.push("take.json has no tabs")
// every take frame the cut shows must be linked from the take (scripts/take-link.ts)
const linked = fs.existsSync("public/take") ? fs.readdirSync("public/take").flatMap((d) => fs.readdirSync(`public/take/${d}`).map((f) => `${d}/${f}`)) : []
if (linked.length < 50) fail.push(`public/take holds only ${linked.length} frames; run take-link`)
const files = linked
let prev = 597
const segFrames = [...src.matchAll(/\{ to: (\d+), tab:/g)].map((m) => { const f = prev; prev = +m[1]; return f })
if (fail.length) {
  process.stderr.write(`FINAL refused:\n- ${fail.join("\n- ")}\n`)
  process.exit(1)
}
process.stdout.write(`check-final: pass · ${files.length} take files · ${segFrames.length} segments\nstill frames: ${segFrames.map((f) => f + 2).join(" ")}\n`)
