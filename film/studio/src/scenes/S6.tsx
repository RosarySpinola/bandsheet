import { AbsoluteFill, useCurrentFrame } from "remotion"
import { C, sans, ease, easeInOut } from "../tokens"
import { TxHeader } from "./s56/TxHeader"
import { Grids } from "./s56/Grids"
import { Terminal, TT } from "./s56/Terminal"
import { Cells } from "./s56/Cells"
import { Attack } from "./s56/Attack"
import { B6 } from "./s56/beats"
import { TXH } from "./s56/data"
import { cam, camOrigin, mix, prog, Type } from "./s56/type"

/**
 * S6 · Proof (N10). Every beat is a word (s56/beats.ts). Opens on T5's tx header (the release #3 vote tx), which
 * states what it did and compacts to a page header → two 10×10 evaluation grids, 95 vs 0 → Bandsheet's dots
 * unfold into the 1,265 cells, 931 still published ("nearly three cells in four") → lateral slide into the
 * `pnpm verify` terminal (19 real PASS lines, 19/19 on "nineteen claims") → T6: the terminal becomes the app
 * sidebar beside the live /unit/attack page ("try the subtraction yourself"), then clears for S7.
 */
const FACTS: [string, string][] = [
  ["Status", "Success"],
  ["Method", "act_proposal · VoteApprove"],
  ["Receiver", "harbour-chapel.sputnik-v2.testnet"],
  ["Then", "OutLayer TDX run → bandsheet-3f36b7.testnet · release #3 recorded"],
]

function camera(f: number) {
  const slide = prog(f, B6.trust - 2, B6.trust + 20, easeInOut)
  const drift = 24 * prog(f, B6.generated, B6.trust, ease)
  // A slow push on the 19 lines while "against the chain" is said, then back to rest for the sidebar morph.
  const linger = prog(f, B6.nineteen, B6.claims + 24, easeInOut) * (1 - prog(f, TT.morph0 - 6, TT.morph0 + 2, easeInOut))
  return { fx: mix(960 + drift, 2880, slide), fy: mix(540, 520, linger), s: mix(1, 1.06, linger) }
}

function Header() {
  const f = useCurrentFrame()
  const c0 = B6.generated - 4 // compaction to the page header, as the cards arrive
  const k = prog(f, c0, c0 + 14, easeInOut)
  const factsOut = 1 - prog(f, c0 - 2, c0 + 6)
  return (
    <>
      <div style={{ position: "absolute", inset: 0, transformOrigin: `${TXH.x}px ${TXH.labelY}px`, transform: `translateY(${mix(0, -78, k)}px) scale(${mix(1, 0.5, k)})` }}>
        <TxHeader t={1} from={{ right: 0, y: 0, size: 0 }} labelStart={-13} labelHide={prog(f, c0 - 2, c0 + 6)} />
      </div>
      <div style={{ position: "absolute", left: TXH.x, top: TXH.hashY + 110, display: "grid", gridTemplateColumns: "150px auto", rowGap: 18, opacity: factsOut }}>
        {FACTS.map(([k2, v], i) => (
          <div key={k2} style={{ display: "contents" }}>
            <div style={{ fontFamily: sans, fontSize: 16, fontWeight: 600, letterSpacing: "0.08em", color: C.gray350, paddingTop: 6, opacity: prog(f, i * 3, 5 + i * 3) }}>{k2.toUpperCase()}</div>
            <div>
              {i === 0 ? (
                <span style={{ display: "inline-block", background: C.ink, color: "#fff", fontFamily: sans, fontSize: 20, padding: "4px 12px", opacity: prog(f, 2, 7) }}>{v}</span>
              ) : (
                <Type text={v} start={2 + i * 3} size={i === 3 ? 26 : 24} family={sans} weight={i === 3 ? 600 : 400} cps={0.18} color={i === 3 ? C.ink : C.text} />
              )}
            </div>
          </div>
        ))}
      </div>
      {/* the status survives compaction as one line beside the hash */}
      <div style={{ position: "absolute", left: 980, top: 100, display: "flex", alignItems: "center", gap: 14, whiteSpace: "pre" }}>
        <span style={{ background: C.ink, color: "#fff", fontFamily: sans, fontSize: 17, padding: "3px 10px", opacity: prog(f, c0 + 14, c0 + 18) }}>Success</span>
        <Type text="act_proposal · VoteApprove  ·  OutLayer TDX run → release #3 recorded" start={c0 + 16} size={20} family={sans} weight={400} cps={0.2} color={C.text} />
      </div>
    </>
  )
}

export function S6() {
  const f = useCurrentFrame()
  const c = camera(f)
  return (
    <AbsoluteFill style={{ background: C.paper, overflow: "hidden" }}>
      <AbsoluteFill style={{ transform: cam(c.fx, c.fy, c.s), transformOrigin: camOrigin(c.fx, c.fy) }}>
        <Header />
        <Grids />
        <Cells />
        <Terminal />
        <Attack />
      </AbsoluteFill>
    </AbsoluteFill>
  )
}
