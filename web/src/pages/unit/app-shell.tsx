import { Outlet, useLocation } from "react-router"
import { MobileNav } from "@/components/unit/mobile-nav"
import { Sidebar } from "@/components/unit/sidebar"
import { TipProvider } from "@/components/unit/tip"

/** Demo-unit shell: band sidebar on desktop, burger sheet on mobile, calm fade/rise on route change. */
export default function AppShell() {
  const { pathname } = useLocation()
  return (
    <TipProvider>
      <div className="flex min-h-dvh bg-white">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <MobileNav />
          <main key={pathname} className="flex flex-1 flex-col animate-in fade-in-0 slide-in-from-bottom-6 duration-500 ease-gl">
            <Outlet />
          </main>
        </div>
      </div>
    </TipProvider>
  )
}
