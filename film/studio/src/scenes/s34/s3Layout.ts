import { interpolate } from "remotion"
import { B3, HAS_F1, dropped, inOut } from "./beats"
import { BAR_H, BR_H, BR_W } from "./BrowserFrame"
import { CARD_H } from "./EmailCard"
import { F1_H, F1_PANEL, F1_ROI, F1_SEGMENTS, F1_W, F1_K, f1World } from "./F1Footage"
import type { Rect } from "./Receipt"
import { COL_TOP, DROP_H, LEFT_W, MAIN_PAD_X, SIDEBAR_W } from "./SubmitStandIn"

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const
const BR_TOP = 64

/** Browser geometry: 16:9 content for real footage, the wider stand-in layout otherwise. */
const w = HAS_F1 ? F1_W + 4 : BR_W
const h = HAS_F1 ? F1_H + 4 + BAR_H + 2 : BR_H
const left = Math.round((1920 - w) / 2)
const cl = left + 2
const ct = BR_TOP + 2 + BAR_H + 2
const roi = (k: keyof typeof F1_ROI) => f1World(cl, ct, F1_ROI[k].x, F1_ROI[k].y)

export const BROWSER = { w, h, left, top: BR_TOP }

/** Where the payslip card lands (centre + scale). */
export const DROP_AT = HAS_F1
  ? { ...roi("dropzone"), s: (F1_ROI.dropzone.h * (F1_W / 1920)) / CARD_H }
  : { x: left + 2 + SIDEBAR_W + MAIN_PAD_X + LEFT_W / 2, y: BR_TOP + 2 + BAR_H + COL_TOP + DROP_H / 2, s: DROP_H / CARD_H }

/** The Verified panel in world px (stand-in: the right column of the stand-in page). */
const PANEL_WORLD: Rect = HAS_F1
  ? { ...(({ x, y }) => ({ x, y }))(f1World(cl, ct, F1_PANEL.x, F1_PANEL.y)), w: F1_PANEL.w * F1_K, h: F1_PANEL.h * F1_K }
  : { x: left + 2 + SIDEBAR_W + MAIN_PAD_X + LEFT_W + 40, y: BR_TOP + 2 + BAR_H + COL_TOP, w: 560, h: 520 }
const PANEL_C = { x: PANEL_WORLD.x + PANEL_WORLD.w / 2, y: PANEL_WORLD.y + 150 }

/** Camera keys: [frame, world point centred on screen, scale]. The footage cut sits inside a move. */
function keys(): [number, number, number, number][] {
  const home: [number, number] = [960, 540]
  const base: [number, number, number, number][] = [
    [0, ...home, 1],
    [B3.cardGrow[1], ...home, 1.02],
    [B3.browserIn[1], ...home, 1],
    [dropped[1], ...home, 1],
  ]
  const r = HAS_F1 ? roi("read") : { x: left + 2 + SIDEBAR_W + MAIN_PAD_X + LEFT_W / 2, y: BR_TOP + 300 }
  const confirm = HAS_F1 ? F1_SEGMENTS[1].from : dropped[1]
  return [
    ...base,
    [Math.max(confirm + 8, B3.read - 6), ...home, 1.04],
    [B3.read + 18, r.x, r.y, 1.85],
    [B3.inside - 2, r.x + 14, r.y + 4, 1.9],
    [B3.inside + 22, PANEL_C.x, PANEL_C.y, 1.9],
    [B3.receipt[0], PANEL_C.x, PANEL_C.y + 8, 1.96],
    [B3.receipt[1], PANEL_C.x, PANEL_C.y + 20, 2.5],
  ]
}
const K = keys()

/** Paper camera for S3 at local frame f. */
export function cam3(f: number) {
  const fr = K.map((k) => k[0])
  const cx = interpolate(f, fr, K.map((k) => k[1]), { ...clamp, easing: inOut })
  const cy = interpolate(f, fr, K.map((k) => k[2]), { ...clamp, easing: inOut })
  const scale = interpolate(f, fr, K.map((k) => k[3]), { ...clamp, easing: inOut })
  return { x: -(cx - 960) * scale, y: -(cy - 540) * scale, scale, cx, cy }
}

/** The Verified panel's on-screen rect when it starts to open (the receipt's FLIP origin). */
export function panelOnScreen(f: number): Rect {
  const c = cam3(f)
  return {
    x: 960 + (PANEL_WORLD.x - c.cx) * c.scale,
    y: 540 + (PANEL_WORLD.y - c.cy) * c.scale,
    w: PANEL_WORLD.w * c.scale,
    h: PANEL_WORLD.h * c.scale,
  }
}
