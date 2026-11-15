import { Link, useLocation } from "react-router"
import { cn } from "@/lib/utils"
import { NavRow } from "@/components/unit/sidebar"
import { Shimmer } from "@/components/unit/states"
import type { Unit } from "@/lib/units"
import { unitActive, unitNav } from "./nav"
import { UnitIdentity } from "./unit-identity"
import { UnitTag } from "./unit-tag"

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

/** The unit's name over its tag: the first thing in the sidebar after the wordmark. */
export function UnitHeading({ unit, loading }: { unit?: Unit; loading?: boolean }) {
  return (
    <div className="flex flex-col gap-3">
      {loading ? <Shimmer className="h-7 w-40 bg-white" /> : <p className="font-serif text-[1.375rem] leading-tight font-medium break-words text-ink">{unit?.name ?? "Unit not found"}</p>}
      <UnitTag synthetic={unit?.synthetic} />
    </div>
  )
}

/** Full-height band sidebar (≥1024px), the same frame as the demo chapel's. */
export function UnitSidebar({ unitId, unit, loading }: { unitId: number; unit?: Unit; loading?: boolean }) {
  return (
    <div className="hidden w-[17.5rem] shrink-0 bg-band lg:block xl:w-[19rem]">
      <aside className="sticky top-0 flex h-dvh flex-col gap-8 overflow-y-auto px-6 py-7">
        <div className="flex flex-col gap-6">
          <Link to="/" className="font-serif text-[2rem] leading-none font-medium text-ink [font-variation-settings:'opsz'_72]">
            Bandsheet
          </Link>
          <UnitHeading unit={unit} loading={loading} />
        </div>
        <UnitNavGroups unitId={unitId} />
        <div className="mt-auto">
          <UnitIdentity unit={unit} />
        </div>
      </aside>
    </div>
  )
}
