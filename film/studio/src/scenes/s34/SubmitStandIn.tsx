import { interpolate } from "remotion"
import { C, sans, serif } from "../../tokens"
import { mono } from "./fonts"
import { LockGlyph } from "./Envelope"
import { PassMark, VerifiedChecks } from "./VerifiedChecks"

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const
const rise = (t: number, px = 12) => ({ opacity: t, transform: `translateY(${(1 - t) * px}px)` })

export const SIDEBAR_W = 270
export const MAIN_PAD_X = 40
export const COL_TOP = 132
export const LEFT_W = 500
export const DROP_H = 108

const FIELDS: [string, string][] = [
  ["Employee ID", "HC-0412"],
  ["Grade", "Senior"],
  ["Period", "2026-10"],
  ["Gross pay (month)", "EUR 5,833.33"],
]
const NAV: [string, string[]][] = [
  ["Work", ["Overview", "Submit a payslip", "Where do I stand"]],
  ["Records", ["Releases", "Attack lab", "Chapel vote"]],
  ["Learn", ["How it works", "Help", "Verify it yourself"]],
]

export type SubmitBeats = { page: number; drop: number; fields: number; panel: number; checks: number; attested: number; seal: number }

/** Motion-graphics stand-in for footage F1 (/unit/submit), built from the app's own components. */
export function SubmitStandIn({ page, drop, fields, panel, checks, attested, seal }: SubmitBeats) {
  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", fontFamily: sans, color: C.text }}>
      <aside style={{ width: SIDEBAR_W, background: C.band, padding: "26px 24px", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: 26, ...rise(page, 0) }}>
        <span style={{ fontFamily: serif, fontWeight: 500, fontSize: 30, color: C.ink }}>Bandsheet</span>
        {NAV.map(([g, items]) => (
          <div key={g} style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            <span style={{ fontSize: 12.5, letterSpacing: "0.06em", textTransform: "uppercase", color: C.gray350 }}>{g}</span>
            {items.map((it) => {
              const on = it === "Submit a payslip"
              return (
                <span key={it} style={{ fontSize: 17, fontWeight: on ? 600 : 400, color: on ? C.ink : C.gray350, display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ width: 4, height: 18, background: on ? C.ink : "transparent" }} />
                  {it}
                </span>
              )
            })}
          </div>
        ))}
      </aside>
      <main style={{ flex: 1, position: "relative", padding: `30px ${MAIN_PAD_X}px`, boxSizing: "border-box" }}>
        <div style={rise(page)}>
          <div style={{ fontSize: 16, color: C.gray350 }}>Harbour Courier chapel · synthetic demo on NEAR testnet</div>
          <div style={{ fontFamily: serif, fontWeight: 500, fontSize: 50, color: C.ink, letterSpacing: "-0.015em", marginTop: 4 }}>Submit a payslip</div>
        </div>
        <div style={{ position: "absolute", top: COL_TOP, left: MAIN_PAD_X, width: LEFT_W, display: "flex", flexDirection: "column", gap: 22 }}>
          <Dropzone page={page} drop={drop} />
          <div style={{ display: "flex", flexDirection: "column", ...rise(fields) }}>
            <span style={{ fontSize: 13, fontWeight: 500, letterSpacing: "0.02em", textTransform: "uppercase", color: C.gray350, paddingBottom: 6 }}>Read from your payslip</span>
            {FIELDS.map(([k, v], i) => {
              const t = interpolate(fields, [0.15 + i * 0.15, 0.55 + i * 0.15], [0, 1], clamp)
              return (
                <div key={k} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", height: 40, borderBottom: `1px solid ${C.line}`, ...rise(t, 6) }}>
                  <span style={{ fontSize: 16, color: C.gray350 }}>{k}</span>
                  <span style={{ fontSize: 19, fontWeight: 600, color: C.ink, fontVariantNumeric: "tabular-nums" }}>{v}</span>
                </div>
              )
            })}
          </div>
          <SealRow fields={fields} seal={seal} />
        </div>
        <div style={{ position: "absolute", top: COL_TOP, left: MAIN_PAD_X + LEFT_W + 32, right: MAIN_PAD_X, ...rise(panel, 18) }}>
          <VerifiedChecks t={checks} attested={attested} />
        </div>
      </main>
    </div>
  )
}

function Dropzone({ page, drop }: { page: number; drop: number }) {
  const filled = drop > 0.5
  return (
    <div style={{ height: DROP_H, boxSizing: "border-box", background: C.band, border: `2px ${filled ? "solid" : "dashed"} ${filled ? C.ink : C.gray350}`, display: "flex", alignItems: "center", gap: 18, padding: "0 22px", ...rise(page) }}>
      <span style={{ width: 54, height: 54, flexShrink: 0, background: filled ? C.ink : C.paper, display: "grid", placeItems: "center" }}>
        {filled ? (
          <PassMark on={interpolate(drop, [0.5, 1], [0, 1], clamp)} size={28} />
        ) : (
          <svg width={26} height={26} viewBox="0 0 24 24"><path d="M12 4 V16 M6 10 L12 4 L18 10 M4 20 H20" stroke={C.ink} strokeWidth={2.2} fill="none" /></svg>
        )}
      </span>
      {filled ? (
        <span style={{ display: "flex", flexDirection: "column", gap: 3, opacity: interpolate(drop, [0.5, 0.9], [0, 1], clamp) }}>
          <span style={{ fontSize: 17, fontWeight: 600, color: C.ink }}>harbour-courier-payslip-2026-10.eml</span>
          <span style={{ fontSize: 15, color: C.gray350 }}>14 KB · read once inside NEAR AI Cloud, never stored</span>
        </span>
      ) : (
        <span style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <span style={{ fontSize: 17, fontWeight: 600, color: C.ink }}>Drop your payslip email here</span>
          <span style={{ fontSize: 15, color: C.gray350 }}>.eml, PDF or image · read once, never stored</span>
        </span>
      )}
    </div>
  )
}

function SealRow({ fields, seal }: { fields: number; seal: number }) {
  const sealed = seal > 0.5
  return (
    <div style={{ height: 92, boxSizing: "border-box", ...rise(interpolate(fields, [0.7, 1], [0, 1], clamp)) }}>
      {sealed ? (
        <div style={{ height: "100%", background: C.lav100, borderTop: `2px solid ${C.ink}`, display: "flex", alignItems: "center", gap: 16, padding: "0 20px", ...rise(interpolate(seal, [0.5, 1], [0, 1], clamp), 6) }}>
          <LockGlyph size={46} id="seal-row-lock" />
          <span style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 18, fontWeight: 600, color: C.ink }}>Sealed in this browser</span>
            <span style={{ fontSize: 15, color: C.gray350 }}>
              Sealed to the engine key <span style={{ fontFamily: mono, color: C.ink }}>Kn0bVgYS…E0Y=</span>
            </span>
          </span>
        </div>
      ) : (
        <div style={{ height: 56, width: 270, background: C.ink, color: C.paper, display: "grid", placeItems: "center", fontSize: 18, fontWeight: 600, marginTop: 18, transform: `scale(${1 - Math.sin(Math.min(1, seal * 2) * Math.PI) * 0.04})` }}>
          Seal to the engine
        </div>
      )}
    </div>
  )
}
