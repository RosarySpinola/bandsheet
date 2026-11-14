import { useEffect, useRef, useState } from "react"
import { Link } from "react-router"
import { cn } from "@/lib/utils"
import { Glyph } from "./glyph"
import { SCREENS } from "./screens"
import { MobileMenu } from "./mobile-menu"

const LINKS = [
  { href: "#how", label: "How it works" },
  { href: "#proof", label: "Proof" },
  { href: "#privacy", label: "Privacy" },
]

/** Greenlock header: transparent over the hero, white past 59% of it (2% on mobile). */
export function SiteHeader() {
  const [solid, setSolid] = useState(false)
  const [panel, setPanel] = useState(false)
  const closeTimer = useRef<number | undefined>(undefined)

  useEffect(() => {
    const onScroll = () => {
      const hero = Math.min(window.innerHeight, 1080)
      const ratio = window.innerWidth <= 991 ? 0.02 : 0.59
      setSolid(window.scrollY > hero * ratio)
    }
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

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
        <div className="grid h-[46px] grid-cols-[1fr_auto] items-center px-4 min-[992px]:h-auto min-[992px]:grid-cols-[1fr_auto_1fr] min-[992px]:px-[calc(var(--gl)*2)] min-[992px]:py-[var(--gl)]">
          <Link to="/" className="font-serif text-[calc(var(--gl)*2.4)] leading-none font-medium text-ink max-[991px]:text-[1.45rem]">
            Bandsheet
          </Link>
          <nav className="hidden items-center gap-[calc(var(--gl)*2)] min-[992px]:flex" aria-label="Primary">
            <button
              type="button"
              className="gl-nav wipe cursor-pointer"
              data-active={panel}
              onMouseEnter={open}
              onMouseLeave={close}
              onFocus={open}
              aria-expanded={panel}
            >
              Product
            </button>
            {LINKS.map((l) => (
              <a key={l.href} href={l.href} className="gl-nav wipe">
                {l.label}
              </a>
            ))}
          </nav>
          <div className="flex items-center justify-end gap-4">
            <Link to="/unit" className="gl-nav wipe hidden min-[992px]:inline-block">
              Open the demo unit
            </Link>
            <MobileMenu />
          </div>
        </div>
      </header>

      {/* Products mega-panel + 10% page dim, Greenlock timings: 500ms fade, 400ms dim, 200ms leave delay. */}
      <div
        aria-hidden={!panel}
        className={cn(
          "fixed inset-0 z-[8] bg-[var(--dim)] transition-opacity duration-[400ms] ease-gl max-[991px]:hidden",
          panel ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />
      <div
        onMouseEnter={open}
        onMouseLeave={close}
        className={cn(
          "fixed z-[998] bg-white transition-opacity duration-500 ease-gl max-[991px]:hidden",
          "top-[calc(var(--gl)*6)] right-[calc(var(--gl)*9.375)] left-[calc(var(--gl)*9.375)] px-[calc(var(--gl)*4.875)] py-[calc(var(--gl)*3.5)]",
          panel ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      >
        <div className="grid grid-cols-6 gap-[calc(var(--gl)*2.5)]">
          {SCREENS.map((s) => (
            <Link
              key={s.to}
              to={s.to}
              className="group flex flex-col items-center gap-[var(--gl)] p-[var(--gl)] text-center transition-colors duration-[333ms] hover:bg-band"
            >
              <Glyph kind={s.kind} className="size-[calc(var(--gl)*6)]" />
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
