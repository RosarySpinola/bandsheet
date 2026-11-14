import { cn } from "@/lib/utils"

export type GlyphKind = "submit" | "ledger" | "attack" | "vote" | "stand" | "verify"

/** Small faceted glyphs in the Greenlock lavender / deep-green palette (our own art). */
const SHAPES: Record<GlyphKind, { d: string; fill: string }[]> = {
  submit: [
    { d: "M24 6 L40 16 L24 26 L8 16 Z", fill: "var(--purple-200)" },
    { d: "M8 16 L24 26 L24 42 L8 32 Z", fill: "var(--purple-300)" },
    { d: "M40 16 L24 26 L24 42 L40 32 Z", fill: "var(--ink)" },
  ],
  ledger: [
    { d: "M8 10 H40 V16 H8 Z", fill: "var(--purple-200)" },
    { d: "M8 21 H40 V27 H8 Z", fill: "var(--purple-300)" },
    { d: "M8 32 H40 V38 H8 Z", fill: "var(--ink)" },
  ],
  attack: [
    { d: "M24 4 L44 40 H4 Z", fill: "var(--purple-200)" },
    { d: "M24 16 L34 34 H14 Z", fill: "var(--alarm)" },
  ],
  vote: [
    { d: "M6 24 A18 18 0 0 1 42 24 Z", fill: "var(--purple-300)" },
    { d: "M6 24 A18 18 0 0 0 42 24 Z", fill: "var(--ink)" },
    { d: "M20 20 H28 V28 H20 Z", fill: "var(--purple-100)" },
  ],
  stand: [
    { d: "M8 40 V28 H16 V40 Z", fill: "var(--purple-200)" },
    { d: "M20 40 V16 H28 V40 Z", fill: "var(--ink)" },
    { d: "M32 40 V22 H40 V40 Z", fill: "var(--purple-300)" },
  ],
  verify: [
    { d: "M24 4 L42 12 V24 C42 34 34 41 24 44 C14 41 6 34 6 24 V12 Z", fill: "var(--purple-200)" },
    { d: "M15 24 L22 31 L34 18", fill: "none" },
  ],
}

export function Glyph({ kind, className, muted }: { kind: GlyphKind; className?: string; muted?: boolean }) {
  return (
    <svg viewBox="0 0 48 48" className={cn("size-12 shrink-0", className)} aria-hidden="true">
      {SHAPES[kind].map((s, i) =>
        s.fill === "none" ? (
          <path key={i} d={s.d} fill="none" stroke={muted ? "var(--inactive)" : "var(--ink)"} strokeWidth="3" />
        ) : (
          <path
            key={i}
            d={s.d}
            fill={muted ? "var(--inactive)" : s.fill}
            fillOpacity={muted ? 0.35 + i * 0.2 : 1}
            className="transition-[fill,fill-opacity] duration-700 ease-gl"
          />
        ),
      )}
    </svg>
  )
}
