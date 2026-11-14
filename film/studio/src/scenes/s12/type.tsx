import type { CSSProperties } from "react"
import { interpolate, interpolateColors } from "remotion"
import { C, ease } from "../../tokens"

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const

/** Per-glyph colour age: fresh glyphs are lavender, pass through deep green and settle to ink. */
export function ageColor(age: number, settled: string = C.ink) {
  return interpolateColors(Math.max(0, age), [0, 6, 16], [C.lav300, C.green, settled])
}

/**
 * Per-glyph type-on. Every glyph keeps its box from frame 0 (visibility only), so right-aligned
 * columns never reflow. A glyph pops in over 3 f, slides 0.12em left into place and ages in colour.
 */
export function TypeOn({
  text,
  t,
  start,
  rate = 1,
  color = C.ink,
  style,
  out,
}: {
  text: string
  t: number
  start: number
  rate?: number
  color?: string
  style?: CSSProperties
  /** Optional per-glyph exit: frame the whole run starts leaving (first glyph first). */
  out?: number
}) {
  const chars = [...text]
  return (
    <span style={{ whiteSpace: "pre", display: "inline-block", ...style }}>
      {chars.map((ch, i) => {
        const age = t - (start + i * rate)
        const o = interpolate(age, [0, 3], [0, 1], clamp)
        const dx = interpolate(age, [0, 7], [0.12, 0], { ...clamp, easing: ease })
        let exitO = 1
        let exitY = 0
        if (out !== undefined) {
          const a = t - (out + i * 0.6)
          exitO = interpolate(a, [0, 6], [1, 0], clamp)
          exitY = interpolate(a, [0, 8], [0, -0.25], { ...clamp, easing: ease })
        }
        return (
          <span
            key={i}
            style={{
              display: "inline-block",
              opacity: o * exitO,
              transform: `translate(${dx}em, ${exitY}em)`,
              color: ageColor(age, color),
            }}
          >
            {ch === " " ? " " : ch}
          </span>
        )
      })}
    </span>
  )
}

/** A 2px rule that draws left to right. */
export function Rule({
  x,
  y,
  w,
  t,
  start,
  dur = 16,
  color = C.ink,
  h = 2,
}: {
  x: number
  y: number
  w: number
  t: number
  start: number
  dur?: number
  color?: string
  h?: number
}) {
  const p = interpolate(t, [start, start + dur], [0, 1], { ...clamp, easing: ease })
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y - h / 2,
        width: w,
        height: h,
        background: color,
        transformOrigin: "0 50%",
        transform: `scaleX(${p})`,
      }}
    />
  )
}

export { clamp }
