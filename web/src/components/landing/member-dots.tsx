import { motion, useTransform, type MotionValue } from "motion/react"

/** Seeded unit: members per grade (synthetic Harbour Courier chapel). Senior gains one joiner. */
const COLS = [
  { grade: "Junior", n: 8 },
  { grade: "Reporter", n: 11 },
  { grade: "Senior", n: 9 },
  { grade: "Editor", n: 5 },
  { grade: "Chief", n: 3 },
]
const R = 9
const GAP = 27
const BASE_Y = 360
const colX = (c: number) => 70 + c * 95
const dotY = (i: number) => BASE_Y - i * GAP

const INK = "#0f3026"
const LAV = "#b9abff"
const IDLE = "#cfd3d1"
const ALARM = "#c8344f"

/** Scroll-scrubbed member dots: publish, join, subtract, refuse, publish the rest. */
export function MemberDots({ p }: { p: MotionValue<number> }) {
  const seniorFill = useTransform(p, [0.1, 0.2, 0.42, 0.52, 0.62, 0.72], [IDLE, LAV, LAV, LAV, LAV, INK])
  const seniorOpacity = useTransform(p, [0.42, 0.52, 0.62, 0.72], [1, 0.18, 0.18, 1])
  const otherFill = useTransform(p, [0.78, 0.9], [IDLE, INK])
  const joinY = useTransform(p, [0.24, 0.36], [-120, dotY(9)])
  const joinOpacity = useTransform(p, [0.22, 0.27], [0, 1])
  const joinFill = useTransform(p, [0.3, 0.36, 0.44, 0.52, 0.62, 0.72], [LAV, LAV, LAV, ALARM, ALARM, INK])
  const joinR = useTransform(p, [0.44, 0.52, 0.62, 0.7], [R, R * 1.6, R * 1.6, R])
  const leakOpacity = useTransform(p, [0.46, 0.53, 0.6, 0.66], [0, 1, 1, 0])
  const lockLen = useTransform(p, [0.6, 0.72], [0, 1])
  const withheldOpacity = useTransform(p, [0.68, 0.74], [0, 1])
  const r1Opacity = useTransform(p, [0.14, 0.2, 0.36, 0.42], [0, 1, 1, 0])
  const r2Opacity = useTransform(p, [0.36, 0.42, 0.56, 0.6], [0, 1, 1, 0])

  const sx = colX(2)
  const top = dotY(9) - 30

  return (
    <svg viewBox="0 0 520 430" className="h-auto w-full overflow-visible" role="img" aria-label="Members by grade. A tenth Senior joins; subtracting two releases would expose them, so Bandsheet withholds the Senior band.">
      {COLS.map((col, c) =>
        Array.from({ length: col.n }, (_, i) => (
          <motion.circle
            key={`${c}-${i}`}
            cx={colX(c)}
            cy={dotY(i)}
            r={R}
            style={c === 2 ? { fill: seniorFill, opacity: seniorOpacity } : { fill: otherFill }}
          />
        )),
      )}
      <motion.circle cx={sx} r={joinR} style={{ cy: joinY, opacity: joinOpacity, fill: joinFill }} />

      <motion.rect
        x={sx - 26}
        y={top}
        width={52}
        height={BASE_Y - top + 26}
        fill="none"
        stroke={INK}
        strokeWidth={2}
        style={{ pathLength: lockLen }}
      />
      <motion.g style={{ opacity: withheldOpacity }}>
        <rect x={sx - 9} y={top - 34} width={18} height={14} fill={INK} />
        <path d={`M${sx - 6} ${top - 34} v-5 a6 6 0 0 1 12 0 v5`} fill="none" stroke={INK} strokeWidth={2} />
      </motion.g>

      <motion.g style={{ opacity: leakOpacity }}>
        <text x={sx + 34} y={dotY(9) + 6} fill={ALARM} className="font-serif" fontSize="30" fontWeight={500}>
          €70,000
        </text>
        <text x={sx + 35} y={dotY(9) + 26} fill={ALARM} fontSize="12">
          one salary, by subtraction
        </text>
      </motion.g>
      <motion.text x={sx} y={top - 46} textAnchor="middle" fill={INK} fontSize="12" style={{ opacity: r1Opacity }}>
        9 · mean €62,400
      </motion.text>
      <motion.text x={sx} y={top - 46} textAnchor="middle" fill={INK} fontSize="12" style={{ opacity: r2Opacity }}>
        10 · mean €63,160
      </motion.text>

      {COLS.map((col, c) => (
        <text key={col.grade} x={colX(c)} y={BASE_Y + 40} textAnchor="middle" fill={INK} fontSize="13">
          {col.grade}
        </text>
      ))}
    </svg>
  )
}
