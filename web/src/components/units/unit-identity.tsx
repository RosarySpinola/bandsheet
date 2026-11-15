import { useNavigate } from "react-router"
import { DropdownMenu as DM } from "radix-ui"
import { Check, ChevronsUpDown, Wallet } from "lucide-react"
import { Glyph, type GlyphKind } from "@/components/gl/glyph"
import { Spinner } from "@/components/ui/spinner"
import { explorer } from "@/lib/chain"
import { cn } from "@/lib/utils"
import { shortAccount } from "@/lib/wallet/identity"
import { useMyUnits } from "@/lib/units/hooks"
import { connectWallet, disconnectWallet, useWallet } from "@/lib/units/wallet-store"
import type { Unit } from "@/lib/units"

const AVATARS: GlyphKind[] = ["submit", "ledger", "vote", "stand", "verify"]
const avatarFor = (id: string) => AVATARS[[...id].reduce((h, c) => (h + c.charCodeAt(0)) % 997, 0) % AVATARS.length]!

const itemCls =
  "flex cursor-pointer items-center justify-between gap-4 px-4 py-3 text-[0.9375rem] text-ink outline-none transition-colors duration-[400ms] ease-gl select-none data-[highlighted]:bg-lav-soft"
const labelCls = "px-4 pt-3 pb-1 text-[0.75rem] font-medium tracking-[0.06em] text-muted-foreground uppercase"

export function roleIn(unit: Unit | undefined, accountId: string | undefined): string {
  if (!unit || !accountId) return ""
  const seat = unit.council.indexOf(accountId)
  return seat >= 0 ? `council seat ${seat + 1}` : "member or visitor"
}

/**
 * Bottom-left identity for a judge's own unit: the connected wallet, its role here, and the unit switcher
 * (get_units_of for this account, plus the example chapel). With no wallet it is the connect button.
 */
export function UnitIdentity({ unit, className, side = "top" }: { unit?: Unit; className?: string; side?: "top" | "bottom" }) {
  const w = useWallet()
  const navigate = useNavigate()
  const account = w.status === "connected" ? w.conn.accountId : undefined
  const mine = useMyUnits(account)

  if (w.status !== "connected") {
    const busy = w.status === "connecting" || w.status === "restoring"
    return (
      <button
        type="button"
        onClick={connectWallet}
        disabled={busy}
        className={cn("group flex w-full cursor-pointer items-center gap-3 border-2 border-ink bg-white p-3 text-left transition-colors duration-[400ms] ease-gl hover:bg-ink hover:text-white disabled:cursor-wait", className)}
      >
        <span className="grid size-10 shrink-0 place-items-center bg-lav-mid text-ink">{busy ? <Spinner className="size-5" /> : <Wallet className="size-5" />}</span>
        <span className="flex min-w-0 flex-col">
          <span className="text-[0.9375rem] font-semibold">{w.status === "connecting" ? "Choose a wallet…" : w.status === "restoring" ? "Checking for a wallet…" : "Connect your NEAR wallet"}</span>
          <span className="truncate text-[0.8125rem] opacity-70">{unit?.name ?? "Testnet · free"}</span>
        </span>
      </button>
    )
  }

  const list = mine.data ?? []
  return (
    <DM.Root modal={false}>
      <DM.Trigger
        className={cn(
          "group flex w-full cursor-pointer items-center gap-3 bg-white p-3 text-left outline-none transition-colors duration-[400ms] ease-gl hover:bg-lav-soft focus-visible:outline-2 focus-visible:outline-lav data-[state=open]:bg-lav-soft",
          className,
        )}
        aria-label={`${account}, open the unit switcher`}
      >
        <span className="grid size-10 shrink-0 place-items-center bg-band">
          <Glyph kind={avatarFor(w.conn.accountId)} className="size-7" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <code className="truncate font-mono text-[0.875rem] font-semibold text-ink" title={w.conn.accountId}>{shortAccount(w.conn.accountId)}</code>
          <span className="truncate text-[0.8125rem] text-muted-foreground">{unit ? `${unit.name} · ${roleIn(unit, account)}` : "No unit open"}</span>
        </span>
        <ChevronsUpDown className="size-4 shrink-0 text-ink/60" />
      </DM.Trigger>
      <DM.Portal>
        <DM.Content
          side={side}
          align="start"
          sideOffset={6}
          className="z-[1000] max-h-[70dvh] w-[var(--radix-dropdown-menu-trigger-width)] min-w-[16rem] overflow-y-auto border-2 border-ink bg-white py-1 duration-300 ease-gl data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0"
        >
          <DM.Label className={labelCls}>Your units</DM.Label>
          {mine.isPending && <p className="flex items-center gap-2 px-4 py-3 text-[0.875rem] text-muted-foreground"><Spinner className="size-3.5" /> Reading get_units_of…</p>}
          {mine.isError && <p className="px-4 py-3 text-[0.875rem] text-muted-foreground">Your units could not be read just now.</p>}
          {mine.isSuccess && list.length === 0 && <p className="px-4 py-3 text-[0.875rem] text-muted-foreground">None yet. Start one below.</p>}
          {list.map((u) => (
            <DM.Item key={u.id} className={itemCls} onSelect={() => navigate(`/u/${u.id}`)}>
              <span className="min-w-0 truncate">{u.name}</span>
              {unit?.id === u.id ? <Check className="size-4 shrink-0" /> : <span className="text-[0.75rem] text-muted-foreground">#{u.id}</span>}
            </DM.Item>
          ))}
          <DM.Item className={itemCls} onSelect={() => navigate("/start")}>
            Start a new unit
          </DM.Item>
          <DM.Separator className="my-1 h-px bg-border" />
          <DM.Item className={itemCls} onSelect={() => navigate("/unit")}>
            Explore the example chapel
            <span className="text-[0.75rem] text-muted-foreground">synthetic demo</span>
          </DM.Item>
          <DM.Item className={itemCls} onSelect={() => window.open(explorer.account(w.conn.accountId), "_blank", "noopener")}>
            Your account on nearblocks
          </DM.Item>
          <DM.Item className={itemCls} onSelect={disconnectWallet}>
            Disconnect
          </DM.Item>
        </DM.Content>
      </DM.Portal>
    </DM.Root>
  )
}
