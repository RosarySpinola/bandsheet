import type { ReactNode } from "react"
import { Link } from "react-router"
import { ArrowLeft } from "lucide-react"
import { StartVisual } from "./start-visual"
import { MockBanner } from "./mock-banner"

/** The /start and /join frame: the demo join page's split layout, form on the left, sealed-release art on the right. */
export function EntryFrame({ eyebrow, title, lede, children, footer }: { eyebrow: ReactNode; title: ReactNode; lede: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-band">
      <MockBanner />
      <div className="grid flex-1 grid-cols-1 lg:grid-cols-2">
        <div className="flex min-h-dvh flex-col px-4 py-6 sm:px-10 lg:px-16 lg:py-10">
          <div className="flex items-center justify-between gap-4">
            <Link to="/" className="font-serif text-[1.75rem] leading-none font-medium text-ink">
              Bandsheet
            </Link>
            <Link to="/unit" className="group inline-flex items-center gap-2 text-[1rem] text-ink">
              <ArrowLeft className="size-4 transition-transform duration-500 ease-gl group-hover:-translate-x-1" />
              <span className="wipe">Example chapel</span>
            </Link>
          </div>
          <main className="my-auto flex w-full max-w-[32rem] flex-col gap-8 py-12 animate-in fade-in-0 slide-in-from-bottom-12 delay-300 duration-1000 fill-mode-both ease-gl">
            <div className="flex flex-col gap-4">
              <p className="text-[0.9375rem] text-muted-foreground">{eyebrow}</p>
              <h1 className="font-serif text-[2.75rem] leading-[1.02] font-medium text-ink [font-variation-settings:'opsz'_72] md:text-[3.75rem]">{title}</h1>
              <p className="text-[1.0625rem] leading-relaxed text-foreground">{lede}</p>
            </div>
            {children}
          </main>
          {footer && <div className="max-w-[32rem] text-[0.8125rem] leading-relaxed text-muted-foreground">{footer}</div>}
        </div>
        <StartVisual />
      </div>
    </div>
  )
}
