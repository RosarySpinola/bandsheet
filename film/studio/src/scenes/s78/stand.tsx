import { interpolate } from "remotion"
import { C, ease, easeOutQuint, sans, serif } from "../../tokens"
import { S7B } from "./beats"
import { ageColour } from "./type"

/**
 * Recreated /unit/stand answer panel, drawn in F6 SOURCE pixels over the real panel (x 1032–1672, y 349–933,
 * measured on F6 frame 170). It replaces the footage's panel, which twice called the Malta figure an EU-wide median.
 * Values are the app's real ones for this recording: €41,000 entered, Reporter band mean €43,000 (n = 11),
 * Eurostat SES 2018 Malta OC2 median €2,189 a month (pay_context MT) = €26,268 a year.
 */
export const PANEL = { x: 1032, y: 349, w: 640, h: 584 }
export const MEDIAN_LABEL = "Malta · Professionals (ISCO 2) · Eurostat SES 2018 · €26,268 / yr"
const JOB = "Professionals (ISCO 2)"
const YOU = 41000
const MEAN = 43000
const MEDIAN_YR = 2189 * 12
const LO = 25800
const HI = 46000
const IN = { l: 36, w: 568 }
const xOf = (v: number) => IN.l + ((v - LO) / (HI - LO)) * IN.w
const eur = (v: number) => `€${Math.round(v).toLocaleString("en-GB")}`
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const
const BAR_Y = 226

/** Single-line per-glyph type-on with the ISCO group highlight (lights on "their job"). */
function MedianLabel({ f }: { f: number }) {
  const start = S7B.medianLine + 2
  const rate = 0.25
  const j0 = MEDIAN_LABEL.indexOf(JOB)
  const j1 = j0 + JOB.length
  const hl = interpolate(f, [S7B.job, S7B.job + 12], [0, 1], { ...clamp, easing: ease })
  const chars = [...MEDIAN_LABEL]
  const pre = chars.slice(0, j0)
  const mid = chars.slice(j0, j1)
  const post = chars.slice(j1)
  const glyph = (ch: string, i: number) => {
    const age = f - (start + i * rate)
    return (
      <span key={i} style={{ opacity: interpolate(age, [0, 2.5], [0, 1], clamp), color: ageColour(age, C.green) }}>
        {ch}
      </span>
    )
  }
  return (
    <div style={{ whiteSpace: "pre", fontFamily: sans, fontWeight: 600, fontSize: 15, color: C.green }}>
      {pre.map((c, i) => glyph(c, i))}
      <span style={{ backgroundImage: `linear-gradient(${C.lav}, ${C.lav})`, backgroundSize: `${hl * 100}% 100%`, backgroundRepeat: "no-repeat", padding: "1px 0" }}>
        {mid.map((c, i) => glyph(c, j0 + i))}
      </span>
      {post.map((c, i) => glyph(c, j1 + i))}
    </div>
  )
}

export function AnswerPanel({ f }: { f: number }) {
  const s = S7B.standIn
  const head = interpolate(f, [s, s + 16], [0, 1], { ...clamp, easing: easeOutQuint })
  const count = interpolate(f, [s, s + 16], [0.86, 1], { ...clamp, easing: ease })
  const sub = interpolate(f, [s + 6, s + 18], [0, 1], clamp)
  const track = interpolate(f, [s + 8, s + 24], [0, 1], { ...clamp, easing: ease })
  const marks = interpolate(f, [s + 14, s + 26], [0, 1], { ...clamp, easing: easeOutQuint })
  const fill = interpolate(f, [s + 18, s + 32], [0, 1], { ...clamp, easing: ease })
  const dash = interpolate(f, [S7B.medianLine, S7B.medianLine + 12], [0, 1], { ...clamp, easing: ease })
  const quote = interpolate(f, [S7B.medianWord, S7B.medianWord + 14], [0, 1], { ...clamp, easing: ease })
  const foot = interpolate(f, [S7B.job + 6, S7B.job + 18], [0, 1], clamp)
  const label = { position: "absolute", top: 0, fontFamily: sans, fontWeight: 600, fontSize: 13.5, whiteSpace: "nowrap" } as const
  return (
    <div style={{ position: "absolute", left: PANEL.x, top: PANEL.y, width: PANEL.w, height: PANEL.h, background: "#f5f5f2" }}>
      <div style={{ position: "absolute", left: IN.l, top: 41, opacity: head, fontFamily: sans, fontWeight: 600, fontSize: 13, letterSpacing: "0.04em", color: C.gray350 }}>
        YOUR POSITION · REPORTER
      </div>
      <div
        style={{
          position: "absolute",
          left: IN.l,
          top: 60,
          opacity: head,
          transform: `translateY(${(1 - head) * 10}px)`,
          fontFamily: serif,
          fontWeight: 500,
          fontSize: 68,
          lineHeight: 1,
          color: C.ink,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        −{eur((MEAN - YOU) * count)}
      </div>
      <div style={{ position: "absolute", left: IN.l, top: 142, opacity: sub, fontFamily: sans, fontSize: 17, color: C.ink }}>
        −4.7%, below the Reporter band mean of {eur(MEAN)}
      </div>
      {/* band bar */}
      <div style={{ position: "absolute", left: 0, top: 196, width: PANEL.w, height: 100 }}>
        <div style={{ position: "absolute", left: IN.l, top: BAR_Y - 196, width: IN.w * track, height: 5, background: C.paper }} />
        <div style={{ position: "absolute", left: xOf(YOU), top: BAR_Y - 196 - 4, width: (xOf(MEAN) - xOf(YOU)) * fill, height: 13, background: C.lav }} />
        <div style={{ position: "absolute", left: xOf(YOU) - 1, top: BAR_Y - 196 - 9, width: 2, height: 24 * marks, background: C.lav300 }} />
        <div style={{ position: "absolute", left: xOf(MEAN) - 1, top: BAR_Y - 196 - 11, width: 3, height: 28 * marks, background: C.ink }} />
        <div style={{ ...label, left: xOf(MEAN), transform: "translateX(-50%)", top: 0, color: C.ink, opacity: marks }}>Band mean {eur(MEAN)}</div>
        <div style={{ ...label, left: xOf(YOU), transform: "translateX(-50%)", top: 48, color: C.lav300, opacity: marks }}>You {eur(YOU)}</div>
        {/* Eurostat median: dashed line draws down from the bar to its label */}
        <div style={{ position: "absolute", left: xOf(MEDIAN_YR) - 1, top: BAR_Y - 196 - 12, width: 0, height: 62 * dash, borderLeft: `2px dashed ${C.green}` }} />
      </div>
      <div style={{ position: "absolute", left: xOf(MEDIAN_YR) - 1, top: 284 }}>
        <MedianLabel f={f} />
      </div>
      {/* source and caveat (the app's own copy) */}
      <div style={{ position: "absolute", left: IN.l, top: 338, width: IN.w, opacity: quote, transform: `translateY(${(1 - quote) * 8}px)`, borderLeft: `2px solid ${C.ink}`, paddingLeft: 18, boxSizing: "border-box" }}>
        <div style={{ fontFamily: sans, fontWeight: 600, fontSize: 16, color: C.ink }}>€2,189 a month, about €26,268 a year</div>
        <div style={{ fontFamily: sans, fontSize: 14.5, lineHeight: 1.55, color: C.gray350, marginTop: 8 }}>
          A broad category: every professional in Malta, not newsroom pay, and 2018 is the latest survey year Eurostat publishes. Use it as a
          rough outside reference; the chapel band is the closer comparison.
        </div>
        <div style={{ fontFamily: sans, fontWeight: 600, fontSize: 14, color: C.ink, marginTop: 8 }}>Eurostat earn_ses_monthly ↗</div>
      </div>
      <div style={{ position: "absolute", left: IN.l, top: 500, width: IN.w, opacity: foot, fontFamily: sans, fontSize: 14.5, lineHeight: 1.55, color: C.gray350 }}>
        The band is the average of 11 members' gross annual pay. It is a mean, not a range, so a gap is a prompt to ask, not proof of
        unfair pay.
      </div>
    </div>
  )
}
