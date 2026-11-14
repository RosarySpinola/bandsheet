import { interpolate, interpolateColors } from "remotion"
import { C, sans, serif } from "../../tokens"
import { mono } from "./fonts"

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const

export const EMAIL = {
  from: "Harbour Courier Payroll <payroll@harbourcourier.example>",
  subject: "Your payslip for October 2026",
  dkim: "DKIM-Signature: v=1; a=rsa-sha256; d=harbourcourier.example; s=payroll2026; …",
}
/** Gross pay split around the one digit that can be edited: pre + digit(from→to) + post. */
export type Payslip = { meta: string; pre: string; from: string; to: string; post: string }
/** Noor's genuine payslip (S3). */
export const NOOR: Payslip = { meta: "Employee ID: HC-0412 · Grade: Senior · Period: 2026-10", pre: "EUR 5,8", from: "3", to: "3", post: "3.33" }
/** Ingrid's genuine payroll email, edited after signing: 4,908.33 → 6,908.33 (the forgery Release #3 refused). */
export const INGRID: Payslip = { meta: "Employee ID: HC-2977 · Grade: Senior · Period: 2026-10", pre: "EUR ", from: "4", to: "6", post: ",908.33" }
export const CARD_W = 860
export const CARD_H = 312

/** One line that rises 10px and fades in as `t` goes 0→1. */
function Line({ t, children, style }: { t: number; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ opacity: t, transform: `translateY(${(1 - t) * 10}px)`, ...style }}>{children}</div>
  )
}

/**
 * The payslip email. `reveal` (0→1) staggers its lines in. With `flip` (0→1) the editable digit rolls
 * from → to in lavender; `red` (0→1) turns that digit alarm red (the forged copy). `caret` shows a text
 * cursor before that digit; `dkimHi` (0→1) sweeps a lavender band behind the DKIM-Signature line.
 */
export function EmailCard({ slip = NOOR, reveal = 1, flip = 0, red = 0, compact = false, caret = false, dkimHi = 0 }: { slip?: Payslip; reveal?: number; flip?: number; red?: number; compact?: boolean; caret?: boolean; dkimHi?: number }) {
  const l = (i: number) => interpolate(reveal, [i * 0.14, i * 0.14 + 0.3], [0, 1], clamp)
  const digitColor = red > 0 ? interpolateColors(red, [0, 1], [C.lav300, C.alarm]) : interpolateColors(flip, [0, 0.3, 1], [C.ink, C.lav300, C.lav300])
  return (
    <div
      style={{
        width: CARD_W,
        height: CARD_H,
        boxSizing: "border-box",
        background: C.paper,
        border: `2px solid ${C.ink}`,
        padding: "30px 38px",
        display: "flex",
        flexDirection: "column",
        gap: 14,
        fontFamily: sans,
        color: C.text,
      }}
    >
      <Line t={l(0)} style={{ display: "flex", gap: 14, fontSize: 19, color: C.gray350 }}>
        <span style={{ width: 74 }}>From</span>
        <span style={{ color: C.ink, fontWeight: 600 }}>{EMAIL.from}</span>
      </Line>
      <Line t={l(1)} style={{ display: "flex", gap: 14, alignItems: "baseline" }}>
        <span style={{ width: 74, fontSize: 19, color: C.gray350 }}>Subject</span>
        <span style={{ fontFamily: serif, fontWeight: 500, fontSize: 34, color: C.ink, letterSpacing: "-0.01em" }}>{EMAIL.subject}</span>
      </Line>
      <Line t={l(2)} style={{ height: 2, background: C.ink, transformOrigin: "0 50%" }}>{null}</Line>
      <Line t={l(2)} style={{ position: "relative", fontFamily: mono, fontSize: 15.5, color: dkimHi > 0.5 ? C.ink : C.gray350, whiteSpace: "nowrap" }}>
        <span style={{ position: "absolute", left: -8, right: -8, top: -3, bottom: -3, background: C.lav, opacity: 0.75, transform: `scaleX(${dkimHi})`, transformOrigin: "0 50%" }} />
        <span style={{ position: "relative", display: "block", overflow: "hidden", textOverflow: "clip" }}>{EMAIL.dkim}</span>
      </Line>
      <Line t={l(3)} style={{ fontSize: 21, color: C.text, marginTop: compact ? 0 : 6 }}>{slip.meta}</Line>
      <Line t={l(4)} style={{ fontSize: 30, fontWeight: 600, color: C.ink, display: "flex", alignItems: "baseline", gap: 12 }}>
        <span style={{ fontWeight: 400, fontSize: 21, color: C.text }}>Gross pay (month):</span>
        <span style={{ fontVariantNumeric: "tabular-nums", whiteSpace: "pre" }}>
          {slip.pre}
          {caret ? <span style={{ display: "inline-block", width: 3, height: "1.05em", background: C.ink, verticalAlign: "-0.12em", marginRight: -3 }} /> : null}
          <Digit a={slip.from} b={slip.to} flip={flip} color={digitColor} />
          {slip.post}
        </span>
      </Line>
    </div>
  )
}

/** The one edited digit: rolls up from a to b inside its own glyph box. */
function Digit({ a, b, flip, color }: { a: string; b: string; flip: number; color: string }) {
  const y = -flip * 1.15
  return (
    <span style={{ display: "inline-block", height: "1.15em", overflow: "hidden", verticalAlign: "bottom", lineHeight: "1.15em", color, position: "relative" }}>
      <span style={{ display: "flex", flexDirection: "column", transform: `translateY(${y}em)` }}>
        <span>{a}</span>
        <span>{b}</span>
      </span>
      {flip > 0.95 ? <span style={{ position: "absolute", left: -2, right: -2, bottom: 0, height: 3, background: color }} /> : null}
    </span>
  )
}
