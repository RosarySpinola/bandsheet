import { interpolate, Easing } from "remotion"
import { sceneById } from "../../timeline"
import { wordFrame } from "../../lib/words"

/** Footage slots. F1 (/unit/submit) plays in S3. F2 (/unit/vote, recorded 15:23) shows only the release
 * proposals #0, #1 and #6, not proposal #2 "Trust Harbour Courier payroll's DKIM key", so the S4 inset
 * keeps the stand-in built from that real proposal (tx 4G8BgLru…). */
export const HAS_F1 = true // public/footage/F1.mp4 (/unit/submit)
export const HAS_F2 = false // public/footage/F2.mp4 exists but has no trust-key proposal

export const S3_FROM = sceneById("S3").from
export const S4_FROM = sceneById("S4").from
export const S3_DUR = sceneById("S3").dur
export const S4_DUR = sceneById("S4").dur

/** Word starts in each scene's local frames (every beat below is keyed to one; no numeric word offsets). */
export const w3 = (phrase: string) => wordFrame(phrase) - S3_FROM
export const w4 = (phrase: string) => wordFrame(phrase) - S4_FROM

const n4 = w3("Band-sheet is built")
const so = w3("So a member")
const before = w3("Before anything")

/** S3 local beats. The tail is the S3→S4 pan (`PAN`), which straddles the cut. */
export const B3 = {
  growOutline: [n4 - 4, n4 + 26] as const, // S2's 360×240 outline → 420×280
  flapOpen: [n4 + 10, n4 + 32] as const,
  cardRise: [n4 + 22, n4 + 42] as const,
  cardGrow: [n4 + 40, n4 + 68] as const,
  reveal: [n4 + 40, n4 + 88] as const,
  browserIn: [so + 6, so + 48] as const,
  drop: [w3("drops in"), w3("payslip email") + 20] as const, // lands on "email"
  page: [so + 26, so + 50] as const,
  read: w3("NEAR AI Cloud"), // camera on "Read from your payslip"
  inside: w3("inside a confidential"), // camera on the Verified panel
  receipt: [before, before + 24] as const, // the Verified panel opens into the receipt
}
export const dropped = [B3.drop[1] - 4, B3.drop[1] + 10] as const

/** S3→S4 pan (absolute frames): the receipt leaves right, the sealing station arrives from the left. */
export const PAN = { a: wordFrame("its answer") + 8, b: wordFrame("its answer") + 36, d: 1500 }
export const panAt = (abs: number) => interpolate(abs, [PAN.a, PAN.b], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.65, 0, 0.35, 1) })

const sealed = w4("sealed in")
const each = w4("Each member")
const chain = w4("goes on chain")
const newer = w4("a newer payslip")
const now = w4("Now, if someone")
const chapel = w4("The chapel voted")
const dkim = w4("D-K-I-M key")
const checks = w4("checks every signature")
const rel3 = w4("In release three")
const contact = w4("enclave threw")
const threw = w4("threw it out")

/** S4 local beats. */
export const B4 = {
  tuck: [PAN.b - S4_FROM - 8, PAN.b - S4_FROM + 4] as const, // as the station arrives
  fold: [sealed - 12, sealed] as const,
  stamp: [sealed + 1, sealed + 17] as const, // "sealed"
  sealLabel: [sealed + 12, sealed + 24] as const,
  crystalIn: [w4("a key that"), w4("a key that") + 48] as const, // "a key that only exists…"
  arc: [w4("enclave. Each") - 40, w4("enclave. Each")] as const, // lands on "enclave"
  fan: [w4("enclave. Each") - 18, w4("enclave. Each") + 22] as const,
  // N6b: the member's access key, the gasless stream, the replacement event.
  keyIn: [each, each + 24] as const,
  methods: w4("only submit"),
  stream0: chain, // "goes on chain"
  streamGap: 5,
  gas: w4("without gas"),
  event: [newer - 2, newer + 18] as const, // "a newer payslip" types the EVENT_JSON log; done before "replaces"
  replaced: w4("replaces"),
  keyOut: [now - 14, now + 2] as const,
  // N7: the signed card, the trust vote, the real forgery.
  cardIn: [now, now + 22] as const,
  caret: [w4("edits even"), w4("doesn't count")] as const,
  dkimHi: w4("doesn't count"),
  park: [chapel, chapel + 24] as const,
  insetIn: [w4("voted on NEAR"), w4("voted on NEAR") + 22] as const, // on "voted", once the crystal has cleared the right
  seats: [dkim, dkim + 8] as const, // "D-K-I-M key": seat 1, then seat 2
  chip: [checks, checks + 26] as const, // trusted key d=/s= flies into the crystal
  insetOut: [checks + 12, checks + 32] as const,
  cardBack: [rel3, rel3 + 26] as const, // "In release three"
  flip: [w4("a four into"), w4("a four into") + 12] as const,
  red: [w4("six on"), w4("six on") + 10] as const,
  fly: [contact - 18, contact] as const, // hits the crystal on "enclave"
  bounce: [threw, threw + 22] as const, // "threw it out"
  // T4 (ends one frame before the cut so S4's last frame is the settled pose).
  rise: [threw - 4, S4_DUR - 13] as const,
  line: [S4_DUR - 14, S4_DUR - 8] as const,
  split: [S4_DUR - 10, S4_DUR - 5] as const,
  tiles: [S4_DUR - 10, S4_DUR - 2] as const,
}

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const
export const ease = Easing.bezier(0.25, 0.1, 0.25, 1)
export const inOut = Easing.bezier(0.65, 0, 0.35, 1)
export const outQuint = Easing.bezier(0.23, 1, 0.32, 1)
export const outBack = Easing.bezier(0.34, 1.56, 0.64, 1)

/** 0→1 progress over [a, b] with an easing. */
export const prog = (f: number, [a, b]: readonly [number, number] | number[], e = ease) =>
  interpolate(f, [a, b], [0, 1], { ...clamp, easing: e })
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t

/** Turntable angle from the absolute film frame so every crystal shot agrees. */
export const turntable = (absFrame: number) => absFrame * 0.0105

/** The entry flash when the sealed envelope lands (S4 arc end), then a decay. */
export const entryPulse = (f4: number) => {
  const peak = B4.arc[1]
  if (f4 < peak) return interpolate(f4, [peak - 8, peak], [0, 1], clamp)
  return Math.exp(-(f4 - peak) / 8)
}

/** Shared screen poses (px, 1920×1080). */
export const CRYSTAL_HOME = { x: 960, y: 500, r: 230 }
export const SEAL = { x: 620, y: 500 } // envelope seal position: S4's station after the pan
