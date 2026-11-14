import { Img, interpolate, staticFile } from "remotion"
import { C, sans, ease } from "../tokens"
import { LABELS, takeAt, type Label } from "./segments"

/**
 * The take's browser frame: thin 2px ink rule on paper, top-aligned so the captions (top ≈ 898 for two lines)
 * sit below it. One 1920×962-shaped content box for every tab: the app's early 1920×1080 frames show their top
 * 962 px (cover, top-aligned), so cuts between 1080 and 962 frames never change size.
 */
export const BAR = 40
export const CW = 1640
export const CH = Math.round((CW * 962) / 1920)
export const FR = { x: Math.round((1920 - CW - 4) / 2), y: 10, w: CW + 4, h: CH + BAR + 6 }
export const CONTENT = { x: FR.x + 2, y: FR.y + BAR + 4, w: CW, h: CH }

/** Latest screencast frame at or before `ms` (the screencast only sends a frame when the page changes). */
export function frameAt(frames: number[], ms: number) {
  let lo = 0
  let hi = frames.length - 1
  if (ms <= frames[0]) return frames[0]
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (frames[mid] <= ms) lo = mid
    else hi = mid - 1
  }
  return frames[lo]
}
export const framePath = (role: string, ms: number) => `take/${role}/${ms}.jpg`

/** Frame-accurate mapping: the film frame picks a take moment; the take's own JPEG for that moment is shown. */
export function TakeVideo({ abs }: { abs: number }) {
  const { tab, ms } = takeAt(abs)
  return (
    <Img
      src={staticFile(framePath(tab.id, frameAt(tab.frames, ms)))}
      style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 0%", display: "block" }}
    />
  )
}

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const

function Chip({ l, abs }: { l: Label; abs: number }) {
  const o = Math.min(interpolate(abs, [l.from, l.from + 8], [0, 1], { ...clamp, easing: ease }), interpolate(abs, [l.to - 8, l.to], [1, 0], clamp))
  const landed = l.tone === "landed"
  return (
    <span
      style={{
        opacity: o,
        transform: `translateX(${(1 - o) * -10}px)`,
        display: "inline-flex",
        alignItems: "center",
        gap: 10,
        height: 28,
        padding: "0 12px",
        background: landed ? C.green : C.lav,
        color: landed ? "#fff" : C.ink,
        fontFamily: sans,
        fontWeight: 600,
        fontSize: 18,
        whiteSpace: "nowrap",
      }}
    >
      <span style={{ width: 9, height: 9, background: landed ? C.mint : C.lav300 }} />
      {l.text}
    </span>
  )
}

/** Chrome: square-cornered bar with our own minimal controls, the live URL, and the wallet/landed label. */
export function Chrome({ abs, chromeIn = 1 }: { abs: number; chromeIn?: number }) {
  const { tab, seg } = takeAt(abs)
  const url = seg.url ?? tab.url
  const label = LABELS.find((l) => abs >= l.from && abs < l.to)
  return (
    <div style={{ position: "absolute", left: 0, top: 0, right: 0, height: BAR, display: "flex", alignItems: "center", gap: 18, padding: "0 16px", background: C.band, borderBottom: `2px solid ${C.ink}`, opacity: chromeIn }}>
      <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
        {[0, 1, 2].map((i) => (
          <span key={i} style={{ width: 12, height: 12, border: `2px solid ${C.ink}`, boxSizing: "border-box", background: i === 0 ? C.ink : "transparent" }} />
        ))}
      </div>
      <div style={{ width: 420, flexShrink: 0 }}>{label ? <Chip l={label} abs={abs} /> : null}</div>
      <div style={{ width: 640, height: 28, background: C.paper, border: `1px solid ${C.line}`, display: "flex", alignItems: "center", padding: "0 12px", fontFamily: sans, fontSize: 16, color: C.gray350, whiteSpace: "nowrap", overflow: "hidden" }}>
        <span style={{ color: tab.kind === "app" ? C.gray350 : C.ink }}>{url}</span>
      </div>
    </div>
  )
}
