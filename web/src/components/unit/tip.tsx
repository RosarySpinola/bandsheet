import type { ReactNode } from "react"
import { Tooltip as T } from "radix-ui"
import { cn } from "@/lib/utils"

/** Square ink tooltip, 500ms-style fade. Wrap the app (or a page) in <TipProvider>. */
export function TipProvider({ children }: { children: ReactNode }) {
  return <T.Provider delayDuration={150}>{children}</T.Provider>
}

export function Tip({ content, children, side = "top", className }: { content: ReactNode; children: ReactNode; side?: "top" | "bottom" | "left" | "right"; className?: string }) {
  return (
    <T.Root>
      <T.Trigger asChild>{children}</T.Trigger>
      <T.Portal>
        <T.Content
          side={side}
          sideOffset={8}
          collisionPadding={16}
          className={cn(
            "z-[1000] max-w-[20rem] bg-ink px-4 py-3 text-[0.875rem] leading-snug text-white",
            "data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0 data-[state=instant-open]:animate-in data-[state=instant-open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 duration-300 ease-gl",
            className,
          )}
        >
          {content}
        </T.Content>
      </T.Portal>
    </T.Root>
  )
}
