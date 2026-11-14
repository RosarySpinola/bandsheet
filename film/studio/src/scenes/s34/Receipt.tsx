import type { ReactNode } from "react"
import { interpolate } from "remotion"
import { C, sans, serif } from "../../tokens"
import { wordFrame } from "../../lib/words"
import { PAN, inOut, lerp, outQuint, prog } from "./beats"
import { mono } from "./fonts"
import { PassMark } from "./VerifiedChecks"

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const

/**
 * The attestation receipt (S3, "Before anything is sent…" → "…the signature on its answer").
 * Real run: server/fixtures/recorded-eml.json (z-ai/glm-5.3-flash, gateway signer 0xb98a78…e779,
 * 3 model TEEs signing as 0x3b753b…fa0c). Row labels are the exact check labels from
 * server/src/nearai/verify.ts (guard) and signature.ts; 5 gateway + 1 present + 3 × 6 model + 4 signature = 28.
 */
export const NONCE = "f9f4d5269bbb65828b8b9350fb0f8861389e15a860e5527693bb8c6a2ca9ddc0"
export const RECEIPT = { x: 400, w: 1120, cy: 452, minTop: 84 }
export type Rect = { x: number; y: number; w: number; h: number }

const W = {
  before: wordFrame("Before anything"),
  fresh: wordFrame("fresh attestation"),
  att: wordFrame("attestation, an"),
  intel: wordFrame("Intel"),
  tdx: wordFrame("T-D-X"),
  quote: wordFrame("quote and"),
  nvidia: wordFrame("NVIDIA"),
  nonce: wordFrame("nonce"),
  after: wordFrame("afterwards"),
  sig: wordFrame("signature on its"),
}
const TOTAL_AT = wordFrame("on its answer")

type Scope = { text: string } | { ticks: number; gap: number }
type Row = { label: ReactNode; at: number; scope: Scope }
const ROWS_BEFORE: Row[] = [
  { label: "Gateway Intel TDX quote verifies (DCAP, TCB policy, no debug)", at: W.intel, scope: { text: "gateway TEE" } },
  { label: "Model Intel TDX quote verifies (DCAP, TCB policy, no debug)", at: W.tdx, scope: { ticks: 3, gap: 5 } },
  { label: "NVIDIA GPU attestation (NRAS) passes with our nonce", at: W.nvidia, scope: { ticks: 3, gap: 7 } },
]
const ROWS_AFTER: Row[] = [
  { label: "Signature is valid for the stated signer", at: W.sig, scope: { text: "ecdsa · 0x3b753b…fa0c" } },
  { label: "Signer is the TEE whose attestation we verified before sending", at: W.sig + 4, scope: { text: "provider_tee" } },
]

/** Running count of the 28 checks, in the order the server runs them, landing on the words. */
const STEPS: [number, number, number][] = [
  [W.att + 4, 14, 5], // nonce echoes (gateway + 3 models) and "model attestations returned"
  [W.intel, 14, 4], // TDX quotes: gateway + 3 models
  [W.quote, 16, 12], // report data, MRCONFIGID, RTMR3 × 4
  [W.nvidia, 20, 3], // NVIDIA × 3
  [W.sig, 9, 4], // the four signature checks
]
const countAt = (a: number) => Math.floor(STEPS.reduce((n, [s, d, k]) => n + k * interpolate(a, [s, s + d], [0, 1], clamp), 0) + 1e-6)

const rise = (t: number, px = 10) => ({ opacity: t, transform: `translateY(${(1 - t) * px}px)` })
const caps = { fontFamily: sans, fontSize: 15, letterSpacing: "0.08em", textTransform: "uppercase" as const, color: C.gray350 }

/** Section heights (px): the slip grows as lines print, and stays centred on RECEIPT.cy. */
const PAD = 30
const HEAD_H = 70
const RULE_H = 44
const NONCE_H = 62
const BEFORE_H = 46
const ROW_H = 52
const AFTER_H = 42
const TOTAL_H = 84
const grows = (a: number, at: number) => prog(a, [at - 3, at + 6], outQuint)
const nonceGrow = (a: number) => prog(a, [W.fresh - 8, W.fresh + 4], outQuint)
const afterGrow = (a: number) => prog(a, [W.after - 2, W.after + 8], outQuint)
const totalGrow = (a: number) => prog(a, [TOTAL_AT - 2, TOTAL_AT + 10], outQuint)
export function receiptHeight(a: number) {
  const rows = [...ROWS_BEFORE, ...ROWS_AFTER].reduce((n, r) => n + ROW_H * grows(a, r.at), 0)
  return PAD * 2 + HEAD_H + RULE_H + NONCE_H * nonceGrow(a) + BEFORE_H + rows + AFTER_H * afterGrow(a) + TOTAL_H * totalGrow(a)
}
export const receiptRect = (a: number): Rect => {
  const h = receiptHeight(a)
  return { x: RECEIPT.x, y: Math.max(RECEIPT.minTop, RECEIPT.cy - h / 2), w: RECEIPT.w, h }
}

function Scoped({ s, a, at }: { s: Scope; a: number; at: number }) {
  if ("text" in s) return <span style={{ fontFamily: mono, fontSize: 17, color: C.gray350, whiteSpace: "nowrap" }}>{s.text}</span>
  return (
    <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ fontFamily: sans, fontSize: 16, color: C.gray350, marginRight: 4 }}>model TEEs</span>
      {Array.from({ length: s.ticks }, (_, i) => (
        <PassMark key={i} on={prog(a, [at + 4 + i * s.gap, at + 10 + i * s.gap], outQuint)} size={20} />
      ))}
    </span>
  )
}

function CheckRow({ r, a, nonceLink = 0 }: { r: Row; a: number; nonceLink?: number }) {
  const t = prog(a, [r.at - 1, r.at + 9], outQuint)
  const on = prog(a, [r.at + 1, r.at + 9])
  const label =
    typeof r.label === "string" && r.label.endsWith("our nonce") ? (
      <>
        {r.label.slice(0, -9)}
        <span style={{ boxShadow: `inset 0 -${Math.round(4 * nonceLink)}px 0 ${C.lav300}` }}>our nonce</span>
      </>
    ) : (
      r.label
    )
  return (
    <div style={{ height: ROW_H * grows(a, r.at), overflow: "hidden", flexShrink: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16, height: ROW_H, boxSizing: "border-box", borderBottom: `1px solid ${C.line}`, ...rise(t) }}>
        <PassMark on={on} size={26} />
        <span style={{ flex: 1, fontFamily: sans, fontSize: 22, color: C.ink, whiteSpace: "nowrap" }}>{label}</span>
        <Scoped s={r.scope} a={a} at={r.at} />
      </div>
    </div>
  )
}

/** Fresh nonce typed as 64 hex chars (grouped in 8s), then tied to the GPU row on "nonce". */
function Nonce({ a }: { a: number }) {
  const n = Math.round(interpolate(a, [W.fresh, W.fresh + 30], [0, 64], clamp))
  const groups = NONCE.slice(0, n).match(/.{1,8}/g) ?? []
  const hi = prog(a, [W.nonce, W.nonce + 12], inOut)
  const typing = n > 0 && n < 64
  return (
    <div style={{ height: NONCE_H * nonceGrow(a), overflow: "hidden", flexShrink: 0, display: "flex", flexDirection: "column", gap: 10, ...rise(prog(a, [W.fresh - 6, W.fresh + 4])) }}>
      <span style={caps}>Fresh nonce · 32 random bytes</span>
      <div style={{ position: "relative", height: 34, fontFamily: mono, fontSize: 23, color: C.ink, whiteSpace: "pre", display: "flex", alignItems: "center" }}>
        <span style={{ position: "absolute", left: -8, top: 0, bottom: 0, width: `calc(${hi * 100}% + 16px)`, background: C.lav, opacity: 0.65 }} />
        <span style={{ position: "relative" }}>{groups.join(" ")}</span>
        {typing ? <span style={{ position: "relative", width: 12, height: 26, background: C.ink, marginLeft: 2 }} /> : null}
      </div>
    </div>
  )
}

/**
 * `abs`: absolute film frame. `from`: screen rect of the Verified panel at the moment it opens (FLIP);
 * `dx`: the S3→S4 pan offset.
 */
export function Receipt({ abs: a, from, dx = 0 }: { abs: number; from: Rect; dx?: number }) {
  const open = prog(a, [W.before, W.before + 24], inOut)
  if (open <= 0) return null
  const to = receiptRect(a)
  const r = { x: lerp(from.x, to.x, open), y: lerp(from.y, to.y, open), w: lerp(from.w, to.w, open), h: lerp(from.h, to.h, open) }
  const content = prog(a, [W.before + 12, W.before + 30])
  const drift = interpolate(a, [W.before + 24, PAN.a], [0, 1], clamp)
  const count = countAt(a)
  const done = prog(a, [TOTAL_AT, TOTAL_AT + 10], outQuint)
  const afterT = afterGrow(a)
  const nonceLink = prog(a, [W.nonce, W.nonce + 12], inOut)
  return (
    <div style={{ position: "absolute", left: r.x + dx, top: r.y, width: r.w, height: r.h, background: C.band, borderTop: `2px solid ${C.ink}`, boxSizing: "border-box", overflow: "hidden", transform: `scale(${lerp(1, 1.02, drift)})` }}>
      <div style={{ position: "absolute", left: 0, top: 0, width: RECEIPT.w, padding: `${PAD}px 46px`, boxSizing: "border-box", display: "flex", flexDirection: "column", opacity: content }}>
        <div style={{ height: HEAD_H, display: "flex", gap: 18, alignItems: "flex-start" }}>
          <PassMark on={done} size={34} />
          <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
            <span style={{ fontFamily: serif, fontWeight: 500, fontSize: 36, lineHeight: 1.05, color: C.ink, letterSpacing: "-0.01em" }}>
              {done > 0.5 ? "Verified inside NEAR AI Cloud's enclave" : "Checking NEAR AI Cloud's enclave"}
            </span>
            <span style={{ fontFamily: sans, fontSize: 18, color: C.gray350, fontVariantNumeric: "tabular-nums" }}>
              {count} of 28 checks passed · z-ai/glm-5.3-flash · gateway TEE + 3 model TEEs
            </span>
          </div>
        </div>
        <div style={{ height: RULE_H, display: "flex", alignItems: "center" }}>
          <div style={{ height: 2, width: "100%", background: C.ink }} />
        </div>
        <Nonce a={a} />
        <div style={{ height: BEFORE_H, flexShrink: 0, display: "flex", alignItems: "flex-end", paddingBottom: 6, boxSizing: "border-box" }}>
          <span style={caps}>Before anything is sent</span>
        </div>
        {ROWS_BEFORE.map((row, i) => (
          <CheckRow key={i} r={row} a={a} nonceLink={i === 2 ? nonceLink : 0} />
        ))}
        <div style={{ height: AFTER_H * afterT, overflow: "hidden", flexShrink: 0, display: "flex", alignItems: "flex-end", paddingBottom: 6, boxSizing: "border-box" }}>
          <span style={{ ...caps, ...rise(afterT, 6) }}>After the answer</span>
        </div>
        {ROWS_AFTER.map((row, i) => (
          <CheckRow key={i} r={row} a={a} />
        ))}
        <div style={{ height: TOTAL_H * totalGrow(a), overflow: "hidden", flexShrink: 0, display: "flex", alignItems: "flex-end" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 14, ...rise(done, 12) }}>
            <span style={{ fontFamily: serif, fontWeight: 500, fontSize: 44, lineHeight: 1.2, color: C.ink, letterSpacing: "-0.01em", boxShadow: `inset 0 -${Math.round(6 * done)}px 0 ${C.lav}` }}>28 of 28 checks passed</span>
            <span style={{ fontFamily: sans, fontSize: 18, color: C.gray350 }}>24 before sending · 4 on the signed answer</span>
          </div>
        </div>
      </div>
    </div>
  )
}
