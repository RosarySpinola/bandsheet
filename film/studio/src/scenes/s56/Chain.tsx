import type { ReactNode } from "react"
import { useCurrentFrame } from "remotion"
import { C, sans, serif, ease, easeInOut } from "../../tokens"
import { B5 } from "./beats"
import { PROPOSAL } from "./data"
import { mono } from "./fonts"
import { prog, Type } from "./type"

/**
 * The call chain on "Two of three seats approve, the contract calls the enclave" (world = screen before the
 * crane). The seat tiles fold into the DAO node; the crystal itself is the enclave node.
 * Real names: Sputnik DAO act_proposal (VoteApprove) → bandsheet-3f36b7.testnet request_release →
 * outlayer.testnet request_execution (TDX) → OutLayer resumes the contract's callback on_release.
 */
export const CH = {
  top: 620, h: 150, mid: 695,
  a: { x: 150, w: 380 },
  b: { x: 690, w: 480 },
  cry: { x: 1520, y: 695, r: 80 },
  arcY: 560,
}
/** Seat squares inside the DAO node (the folded tiles land here). */
export const foldSquare = (i: number) => ({ x: CH.a.x + 26 + i * 38, y: CH.top + 100, size: 28 })

const FOLD_END = B5.fold + 16

function Arrow({ x0, x1, y, t }: { x0: number; x1: number; y: number; t: number }) {
  if (t <= 0) return null
  const x = x0 + (x1 - x0) * t
  return (
    <svg width={1920} height={1080} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
      <line x1={x0} y1={y} x2={x} y2={y} stroke={C.ink} strokeWidth={2} />
      <polyline points={`${x - 10},${y - 7} ${x},${y} ${x - 10},${y + 7}`} fill="none" stroke={C.ink} strokeWidth={2} opacity={t > 0.15 ? 1 : 0} />
    </svg>
  )
}

function Node({ x, w, t, children }: { x: number; w: number; t: number; children: ReactNode }) {
  return (
    <div style={{ position: "absolute", left: x, top: CH.top + 16 * (1 - t), width: w, height: CH.h, boxSizing: "border-box", border: `2px solid ${C.ink}`, background: C.paper, opacity: t }}>
      {children}
    </div>
  )
}

const Caps = ({ text, start }: { text: string; start: number }) => (
  <Type text={text} start={start} size={15} family={sans} weight={600} tracking={0.08} cps={0.4} color={C.gray350} />
)

export function Chain() {
  const f = useCurrentFrame()
  const aT = prog(f, B5.fold + 6, FOLD_END, ease)
  const bT = prog(f, B5.contract, B5.contract + 10, ease)
  const ab = prog(f, B5.contract - 4, B5.contract + 8, easeInOut)
  const bc = prog(f, B5.calls, B5.calls + 12, easeInOut)
  const back = prog(f, B5.callback, B5.callback + 18, easeInOut)
  const aR = CH.a.x + CH.a.w
  const bR = CH.b.x + CH.b.w
  const cL = CH.cry.x - CH.cry.r - 10
  // return path: up from the crystal, left along arcY, down into the contract node
  const bx = CH.b.x + CH.b.w / 2 + 40
  const seg = [CH.cry.y - CH.cry.r - 6 - CH.arcY, CH.cry.x - bx, CH.top - CH.arcY]
  const total = seg[0] + seg[1] + seg[2]
  const drawn = total * back
  return (
    <>
      {/* DAO node: the frame closes around the folded seats */}
      <div style={{ position: "absolute", left: CH.a.x, top: CH.top, width: CH.a.w, height: CH.h, boxSizing: "border-box", border: `2px solid ${C.ink}`, opacity: aT }} />
      <div style={{ position: "absolute", left: CH.a.x + 26, top: CH.top + 18 }}>
        {f >= B5.fold + 6 ? <Caps text="SPUTNIK DAO" start={B5.fold + 6} /> : null}
      </div>
      <div style={{ position: "absolute", left: CH.a.x + 24, top: CH.top + 42 }}>
        {f >= B5.fold + 8 ? <Type text={PROPOSAL} start={B5.fold + 8} size={34} family={serif} cps={0.6} /> : null}
      </div>
      <div style={{ position: "absolute", left: foldSquare(2).x + 44, top: CH.top + 101 }}>
        {f >= FOLD_END - 2 ? <Type text="2 of 3  ·  passed" start={FOLD_END - 2} size={19} family={sans} weight={400} cps={0.4} color={C.text} /> : null}
      </div>

      <Arrow x0={aR + 8} x1={CH.b.x - 8} y={CH.mid} t={ab} />
      <div style={{ position: "absolute", left: aR, width: CH.b.x - aR, top: CH.mid - 38, textAlign: "center" }}>
        {f >= B5.contract - 4 ? <Type text="act_proposal" start={B5.contract - 4} size={19} family={mono} weight={500} cps={0.4} tracking={0} /> : null}
      </div>

      <Node x={CH.b.x} w={CH.b.w} t={bT}>
        <div style={{ position: "absolute", left: 24, top: 16 }}>{f >= B5.contract ? <Caps text="BANDSHEET CONTRACT" start={B5.contract} /> : null}</div>
        <div style={{ position: "absolute", left: 24, top: 44 }}>
          {f >= B5.contract + 2 ? <Type text="bandsheet-3f36b7.testnet" start={B5.contract + 2} size={21} family={mono} weight={400} cps={0.35} tracking={0} color={C.text} /> : null}
        </div>
        <div style={{ position: "absolute", left: 24, top: 88 }}>
          {f >= B5.contract + 6 ? <Type text="request_release" start={B5.contract + 6} size={28} family={mono} weight={500} cps={0.4} tracking={0} /> : null}
        </div>
      </Node>

      <Arrow x0={bR + 8} x1={cL} y={CH.mid} t={bc} />
      <div style={{ position: "absolute", left: bR, width: cL - bR, top: CH.mid - 38, textAlign: "center" }}>
        {f >= B5.calls ? <Type text="request_execution" start={B5.calls} size={19} family={mono} weight={500} cps={0.4} tracking={0} /> : null}
      </div>
      <div style={{ position: "absolute", left: CH.cry.x - 200, width: 400, top: CH.cry.y + CH.cry.r + 14, textAlign: "center" }}>
        {f >= B5.enclave ? <Type text="OutLayer TDX enclave" start={B5.enclave} size={20} family={sans} weight={600} cps={0.4} /> : null}
      </div>

      {/* resume: OutLayer hands the result back to the contract's callback */}
      {back > 0 ? (
        <svg width={1920} height={1080} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
          <polyline
            points={`${CH.cry.x},${CH.cry.y - CH.cry.r - 6} ${CH.cry.x},${CH.arcY} ${bx},${CH.arcY} ${bx},${CH.top - 8}`}
            fill="none" stroke={C.lav300} strokeWidth={2.5} strokeDasharray={`${drawn} ${total + 20}`}
          />
          <polyline points={`${bx - 7},${CH.top - 18} ${bx},${CH.top - 8} ${bx + 7},${CH.top - 18}`} fill="none" stroke={C.lav300} strokeWidth={2.5} opacity={back > 0.95 ? 1 : 0} />
        </svg>
      ) : null}
      <div style={{ position: "absolute", left: bx, width: CH.cry.x - bx, top: CH.arcY - 34, textAlign: "center" }}>
        {f >= B5.callback + 4 ? <Type text="resume  ·  callback on_release" start={B5.callback + 4} size={17} family={mono} weight={500} cps={0.4} tracking={0} color={C.lav300} from={C.lav} /> : null}
      </div>
    </>
  )
}
