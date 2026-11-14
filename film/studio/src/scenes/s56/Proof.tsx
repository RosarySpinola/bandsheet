import { OffthreadVideo, staticFile, useCurrentFrame } from "remotion"
import { C, sans, ease } from "../../tokens"
import { F3_SRC, TX_HASH, txShort, USE_F3 } from "./data"
import { mono } from "./fonts"
import { prog, Type } from "./type"

export const P = { x: 1260, w: 540, top: 262, stripY: 776 }

function Tick({ on }: { on: number }) {
  return (
    <svg width={18} height={18} viewBox="0 0 18 18" style={{ flex: "none" }}>
      <polyline points="2,9.5 7,14 16,4" fill="none" stroke={C.green} strokeWidth={2} strokeDasharray={22} strokeDashoffset={22 * (1 - on)} />
    </svg>
  )
}

const CHECKS = [
  "Intel TDX quote present for this transaction",
  "Engine hash matches the contract policy",
  "Input hash matches this record",
  "Output hash matches this record",
]

/** Right column of the ledger: F3 footage inset when USE_F3, otherwise the "Verify it yourself" stand-in. */
export function Proof({ top, start }: { top: number; start: number }) {
  const f = useCurrentFrame()
  const lineH = prog(f, start, start + 20, ease) * 388
  const inset = prog(f, start, start + 18)
  return (
    <div style={{ position: "absolute", left: 0, top, width: 1920, height: 1080 }}>
      <div style={{ position: "absolute", left: P.x - 40, top: P.top, width: 1, height: lineH, background: C.line }} />
      {USE_F3 ? (
        <div style={{ position: "absolute", left: P.x, top: P.top + 40 * (1 - inset), width: P.w, height: (P.w * 9) / 16, border: `2px solid ${C.ink}`, opacity: inset, overflow: "hidden" }}>
          {f >= start ? <OffthreadVideo src={staticFile(F3_SRC)} muted style={{ width: "100%", height: "100%" }} /> : null}
        </div>
      ) : (
        <div style={{ position: "absolute", left: P.x, top: P.top }}>
          <Type text="VERIFY IT YOURSELF" start={start + 2} size={16} family={sans} weight={600} tracking={0.08} cps={0.5} />
          <div style={{ display: "flex", gap: 56, marginTop: 30 }}>
            <div>
              <div style={{ fontFamily: sans, fontSize: 14, letterSpacing: "0.06em", color: C.gray350, opacity: prog(f, start + 8, start + 16) }}>OUTLAYER ATTESTATION</div>
              <div style={{ marginTop: 8 }}><Type text="View attestation ↗" start={start + 12} size={22} family={sans} weight={400} cps={0.6} /></div>
            </div>
            <div>
              <div style={{ fontFamily: sans, fontSize: 14, letterSpacing: "0.06em", color: C.gray350, opacity: prog(f, start + 12, start + 20) }}>ENGINE WASM SHA256</div>
              <div style={{ marginTop: 8 }}><Type text="a1dd40549ada…073f57" start={start + 16} size={20} family={mono} weight={400} cps={0.5} tracking={0} /></div>
            </div>
          </div>
          <div style={{ width: prog(f, start + 20, start + 36) * P.w, height: 1, background: C.line, marginTop: 34 }} />
          <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 28 }}>
            {CHECKS.map((c, i) => (
              <div key={c} style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <Tick on={prog(f, start + 30 + i * 6, start + 40 + i * 6)} />
                <Type text={c} start={start + 32 + i * 6} size={21} family={sans} weight={400} cps={0.4} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/** The record strip: one 2px rule and one sentence; the tx (hidden at `txOut`) becomes S6's header. */
export function RecordStrip({ top, start, txOut }: { top: number; start: number; txOut: number }) {
  const f = useCurrentFrame()
  const w = prog(f, start, start + 16, ease) * 1680
  return (
    <div style={{ position: "absolute", left: 0, top: top + P.stripY, width: 1920 }}>
      <div style={{ position: "absolute", left: 120, top: 0, width: w, height: 2, background: C.ink }} />
      <div style={{ position: "absolute", left: 120, top: 24, display: "flex", alignItems: "baseline" }}>
        <Type text="Release #3" start={start + 3} size={28} family={sans} weight={600} cps={0.4} />
        <Type text="  ·  37 of 38 entries verified  ·  " start={start + 7} size={28} family={sans} weight={400} cps={0.25} color={C.gray350} />
        <Type text="1 forged payslip refused" start={start + 15} size={28} family={sans} weight={600} cps={0.25} />
        <Type text="  ·  logged on NEAR" start={start + 22} size={28} family={sans} weight={400} cps={0.25} color={C.gray350} />
      </div>
      <div style={{ position: "absolute", right: 120, top: 26, opacity: f >= txOut ? 0 : 1 }}>
        <Type text={txShort(TX_HASH)} start={start + 20} size={26} family={mono} weight={500} cps={0.5} tracking={0} />
      </div>
    </div>
  )
}
/** Screen-space position of the strip tx at camera rest (right-aligned at x 1800). */
export const STRIP_TX = { right: 1800, y: P.stripY + 26, size: 26 }
