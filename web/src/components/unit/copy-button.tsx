import { useEffect, useRef, useState } from "react"
import { Check, Copy } from "lucide-react"
import { cn } from "@/lib/utils"

/** Square icon button that copies `value`; the icon crossfades to a tick for 1.6s. */
export function CopyButton({ value, label = "Copy", className }: { value: string; label?: string; className?: string }) {
  const [done, setDone] = useState(false)
  const t = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(t.current), [])
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setDone(true)
      window.clearTimeout(t.current)
      t.current = window.setTimeout(() => setDone(false), 1600)
    } catch {
      setDone(false)
    }
  }
  return (
    <button
      type="button"
      onClick={copy}
      aria-label={done ? "Copied" : label}
      title={done ? "Copied" : label}
      className={cn(
        "relative inline-grid size-8 shrink-0 cursor-pointer place-items-center text-ink/55 transition-colors duration-[400ms] ease-gl hover:bg-lav-soft hover:text-ink focus-visible:outline-2 focus-visible:outline-lav",
        className,
      )}
    >
      <Copy className={cn("col-start-1 row-start-1 size-4 transition-opacity duration-[400ms]", done && "opacity-0")} />
      <Check className={cn("col-start-1 row-start-1 size-4 text-[var(--green-400)] transition-opacity duration-[400ms]", !done && "opacity-0")} />
      <span className="sr-only" aria-live="polite">{done ? "Copied" : ""}</span>
    </button>
  )
}

/** Monospace short hash with the full value on hover and a copy button. */
export function HashValue({ value, head = 8, tail = 4, className }: { value: string; head?: number; tail?: number; className?: string }) {
  const short = value.length <= head + tail + 1 ? value : `${value.slice(0, head)}…${value.slice(-tail)}`
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-1", className)}>
      <code title={value} className="truncate font-mono text-[0.875rem] text-ink">
        {short}
      </code>
      <CopyButton value={value} label="Copy full value" />
    </span>
  )
}
