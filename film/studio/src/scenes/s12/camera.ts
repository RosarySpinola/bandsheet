import type { CSSProperties } from "react"
import { interpolate } from "remotion"
import { ease, H, W } from "../../tokens"
import { B } from "./data"
import { sceneById } from "../../timeline"

export type Cam = { s: number; fx: number; fy: number; rot: number }

const hermite = (p0: number, p1: number, m0: number, m1: number, u: number) => {
  const u2 = u * u
  const u3 = u2 * u
  return (2 * u3 - 3 * u2 + 1) * p0 + (u3 - 2 * u2 + u) * m0 + (-2 * u3 + 3 * u2) * p1 + (u3 - u2) * m1
}

const S1_RATE = 0.08 / sceneById("S1").dur // 1.0 -> 1.08 across S1, never stalls
const PUSH = 90 // frames of the S2 push after T1
const F0 = { x: 960, y: 478 }
const F1 = { x: 960, y: 614 }
const BACK = 34 // pull-back on "Nobody hacked anything"
/** Return framing: both parted tables and the subtraction between them, clear of the caption band. */
const RET_CAM = { s: 0.86, fx: 960, fy: 517, rot: 0 }
const RET_DRIFT = 0.0004 // scale per frame after the pull-back settles

/** One continuous camera over absolute frame t. Slow push in S1, Hermite push into the Senior pair in S2, pull back for the return. */
export function camera(t: number): Cam {
  if (t <= B.back) return pushed(t)
  const c0 = pushed(B.back)
  const d0 = t - B.back
  if (d0 <= BACK) {
    const u = d0 / BACK
    return {
      s: hermite(c0.s, RET_CAM.s, 0.0005 * BACK, RET_DRIFT * BACK, u),
      fx: hermite(c0.fx, RET_CAM.fx, 0, 0, u),
      fy: hermite(c0.fy, RET_CAM.fy, 0.004 * BACK, 0, u),
      rot: hermite(c0.rot, RET_CAM.rot, -0.0015 * BACK, 0, u),
    }
  }
  return { ...RET_CAM, s: RET_CAM.s + RET_DRIFT * (d0 - BACK) }
}

function pushed(t: number): Cam {
  if (t <= B.t1) {
    const drift = interpolate(t, [0, B.t1], [0, -6])
    return { s: 1 + S1_RATE * t, fx: F0.x + drift * 0.5, fy: F0.y + drift, rot: 0 }
  }
  const s0 = 1 + S1_RATE * B.t1
  const fxs = F0.x - 3
  const fys = F0.y - 6
  if (t <= B.t1 + PUSH) {
    const u = (t - B.t1) / PUSH
    const tail = 0.0005 * PUSH
    return {
      s: hermite(s0, 1.6, S1_RATE * PUSH, tail, u),
      fx: hermite(fxs, F1.x, 0, 0, u),
      fy: hermite(fys, F1.y, 0, 0.004 * PUSH, u),
      rot: hermite(0, -0.4, 0, -0.0015 * PUSH, u),
    }
  }
  const d = t - B.t1 - PUSH
  return { s: 1.6 + 0.0005 * d, fx: F1.x, fy: F1.y + 0.004 * d, rot: -0.4 - 0.0015 * d }
}

/** Depth > 1 moves faster than the paper (closer to the lens): subtle parallax for the dots layer. */
export function layerCam(c: Cam, depth: number): Cam {
  return { ...c, s: 1 + (c.s - 1) * depth }
}

export function layerStyle(c: Cam): CSSProperties {
  return {
    position: "absolute",
    left: 0,
    top: 0,
    width: W,
    height: H,
    transformOrigin: "0 0",
    transform: `translate(${W / 2}px, ${H / 2}px) rotate(${c.rot}deg) scale(${c.s}) translate(${-c.fx}px, ${-c.fy}px)`,
  }
}

export function toScreen(c: Cam, x: number, y: number) {
  const a = (c.rot * Math.PI) / 180
  const dx = (x - c.fx) * c.s
  const dy = (y - c.fy) * c.s
  return { x: W / 2 + dx * Math.cos(a) - dy * Math.sin(a), y: H / 2 + dx * Math.sin(a) + dy * Math.cos(a) }
}

export const DOT_DEPTH = 1.04
export const e = ease
