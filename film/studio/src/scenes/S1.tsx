import { useCurrentFrame } from "remotion"
import { World } from "./s12/World"

/** S1 hook (0–204): Release #1 types on "average pay by grade", members gather, Noor joins, Release #2 on "you ask again". */
export function S1() {
  return <World t={useCurrentFrame()} />
}
