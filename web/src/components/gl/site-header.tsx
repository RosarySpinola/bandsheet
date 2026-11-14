import { useEffect, useRef, useState } from "react"
import { Link, useLocation } from "react-router"
import { cn } from "@/lib/utils"
import { SCREENS } from "./screens"
import { CRYSTAL } from "./crystals"
import { MobileMenu } from "./mobile-menu"

const NAV_LINKS = [
  { href: "/pricing", label: "Pricing" },
  { href: "/unit/how", label: "How it works" },
  { href: "https://github.com/RosarySpinola/bandsheet", label: "GitHub", external: true },
]

/** Greenlock header: logo left, links from the page's centre line, demo link right; transparent over the hero. */
export function SiteHeader() {
  const { pathname } = useLocation()
  const overHero = pathname === "/"
  const [solid, setSolid] = useState(!overHero)
  const [panel, setPanel] = useState(false)
  const closeTimer = useRef<number | undefined>(undefined)

  useEffect(() => {
    if (!overHero) return
    const onScroll = () => {
      const hero = Math.min(window.innerHeight, 1080)
      const ratio = window.innerWidth <= 991 ? 0.02 : 0.59
      setSolid(window.scrollY > hero * ratio)
    }
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [overHero])

  useEffect(() => {
    if (!panel) return
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setPanel(false)
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [panel])

  const open = () => {
    window.clearTimeout(closeTimer.current)
    setPanel(true)
  }
  const close = () => {
    closeTimer.current = window.setTimeout(() => setPanel(false), 200)
  }

  return (
    <>
      <header
        className={cn(
          "fixed inset-x-0 top-0 z-[999] transition-colors duration-150 ease-gl",
          solid || panel ? "bg-white" : "bg-transparent",
        )}
      >
        <div className="gl-container flex h-[52px] items-center justify-between min-[992px]:grid min-[992px]:h-auto min-[992px]:grid-cols-2 min-[992px]:gap-x-[calc(var(--gl)*2.25)] min-[992px]:py-[calc(var(--gl)*1.4)]">
          <Link to="/" className="relative z-[990] w-fit pt-[calc(var(--gl)*0.35)] font-serif text-[calc(var(--gl)*2.15)] leading-none font-medium tracking-[-0.01em] text-ink max-[991px]:text-[1.6rem]">
            Bandsheet
          </Link>
          <div className="hidden items-center justify-between min-[992px]:flex">
            <nav className="flex items-center gap-[calc(var(--gl)*2)]" aria-label="Primary">
              <button
                type="button"
                className="gl-nav wipe cursor-pointer"
                data-active={panel}
                onMouseEnter={open}
                onMouseLeave={close}
                onFocus={open}
                onBlur={close}
                aria-expanded={panel}
              >
                Product
              </button>
              {NAV_LINKS.map((l) =>
                l.external ? (
                  <a key={l.href} href={l.href} className="gl-nav wipe" target="_blank" rel="noreferrer">
                    {l.label}
                  </a>
                ) : (
                  <Link key={l.href} to={l.href} className="gl-nav wipe" data-active={pathname === l.href}>
                    {l.label}
                  </Link>
                ),
              )}
            </nav>
            <Link to="/unit" className="gl-nav wipe">
              Live demo
            </Link>
          </div>
          <MobileMenu />
        </div>
      </header>

      {/* Product mega-panel + 10% page dim, Greenlock timings: 500ms fade, 400ms dim, 200ms leave delay. */}
      <div
        aria-hidden="true"
        className={cn(
          "fixed inset-0 z-[8] bg-[var(--dim)] transition-opacity duration-[400ms] ease-gl max-[991px]:hidden",
          panel ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />
      <div
        onMouseEnter={open}
        onMouseLeave={close}
        className={cn(
          "fixed z-[998] bg-white transition-[opacity,visibility] duration-500 ease-gl max-[991px]:hidden",
          "top-[calc(var(--gl)*6)] right-[calc(var(--gl)*9.375)] left-[calc(var(--gl)*9.375)] px-[calc(var(--gl)*4.875)] py-[calc(var(--gl)*3.5)]",
          panel ? "opacity-100" : "pointer-events-none invisible opacity-0",
        )}
      >
        <div className="grid grid-cols-6 gap-[calc(var(--gl)*2.5)]">
          {SCREENS.map((s) => (
            <Link
              key={s.to}
              to={s.to}
              onClick={() => setPanel(false)}
              className="group flex flex-col items-center gap-[var(--gl)] p-[var(--gl)] text-center transition-colors duration-[333ms] hover:bg-band"
            >
              <img src={CRYSTAL[s.kind]} alt="" width={400} height={400} loading="lazy" className="size-[calc(var(--gl)*8)] mix-blend-multiply" />
              <span className="wipe text-[calc(var(--gl)*1.5)] leading-[calc(var(--gl)*1.625)] font-semibold text-ink group-hover:after:scale-x-100">
                {s.title}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </>
  )
}
