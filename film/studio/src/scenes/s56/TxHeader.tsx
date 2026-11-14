import { useCurrentFrame } from "remotion"
import { C, sans } from "../../tokens"
import { TX_HASH, txShort, TXH } from "./data"
import { mono } from "./fonts"
import { cl, mix, Type } from "./type"

/**
 * T5's travelling object (screen space). t=0: the strip tx at `from` (right-aligned, 26 px).
 * t=1: S6's header pose, full hash left-aligned at TXH. S6 frame 0 renders t=1 with the label typed.
 */
export function TxHeader({ t, from, labelStart, hide = 0, labelHide = 0 }: {
  t: number; from: { right: number; y: number; size: number }; labelStart: number; hide?: number; labelHide?: number
}) {
  const f = useCurrentFrame()
  const size = mix(from.size, TXH.size, t)
  const x = mix(from.right, TXH.x, t)
  const y = mix(from.y, TXH.hashY, t)
  // The elided middle unrolls glyph by glyph as the hash travels.
  const hidden = TX_HASH.length - 13
  const n = Math.round(cl((t - 0.3) / 0.55) * hidden)
  const text = TX_HASH.length <= 16 ? TX_HASH : n >= hidden ? TX_HASH : `${TX_HASH.slice(0, 8 + n)}…${TX_HASH.slice(-5)}`
  return (
    <div style={{ position: "absolute", inset: 0, opacity: 1 - hide }}>
      <div style={{ position: "absolute", left: TXH.x, top: TXH.labelY, opacity: 1 - labelHide }}>
        {f >= labelStart ? <Type text="Transaction  ·  release #3  ·  NEAR testnet" start={labelStart} size={TXH.labelSize} family={sans} weight={400} color={C.gray350} cps={0.4} /> : null}
      </div>
      <div
        style={{
          position: "absolute", left: x, top: y, transform: `translateX(${-100 * (1 - t)}%)`,
          fontFamily: mono, fontWeight: 500, fontSize: size, color: C.ink, whiteSpace: "pre", lineHeight: 1.15,
        }}
      >
        {text}
      </div>
    </div>
  )
}
