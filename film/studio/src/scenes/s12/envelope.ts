/**
 * S2 end pose, handed to S3 (see HANDOFF.md). Screen space, 1920×1080: an ink envelope outline,
 * square corners, 2px stroke, no fill, centred on the frame.
 */
export const ENV = {
  cx: 960,
  cy: 540,
  w: 360,
  h: 240,
  stroke: 2,
  flap: [
    { x: 780, y: 420 },
    { x: 960, y: 552 },
    { x: 1140, y: 420 },
  ],
}

type P = { x: number; y: number }

/** n points spaced evenly along the outline (rectangle perimeter, then the two flap strokes). */
export function envelopePoints(n: number): P[] {
  const l = ENV.cx - ENV.w / 2
  const r = ENV.cx + ENV.w / 2
  const tp = ENV.cy - ENV.h / 2
  const b = ENV.cy + ENV.h / 2
  const segs: [P, P][] = [
    [{ x: l, y: tp }, { x: r, y: tp }],
    [{ x: r, y: tp }, { x: r, y: b }],
    [{ x: r, y: b }, { x: l, y: b }],
    [{ x: l, y: b }, { x: l, y: tp }],
    [ENV.flap[0], ENV.flap[1]],
    [ENV.flap[1], ENV.flap[2]],
  ]
  const lens = segs.map(([a, c]) => Math.hypot(c.x - a.x, c.y - a.y))
  const total = lens.reduce((s, v) => s + v, 0)
  const out: P[] = []
  for (let i = 0; i < n; i++) {
    let d = ((i + 0.5) / n) * total
    let k = 0
    while (k < segs.length - 1 && d > lens[k]) {
      d -= lens[k]
      k++
    }
    const [a, c] = segs[k]
    const u = Math.min(1, d / lens[k])
    out.push({ x: a.x + (c.x - a.x) * u, y: a.y + (c.y - a.y) * u })
  }
  return out
}
