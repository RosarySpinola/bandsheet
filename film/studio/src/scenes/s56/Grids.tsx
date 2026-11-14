import { interpolateColors, useCurrentFrame } from "remotion"
import { C, sans, serif, ease, easeInOut } from "../../tokens"
import { B6 } from "./beats"
import { LEAK_INDEX } from "./data"
import { cl, prog, Type } from "./type"

/** Two evaluation cards with 10×10 case grids (enclave/evaluation/results.json, seeds 0..99). */
export const G = { top: 172, h: 628, w: 760, lx: 160, rx: 1000, pad: 44, dot: 24, pitch: 39 }
/**
 * Local frames, on their words (beats.ts): cards in on "generated attacks", the run from "attacks. A typical"
 * to "ninety-five" (the counter lands on 95 with the word), stats on "of them", the 0 pulses on "none";
 * on "and still published" the naive card steps aside and Bandsheet's dots unfold into cells (Cells.tsx).
 */
export const GT = { in: B6.generated, run0: B6.typical, run1: B6.ninetyFive, stats: B6.ofThem, none: B6.none, exit: B6.still }

/** Cases run so far (0..100) at frame f, accelerating then settling. */
const ran = (f: number) => 100 * prog(f, GT.run0, GT.run1, easeInOut)
/** First frame at which `ran` passes x (for per-dot pop timing). */
function frameAt(x: number) {
  for (let f = GT.run0; f <= GT.run1; f++) if (ran(f) > x) return f
  return GT.run1
}
const CASE_T = Array.from({ length: 100 }, (_, i) => frameAt(i))

function Card({ x, naive, f, dots = true }: { x: number; naive: boolean; f: number; dots?: boolean }) {
  const t = prog(f, GT.in + (naive ? 0 : 3), GT.in + (naive ? 10 : 13), ease)
  const leakedNow = naive ? LEAK_INDEX.filter((k, i) => k >= 0 && f >= CASE_T[i]).length : 0
  const gx = x + G.pad
  const gy = G.top + 150
  return (
    <>
      {/* card ground fades up with its content (no empty grey hold) */}
      {naive ? (
        <div style={{ position: "absolute", left: x, top: G.top + 24 * (1 - t), width: G.w, height: G.h, background: C.band, opacity: t }} />
      ) : (
        <div style={{ position: "absolute", left: x, top: G.top + 24 * (1 - t), width: G.w, height: G.h, boxSizing: "border-box", border: `2px solid ${C.ink}`, opacity: t }} />
      )}
      <div style={{ position: "absolute", left: gx, top: G.top + 36 }}>
        <Type text={naive ? "A TYPICAL N≥3 TOOL" : "BANDSHEET'S ENGINE  ·  SAME 100 CASES"} start={GT.in + 2} size={16} family={sans} weight={600} tracking={0.08} cps={0.4} />
      </div>
      <div style={{ position: "absolute", left: gx, top: G.top + 66 }}>
        <Type text={naive ? "Publishes every group of three or more." : "Checks against every earlier release."} start={GT.in + 5} size={34} family={serif} cps={0.45} />
      </div>
      {(dots ? Array.from({ length: 100 }) : []).map((_, i) => {
        const r = Math.floor(i / 10)
        const c = i % 10
        const appear = cl((f - GT.in - 6 - (r + c) * 0.6) / 5)
        const age = f - CASE_T[i]
        let fill = "transparent"
        let stroke: string = C.ink
        let s = 1
        if (naive && LEAK_INDEX[i] >= 0 && age >= 0) {
          fill = C.alarm
          stroke = C.alarm
          s = 1 + 0.3 * Math.max(0, 1 - age / 6) * cl(age / 2)
        } else if (naive) {
          stroke = "rgba(15,48,38,0.55)"
        } else if (age >= 0) {
          // Bandsheet: the attack is tried and refused; a lavender flash settles back to the ink outline.
          const k = cl(1 - age / 10)
          fill = interpolateColors(k, [0, 1], ["rgba(205,194,255,0)", C.lav])
          stroke = interpolateColors(k, [0, 1], [C.ink, C.lav300])
        }
        return (
          <div key={i} style={{ position: "absolute", left: gx + c * G.pitch, top: gy + r * G.pitch, width: G.dot, height: G.dot, borderRadius: "50%", boxSizing: "border-box", border: `2px solid ${stroke}`, background: fill, opacity: appear, transform: `scale(${s * (0.6 + 0.4 * appear)})` }} />
        )
      })}
      <div style={{ position: "absolute", left: gx + 10 * G.pitch + 52, top: gy - 30, opacity: prog(f, GT.in + 8, GT.in + 16) }}>
        <div style={{ fontFamily: serif, fontWeight: 500, fontSize: 168, lineHeight: 1, color: naive && leakedNow > 0 ? C.alarm : C.ink, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em", transformOrigin: "0 80%", transform: naive ? undefined : `scale(${1 + 0.12 * Math.sin(Math.PI * prog(f, GT.none, GT.none + 14))})` }}>
          {naive ? leakedNow : 0}
        </div>
        <div style={{ fontFamily: sans, fontSize: 22, color: C.gray350, marginTop: 12, lineHeight: 1.35 }}>
          of 100 attack cases
          <br />
          leaked a salary
        </div>
      </div>
      <div style={{ position: "absolute", left: gx, top: G.top + G.h - 66 }}>
        {naive ? (
          <Type text="187 exact salaries recovered" start={GT.stats} size={23} family={sans} weight={600} color={C.alarm} from={C.ink} cps={0.25} />
        ) : (
          <Type text="0 exact salaries recovered" start={GT.none} size={23} family={sans} weight={600} cps={0.25} />
        )}
      </div>
    </>
  )
}

export function Grids() {
  const f = useCurrentFrame()
  const exit = prog(f, GT.exit, GT.exit + 16, easeInOut)
  if (exit >= 1) return null
  return (
    <>
      <div style={{ position: "absolute", inset: 0, opacity: 1 - exit, transform: `translateX(${-90 * exit}px)` }}>
        <Card x={G.lx} naive f={f} />
      </div>
      {/* Bandsheet's card: its chrome steps back; its dots hand over to the cells on the first frame of the exit */}
      <div style={{ position: "absolute", inset: 0, opacity: 1 - prog(f, GT.exit, GT.exit + 10) }}>
        <Card x={G.rx} naive={false} f={f} dots={f < GT.exit} />
      </div>
    </>
  )
}
