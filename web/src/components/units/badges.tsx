import { FlaskConical, MailCheck, PenLine } from "lucide-react"
import { cn } from "@/lib/utils"
import { int } from "@/lib/format"
import type { EntryCounts, EntryKind } from "@/lib/units"

const LOOK: Record<EntryKind, { label: string; cls: string; Icon: typeof MailCheck; note: string }> = {
  dkim: { label: "DKIM-verified", cls: "bg-ink text-white", Icon: MailCheck, note: "Signed by a listed employer domain; the engine checks the signature at every release." },
  self: { label: "Self-attested", cls: "border border-ink bg-white text-ink", Icon: PenLine, note: "A PDF, image or typed payslip. Counted, but nobody but you vouches for it." },
  synthetic: { label: "Synthetic · sample data", cls: "bg-lav-mid text-indigo", Icon: FlaskConical, note: "Made up by the server so bands can publish. Never a real person." },
}

/** How an entry is attested, in one square tag. Synthetic is never shown without saying so. */
export function EntryBadge({ kind, className }: { kind: EntryKind; className?: string }) {
  const l = LOOK[kind]
  return (
    <span title={l.note} className={cn("inline-flex w-fit items-center gap-1.5 px-2 py-1 text-[0.75rem] font-semibold whitespace-nowrap", l.cls, className)}>
      <l.Icon className="size-3.5" strokeWidth={2.25} />
      {l.label}
    </span>
  )
}

export const badgeNote = (kind: EntryKind) => LOOK[kind].note

/** A release's (or the unit's) entries by how they are attested. */
export function CountsStrip({ counts, className, compact }: { counts: EntryCounts; className?: string; compact?: boolean }) {
  const rows: { kind: EntryKind; n: number | null }[] = [
    { kind: "dkim", n: counts.dkim },
    { kind: "self", n: counts.self },
    { kind: "synthetic", n: counts.synthetic },
  ]
  return (
    <ul className={cn("flex flex-wrap gap-x-6 gap-y-3", className)} aria-label="Entries by attestation">
      {rows.map((r) => (
        <li key={r.kind} className="flex items-center gap-2.5">
          <span className={cn("gl-num text-ink", compact ? "text-[1.25rem]" : "text-[1.75rem] leading-none")}>{r.n === null ? "—" : int(r.n)}</span>
          <EntryBadge kind={r.kind} />
        </li>
      ))}
    </ul>
  )
}

/** The banner every view of a release carries when synthetic entries were counted. */
export function SyntheticNotice({ n, className }: { n: number; className?: string }) {
  if (n <= 0) return null
  return (
    <p className={cn("flex items-start gap-3 border-l-2 border-indigo bg-lav-soft px-5 py-3 text-[0.9375rem] leading-relaxed text-indigo", className)}>
      <FlaskConical className="mt-0.5 size-4 shrink-0" />
      <span>
        <strong className="font-semibold">Includes {n} synthetic {n === 1 ? "entry" : "entries"} (sample data).</strong> They were added by the council so bands could publish, and are flagged synthetic on chain. These figures describe no real colleague.
      </span>
    </p>
  )
}
