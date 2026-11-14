// Usage: node scripts/take-marks.mjs <takeDir>
// Writes src/take/take.json: the take's marks (label → epoch ms, from marks.log and stages.json when present)
// and its tabs (from the frame names). segments.ts reads only this file.
import fs from "fs"
import path from "path"

const dir = process.argv[2]
const marks = {}
const log = path.join(dir, "marks.log")
if (fs.existsSync(log)) {
  for (const line of fs.readFileSync(log, "utf8").split("\n")) {
    const m = line.match(/^(\d{13}) (.+)$/)
    if (m && !(m[2].trim() in marks)) marks[m[2].trim()] = +m[1]
  }
}
const st = path.join(dir, "stages.json")
const stages = fs.existsSync(st) ? JSON.parse(fs.readFileSync(st, "utf8")) : []
// Tabs straight from the take (same rule as take-to-mp4.mjs: t0 = first frame, dur = last − first + 33 ms).
const targets = JSON.parse(fs.readFileSync(path.join(dir, "targets.json"), "utf8"))
const tabs = []
for (const [id, t] of Object.entries(targets)) {
  if (!fs.existsSync(path.join(dir, id))) continue
  const ms = fs.readdirSync(path.join(dir, id)).filter((f) => /^\d+\.jpg$/.test(f)).map((f) => parseInt(f)).sort((a, b) => a - b)
  if (ms.length < 2) continue
  tabs.push({ id, kind: t.kind, file: `take/${id}.mp4`, t0: ms[0], dur: ms[ms.length - 1] - ms[0] + 33, first_url: t.first_url, last_url: t.last_url, frames: ms })
}
fs.writeFileSync("src/take/take.json", JSON.stringify({ dir: path.basename(dir), marks, stages, tabs }, null, 2) + "\n")
process.stdout.write(`take.json: ${Object.keys(marks).length} marks, ${stages.length} stages, ${tabs.length} tabs\n`)
