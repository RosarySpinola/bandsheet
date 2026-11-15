import { FlaskConical, KeyRound, Lock, PenLine, Vote } from "lucide-react"
import { ShardField } from "@/components/landing/shard-field"
import { cn } from "@/lib/utils"

const STEPS = [
  { Icon: KeyRound, title: "Create the unit", body: "One create_unit from your wallet. You hold council seat 1." },
  { Icon: PenLine, title: "Seal your payslip", body: "Read in NEAR AI Cloud's enclave, sealed in your browser." },
  { Icon: Vote, title: "Vote a release", body: "More than half the council approves from their own wallets." },
  { Icon: Lock, title: "Only safe bands publish", body: "Groups under 3 are withheld, and the refusal is logged." },
]

/**
 * Right half of /start and /join: the shard art behind a product panel (the unit's steps and the honest one-member
 * result). Static by design: it never waits on an entry animation, and it stays in view while the form scrolls.
 */
export function StartVisual({ className }: { className?: string }) {
  return (
    <div className={cn("relative hidden bg-[var(--hero-bg)] lg:block", className)}>
      <div className="sticky top-0 h-dvh overflow-hidden">
        <div className="absolute inset-0" aria-hidden="true">
          <ShardField mobile />
        </div>
        <div className="relative flex h-full items-center justify-center p-10 xl:p-14">
          <div className="flex w-full max-w-[27rem] flex-col gap-4">
            <ol className="flex flex-col bg-white">
              {STEPS.map((s, i) => (
                <li key={s.title} className="flex items-start gap-4 border-b border-border px-6 py-4 last:border-b-0">
                  <span className={cn("grid size-9 shrink-0 place-items-center", i === 0 ? "bg-ink text-white" : "bg-lav-mid text-ink")}>
                    <s.Icon className="size-4" />
                  </span>
                  <span className="flex flex-col gap-0.5">
                    <span className="text-[0.9375rem] font-semibold text-ink">
                      <span className="gl-num mr-2 text-muted-foreground">{i + 1}</span>
                      {s.title}
                    </span>
                    <span className="text-[0.8125rem] leading-snug text-foreground">{s.body}</span>
                  </span>
                </li>
              ))}
            </ol>
            <div className="flex flex-col gap-3 bg-ink p-6 text-white">
              <p className="text-[0.75rem] font-medium tracking-[0.04em] text-white/60 uppercase">Release #1 · your unit, one member</p>
              <div className="flex items-center justify-between border-b border-white/15 pb-3">
                <span className="font-semibold">Senior</span>
                <span className="inline-flex items-center gap-1.5 bg-lav-mid px-2 py-1 text-[0.8125rem] font-semibold text-ink">
                  <Lock className="size-3.5" /> Withheld
                </span>
              </div>
              <p className="font-mono text-[0.75rem] text-white/70">n = 1 &lt; k = 3: nothing that would expose you is published</p>
              <p className="flex items-center gap-2 text-[0.8125rem] text-lav-mid">
                <FlaskConical className="size-3.5" /> Add synthetic colleagues to see bands publish, labelled as sample data
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
