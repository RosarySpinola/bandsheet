import { KeyRound } from "lucide-react"
import { CopyButton } from "@/components/unit/copy-button"
import { cn } from "@/lib/utils"
import { inviteLink } from "@/lib/units/invite"

/**
 * The invite, shown once: the code and the link that carries it. Only sha256(code) is on chain, so this is the one
 * moment anyone can copy it.
 */
export function InviteReveal({ unitId, code, className }: { unitId: number; code: string; className?: string }) {
  const link = inviteLink(unitId, code)
  return (
    <div className={cn("flex flex-col gap-5 bg-ink p-6 text-white md:p-8", className)}>
      <div className="flex items-center gap-3">
        <span className="grid size-10 place-items-center bg-lav-mid text-ink">
          <KeyRound className="size-5" />
        </span>
        <div className="flex flex-col">
          <p className="text-[1.0625rem] font-semibold">Your invite, shown once</p>
          <p className="text-[0.875rem] text-white/70">Copy it now. Only a hash of it is on chain; nobody can show it again.</p>
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="text-[0.8125rem] font-medium tracking-[0.02em] text-white/60 uppercase">Invite code</span>
        <span className="flex items-center gap-2">
          <code className="min-w-0 font-mono text-[1.25rem] tracking-[0.04em] break-all text-white sm:text-[1.5rem] md:text-[1.75rem]">{code}</code>
          <CopyButton value={code} label="Copy the invite code" className="text-white/70 hover:bg-white/10 hover:text-white" />
        </span>
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="text-[0.8125rem] font-medium tracking-[0.02em] text-white/60 uppercase">Invite link for colleagues</span>
        <span className="flex min-w-0 items-center gap-2">
          <code className="min-w-0 truncate font-mono text-[0.9375rem] text-lav-mid" title={link}>
            {link}
          </code>
          <CopyButton value={link} label="Copy the invite link" className="text-white/70 hover:bg-white/10 hover:text-white" />
        </span>
      </div>
      <p className="text-[0.875rem] leading-relaxed text-white/70">
        Anyone with the link can join with their own wallet. Joining costs them nothing: their wallet signs a message and Bandsheet's registrar adds their posting key.
      </p>
    </div>
  )
}
