import { Link, useLocation } from "react-router"
import { cn } from "@/lib/utils"
import { CONTRACT, explorer } from "@/lib/chain"
import { NAV_GROUPS, type NavItem } from "./nav"
import { IdentityBlock } from "./identity"
import { NavGlyph } from "./nav-glyph"
import { ExtLink } from "./links"

export function isActive(pathname: string, to: string): boolean {
  return to === "/unit" ? pathname === "/unit" || pathname === "/unit/" : pathname.startsWith(to)
}

export function DemoTag({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <p className="inline-flex w-fit items-center gap-2 bg-lav-mid px-2 py-1 text-[0.75rem] font-medium text-indigo">
        <span className="size-1.5 bg-indigo" aria-hidden="true" />
        Synthetic demo unit · NEAR testnet
      </p>
    </div>
  )
}

/** One nav row: glyph + label, grey at rest, ink on hover/active (500ms), wipe underline. */
export function NavRow({ item, active, onClick, size = "md" }: { item: NavItem; active: boolean; onClick?: () => void; size?: "md" | "lg" }) {
  return (
    <Link
      to={item.to}
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group flex items-center gap-3 transition-colors duration-500 ease-gl",
        size === "md" ? "py-2 text-[1.0625rem]" : "justify-between border-b-2 border-band py-3 font-serif text-[1.875rem] leading-tight",
        active ? "text-ink" : "text-[var(--slide-off)] hover:text-ink",
      )}
    >
      {size === "md" && (
        <span className={cn("transition-[filter,opacity] duration-700 ease-gl", active ? "" : "opacity-45 grayscale group-hover:opacity-100 group-hover:grayscale-0")}>
          <NavGlyph kind={item.kind} className="size-7" />
        </span>
      )}
      <span data-active={active} className={cn("wipe", size === "md" && "font-medium")}>
        {item.title}
      </span>
      {size === "lg" && (
        <span className={cn("transition-[filter,opacity] duration-700 ease-gl", active ? "" : "opacity-45 grayscale group-hover:opacity-100 group-hover:grayscale-0")}>
          <NavGlyph kind={item.kind} className="size-11" />
        </span>
      )}
    </Link>
  )
}

/** Work / Records / Learn groups with small uppercase labels. */
export function NavGroups({ pathname, size = "md", onNavigate }: { pathname: string; size?: "md" | "lg"; onNavigate?: () => void }) {
  return (
    <nav aria-label="Demo unit" className={cn("flex flex-col", size === "md" ? "gap-6" : "gap-8")}>
      {NAV_GROUPS.map((g) => (
        <div key={g.label} className="flex flex-col">
          <p className="pb-1 text-[0.75rem] font-medium tracking-[0.06em] text-muted-foreground uppercase">{g.label}</p>
          {g.items.map((item) => (
            <NavRow key={item.to} item={item} size={size} active={isActive(pathname, item.to)} onClick={onNavigate} />
          ))}
        </div>
      ))}
    </nav>
  )
}

export function ContractFooter() {
  return (
    <div className="flex flex-col gap-1.5 text-[0.8125rem] text-muted-foreground">
      <span>Contract on NEAR testnet</span>
      <ExtLink href={explorer.account(CONTRACT)} className="text-[0.875rem]">
        <span className="font-mono break-all">{CONTRACT}</span>
      </ExtLink>
    </div>
  )
}

/** Full-height band sidebar (≥1024px). */
export function Sidebar() {
  const { pathname } = useLocation()
  return (
    <div className="hidden w-[17.5rem] shrink-0 bg-band lg:block xl:w-[19rem]">
    <aside className="sticky top-0 flex h-dvh flex-col gap-8 overflow-y-auto px-6 py-7">
      <div className="flex flex-col gap-6">
        <Link to="/" className="font-serif text-[2rem] leading-none font-medium text-ink [font-variation-settings:'opsz'_72]">
          Bandsheet
        </Link>
        <DemoTag />
      </div>
      <NavGroups pathname={pathname} />
      <div className="mt-auto">
        <IdentityBlock />
      </div>
    </aside>
    </div>
  )
}
