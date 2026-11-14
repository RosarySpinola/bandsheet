import type { CSSProperties } from "react"
import { interpolate, interpolateColors } from "remotion"
import { C, ease } from "../../tokens"

/** Colour-age ramp (Pine Labs motion language, Bandsheet palette): lavender → deep green → ink. */
export function ageColour(age: number, to: string = C.ink) {
  return interpolateColors(age, [0, 6, 18], [C.lav300, C.green, to])
}

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const

/**
 * Per-glyph type-on. Hidden glyphs keep their layout box, so wrapping never shifts.
 * Words are inline-block groups so lines break only between words.
 */
export function TypeOn({
  text,
  frame,
  start,
  rate = 1,
  to = C.ink,
  blur = 0,
  rise = 0,
  style,
}: {
  text: string
  frame: number
  start: number
  rate?: number // frames per glyph
  to?: string
  blur?: number
  rise?: number
  style?: CSSProperties
}) {
  let gi = 0
  const words = text.split(" ")
  return (
    <span style={style}>
      {words.map((w, wi) => {
        const glyphs = [...w].map((ch) => {
          const age = frame - (start + gi * rate)
          gi++
          const o = interpolate(age, [0, 2.5], [0, 1], clamp)
          const b = blur ? interpolate(age, [0, 12], [blur, 0], { ...clamp, easing: ease }) : 0
          const y = rise ? interpolate(age, [0, 14], [rise, 0], { ...clamp, easing: ease }) : 0
          return (
            <span
              key={gi}
              style={{
                opacity: o,
                color: ageColour(age, to),
                filter: b > 0.05 ? `blur(${b}px)` : undefined,
                display: "inline-block",
                transform: y ? `translateY(${y}px)` : undefined,
              }}
            >
              {ch}
            </span>
          )
        })
        gi++ // the space counts as a beat
        return (
          <span key={wi} style={{ display: "inline-block", whiteSpace: "nowrap" }}>
            {glyphs}
            {wi < words.length - 1 ? " " : null}
          </span>
        )
      })}
    </span>
  )
}

/** Streams an answer word by word (as a model reply arrives); each word ages lavender → ink. */
export function WordStream({
  words,
  frame,
  start,
  rate = 2,
}: {
  words: { t: string; mark?: "hl" | "ul" | "strong" }[]
  frame: number
  start: number
  rate?: number
}) {
  return (
    <>
      {words.map((w, i) => {
        const age = frame - (start + i * rate)
        const joined = !!w.mark && w.mark !== "strong" && words[i + 1]?.mark === w.mark
        const o = interpolate(age, [0, 5], [0, 1], clamp)
        const y = interpolate(age, [0, 10], [8, 0], { ...clamp, easing: ease })
        const markP = interpolate(age, [8, 26], [0, 1], { ...clamp, easing: ease })
        const deco: CSSProperties =
          w.mark === "hl"
            ? { backgroundImage: `linear-gradient(${C.lav}, ${C.lav})`, backgroundSize: `${markP * 100}% 100%`, backgroundRepeat: "no-repeat" }
            : w.mark === "ul"
              ? {
                  backgroundImage: `linear-gradient(${C.green}, ${C.green})`,
                  backgroundSize: `${markP * 100}% 2px`,
                  backgroundPosition: "0 92%",
                  backgroundRepeat: "no-repeat",
                }
              : {}
        return (
          <span
            key={i}
            style={{
              display: "inline-block",
              opacity: o,
              transform: `translateY(${y}px)`,
              color: ageColour(age),
              marginRight: joined ? 0 : "0.26em",
              ...deco,
            }}
          >
            {joined ? `${w.t}\u00a0` : w.t}
          </span>
        )
      })}
    </>
  )
}
