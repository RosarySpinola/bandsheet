import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion"
import { C, sans, SAFE, ease } from "../tokens"
import { CUES } from "../timeline"
import { textFrame } from "./words"

/** Spoken words that read better as numerals on screen (the voice still says the words). */
const DISPLAY: [RegExp, string][] = [
  [/seventy thousand euros/g, "€70,000"],
  [/ninety-five/g, "95"],
  [/a hundred generated attacks/g, "100 generated attacks"],
  [/In release three/g, "In Release #3"],
  [/turned a four into a six/g, "turned a 4 into a 6"],
  [/Two of three seats/g, "2 of 3 seats"],
  [/nearly three cells in four/g, "nearly 3 cells in 4"],
  [/nineteen claims/g, "19 claims"],
]
const show = (t: string) => DISPLAY.reduce((acc, [re, to]) => acc.replace(re, to), t)

const MAX = 96
/** Split at the comma nearest the middle until every piece fits. */
function split(s: string): string[] {
  if (s.length <= MAX) return [s]
  const commas = [...s.matchAll(/, /g)].map((m) => m.index!)
  const mid = s.length / 2
  const cut = commas.sort((a, b) => Math.abs(a - mid) - Math.abs(b - mid))[0]
  return cut === undefined ? [s] : [...split(s.slice(0, cut + 1)), ...split(s.slice(cut + 2))]
}
/** Sentences, each split further when long. */
const chunks = (text: string) => text.split(/(?<=[.!?:])\s+(?=[A-Z])/).flatMap(split)

type Line = { from: number; to: number; text: string }
/** Caption lines timed to the words: each line starts when its first words are spoken. */
export const LINES: Line[] = (() => {
  const lines: Line[] = []
  let cursor = 0
  for (const cue of CUES) {
    const parts = chunks(cue.text)
    const starts = parts.map((p, k) => {
      if (k === 0) return cue.from
      const { frame, at } = textFrame(p, cursor)
      cursor = at
      return frame - 3
    })
    parts.forEach((p, k) => lines.push({ from: starts[k], to: k + 1 < parts.length ? starts[k + 1] : cue.to, text: show(p) }))
  }
  for (let k = 0; k + 1 < lines.length; k++) lines[k].to = Math.min(lines[k].to, lines[k + 1].from)
  return lines
})()

/** Burned-in captions: bottom-centre, one or two lines, fades 6f, never under moving objects (safe band). */
export function Captions() {
  const f = useCurrentFrame()
  const line = LINES.find((c) => f >= c.from && f < c.to)
  if (!line) return null
  const o = Math.min(
    interpolate(f, [line.from, line.from + 6], [0, 1], { extrapolateRight: "clamp", easing: ease }),
    interpolate(f, [line.to - 6, line.to], [1, 0], { extrapolateLeft: "clamp", easing: ease }),
  )
  return (
    <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: SAFE }}>
      <div
        style={{
          opacity: o,
          maxWidth: 1240,
          padding: "14px 26px",
          background: "rgba(255,255,255,0.92)",
          fontFamily: sans,
          fontSize: 34,
          lineHeight: 1.32,
          color: C.text,
          textAlign: "center",
          letterSpacing: "-0.005em",
        }}
      >
        {line.text}
      </div>
    </AbsoluteFill>
  )
}
