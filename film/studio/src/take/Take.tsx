import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion"
import { C, easeInOut } from "../tokens"
import { ENV } from "../scenes/s12/envelope"
import { Chrome, CONTENT, FR, TakeVideo } from "./Frame"
import { InsertLayer } from "./Inserts"
import { INSERTS, TAKE_FROM } from "./segments"

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
/** T2 in: S2's envelope outline (360×240 at 960,540) opens into the browser frame over 24 frames. */
const OPEN = [2, 26] as const
const E = { x: ENV.cx - ENV.w / 2, y: ENV.cy - ENV.h / 2, w: ENV.w, h: ENV.h }

/**
 * v4 · 597–3621: one continuous real-app take (segments.ts) in a browser frame, with explainer inserts that
 * freeze the take underneath and cut back to the same frame. Opens from S2's envelope; closes into S8's fan.
 */
export function Take() {
  const f = useCurrentFrame()
  const abs = TAKE_FROM + f
  const t = interpolate(f, OPEN, [0, 1], { ...clamp, easing: easeInOut })
  const flap = 1 - interpolate(f, [0, 12], [0, 1], clamp)
  const inside = interpolate(f, [OPEN[1] - 8, OPEN[1] + 4], [0, 1], clamp)
  const box = { x: lerp(E.x, FR.x, t), y: lerp(E.y, FR.y, t), w: lerp(E.w, FR.w, t), h: lerp(E.h, FR.h, t) }
  // the flap's V, carried by the opening rectangle (s12/HANDOFF: (780,420) → (960,552) → (1140,420))
  const vy = box.y + (132 / 240) * box.h * (1 - t)
  return (
    <AbsoluteFill style={{ background: C.paper }}>
      <div style={{ position: "absolute", left: box.x, top: box.y, width: box.w, height: box.h, border: `2px solid ${C.ink}`, boxSizing: "border-box", overflow: "hidden", background: C.paper }}>
        {inside > 0 ? (
          <>
            <Chrome abs={abs} chromeIn={inside} />
            <div style={{ position: "absolute", left: CONTENT.x - FR.x - 2, top: CONTENT.y - FR.y - 2, width: CONTENT.w, height: CONTENT.h, opacity: inside, background: C.paper }}>
              <TakeVideo abs={abs} />
            </div>
          </>
        ) : null}
      </div>
      {flap > 0 ? (
        <svg width={1920} height={1080} style={{ position: "absolute", inset: 0, opacity: flap }}>
          <polyline points={`${box.x},${box.y} ${box.x + box.w / 2},${vy} ${box.x + box.w},${box.y}`} fill="none" stroke={C.ink} strokeWidth={2} strokeLinejoin="miter" />
        </svg>
      ) : null}
      {INSERTS.map((n) => (
        <InsertLayer key={n.kind + n.from} n={n} abs={abs} />
      ))}
    </AbsoluteFill>
  )
}
