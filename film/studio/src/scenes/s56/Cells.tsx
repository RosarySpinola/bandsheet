import { interpolateColors, useCurrentFrame } from "remotion"
import { C, sans, serif, easeInOut } from "../../tokens"
import { B6 } from "./beats"
import { CELL_BITS, CELL_CASE, CELL_COLS, CELLS_PUBLISHED, CELLS_TOTAL } from "./cellData"
import { G } from "./Grids"
import { cl, mix, prog, Type } from "./type"

/**
 * "and still published nearly three cells in four": Bandsheet's 100 case dots unfold into the 1,265 cells a
 * typical tool would have published across those cases (each dot into its own cells), then the 931 that
 * Bandsheet still published fill ink; the 334 it withheld stay an outline.
 */
export const CG = { x0: 303, y0: 264, pitch: 24, size: 18 }
const ROWS = Math.ceil(CELLS_TOTAL / CELL_COLS)
const FLY = B6.still
const fillAt = (j: number) => B6.nearly + (j % CELL_COLS) * 0.5 + Math.floor(j / CELL_COLS) * 0.3
const PUB_AT = Array.from(CELL_BITS).map((b, j) => (b === "1" ? fillAt(j) : Infinity)).sort((a, b) => a - b)

export function Cells() {
  const f = useCurrentFrame()
  if (f < FLY) return null
  const gx = G.rx + G.pad
  const gy = G.top + 150
  const shown = PUB_AT.filter((t) => t <= f).length
  const labelOn = prog(f, FLY + 10, FLY + 20)
  return (
    <>
      <div style={{ position: "absolute", left: CG.x0, top: G.top, opacity: labelOn }}>
        <Type text="BANDSHEET  ·  THE SAME 100 ATTACK CASES" start={FLY + 8} size={16} family={sans} weight={600} tracking={0.08} cps={0.3} color={C.gray350} />
      </div>
      <div style={{ position: "absolute", left: CG.x0, top: G.top + 26, display: "flex", alignItems: "baseline", whiteSpace: "pre" }}>
        {f >= B6.published - 2 ? <Type text="still published: " start={B6.published - 2} size={46} family={serif} cps={0.35} /> : null}
        <span style={{ fontFamily: serif, fontWeight: 500, fontSize: 46, color: C.ink, fontVariantNumeric: "tabular-nums", opacity: prog(f, B6.published + 4, B6.published + 8), display: "inline-block", minWidth: "2.1em", textAlign: "right" }}>
          {shown.toLocaleString("en-GB")}
        </span>
        {f >= B6.published + 6 ? <Type text={` of ${CELLS_TOTAL.toLocaleString("en-GB")} cells`} start={B6.published + 6} size={46} family={serif} cps={0.35} /> : null}
      </div>
      <div style={{ position: "absolute", right: 1920 - (CG.x0 + CELL_COLS * CG.pitch - (CG.pitch - CG.size)), top: G.top + 22 }}>
        {f >= B6.inFour ? <Type text={`${((CELLS_PUBLISHED / CELLS_TOTAL) * 100).toFixed(1)}%`} start={B6.inFour} size={56} family={serif} cps={1} /> : null}
      </div>
      {Array.from(CELL_BITS).map((bit, j) => {
        const ci = CELL_CASE[j]
        const sx = gx + (ci % 10) * G.pitch + G.dot / 2
        const sy = gy + Math.floor(ci / 10) * G.pitch + G.dot / 2
        const col = j % CELL_COLS
        const row = Math.floor(j / CELL_COLS)
        const tx = CG.x0 + col * CG.pitch + CG.size / 2
        const ty = CG.y0 + row * CG.pitch + CG.size / 2
        const t = prog(f, FLY + ci * 0.12, FLY + ci * 0.12 + 16, easeInOut)
        const s = mix(G.dot, CG.size, t)
        const a = fillAt(j)
        const k = prog(f, a, a + 5)
        const pub = bit === "1"
        // published: fills ink; withheld: a brief lavender flash as the sweep passes, then an outline
        const flash = pub ? 0 : cl(1 - Math.abs(f - a - 3) / 6)
        const bg = pub ? interpolateColors(k, [0, 1], ["rgba(15,48,38,0)", C.ink]) : interpolateColors(flash, [0, 1], ["rgba(205,194,255,0)", C.lav])
        const border = pub ? C.ink : interpolateColors(flash, [0, 1], ["rgba(15,48,38,0.55)", C.lav300])
        return (
          <div key={j} style={{ position: "absolute", left: mix(sx, tx, t) - s / 2, top: mix(sy, ty, t) - s / 2, width: s, height: s, boxSizing: "border-box", border: `1.5px solid ${border}`, background: bg, borderRadius: `${50 * (1 - t)}%` }} />
        )
      })}
      <div style={{ position: "absolute", left: CG.x0, top: CG.y0 + ROWS * CG.pitch + 8, display: "flex", gap: 28, alignItems: "center", fontFamily: sans, fontSize: 19, color: C.gray350, opacity: prog(f, B6.nearly + 6, B6.nearly + 16) }}>
        <span style={{ display: "flex", alignItems: "center", gap: 10 }}><span style={{ width: 16, height: 16, background: C.ink }} />published</span>
        <span style={{ display: "flex", alignItems: "center", gap: 10 }}><span style={{ width: 16, height: 16, boxSizing: "border-box", border: `1.5px solid rgba(15,48,38,0.55)` }} />withheld</span>
      </div>
    </>
  )
}
