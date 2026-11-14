import { interpolate, useCurrentFrame } from "remotion"
import { C, easeInOut } from "../../tokens"
import { sceneById } from "../../timeline"
import { CrystalCanvas } from "../s34/Crystal"
import { BANDS } from "./data"
import { B5 } from "./beats"
import { CH } from "./Chain"
import { FR, FR_FOCUS } from "./F3Frame"
import { beamAt, CRY, L, laneY } from "./Ledger"
import { mix, prog } from "./type"

const S5_FROM = sceneById("S5").from
const CLAMP = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const
/** S4's T4 end pose (screen = world in S5's opening frame): x 960, y 250, r 112, orbit 20°. */
const HOME = { x: 960, y: 250, r: 112 }
const ORBIT = (20 * Math.PI) / 180

/** Lifted pose over the vote, clear of the kicker and heading (reached by f14). */
const LIFT = { y: 186, r: 90 }
/** The crane from the vote plane down to the ledger, on "replays every earlier table". */
export const CRANE: [number, number] = [B5.replays - 4, B5.replays + 40]
/** Earlier releases replayed into the crystal: each lands on its word ("every", "earlier"). */
export const GHOST_AT = [B5.every, B5.earlier]
export const GHOST_LEN = 12

/**
 * Crystal world pose: from S4's end pose it lifts clear of the vote's type; on "the contract calls the
 * enclave" it glides right and drops into the chain as its enclave node; the crane carries it to its ledger post.
 */
export function crystalPose(f: number, dy: number) {
  const lift = prog(f, 0, 14, easeInOut)
  const e = { ...CLAMP, easing: easeInOut }
  let x = interpolate(f, [B5.contract - 2, B5.calls + 2], [HOME.x, CH.cry.x], e)
  let y = interpolate(f, [B5.calls - 2, B5.enclave + 2], [mix(HOME.y, LIFT.y, lift), CH.cry.y], e)
  let r = f < B5.calls - 2 ? mix(HOME.r, LIFT.r, lift) : interpolate(f, [B5.calls - 2, B5.enclave + 2], [LIFT.r, CH.cry.r], e)
  const c = prog(f, CRANE[0], CRANE[1], easeInOut)
  x = mix(x, CRY.x, c)
  y = mix(y, dy + CRY.y, c)
  r = mix(r, CRY.r, c)
  // "writes why to NEAR": it travels with the camera and settles beside its record (left of the F3 frame)
  const t = prog(f, B5.writes - 8, B5.writes + 26, easeInOut)
  return { x: mix(x, FR.x - 250, t), y: mix(y, dy + FR_FOCUS.y - 40, t), r: mix(r, 88, t) }
}

/** Lavender flashes: the vote passing, the call arriving, each replayed table, three "solving" pulses, each beam leaving. */
function pulse(f: number) {
  const hit = (a: number, k = 7) => (f >= a ? Math.exp(-(f - a) / k) : 0)
  const keys = [B5.approve2 + 10, B5.enclave + 2, ...GHOST_AT.map((g) => g + GHOST_LEN), B5.solves, B5.attackers, B5.equations, ...BANDS.map((_, i) => beamAt(i))]
  return Math.min(1, keys.reduce((m, a) => Math.max(m, hit(a)), 0))
}

/** The sealed engine, carried over from S4 (one canvas that rides with the crystal through the world). */
export function Engine({ dy }: { dy: number }) {
  const f = useCurrentFrame()
  const p = crystalPose(f, dy)
  return (
    <div style={{ position: "absolute", left: 0, top: p.y - 540, width: 1920, height: 1080 }}>
      <CrystalCanvas absFrame={S5_FROM + f} x={p.x} y={540} r={p.r} orbit={ORBIT} pulse={pulse(f)} />
    </div>
  )
}

/**
 * The crystal's light becomes the bars: one beam per band from the crystal's face along its lane to the
 * bar origin, then it collapses into the growing bar. Senior's beam reaches the lane and is taken back.
 */
export function Beams({ top }: { top: number }) {
  const f = useCurrentFrame()
  const sx = CRY.x - CRY.r * 0.7
  const sy = top + CRY.y
  const elbow = 1240
  return (
    <svg width={1920} height={2200} style={{ position: "absolute", left: 0, top: 0, overflow: "visible", pointerEvents: "none" }}>
      {BANDS.map((b, i) => {
        const s = beamAt(i)
        if (f < s || f > s + 34) return null
        const ly = top + laneY(i)
        const seg1 = Math.hypot(sx - elbow, sy - ly)
        const total = seg1 + (elbow - L.barX)
        const senior = b.mean === null
        const head = total * prog(f, s, s + 14, easeInOut)
        // normal: the tail chases the head into the bar origin; Senior: the beam is pulled back to the crystal
        const tail = senior ? 0 : total * prog(f, s + 8, s + 24, easeInOut)
        const back = senior ? total * prog(f, s + 14, s + 30, easeInOut) : 0
        const end = head - back
        const vis = Math.max(0, end - tail)
        if (vis < 1) return null
        const pts = `${sx},${sy} ${elbow},${ly} ${L.barX},${ly}`
        return (
          <g key={b.grade}>
            <polyline points={pts} fill="none" stroke={C.lav} strokeWidth={10} strokeOpacity={0.45} strokeDasharray={`${vis} ${total + 10}`} strokeDashoffset={-tail} strokeLinecap="round" strokeLinejoin="round" />
            <polyline points={pts} fill="none" stroke={C.lav300} strokeWidth={3} strokeDasharray={`${vis} ${total + 10}`} strokeDashoffset={-tail} strokeLinejoin="round" />
          </g>
        )
      })}
    </svg>
  )
}
