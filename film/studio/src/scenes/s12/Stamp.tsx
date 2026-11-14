import { interpolate } from "remotion"
import { C, sans } from "../../tokens"
import { cl, ez } from "./rows"

/**
 * "passes n ≥ 3": the naive release rule's verdict, pressed under a table. Deep green 2px box,
 * square corners, no shadow. Presses in over 6 f (scale 1.3 → 1) so it lands on its word.
 */
export function Stamp({ x, y, t, at }: { x: number; y: number; t: number; at: number }) {
  const a = t - at
  if (a < 0) return null
  const o = interpolate(a, [0, 3], [0, 1], cl)
  const s = interpolate(a, [0, 6], [1.3, 1], ez)
  const tick = interpolate(a, [3, 10], [0, 1], ez)
  const fill = interpolate(a, [4, 10, 22], [0, 1, 0], cl)
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y - 24,
        height: 48,
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "0 18px 0 14px",
        border: `2px solid ${C.green}`,
        background: `rgba(205,194,255,${(0.35 * fill).toFixed(3)})`,
        color: C.green,
        fontFamily: sans,
        fontWeight: 600,
        fontSize: 25,
        letterSpacing: "0.01em",
        opacity: o,
        transform: `scale(${s})`,
        transformOrigin: "0 50%",
        whiteSpace: "pre",
      }}
    >
      <svg width={21} height={21} viewBox="0 0 18 18">
        <polyline
          points="2,9.5 7,14 16,4"
          fill="none"
          stroke={C.green}
          strokeWidth={2.4}
          strokeLinecap="square"
          strokeLinejoin="miter"
          pathLength={1}
          strokeDasharray={1}
          strokeDashoffset={1 - tick}
        />
      </svg>
      <span>passes n ≥ 3</span>
    </div>
  )
}
