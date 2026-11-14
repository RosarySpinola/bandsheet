import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion"
import { C, ease, easeInOut, FPS } from "../tokens"
import { Paper } from "../lib/paper"
import { FAN_TOTAL, S8B, S7_DUR, T7_LEN } from "./s78/beats"
import { camera7, toScreen, SIG_END_WORLD } from "./s78/camera"
import { Signature } from "./s78/letter"
import { ShardFan } from "./s78/fan"
import { Lockup } from "./s78/lockup"

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const
/** S7's final camera, so the signature and the fan vertex continue across the cut. */
const CAM_END = camera7(S7_DUR - 1)
const TIP = toScreen(SIG_END_WORLD, CAM_END)

/**
 * S8 Close (3621–3828). The fan sweeps from the signature tip to the hero vertex, the serif
 * lockup types on its words ("every band published", "nobody exposed"), URL and quiet marks follow; micro drift
 * settles, then a clean ~1.4 s hold. All beats are word-pinned in s78/beats.ts (S8B).
 */
export function S8() {
  const f = useCurrentFrame()
  const u = (T7_LEN + f) / FAN_TOTAL
  const bg = interpolate(f, [S8B.bgIn, S8B.bgIn + 40], [0, 1], { ...clamp, easing: ease })
  const sigOut = interpolate(f, [0, 18], [1, 0], clamp)
  // drift and sway run until driftEnd, easing to rest; afterwards everything is still.
  const live = interpolate(f, [S8B.driftEnd - 90, S8B.driftEnd], [1, 0], { ...clamp, easing: easeInOut })
  const driftT = Math.min(f, S8B.driftEnd)
  const dx = interpolate(driftT, [40, S8B.driftEnd], [0, -10], { ...clamp, easing: easeInOut })
  const ds = interpolate(driftT, [40, S8B.driftEnd], [1.012, 1], { ...clamp, easing: easeInOut })
  return (
    <AbsoluteFill style={{ background: C.paper }}>
      <AbsoluteFill
        style={{ opacity: bg, background: "radial-gradient(circle at 80% 10%, #f2f1f2 0%, #e4e3e5 90%)" }}
      />
      {sigOut > 0 ? (
        <Paper camera={CAM_END} tone="transparent">
          <div style={{ opacity: sigOut }}>
            <Signature draw={1} tint={1} />
          </div>
        </Paper>
      ) : null}
      <ShardFan u={Math.min(1, u)} start={TIP} swayK={live * Math.min(1, f / 60)} t={driftT / FPS} />
      <AbsoluteFill style={{ transform: `translateX(${dx}px) scale(${ds})`, transformOrigin: "10% 50%" }}>
        <Lockup f={f} />
      </AbsoluteFill>
    </AbsoluteFill>
  )
}
