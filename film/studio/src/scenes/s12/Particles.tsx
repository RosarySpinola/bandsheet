import { interpolate, interpolateColors } from "remotion"
import { C, easeInOut } from "../../tokens"
import { B, STACK, rand } from "./data"
import { camera, toScreen } from "./camera"
import { cl, ez } from "./rows"
import { noor } from "./Dots"
import { ENV, envelopePoints } from "./envelope"
import { figY } from "./Equation"
import type { Glyphs } from "./textPoints"

const BURST_N = 150

const bez = (a: number, b: number, c: number, d: number, u: number) => {
  const v = 1 - u
  return v * v * v * a + 3 * v * v * u * b + 3 * v * u * u * c + u * u * u * d
}

/**
 * The exposed dot's particles assemble €70,000 (world, dots layer). They drop through the empty
 * 10th slot of release #1 and swing round the right of the equation, so they never cross text.
 */
export function Burst({ t, g }: { t: number; g: Glyphs }) {
  if (t < B.burst || t > B.figure + 50 || g.pts.length === 0) return null
  const src = noor(B.burst)
  return (
    <svg width={1920} height={1080} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
      {Array.from({ length: BURST_N }, (_, i) => {
        const p = g.pts[(i * 7) % g.pts.length]
        const tx = 960 + p.x
        const ty = STACK.figY + p.y
        const st = B.burst + rand(i * 5.1) * 14
        const u = interpolate(t, [st, st + 26], [0, 1], ez)
        if (u <= 0) return null
        const j = rand(i * 9.7)
        const x = bez(src.x + (j - 0.5) * 10, src.x + 18 + j * 30, 1352 + j * 46, tx, u)
        const y = bez(src.y + (rand(i * 3.3) - 0.5) * 10, src.y + 150, STACK.figY - 20 + j * 40, ty, u)
        const o = interpolate(u, [0, 0.12, 0.8, 1], [0, 1, 1, 0], cl)
        const s = 3 + j * 2
        return <rect key={i} x={x - s / 2} y={y - s / 2} width={s} height={s} fill={C.alarm} opacity={o} />
      })}
    </svg>
  )
}

/**
 * T2 (screen space): the €70,000 glyphs break into ~400 particles that spiral into the envelope
 * outline, red to ink as they settle; the crisp outline takes over on the last frames.
 */
export function T2({ t, g }: { t: number; g: Glyphs }) {
  if (t < B.t2 || g.pts.length === 0) return null
  const cam = camera(t)
  const ends = envelopePoints(g.pts.length)
  const fy = figY(t)
  const starts = g.pts.map((p) => toScreen(cam, 960 + p.x, fy + p.y))
  // Pair by angle around the envelope centre so the swirl is coherent.
  const ang = (p: { x: number; y: number }) => Math.atan2(p.y - ENV.cy, p.x - ENV.cx)
  const si = starts.map((_, i) => i).sort((a, b) => ang(starts[a]) - ang(starts[b]))
  const ei = ends.map((_, i) => i).sort((a, b) => ang(ends[a]) - ang(ends[b]))
  const outline = interpolate(t, [B.t2 + 15, B.t2 + 21], [0, 1], cl)
  return (
    <svg width={1920} height={1080} style={{ position: "absolute", left: 0, top: 0 }}>
      {si.map((sIdx, k) => {
        const S = starts[sIdx]
        const E = ends[ei[k]]
        const d = rand(sIdx * 4.7) * 6
        const u = interpolate(t, [B.t2 + d, B.t2 + d + 16], [0, 1], { ...cl, easing: easeInOut })
        const ax = S.x - ENV.cx
        const ay = S.y - ENV.cy
        const bx = E.x - ENV.cx
        const by = E.y - ENV.cy
        const grow = 1 + 0.28 * Math.sin(Math.PI * u)
        const lx = (ax + (bx - ax) * u) * grow
        const ly = (ay + (by - ay) * u) * grow
        const psi = 1.5 * Math.sin(Math.PI * u)
        const x = ENV.cx + lx * Math.cos(psi) - ly * Math.sin(psi)
        const y = ENV.cy + lx * Math.sin(psi) + ly * Math.cos(psi)
        const s = 4.6 - u * 2
        const fill = interpolateColors(u, [0, 0.35, 1], [C.alarm, C.alarm, C.ink])
        const o = 1 - outline
        return <rect key={sIdx} x={x - s / 2} y={y - s / 2} width={s} height={s} fill={fill} opacity={o} />
      })}
      <g opacity={outline} fill="none" stroke={C.ink} strokeWidth={ENV.stroke} strokeLinejoin="miter">
        <rect x={ENV.cx - ENV.w / 2} y={ENV.cy - ENV.h / 2} width={ENV.w} height={ENV.h} />
        <polyline points={ENV.flap.map((p) => `${p.x},${p.y}`).join(" ")} />
      </g>
    </svg>
  )
}
