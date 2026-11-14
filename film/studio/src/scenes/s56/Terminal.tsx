import { interpolateColors, useCurrentFrame } from "remotion"
import { C, sans, serif, easeInOut } from "../../tokens"
import { B6, S6_DUR } from "./beats"
import { NAV, NAV_ACTIVE, NAV_PITCH, NAV_TOP, PASS_FOCUS, PASS_LINES, SIDEBAR_W, VERIFY_HEAD } from "./data"
import { mono } from "./fonts"
import { cl, mix, prog, Type } from "./type"

/** Terminal card (our own neutral style) in world space, one frame to the right of the grids. */
export const TM = { x0: 1920, left: 160, top: 150, w: 1600, bar: 44, padX: 40, padY: 30, lh: 25, size: 17 }
/**
 * Local frames, on their words (beats.ts): the prompt types on "one command"; the 19 real PASS lines run from
 * "re-checks" so the 19th is in (and the counter reads 19/19) on "nineteen"; the real summary line on "claims". T6 on "and you can try": the
 * terminal becomes the app sidebar (Attack lab active) beside the live attack page (Attack.tsx); in the last
 * frames the active row moves to "Where do I stand" for S7.
 */
export const TT = {
  appear: B6.trust - 4, prompt: B6.command, head: B6.command + 6, pass0: B6.rechecks - 4,
  step: (B6.nineteen - 3 - (B6.rechecks - 4)) / 18, sum: B6.claims,
  morph0: B6.youCan - 8, morph1: B6.youCan + 8, wipe0: B6.youCan, wipe1: B6.youCan + 13,
  nav0: S6_DUR - 14, nav1: S6_DUR - 3,
}
/** Nav index of "Attack lab" (the page the sidebar arrives on). */
const NAV_ATTACK = 4
const N = PASS_LINES.length
const passT = (i: number) => TT.pass0 + i * TT.step
const rowY = (n: number) => TM.top + TM.bar + TM.padY + n * TM.lh
const TEXT = "#dfe7e3"

/** One copy of the sidebar's furniture; drawn light-on-dark during the morph and dark-on-light under the wipe. */
function Furniture({ x, y, f, light }: { x: number; y: number; f: number; light: boolean }) {
  const on = prog(f, TT.morph0 + 8, TT.morph1)
  return (
    <>
      <div style={{ position: "absolute", left: x + 40, top: y + 60, fontFamily: serif, fontWeight: 500, fontSize: 42, color: light ? C.ink : "#ffffff", opacity: on, whiteSpace: "pre" }}>Bandsheet</div>
      <div style={{ position: "absolute", left: x + 40, top: y + 140, opacity: on, background: C.lav, color: "#3b2aa8", fontFamily: sans, fontSize: 15, padding: "6px 10px", whiteSpace: "nowrap" }}>
        Synthetic demo unit · NEAR testnet
      </div>
    </>
  )
}

export function Terminal() {
  const f = useCurrentFrame()
  const m = prog(f, TT.morph0, TT.morph1, easeInOut)
  const wipe = prog(f, TT.wipe0, TT.wipe1, easeInOut)
  const lineFade = 1 - prog(f, TT.morph0, TT.morph0 + 6)
  // PASS leaves before the nav labels arrive (no frame where both read on top of each other)
  const passOut = prog(f, TT.morph0 + 2, TT.morph0 + 7)
  const toNav = prog(f, TT.morph0 + 6, TT.morph0 + 12)
  const passed = PASS_LINES.filter((_, i) => f >= passT(i)).length
  const x = mix(TM.x0 + TM.left, TM.x0, m)
  const y = mix(TM.top, 0, m)
  const w = mix(TM.w, SIDEBAR_W, m)
  const h = mix(rowY(N + 4) + TM.padY - TM.top, 1080, m)
  const appear = prog(f, TT.appear, TT.appear + 22)
  const act = mix(NAV_ATTACK, NAV_ACTIVE, prog(f, TT.nav0, TT.nav1, easeInOut))
  const rows = (light: boolean) =>
    NAV.map((label, i) => {
      const py = mix(rowY(i + 2), NAV_TOP + i * NAV_PITCH, m)
      const on = Math.max(0, 1 - Math.abs(act - i))
      const ink = light ? interpolateColors(on, [0, 1], [C.gray350, C.ink]) : interpolateColors(on, [0, 1], [TEXT, "#ffffff"])
      const sq = light ? interpolateColors(on, [0, 1], [C.inactive, C.ink]) : interpolateColors(on, [0, 1], ["rgba(117,215,159,0.55)", C.mint])
      return (
        <div key={label} style={{ position: "absolute", left: x + 40, top: py - 2, display: "flex", alignItems: "center", gap: 16, opacity: toNav, whiteSpace: "nowrap", fontFamily: sans, fontSize: mix(TM.size + 2, 22, m), color: ink }}>
          <span style={{ width: 18, height: 18, background: sq, display: "inline-block" }} />
          <span style={{ position: "relative", paddingBottom: 2 }}>
            {label}
            <span style={{ position: "absolute", left: 0, bottom: -2, height: 2, width: `${on * 100}%`, background: ink }} />
          </span>
        </div>
      )
    })
  return (
    <>
      {/* dark layer: the terminal, shrinking into the sidebar */}
      <div style={{ position: "absolute", left: x, top: y, width: w, height: h, background: C.ink, opacity: appear }} />
      <div style={{ position: "absolute", left: x, top: y, width: w, height: TM.bar, borderBottom: "1px solid rgba(255,255,255,0.12)", opacity: appear * lineFade, display: "flex", alignItems: "center", justifyContent: "space-between", padding: `0 ${TM.padX}px`, boxSizing: "border-box", fontFamily: sans, fontSize: 16, color: "rgba(223,231,227,0.7)", whiteSpace: "nowrap" }}>
        <span>bandsheet  ·  read-only, no keys</span>
        <span style={{ fontFamily: mono, color: passed === N ? C.mint : "rgba(223,231,227,0.7)" }}>{`PASS ${passed}/${N}`}</span>
      </div>
      <div style={{ position: "absolute", left: TM.x0 + TM.left, top: rowY(PASS_FOCUS + 2) - 3, height: TM.lh, width: TM.w * prog(f, passT(PASS_FOCUS) + 2, passT(PASS_FOCUS) + 12), background: "rgba(205,194,255,0.2)", borderLeft: `3px solid ${C.lav}`, opacity: lineFade }} />
      <div style={{ position: "absolute", left: TM.x0 + TM.left + TM.padX, top: rowY(0), opacity: lineFade, fontFamily: mono, fontSize: TM.size, whiteSpace: "pre" }}>
        <span style={{ color: C.lav, opacity: prog(f, TT.prompt - 4, TT.prompt) }}>$ </span>
        <Type text="pnpm verify" start={TT.prompt} size={TM.size} family={mono} weight={500} color={TEXT} from={C.lav} cps={0.7} tracking={0} />
      </div>
      <div style={{ position: "absolute", left: TM.x0 + TM.left + TM.padX, top: rowY(1), opacity: lineFade * prog(f, TT.head, TT.head + 4), fontFamily: mono, fontSize: TM.size, color: "rgba(223,231,227,0.55)", whiteSpace: "pre" }}>
        {VERIFY_HEAD}
      </div>
      {PASS_LINES.map((line, i) => {
        const on = cl((f - passT(i)) / 3)
        const nav = i < NAV.length
        const py = nav ? mix(rowY(i + 2), NAV_TOP + i * NAV_PITCH, m) : rowY(i + 2)
        const px = mix(TM.x0 + TM.left + TM.padX, TM.x0 + 40, m)
        return (
          <div key={i} style={{ position: "absolute", left: px, top: py, whiteSpace: "pre", fontFamily: mono, fontSize: TM.size, opacity: on * (1 - passOut), transform: `translateX(${(1 - cl((f - passT(i)) / 6)) * 18}px)` }}>
            <span style={{ color: C.mint, fontWeight: 500 }}>PASS</span>
            <span style={{ color: i === PASS_FOCUS ? "#ffffff" : TEXT, opacity: lineFade }}>{`  ${line}`}</span>
          </div>
        )
      })}
      <div style={{ position: "absolute", left: TM.x0 + TM.left + TM.padX, top: rowY(N + 3), opacity: lineFade, fontFamily: mono, fontSize: TM.size + 1, fontWeight: 500, whiteSpace: "pre" }}>
        {f >= TT.sum ? <Type text={`ALL CHECKS PASSED  (${N}/${N})`} start={TT.sum} size={TM.size + 1} family={mono} weight={500} color={C.mint} from="#ffffff" cps={0.6} tracking={0} /> : null}
      </div>
      {f >= TT.morph0 ? (
        <>
          {rows(false)}
          <Furniture x={x} y={y} f={f} light={false} />
          {/* light layer: the app's sidebar, wiped in top to bottom (no cross-fade, so no grey frames) */}
          <div style={{ position: "absolute", left: TM.x0, top: 0, width: 1920, height: 1080, clipPath: `inset(0 0 ${(1 - wipe) * 100}% 0)` }}>
            <div style={{ position: "absolute", left: -TM.x0, top: 0 }}>
              <div style={{ position: "absolute", left: x, top: y, width: w, height: h, background: C.band }} />
              {rows(true)}
              <Furniture x={x} y={y} f={f} light />
            </div>
          </div>
        </>
      ) : null}
    </>
  )
}
