import { useEffect, useRef, useState } from "react"
import { Link } from "react-router"
import { cn } from "@/lib/utils"
import { SCREENS } from "@/components/gl/screens"
import { CRYSTAL } from "@/components/gl/crystals"
import { Reveal } from "@/components/gl/reveal"

/** Greenlock "Explore our products": grey rows that go ink with a coloured crystal on hover (scroll-highlighted below 992px). */
export function ExploreList() {
  const [active, setActive] = useState<number | null>(null)
  const listRef = useRef<HTMLUListElement | null>(null)

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 991px)")
    const onScroll = () => {
      if (!mq.matches || !listRef.current) return
      const rows = Array.from(listRef.current.children) as HTMLElement[]
      const mid = window.innerHeight * 0.55
      let best = -1
      rows.forEach((r, k) => {
        const b = r.getBoundingClientRect()
        if (b.top < mid && b.bottom > mid) best = k
      })
      setActive(best >= 0 ? best : null)
    }
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  return (
    <section className="gl-section bg-white">
      <div className="gl-container">
        <Reveal>
          <h2 className="gl-h1 mb-[calc(var(--gl)*6)] max-[991px]:mb-6">Explore the example chapel</h2>
        </Reveal>
        <ul ref={listRef} className="flex flex-col">
          {SCREENS.map((s, k) => {
            const on = active === k
            const tone = on ? "duration-500" : "duration-[400ms]"
            return (
              <li key={s.to}>
                <Link
                  to={s.to}
                  onMouseEnter={() => setActive(k)}
                  onMouseLeave={() => setActive(null)}
                  onFocus={() => setActive(k)}
                  onBlur={() => setActive(null)}
                  className="gl-halves min-h-[calc(var(--gl)*16.5)] items-start py-[calc(var(--gl)*1.5)] max-[991px]:min-h-0 max-[991px]:items-center max-[991px]:py-2"
                >
                  <span className="grid grid-cols-[minmax(0,1fr)_auto] items-start max-[991px]:items-center">
                    <span
                      className={cn(
                        "max-w-[calc(var(--gl)*20)] text-[calc(var(--gl)*2.05)] leading-[calc(var(--gl)*2.75)] transition-colors ease-gl max-[991px]:text-lg max-[991px]:leading-6",
                        tone,
                        on ? "text-ink" : "text-inactive",
                      )}
                    >
                      {s.title}
                    </span>
                    <span className="relative mr-[calc(var(--gl)*8)] -mt-[calc(var(--gl)*1)] size-[calc(var(--gl)*12.5)] max-[991px]:m-0 max-[991px]:size-[4.5rem]">
                      <img
                        src={CRYSTAL[s.kind]}
                        alt=""
                        width={400}
                        height={400}
                        loading="lazy"
                        className="absolute inset-0 size-full opacity-60 mix-blend-multiply grayscale"
                      />
                      <img
                        src={CRYSTAL[s.kind]}
                        alt=""
                        width={400}
                        height={400}
                        loading="lazy"
                        className={cn("absolute inset-0 size-full mix-blend-multiply transition-opacity duration-700 ease-gl", on ? "opacity-100" : "opacity-0")}
                      />
                    </span>
                  </span>
                  <span
                    className={cn(
                      "gl-h2 transition-colors ease-gl max-[991px]:hidden",
                      tone,
                      on ? "text-ink" : "text-inactive!",
                    )}
                  >
                    {s.blurb}
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}
