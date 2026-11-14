import { interpolate } from "remotion"
import { C, ease, easeOutQuint, sans } from "../../tokens"
import { S7B } from "./beats"
import { ASK_H, CHAT, CHIP_H, chatParts, grow, HEAD_H, NO_H, PAD, REP_H, ANS_H } from "./layout"
import { mono } from "./fonts"
import { TypeOn } from "./type"
import { Answer, NoSalary } from "./answer"
import capture from "./mcp-answer.json"

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const
const ASK: string = capture.question
/** The six tools registered in mcp/src/server.ts, in registration order. */
const TOOLS = ["get_bands", "list_releases", "explain_refusal", "verify_release", "try_subtraction", "pay_context"]
const ARGS = `{ "release_id": ${capture.arguments.release_id}, "cell": "${capture.arguments.cell}" }`

/** One node of the client → server → API chain. */
function Node({ p, label, sub, isMono }: { p: number; label: string; sub: string; isMono?: boolean }) {
  return (
    <div style={{ display: "inline-flex", alignItems: "baseline", gap: 10, opacity: p, transform: `translateY(${(1 - p) * 8}px)`, whiteSpace: "nowrap" }}>
      <span style={{ fontFamily: isMono ? mono : sans, fontWeight: isMono ? 500 : 600, fontSize: isMono ? 21 : 22, color: C.ink }}>{label}</span>
      <span style={{ fontFamily: sans, fontSize: 16, color: C.gray350 }}>{sub}</span>
    </div>
  )
}

function Link({ p }: { p: number }) {
  return (
    <div style={{ flex: 1, height: 2, margin: "0 22px", alignSelf: "center", position: "relative" }}>
      <div style={{ position: "absolute", left: 0, top: 0, height: 2, width: `${p * 100}%`, background: C.ink }} />
      <div style={{ position: "absolute", right: -2, top: -5, width: 0, height: 0, borderTop: "6px solid transparent", borderBottom: "6px solid transparent", borderLeft: `9px solid ${C.ink}`, opacity: p > 0.96 ? 1 : 0 }} />
    </div>
  )
}

/** Header: Claude (MCP client) → bandsheet-mcp → the Bandsheet API, then the six real tools. */
function Header({ f }: { f: number }) {
  const server = grow(f, S7B.cardIn + 8, 14)
  const client = grow(f, S7B.chain, 12)
  const l1 = interpolate(f, [S7B.chain + 4, S7B.chain + 18], [0, 1], { ...clamp, easing: ease })
  const l2 = interpolate(f, [S7B.tools - 6, S7B.tools + 6], [0, 1], { ...clamp, easing: ease })
  const api = grow(f, S7B.tools + 2, 10)
  return (
    <div style={{ height: HEAD_H, boxSizing: "border-box", background: C.band, borderBottom: `2px solid ${C.ink}`, padding: "22px 36px 0" }}>
      <div style={{ display: "flex", alignItems: "center" }}>
        <Node p={client} label="Claude" sub="MCP client" />
        <Link p={l1} />
        <Node p={server} label="bandsheet-mcp" sub="MCP server" isMono />
        <Link p={l2} />
        <Node p={api} label="bandsheet.pages.dev" sub="read-only API" isMono />
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
        {TOOLS.map((t, i) => {
          const p = interpolate(f, [S7B.tools + i * 3, S7B.tools + i * 3 + 10], [0, 1], { ...clamp, easing: easeOutQuint })
          const pick = t === "explain_refusal" ? interpolate(f, [S7B.chipIn - 4, S7B.chipIn + 6], [0, 1], clamp) : 0
          return (
            <span
              key={t}
              style={{
                fontFamily: mono,
                fontSize: 17,
                padding: "5px 11px",
                border: `2px solid ${pick > 0.5 ? C.lav300 : C.line}`,
                background: pick > 0.5 ? C.lav100 : C.paper,
                color: pick > 0.5 ? C.ink : C.gray350,
                opacity: p,
                transform: `translateY(${(1 - p) * 10}px)`,
              }}
            >
              {t}
            </span>
          )
        })}
      </div>
    </div>
  )
}

/** Our own neutral chat card (no third-party chrome): the MCP chain, the rep's question, the tool call, the real answer. */
export function ChatCard({ f }: { f: number }) {
  const inP = interpolate(f, [S7B.cardIn, S7B.cardIn + 24], [0, 1], { ...clamp, easing: easeOutQuint })
  const { ask, chip, ans, no, h } = chatParts(f)
  const run = interpolate(f, [S7B.chipIn + 4, S7B.chipDone], [0, 1], { ...clamp, easing: ease })
  const done = f >= S7B.chipDone
  return (
    <div
      style={{
        position: "absolute",
        left: CHAT.x,
        top: CHAT.y,
        width: CHAT.w,
        height: h,
        boxSizing: "border-box",
        border: `2px solid ${C.ink}`,
        background: C.paper,
        overflow: "hidden",
        opacity: inP,
        transform: `translateY(${(1 - inP) * 36}px)`,
      }}
    >
      <Header f={f} />
      <div style={{ padding: `${PAD}px 44px 0`, display: "flex", flexDirection: "column" }}>
        <div style={{ height: REP_H, alignSelf: "flex-end", fontFamily: sans, fontWeight: 600, fontSize: 18, color: C.gray350 }}>
          Union rep · Harbour Courier chapel
        </div>
        {/* the rep's question */}
        <div style={{ height: ASK_H, alignSelf: "flex-end", opacity: ask }}>
          <div style={{ marginTop: 6, background: C.band, padding: "14px 26px", fontFamily: sans, fontSize: 33, lineHeight: 1.3 }}>
            <TypeOn text={ASK} frame={f} start={S7B.askType} rate={S7B.askRate} />
          </div>
        </div>
        {/* tool call */}
        <div style={{ height: CHIP_H, opacity: chip, transform: `translateX(${(1 - chip) * -18}px)` }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 18,
              border: `2px solid ${C.lav300}`,
              background: C.lav100,
              padding: "11px 20px",
              position: "relative",
              overflow: "hidden",
              whiteSpace: "nowrap",
            }}
          >
            <span style={{ fontFamily: sans, fontWeight: 600, fontSize: 17, color: C.gray350 }}>Tool call</span>
            <span style={{ fontFamily: mono, fontSize: 23, color: C.ink, fontWeight: 500 }}>explain_refusal</span>
            <span style={{ fontFamily: mono, fontSize: 19, color: C.gray350 }}>{ARGS}</span>
            <span style={{ fontFamily: sans, fontWeight: 600, fontSize: 17, color: done ? C.green : C.lav300, minWidth: 92 }}>{done ? "✓ returned" : "running"}</span>
            <div style={{ position: "absolute", left: 0, bottom: 0, height: 3, width: `${run * 100}%`, background: C.lav300, opacity: done ? 0 : 1 }} />
          </div>
        </div>
        {/* the answer, verbatim */}
        <div style={{ height: ANS_H, opacity: ans > 0 ? 1 : 0 }}>
          <div style={{ fontFamily: sans, fontWeight: 600, fontSize: 17, color: C.green, marginBottom: 10, opacity: grow(f, S7B.answer - 4, 8) }}>
            explain_refusal returned · verbatim
          </div>
          <Answer f={f} />
        </div>
        <div style={{ height: NO_H, borderTop: `2px solid ${C.line}`, paddingTop: 18, boxSizing: "border-box", opacity: no > 0 ? 1 : 0 }}>
          <NoSalary f={f} />
        </div>
      </div>
    </div>
  )
}
