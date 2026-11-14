import { interpolate } from "remotion"
import { C, sans } from "../../tokens"
import { B4, inOut, outQuint, prog } from "./beats"
import { mono } from "./fonts"

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const

/**
 * A member's NEAR access key, read from testnet (view_access_key on bandsheet-3f36b7.testnet):
 * FunctionCall, receiver bandsheet-3f36b7.testnet, method_names ["submit"]. The same key signed tx
 * BEEqPUbCB3AbhTNMJ2cVim55yaomqfFm7rKLkdZXRz4P, whose receipt logged the EVENT_JSON below (slot elided).
 */
export const MEMBER_KEY = "ed25519:3PhJpmABAwuDFAAipXpAuRqah3MpdUJxLUmbR2wfGDv7"
export const KEY = { left: 64, top: 176, w: 800, h: 318 }
/** Where submitted entries leave the card (right edge, centre of the rows). */
export const KEY_OUT = { x: KEY.left + KEY.w, y: KEY.top + 200 }
const LOG_TOP = KEY.top + KEY.h + 26

type Seg = { t: string; kind?: "replaced" | "count" }
const LOG: Seg[][] = [
  [{ t: 'EVENT_JSON:{"standard":"bandsheet","version":"1.0.0",' }],
  [{ t: '  "event":"entry_submitted",' }],
  [{ t: '  "data":{"slot":"fd7e10a0…58bc",' }, { t: '"replaced":true', kind: "replaced" }, { t: "," }, { t: '"count":38', kind: "count" }, { t: "}}" }],
]
const LOG_LEN = LOG.flat().reduce((n, s) => n + s.t.length, 0)

const rise = (t: number, px = 10) => ({ opacity: t, transform: `translateY(${(1 - t) * px}px)` })

function Row({ label, t, hi = 0, children }: { label: string; t: number; hi?: number; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", height: 44, borderBottom: `1px solid ${C.line}`, position: "relative", ...rise(t, 8) }}>
      <span style={{ position: "absolute", left: -12, right: -12, top: 4, bottom: 4, background: C.lav, opacity: 0.7, transform: `scaleX(${hi})`, transformOrigin: "0 50%" }} />
      <span style={{ position: "relative", width: 150, fontFamily: sans, fontSize: 19, color: C.gray350 }}>{label}</span>
      <span style={{ position: "relative", fontFamily: mono, fontSize: 21, color: C.ink, display: "flex", gap: 10, alignItems: "baseline" }}>{children}</span>
    </div>
  )
}

/** The access-key card (N6b) and, on "a newer payslip", the receipt log typing in with replaced:true. */
export function AccessKey({ f }: { f: number }) {
  const tin = prog(f, B4.keyIn, outQuint)
  const out = prog(f, B4.keyOut, inOut)
  if (tin <= 0 || out >= 1) return null
  const row = (i: number) => prog(f, [B4.keyIn[0] + 8 + i * 4, B4.keyIn[0] + 18 + i * 4], outQuint)
  const methodsHi = prog(f, [B4.methods, B4.methods + 10], inOut)
  const gasHi = prog(f, [B4.gas, B4.gas + 10], inOut)
  const logIn = prog(f, [B4.event[0] - 4, B4.event[0] + 4])
  const typed = Math.round(interpolate(f, B4.event, [0, LOG_LEN], clamp))
  let left = typed
  const shown = LOG.map((line) => line.map((seg) => { const n = Math.max(0, Math.min(seg.t.length, left)); left -= n; return n }))
  const caretLine = lastLine(typed)
  const rep = prog(f, [B4.replaced, B4.replaced + 10], inOut)
  const typing = typed > 0 && typed < LOG_LEN
  return (
    <div style={{ position: "absolute", left: KEY.left, top: KEY.top, opacity: tin * (1 - out), transform: `translate(${(1 - tin) * -80}px, ${out * -36}px)` }}>
      <div style={{ width: KEY.w, height: KEY.h, boxSizing: "border-box", background: C.paper, border: `2px solid ${C.ink}`, padding: "24px 30px", display: "flex", flexDirection: "column" }}>
        <span style={{ fontFamily: sans, fontSize: 15, letterSpacing: "0.08em", textTransform: "uppercase", color: C.gray350 }}>Member access key · NEAR testnet</span>
        <span style={{ fontFamily: mono, fontSize: 20, color: C.ink, marginTop: 10, whiteSpace: "nowrap" }}>{MEMBER_KEY}</span>
        <div style={{ height: 2, background: C.ink, margin: "16px 0 4px" }} />
        <Row label="permission" t={row(0)}>FunctionCall</Row>
        <Row label="receiver" t={row(1)}>bandsheet-3f36b7.testnet</Row>
        <Row label="methods" t={row(2)} hi={methodsHi}>["submit"]</Row>
        <Row label="gas" t={row(3)} hi={gasHi}>
          <span style={{ fontFamily: sans, fontWeight: 600, fontSize: 21 }}>member pays 0</span>
          <span style={{ fontFamily: sans, fontSize: 18, color: C.gray350 }}>the chapel's account pays</span>
        </Row>
      </div>
      <div style={{ position: "absolute", left: 0, top: LOG_TOP - KEY.top, width: KEY.w, ...rise(logIn, 8) }}>
        <span style={{ fontFamily: sans, fontSize: 15, letterSpacing: "0.08em", textTransform: "uppercase", color: C.gray350 }}>
          Receipt log · tx <span style={{ fontFamily: mono, letterSpacing: 0, textTransform: "none" }}>BEEqPUbCB3…kdZXRz4P</span>
        </span>
        <div style={{ marginTop: 10, background: C.ink, padding: "16px 22px", boxSizing: "border-box", height: 124, fontFamily: mono, fontSize: 19, lineHeight: "30px", color: C.paper, whiteSpace: "pre" }}>
          {LOG.map((line, li) => (
            <div key={li} style={{ height: 30 }}>
              {line.map((seg, si) => {
                const n = shown[li][si]
                if (n === 0) return null
                const style: React.CSSProperties =
                  seg.kind === "replaced"
                    ? { color: rep > 0 ? C.lav : C.paper, boxShadow: `inset 0 -${Math.round(3 * rep)}px 0 ${C.lav}` }
                    : seg.kind === "count"
                      ? { color: rep > 0 ? C.lav : C.paper }
                      : {}
                return (
                  <span key={si} style={style}>
                    {seg.t.slice(0, n)}
                  </span>
                )
              })}
              {typing && li === caretLine ? <span style={{ display: "inline-block", width: 11, height: 20, background: C.lav, verticalAlign: "middle" }} /> : null}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/** Index of the line the typing caret is on, for `n` typed characters. */
function lastLine(n: number) {
  let acc = 0
  for (let i = 0; i < LOG.length; i++) {
    acc += LOG[i].reduce((m, seg) => m + seg.t.length, 0)
    if (n <= acc) return i
  }
  return LOG.length - 1
}
