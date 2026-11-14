import type { CSSProperties } from "react"
import { interpolate } from "remotion"
import { C, ease, sans } from "../../tokens"
import { S7B } from "./beats"
import { mono } from "./fonts"
import { ageColour } from "./type"
import capture from "./mcp-answer.json"

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const

/** The real explain_refusal output, verbatim (mcp-answer.json; gate: check-s78.mjs). Wrapping is the only change. */
const TEXT: string = capture.text
const WITNESS = `"${capture.structured.witness}"`
const EUR_SPAN = "an average of 9 members at EUR 62,400"

type Mark = "head" | "witness" | "eur" | undefined
type Tok = { t: string; i: number; mark: Mark; br: "none" | "line" | "para" }

/** Words with their char offset, a mark from the substring they fall in, and the break that follows them. */
function tokenise(text: string): Tok[] {
  const ranges: [number, number, Mark][] = [
    [0, text.indexOf("\n"), "head"],
    [text.indexOf(WITNESS), text.indexOf(WITNESS) + WITNESS.length, "witness"],
    [text.indexOf(EUR_SPAN), text.indexOf(EUR_SPAN) + EUR_SPAN.length, "eur"],
  ]
  const out: Tok[] = []
  const re = /\S+/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    const i = m.index
    const end = i + m[0].length
    const gap = text.slice(end, text.slice(end).search(/\S/) + end)
    const br = gap.includes("\n\n") ? "para" : gap.includes("\n") ? "line" : "none"
    const mark = ranges.find(([a, b]) => a >= 0 && i >= a && i < b)?.[2]
    out.push({ t: m[0], i, mark, br })
  }
  return out
}
const TOKS = tokenise(TEXT)
export const ANSWER_WORDS = TOKS.length

/** Verbatim tool output; words arrive top to bottom and age lavender → ink. The € span lights up on "without". */
export function Answer({ f }: { f: number }) {
  const eurOn = interpolate(f, [S7B.noSalary, S7B.noSalary + 12], [0, 1], { ...clamp, easing: ease })
  const witnessOn = (age: number) => interpolate(age, [6, 22], [0, 1], { ...clamp, easing: ease })
  return (
    <div style={{ fontFamily: sans, fontSize: 22, lineHeight: 1.42, color: C.ink }}>
      {TOKS.map((tk, k) => {
        const age = f - (S7B.answer + k * S7B.answerRate)
        const o = interpolate(age, [0, 4], [0, 1], clamp)
        const y = interpolate(age, [0, 9], [6, 0], { ...clamp, easing: ease })
        const next = TOKS[k + 1]
        const joined = !!tk.mark && tk.mark !== "head" && next?.mark === tk.mark && tk.br === "none"
        const style: CSSProperties = {
          display: "inline-block",
          opacity: o,
          transform: `translateY(${y}px)`,
          color: ageColour(age),
          marginRight: joined ? 0 : "0.28em",
        }
        if (tk.mark === "head") Object.assign(style, { fontWeight: 600, fontSize: 26 })
        if (tk.mark === "witness") {
          const p = witnessOn(age)
          Object.assign(style, {
            fontFamily: mono,
            fontSize: 20,
            fontWeight: 500,
            backgroundImage: `linear-gradient(${C.lav}, ${C.lav})`,
            backgroundSize: `${p * 100}% 100%`,
            backgroundRepeat: "no-repeat",
          })
        }
        if (tk.mark === "eur") Object.assign(style, { background: `rgba(205,194,255,${0.55 * eurOn})` })
        return (
          <span key={k}>
            <span style={style}>{joined ? `${tk.t} ` : tk.t}</span>
            {tk.br === "line" ? <br /> : null}
            {tk.br === "para" ? <span style={{ display: "block", height: 12 }} /> : null}
          </span>
        )
      })}
    </div>
  )
}

/** "without a single salary": the answer carries no individual € figure; the line underlines on "single salary". */
export function NoSalary({ f }: { f: number }) {
  const inP = interpolate(f, [S7B.noSalary - 2, S7B.noSalary + 12], [0, 1], { ...clamp, easing: ease })
  const ul = interpolate(f, [S7B.underline, S7B.underlineEnd], [0, 1], { ...clamp, easing: ease })
  const note = interpolate(f, [S7B.underline + 6, S7B.underline + 20], [0, 1], clamp)
  return (
    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 32, opacity: inP, transform: `translateY(${(1 - inP) * 10}px)` }}>
      <div style={{ display: "inline-flex", alignItems: "center", gap: 14 }}>
        <span style={{ width: 16, height: 16, background: C.green, display: "inline-block" }} />
        <span style={{ position: "relative", fontFamily: sans, fontWeight: 600, fontSize: 27, color: C.ink, whiteSpace: "nowrap" }}>
          No individual salary anywhere in this answer
          <span style={{ position: "absolute", left: 0, bottom: -5, height: 3, width: `${ul * 100}%`, background: C.green }} />
        </span>
      </div>
      <div style={{ fontFamily: sans, fontSize: 17, color: C.gray350, opacity: note, textAlign: "right", lineHeight: 1.35, maxWidth: 380 }}>
        Its one € figure is release #1's published Senior average of 9 members.
      </div>
    </div>
  )
}
