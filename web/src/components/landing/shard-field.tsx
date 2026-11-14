import { useMemo } from "react"

/**
 * Hero art: a fan of pay-band "shards" radiating from a top-right vertex, crisp at the vertex and
 * blurred into round caps at the far end. Our own generated SVG in Greenlock's composition.
 */
const VERTEX = { x: 1330, y: 40 }
const LAV = "#cdc2ff"
const GREEN = "#1f5249"

type Shard = { a0: number; a1: number; len: number; fill: string; dur: number; sway: number }

function polar(angleDeg: number, r: number) {
  const a = (angleDeg * Math.PI) / 180
  return { x: VERTEX.x + Math.cos(a) * r, y: VERTEX.y + Math.sin(a) * r }
}

export function ShardField({ mobile = false }: { mobile?: boolean }) {
  const shards = useMemo<Shard[]>(() => {
    const out: Shard[] = []
    const start = 96
    const end = 200
    const n = 9
    const greens = new Set([2, 4, 6, 7])
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1)
      const a0 = start + (end - start) * t - 4
      const width = 7.5 + ((i * 37) % 5) * 1.3
      const steep = Math.max(0, Math.min(1, (150 - a0) / 50))
      const len = 600 + steep * 360 + ((i * 53) % 4) * 40
      out.push({
        a0,
        a1: a0 + width,
        len,
        fill: greens.has(i) ? GREEN : LAV,
        dur: 8 + ((i * 29) % 6),
        sway: 1.2 + ((i * 17) % 4) * 0.4,
      })
    }
    return out
  }, [])

  return (
    <svg
      viewBox={mobile ? "880 0 560 1100" : "0 0 1440 900"}
      preserveAspectRatio="xMidYMid slice"
      className="absolute inset-0 size-full"
      aria-hidden="true"
    >
      <defs>
        <filter id="cap-blur" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="30" />
        </filter>
        <filter id="soft" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="1.2" />
        </filter>
        <radialGradient id="hero-glow" cx="80%" cy="10%" r="90%">
          <stop offset="0" stopColor="#f2f1f2" />
          <stop offset="1" stopColor="#e4e3e5" />
        </radialGradient>
      </defs>
      <rect x="0" y="0" width="1440" height="1100" fill="url(#hero-glow)" />
      {shards.map((s, i) => {
        const p0 = polar(s.a0, s.len)
        const p1 = polar(s.a1, s.len)
        const mid = polar((s.a0 + s.a1) / 2, s.len)
        const capR = Math.hypot(p1.x - p0.x, p1.y - p0.y) * 0.58
        const style = {
          "--r0": `${-s.sway}deg`,
          "--r1": `${s.sway}deg`,
          "--dur": `${s.dur}s`,
          transformOrigin: `${VERTEX.x}px ${VERTEX.y}px`,
          transformBox: "view-box",
        } as React.CSSProperties
        return (
          <g key={i} className="shard" style={style} opacity={s.fill === GREEN ? 0.95 : 0.9}>
            <path
              d={`M${VERTEX.x} ${VERTEX.y} L${p0.x} ${p0.y} L${p1.x} ${p1.y} Z`}
              fill={s.fill}
              filter="url(#soft)"
            />
            <circle cx={mid.x} cy={mid.y} r={capR} fill={s.fill} filter="url(#cap-blur)" />
          </g>
        )
      })}
    </svg>
  )
}
