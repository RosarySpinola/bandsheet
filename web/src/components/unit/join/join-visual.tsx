import { Lock } from "lucide-react"
import { ShardField } from "@/components/landing/shard-field"
import { eur } from "@/lib/format"

/** Release #2 as published on testnet (synthetic data): Senior withheld by the differencing audit. */
const ROWS: { grade: string; n?: number; mean?: number }[] = [
  { grade: "Junior", n: 8, mean: 30713 },
  { grade: "Reporter", n: 11, mean: 43000 },
  { grade: "Senior" },
  { grade: "Editor", n: 5, mean: 81780 },
  { grade: "Chief", n: 3, mean: 109333 },
]

/** Right half of the join page: Greenlock shards behind a sealed-entry tag and a published band card. */
export function JoinVisual() {
  return (
    <div className="relative hidden overflow-hidden bg-[var(--hero-bg)] lg:block">
      <div className="absolute inset-0 animate-in fade-in-0 delay-1000 duration-500 fill-mode-both ease-gl">
        <ShardField mobile />
      </div>
      <div className="relative flex h-full min-h-dvh items-center justify-center p-12">
        <div className="relative w-full max-w-[25rem] animate-in fade-in-0 slide-in-from-bottom-12 delay-500 duration-1000 fill-mode-both ease-gl">
          <div className="absolute -top-14 -left-10 z-10 flex items-center gap-3 bg-ink px-4 py-3 text-white">
            <span className="grid size-8 place-items-center bg-lav-mid text-ink">
              <Lock className="size-4" />
            </span>
            <span className="flex flex-col">
              <span className="text-[0.875rem] font-semibold">Entry sealed</span>
              <span className="font-mono text-[0.75rem] text-white/70">X25519 → engine key Kn0bVg…E0Y=</span>
            </span>
          </div>
          <div className="bg-white px-7 pt-8 pb-6">
            <p className="text-[0.75rem] font-medium tracking-[0.04em] text-muted-foreground uppercase">Release #2 · mean pay by grade</p>
            <p className="mt-1 font-serif text-[1.75rem] leading-tight text-ink">Harbour Courier chapel</p>
            <ul className="mt-5 flex flex-col">
              {ROWS.map((r) => (
                <li key={r.grade} className="flex h-12 items-center justify-between border-b border-border text-[0.9375rem] last:border-b-0">
                  <span className="font-semibold text-ink">{r.grade}</span>
                  {r.mean ? (
                    <span className="flex items-baseline gap-3">
                      <span className="text-[0.8125rem] text-muted-foreground">n = {r.n}</span>
                      <span className="gl-num text-[1.25rem] text-ink">{eur(r.mean)}</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 border border-ink bg-lav-soft px-2 py-1 text-[0.8125rem] font-semibold text-ink">
                      <Lock className="size-3.5" /> Withheld
                    </span>
                  )}
                </li>
              ))}
            </ul>
            <p className="mt-4 font-mono text-[0.75rem] leading-relaxed text-muted-foreground">
              Release #2 Senior − Release #1 Senior isolates 1 member
            </p>
          </div>
          <p className="mt-4 text-[0.8125rem] text-ink/70">Synthetic data, as logged on NEAR testnet.</p>
        </div>
      </div>
    </div>
  )
}
