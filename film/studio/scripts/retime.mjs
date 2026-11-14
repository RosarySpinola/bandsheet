// Re-time CUES and SCENES in src/timeline.ts from ElevenLabs v4 character alignment.
import fs from "node:fs"
const FPS = 30, LEAD = 15, TAIL = 75 // 0.5 s lead-in, 2.5 s end hold
const al = JSON.parse(fs.readFileSync("public/vo/vo-alignment.json", "utf8"))
const chars = al.alignment.characters, st = al.alignment.character_start_times_seconds, en = al.alignment.character_end_times_seconds
const full = chars.join("")
const src = fs.readFileSync("src/timeline.ts", "utf8")
const cueRe = /\{ id: "(N\d+)", from: \d+, to: \d+, text: "((?:[^"\\]|\\.)*)" \}/g
const norm = (s) => s.replace(/Bandsheet/g, "Band-sheet").replace(/TDX/g, "T-D-X").replace(/DKIM/g, "D-K-I-M").replace(/MCP/g, "M-C-P").replace(/EU median/g, "E-U median")
let cursor = 0
const cues = []
for (const m of src.matchAll(cueRe)) {
  const [, id, text] = m
  const spoken = norm(text)
  const i = full.indexOf(spoken.slice(0, 24), cursor)
  if (i < 0) throw new Error(`cannot align ${id}`)
  const j = i + spoken.length - 1
  cursor = j
  cues.push({ id, from: Math.round(st[i] * FPS) + LEAD, to: Math.round(en[Math.min(j, en.length - 1)] * FPS) + LEAD + 6, text })
}
const total = cues.at(-1).to + TAIL
const at = (id) => cues.find((c) => c.id === id).from - 8
const bounds = [0, at("N2"), at("N4"), at("N6"), at("N8"), at("N10"), at("N11"), at("N12"), total]
const ids = ["S1","S2","S3","S4","S5","S6","S7","S8"]
const scenes = ids.map((id, k) => ({ id, from: bounds[k], dur: bounds[k + 1] - bounds[k] }))
let out = src.replace(/export const SCENES: Scene\[\] = \[[\s\S]*?\n\]/, `export const SCENES: Scene[] = [\n${scenes.map((s) => `  { id: "${s.id}", from: ${s.from}, dur: ${s.dur} },`).join("\n")}\n]`)
out = out.replace(/export const TOTAL = \d+/, `export const TOTAL = ${total}`)
for (const c of cues) out = out.replace(new RegExp(`\\{ id: "${c.id}", from: \\d+, to: \\d+,`), `{ id: "${c.id}", from: ${c.from}, to: ${c.to},`)
fs.writeFileSync("src/timeline.ts", out)
console.log(JSON.stringify({ total, scenes, cues: cues.map(({ id, from, to }) => ({ id, from, to })) }))
