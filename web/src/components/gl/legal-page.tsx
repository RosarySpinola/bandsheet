import type { ReactNode } from "react"
import { SiteHeader } from "./site-header"
import { SiteFooter } from "./site-footer"
import { Reveal } from "./reveal"

export type LegalSection = { title: string; body: ReactNode }

/** Short public text page (terms, privacy): Greenlock header, serif title, numbered sections on hairlines. */
export function LegalPage({ title, lede, updated, sections }: { title: string; lede: ReactNode; updated: string; sections: LegalSection[] }) {
  return (
    <div className="min-h-svh bg-white">
      <SiteHeader />
      <main className="gl-container pt-[calc(var(--gl)*12)] pb-[calc(var(--gl)*8)] max-[991px]:pt-28 max-[991px]:pb-16">
        <div className="flex max-w-[calc(var(--gl)*72)] flex-col gap-[calc(var(--gl)*4)] max-[991px]:gap-10">
          <Reveal className="flex flex-col gap-[calc(var(--gl)*1.5)]">
            <p className="inline-flex w-fit items-center gap-2 bg-lav-mid px-2 py-1 text-[0.75rem] font-medium text-indigo">
              <span className="size-1.5 bg-indigo" aria-hidden="true" />
              Synthetic demo · NEAR testnet only
            </p>
            <h1 className="gl-h1">{title}</h1>
            <p className="gl-body1 max-w-[calc(var(--gl)*52)]">{lede}</p>
            <p className="text-[0.875rem] text-muted-foreground">Last updated {updated}</p>
          </Reveal>
          <ol className="flex flex-col border-t-2 border-ink">
            {sections.map((s, i) => (
              <Reveal as="li" key={s.title} duration={500} className="grid grid-cols-[calc(var(--gl)*4)_1fr] gap-x-4 border-b border-border py-[calc(var(--gl)*2)] max-[991px]:grid-cols-[2rem_1fr] max-[991px]:py-6">
                <span className="gl-num text-[calc(var(--gl)*1.75)] leading-[calc(var(--gl)*2.375)] text-[var(--gray-300)] max-[991px]:text-lg">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div className="flex flex-col gap-2">
                  <h2 className="text-[calc(var(--gl)*1.75)] leading-[calc(var(--gl)*2.375)] font-semibold text-ink max-[991px]:text-lg">{s.title}</h2>
                  <div className="flex max-w-[44rem] flex-col gap-3 text-[1.0625rem] leading-[1.7] text-text max-[991px]:text-[1rem]">{s.body}</div>
                </div>
              </Reveal>
            ))}
          </ol>
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}

/** Inline external link for legal text: ink, wipe underline. */
export function LegalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="wipe font-medium text-ink">
      {children}
    </a>
  )
}
