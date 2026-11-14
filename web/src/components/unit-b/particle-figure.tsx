import type { ReactNode } from "react"
import { motion, useReducedMotion } from "motion/react"
import { cn } from "@/lib/utils"

const EASE = [0.25, 0.1, 0.25, 1] as const

/** Deterministic scatter so the reveal is the same on every replay (and in the demo video). */
function rand(seed: number) {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453
  return x - Math.floor(x)
}

const PER_CHAR = 7

/**
 * A figure that assembles from scattered particles: each glyph gets a few small squares that drift
 * in from around it and fade as the glyph sharpens out of a blur. Calm: one ease, under 2 s total.
 */
export function ParticleFigure({
  text,
  delay = 0,
  className,
  underline = true,
}: {
  text: string
  delay?: number
  className?: string
  underline?: boolean
}) {
  const reduce = useReducedMotion()
  const chars = [...text]
  const stagger = 0.05
  const settle = delay + 0.55 + chars.length * stagger

  if (reduce) {
    return (
      <span className={cn("relative inline-block", className)}>
        {text}
        {underline && <span aria-hidden className="absolute inset-x-0 -bottom-1 h-[2px] bg-current" />}
      </span>
    )
  }

  return (
    <span className={cn("relative inline-flex", className)} aria-label={text} role="img">
      {chars.map((ch, i) => (
        <span key={i} aria-hidden className="relative inline-block">
          {Array.from({ length: PER_CHAR }, (_, j) => {
            const s = i * 31 + j * 7 + 1
            const angle = rand(s) * Math.PI * 2
            const radius = 50 + rand(s + 3) * 110
            const size = 2 + Math.round(rand(s + 5) * 3)
            return (
              <motion.span
                key={j}
                className="pointer-events-none absolute top-1/2 left-1/2 bg-current"
                style={{ width: size, height: size }}
                initial={{ x: Math.cos(angle) * radius, y: Math.sin(angle) * radius * 0.6, opacity: 0 }}
                animate={{ x: 0, y: 0, opacity: [0, 0.9, 0] }}
                transition={{ duration: 0.95, delay: delay + i * stagger + rand(s + 9) * 0.25, ease: EASE, opacity: { times: [0, 0.4, 1], duration: 0.95, delay: delay + i * stagger + rand(s + 9) * 0.25 } }}
              />
            )
          })}
          <motion.span
            className="inline-block"
            initial={{ opacity: 0, filter: "blur(10px)", y: "0.12em" }}
            animate={{ opacity: 1, filter: "blur(0px)", y: "0em" }}
            transition={{ duration: 0.6, delay: delay + 0.5 + i * stagger, ease: EASE }}
          >
            {ch === " " ? " " : ch}
          </motion.span>
        </span>
      ))}
      {underline && (
        <motion.span
          aria-hidden
          className="absolute inset-x-0 -bottom-1 h-[2px] origin-left bg-current"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.4, delay: settle, ease: EASE }}
        />
      )}
    </span>
  )
}

/** Fade-and-rise line used in the working (500ms, Greenlock ease). */
export function Step({ at, children, className }: { at: number; children?: ReactNode; className?: string }) {
  const reduce = useReducedMotion()
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: at, ease: EASE }}
    >
      {children}
    </motion.div>
  )
}

/** A padlock whose shackle drops shut. */
export function SettlingLock({ at = 0, className }: { at?: number; className?: string }) {
  const reduce = useReducedMotion()
  return (
    <svg viewBox="0 0 40 48" className={cn("h-12 w-10 shrink-0", className)} aria-hidden>
      <motion.path
        d="M11 22 V14 a9 9 0 0 1 18 0 V22"
        fill="none"
        stroke="var(--ink)"
        strokeWidth="3"
        initial={reduce ? false : { y: -7, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, delay: at + 0.25, ease: EASE }}
      />
      <motion.rect
        x="4"
        y="21"
        width="32"
        height="24"
        fill="var(--ink)"
        initial={reduce ? false : { opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: at, ease: EASE }}
      />
      <motion.rect
        x="18"
        y="29"
        width="4"
        height="8"
        fill="var(--purple-200)"
        initial={reduce ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: at + 0.6, ease: EASE }}
      />
    </svg>
  )
}
