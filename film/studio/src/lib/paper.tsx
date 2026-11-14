import type { ReactNode } from "react"
import { AbsoluteFill } from "remotion"
import { C } from "../tokens"

/** The paper world every scene lives on. `camera` = { x, y, scale, rotate } applied to the world layer. */
export function Paper({
  children,
  camera = { x: 0, y: 0, scale: 1, rotate: 0 },
  tone = C.paper,
}: {
  children: ReactNode
  camera?: { x: number; y: number; scale: number; rotate?: number }
  tone?: string
}) {
  return (
    <AbsoluteFill style={{ background: tone, overflow: "hidden" }}>
      <AbsoluteFill
        style={{
          transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.scale}) rotate(${camera.rotate ?? 0}deg)`,
          transformOrigin: "50% 50%",
        }}
      >
        {children}
      </AbsoluteFill>
    </AbsoluteFill>
  )
}
