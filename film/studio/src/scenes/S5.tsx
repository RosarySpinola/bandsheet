import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion"
import { C, sans, serif, ease, easeInOut } from "../tokens"
import { S4Tail, Seats, FOLD } from "./s56/Seats"
import { Chain } from "./s56/Chain"
import { Ledger } from "./s56/Ledger"
import { Beams, CRANE, Engine } from "./s56/Engine"
import { Replay } from "./s56/Replay"
import { F3Frame, FR_FOCUS, FR_TX } from "./s56/F3Frame"
import { Proof, RecordStrip, STRIP_TX } from "./s56/Proof"
import { TxHeader } from "./s56/TxHeader"
import { B5, S5_DUR } from "./s56/beats"
import { PROPOSAL, USE_F3 } from "./s56/data"
import { cam, camOrigin, mix, prog, Type } from "./s56/type"

/**
 * S5 · Vote + release (N8 + N9). One world, one camera, S4's crystal carried through. Every beat is a word
 * (s56/beats.ts): the seats approve on "Two of three" → they fold into the DAO node and the call chain draws
 * (act_proposal → request_release → OutLayer TDX enclave → resume, on "the contract calls the enclave") →
 * the camera cranes down to the ledger while the earlier releases fall into the crystal ("replays every
 * earlier table") → a scan runs the cells ("solves the attacker's equations") → beams become four bars,
 * Senior's is taken back ("withholds") → travel onto the real record (F3, "writes why to NEAR") → the
 * witness, underlined ("exact subtraction") → T5: the record's tx enlarges into S6's header.
 */
const DY = 1080 // the ledger sits one frame below the vote
const TX_OUT = S5_DUR - 21
const CLAMP = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const
const TX = USE_F3 ? FR_TX : { right: STRIP_TX.right, y: STRIP_TX.y, size: STRIP_TX.size }
const END = USE_F3 ? { x: FR_FOCUS.x, y: DY + FR_FOCUS.y } : { x: 960, y: DY + 540 }
/** The heading rises clear of the call chain as the seats fold. */
const RAISE: [number, number] = [FOLD[0], FOLD[0] + 20]

function camera(f: number) {
  const [c0, c1] = CRANE
  const crane = prog(f, c0, c1, easeInOut)
  // vote and chain: a slow push, settling on the chain row as it draws
  let s = interpolate(f, [0, c0], [1, 1.03], CLAMP)
  if (f >= c0) s = interpolate(f, [c0, (c0 + c1) / 2, c1], [1.03, 0.92, 1], { ...CLAMP, easing: easeInOut })
  const settle = prog(f, FOLD[0], B5.enclave, easeInOut)
  let fx = mix(960, 800, crane)
  let fy = mix(mix(540, 572, settle), DY + 470, crane)
  // push in on the Senior row as it is withheld, then travel onto the release record
  const push = prog(f, B5.withholds + 4, B5.withholds + 34, easeInOut)
  const travel = prog(f, B5.writes - 8, B5.writes + 24, easeInOut)
  fx = mix(mix(fx, 760, push), END.x, travel)
  fy = mix(mix(fy, DY + 520, push), END.y, travel)
  if (f >= c1) s = mix(mix(1, 1.06, push), 1, travel)
  // T5 dolly toward the tx
  const d = prog(f, TX_OUT, TX_OUT + 20, easeInOut)
  return { fx: mix(fx, TX.right - 120, d), fy: mix(fy, DY + TX.y + 14, d), s: s * mix(1, 1.4, d) }
}

/** The heading survives the crane: centred above the seats → raised over the chain → the ledger's heading. */
function Heading() {
  const f = useCurrentFrame()
  const r = prog(f, RAISE[0], RAISE[1], easeInOut)
  const t = prog(f, CRANE[0] + 2, CRANE[1], easeInOut)
  const y0 = mix(436, 352, r)
  const k = mix(mix(1, 0.86, r), 0.86, t)
  return (
    <div style={{ position: "absolute", left: mix(960, 120, t), top: mix(y0, DY + 120, t), transform: `translateX(${-50 * (1 - t)}%)` }}>
      <div style={{ transform: `scale(${k})`, transformOrigin: `${50 * (1 - t)}% 50%` }}>
        <Type text="Release #3" start={B5.heading} size={66} family={serif} cps={0.9} />
        <Type text="  ·  mean pay by grade" start={B5.heading + 10} size={66} family={serif} cps={0.7} />
      </div>
    </div>
  )
}

export function S5() {
  const f = useCurrentFrame()
  const c = camera(f)
  const worldFade = 1 - prog(f, TX_OUT + 2, TX_OUT + 14, ease)
  const chainOut = 1 - prog(f, CRANE[0] + 2, CRANE[0] + 20)
  // Record tx in screen space at the moment it detaches (camera at TX_OUT).
  const c0 = camera(TX_OUT)
  const from = { right: 960 + (TX.right - c0.fx) * c0.s, y: 540 + (DY + TX.y - c0.fy) * c0.s, size: TX.size * c0.s }
  const t = prog(f, TX_OUT + 2, TX_OUT + 20, easeInOut)
  return (
    <AbsoluteFill style={{ background: C.paper, overflow: "hidden" }}>
      <AbsoluteFill style={{ transform: cam(c.fx, c.fy, c.s), transformOrigin: camOrigin(c.fx, c.fy), opacity: worldFade }}>
        <Engine dy={DY} />
        <div style={{ position: "absolute", left: 0, width: 1920, top: 384, textAlign: "center", opacity: 1 - prog(f, FOLD[0], FOLD[0] + 10) }}>
          {f >= B5.kicker ? <Type text={`${PROPOSAL}  ·  chapel vote  ·  Sputnik DAO on NEAR testnet`} start={B5.kicker} size={22} family={sans} weight={400} color={C.gray350} cps={0.4} /> : null}
        </div>
        <div style={{ position: "absolute", inset: 0, opacity: chainOut }}>
          <Seats appear={2} />
          <S4Tail />
          <Chain />
        </div>
        <Heading />
        <div style={{ position: "absolute", left: 120, top: DY + 196 }}>
          {f >= CRANE[1] - 4 ? <Type text="Requested by the chapel DAO  ·  4 cells published  ·  1 withheld" start={CRANE[1] - 4} size={22} family={sans} weight={400} color={C.gray350} cps={0.35} /> : null}
        </div>
        <Ledger top={DY} />
        <Replay dy={DY} />
        <Beams top={DY} />
        {USE_F3 ? (
          <F3Frame top={DY} start={B5.writes - 4} txOut={TX_OUT} />
        ) : (
          <>
            <Proof top={DY} start={B5.writes - 4} />
            <RecordStrip top={DY} start={B5.writes + 8} txOut={TX_OUT} />
          </>
        )}
      </AbsoluteFill>
      {f >= TX_OUT ? <TxHeader t={t} from={from} labelStart={TX_OUT + 8} /> : null}
    </AbsoluteFill>
  )
}
