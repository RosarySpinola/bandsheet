import { Link, useLocation } from "react-router"
import { cn } from "@/lib/utils"
import { NavRow } from "@/components/unit/sidebar"
import { Shimmer } from "@/components/unit/states"
import type { Unit } from "@/lib/units"
import { unitActive, unitNav } from "./nav"
import { UnitIdentity } from "./unit-identity"
import { UnitTag } from "./unit-tag"
import { UNIT_STATE_TITLE, type UnitReadState } from "./unit-states"

export function UnitNavGroups({ unitId, size = "md", onNavigate }: { unitId: number; size?: "md" | "lg"; onNavigate?: () => void }) {
  const { pathname } = useLocation()
  return (
    <nav aria-label="Your unit" className={cn("flex flex-col", size === "md" ? "gap-6" : "gap-8")}>
      {unitNav(unitId).map((g) => (
        <div key={g.label} className="flex flex-col">
          <p className="pb-1 text-[0.75rem] font-medium tracking-[0.06em] text-muted-foreground uppercase">{g.label}</p>
          {g.items.map((item) => (
            <NavRow key={item.to} item={item} size={size} active={unitActive(pathname, item.to, unitId)} onClick={onNavigate} />
          ))}
        </div>
      ))}
    </nav>
  )
}

/** The unit's name over its tag: the first thing in the sidebar after the wordmark. Missing and unreadable read differently. */
export function UnitHeading({ unit, state, onRetry }: { unit?: Unit; state: UnitReadState; onRetry?: () => void }) {
  return (
    <div className="flex flex-col gap-3">
      {state === "loading" ? (
        <Shimmer className="h-7 w-40 bg-white" />
      ) : (
        <p className="font-serif text-[1.375rem] leading-tight font-medium break-words text-ink">{unit?.name ?? UNIT_STATE_TITLE[state] ?? "Your unit"}</p>
      )}
      {state === "unreadable" && onRetry && (
        <button type="button" onClick={onRetry} className="wipe w-fit cursor-pointer text-[0.9375rem] font-semibold text-ink">
          Try again
        </button>
      )}
      <UnitTag synthetic={unit?.synthetic} />
    </div>
  )
}

/** Full-height band sidebar (≥1024px), the same frame as the demo chapel's. */
export function UnitSidebar({ unitId, unit, state, onRetry }: { unitId: number; unit?: Unit; state: UnitReadState; onRetry?: () => void }) {
  return (
    <div className="hidden w-[17.5rem] shrink-0 bg-band lg:block xl:w-[19rem]">
      <aside className="sticky top-0 flex h-dvh flex-col gap-8 overflow-y-auto px-6 py-7">
        <div className="flex flex-col gap-6">
          <Link to="/" className="font-serif text-[2rem] leading-none font-medium text-ink [font-variation-settings:'opsz'_72]">
            Bandsheet
          </Link>
          <UnitHeading unit={unit} state={state} onRetry={onRetry} />
        </div>
        <UnitNavGroups unitId={unitId} />
        <div className="mt-auto">
          <UnitIdentity unit={unit} />
        </div>
      </aside>
    </div>
  )
}
