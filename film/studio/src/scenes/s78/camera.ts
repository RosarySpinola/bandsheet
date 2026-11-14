import { interpolate } from "remotion"
import { easeInOut, W, H } from "../../tokens"
import { S7B, S7_DUR } from "./beats"
import { chatFollowY } from "./layout"

/*
 * S7 world geometry (one continuous page, top to bottom): MCP chat card (layout.ts) → /unit/stand browser frame →
 * Article 7 letter. Everything a viewer must read stays above screen y ~790, clear of the caption band.
 */

/** Browser frame for F6 (/unit/stand). Video is 1920×1080; we show source rows CROP_TOP..CROP_TOP+CROP_H. */
export const FRAME = { x: 230, y: 1400, w: 1460, bar: 40, border: 2 }
export const K = FRAME.w / 1920
export const CROP_TOP = 24
export const CROP_H = 900
export const VIEW_H = Math.round(CROP_H * K)

/** F6 source pixel → world. */
export const srcToWorld = (sx: number, sy: number) => ({
  x: FRAME.x + FRAME.border + sx * K,
  y: FRAME.y + FRAME.border + FRAME.bar + (sy - CROP_TOP) * K,
})

/** Letter card world geometry (shared with S8 so the signature carries across the cut). */
export const LETTER = { x: 280, y: 2380, w: 1360, h: 640 }
export const SIG = { x: LETTER.x + 40, y: LETTER.y + LETTER.h - 108, w: 320, h: 90, endX: 300, endY: 30 }
export const SIG_END_WORLD = { x: SIG.x + SIG.endX, y: SIG.y + SIG.endY }
export const SIG_PATH =
  "M6 62 C 24 20, 40 14, 46 40 C 50 60, 30 78, 36 58 C 44 34, 70 30, 72 54 C 74 70, 88 66, 96 48 C 104 30, 112 36, 110 56 C 108 72, 124 70, 134 52 C 146 30, 160 40, 156 60 C 152 76, 176 70, 188 50 C 200 30, 214 46, 222 58 C 236 76, 262 60, 300 30"

type Cam = { x: number; y: number; scale: number; rotate: number }
type Key = { f: number; x: number; y: number; s: number }

/** Camera that shows world point p at screen point q with scale s (Paper scales about the frame centre). */
function look(p: { x: number; y: number }, s: number, q = { x: W / 2, y: H / 2 }) {
  return { x: q.x - W / 2 - s * (p.x - W / 2), y: q.y - H / 2 - s * (p.y - H / 2), s }
}

const PANEL_FOCUS = srcToWorld(1352, 684) // the recreated answer panel: −€2,000, band bar, Eurostat median
const push1 = look(PANEL_FOCUS, 2.0)
const push2 = look(PANEL_FOCUS, 2.12)
const frameY = 70 - FRAME.y // frame top at screen y 70
const letterY = 92 - LETTER.y // letter top at screen y 92

const panX = (f: number) => interpolate(f, [S7B.sidebarOut, S7B.sidebarOut + 26], [0, -180], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: easeInOut })
const drift = (f: number) => interpolate(f, [S7B.answer + 30, S7B.travel1], [0, 0.012], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })

/** From "And every member" on: keyed travel (the chat phase before it follows the card's height). */
const KEYS: Key[] = [
  { f: S7B.travel1, x: panX(S7B.travel1), y: chatFollowY(S7B.travel1), s: 1 + drift(S7B.travel1) },
  { f: S7B.travel1 + S7B.travel1Len, x: 0, y: frameY, s: 1 }, // down the page to /unit/stand
  { f: S7B.push, x: 0, y: frameY - 10, s: 1 },
  { f: S7B.push + S7B.pushLen, x: push1.x, y: push1.y, s: push1.s }, // into the answer panel
  { f: S7B.travel2, x: push2.x, y: push2.y, s: push2.s },
  { f: S7B.travel2 + S7B.travel2Len, x: 0, y: letterY, s: 1 }, // down to the letter
  { f: S7_DUR, x: 0, y: letterY - 12, s: 1.05 }, // slow push through the signature into T7
]

/** S7's one continuous camera: the chat phase follows the growing card; then keyed travel down the page. */
export function camera7(f: number): Cam {
  if (f < S7B.travel1) return { x: panX(f), y: chatFollowY(f), scale: 1 + drift(f), rotate: 0 }
  let i = 0
  while (i < KEYS.length - 2 && f > KEYS[i + 1].f) i++
  const a = KEYS[i]
  const b = KEYS[i + 1]
  const t = interpolate(f, [a.f, b.f], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: easeInOut })
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, scale: a.s + (b.s - a.s) * t, rotate: 0 }
}

/** World → screen under Paper's transform (translate, then scale about the frame centre). */
export function toScreen(p: { x: number; y: number }, cam: { x: number; y: number; scale: number }) {
  return { x: W / 2 + cam.x + cam.scale * (p.x - W / 2), y: H / 2 + cam.y + cam.scale * (p.y - H / 2) }
}
