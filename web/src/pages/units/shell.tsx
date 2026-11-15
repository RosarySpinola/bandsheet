import { Outlet, useLocation, useOutletContext, useParams } from "react-router"
import type { UseQueryResult } from "@tanstack/react-query"
import { MobileNav } from "@/components/unit/mobile-nav"
import { TipProvider } from "@/components/unit/tip"
import { UnitHeading, UnitNavGroups, UnitSidebar } from "@/components/units/unit-sidebar"
import { UnitIdentity } from "@/components/units/unit-identity"
import { MockBanner } from "@/components/units/mock-banner"
import { useQueryClient } from "@tanstack/react-query"
import { useUnitView } from "@/lib/units/hooks"
import { useAutoRun } from "@/lib/units/run"
import type { UnitView } from "@/lib/units"

export type UnitOutlet = { unitId: number; view: UseQueryResult<UnitView> }

/** /u/:unitId/… pages read the unit id and its aggregated view from the shell. */
export const useUnitOutlet = () => useOutletContext<UnitOutlet>()

const parseId = (s: string | undefined) => (s && /^\d{1,9}$/.test(s) ? Number(s) : null)

/** A judge's own unit: the demo chapel's shell (band sidebar, burger sheet, calm route fade), scoped to /u/:unitId. */
export default function UnitShell() {
  const { unitId: raw } = useParams()
  const unitId = parseId(raw)
  const view = useUnitView(unitId)
  const qc = useQueryClient()
  useAutoRun(qc, view.data)
  const { pathname } = useLocation()
  const id = unitId ?? -1
  const unit = view.data?.unit

  return (
    <TipProvider>
      <div className="flex min-h-dvh bg-white">
        <UnitSidebar unitId={id} unit={unit} loading={view.isPending && unitId !== null} />
        <div className="flex min-w-0 flex-1 flex-col">
          <MobileNav
            tag={<UnitHeading unit={unit} loading={view.isPending && unitId !== null} />}
            nav={(close) => <UnitNavGroups unitId={id} size="lg" onNavigate={close} />}
            identity={<UnitIdentity unit={unit} className="bg-band" />}
          />
          <MockBanner />
          <main key={pathname} className="flex flex-1 flex-col animate-in fade-in-0 slide-in-from-bottom-6 duration-500 ease-gl">
            <Outlet context={{ unitId: id, view } satisfies UnitOutlet} />
          </main>
        </div>
      </div>
    </TipProvider>
  )
}
