import { OffthreadVideo, Sequence, staticFile, useCurrentFrame } from "remotion"
import { C, sans, easeInOut } from "../../tokens"
import { B6, S6_DUR } from "./beats"
import { F7A_CLICK, F7A_SIDEBAR, F7A_SRC, SIDEBAR_W } from "./data"
import { TM, TT } from "./Terminal"
import { prog, Type } from "./type"

/**
 * "and you can try the subtraction yourself on the site": beside the sidebar the terminal became, the live
 * /unit/attack page (real recording). The cursor presses Subtract on "try the subtraction"; at 2× the naive
 * panel reaches €70,000 and Bandsheet's says Withheld. In the last frames the page clears to paper for S7.
 */
const RATE = 2
const X = TM.x0 + SIDEBAR_W
const W = 1920 - SIDEBAR_W
const BAR = 44
/** Source crop: the page right of the app's own sidebar, scaled to fill our content area. */
const S = W / (1920 - F7A_SIDEBAR)
const SRC_TOP = 24
/** The click lands just after "try". */
const TRIM = Math.round(F7A_CLICK - (B6.tryIt + 4 - TT.wipe0) * RATE)

export function Attack() {
  const f = useCurrentFrame()
  if (f < TT.wipe0) return null
  const wipe = prog(f, TT.morph1 - 4, TT.morph1 + 8, easeInOut) // once the sidebar has nearly settled
  const out = prog(f, S6_DUR - 9, S6_DUR - 2, easeInOut)
  return (
    <div style={{ position: "absolute", left: X, top: 0, width: W, height: 1080, overflow: "hidden", clipPath: `inset(0 0 ${(1 - wipe) * 100}% 0)`, opacity: 1 - out }}>
      <div style={{ position: "absolute", left: 0, top: BAR, width: W, height: 1080 - BAR, overflow: "hidden", background: C.paper }}>
        <Sequence from={TT.wipe0} layout="none">
          <OffthreadVideo src={staticFile(F7A_SRC)} muted trimBefore={TRIM} playbackRate={RATE} style={{ position: "absolute", left: -F7A_SIDEBAR * S, top: -SRC_TOP * S, width: 1920 * S, height: 1080 * S }} />
        </Sequence>
      </div>
      {/* our own neutral address strip: the URL is the point of the shot */}
      <div style={{ position: "absolute", left: 0, top: 0, width: W, height: BAR, boxSizing: "border-box", background: C.band, borderBottom: `1px solid ${C.line}`, display: "flex", alignItems: "center", gap: 14, padding: "0 22px", whiteSpace: "pre" }}>
        <span style={{ width: 10, height: 10, background: C.inactive, flex: "none" }} />
        <span style={{ fontFamily: sans, fontSize: 18, color: C.gray350 }}>bandsheet.pages.dev</span>
        <span style={{ marginLeft: -14 }}>
          <Type text="/unit/attack" start={B6.tryIt - 6} size={18} family={sans} weight={600} cps={0.5} />
        </span>
      </div>
    </div>
  )
}
