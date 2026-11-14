import { Link, useLocation, useNavigate } from "react-router"
import { DropdownMenu as DM } from "radix-ui"
import { ChevronsUpDown, KeyRound } from "lucide-react"
import { Glyph, type GlyphKind } from "@/components/gl/glyph"
import { CONTRACT, explorer } from "@/lib/chain"
import { cn } from "@/lib/utils"
import { UNIT_NAME } from "./nav"
import { clearMember, joinHref, useMember } from "./session"

const AVATARS: GlyphKind[] = ["submit", "ledger", "vote", "stand", "verify"]

const itemCls =
  "flex cursor-pointer items-center justify-between gap-4 px-4 py-3 text-[0.9375rem] text-ink outline-none transition-colors duration-[400ms] ease-gl select-none data-[highlighted]:bg-lav-soft"

/**
 * The one bottom-left identity block: glyph avatar picked from the slot, the short slot, the chapel,
 * and a menu (Switch key, Website, Contract, Leave). With no key it links to /unit/join.
 */
export function IdentityBlock({ className, side = "top" }: { className?: string; side?: "top" | "bottom" }) {
  const member = useMember()
  const { pathname } = useLocation()
  const navigate = useNavigate()

  if (!member) {
    return (
      <Link
        to={joinHref(pathname)}
        className={cn("group flex items-center gap-3 border-2 border-ink bg-white p-3 transition-colors duration-[400ms] ease-gl hover:bg-ink hover:text-white", className)}
      >
        <span className="grid size-10 shrink-0 place-items-center bg-lav-mid text-ink">
          <KeyRound className="size-5" />
        </span>
        <span className="flex flex-col">
          <span className="text-[0.9375rem] font-semibold">Open your member key</span>
          <span className="text-[0.8125rem] opacity-70">{UNIT_NAME}</span>
        </span>
      </Link>
    )
  }

  const avatar = AVATARS[parseInt(member.slot.slice(0, 2), 16) % AVATARS.length]!
  return (
    <DM.Root modal={false}>
      <DM.Trigger
        className={cn(
          "group flex w-full cursor-pointer items-center gap-3 bg-white p-3 text-left outline-none transition-colors duration-[400ms] ease-gl hover:bg-lav-soft focus-visible:outline-2 focus-visible:outline-lav data-[state=open]:bg-lav-soft",
          className,
        )}
        aria-label={`Member ${member.slot.slice(0, 8)}, open menu`}
      >
        <span className="grid size-10 shrink-0 place-items-center bg-band">
          <Glyph kind={avatar} className="size-7" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <code className="truncate font-mono text-[0.875rem] font-semibold text-ink">
            {member.slot.slice(0, 8)}…{member.slot.slice(-4)}
          </code>
          <span className="truncate text-[0.8125rem] text-muted-foreground">
            {UNIT_NAME}
            {member.demo ? " · demo" : ""}
          </span>
        </span>
        <ChevronsUpDown className="size-4 shrink-0 text-ink/60" />
      </DM.Trigger>
      <DM.Portal>
        <DM.Content
          side={side}
          align="start"
          sideOffset={6}
          className="z-[1000] w-[var(--radix-dropdown-menu-trigger-width)] min-w-[15rem] border-2 border-ink bg-white py-1 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 duration-300 ease-gl"
        >
          <DM.Item className={itemCls} onSelect={() => navigate(joinHref(pathname))}>
            Switch key
          </DM.Item>
          <DM.Item className={itemCls} onSelect={() => navigate("/")}>
            Website
          </DM.Item>
          <DM.Item className={itemCls} onSelect={() => window.open(explorer.account(CONTRACT), "_blank", "noopener")}>
            Contract on nearblocks
          </DM.Item>
          <DM.Separator className="my-1 h-px bg-border" />
          <DM.Item
            className={itemCls}
            onSelect={() => {
              clearMember()
              navigate("/unit/join")
            }}
          >
            Leave
            <span className="text-[0.75rem] text-muted-foreground">forgets the key in this tab</span>
          </DM.Item>
        </DM.Content>
      </DM.Portal>
    </DM.Root>
  )
}
