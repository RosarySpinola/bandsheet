import type { ReactNode } from "react"
import { cn } from "@/lib/utils"
import { Reveal } from "@/components/gl/reveal"
import { NavGlyph } from "./nav-glyph"
import type { NavItem } from "./nav"

type PageHeaderProps = {
  title: ReactNode
  lede?: ReactNode
  eyebrow?: ReactNode
  glyph?: NavItem["kind"]
  actions?: ReactNode
  className?: string
}

/** Serif page title with an optional glyph, eyebrow, lede and right-hand actions. */
export function PageHeader({ title, lede, eyebrow, glyph, actions, className }: PageHeaderProps) {
  return (
    <header className={cn("flex flex-col gap-6 border-b-2 border-ink pb-8 md:flex-row md:items-end md:justify-between md:pb-10", className)}>
      <div className="flex max-w-[46rem] flex-col gap-4">
        {(eyebrow || glyph) && (
          <div className="flex items-center gap-3 text-[0.9375rem] text-muted-foreground">
            {glyph && <NavGlyph kind={glyph} className="size-9" />}
            {eyebrow}
          </div>
        )}
        <h1 className="font-serif text-[2.5rem] leading-[1.04] font-medium text-ink [font-variation-settings:'opsz'_72] md:text-[3.5rem]">
          {title}
        </h1>
        {lede && <p className="max-w-[40rem] text-[1.0625rem] leading-[1.6] text-foreground md:text-[1.1875rem]">{lede}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-6">{actions}</div>}
    </header>
  )
}

type SectionProps = {
  title?: ReactNode
  aside?: ReactNode
  children: ReactNode
  className?: string
  /** paint the #f4f5f3 band behind the section */
  band?: boolean
  delay?: number
  id?: string
}

/** A titled block that rises into place (Reveal). Hairline under the title row. */
export function Section({ title, aside, children, className, band, delay = 0, id }: SectionProps) {
  return (
    <Reveal delay={delay} className={cn(band && "bg-band p-6 md:p-8", className)}>
      <section id={id} className="flex flex-col gap-5">
        {(title || aside) && (
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 border-b border-border pb-3">
            {title && <h2 className="text-[1.25rem] leading-tight font-semibold text-ink md:text-[1.375rem]">{title}</h2>}
            {aside && <div className="text-[0.9375rem] text-muted-foreground">{aside}</div>}
          </div>
        )}
        {children}
      </section>
    </Reveal>
  )
}

/** Label over a value; used in definition grids. */
export function Fact({ label, children, className }: { label: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <dt className="text-[0.8125rem] font-medium tracking-[0.02em] text-muted-foreground uppercase">{label}</dt>
      <dd className="min-w-0 text-[1rem] text-ink">{children}</dd>
    </div>
  )
}

/** Big serif figure with a small caption, Greenlock numbers band style. */
export function Figure({ value, caption, className }: { value: ReactNode; caption: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <span className="gl-num text-[2.5rem] leading-none text-ink md:text-[3rem]">{value}</span>
      <span className="text-[0.9375rem] text-muted-foreground">{caption}</span>
    </div>
  )
}
