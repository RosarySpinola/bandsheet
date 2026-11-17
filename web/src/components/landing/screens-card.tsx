import { useEffect, useState } from "react"
import { useReducedMotion } from "motion/react"
import { Link } from "react-router"
import { ArrowLeft, ArrowRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { Reveal } from "@/components/gl/reveal"
import { SCREEN_SLIDES as SLIDES } from "./screens-data"

const HOLD = 7000

/** Greenlock product media card: framed screen on a lavender panel, numbered steps, arrows, 500ms crossfade. */
export function ScreensCard() {
  const [i, setI] = useState(0)
  const [paused, setPaused] = useState(false)
  const reduce = useReducedMotion()
  const s = SLIDES[i]

  useEffect(() => {
    if (paused || reduce) return
    const id = window.setTimeout(() => setI((n) => (n + 1) % SLIDES.length), HOLD)
    return () => window.clearTimeout(id)
  }, [i, paused, reduce])

  const step = (d: number) => setI((n) => (n + d + SLIDES.length) % SLIDES.length)

  return (
    <section className="gl-section bg-band" aria-roledescription="carousel" aria-label="The example chapel">
      <div className="gl-container">
        <Reveal>
          <div
            className="grid grid-cols-[1.25fr_1fr] gap-[calc(var(--gl)*4)] bg-white p-[calc(var(--gl)*2)] max-[991px]:grid-cols-1 max-[991px]:gap-6 max-[991px]:p-3"
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
          >
            <div className="gl-frame relative aspect-[4/3] overflow-hidden bg-[var(--purple-200)]">
              {SLIDES.map((sl, k) => (
                <img
                  key={sl.img}
                  src={sl.img}
                  alt={k === i ? sl.alt : ""}
                  aria-hidden={k !== i}
                  width={1160}
                  height={870}
                  loading="lazy"
                  className={cn(
                    "absolute top-[9%] left-[7%] w-[112%] max-w-none origin-top-left",
                    k === i ? "scale-100 opacity-100" : "scale-[1.02] opacity-0",
                  )}
                />
              ))}
              <div className="absolute inset-x-0 bottom-0 flex items-center gap-[calc(var(--gl)*1.5)] bg-gradient-to-t from-[var(--purple-500)]/45 to-transparent px-[calc(var(--gl)*1.5)] pt-[calc(var(--gl)*4)] pb-[calc(var(--gl)*1.25)] max-[991px]:gap-3 max-[991px]:px-3 max-[991px]:pt-10 max-[991px]:pb-3">
                <button type="button" aria-label="Previous screen" onClick={() => step(-1)} className="grid size-9 cursor-pointer place-items-center text-white transition-transform duration-200 active:scale-95">
                  <ArrowLeft className="size-5" />
                </button>
                <button type="button" aria-label="Next screen" onClick={() => step(1)} className="grid size-9 cursor-pointer place-items-center text-white transition-transform duration-200 active:scale-95">
                  <ArrowRight className="size-5" />
                </button>
                <div className="flex flex-1 gap-[calc(var(--gl)*0.5)]">
                  {SLIDES.map((sl, k) => (
                    <button key={sl.img} type="button" aria-label={`Show ${sl.title}`} onClick={() => setI(k)} className="h-5 flex-1 cursor-pointer py-2">
                      <span className="block h-[2px] w-full overflow-hidden bg-white/35">
                        <span
                          key={`${k}-${i}`}
                          className={cn("block h-full bg-white", k < i && "w-full", k > i && "w-0", k === i && (paused || reduce ? "w-full" : "animate-[gl-fill_7s_linear_forwards]"))}
                        />
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex flex-col justify-center gap-[calc(var(--gl)*3)] py-[calc(var(--gl)*2)] pr-[calc(var(--gl)*3)] max-[991px]:gap-6 max-[991px]:p-1 max-[991px]:pb-3" aria-live="polite">
              <h2 key={s.title} className="gl-h1 animate-in fade-in duration-500">{s.title}</h2>
              <ol className="flex flex-col gap-[calc(var(--gl)*1.75)]">
                {s.steps.map((st, k) => (
                  <li key={st.head} className="grid grid-cols-[auto_1fr] gap-x-[calc(var(--gl)*1.25)] animate-in fade-in duration-500">
                    <span className="grid size-[calc(var(--gl)*2.2)] place-items-center rounded-full bg-[var(--purple-200)] text-[calc(var(--gl)*1.1)] font-semibold text-ink max-[991px]:size-7 max-[991px]:text-sm">
                      {k + 1}
                    </span>
                    <span className="flex flex-col gap-[calc(var(--gl)*0.25)]">
                      <span className="text-[calc(var(--gl)*1.9)] leading-[calc(var(--gl)*2.4)] font-semibold text-ink max-[991px]:text-lg max-[991px]:leading-7">{st.head}</span>
                      <span className="gl-body3 text-[var(--gray-350)]!">{st.body}</span>
                    </span>
                  </li>
                ))}
              </ol>
              <Link to={s.to} className="gl-cta group inline-flex w-fit items-baseline gap-[calc(var(--gl)*0.5)] text-[calc(var(--gl)*2.1)]! max-[991px]:text-2xl!">
                <span className="wipe group-hover:after:scale-x-100">{s.cta}</span>
                <span aria-hidden="true" className="text-[0.8em]">↳</span>
              </Link>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
