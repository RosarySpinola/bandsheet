import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

/** Page body container: full height, generous Greenlock spacing, sections stacked with large gaps. */
export function Page({ children, className, width = "wide" }: { children: ReactNode; className?: string; width?: "wide" | "narrow" }) {
  return (
    <div
      className={cn(
        "mx-auto flex w-full flex-col gap-12 px-4 pt-8 pb-20 sm:px-8 md:gap-16 md:pt-14 xl:px-16",
        width === "wide" ? "max-w-[78rem]" : "max-w-[60rem]",
        className,
      )}
    >
      {children}
    </div>
  )
}
