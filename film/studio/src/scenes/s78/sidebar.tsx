import { interpolate } from "remotion"
import { C, easeInOut, sans, serif } from "../../tokens"
import { NAV, NAV_ACTIVE, NAV_PITCH, NAV_TOP, SIDEBAR_W } from "../s56/data"
import { S7B } from "./beats"

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const

/**
 * The app sidebar exactly as S6 hands it over (T6 end pose, s56/HANDOFF.md; geometry read from s56/data.ts).
 * On "from Claude" the rep leaves the app: the sidebar retracts left while the camera centres the chat card.
 * The real app sidebar comes back inside the F6 footage on "where they stand".
 */
export function Sidebar({ f }: { f: number }) {
  const out = interpolate(f, [S7B.sidebarOut, S7B.sidebarOut + 22], [0, 1], { ...clamp, easing: easeInOut })
  if (out >= 1) return null
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: SIDEBAR_W,
        height: "100%",
        background: C.band,
        transform: `translateX(${-out * (SIDEBAR_W + 4)}px)`,
      }}
    >
      <div style={{ position: "absolute", left: 40, top: 60, fontFamily: serif, fontWeight: 500, fontSize: 42, color: C.ink, whiteSpace: "pre" }}>
        Bandsheet
      </div>
      <div
        style={{
          position: "absolute",
          left: 40,
          top: 140,
          background: C.lav,
          color: "#3b2aa8",
          fontFamily: sans,
          fontSize: 15,
          padding: "6px 10px",
          whiteSpace: "nowrap",
        }}
      >
        Synthetic demo unit · NEAR testnet
      </div>
      {NAV.map((label, i) => {
        const active = i === NAV_ACTIVE
        const ink = active ? C.ink : C.gray350
        return (
          <div
            key={label}
            style={{
              position: "absolute",
              left: 40,
              top: NAV_TOP + i * NAV_PITCH - 2,
              display: "flex",
              alignItems: "center",
              gap: 16,
              whiteSpace: "nowrap",
              fontFamily: sans,
              fontSize: 22,
              color: ink,
            }}
          >
            <span style={{ width: 18, height: 18, background: active ? C.ink : C.inactive, display: "inline-block" }} />
            <span style={{ borderBottom: active ? `2px solid ${ink}` : "2px solid transparent", paddingBottom: 2 }}>{label}</span>
          </div>
        )
      })}
    </div>
  )
}
