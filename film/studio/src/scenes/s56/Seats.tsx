import { interpolateColors, useCurrentFrame } from "remotion"
import { C, sans, easeInOut } from "../../tokens"
import { SEATS } from "./data"
import { mono } from "./fonts"
import { B5 } from "./beats"
import { foldSquare } from "./Chain"
import { cl, mix, prog, Type } from "./type"
import { SPLIT } from "../s34/SeatSplit"
import { Seat } from "../s34/VoteInset"

/** Tiles take S4's T4 end pose (s34/SeatSplit SPLIT) so the cut is seamless. */
export const TILE = { w: SPLIT.tileW, h: SPLIT.tileH, y: SPLIT.tileTop }
export const tileX = (i: number) => SPLIT.xs[i] - TILE.w / 2

/** S4's last frame (light bus, three drops, plain seat tiles) dissolving into S5's tiles over 14 f. */
export function S4Tail() {
  const f = useCurrentFrame()
  const o = 1 - prog(f, 0, 14)
  if (o <= 0) return null
  const glow = `0 0 14px ${C.lav}, 0 0 4px ${C.lav300}`
  const half = (SPLIT.xs[2] - SPLIT.xs[0]) / 2
  return (
    <div style={{ position: "absolute", inset: 0, opacity: o }}>
      <div style={{ position: "absolute", left: 958, top: SPLIT.lineTop, width: 4, height: SPLIT.bus - SPLIT.lineTop, background: C.lav300, boxShadow: glow }} />
      <div style={{ position: "absolute", left: 960 - half, top: SPLIT.bus - 2, width: half * 2, height: 4, background: C.lav300, boxShadow: glow }} />
      {SPLIT.xs.map((x, i) => (
        <div key={x}>
          <div style={{ position: "absolute", left: x - 2, top: SPLIT.bus, width: 4, height: SPLIT.tileTop - SPLIT.bus, background: C.lav300, boxShadow: glow }} />
          <div style={{ position: "absolute", left: x - TILE.w / 2, top: TILE.y }}>
            <Seat n={i + 1} on={0} idle={false} w={TILE.w} h={TILE.h} big />
          </div>
        </div>
      ))}
    </div>
  )
}
/** Local frames at which seats 1 and 2 approve: "Two of three seats". */
export const APPROVE = [B5.approve1, B5.approve2]
/** The tiles fold into the DAO node's seat squares on "approve, the contract". */
export const FOLD: [number, number] = [B5.fold, B5.fold + 16]

function Check({ on }: { on: number }) {
  // on: 0..1 progress of the approve stamp
  const fill = cl(on * 2)
  const draw = cl(on * 2 - 0.6)
  return (
    <svg width={30} height={30} viewBox="0 0 30 30" style={{ position: "absolute", right: 18, top: 18, overflow: "visible" }}>
      <rect x={1} y={1} width={28} height={28} fill={interpolateColors(fill, [0, 1], ["#ffffff", C.ink])} stroke={C.ink} strokeWidth={2} transform={`translate(15 15) scale(${1 + 0.18 * Math.sin(Math.PI * fill)}) translate(-15 -15)`} />
      <polyline points="8,15.5 13,20.5 22,10" fill="none" stroke="#fff" strokeWidth={2.6} strokeLinecap="square" strokeDasharray={24} strokeDashoffset={24 * (1 - draw)} />
    </svg>
  )
}

/** Three council seat tiles (world coordinates): seats 1 and 2 approve, seat 3 idle; then they fold into the DAO node. */
export function Seats({ appear }: { appear: number }) {
  const f = useCurrentFrame()
  const k = prog(f, FOLD[0], FOLD[1], easeInOut)
  const inner = 1 - prog(f, FOLD[0], FOLD[0] + 6)
  const solid = prog(f, FOLD[0] + 8, FOLD[1])
  const tick = prog(f, FOLD[1] - 4, FOLD[1] + 6)
  return (
    <>
      {SEATS.map((s, i) => {
        const on = s.votes ? prog(f, APPROVE[i], APPROVE[i] + 12) : 0
        const borderC = s.votes ? interpolateColors(on, [0, 1], ["#c9d1ce", C.ink]) : k > 0.5 ? C.inactive : "#d6dbd9"
        const t0 = appear + i * 4
        const sq = foldSquare(i)
        const size = { left: mix(tileX(i), sq.x, k), top: mix(TILE.y, sq.y, k), width: mix(TILE.w, sq.size, k), height: mix(TILE.h, sq.size, k) }
        const bg = s.votes ? interpolateColors(solid, [0, 1], ["#ffffff", C.ink]) : "#ffffff"
        return (
          <div key={s.seat} style={{ position: "absolute", ...size, boxSizing: "border-box", border: `2px ${!s.votes && k > 0.5 ? "dashed" : "solid"} ${borderC}`, background: bg }}>
            <div style={{ opacity: inner }}>
              <div style={{ position: "absolute", left: 18, top: 16 }}>
                <Type text={s.seat} start={t0} size={17} family={sans} weight={600} tracking={0.06} />
              </div>
              <div style={{ position: "absolute", left: 18, top: 48 }}>
                <Type text={s.id} start={t0 + 6} size={15} family={mono} weight={400} color={C.gray350} cps={0.5} tracking={0} />
              </div>
              <div style={{ position: "absolute", left: 18, top: 100 }}>
                {s.votes ? (
                  f >= APPROVE[i] + 4 ? <Type text="Approved" start={APPROVE[i] + 4} size={23} family={sans} weight={400} /> : null
                ) : (
                  <Type text="Did not vote" start={t0 + 30} size={23} family={sans} weight={400} color={C.gray350} />
                )}
              </div>
              {s.votes ? (
                <Check on={on} />
              ) : (
                <div style={{ position: "absolute", right: 18, top: 18, width: 28, height: 28, border: `1.5px dashed ${C.inactive}`, opacity: cl((f - t0 - 8) / 8) }} />
              )}
            </div>
            {s.votes && tick > 0 ? (
              <svg width={sq.size} height={sq.size} viewBox="0 0 28 28" style={{ position: "absolute", left: -2, top: -2 }}>
                <polyline points="7,14.5 12,19.5 21,9" fill="none" stroke="#fff" strokeWidth={2.6} strokeLinecap="square" strokeDasharray={24} strokeDashoffset={24 * (1 - tick)} />
              </svg>
            ) : null}
          </div>
        )
      })}
    </>
  )
}
