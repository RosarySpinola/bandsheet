import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion"
import { C, ease } from "../tokens"
import { Paper } from "../lib/paper"
import { S7B, S7_DUR, FAN_TOTAL } from "./s78/beats"
import { camera7, toScreen, SIG_END_WORLD } from "./s78/camera"
import { ChatCard } from "./s78/chat"
import { FootageFrame } from "./s78/footage"
import { LetterCard, Signature } from "./s78/letter"
import { Sidebar } from "./s78/sidebar"
import { ShardFan } from "./s78/fan"

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const

/**
 * S7 Reach (3165–3621). S6's app sidebar retracts as the rep asks from Claude through the Bandsheet MCP tool; the real
 * explain_refusal answer arrives verbatim. The camera travels down to /unit/stand (F6 with the corrected Eurostat median
 * panel), then to the Article 7 letter. T7: the signature fans into shards.
 */
export function S7() {
  const f = useCurrentFrame()
  const cam = camera7(f)
  const fade = interpolate(f, [S7B.fadeOut, S7B.fadeOut + 16], [1, 0], { ...clamp, easing: ease })
  const draw = interpolate(f, [S7B.sign, S7B.sign + S7B.signLen], [0, 1], { ...clamp, easing: ease })
  const tint = interpolate(f, [S7B.t7 - 6, S7B.t7 + 10], [0, 1], clamp)
  const u = (f - S7B.t7) / FAN_TOTAL
  const tip = toScreen(SIG_END_WORLD, cam)
  return (
    <AbsoluteFill style={{ background: C.paper }}>
      <Paper camera={cam}>
        {f < S7B.travel1 + S7B.travel1Len + 4 ? <ChatCard f={f} /> : null}
        {f >= S7B.answer && f < S7B.travel2 + S7B.travel2Len + 4 ? <FootageFrame f={f} /> : null}
        {f >= S7B.letterIn - 2 ? <LetterCard f={f} fade={fade} /> : null}
        <Signature draw={draw} tint={tint} />
      </Paper>
      {f >= S7B.t7 ? <ShardFan u={u} start={tip} /> : null}
      <Sidebar f={f} />
    </AbsoluteFill>
  )
}

export const S7_LAST = S7_DUR - 1
