import type { CSSProperties, ReactNode } from "react"
import { interpolate } from "remotion"
import { C, sans, serif } from "../../tokens"
import { B, GRADES, L, bottomRule, rowY, sepY } from "./data"
import { cl, ez, groupOf, rowState, type Group } from "./rows"
import { Stamp } from "./Stamp"
import { Rule, TypeOn } from "./type"

const num: CSSProperties = { fontVariantNumeric: "tabular-nums lining-nums" }
const serifNum: CSSProperties = { fontFamily: serif, fontWeight: 500, fontSize: 33, color: C.ink, ...num }

function Moved({ k, group, t, children }: { k: 0 | 1; group: Group; t: number; children: ReactNode }) {
  const s = rowState(k, group, t)
  return (
    <div style={{ position: "absolute", inset: 0, transform: `translate(${s.dx}px, ${s.dy}px)`, opacity: s.o }}>
      {children}
    </div>
  )
}

/** Absolutely placed single line, vertically centred on y. */
function Cell({ x, y, w, align = "left", children }: { x: number; y: number; w: number; align?: "left" | "right"; children: ReactNode }) {
  return (
    <div style={{ position: "absolute", left: x, top: y - 24, width: w, height: 48, lineHeight: "48px", textAlign: align }}>
      {children}
    </div>
  )
}

/** One honest release: title, 2px ruled header and five grade rows typing on per glyph. */
export function Table({ k, t }: { k: 0 | 1; t: number }) {
  const x0 = L.tableX[k]
  const title = k === 0 ? B.r1Title : B.r2Title
  const rows0 = k === 0 ? B.r1Rows : B.r2Rows
  const rowGap = k === 0 ? 7 : 6
  const when = k === 0 ? "October" : "November"
  return (
    <>
      <Moved k={k} group="up" t={t}>
        <Cell x={x0} y={L.titleY} w={360}>
          <TypeOn text={`Release #${k + 1}`} t={t} start={title} rate={1.2} style={{ fontFamily: serif, fontWeight: 500, fontSize: 46, letterSpacing: "-0.01em" }} />
        </Cell>
        <Cell x={x0 + L.tableW - 380} y={L.titleY + 6} w={380} align="right">
          <TypeOn text={`Mean pay by grade · ${when}`} t={t} start={title + 8} rate={0.6} color={C.gray350} style={{ fontFamily: sans, fontSize: 19 }} />
        </Cell>
        <Rule x={x0} y={L.topRule} w={L.tableW} t={t} start={title + 4} dur={20} />
        {(["Grade", "Members", "Mean pay"] as const).map((h, i) => {
          const right = [0, L.nRight, L.meanRight][i]
          const style: CSSProperties = { fontFamily: sans, fontWeight: 600, fontSize: 14, letterSpacing: "0.08em", textTransform: "uppercase" }
          return i === 0 ? (
            <Cell key={h} x={x0} y={L.headerY} w={200}>
              <TypeOn text={h} t={t} start={title + 12} rate={0.7} color={C.gray350} style={style} />
            </Cell>
          ) : (
            <Cell key={h} x={x0 + right - 200} y={L.headerY} w={200} align="right">
              <TypeOn text={h} t={t} start={title + 12 + i * 3} rate={0.7} color={C.gray350} style={style} />
            </Cell>
          )
        })}
        <Rule x={x0} y={L.headerRule} w={L.tableW} t={t} start={title + 14} dur={18} color={C.line} />
        <Rule x={x0} y={sepY(0)} w={L.tableW} t={t} start={rows0 + 4} color={C.line} />
        <Rule x={x0} y={sepY(1)} w={L.tableW} t={t} start={rows0 + rowGap + 4} color={C.line} />
      </Moved>
      <Moved k={k} group="down" t={t}>
        <Rule x={x0} y={sepY(2)} w={L.tableW} t={t} start={rows0 + 2 * rowGap + 4} color={C.line} />
        <Rule x={x0} y={sepY(3)} w={L.tableW} t={t} start={rows0 + 3 * rowGap + 4} color={C.line} />
        <Rule x={x0} y={bottomRule} w={L.tableW} t={t} start={rows0 + 4 * rowGap + 4} dur={20} />
        <Stamp x={x0} y={bottomRule + 44} t={t} at={t < B.back ? B.stampSafe + k * 5 : B.stamp + k * 3} />
      </Moved>
      {GRADES.map((g, i) => {
        const st = rows0 + i * rowGap
        const y = rowY(i)
        const n = k === 0 ? g.n1 : g.n2
        const m = k === 0 ? g.m1 : g.m2
        const safeAt = B.safe + (k * 5 + i) * 4
        const backAt = B.honest + (k * 5 + i) * 2
        const hl =
          t < B.back
            ? interpolate(t, [safeAt, safeAt + 9], [0, 1], ez) * interpolate(t, [B.t1, B.t1 + 10], [1, 0], cl)
            : interpolate(t, [backAt, backAt + 9], [0, 1], ez)
        return (
          <Moved key={g.grade} k={k} group={groupOf(i)} t={t}>
            <div
              style={{
                position: "absolute",
                left: x0 + L.nRight - 52,
                top: y - 19,
                width: 64,
                height: 38,
                background: C.lav100,
                transform: `scaleX(${hl})`,
                opacity: hl > 0 ? 1 : 0,
              }}
            />
            <Cell x={x0} y={y} w={200}>
              <TypeOn text={g.grade} t={t} start={st} style={{ fontFamily: sans, fontSize: 26, color: C.text }} color={C.text} />
            </Cell>
            <Cell x={x0 + L.nRight - 120} y={y} w={120} align="right">
              <TypeOn text={String(n)} t={t} start={st + 5} style={{ fontFamily: sans, fontSize: 26, fontVariantNumeric: "lining-nums" }} />
            </Cell>
            <Cell x={x0 + L.meanRight - 200} y={y + 1} w={200} align="right">
              <TypeOn text={m} t={t} start={st + 7} style={serifNum} />
            </Cell>
          </Moved>
        )
      })}
    </>
  )
}
