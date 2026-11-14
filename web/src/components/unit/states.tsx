import type { ReactNode } from "react"
import { cn } from "@/lib/utils"
import { plainError } from "@/lib/api"

/** Nothing to show yet: quiet band, serif line, one sentence and an optional action. */
export function EmptyState({ title, body, action, className }: { title: ReactNode; body?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-start gap-3 bg-band px-6 py-10 md:px-10", className)}>
      <p className="font-serif text-[1.75rem] leading-tight text-ink">{title}</p>
      {body && <p className="max-w-[36rem] text-[1rem] leading-relaxed text-muted-foreground">{body}</p>}
      {action && <div className="pt-2">{action}</div>}
    </div>
  )
}

/**
 * An error in plain words. Pass the thrown error (ApiError, Error, string) and an optional retry.
 * `tone="alarm"` is only for refusals that matter (not a member, attestation failed).
 */
export function ErrorState({
  error,
  title,
  onRetry,
  tone = "calm",
  className,
  children,
}: {
  error: unknown
  title?: ReactNode
  onRetry?: () => void
  tone?: "calm" | "alarm"
  className?: string
  children?: ReactNode
}) {
  const e = plainError(error)
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col gap-3 border-l-2 px-6 py-6 md:px-8",
        tone === "alarm" ? "border-ink bg-lav-soft" : "border-ink bg-band",
        className,
      )}
    >
      <p className={cn("text-[1.0625rem] leading-snug font-semibold", "text-ink")}>{title ?? e.title}</p>
      {title && <p className="text-[0.9375rem] leading-relaxed text-foreground">{e.title}</p>}
      {children}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[0.8125rem] text-muted-foreground">
        {e.code !== "UNKNOWN" && <code className="font-mono">{e.code}</code>}
        {e.detail && e.detail !== e.title && <span className="break-words">{e.detail}</span>}
        {onRetry && (
          <button type="button" onClick={onRetry} className="wipe cursor-pointer text-[0.9375rem] font-semibold text-ink">
            Try again
          </button>
        )}
      </div>
    </div>
  )
}

/** Flat skeleton block in the band colour (no radius), for layout-matching loading states. */
export function Shimmer({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("animate-pulse bg-band", className)} />
}
