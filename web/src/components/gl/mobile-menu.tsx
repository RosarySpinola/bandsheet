import { useEffect, useState } from "react"
import { Link } from "react-router"
import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { Glyph } from "./glyph"
import { SCREENS } from "./screens"

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
        className="relative z-[9999] flex h-[46px] w-14 cursor-pointer flex-col items-center justify-center gap-2"
      >
        <span
          className={cn(
            "block h-[2px] w-8 bg-ink transition-transform ease-gl",
            open ? "translate-y-[5px] rotate-[135deg] duration-[400ms]" : "duration-300",
          )}
        />
        <span
          className={cn(
            "block h-[2px] w-8 bg-ink transition-transform ease-gl",
            open ? "-translate-y-[5px] -rotate-[135deg] duration-[400ms]" : "duration-300",
          )}
        />
      </button>

      <div
        className={cn(
          "fixed inset-0 z-[980] flex flex-col gap-6 overflow-y-auto bg-white px-4 pt-[6.75rem] pb-4 transition-[opacity,transform] duration-500 ease-gl",
          open ? "translate-y-0 opacity-100" : "pointer-events-none -translate-y-24 opacity-0",
        )}
      >
        <button
          type="button"
          onClick={() => setProduct((v) => !v)}
          className="flex cursor-pointer items-center justify-between font-serif text-[2.6rem] leading-none text-ink"
          aria-expanded={product}
        >
          Product
          <ChevronDown className={cn("size-7 transition-transform duration-200", product && "rotate-180")} />
        </button>
        <div
          className={cn(
            "grid transition-[grid-template-rows] duration-200 ease-out",
            product ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
          )}
        >
          <ul className="overflow-hidden">
            {SCREENS.map((s) => (
              <li key={s.to}>
                <Link
                  to={s.to}
                  onClick={() => setOpen(false)}
                  className="flex items-center justify-between border-b-2 border-band py-3 text-lg font-semibold text-ink"
                >
                  {s.title}
                  <Glyph kind={s.kind} className="size-14" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
        {[
          { href: "/#how", label: "How it works" },
          { href: "/#proof", label: "Proof" },
          { href: "/#privacy", label: "Privacy" },
          { href: "/pricing", label: "Pricing" },
        ].map((l) => (
          <a key={l.href} href={l.href} onClick={() => setOpen(false)} className="font-serif text-[2.6rem] leading-none text-ink">
            {l.label}
          </a>
        ))}
        <Link to="/unit" onClick={() => setOpen(false)} className="font-serif text-[2.6rem] leading-none text-ink">
          Open the demo unit
        </Link>
      </div>
    </div>
  )
}
