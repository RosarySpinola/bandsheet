import type { CSSProperties } from "react"
import { interpolate, interpolateColors, useCurrentFrame } from "remotion"
import { C, easeOutQuint } from "../../tokens"

export const cl = (v: number) => Math.min(1, Math.max(0, v))

/** Eased 0→1 over [a, b]. */
export const prog = (f: number, a: number, b: number, easing = easeOutQuint) =>
  interpolate(f, [a, b], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing })

export const mix = (a: number, b: number, t: number) => a + (b - a) * t

/**
 * Per-glyph type-on (Pine Labs motion language, Bandsheet colours): each glyph fades in over 3 f,
 * slides in from +0.12em and ages lavender → its final colour over `ramp` frames.
 */
export function Type({
  text, start, size, family, cps = 0.8, color = C.ink, from = C.lav300, ramp = 14,
  weight = 500, style, italic, tracking = -0.01,
}: {
  text: string; start: number; size: number; family: string; cps?: number; color?: string; from?: string
  ramp?: number; weight?: number; style?: CSSProperties; italic?: boolean; tracking?: number
}) {
  const f = useCurrentFrame()
  return (
    <span
      style={{
        fontFamily: family, fontSize: size, fontWeight: weight, whiteSpace: "pre", lineHeight: 1.15,
        letterSpacing: `${tracking}em`, fontStyle: italic ? "italic" : "normal", ...style,
      }}
    >
      {Array.from(text).map((ch, i) => {
        const age = f - (start + i * cps)
        const dx = 0.12 * size * (1 - easeOutQuint(cl(age / 8)))
        const col = interpolateColors(cl(age / ramp), [0, 1], [from, color])
        return (
          <span key={i} style={{ display: "inline-block", opacity: cl(age / 3), color: col, transform: `translateX(${dx}px)` }}>
            {ch}
          </span>
        )
      })}
    </span>
  )
}

/** Camera: world point (fx, fy) lands at frame centre at scale s. */
export function cam(fx: number, fy: number, s: number) {
  return `translate(${960 - fx}px, ${540 - fy}px) scale(${s})`
}
export const camOrigin = (fx: number, fy: number) => `${fx}px ${fy}px`
