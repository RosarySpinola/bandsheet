import { interpolate, interpolateColors } from "remotion"
import { C, ease, easeOutQuint, sans, serif } from "../../tokens"
import { S7B } from "./beats"
import { LETTER, SIG, SIG_PATH } from "./camera"
import { TypeOn } from "./type"
import generated from "./letter-template.json"

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const
/**
 * Text = server/src/letter.ts templateLetter("Reporter", "MT") (letter-template.json; gate: check-s78.mjs). The only
 * changes: [placeholders] are dropped (the signature stands in for the name), "Please provide in writing:" joins the
 * intro paragraph, and blank lines are not drawn.
 */
const LINES = generated.body
  .split("\n")
  .map((l: string) => l.replace("[HR / Pay Transparency Contact]", "Pay Transparency Contact").replace(" at [Employer] [Job title, site]", ""))
  .filter((l: string) => l.trim() !== "" && !/^\[.*\]$/.test(l.trim()))
const pick = (re: RegExp) => LINES.find((l: string) => re.test(l)) ?? ""
const GREETING = pick(/^Dear /)
const INTRO = `${pick(/^I am writing/)} ${pick(/^Please provide/)}`
const ITEMS = LINES.filter((l: string) => /^\d\. /.test(l))
const DEADLINE = pick(/^Article 7\(4\)/)
const CLOSE = pick(/^Kind regards/)
const SUBJ = generated.subject
const SUBJ_HL = "Article 7"
const SUBJECT_A = SUBJ.slice(0, SUBJ.indexOf(SUBJ_HL))
const SUBJECT_C = SUBJ.slice(SUBJ.indexOf(SUBJ_HL) + SUBJ_HL.length)
/** Every rendered line, for the gate (no placeholder may survive). */
export const LETTER_TEXT = [SUBJ, GREETING, INTRO, ...ITEMS, DEADLINE, CLOSE]

/** The signature stroke alone (also drawn by S8 at the same world spot across the cut). */
export function Signature({ draw, tint }: { draw: number; tint: number }) {
  return (
    <svg width={SIG.w} height={SIG.h} viewBox={`0 0 ${SIG.w} ${SIG.h}`} style={{ position: "absolute", left: SIG.x, top: SIG.y, overflow: "visible" }}>
      <path
        d={SIG_PATH}
        pathLength={1}
        fill="none"
        stroke={interpolateColors(tint, [0, 1], [C.ink, C.lav300])}
        strokeWidth={3.2}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray="1 1"
        strokeDashoffset={1 - draw}
      />
    </svg>
  )
}

/** Article 7 letter card: subject bar ("Article 7" lights on its word), greeting types, requests settle, signature draws. */
export function LetterCard({ f, fade }: { f: number; fade: number }) {
  const inP = interpolate(f, [S7B.letterIn, S7B.letterIn + 24], [0, 1], { ...clamp, easing: easeOutQuint })
  const at = (t: number, len = 12) => interpolate(f, [t, t + len], [0, 1], { ...clamp, easing: ease })
  const intro = at(S7B.letterType + 8)
  const close = at(S7B.sign - 12, 10)
  const hl = at(S7B.art7, 12)
  const row = (p: number) => ({ opacity: p, transform: `translateY(${(1 - p) * 10}px)` })
  return (
    <div
      style={{
        position: "absolute",
        left: LETTER.x,
        top: LETTER.y,
        width: LETTER.w,
        height: LETTER.h,
        boxSizing: "border-box",
        border: `2px solid ${C.ink}`,
        background: C.paper,
        opacity: inP * fade,
        transform: `translateY(${(1 - inP) * 40}px)`,
        filter: fade < 0.99 ? `blur(${(1 - fade) * 6}px)` : undefined,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 40px", borderBottom: `2px solid ${C.line}` }}>
        <div style={{ fontFamily: sans, fontWeight: 600, fontSize: 24, color: C.ink, whiteSpace: "pre" }}>
          {SUBJECT_A}
          <span style={{ backgroundImage: `linear-gradient(${C.lav}, ${C.lav})`, backgroundSize: `${hl * 100}% 100%`, backgroundRepeat: "no-repeat" }}>{SUBJ_HL}</span>
          {SUBJECT_C}
        </div>
        <div style={{ fontFamily: sans, fontSize: 17, color: f >= S7B.ready ? C.green : C.gray350, fontWeight: f >= S7B.ready ? 600 : 400 }}>
          Article 7 letter · ready to send
        </div>
      </div>
      <div style={{ padding: "26px 40px 0", fontFamily: serif, fontWeight: 500, color: C.ink, fontSize: 23, lineHeight: 1.5 }}>
        <div style={{ fontSize: 30, lineHeight: 1.4 }}>
          <TypeOn text={GREETING} frame={f} start={S7B.letterType} rate={0.7} />
        </div>
        <div style={{ marginTop: 8, maxWidth: 1270, ...row(intro) }}>{INTRO}</div>
        <div style={{ marginTop: 4, paddingLeft: 22 }}>
          {ITEMS.map((t: string, i: number) => (
            <div key={t} style={{ maxWidth: 1240, ...row(at(S7B.letterType + 12 + i * 3)) }}>
              {t}
            </div>
          ))}
        </div>
        <div style={{ marginTop: 6, ...row(at(S7B.letterType + 22)) }}>{DEADLINE}</div>
        <div style={{ marginTop: 6, opacity: close }}>{CLOSE}</div>
      </div>
    </div>
  )
}
