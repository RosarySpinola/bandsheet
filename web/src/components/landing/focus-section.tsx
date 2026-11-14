import { useRef, useState } from "react"
import { useMotionValueEvent, useScroll, useSpring } from "motion/react"
import { cn } from "@/lib/utils"
import { MemberDots } from "./member-dots"

const SET_A = [
  "Mean pay by grade",
  "Release #1 · Senior · 9 members",
  "A tenth Senior joins",
  "Release #2 · Senior · 10 members",
]
const SET_B = [
  "The engine replays every earlier table",
  "#2 − #1 would isolate one member",
  "Senior withheld, four bands out",
  "The refusal is logged on NEAR",
]
/* Greenlock label offsets: staggered right edges, absolute, ~13rem wide. */
const OFFSETS = ["5rem", "5.625rem", "10.875rem", "13rem"]

/** Greenlock "focus" section, rebuilt: scroll-scrubbed art, headline + label swap at the midpoint. */
export function FocusSection() {
  const ref = useRef<HTMLElement | null>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] })
  const p = useSpring(scrollYProgress, { stiffness: 120, damping: 30, mass: 0.4 })
  const [second, setSecond] = useState(false)
  useMotionValueEvent(scrollYProgress, "change", (v) => setSecond(v >= 0.58))

  return (
    <section id="how" ref={ref} className="relative h-[340vh] bg-white max-[991px]:h-[300vh]">
      <div className="sticky top-0 flex h-svh items-center overflow-hidden">
        <div className="gl-container grid w-full grid-cols-[0.9fr_minmax(0,1.5fr)_0.8fr] items-center gap-[calc(var(--gl)*2)] max-[991px]:grid-cols-1 max-[991px]:gap-6 max-[991px]:pt-16">
          <div className="flex flex-col justify-between gap-[calc(var(--gl)*10)] self-stretch py-[calc(var(--gl)*6)] max-[991px]:gap-3 max-[991px]:py-0">
            <h2
              className={cn(
                "gl-h1 transition-colors duration-[400ms] ease-gl",
                second ? "text-ghost!" : "text-ink",
              )}
            >
              A typical tool publishes both tables.
            </h2>
            <h2
              className={cn(
                "gl-h1 transition-colors duration-[400ms] ease-gl",
                second ? "text-ink" : "text-ghost!",
              )}
            >
              Bandsheet remembers the first one.
            </h2>
          </div>

          <div className="mx-auto w-full max-w-[calc(var(--gl)*62)] max-[991px]:max-w-md">
            <MemberDots p={p} />
          </div>

          <div className="relative h-[calc(var(--gl)*36)] max-[991px]:hidden">
            {[SET_A, SET_B].map((set, si) => (
              <div
                key={si}
                className={cn(
                  "absolute inset-0 transition-opacity duration-[400ms] ease-gl",
                  (si === 1) === second ? "opacity-100" : "opacity-0",
                )}
              >
                {set.map((label, i) => (
                  <p
                    key={label}
                    className="gl-label absolute max-w-[calc(var(--gl)*13)] text-text"
                    style={{
                      top: `${8 + i * 23}%`,
                      right: `calc(var(--gl) * ${parseFloat(OFFSETS[i])})`,
                    }}
                  >
                    {label}
                  </p>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
