import { cn } from "@/lib/utils"

export type ReleaseStatus = "released" | "partially_released" | "refused" | "error" | string

const LOOK: Record<string, { label: string; cls: string }> = {
  released: { label: "Released", cls: "bg-ink text-white" },
  partially_released: { label: "Partly released", cls: "bg-lav-mid text-indigo" },
  refused: { label: "Refused", cls: "border border-ink bg-white text-ink" },
  error: { label: "Engine error", cls: "bg-band text-[var(--gray-350)]" },
  InProgress: { label: "Voting", cls: "bg-lav-mid text-indigo" },
  Approved: { label: "Approved", cls: "bg-ink text-white" },
  Rejected: { label: "Rejected", cls: "bg-band text-foreground" },
  Expired: { label: "Expired", cls: "bg-band text-muted-foreground" },
  Failed: { label: "Failed", cls: "bg-band text-[var(--gray-350)]" },
}

/** Square status tag for releases (released / partly / refused / error) and Sputnik proposal states. */
export function StatusTag({ status, className }: { status: ReleaseStatus; className?: string }) {
  const look = LOOK[status] ?? { label: status.replace(/_/g, " "), cls: "bg-band text-foreground" }
  return <span className={cn("inline-flex w-fit items-center px-2 py-1 text-[0.75rem] font-semibold whitespace-nowrap", look.cls, className)}>{look.label}</span>
}
