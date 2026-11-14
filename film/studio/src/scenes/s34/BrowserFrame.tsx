import type { ReactNode } from "react"
import { OffthreadVideo, staticFile } from "remotion"
import { C, sans } from "../../tokens"

export const BR_W = 1480
export const BR_H = 780
export const BAR_H = 52

/** Our own minimal browser chrome (no real browser brand): square corners, 2px ink rule. */
export function BrowserFrame({ url, footage, children, w = BR_W, h = BR_H }: { url: string; footage?: string; children?: ReactNode; w?: number; h?: number }) {
  return (
    <div style={{ width: w, height: h, background: C.paper, border: `2px solid ${C.ink}`, boxSizing: "border-box", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ height: BAR_H, flexShrink: 0, display: "flex", alignItems: "center", gap: 18, padding: "0 20px", background: C.band, borderBottom: `2px solid ${C.ink}` }}>
        <div style={{ display: "flex", gap: 8 }}>
          {[0, 1, 2].map((i) => (
            <span key={i} style={{ width: 12, height: 12, border: `2px solid ${C.ink}`, boxSizing: "border-box", background: i === 0 ? C.ink : "transparent" }} />
          ))}
        </div>
        <div style={{ flex: 1, maxWidth: 720, margin: "0 auto", height: 32, background: C.paper, border: `1px solid ${C.line}`, display: "flex", alignItems: "center", padding: "0 14px", fontFamily: sans, fontSize: 17, color: C.gray350 }}>
          {url}
        </div>
        <span style={{ width: 54 }} />
      </div>
      <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
        {footage ? <OffthreadVideo src={staticFile(footage)} muted style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : children}
      </div>
    </div>
  )
}
