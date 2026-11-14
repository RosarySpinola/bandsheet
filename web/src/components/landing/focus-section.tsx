import { useRef, useState } from "react"
import { motion, useMotionValueEvent, useReducedMotion, useScroll, useSpring, useTransform } from "motion/react"
import { cn } from "@/lib/utils"

const SET_A = [
  "Release #1: Senior, 9 members",
  "Release #2: Senior, 10 members",
  "10 × €63,160 − 9 × €62,400",
  "= €70,000, one person's salary",
]
const SET_B = [
  "Replays every earlier release",
  "Solves the attacker's equations",
  "Withholds the Senior band",
  "Writes the refusal to NEAR",
]
/* Greenlock label offsets: staggered right edges, absolute, ~13rem wide. */
const OFFSETS = [3, 0, 5, 1.5]

/** Greenlock "focus" section: 480px band, crystal scrubbed across its pass through the viewport, headline and label sets swap at 40%. */
export function FocusSection() {
  const ref = useRef<HTMLElement | null>(null)
  const reduce = useReducedMotion()
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] })
  const p = useSpring(scrollYProgress, { stiffness: 140, damping: 32, mass: 0.4 })
  const rotate = useTransform(p, [0, 1], reduce ? [0, 0] : [-14, 16])
  const scale = useTransform(p, [0, 0.5, 1], reduce ? [1, 1, 1] : [0.94, 1.03, 0.98])
  const [second, setSecond] = useState(false)
  useMotionValueEvent(scrollYProgress, "change", (v) => setSecond(v >= 0.5))

  return (
    <section id="how" ref={ref} className="relative overflow-hidden bg-white">
      <div className="flex min-h-[calc(var(--gl)*40.75)] items-center py-[calc(var(--gl)*2)] max-[991px]:py-12">
        <div className="gl-container grid w-full grid-cols-[1.3fr_0.85fr_0.85fr] items-center gap-[calc(var(--gl)*2)] max-[991px]:grid-cols-1 max-[991px]:gap-6">
          <div className="flex flex-col justify-between gap-[calc(var(--gl)*8)] self-stretch py-[calc(var(--gl)*2.5)] max-[991px]:gap-2 max-[991px]:py-0">
            <h2 className={cn("gl-h1 transition-colors duration-[400ms] ease-gl", second ? "text-ghost!" : "text-ink")}>
              A typical tool publishes both tables.
            </h2>
            <h2 className={cn("gl-h1 transition-colors duration-[400ms] ease-gl", second ? "text-ink" : "text-ghost!")}>
              Bandsheet remembers the first one.
            </h2>
          </div>

          <motion.div style={{ rotate, scale }} className="relative mx-auto aspect-square w-full max-w-[calc(var(--gl)*30)] max-[991px]:max-w-[min(26rem,78vw)]">
            <img src="/landing/crystal-gem.webp" alt="" width={800} height={800} className="absolute inset-0 size-full mix-blend-multiply" />
            <img
              src="/landing/crystal-gem-b.webp"
              alt=""
              width={800}
              height={800}
              className={cn("absolute inset-0 size-full mix-blend-multiply transition-opacity duration-700 ease-gl", second ? "opacity-100" : "opacity-0")}
            />
          </motion.div>

          <div className="relative h-[calc(var(--gl)*32)] max-[991px]:h-auto">
            {[SET_A, SET_B].map((set, si) => (
              <ul
                key={si}
                aria-hidden={(si === 1) !== second}
                className={cn(
                  "absolute inset-0 transition-opacity duration-[400ms] ease-gl max-[991px]:grid max-[991px]:grid-cols-2 max-[991px]:gap-x-4 max-[991px]:gap-y-2",
                  (si === 1) === second ? "opacity-100" : "opacity-0",
                  si === 0 ? "max-[991px]:relative" : "",
                )}
              >
                {set.map((label, i) => (
                  <li
                    key={label}
                    className={cn("gl-label absolute max-w-[calc(var(--gl)*21)] text-text max-[991px]:static max-[991px]:max-w-none max-[991px]:text-sm max-[991px]:leading-5", i >= 2 && "max-[991px]:col-span-2")}
                    style={{ top: `${6 + i * 24}%`, right: `calc(var(--gl) * ${OFFSETS[i]})` }}
                  >
                    {label}
                  </li>
                ))}
              </ul>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
