const MARKS = [
  { name: "NEAR AI Cloud", style: "font-semibold tracking-tight" },
  { name: "OutLayer", style: "font-serif italic" },
  { name: "NEAR Protocol", style: "font-bold uppercase tracking-[0.12em] text-[0.8em]" },
  { name: "Sputnik DAO", style: "font-serif" },
  { name: "Intel TDX", style: "font-semibold" },
  { name: "NVIDIA Confidential Computing", style: "font-bold tracking-tight" },
  { name: "EU Directive 2023/970", style: "font-serif italic" },
]

/** Greenlock logo ticker: white band, pinned label box, 70s linear drift, 6rem gaps. */
export function Ticker() {
  const row = [...MARKS, ...MARKS]
  return (
    <section className="relative flex h-[calc(var(--gl)*8.2)] items-center overflow-hidden bg-white max-[991px]:h-auto max-[991px]:flex-col max-[991px]:items-start max-[991px]:gap-4 max-[991px]:py-6">
      <p className="gl-body3 relative z-[2] flex h-full w-[calc(var(--gl)*45)] shrink-0 items-center bg-white px-[calc(var(--gl)*2.25)] max-[991px]:w-auto max-[991px]:px-4">
        Sealed by the stack NEAR builders
        <br className="max-[991px]:hidden" /> already trust
      </p>
      <div className="flex min-w-0 flex-1 overflow-hidden">
        <div className="gl-ticker-track flex shrink-0 items-center gap-[calc(var(--gl)*6)] pr-[calc(var(--gl)*6)] text-[calc(var(--gl)*1.9)] whitespace-nowrap text-ink/85 max-[991px]:text-xl">
          {row.map((m, i) => (
            <span key={i} className={m.style} aria-hidden={i >= MARKS.length}>
              {m.name}
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}
