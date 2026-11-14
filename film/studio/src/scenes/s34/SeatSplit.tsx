import { interpolate } from "remotion"
import { C } from "../../tokens"
import { outQuint } from "./beats"
import { Seat } from "./VoteInset"

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const

/** T4 end pose (documented in HANDOFF.md). Light line from the crystal's base to a bus, three drops, three tiles. */
export const SPLIT = {
  lineTop: 362, // crystal base at its T4 end pose (y 250, r 112)
  bus: 560,
  tileTop: 620,
  tileW: 300,
  tileH: 150,
  xs: [600, 960, 1320],
}

const glow = `0 0 14px ${C.lav}, 0 0 4px ${C.lav300}`

/** `line`, `split`, `tiles` are 0→1 progress for the drop, the branch, and the tiles. */
export function SeatSplit({ f, line, split, tiles }: { f: number; line: [number, number]; split: [number, number]; tiles: [number, number] }) {
  const l = interpolate(f, line, [0, 1], { ...clamp, easing: outQuint })
  const s = interpolate(f, split, [0, 1], { ...clamp, easing: outQuint })
  if (l <= 0) return null
  const half = (SPLIT.xs[2] - SPLIT.xs[0]) / 2
  const drop = SPLIT.tileTop - SPLIT.bus
  return (
    <>
      <div style={{ position: "absolute", left: 958, top: SPLIT.lineTop, width: 4, height: (SPLIT.bus - SPLIT.lineTop) * l, background: C.lav300, boxShadow: glow }} />
      {s > 0 ? (
        <>
          <div style={{ position: "absolute", left: 960 - half * s, top: SPLIT.bus - 2, width: half * 2 * s, height: 4, background: C.lav300, boxShadow: glow }} />
          {SPLIT.xs.map((x) => (
            <div key={x} style={{ position: "absolute", left: x - 2, top: SPLIT.bus, width: 4, height: drop * s, background: C.lav300, boxShadow: glow }} />
          ))}
        </>
      ) : null}
      {SPLIT.xs.map((x, i) => {
        const t = interpolate(f, [tiles[0] + i * 2, tiles[1]], [0, 1], { ...clamp, easing: outQuint })
        if (t <= 0) return null
        return (
          <div key={x} style={{ position: "absolute", left: x - SPLIT.tileW / 2, top: SPLIT.tileTop, opacity: t, transform: `scaleY(${0.3 + 0.7 * t})`, transformOrigin: "50% 0%" }}>
            <Seat n={i + 1} on={0} idle={false} w={SPLIT.tileW} h={SPLIT.tileH} big />
          </div>
        )
      })}
    </>
  )
}
