import { interpolate, interpolateColors } from "remotion"
import { C, easeOutQuint } from "../../tokens"
import { B, GRADES, L, SENIOR, dotX, rand, rowY } from "./data"
import { cl, ez, groupOf, rowState } from "./rows"

const IDLE = "#cfd3d1"

type DotDraw = { x: number; y: number; r: number; fill: string; o: number; blur: number; key: string }

/** Scatter field the Release #1 members gather from: right half and the strip under table 1, never left of x=640. */
function scatter(seed: number) {
  const below = rand(seed) < 0.22
  const x = below ? 640 + rand(seed + 1) * 300 : 960 + rand(seed + 1) * 880
  const y = below ? 690 + rand(seed + 2) * 100 : 110 + rand(seed + 2) * 690
  const z = 0.7 + rand(seed + 3) * 0.75
  return { x, y, z }
}

/** Where a seated dot sits in S2 (follows its row as T1 moves it). */
function seated(k: 0 | 1, g: number, j: number, t: number) {
  const s = rowState(k, groupOf(g), t)
  return { x: dotX(k, j) + s.dx, y: rowY(g) + s.dy, o: s.o }
}

/** S2: the nine members both releases share fade out pairwise, left to right; they are back in full when the honest tables return. */
function shared(g: number, j: number, t: number) {
  if (g !== SENIOR) return 1
  const a = B.cancel + j * 3
  const c = interpolate(t, [a, a + 10], [1, 0.12], ez)
  const back = interpolate(t, [B.back + 16 + j, B.back + 28 + j], [0, 1], ez)
  return c + (1 - c) * back
}

export function dotDraws(t: number): DotDraw[] {
  const out: DotDraw[] = []
  GRADES.forEach((g, gi) => {
    for (let j = 0; j < g.n1; j++) {
      // Release #1 member: drifts in the field, then gathers beside its row.
      const seed = gi * 40 + j * 3 + 1
      const sc = scatter(seed)
      const gs = B.gather + gi * 6 + j * 1.3
      const u = interpolate(t, [gs, gs + 28], [0, 1], { ...cl, easing: easeOutQuint })
      const drift = (1 - u) * 1
      const sx = sc.x + Math.sin(t / 37 + seed) * 14 * drift
      const sy = sc.y + Math.cos(t / 41 + seed * 1.7) * 10 * drift
      const home = seated(0, gi, j, t)
      const bend = Math.sin(Math.PI * u) * (rand(seed + 7) - 0.5) * 70
      const z = sc.z + (1 - sc.z) * u
      out.push({
        key: `a${gi}-${j}`,
        x: sx + (home.x - sx) * u,
        y: sy + (home.y - sy) * u + bend,
        r: L.dotR * z,
        fill: interpolateColors(u, [0, 0.55, 1], [IDLE, IDLE, C.ink]),
        o: home.o * shared(gi, j, t),
        blur: Math.abs(1 - z) * 9,
      })
      // Release #2 copy: the same member counted again a month later, arcing across.
      const cs = B.copies + gi * 5 + (g.n1 - 1 - j)
      const v = interpolate(t, [cs, cs + 22], [0, 1], ez)
      if (v <= 0) continue
      const from = seated(0, gi, j, t)
      const to = seated(1, gi, j, t)
      const x = from.x + (to.x - from.x) * v
      const y = from.y + (to.y - from.y) * v + Math.sin(Math.PI * v) * 24
      out.push({
        key: `b${gi}-${j}`,
        x,
        y,
        r: L.dotR,
        fill: C.ink,
        o: interpolate(v, [0, 0.15], [0, 1], cl) * to.o * shared(gi, j, t),
        blur: Math.sin(Math.PI * v) * 1.2,
      })
    }
  })
  return out
}

/** Noor Haddad: the one reporter who joins between the releases (Senior, 10th dot of release #2). */
export function noor(t: number) {
  const home = seated(1, SENIOR, 9, t)
  const d = interpolate(t, [B.noor, B.noor + 26], [0, 1], { ...cl, easing: easeOutQuint })
  const y = -80 + (home.y + 80) * d
  const swell = interpolate(t, [B.swell, B.swell + 8, B.swell + 14], [1, 2.1, 1.75], ez)
  const fill = interpolateColors(t, [B.swell, B.swell + 6], [C.lav300, C.alarm])
  const ring = interpolate(t, [B.noor + 20, B.noor + 44], [0, 1], cl)
  const ring2 = interpolate(t, [B.swell + 4, B.swell + 30], [0, 1], cl)
  return { x: home.x, y, r: L.dotR * swell, fill, o: home.o, ring, ring2, blur: (1 - d) * 4 }
}

export function Dots({ t }: { t: number }) {
  const n = noor(t)
  return (
    <>
      {dotDraws(t).map((d) => (
        <div
          key={d.key}
          style={{
            position: "absolute",
            left: d.x - d.r,
            top: d.y - d.r,
            width: d.r * 2,
            height: d.r * 2,
            borderRadius: "50%",
            background: d.fill,
            opacity: d.o,
            filter: d.blur > 0.3 ? `blur(${d.blur.toFixed(2)}px)` : undefined,
          }}
        />
      ))}
      {t >= B.noor ? (
        <>
          {[n.ring, n.ring2].map((p, i) =>
            p > 0 && p < 1 ? (
              <div
                key={i}
                style={{
                  position: "absolute",
                  left: n.x - (10 + p * 26),
                  top: n.y - (10 + p * 26),
                  width: (10 + p * 26) * 2,
                  height: (10 + p * 26) * 2,
                  borderRadius: "50%",
                  border: `2px solid ${i === 0 ? C.lav300 : C.alarm}`,
                  opacity: (1 - p) * 0.8 * n.o,
                }}
              />
            ) : null,
          )}
          <div
            style={{
              position: "absolute",
              left: n.x - n.r,
              top: n.y - n.r,
              width: n.r * 2,
              height: n.r * 2,
              borderRadius: "50%",
              background: n.fill,
              opacity: n.o,
              filter: n.blur > 0.3 ? `blur(${n.blur.toFixed(2)}px)` : undefined,
            }}
          />
        </>
      ) : null}
    </>
  )
}
