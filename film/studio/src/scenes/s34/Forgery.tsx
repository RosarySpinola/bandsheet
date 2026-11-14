import { interpolate } from "remotion"
import { C, sans } from "../../tokens"
import { B4, S4_DUR, inOut, lerp, outQuint, prog } from "./beats"
import { CARD_H, CARD_W, EmailCard, INGRID } from "./EmailCard"
import { mono } from "./fonts"

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const
type Pose = { x: number; y: number; s: number }
const HOME: Pose = { x: 64 + (CARD_W * 0.82) / 2, y: 470, s: 0.82 } // "Now, if someone edits even one digit…"
const PARK: Pose = { x: 300, y: 470, s: 0.46 } // during the chapel's trust vote
const BIG: Pose = { x: 560, y: 470, s: 1.12 } // "In release three…": the digit reads large
const REST: Pose = { x: 300, y: 300, s: 0.34 } // thrown out, up and left, clear of the seat tiles
const S_HIT = 0.34
const mix = (a: Pose, b: Pose, t: number): Pose => ({ x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), s: lerp(a.s, b.s, t) })

/** Where the card is at S4 local frame f (hit point = the crystal's left face). */
function pose(f: number, hitX: number, hitY: number) {
  let p = mix({ ...HOME, x: -CARD_W * 0.5 }, HOME, prog(f, B4.cardIn, outQuint))
  p = mix(p, PARK, prog(f, B4.park, inOut))
  p = mix(p, BIG, prog(f, B4.cardBack, inOut))
  let rot = 0
  const hit: Pose = { x: hitX - (CARD_W * S_HIT) / 2, y: hitY, s: S_HIT }
  if (f >= B4.fly[0]) p = mix(BIG, hit, prog(f, B4.fly, (t) => t * t * t))
  if (f >= B4.fly[1] && f < B4.bounce[0]) {
    const k = f - B4.fly[1]
    p = { ...hit, x: hit.x - Math.exp(-k / 6) * Math.sin(k * 1.4) * 6 } // pressed against the face while it checks
  }
  if (f >= B4.bounce[0]) {
    const t = prog(f, B4.bounce, outQuint)
    const cx = 700
    const cy = 200
    p = { x: (1 - t) ** 2 * hit.x + 2 * (1 - t) * t * cx + t * t * REST.x, y: (1 - t) ** 2 * hit.y + 2 * (1 - t) * t * cy + t * t * REST.y, s: lerp(S_HIT, REST.s, t) }
    rot = -14 * t + Math.sin(t * Math.PI) * -12
  }
  return { ...p, rot }
}

/**
 * Ingrid Halvorsen's genuine payroll email (HC-2977), one card for all of N7. It arrives on "Now, if someone
 * edits even one digit" (a caret waits at the digit; on "doesn't count" the DKIM-Signature line lights),
 * parks small while the chapel votes, returns large on "In release three": the 4 rolls to a 6 (€4,908.33 →
 * €6,908.33, lavender then alarm red), it flies at the crystal and is held there on "enclave"
 * (dkim_bad_signature), then thrown out on "threw it out".
 */
export function Forgery({ f, hitX, hitY }: { f: number; hitX: number; hitY: number }) {
  if (f < B4.cardIn[0]) return null
  const p = pose(f, hitX, hitY)
  const fade = 1 - prog(f, [B4.bounce[0] + 8, S4_DUR - 6])
  const caret = f >= B4.caret[0] && f < B4.caret[1] && Math.floor((f - B4.caret[0]) / 8) % 2 === 0
  const dkimHi = prog(f, [B4.dkimHi, B4.dkimHi + 12], inOut) * (1 - prog(f, [B4.cardBack[0], B4.cardBack[0] + 12]))
  const flip = prog(f, B4.flip, inOut)
  const red = prog(f, B4.red)
  const rule = prog(f, [B4.dkimHi + 2, B4.dkimHi + 14], outQuint) * (1 - prog(f, [B4.park[0], B4.park[0] + 10]))
  const tag = prog(f, [B4.cardBack[0] + 2, B4.cardBack[0] + 14], outQuint) * (1 - prog(f, [B4.fly[0], B4.fly[0] + 8]))
  const label = interpolate(f, [B4.fly[1] + 1, B4.fly[1] + 11], [0, 1], { ...clamp, easing: outQuint })
  const cardTop = p.y - (CARD_H * p.s) / 2
  const cardLeft = p.x - (CARD_W * p.s) / 2

  return (
    <>
      <div style={{ position: "absolute", left: p.x - CARD_W / 2, top: p.y - CARD_H / 2, transform: `scale(${p.s}) rotate(${p.rot}deg)`, opacity: fade }}>
        <EmailCard slip={INGRID} flip={flip} red={red} caret={caret} dkimHi={dkimHi} />
      </div>
      {rule > 0 ? (
        <div style={{ position: "absolute", left: cardLeft, top: cardTop + CARD_H * p.s + 22, opacity: rule, transform: `translateY(${(1 - rule) * 8}px)`, fontFamily: sans, fontSize: 21, color: C.ink, display: "flex", gap: 10, alignItems: "baseline" }}>
          <span style={{ fontFamily: mono, fontSize: 18, color: C.lav300 }}>d=harbourcourier.example</span>
          signs every digit · edit one and the signature fails
        </div>
      ) : null}
      {tag > 0 ? (
        <div style={{ position: "absolute", left: cardLeft, top: cardTop - 44, opacity: tag, transform: `translateY(${(1 - tag) * 8}px)`, fontFamily: sans, fontSize: 20, color: C.gray350, display: "flex", gap: 12 }}>
          <span style={{ color: C.ink, fontWeight: 600 }}>Release #3</span>· Ingrid Halvorsen's payslip, edited after signing
        </div>
      ) : null}
      {label > 0 ? (
        <div
          style={{
            position: "absolute",
            left: cardLeft - 6,
            top: cardTop + CARD_H * p.s + 14,
            opacity: label * fade,
            transform: `translateY(${(1 - label) * 8}px)`,
            display: "flex",
            alignItems: "center",
            gap: 12,
            fontFamily: mono,
            fontSize: 22,
            color: C.ink,
            background: C.paper,
            padding: "6px 10px",
            whiteSpace: "nowrap",
          }}
        >
          <span style={{ width: 22, height: 22, border: `2px solid ${C.ink}`, boxSizing: "border-box", display: "grid", placeItems: "center" }}>
            <svg width={12} height={12} viewBox="0 0 12 12"><path d="M2 2 L10 10 M10 2 L2 10" stroke={C.ink} strokeWidth={2.4} /></svg>
          </span>
          dkim_bad_signature
        </div>
      ) : null}
    </>
  )
}
