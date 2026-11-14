import { interpolate } from "remotion"
import { ease } from "../../tokens"
import { B, L, SENIOR, STACK, rowY } from "./data"

const cl = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const
const ez = { ...cl, easing: ease }

export type RowState = { dx: number; dy: number; o: number }
export type Group = "up" | "down" | "senior"

export const groupOf = (g: number): Group => (g < SENIOR ? "up" : g > SENIOR ? "down" : "senior")

/**
 * S2 tail ("Nobody hacked anything. Two honest tables did it."): both tables come back side by
 * side, each parted outward by RET.dx so the subtraction sits in the gap between them (x 680–1240).
 * MID_DY lifts the equation, €70,000 and its label from the stack into that gap.
 */
export const RET = { dx: [-220, 220] as const }
export const MID_DY = -196

/** Middle column (equation, figure, label) leaves before T2 so the particles never cross text. */
export const t2Fade = (t: number) => interpolate(t, [B.t2 - 12, B.t2 - 2], [1, 0], cl)
/** The tables sit outside the particles' path: they part outward and fade across the T2 start. */
export const endFade = (t: number) => interpolate(t, [B.t2 - 6, B.t2 + 6], [1, 0], cl)
const endSpread = (t: number) => interpolate(t, [B.t2 - 6, B.t2 + 10], [0, 70], ez)
/** Stack-only marks (release tags, the long rule) are gone before the Senior rows slide over them. */
export const stackFade = (t: number) => interpolate(t, [B.back - 8, B.back + 1], [1, 0], cl)
/** The subtraction rises into the gap once the Senior rows have cleared it. */
export const midDy = (t: number) => interpolate(t, [B.back + 10, B.back + 30], [0, MID_DY], ez)

/** Return: the Senior rows leave the stack sideways first, then drop into their row; the rest of each table re-forms around them. */
function returned(k: 0 | 1, group: Group, t: number): RowState {
  const out = (k === 0 ? -1 : 1) * endSpread(t)
  const o = endFade(t)
  if (group === "senior") {
    const sy = (k === 1 ? STACK.yTop : STACK.yBot) - rowY(SENIOR)
    return {
      dx: interpolate(t, [B.back, B.back + 18], [STACK.x - L.tableX[k], RET.dx[k]], ez) + out,
      dy: interpolate(t, [B.back + 8, B.back + 22], [sy, 0], ez),
      o,
    }
  }
  const a = B.back + 6 + (group === "down" ? 4 : 0)
  return {
    dx: RET.dx[k] + out,
    dy: interpolate(t, [a, a + 18], [group === "up" ? -40 : 40, 0], ez),
    o: interpolate(t, [a, a + 14], [0, 1], ez) * o,
  }
}

/**
 * T1: the Senior rows of both tables translate toward each other and stack (Release #2 on top);
 * the rest of each table parts away from the Senior lane, dims to 30% and then leaves.
 * Vertical separation leads the horizontal travel so the two rows never overlap mid-move.
 */
export function rowState(k: 0 | 1, group: Group, t: number): RowState {
  if (t >= B.back) return returned(k, group, t)
  if (group === "senior") {
    const ty = (k === 1 ? STACK.yTop : STACK.yBot) - rowY(SENIOR)
    return {
      dx: interpolate(t, [B.t1 + 3, B.t1 + 21], [0, STACK.x - L.tableX[k]], ez),
      dy: interpolate(t, [B.t1, B.t1 + 9], [0, ty], ez),
      o: 1,
    }
  }
  const dim = interpolate(t, [B.t1, B.t1 + 14], [1, 0.3], ez) * interpolate(t, [B.fadeOthers, B.fadeOthers + 12], [1, 0], ez)
  return {
    dx: 0,
    dy: interpolate(t, [B.t1, B.t1 + 16], [0, group === "up" ? -80 : 96], ez),
    o: dim,
  }
}

export { cl, ez }
