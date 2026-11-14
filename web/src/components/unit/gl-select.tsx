import { Select as S } from "radix-ui"
import { Check, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

export type GlOption = { value: string; label: string; hint?: string }

type GlSelectProps = {
  label: string
  value: string | undefined
  onChange: (v: string) => void
  options: GlOption[]
  placeholder?: string
  id?: string
  className?: string
  invalid?: boolean
}

/** Greenlock field select: label above, 1px ink underline, square white list with a 2px ink frame. */
export function GlSelect({ label, value, onChange, options, placeholder = "Choose…", id, className, invalid }: GlSelectProps) {
  const fid = id ?? `sel-${label.replace(/\W+/g, "-").toLowerCase()}`
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <label htmlFor={fid} className="text-[0.9375rem] font-medium text-ink">
        {label}
      </label>
      <S.Root value={value} onValueChange={onChange}>
        <S.Trigger
          id={fid}
          aria-invalid={invalid || undefined}
          className={cn(
            "group flex h-12 w-full cursor-pointer items-center justify-between gap-3 border-b bg-transparent text-left text-[1.125rem] text-ink outline-none transition-colors duration-[400ms] ease-gl",
            "border-ink hover:border-b-2 focus-visible:border-b-2 data-[state=open]:border-b-2 data-[placeholder]:text-muted-foreground",
            invalid && "border-b-2 border-indigo",
          )}
        >
          <S.Value placeholder={placeholder} />
          <S.Icon asChild>
            <ChevronDown className="size-5 text-ink transition-transform duration-200 group-data-[state=open]:rotate-180" />
          </S.Icon>
        </S.Trigger>
        <S.Portal>
          <S.Content
            position="popper"
            sideOffset={6}
            className="z-[1000] max-h-[min(22rem,var(--radix-select-content-available-height))] w-[var(--radix-select-trigger-width)] min-w-[12rem] overflow-hidden border-2 border-ink bg-white data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 duration-300 ease-gl"
          >
            <S.Viewport className="py-1">
              {options.map((o) => (
                <S.Item
                  key={o.value}
                  value={o.value}
                  className="relative flex cursor-pointer items-center justify-between gap-4 px-4 py-3 text-[1rem] text-ink outline-none transition-colors duration-[400ms] ease-gl select-none data-[highlighted]:bg-lav-soft"
                >
                  <span className="flex flex-col">
                    <S.ItemText>{o.label}</S.ItemText>
                    {o.hint && <span className="text-[0.8125rem] text-muted-foreground">{o.hint}</span>}
                  </span>
                  <S.ItemIndicator>
                    <Check className="size-4" strokeWidth={2.5} />
                  </S.ItemIndicator>
                </S.Item>
              ))}
            </S.Viewport>
          </S.Content>
        </S.Portal>
      </S.Root>
    </div>
  )
}

/** Greenlock text field: label above, 1px ink underline thickening to 2px on focus. */
export function GlField({
  label,
  id,
  hint,
  invalid,
  prefix,
  className,
  ...input
}: React.ComponentProps<"input"> & { label: string; hint?: string; invalid?: boolean; prefix?: string }) {
  const fid = id ?? `fld-${label.replace(/\W+/g, "-").toLowerCase()}`
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <label htmlFor={fid} className="text-[0.9375rem] font-medium text-ink">
        {label}
      </label>
      <div className={cn("flex h-12 items-center gap-2 border-b border-ink focus-within:border-b-2 hover:border-b-2", invalid && "border-b-2 border-indigo")}>
        {prefix && <span className="text-[1.125rem] text-muted-foreground">{prefix}</span>}
        <input
          id={fid}
          aria-invalid={invalid || undefined}
          {...input}
          className="h-full w-full min-w-0 bg-transparent text-[1.125rem] text-ink outline-none placeholder:text-muted-foreground/70"
        />
      </div>
      {hint && <p className={cn("text-[0.875rem]", invalid ? "font-medium text-indigo" : "text-muted-foreground")}>{hint}</p>}
    </div>
  )
}
