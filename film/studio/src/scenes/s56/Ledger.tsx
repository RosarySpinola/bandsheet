import { interpolateColors, useCurrentFrame } from "remotion"
import { C, sans, serif, ease, easeInOut } from "../../tokens"
import { BANDS, eur } from "./data"
import { B5 } from "./beats"
import { serifItalic } from "./fonts"
import { cl, prog, Type } from "./type"

/** Ledger geometry, relative to the ledger's top (world y = top + value). */
export const L = { x0: 120, x1: 1180, nX: 440, barX: 520, barMax: 460, head: 262, rule: 284, row0: 290, pitch: 72, foot: 690 }
export const rowY = (i: number) => L.row0 + i * L.pitch
export const laneY = (i: number) => rowY(i) + 36
export const barW = (mean: number) => (mean / 115000) * L.barMax
export const SENIOR_STOP = 236
/** The crystal's post beside the ledger (ledger-relative), where its beams leave from. */
export const CRY = { x: 1460, y: 470, r: 100 }
/**
 * Local frames, each on its word (beats.ts): the skeleton lands on "table", the scan runs over "solves the
 * attacker's equations", the beams become bars on "publishes four bands", Senior's beam is taken back on "withholds".
 */
export const T = { land: B5.table - 8, scan0: B5.solves, scan1: B5.equations + 12, bars: B5.publishes, senior: B5.withholds }
/** Beam start for row i (Senior has its own beat). */
export const beamAt = (i: number) => (i === 2 ? T.senior : T.bars + (i > 2 ? i - 1 : i) * 5)

function Lock({ size, color }: { size: number; color: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" style={{ display: "block" }}>
      <path d="M6 9V6.5a4 4 0 0 1 8 0V9" fill="none" stroke={color} strokeWidth={2} />
      <rect x={3.5} y={9} width={13} height={9} fill={color} />
    </svg>
  )
}

export function Ledger({ top }: { top: number }) {
  const f = useCurrentFrame()
  const ruleW = prog(f, T.land - 4, T.land + 18) * (L.x1 - L.x0)
  // "solves the attacker's equations": a scan runs down the five cells from the crystal's side
  const scan = 5 * prog(f, T.scan0, T.scan1, easeInOut)
  const scanOn = prog(f, T.scan0 - 2, T.scan0 + 4) * (1 - prog(f, T.scan1 - 2, T.scan1 + 6))
  return (
    <div style={{ position: "absolute", left: 0, top, width: 1920, height: 1080 }}>
      <div style={{ position: "absolute", left: L.x0, top: L.head - 12, width: L.x1 - L.x0, display: "flex", fontFamily: sans, fontSize: 15, fontWeight: 600, letterSpacing: "0.08em", color: C.gray350, opacity: prog(f, T.land, T.land + 12) }}>
        <span style={{ width: L.nX - L.x0 }}>GRADE</span>
        <span>MEMBERS</span>
        <span style={{ marginLeft: "auto" }}>MEAN, EUR</span>
      </div>
      <div style={{ position: "absolute", left: L.x0, top: L.rule, width: ruleW, height: 2, background: C.ink }} />
      <div style={{ position: "absolute", left: L.x0, top: L.row0 + scan * L.pitch - 1, width: L.x1 - L.x0, height: 3, background: C.lav300, opacity: scanOn }} />
      {BANDS.map((b, i) => {
        const y = rowY(i)
        const s = beamAt(i)
        const senior = b.mean === null
        const g = prog(f, s + 12, s + 26, ease)
        const out = senior ? prog(f, s + 12, s + 22) : 0
        const lockOn = senior ? prog(f, s + 16, s + 26) : 0
        const sepW = prog(f, T.land + 4 + i * 3, T.land + 24 + i * 3) * (L.x1 - L.x0)
        const wash = Math.exp(-Math.abs(scan - (i + 0.5)) * 2.4) * scanOn + (senior && scan > i + 0.5 ? 0.3 * (1 - lockOn) : 0)
        return (
          <div key={b.grade}>
            <div style={{ position: "absolute", left: L.x0, top: y, width: L.x1 - L.x0, height: L.pitch, background: C.lav, opacity: 0.55 * Math.min(1, wash) }} />
            {senior ? <div style={{ position: "absolute", left: L.x0, top: y, width: L.x1 - L.x0, height: L.pitch, background: C.lav100, opacity: lockOn }} /> : null}
            <div style={{ position: "absolute", left: L.x0, top: y + L.pitch - 1, width: sepW, height: 1, background: C.line }} />
            <div style={{ position: "absolute", left: L.x0, top: y + 20 }}>
              <Type text={b.grade} start={T.land + 2 + i * 3} size={26} family={sans} weight={400} cps={0.6} />
            </div>
            {b.n ? (
              <div style={{ position: "absolute", left: L.nX, top: y + 20 }}>
                <Type text={String(b.n)} start={T.land + 10 + i * 3} size={26} family={sans} weight={400} color={C.gray350} />
              </div>
            ) : null}
            {senior ? (
              <>
                {/* the bar that isn't: a dashed outline, then the lock */}
                <div style={{ position: "absolute", left: L.barX, top: y + 26, width: SENIOR_STOP * out, height: 20, boxSizing: "border-box", background: "rgba(205,194,255,0.25)", border: `2px dashed ${C.lav300}`, opacity: out > 0 ? 1 : 0 }} />
                <div style={{ position: "absolute", left: L.barX + SENIOR_STOP + 12, top: y + 25, opacity: lockOn, transform: `scale(${0.6 + 0.4 * lockOn})` }}>
                  <Lock size={22} color={C.lav300} />
                </div>
                <div style={{ position: "absolute", right: 1920 - L.x1, top: y + 14 }}>
                  {f >= s + 28 ? <Type text="Withheld" start={s + 28} size={34} family={serifItalic} weight={400} color={C.lav300} from={C.lav} italic /> : null}
                  <sup style={{ fontFamily: sans, fontSize: 18, color: C.lav300, marginLeft: 4, opacity: prog(f, s + 36, s + 42) }}>1</sup>
                </div>
              </>
            ) : (
              <>
                <div style={{ position: "absolute", left: L.barX, top: y + 26, width: g * barW(b.mean!), height: 20, background: interpolateColors(cl((f - s - 24) / 16), [0, 1], [C.lav300, C.ink]) }} />
                <div style={{ position: "absolute", right: 1920 - L.x1, top: y + 14 }}>
                  {f >= s + 22 ? <Type text={eur(b.mean!)} start={s + 22} size={34} family={serif} cps={1} /> : null}
                </div>
              </>
            )}
          </div>
        )
      })}
    </div>
  )
}
