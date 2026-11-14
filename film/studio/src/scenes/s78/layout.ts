import { interpolate } from "remotion"
import { easeInOut } from "../../tokens"
import { S7B } from "./beats"

/** Chat card world spot and section heights; the card grows as each section arrives (a chat thread lengthening). */
export const CHAT = { x: 520, y: 92, w: 1240 }
export const HEAD_H = 132
export const PAD = 30
export const REP_H = 30
export const ASK_H = 96
export const CHIP_H = 76
export const ANS_H = 330
export const NO_H = 74

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const
export const grow = (f: number, at: number, len = 12) => interpolate(f, [at, at + len], [0, 1], { ...clamp, easing: easeInOut })

export function chatParts(f: number) {
  const ask = grow(f, S7B.askType - 4)
  const chip = grow(f, S7B.chipIn)
  const ans = grow(f, S7B.answer - 2, 16)
  const no = grow(f, S7B.noSalary - 2)
  const h = HEAD_H + PAD + REP_H + ask * ASK_H + chip * CHIP_H + ans * ANS_H + no * NO_H + PAD
  return { ask, chip, ans, no, h }
}

/** Camera y that keeps the growing card centred in the readable band (64–790), never letting its foot pass 780. */
export function chatFollowY(f: number) {
  const { h } = chatParts(f)
  return Math.min(427 - (CHAT.y + h / 2), 780 - (CHAT.y + h))
}
