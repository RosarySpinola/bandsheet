import type { ReactNode } from "react"
import { cn } from "@/lib/utils"
import { CopyButton } from "../copy-button"
import { CtaLink, ExtLink } from "../links"
import { PassMark } from "../verified-panel"
import { Reveal } from "@/components/gl/reveal"

export type Check = { state: "match" | "mismatch" | "pending" | "error"; text: ReactNode }

type VerifyItemProps = {
  n: number
  title: string
  value: ReactNode
  proves: ReactNode
  command?: string
  links?: { href: string; label: string; internal?: boolean }[]
  check?: Check
  /** anchor id, e.g. for /unit/verify#trusted-employers */
  id?: string
}

/** One verifiable fact: the value, what it proves, and how to re-check it without trusting us. */
export function VerifyItem({ n, title, value, proves, command, links, check, id }: VerifyItemProps) {
  return (
    <Reveal as="li" duration={500} className="relative grid grid-cols-1 gap-6 border-b border-border py-8 md:grid-cols-[3rem_minmax(0,1fr)] md:gap-x-8 xl:grid-cols-[3rem_minmax(0,1fr)_minmax(0,1.1fr)]">
      {id && <span id={id} className="absolute top-0 left-0 scroll-mt-24" aria-hidden="true" />}
      <span className="gl-num text-[1.5rem] leading-none text-[var(--gray-300)]">{String(n).padStart(2, "0")}</span>
      <div className="flex min-w-0 flex-col gap-3">
        <h3 className="text-[1.25rem] leading-tight font-semibold text-ink">{title}</h3>
        <div className="min-w-0 text-[1rem] text-ink">{value}</div>
        {check && (
          <p className={cn("flex items-center gap-2 text-[0.9375rem]", check.state === "mismatch" || check.state === "error" ? "font-medium text-ink" : "text-foreground")}>
            {check.state === "pending" ? (
              <span className="size-5 animate-pulse bg-band" aria-hidden="true" />
            ) : (
              <PassMark pass={check.state === "match"} className="size-5" />
            )}
            {check.text}
          </p>
        )}
      </div>
      <div className="flex min-w-0 flex-col gap-4 md:col-start-2 xl:col-start-3">
        <p className="text-[1rem] leading-relaxed text-foreground">{proves}</p>
        {command && (
          <div className="flex items-start gap-2 bg-ink py-3 pr-2 pl-4">
            <code className="min-w-0 flex-1 font-mono text-[0.8125rem] leading-relaxed break-all whitespace-pre-wrap text-lav-mid">{command}</code>
            <CopyButton value={command} label="Copy command" className="text-white/60 hover:bg-white/10 hover:text-white" />
          </div>
        )}
        {links && links.length > 0 && (
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            {links.map((l) =>
              l.internal ? (
                <CtaLink key={l.href} to={l.href} className="text-[0.9375rem]">
                  {l.label}
                </CtaLink>
              ) : (
                <ExtLink key={l.href} href={l.href} className="text-[0.9375rem]">
                  {l.label}
                </ExtLink>
              ),
            )}
          </div>
        )}
      </div>
    </Reveal>
  )
}
