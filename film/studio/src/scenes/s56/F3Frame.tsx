import { OffthreadVideo, Sequence, staticFile, useCurrentFrame } from "remotion"
import { C, sans, ease, easeInOut } from "../../tokens"
import { B5 } from "./beats"
import { F3_SRC, F3_TRIM, TX_HASH, txShort } from "./data"
import { mono, serifItalic } from "./fonts"
import { prog, Type } from "./type"

/** The release record on the real app, one frame right of the ledger (ledger-relative world coordinates). */
export const FR = { x: 1980, w: 1040, rule: 118, line1: 134, line2: 174, top: 226, bar: 32, view: 470, wit: 772 }
/** Focus that frames the strip and the browser frame (ledger-relative). */
export const FR_FOCUS = { x: FR.x + FR.w / 2, y: 524 }
/** Where the strip's tx sits (right-aligned), for T5. */
export const FR_TX = { right: FR.x + FR.w, y: FR.line2, size: 24 }
/** Source crop: the record column (x 480–1748 of 1920) at 0.82. */
const SCALE = 0.82
const CROP_X = 480

export function F3Frame({ top, start, txOut }: { top: number; start: number; txOut: number }) {
  const f = useCurrentFrame()
  const w = prog(f, start, start + 16, ease) * FR.w
  const frameIn = prog(f, start - 6, start + 10)
  return (
    <div style={{ position: "absolute", left: 0, top, width: 1, height: 1 }}>
      <div style={{ position: "absolute", left: FR.x, top: FR.rule, width: w, height: 2, background: C.ink }} />
      <div style={{ position: "absolute", left: FR.x, top: FR.line1, whiteSpace: "pre" }}>
        <Type text="Release #3" start={start + 3} size={24} family={sans} weight={600} cps={0.4} />
        <Type text="  ·  37 of 38 entries verified  ·  " start={start + 7} size={24} family={sans} weight={400} cps={0.25} color={C.gray350} />
        <Type text="1 forged payslip refused" start={start + 15} size={24} family={sans} weight={600} cps={0.25} />
      </div>
      <div style={{ position: "absolute", left: FR.x, top: FR.line2, whiteSpace: "pre" }}>
        <Type text="logged on NEAR" start={start + 20} size={24} family={sans} weight={400} cps={0.3} color={C.gray350} />
      </div>
      <div style={{ position: "absolute", right: -(FR.x + FR.w), top: FR.line2, whiteSpace: "pre", opacity: f >= txOut ? 0 : 1 }}>
        <Type text={txShort(TX_HASH)} start={start + 18} size={24} family={mono} weight={500} cps={0.5} tracking={0} />
      </div>
      {/* our own neutral browser frame */}
      <div style={{ position: "absolute", left: FR.x, top: FR.top + 30 * (1 - frameIn), width: FR.w, height: FR.bar + FR.view, boxSizing: "border-box", border: `2px solid ${C.ink}`, background: C.paper, opacity: frameIn, overflow: "hidden" }}>
        <div style={{ height: FR.bar, display: "flex", alignItems: "center", gap: 14, padding: "0 14px", background: C.band, borderBottom: `1px solid ${C.line}`, fontFamily: sans, fontSize: 15, color: C.gray350, whiteSpace: "nowrap" }}>
          <span style={{ width: 10, height: 10, background: C.inactive }} />
          <span>bandsheet.pages.dev/unit/releases</span>
        </div>
        <div style={{ position: "relative", width: FR.w - 4, height: FR.view - 2, overflow: "hidden" }}>
          <Sequence from={start - 10} layout="none">
            <OffthreadVideo src={staticFile(F3_SRC)} muted trimBefore={F3_TRIM} style={{ position: "absolute", left: -CROP_X * SCALE, top: 0, width: 1920 * SCALE, height: 1080 * SCALE }} />
          </Sequence>
        </div>
      </div>
      <Witness />
    </div>
  )
}

/** "with the exact subtraction it refused": the record's witness, set in serif italic and underlined. */
function Witness() {
  const f = useCurrentFrame()
  const u = prog(f, B5.subtraction, B5.subtraction + 16, easeInOut)
  return (
    <div style={{ position: "absolute", left: FR.x, top: FR.wit, display: "flex", alignItems: "baseline", gap: 14, whiteSpace: "pre" }}>
      <span style={{ fontFamily: sans, fontSize: 20, color: C.lav300, opacity: prog(f, B5.exact - 4, B5.exact + 2) }}>1</span>
      <div style={{ position: "relative" }}>
        {f >= B5.exact ? <Type text="Release #3 Senior − Release #1 Senior isolates 1 member." start={B5.exact} size={38} family={serifItalic} weight={400} cps={0.32} italic /> : null}
        <div style={{ position: "absolute", left: 0, bottom: -8, width: `${u * 100}%`, height: 2, background: C.ink }} />
      </div>
    </div>
  )
}
