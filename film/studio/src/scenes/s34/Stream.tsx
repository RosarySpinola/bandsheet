import { interpolate } from "remotion"
import { C, sans } from "../../tokens"
import { Envelope, ENV_H, ENV_W } from "./Envelope"
import { mono } from "./fonts"
import { KEY_OUT } from "./AccessKey"
import { B4, inOut, lerp, prog } from "./beats"

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const

/** Sealed entries leaving the member-key card for the crystal: start offset, arc lift, launch frame. */
const DUR = 26
export const STREAM = [
  ...[0, 1, 2, 3, 4, 5].map((i) => ({ dy: [-120, 60, -40, 130, -90, 20][i], lift: [-120, 90, -60, 140, -150, 70][i], at: B4.stream0 + i * B4.streamGap, rot: [-10, 8, -6, 9, -12, 5][i], dur: DUR })),
  // The newer payslip ("a newer payslip replaces the old one"): it lands on "replaces" and the count stays 38.
  { dy: 0, lift: -40, at: B4.event[0], rot: -4, dur: B4.replaced - B4.event[0] },
]
export const arrivals = STREAM.map((s) => s.at + s.dur)
const NEW_ARRIVALS = arrivals.slice(0, 6)

/** Each envelope arcs from the key card into the crystal, shrinks and is swallowed at its centre. */
export function Stream({ f, tx, ty }: { f: number; tx: number; ty: number }) {
  return (
    <>
      {STREAM.map((s, i) => {
        const t = interpolate(f, [s.at, s.at + s.dur], [0, 1], { ...clamp, easing: inOut })
        if (f < s.at || t >= 1) return null
        const x0 = KEY_OUT.x + 30
        const y0 = KEY_OUT.y + s.dy
        const cx = (x0 + tx) / 2
        const cy = (y0 + ty) / 2 + s.lift
        const x = (1 - t) ** 2 * x0 + 2 * (1 - t) * t * cx + t * t * tx
        const y = (1 - t) ** 2 * y0 + 2 * (1 - t) * t * cy + t * t * ty
        const sc = lerp(0.3, 0.05, t ** 1.3)
        const o = interpolate(t, [0, 0.12, 0.8, 1], [0, 1, 1, 0], clamp)
        return (
          <div key={i} style={{ position: "absolute", left: x - ENV_W / 2, top: y - ENV_H / 2, opacity: o, transform: `scale(${sc}) rotate(${s.rot * (1 - t)}deg)` }}>
            <Envelope flap={1} fill={1} stamp={1} />
          </div>
        )
      })}
    </>
  )
}

const label = { fontSize: 15, letterSpacing: "0.08em", textTransform: "uppercase" as const, color: C.gray350 }

/**
 * Top-left ledger counter. N6b: sealed entries on chain tick 32 → 38 with each arrival; the newer payslip
 * replaces an entry, so the count stays 38. N7 (Release #3): 38 sealed entries → 37 verified · 1 refused.
 */
export function Counter({ f }: { f: number }) {
  const a = prog(f, [B4.keyIn[0], B4.keyIn[0] + 14]) * (1 - prog(f, B4.keyOut))
  const b = prog(f, [B4.cardBack[0] + 4, B4.cardBack[0] + 16]) * (1 - prog(f, [B4.tiles[1] - 8, B4.tiles[1] - 1]))
  if (a <= 0 && b <= 0) return null
  if (a > 0) {
    const n = 32 + NEW_ARRIVALS.filter((t) => f >= t).length
    const rep = prog(f, [B4.replaced, B4.replaced + 10])
    return (
      <div style={{ position: "absolute", left: 64, top: 64, opacity: a, fontFamily: sans, display: "flex", flexDirection: "column", gap: 4 }}>
        <span style={label}>Sealed entries on chain</span>
        <span style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
          <span style={{ fontFamily: mono, fontSize: 32, color: C.ink, fontVariantNumeric: "tabular-nums" }}>{n}</span>
          <span style={{ fontFamily: mono, fontSize: 17, color: C.lav300, opacity: rep, transform: `translateX(${(1 - rep) * -8}px)` }}>replaced · count stays {n}</span>
        </span>
      </div>
    )
  }
  const was = 1 - prog(f, [B4.fly[1], B4.fly[1] + 6])
  const hit = prog(f, [B4.fly[1] + 2, B4.fly[1] + 10])
  return (
    <div style={{ position: "absolute", left: 64, top: 64, opacity: b, fontFamily: sans, display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={label}>Release #3</span>
      <span style={{ position: "relative", height: 40, minWidth: 520, fontFamily: mono, fontSize: 30, color: C.ink, fontVariantNumeric: "tabular-nums" }}>
        <span style={{ position: "absolute", left: 0, top: 0, opacity: was, transform: `translateY(${(was - 1) * 10}px)`, whiteSpace: "nowrap" }}>38 sealed entries</span>
        <span style={{ position: "absolute", left: 0, top: 0, opacity: hit, transform: `translateY(${(1 - hit) * 8}px)`, whiteSpace: "nowrap" }}>
          37 verified · <span style={{ boxShadow: `inset 0 -3px 0 ${C.ink}` }}>1 refused</span>
        </span>
      </span>
    </div>
  )
}
