// Bundled by esbuild and run by node: hard-links exactly the take JPEGs the cut shows into public/take/<role>/.
// Usage: node scripts/take-link.cjs <takeDir>
import fs from "fs"
import path from "path"
import { TABS, TAKE_FROM, TAKE_TO, takeAt } from "../src/take/segments"
import { frameAt, framePath } from "../src/take/Frame"

const dir = process.argv[2]
const need = new Map<string, string>()
for (let f = TAKE_FROM; f < TAKE_TO; f++) {
  const { tab, ms } = takeAt(f)
  const pick = frameAt(tab.frames, ms)
  need.set(framePath(tab.id, pick), path.join(dir, tab.src, `${pick}.jpg`))
}
fs.rmSync("public/take", { recursive: true, force: true })
for (const t of TABS) fs.mkdirSync(path.join("public/take", t.id), { recursive: true })
for (const [to, from] of need) fs.linkSync(from, path.join("public", to))
process.stdout.write(`take-link: ${need.size} frames into public/take (${TABS.map((t) => t.id).join(", ")})\n`)
