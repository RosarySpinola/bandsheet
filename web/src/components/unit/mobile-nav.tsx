import { useEffect, useState, type ReactNode } from "react"
import { Link, useLocation } from "react-router"
import { cn } from "@/lib/utils"
import { DemoTag, NavGroups } from "./sidebar"
import { IdentityBlock } from "./identity"

/**
 * <1024px: 56px white top bar, Greenlock two-bar burger, full-screen sheet sliding from -6rem.
 * A judge's own unit passes its tag, nav and identity block; the demo chapel uses the defaults.
 */
export function MobileNav({ tag, nav, identity }: { tag?: ReactNode; nav?: (close: () => void) => ReactNode; identity?: ReactNode } = {}) {
  const [open, setOpen] = useState(false)
  const { pathname } = useLocation()

  useEffect(() => setOpen(false), [pathname])
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : ""
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false)
    window.addEventListener("keydown", onKey)
    return () => {
      document.body.style.overflow = ""
      window.removeEventListener("keydown", onKey)
    }
  }, [open])

  return (
    <div className="lg:hidden">
      <div className="sticky top-0 z-[999] flex h-14 items-center justify-between border-b border-border bg-white pl-4">
        <Link to="/" className="font-serif text-[1.5rem] leading-none font-medium text-ink">
          Bandsheet
        </Link>
        <button
          type="button"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          aria-controls="unit-menu"
          onClick={() => setOpen((v) => !v)}
          className="relative z-[9999] flex h-14 w-[4.5rem] cursor-pointer flex-col items-center justify-center gap-2"
        >
          <span className={cn("block h-[2px] w-8 bg-ink transition-transform ease-gl", open ? "translate-y-[5px] rotate-[135deg] duration-[400ms]" : "duration-300")} />
          <span className={cn("block h-[2px] w-8 bg-ink transition-transform ease-gl", open ? "-translate-y-[5px] -rotate-[135deg] duration-[400ms]" : "duration-300")} />
        </button>
      </div>
      <div
        id="unit-menu"
        aria-hidden={!open}
        inert={!open}
        className={cn(
          "fixed inset-x-0 top-14 bottom-0 z-[980] flex flex-col gap-8 overflow-y-auto bg-white px-4 pt-6 pb-6 transition-[opacity,transform] duration-500 ease-gl",
          open ? "translate-y-0 opacity-100" : "pointer-events-none -translate-y-24 opacity-0",
        )}
      >
        {tag ?? <DemoTag />}
        {nav ? nav(() => setOpen(false)) : <NavGroups pathname={pathname} size="lg" onNavigate={() => setOpen(false)} />}
        <div className="mt-auto">
          {identity ?? <IdentityBlock className="bg-band" />}
        </div>
      </div>
    </div>
  )
}
