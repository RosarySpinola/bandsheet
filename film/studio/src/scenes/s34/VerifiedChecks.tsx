import { interpolate } from "remotion"
import { C, sans } from "../../tokens"
import { outBack } from "./beats"

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const

/** The 16 checks the server runs around the NEAR AI Cloud call (labels from server/src/nearai). */
export const CHECKS = [
  "Gateway report echoes our fresh nonce",
  "Gateway Intel TDX quote verifies (DCAP, TCB policy, no debug)",
  "Gateway quote binds signing key and our nonce",
  "Gateway measured config matches app_compose",
  "Gateway event log replays to the quote's RTMR3",
  "Model TEE attestation(s) returned",
  "Model report echoes our fresh nonce",
  "Model Intel TDX quote verifies (DCAP, TCB policy, no debug)",
  "Model quote binds signing key and our nonce",
  "Model measured config matches app_compose",
  "Model event log replays to the quote's RTMR3",
  "NVIDIA GPU attestation (NRAS) passes with our nonce",
  "Signature declares its signer (model TEE or gateway TEE)",
  "Signed text commits to the SHA-256 of our exact request and response",
  "Signature is valid for the stated signer",
  "Signer is the TEE whose attestation we verified before sending",
]

export function PassMark({ on, size = 22 }: { on: number; size?: number }) {
  const s = interpolate(on, [0, 1], [0.6, 1], { ...clamp, easing: outBack })
  return (
    <span style={{ width: size, height: size, flexShrink: 0, position: "relative", border: `2px solid ${on > 0 ? C.ink : C.inactive}`, boxSizing: "border-box", display: "grid", placeItems: "center" }}>
      <span style={{ position: "absolute", inset: -2, background: C.ink, opacity: on, transform: `scale(${s})` }} />
      <svg width={size * 0.6} height={size * 0.6} viewBox="0 0 24 24" style={{ position: "relative", opacity: on }}>
        <path d="M4 12.5 L9.5 18 L20 6.5" fill="none" stroke="#fff" strokeWidth={3.4} strokeLinecap="square" />
      </svg>
    </span>
  )
}

/** Verified panel: header with live count, then 16 rows ticking in order across `t` (0→1). */
export function VerifiedChecks({ t, attested }: { t: number; attested: number }) {
  const n = Math.min(16, Math.floor(t * 16 + 0.0001))
  const all = t >= 1 ? 1 : 0
  return (
    <section style={{ background: C.band, borderTop: `2px solid ${C.ink}`, padding: "22px 26px", display: "flex", flexDirection: "column", gap: 12, fontFamily: sans, width: "100%", boxSizing: "border-box" }}>
      <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
        <PassMark on={all} size={32} />
        <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
          <span style={{ fontSize: 20, fontWeight: 600, color: C.ink }}>{all ? "Verified inside NEAR AI Cloud's enclave" : "Checking NEAR AI Cloud's enclave"}</span>
          <span style={{ fontSize: 16, color: C.gray350, fontVariantNumeric: "tabular-nums" }}>{n} of 16 checks passed</span>
        </div>
      </div>
      <div style={{ height: 34, display: "flex", alignItems: "center" }}>
        <span style={{ opacity: attested, transform: `translateY(${(1 - attested) * 8}px)`, background: C.lav, color: C.ink, fontSize: 15, fontWeight: 600, padding: "7px 12px", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 8, height: 8, background: C.lav300 }} />
          NEAR AI Cloud · TEE attestation verified
        </span>
      </div>
      <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column" }}>
        {CHECKS.map((label, i) => {
          const on = interpolate(t * 16, [i, i + 0.9], [0, 1], clamp)
          return (
            <li key={label} style={{ display: "flex", gap: 12, alignItems: "center", height: 26, borderBottom: i < 15 ? `1px solid ${C.line}` : "none", fontSize: 14.5, color: on > 0.5 ? C.ink : C.gray350 }}>
              <PassMark on={on} size={17} />
              <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
