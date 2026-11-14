import type { CSSProperties } from "react"
import { interpolate } from "remotion"
import { C, sans, serif } from "../../tokens"
import { B, STACK, L } from "./data"
import { cl, ez, midDy, stackFade, t2Fade } from "./rows"
import { Rule, TypeOn } from "./type"
import type { Glyphs } from "./textPoints"

export const FIG = { text: "€70,000", size: 100 }
const num: CSSProperties = { fontVariantNumeric: "tabular-nums lining-nums" }
const eqStyle: CSSProperties = { fontFamily: serif, fontWeight: 500, fontSize: 34, ...num }

function Centred({ y, children, h = 56 }: { y: number; h?: number; children: React.ReactNode }) {
  return (
    <div style={{ position: "absolute", left: 360, width: 1200, top: y - h / 2, height: h, lineHeight: `${h}px`, textAlign: "center" }}>
      {children}
    </div>
  )
}

/** Visibility of the €70,000 glyphs as a whole: hidden the instant T2 particles take over. */
export const figureOn = (t: number) => (t < B.t2 ? 1 : interpolate(t, [B.t2, B.t2 + 2], [1, 0], cl))
/** World baseline of €70,000: the stack, then the gap between the returned tables. T2 samples from here. */
export const figY = (t: number) => STACK.figY + midDy(t)

const layer = { position: "absolute", left: 0, top: 0, width: 1920, height: 1080 } as const

/** S2 world text: release tags, the subtraction rule, the equation that resolves, €70,000 and its label. */
export function Equation({ t, g }: { t: number; g: Glyphs }) {
  if (t < B.t1) return null
  const fade = t2Fade(t)
  const lift = midDy(t)
  const tag: CSSProperties = { fontFamily: sans, fontWeight: 600, fontSize: 15, letterSpacing: "0.08em", textTransform: "uppercase" }
  return (
    <>
      <div style={{ ...layer, opacity: stackFade(t) }}>
        {[STACK.yTop, STACK.yBot].map((y, i) => (
          <div key={y} style={{ position: "absolute", left: STACK.x - 132, width: 112, top: y - 24, height: 48, lineHeight: "48px", textAlign: "right" }}>
            <TypeOn text={`Release #${2 - i}`} t={t} start={B.t1 + 18 + i * 4} rate={0.6} color={C.gray350} style={tag} />
          </div>
        ))}
        <Rule x={STACK.x} y={STACK.rule} w={L.tableW} t={t} start={B.rule2} dur={18} />
      </div>
      <div style={{ ...layer, opacity: fade, transform: `translateY(${lift}px)` }}>
        <Centred y={STACK.eqY}>
          <TypeOn text="10 × €63,160 − 9 × €62,400" t={t} start={B.eq} rate={1.1} out={B.resolve} style={eqStyle} />
        </Centred>
        <Centred y={STACK.eqY}>
          <TypeOn text="€631,600 − €561,600" t={t} start={B.resolve + 8} rate={1} style={eqStyle} />
        </Centred>
        <Centred y={STACK.labelY} h={40}>
          <TypeOn text="Noor's salary, exposed" t={t} start={B.label} rate={0.8} style={{ fontFamily: sans, fontWeight: 600, fontSize: 24, color: C.ink }} />
        </Centred>
      </div>
      <svg width={1920} height={1080} style={{ position: "absolute", left: 0, top: 0, overflow: "visible", opacity: figureOn(t) }}>
        {[...FIG.text].map((ch, i) => {
          const a = t - (B.figure + i * 2.5)
          const o = interpolate(a, [0, 14], [0, 1], cl)
          const blur = interpolate(a, [0, 18], [10, 0], ez)
          const dy = interpolate(a, [0, 18], [0.12, 0], ez) * FIG.size
          if (o <= 0 || g.xs.length === 0) return null
          return (
            <text
              key={i}
              x={960 + g.xs[i]}
              y={figY(t) + dy}
              fill={C.alarm}
              fontFamily={serif}
              fontWeight={500}
              fontSize={FIG.size}
              style={{ opacity: o, filter: blur > 0.2 ? `blur(${blur.toFixed(2)}px)` : undefined }}
            >
              {ch}
            </text>
          )
        })}
      </svg>
    </>
  )
}
