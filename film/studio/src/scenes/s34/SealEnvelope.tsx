import { C } from "../../tokens"
import { CRYSTAL_HOME, SEAL, lerp } from "./beats"
import { CARD_H, CARD_W, EmailCard } from "./EmailCard"
import { ENV_H, ENV_W, Envelope } from "./Envelope"
import { mono } from "./fonts"

export type CardPose = { x: number; y: number; s: number; o?: number; reveal?: number }

/** Absolute-positioned payslip card centred at (x, y) with scale s. */
export function Card({ x, y, s, o = 1, reveal = 1 }: CardPose) {
  return (
    <div style={{ position: "absolute", left: x - CARD_W / 2, top: y - CARD_H / 2, transform: `scale(${s})`, opacity: o }}>
      <EmailCard reveal={reveal} />
    </div>
  )
}

/** Envelope centred at (cx, cy); `card` is the card pose in world coords (rendered behind the body). */
export function EnvelopeAt({ cx, cy, s = 1, o = 1, flap, fill, card, stamp = 0, pocket = 1 }: { cx: number; cy: number; s?: number; o?: number; flap: number; fill: number; card?: CardPose; stamp?: number; pocket?: number }) {
  const left = cx - ENV_W / 2
  const top = cy - ENV_H / 2
  return (
    <div style={{ position: "absolute", left, top, opacity: o, transform: `scale(${s})` }}>
      <Envelope flap={flap} sw={2 / s} pocket={pocket} fill={fill} stamp={stamp} card={card ? <Card {...card} x={card.x - left} y={card.y - top} /> : null} />
    </div>
  )
}

/** Card hover pose above the open envelope: S3's last frame and S4's first. */
export const HOVER = { x: SEAL.x, y: SEAL.y - ENV_H / 2 - 80, s: 0.44 }

/**
 * The sealing stage at SEAL: the card (from `from`, lifted by `lift`) tucks into the envelope,
 * the flap folds, the lock stamps, the mono label shows, then `arc` carries it into the crystal.
 */
export function SealStage({ from, lift, cardO = 1, tuck, envIn, fold, stamp, label, arc }: { from: { x: number; y: number; s: number }; lift: number; cardO?: number; tuck: number; envIn: number; fold: number; stamp: number; label: number; arc: number }) {
  const p = arc
  const ax = (1 - p) ** 2 * SEAL.x + 2 * (1 - p) * p * 780 + p * p * CRYSTAL_HOME.x
  const ay = (1 - p) ** 2 * SEAL.y + 2 * (1 - p) * p * 250 + p * p * CRYSTAL_HOME.y
  const card = tuck < 1 ? { x: lerp(from.x, HOVER.x, lift), y: lerp(from.y, HOVER.y, lift) + tuck * 260, s: lerp(from.s, HOVER.s, lift), o: cardO } : undefined
  return (
    <div style={{ position: "absolute", left: 0, top: 0, width: 1920, height: 1080 }}>
      <div style={{ position: "absolute", inset: 0, transform: `translate(${ax - SEAL.x}px, ${ay - SEAL.y}px)`, opacity: 1 - Math.max(0, (arc - 0.82) / 0.18) }}>
        <div style={{ position: "absolute", inset: 0, transformOrigin: `${SEAL.x}px ${SEAL.y}px`, transform: `scale(${lerp(1, 0.1, arc)}) rotate(${-8 * arc}deg)` }}>
          <EnvelopeAt cx={SEAL.x} cy={SEAL.y} o={envIn} flap={-1 + 2 * fold} fill={1} stamp={stamp} card={card} />
        </div>
      </div>
      <div style={{ position: "absolute", left: SEAL.x - 320, top: SEAL.y + ENV_H / 2 + 26, width: 640, textAlign: "center", fontFamily: mono, fontSize: 20, color: C.ink, opacity: label, transform: `translateY(${(1 - label) * 6}px)` }}>
        sealed · <span style={{ color: C.lav300 }}>Kn0bVgYS…E0Y=</span>
      </div>
    </div>
  )
}
