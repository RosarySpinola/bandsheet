import { AbsoluteFill, Sequence, interpolate, useCurrentFrame } from "remotion"
import { C, ease } from "../tokens"
import { Paper } from "../lib/paper"
import { sceneById } from "../timeline"
import { Receipt } from "../scenes/s34/Receipt"
import { S4 } from "../scenes/S4"
import { S5 } from "../scenes/S5"
import { S7 } from "../scenes/S7"
import { Grids } from "../scenes/s56/Grids"
import { Cells } from "../scenes/s56/Cells"
import { Terminal } from "../scenes/s56/Terminal"
import { B6 } from "../scenes/s56/beats"
import { cam, camOrigin, prog } from "../scenes/s56/type"
import { camera7 } from "../scenes/s78/camera"
import { ChatCard } from "../scenes/s78/chat"
import { CONTENT } from "./Frame"
import { TAKE_FROM, type Insert } from "./segments"

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const
const FADE = 10
/** Where the receipt opens from: the take's Verified panel on screen (content-relative fractions). */
export const RECEIPT_FROM = { fx: 0.59, fy: 0.77, fw: 0.28, fh: 0.23 }

/** Mount a v3 scene so it plays its own word-pinned frames (local = absolute − scene start). */
function SceneAt({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <Sequence from={sceneById(id).from - TAKE_FROM} layout="none">
      {children}
    </Sequence>
  )
}

/** S6's grids and cells without its tx header; S6's camera before the terminal slide (s56 HANDOFF). */
function GridsOnly() {
  const f = useCurrentFrame()
  const fx = 960 + 24 * prog(f, B6.generated, B6.trust, ease)
  return (
    <AbsoluteFill style={{ background: C.paper, overflow: "hidden" }}>
      <AbsoluteFill style={{ transform: cam(fx, 540, 1), transformOrigin: camOrigin(fx, 540) }}>
        <Grids />
        <Cells />
      </AbsoluteFill>
    </AbsoluteFill>
  )
}

/** S6's terminal, framed as S6 frames it after the slide. */
function TerminalOnly() {
  const f = useCurrentFrame()
  const s = 1 + 0.06 * prog(f, B6.nineteen, B6.claims + 24)
  return (
    <AbsoluteFill style={{ background: C.paper, overflow: "hidden" }}>
      <AbsoluteFill style={{ transform: cam(2880, 540, s), transformOrigin: camOrigin(2880, 540) }}>
        <Terminal />
      </AbsoluteFill>
    </AbsoluteFill>
  )
}

/** The MCP chat card on S7's camera, without the app-sidebar stand-in or the old stand footage. */
function ChatOnly() {
  const f = useCurrentFrame()
  return (
    <Paper camera={camera7(f)}>
      <ChatCard f={f} />
    </Paper>
  )
}

function Body({ kind, abs }: { kind: Insert["kind"]; abs: number }) {
  switch (kind) {
    case "receipt": {
      const from = { x: CONTENT.x + CONTENT.w * RECEIPT_FROM.fx, y: CONTENT.y + CONTENT.h * RECEIPT_FROM.fy, w: CONTENT.w * RECEIPT_FROM.fw, h: CONTENT.h * RECEIPT_FROM.fh }
      return <Receipt abs={abs} from={from} dx={0} />
    }
    case "forgery":
      return <SceneAt id="S4"><S4 /></SceneAt>
    case "chain":
      return <SceneAt id="S5"><S5 /></SceneAt>
    case "grids":
      return <SceneAt id="S6"><GridsOnly /></SceneAt>
    case "terminal":
      return <SceneAt id="S6"><TerminalOnly /></SceneAt>
    case "mcp":
      return <SceneAt id="S7"><ChatOnly /></SceneAt>
    case "close":
      return <SceneAt id="S7"><S7 /></SceneAt>
  }
}

/**
 * An explainer insert over the frozen take: paper and the insert fade in over the held frame and fade out to
 * reveal the same frame. The receipt grows out of the take's Verified panel instead of fading.
 * `close` never fades out: S7's tail (letter → signature → shard fan) hands off to S8 at 3621.
 */
export function InsertLayer({ n, abs }: { n: Insert; abs: number }) {
  if (abs < n.from || abs >= n.to) return null
  const fin = interpolate(abs, [n.from, n.from + FADE], [0, 1], { ...clamp, easing: ease })
  const fout = n.kind === "close" ? 1 : interpolate(abs, [n.to - FADE, n.to], [1, 0], { ...clamp, easing: ease })
  const paper = n.kind === "receipt" ? Math.min(interpolate(abs, [n.from + 2, n.from + 18], [0, 1], clamp), fout) : Math.min(fin, fout)
  const body = n.kind === "receipt" ? fout : Math.min(fin, fout)
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ background: C.paper, opacity: paper }} />
      <AbsoluteFill style={{ opacity: body }}>
        <Body kind={n.kind} abs={abs} />
      </AbsoluteFill>
    </AbsoluteFill>
  )
}
