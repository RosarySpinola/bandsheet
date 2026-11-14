import { useEffect, useRef, useState } from "react"
import { Link } from "react-router"
import { cn } from "@/lib/utils"
import { Glyph } from "@/components/gl/glyph"
import { SCREENS } from "@/components/gl/screens"
import { Reveal } from "@/components/gl/reveal"

/** Greenlock "Explore our products": grey rows that go ink on hover (scroll-highlighted on mobile). */
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
          <h2 className="gl-h1 mb-[calc(var(--gl)*4)]">Explore the demo unit</h2>
        </Reveal>
        <ul ref={listRef} className="flex flex-col">
          {SCREENS.map((s, k) => {
            const on = active === k
            return (
              <li key={s.to}>
                <Link
                  to={s.to}
                  onMouseEnter={() => setActive(k)}
                  onMouseLeave={() => setActive(null)}
                  className="grid min-h-[calc(var(--gl)*12.25)] grid-cols-[minmax(0,22rem)_auto_minmax(0,1fr)] items-center gap-[calc(var(--gl)*3)] py-[calc(var(--gl)*1.5)] max-[991px]:grid-cols-[1fr_auto] max-[991px]:gap-3 max-[991px]:py-5"
                >
                  <span
                    className={cn(
                      "gl-h2 transition-colors ease-gl",
                      on ? "text-ink! duration-500" : "text-inactive! duration-[400ms]",
                    )}
                  >
                    {s.title}
                  </span>
                  <Glyph kind={s.kind} muted={!on} className="size-[calc(var(--gl)*8)] max-[991px]:size-16" />
                  <span
                    className={cn(
                      "gl-body3 transition-colors ease-gl max-[991px]:col-span-2",
                      on ? "text-text! duration-500" : "text-inactive! duration-[400ms]",
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
