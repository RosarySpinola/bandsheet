import { interpolate } from "remotion"
import { C, ease, easeInOut, W, H } from "../../tokens"
import { FAN_TOTAL, T7_LEN } from "./beats"

/**
 * The hero shard fan (geometry from web/src/components/landing/shard-field.tsx, scaled 4/3 to 1920 wide).
 * One pose function spans T7 (end of S7) and the S8 sweep, so the cut is frame-continuous.
 */
const K = 4 / 3
export const HERO_V = { x: 1773, y: 22 }
const GREENS = new Set([2, 4, 6, 7])

/** Screen rects the fan must never reach (S8 lockup block, caption band), inflated by blur + sway. */
const KEEP_OUT = [
  { x0: 120, y0: 250, x1: 1250, y1: 820 },
  { x0: 360, y0: 870, x1: 1560, y1: 1040 }, // caption band (N12 is one line)
]

type Shard = { a0: number; a1: number; len: number; fill: string; dur: number; sway: number }

function polar(v: { x: number; y: number }, deg: number, r: number) {
  const a = (deg * Math.PI) / 180
  return { x: v.x + Math.cos(a) * r, y: v.y + Math.sin(a) * r }
}
function distToRect(p: { x: number; y: number }, r: (typeof KEEP_OUT)[number]) {
  const dx = Math.max(r.x0 - p.x, 0, p.x - r.x1)
  const dy = Math.max(r.y0 - p.y, 0, p.y - r.y1)
  return Math.hypot(dx, dy)
}

type Rect = (typeof KEEP_OUT)[number]

/** Longest length ≤ full whose wedge edges and blurred cap stay clear of `rects` from vertex v. */
function clampLen(v: { x: number; y: number }, a0: number, a1: number, full: number, rects: Rect[], floor = 120) {
  for (let len = full; len > floor; len -= 10) {
    const p0 = polar(v, a0, len)
    const p1 = polar(v, a1, len)
    const mid = polar(v, (a0 + a1) / 2, len)
    const capR = Math.hypot(p1.x - p0.x, p1.y - p0.y) * 0.58
    const sway = len * 0.045
    let ok = rects.every((r) => distToRect(mid, r) > capR + 100 + sway)
    for (let t = 0.1; ok && t <= 1; t += 0.1) {
      ok = rects.every((r) => distToRect(polar(v, a0, len * t), r) > 40 + sway && distToRect(polar(v, a1, len * t), r) > 40 + sway)
    }
    if (ok) return len
  }
  return floor
}

/** The caption band: captions run across the S7→S8 cut, so every frame of the fan stays above it. */
const CAPTION = [{ x0: 360, y0: 870, x1: 1560, y1: 1040 }]

export const SHARDS: Shard[] = (() => {
  const out: Shard[] = []
  const n = 9
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1)
    const a0 = 96 + 104 * t - 4
    const width = 7.5 + ((i * 37) % 5) * 1.3
    const steep = Math.max(0, Math.min(1, (150 - a0) / 50))
    const full = (600 + steep * 360 + ((i * 53) % 4) * 40) * K
    out.push({ a0, a1: a0 + width, len: clampLen(HERO_V, a0, a0 + width, full, KEEP_OUT), fill: GREENS.has(i) ? C.green : C.lav, dur: 8 + ((i * 29) % 6), sway: 1.2 + ((i * 17) % 4) * 0.4 })
  }
  return out
})()

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const
const SPLIT = T7_LEN / FAN_TOTAL

/**
 * u ∈ [0,1]: 0 = S7 t7 (fan folded at the signature tip), SPLIT = the S7→S8 cut, 1 = hero pose.
 * `start` = the signature tip on screen; `swayK` scales ambient sway (0 at the thumbnail hold); `t` = seconds for sway.
 */
export function ShardFan({ u, start, swayK = 0, t = 0 }: { u: number; start: { x: number; y: number }; swayK?: number; t?: number }) {
  const travel = interpolate(u, [SPLIT * 0.4, 1], [0, 1], { ...clamp, easing: easeInOut })
  const v = { x: start.x + (HERO_V.x - start.x) * travel, y: start.y + (HERO_V.y - start.y) * travel }
  const spread = interpolate(u, [0, SPLIT, 1], [0, 0.72, 1], { ...clamp, easing: ease })
  const grow = interpolate(u, [0, SPLIT, 1], [0, 0.26, 1], { ...clamp, easing: ease })
  const caps = interpolate(u, [SPLIT * 0.5, 0.85], [0, 1], clamp)
  const midA = 148
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", inset: 0 }}>
      <defs>
        <filter id="s78-cap" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation={6 + 34 * grow} />
        </filter>
        <filter id="s78-soft" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation={1.4} />
        </filter>
      </defs>
      {SHARDS.map((s, i) => {
        const appear = interpolate(u, [i * 0.018, i * 0.018 + 0.12], [0, 1], { ...clamp, easing: ease })
        const sw = Math.sin((t / s.dur) * Math.PI * 2 + i) * s.sway * swayK
        const a0 = midA + (s.a0 - midA) * spread + sw
        const a1 = midA + (s.a1 - midA) * spread + sw
        const len = Math.min(s.len * grow * appear, clampLen(v, a0, a1, s.len, CAPTION, 0))
        if (len < 1) return null
        const p0 = polar(v, a0, len)
        const p1 = polar(v, a1, len)
        const mid = polar(v, (a0 + a1) / 2, len)
        const capR = Math.hypot(p1.x - p0.x, p1.y - p0.y) * 0.58
        return (
          <g key={i} opacity={(s.fill === C.green ? 0.95 : 0.9) * appear}>
            <path d={`M${v.x} ${v.y} L${p0.x} ${p0.y} L${p1.x} ${p1.y} Z`} fill={s.fill} filter="url(#s78-soft)" />
            <circle cx={mid.x} cy={mid.y} r={capR} fill={s.fill} filter="url(#s78-cap)" opacity={caps} />
          </g>
        )
      })}
    </svg>
  )
}
