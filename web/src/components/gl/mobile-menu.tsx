import { useEffect, useState } from "react"
import { Link } from "react-router"
import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { SCREENS } from "./screens"
import { CRYSTAL } from "./crystals"

const LINKS = [
  { href: "/pricing", label: "Pricing" },
  { href: "/unit/how", label: "How it works" },
  { href: "/unit", label: "Live demo" },
]

/** Greenlock mobile menu: two-bar burger rotating +/-135deg into an X, full-screen white panel from -6rem. */
export function MobileMenu() {
  const [open, setOpen] = useState(false)
  const [product, setProduct] = useState(false)

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : ""
    return () => {
      document.body.style.overflow = ""
    }
  }, [open])

  return (
    <div className="min-[992px]:hidden">
      <button
        type="button"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="relative z-[9999] -mr-3 flex h-[52px] w-14 cursor-pointer flex-col items-center justify-center gap-2"
      >
        <span className={cn("block h-[2px] w-8 bg-ink transition-transform ease-gl", open ? "translate-y-[5px] rotate-[135deg] duration-[400ms]" : "duration-300")} />
        <span className={cn("block h-[2px] w-8 bg-ink transition-transform ease-gl", open ? "-translate-y-[5px] -rotate-[135deg] duration-[400ms]" : "duration-300")} />
      </button>

      <div
        className={cn(
          "fixed inset-0 z-[980] flex flex-col gap-7 overflow-y-auto bg-white px-4 pt-[6.75rem] pb-8 transition-[opacity,transform,visibility] duration-500 ease-gl",
          open ? "visible translate-y-0 opacity-100" : "pointer-events-none invisible -translate-y-24 opacity-0",
        )}
      >
        <button
          type="button"
          onClick={() => setProduct((v) => !v)}
          className="flex cursor-pointer items-center justify-between font-serif text-[2.6rem] leading-none font-medium text-ink"
          aria-expanded={product}
        >
          Product
          <ChevronDown className={cn("size-7 transition-transform duration-200", product && "rotate-180")} />
        </button>
        <div className={cn("grid transition-[grid-template-rows] duration-200 ease-out", product ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
          <ul className="overflow-hidden">
            {SCREENS.map((s) => (
              <li key={s.to}>
                <Link to={s.to} onClick={() => setOpen(false)} className="flex items-center justify-between py-2 text-lg font-semibold text-ink">
                  {s.title}
                  <img src={CRYSTAL[s.kind]} alt="" width={400} height={400} loading="lazy" className="size-20 mix-blend-multiply" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
        {LINKS.map((l) => (
          <Link key={l.href} to={l.href} onClick={() => setOpen(false)} className="font-serif text-[2.6rem] leading-none font-medium text-ink">
            {l.label}
          </Link>
        ))}
        <a href="https://github.com/RosarySpinola/bandsheet" target="_blank" rel="noreferrer" className="font-serif text-[2.6rem] leading-none font-medium text-ink">
          GitHub
        </a>
      </div>
    </div>
  )
}
