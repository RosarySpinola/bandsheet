import { useCurrentFrame } from "remotion"
import { sceneById } from "../timeline"
import { World } from "./s12/World"

/**
 * S2 subtract (204–597): "passes n ≥ 3", T1 Senior rows meet, the equation resolves, €70,000 exposed;
 * "Nobody hacked anything. Two honest tables did it." brings both stamped tables back with the subtraction
 * between them; T2 into the envelope. Clock = S1's length + local, so the world runs on absolute frames.
 */
export function S2() {
  return <World t={useCurrentFrame() + sceneById("S2").from} />
}
