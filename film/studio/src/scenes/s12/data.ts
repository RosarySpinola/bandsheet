import { wordFrame as w } from "../../lib/words"
import { sceneById } from "../../timeline"

/**
 * S1 + S2 share one world on one clock: `t` is the ABSOLUTE film frame (S1 = 0..203, S2 = 204..596).
 * Synthetic Harbour Courier chapel (packages/core seed.ts, naive n>=3 rule). Means are the real seed means.
 */
export type Grade = { grade: string; n1: number; n2: number; m1: string; m2: string }
export const GRADES: Grade[] = [
  { grade: "Junior", n1: 8, n2: 8, m1: "€30,713", m2: "€30,713" },
  { grade: "Reporter", n1: 11, n2: 11, m1: "€43,000", m2: "€43,000" },
  { grade: "Senior", n1: 9, n2: 10, m1: "€62,400", m2: "€63,160" },
  { grade: "Editor", n1: 5, n2: 5, m1: "€81,780", m2: "€81,780" },
  { grade: "Chief", n1: 3, n2: 3, m1: "€109,333", m2: "€109,333" },
]
export const SENIOR = 2

/** World layout (px at camera scale 1). Two ruled tables side by side, dots beside each row. */
export const L = {
  tableX: [180, 1020] as const, // Release #1, Release #2
  tableW: 720,
  titleY: 214, // title baseline-ish centre
  topRule: 250,
  headerY: 282,
  headerRule: 304,
  rowY0: 338,
  rowH: 62,
  nRight: 262, // n column right edge (relative to table x)
  meanRight: 446,
  dotX0: 486, // first dot centre (relative)
  dotGap: 22,
  dotR: 7.5,
}
export const rowY = (g: number) => L.rowY0 + g * L.rowH
export const sepY = (i: number) => L.rowY0 + L.rowH / 2 + i * L.rowH // between row i and i+1
export const bottomRule = rowY(4) + L.rowH / 2
export const dotX = (k: number, j: number) => L.tableX[k] + L.dotX0 + j * L.dotGap

/** S2 stacked pair (world): both Senior rows meet here, Release #2 on top. */
export const STACK = { x: 600, yTop: 434, yBot: 494, rule: 530, eqY: 568, figY: 700, labelY: 752 }

const S2 = sceneById("S2")
export const S2_END = S2.from + S2.dur
/** T1 starts just before "But subtract": the Senior rows meet on "subtract". */
const T1 = w("But subtract") - 6

/**
 * Every beat in absolute frames, pinned to the voice with `wordFrame` (lib/words.ts). Offsets
 * after a word are choreography (how long a move takes), never a guess at where a word falls.
 * T2 owns the last 24 frames of S2, so the hand-off pose always lands on the S3 cut.
 */
export const B = {
  r1Title: -60, // header block is already set at frame 0 (composed opening shot)
  r1Rows: w("average") - 2, // rows type on "average pay by grade", 7 f apart
  gather: w("average") + 4, // members drift to their rows, + 6 per row
  noor: w("joins") - 20, // drops on "one reporter", lands with a ring on "joins"
  r2Title: w("you ask again"),
  copies: w("you ask again") + 4, // + 5 per row
  r2Rows: w("you ask again") + 22, // + 6 per row; Release #2 completes during "Both tables", done by "hide"
  safe: w("smaller") - 3, // n-column highlights, "smaller than three"
  stampSafe: w("look safe"), // "passes n ≥ 3" on Release #1; Release #2 + 5 on "safe"
  t1: T1,
  fadeOthers: T1 + 6, // parted rows are gone before the push carries them past the 64 px margin
  rule2: w("subtract") + 3,
  eq: w("one from") - 2,
  cancel: w("the other"), // the nine shared members fade pairwise
  resolve: w("get her") - 8, // totals arrive on "get"
  swell: w("her exact"),
  burst: w("her exact") + 6,
  figure: w("seventy") - 14, // € is fully set on "seventy"
  label: w("euros"),
  back: w("Nobody"), // tables come back side by side, subtraction between them
  stamp: w("Two honest"), // both stamped "passes n ≥ 3" (Release #2 + 3)
  honest: w("honest"), // every n cell lights lavender
  t2: S2_END - 24,
}

/** Deterministic hash noise in [0,1). */
export const rand = (seed: number) => {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453
  return x - Math.floor(x)
}
