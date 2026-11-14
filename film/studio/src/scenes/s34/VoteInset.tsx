import { Easing, interpolate, OffthreadVideo, staticFile } from "remotion"
import { C, sans, serif } from "../../tokens"
import { HAS_F2, outQuint } from "./beats"
import { mono } from "./fonts"
import { PassMark } from "./VerifiedChecks"

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const
export const INSET = { w: 600, h: 352, right: 64, top: 320 }

/** Seat tile used by the inset (and matched by the T4 end pose). */
export function Seat({ n, on, idle, w, h, big = false }: { n: number; on: number; idle?: boolean; w: number; h: number; big?: boolean }) {
  return (
    <div style={{ width: w, height: h, boxSizing: "border-box", border: `2px solid ${C.ink}`, background: C.paper, display: "flex", alignItems: "center", justifyContent: "space-between", padding: big ? "0 26px" : "0 14px", fontFamily: sans }}>
      <span style={{ fontSize: big ? 26 : 18, fontWeight: 600, color: C.ink }}>Seat {n}</span>
      {idle ? <span style={{ fontSize: big ? 26 : 20, color: C.gray350 }}>–</span> : <PassMark on={on} size={big ? 34 : 24} />}
    </div>
  )
}

/** Where the inset's "d=… · s=…" key line sits on screen (the chip lifts out from here). */
export const KEYLINE = { x: 1920 - INSET.right - INSET.w + 30, y: INSET.top + 156 }
export const KEYLINE_TEXT = "d=harbourcourier.example · s=payroll2026"

/** "Chapel vote" inset: Sputnik DAO proposal #2, seats 1 and 2 approve, seat 3 idle. F2 footage when present. */
export function VoteInset({ f, inAt, outAt, seats, lift = Infinity }: { f: number; inAt: [number, number]; outAt: [number, number]; seats: [number, number]; lift?: number }) {
  const tin = interpolate(f, inAt, [0, 1], { ...clamp, easing: outQuint })
  const tout = interpolate(f, outAt, [0, 1], { ...clamp, easing: outQuint })
  if (tin <= 0 || tout >= 1) return null
  const s1 = interpolate(f, [seats[0], seats[0] + 8], [0, 1], clamp)
  const s2 = interpolate(f, [seats[1], seats[1] + 8], [0, 1], clamp)
  const x = (1 - tin) * 120 + tout * 50
  return (
    <div style={{ position: "absolute", right: INSET.right, top: INSET.top, width: INSET.w, height: INSET.h, opacity: tin * (1 - tout), transform: `translateX(${x}px)`, background: C.paper, border: `2px solid ${C.ink}`, boxSizing: "border-box", overflow: "hidden" }}>
      {HAS_F2 ? (
        <OffthreadVideo src={staticFile("footage/F2.mp4")} muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      ) : (
        <div style={{ padding: "26px 30px", display: "flex", flexDirection: "column", gap: 14, fontFamily: sans }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <span style={{ fontSize: 15, letterSpacing: "0.06em", textTransform: "uppercase", color: C.gray350 }}>Chapel vote</span>
            <span style={{ fontFamily: mono, fontSize: 15, color: C.gray350 }}>Sputnik DAO · proposal #2</span>
          </div>
          <div style={{ fontFamily: serif, fontWeight: 500, fontSize: 36, lineHeight: 1.12, color: C.ink, letterSpacing: "-0.01em" }}>
            Trust Harbour Courier payroll's DKIM key
          </div>
          <div style={{ alignSelf: "flex-start", fontFamily: mono, fontSize: 15.5, color: s2 > 0.5 ? C.ink : C.gray350, background: `rgba(205,194,255,${0.75 * s2})`, padding: "2px 6px", margin: "0 -6px", opacity: f >= lift ? 0.25 : 1 }}>{KEYLINE_TEXT}</div>
          <div style={{ height: 2, background: C.ink, marginTop: 4 }} />
          <div style={{ display: "flex", gap: 12 }}>
            <Seat n={1} on={s1} w={168} h={58} />
            <Seat n={2} on={s2} w={168} h={58} />
            <Seat n={3} on={0} idle w={168} h={58} />
          </div>
          <div style={{ fontSize: 16, color: C.gray350, opacity: s2 }}>
            Approved by seats 1 and 2 · tx <span style={{ fontFamily: mono, color: C.ink }}>4G8BgLru…</span>
          </div>
        </div>
      )}
    </div>
  )
}

/** The trusted key (d=/s=) lifting out of the inset and into the crystal on "checks every signature". */
export function KeyChip({ f, at, to }: { f: number; at: [number, number]; to: { x: number; y: number } }) {
  const t = interpolate(f, at, [0, 1], { ...clamp, easing: Easing.bezier(0.55, 0, 0.45, 1) })
  if (f < at[0] || t >= 1) return null
  const x0 = KEYLINE.x
  const y0 = KEYLINE.y
  const cx = (x0 + to.x) / 2
  const cy = Math.max(y0, to.y) + 70 // under the inset title, straight across to the crystal
  const x = (1 - t) ** 2 * x0 + 2 * (1 - t) * t * cx + t * t * (to.x - 186)
  const y = (1 - t) ** 2 * y0 + 2 * (1 - t) * t * cy + t * t * to.y
  const s = 1 - 0.85 * t ** 1.5
  return (
    <div style={{ position: "absolute", left: x - 6, top: y - 12, transformOrigin: "186px 12px", transform: `scale(${s})`, opacity: interpolate(t, [0.8, 1], [1, 0], clamp), fontFamily: mono, fontSize: 15.5, color: C.ink, background: C.lav, padding: "2px 6px", whiteSpace: "nowrap" }}>
      {KEYLINE_TEXT}
    </div>
  )
}
