import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion"
import { C } from "../tokens"
import { AccessKey } from "./s34/AccessKey"
import { B4, CRYSTAL_HOME, PAN, S4_FROM, entryPulse, inOut, outBack, outQuint, panAt, prog } from "./s34/beats"
import { CrystalCanvas } from "./s34/Crystal"
import { Forgery } from "./s34/Forgery"
import { Receipt, receiptRect } from "./s34/Receipt"
import { HOVER, SealStage } from "./s34/SealEnvelope"
import { SeatSplit } from "./s34/SeatSplit"
import { Counter, Stream, arrivals } from "./s34/Stream"
import { KeyChip, VoteInset } from "./s34/VoteInset"

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const
const DEG = Math.PI / 180
const accel = Easing.bezier(0.55, 0, 0.8, 0.35)

/**
 * Crystal screen pose per frame. One continuous camera: home while the entry is sealed and lands; right
 * for the member key; centre-right for the signed card; centre-left for the trust vote; right of the big
 * forged card; then up to the T4 end pose (x 960, y 250, r 112) above the three seat tiles.
 */
const KEYS = [0, B4.keyIn[0] - 12, B4.keyIn[0] + 18, B4.keyOut[0], B4.cardIn[1], B4.park[0], B4.park[1] + 2, B4.chip[1], B4.cardBack[1] + 6, B4.rise[0], B4.rise[1]]
const PX = [960, 960, 1390, 1390, 1290, 1290, 800, 800, 1330, 1330, 960]
const PY = [CRYSTAL_HOME.y, CRYSTAL_HOME.y, 470, 470, 480, 480, 470, 470, 470, 470, 250]
const PR = [CRYSTAL_HOME.r, CRYSTAL_HOME.r, 210, 210, 214, 214, 190, 190, 210, 210, 112]
function pose(f: number) {
  const o = { ...clamp, easing: inOut }
  return { x: interpolate(f, KEYS, PX, o), y: interpolate(f, KEYS, PY, o), r: interpolate(f, KEYS, PR, o) }
}

/** Short lavender flashes: the sealed entry, each streamed arrival, the trusted key, the forgery hitting. */
function pulseAt(f: number) {
  const hit = (a: number, k = 7) => (f >= a ? Math.exp(-(f - a) / k) : 0)
  const entries = arrivals.reduce((m, a) => Math.max(m, hit(a - 2) * 0.7), 0)
  return Math.min(1, Math.max(entryPulse(f), entries, hit(B4.chip[1] - 2, 8) * 0.9, hit(B4.fly[1], 5), hit(B4.bounce[0], 5) * 0.6))
}

/**
 * S4 · Seal, key, forgery. N6: the pan lands on the station, the card tucks in, the lock stamps on "sealed",
 * and the envelope arcs into the crystal as it resolves ("…inside an OutLayer enclave"). The member's access
 * key (FunctionCall · ["submit"] · member pays 0) sends entries in; "a newer payslip" types the real
 * replaced:true log and the count stays 38. N7: Ingrid's signed card (caret at the digit, DKIM line), the
 * chapel's trust vote, the trusted key into the crystal, then her real forgery: 4 → 6, held on "enclave"
 * (dkim_bad_signature, 37 verified · 1 refused), thrown out; T4 to three seat tiles.
 */
export function S4() {
  const f = useCurrentFrame()
  const abs = S4_FROM + f
  const p = pose(f)
  const pan = panAt(abs)
  const orbit = interpolate(f, [B4.arc[1], B4.cardBack[1]], [0, 20 * DEG], { ...clamp, easing: inOut })
  const fan = prog(f, B4.fan) * (1 - prog(f, [B4.rise[0], B4.rise[0] + 14]))
  const recoil = f >= B4.bounce[0] ? Math.exp(-(f - B4.bounce[0]) / 6) * Math.sin((f - B4.bounce[0]) * 0.9) * 10 : 0
  const crystalIn = prog(f, B4.crystalIn, outQuint)
  const stamp = interpolate(f, B4.stamp, [0, 1], { ...clamp, easing: outBack })
  const label = prog(f, B4.sealLabel) * (1 - prog(f, [B4.crystalIn[0] + 2, B4.crystalIn[0] + 14]))

  return (
    <AbsoluteFill style={{ background: C.paper }}>
      {f >= B4.crystalIn[0] - 2 ? (
        <AbsoluteFill style={{ opacity: crystalIn, filter: crystalIn < 1 ? `blur(${(1 - crystalIn) * 12}px)` : undefined }}>
          <CrystalCanvas absFrame={abs} x={p.x + recoil} y={p.y} r={p.r} orbit={orbit} pulse={pulseAt(f)} fan={fan} />
        </AbsoluteFill>
      ) : null}
      {pan < 1 ? <Receipt abs={abs} from={receiptRect(abs)} dx={pan * PAN.d} /> : null}
      {f < B4.arc[1] + 2 ? (
        <div style={{ position: "absolute", inset: 0, transform: `translateX(${-(1 - pan) * PAN.d}px)` }}>
          <SealStage from={HOVER} lift={1} tuck={prog(f, B4.tuck, inOut)} envIn={1} fold={prog(f, B4.fold, inOut)} stamp={stamp} label={label} arc={prog(f, B4.arc, accel)} />
        </div>
      ) : null}
      <Counter f={f} />
      <AccessKey f={f} />
      <Stream f={f} tx={p.x} ty={p.y} />
      <VoteInset f={f} inAt={[B4.insetIn[0], B4.insetIn[1]]} outAt={[B4.insetOut[0], B4.insetOut[1]]} seats={[B4.seats[0], B4.seats[1]]} lift={B4.chip[0]} />
      <KeyChip f={f} at={[B4.chip[0], B4.chip[1]]} to={{ x: p.x, y: p.y }} />
      <Forgery f={f} hitX={p.x - p.r * 0.92} hitY={p.y} />
      <SeatSplit f={f} line={[B4.line[0], B4.line[1]]} split={[B4.split[0], B4.split[1]]} tiles={[B4.tiles[0], B4.tiles[1]]} />
    </AbsoluteFill>
  )
}

