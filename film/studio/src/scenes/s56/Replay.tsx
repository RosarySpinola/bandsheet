import { useCurrentFrame } from "remotion"
import { C, sans, serif, ease, easeInOut } from "../../tokens"
import { crystalPose, GHOST_AT, GHOST_LEN } from "./Engine"
import { mix, prog } from "./type"

/** The two earlier releases as recorded on chain (bandsheet.pages.dev/api/releases): mean pay by grade. */
const EARLIER = [
  { title: "Release #1", cells: [["Junior", 30713], ["Reporter", 43000], ["Senior", 62400], ["Editor", 81780], ["Chief", 109333]] },
  { title: "Release #2", cells: [["Junior", 30713], ["Reporter", 43000], ["Senior", null], ["Editor", 81780], ["Chief", 109333]] },
] as const
const W = 260
const ROW = 19

function Mini({ i }: { i: number }) {
  const r = EARLIER[i]
  return (
    <div style={{ width: W, boxSizing: "border-box", border: `2px solid ${C.ink}`, background: C.paper, padding: "12px 16px 14px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span style={{ fontFamily: serif, fontWeight: 500, fontSize: 24, color: C.ink }}>{r.title}</span>
        <span style={{ fontFamily: sans, fontSize: 12, fontWeight: 600, letterSpacing: "0.08em", color: C.gray350 }}>ON CHAIN</span>
      </div>
      <div style={{ height: 2, background: C.ink, margin: "8px 0 6px" }} />
      {r.cells.map(([g, m]) => (
        <div key={g} style={{ display: "flex", alignItems: "center", height: ROW, gap: 10 }}>
          <span style={{ width: 62, fontFamily: sans, fontSize: 12, color: C.text }}>{g}</span>
          {m === null ? (
            <span style={{ width: 70, height: 9, boxSizing: "border-box", border: `1.5px dashed ${C.lav300}`, background: "rgba(205,194,255,0.25)" }} />
          ) : (
            <span style={{ width: (m / 115000) * 150, height: 9, background: C.ink }} />
          )}
        </div>
      ))}
    </div>
  )
}

/**
 * "replays every earlier table": release #1, then release #2, fall into the crystal on their words.
 * World coordinates, keyed to the crystal's pose so they ride the crane with it.
 */
export function Replay({ dy }: { dy: number }) {
  const f = useCurrentFrame()
  return (
    <>
      {GHOST_AT.map((at, i) => {
        if (f < at - 12 || f > at + GHOST_LEN + 1) return null
        const p = crystalPose(f, dy)
        const inT = prog(f, at - 12, at - 2, ease)
        const d = prog(f, at - 2, at + GHOST_LEN, easeInOut)
        const s = mix(1, 0.16, d)
        const lift = mix(330, 0, d) + 24 * (1 - inT)
        return (
          <div key={i} style={{ position: "absolute", left: p.x - W / 2 + (i ? 14 : -14) * (1 - d), top: p.y - lift - 90, width: W, opacity: inT * (1 - prog(f, at + GHOST_LEN - 5, at + GHOST_LEN)), transform: `scale(${s})`, transformOrigin: "50% 90px" }}>
            <Mini i={i} />
          </div>
        )
      })}
    </>
  )
}
