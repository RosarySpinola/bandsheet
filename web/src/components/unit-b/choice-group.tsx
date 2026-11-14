import type { ReactNode } from "react"
import { ToggleGroup as TG } from "radix-ui"
import { cn } from "@/lib/utils"

type Option<T extends string> = { value: T; label: string; hint?: string }

/**
 * Square segmented choice (radix ToggleGroup), Greenlock-styled: hairline boxes, ink fill when on,
 * 400ms colour change. Single mode never lets the selection go empty.
 */
export function ChoiceGroup<T extends string>({
  label,
  options,
  value,
  onChange,
  className,
}: {
  label: string
  options: Option<T>[]
  value: T
  onChange: (v: T) => void
  className?: string
}) {
  return (
    <TG.Root
      type="single"
      value={value}
      onValueChange={(v) => v && onChange(v as T)}
      aria-label={label}
      className={cn("flex flex-wrap gap-2", className)}
    >
      {options.map((o) => (
        <ChoiceItem key={o.value} value={o.value} title={o.hint}>
          {o.label}
        </ChoiceItem>
      ))}
    </TG.Root>
  )
}

export function MultiChoiceGroup<T extends string>({
  label,
  options,
  value,
  onChange,
  className,
}: {
  label: string
  options: Option<T>[]
  value: T[]
  onChange: (v: T[]) => void
  className?: string
}) {
  return (
    <TG.Root
      type="multiple"
      value={value}
      onValueChange={(v) => onChange(v as T[])}
      aria-label={label}
      className={cn("flex flex-wrap gap-2", className)}
    >
      {options.map((o) => (
        <ChoiceItem key={o.value} value={o.value} title={o.hint}>
          {o.label}
        </ChoiceItem>
      ))}
    </TG.Root>
  )
}

function ChoiceItem({ value, title, children }: { value: string; title?: string; children: ReactNode }) {
  return (
    <TG.Item
      value={value}
      title={title}
      className={cn(
        "inline-flex min-h-10 cursor-pointer items-center border border-line bg-white px-4 text-[0.9375rem] font-medium text-[var(--gray-350)]",
        "transition-colors duration-[400ms] ease-gl hover:border-ink hover:text-ink",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lav",
        "data-[state=on]:border-ink data-[state=on]:bg-ink data-[state=on]:text-white",
      )}
    >
      {children}
    </TG.Item>
  )
}
