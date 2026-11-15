import { cn } from "@/lib/utils"
import { isMock } from "@/lib/units"

/** Sidebar tag for a judge's own unit; synthetic entries and mock mode are named plainly. */
export function UnitTag({ synthetic, className }: { synthetic?: number; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <p className="inline-flex w-fit items-center gap-2 bg-white px-2 py-1 text-[0.75rem] font-medium text-ink">
        <span className="size-1.5 bg-ink" aria-hidden="true" />
        Your own unit · NEAR testnet
      </p>
      {synthetic ? (
        <p className="inline-flex w-fit items-center gap-2 bg-lav-mid px-2 py-1 text-[0.75rem] font-medium text-indigo">
          <span className="size-1.5 bg-indigo" aria-hidden="true" />
          Includes {synthetic} synthetic {synthetic === 1 ? "entry" : "entries"} (sample data)
        </p>
      ) : null}
      {isMock() && (
        <p className="inline-flex w-fit items-center gap-2 border border-indigo px-2 py-1 text-[0.75rem] font-medium text-indigo">
          Mock mode · nothing leaves this browser
        </p>
      )}
    </div>
  )
}
