import { interpolate } from "remotion"
import { C, ease, easeOutQuint, sans, serif } from "../../tokens"
import { S8B } from "./beats"
import { TypeOn } from "./type"

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const
export const LOCK = { x: 160, y: 300 }
const NEAR_PATH =
  "M21.443 0c-.89 0-1.714.46-2.18 1.218l-5.017 7.448a.533.533 0 0 0 .792.7l4.938-4.282a.2.2 0 0 1 .334.151v13.41a.2.2 0 0 1-.354.128L5.03.905A2.555 2.555 0 0 0 3.078 0h-.521A2.557 2.557 0 0 0 0 2.557v18.886a2.557 2.557 0 0 0 4.736 1.338l5.017-7.448a.533.533 0 0 0-.792-.7l-4.938 4.283a.2.2 0 0 1-.333-.152V5.352a.2.2 0 0 1 .354-.128l14.924 17.87c.486.574 1.2.905 1.952.906h.521A2.558 2.558 0 0 0 24 21.445V2.557A2.558 2.558 0 0 0 21.443 0Z"

const MARKS = ["NEAR AI Cloud", "OutLayer", "NEAR", "Sputnik DAO"]

/** Serif lockup, URL, quiet sponsor row and the synthetic-data note. */
export function Lockup({ f }: { f: number }) {
  const urlP = interpolate(f, [S8B.url, S8B.url + 16], [0, 1], { ...clamp, easing: easeOutQuint })
  const rule = interpolate(f, [S8B.url + 6, S8B.url + 30], [0, 1], { ...clamp, easing: ease })
  const tiny = interpolate(f, [S8B.tiny, S8B.tiny + 16], [0, 1], clamp)
  const head = { fontFamily: serif, fontWeight: 500, fontSize: 108, lineHeight: 1.06, letterSpacing: "-0.015em" } as const
  return (
    <div style={{ position: "absolute", left: LOCK.x, top: LOCK.y }}>
      <div style={head}>
        <TypeOn text="Every band published." frame={f} start={S8B.line1} rate={1.6} blur={10} rise={14} />
      </div>
      <div style={head}>
        <TypeOn text="Nobody exposed." frame={f} start={S8B.line2} rate={1.9} blur={10} rise={14} />
      </div>
      <div style={{ marginTop: 44, display: "inline-flex", flexDirection: "column", gap: 8, opacity: urlP, transform: `translateY(${(1 - urlP) * 12}px)` }}>
        <div style={{ fontFamily: sans, fontWeight: 600, fontSize: 38, color: C.ink, letterSpacing: "-0.01em" }}>bandsheet.pages.dev</div>
        <div style={{ height: 2, width: `${rule * 100}%`, background: C.ink }} />
      </div>
      <div style={{ marginTop: 42, display: "flex", alignItems: "center", gap: 18, fontFamily: sans, fontWeight: 600, fontSize: 22, color: C.gray350 }}>
        {MARKS.map((m, i) => {
          const p = interpolate(f, [S8B.sponsors + i * 5, S8B.sponsors + i * 5 + 14], [0, 1], { ...clamp, easing: ease })
          return (
            <span key={m} style={{ display: "inline-flex", alignItems: "center", gap: 18, opacity: p, transform: `translateY(${(1 - p) * 8}px)` }}>
              {i > 0 ? <span style={{ color: C.inactive }}>·</span> : null}
              <span style={{ display: "inline-flex", alignItems: "center", gap: 9 }}>
                {m === "NEAR" ? (
                  <svg width={19} height={19} viewBox="0 0 24 24">
                    <path d={NEAR_PATH} fill={C.gray350} />
                  </svg>
                ) : null}
                {m}
              </span>
            </span>
          )
        })}
      </div>
      <div style={{ marginTop: 16, fontFamily: sans, fontSize: 17, color: C.gray350, opacity: tiny * 0.85 }}>Synthetic data · NEAR testnet</div>
    </div>
  )
}
