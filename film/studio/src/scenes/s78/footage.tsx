import { Freeze, OffthreadVideo, staticFile } from "remotion"
import { C, sans } from "../../tokens"
import { S7B } from "./beats"
import { CROP_TOP, FRAME, K, VIEW_H } from "./camera"
import { AnswerPanel } from "./stand"

/**
 * Real app footage F6 (/unit/stand: €41,000, Reporter, "Ask privately" → "Thinking it through inside NEAR AI Cloud's
 * enclave" → answer). Source frames: thinking from ≤100, answer arrives at 148, the page starts to scroll at ~223.
 * We play 100→218 so source 148 lands on "stand", then hold 218 (before the scroll). From 148 the recreated panel
 * (stand.tsx) sits exactly over the real one, so the footage's mislabelled (EU-wide) median text never shows.
 */
const F6 = { from: 100, answer: 148, last: 218 }
const START = S7B.standIn - (F6.answer - F6.from)

/** Our own neutral browser frame, in world coordinates under the chat card. */
export function FootageFrame({ f }: { f: number }) {
  const src = Math.max(F6.from, Math.min(F6.last, F6.from + (f - START)))
  return (
    <div
      style={{
        position: "absolute",
        left: FRAME.x,
        top: FRAME.y,
        width: FRAME.w + 2 * FRAME.border,
        border: `${FRAME.border}px solid ${C.ink}`,
        boxSizing: "border-box",
        background: C.paper,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          height: FRAME.bar,
          display: "flex",
          alignItems: "center",
          gap: 16,
          padding: "0 18px",
          background: C.band,
          borderBottom: `2px solid ${C.ink}`,
          boxSizing: "border-box",
        }}
      >
        <div style={{ display: "flex", gap: 7 }}>
          {[0, 1, 2].map((i) => (
            <span key={i} style={{ width: 10, height: 10, border: `2px solid ${C.gray350}`, display: "inline-block" }} />
          ))}
        </div>
        <div style={{ fontFamily: sans, fontSize: 17, color: C.gray350 }}>bandsheet.pages.dev/unit/stand</div>
      </div>
      <div style={{ position: "relative", height: VIEW_H, overflow: "hidden" }}>
        <div style={{ position: "absolute", left: 0, top: -CROP_TOP * K, width: 1920, height: 1080, transform: `scale(${K})`, transformOrigin: "0 0" }}>
          <Freeze frame={src}>
            <OffthreadVideo src={staticFile("footage/F6.mp4")} muted style={{ position: "absolute", left: 0, top: 0, width: 1920, height: 1080 }} />
          </Freeze>
          {src >= F6.answer - 1 ? <AnswerPanel f={f} /> : null}
        </div>
      </div>
    </div>
  )
}
