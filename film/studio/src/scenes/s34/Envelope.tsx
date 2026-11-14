import type { ReactNode } from "react"
import { C } from "../../tokens"

export const ENV_W = 420
export const ENV_H = 280

/** Square-cornered lock glyph, the landing page's privacy lock (lavender to green). */
export function LockGlyph({ size = 64, id = "lk" }: { size?: number; id?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={C.lav} />
          <stop offset="1" stopColor={C.lav300} />
        </linearGradient>
      </defs>
      <path d="M20 28 V19 a12 12 0 0 1 24 0 V28" fill="none" stroke={C.green} strokeWidth={6} />
      <rect x={10} y={27} width={44} height={33} fill={`url(#${id})`} stroke={C.ink} strokeWidth={2} />
      <circle cx={32} cy={41} r={4.5} fill={C.ink} />
      <rect x={30} y={42} width={4} height={10} fill={C.ink} />
    </svg>
  )
}

/**
 * Envelope at 420×280 (scale it from outside). `flap`: -1 fully open (tip up), 1 closed.
 * `fill`: white body opacity. `card` renders between the open flap and the body so it can
 * slide down behind the body. `stamp` (0→1+) scales the lock in with overshoot already applied.
 */
export function Envelope({ flap = 1, fill = 1, stroke = 1, sw = 2, pocket = 1, card, stamp = 0, stampOpacity = 1 }: { flap?: number; fill?: number; stroke?: number; sw?: number; pocket?: number; card?: ReactNode; stamp?: number; stampOpacity?: number }) {
  const tip = flap * (ENV_H * 0.55)
  const flapPath = `M1 1 L${ENV_W / 2} ${tip} L${ENV_W - 1} 1`
  const flapShape = (
    <svg width={ENV_W} height={ENV_H} viewBox={`0 0 ${ENV_W} ${ENV_H}`} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
      <path d={flapPath} fill={`rgba(255,255,255,${fill})`} stroke={C.ink} strokeOpacity={stroke} strokeWidth={sw} strokeLinejoin="miter" />
    </svg>
  )
  return (
    <div style={{ position: "relative", width: ENV_W, height: ENV_H }}>
      {flap < 0 ? flapShape : null}
      {card}
      <svg width={ENV_W} height={ENV_H} viewBox={`0 0 ${ENV_W} ${ENV_H}`} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
        <rect x={1} y={1} width={ENV_W - 2} height={ENV_H - 2} fill={`rgba(255,255,255,${fill})`} stroke={C.ink} strokeOpacity={stroke} strokeWidth={sw} />
        <path d={`M1 ${ENV_H - 1} L${ENV_W * 0.4} ${ENV_H * 0.52} M${ENV_W - 1} ${ENV_H - 1} L${ENV_W * 0.6} ${ENV_H * 0.52}`} stroke={C.ink} strokeOpacity={stroke * 0.35 * pocket} strokeWidth={sw} fill="none" />
      </svg>
      {flap >= 0 ? flapShape : null}
      {stamp > 0 ? (
        <div style={{ position: "absolute", left: ENV_W / 2 - 40, top: ENV_H * 0.55 - 40, transform: `scale(${stamp})`, opacity: stampOpacity }}>
          <LockGlyph size={80} id="env-lock" />
        </div>
      ) : null}
    </div>
  )
}
