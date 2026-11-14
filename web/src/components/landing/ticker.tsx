import { cn } from "@/lib/utils"

type Mark = { name: string; role: string; logo: string; img?: boolean; brand?: string; wide?: boolean }

/* Official brand files: simple-icons marks (CC0) for NEAR, Intel, NVIDIA; OutLayer's own wordmark from outlayer.ai. */
const MARKS: Mark[] = [
  { name: "NEAR AI Cloud", role: "reads payslips in a TEE", logo: "/logos/near.svg", brand: "#00c08b" },
  { name: "OutLayer", role: "runs the sealed engine", logo: "/logos/outlayer-wordmark.png", img: true, wide: true },
  { name: "NEAR Protocol", role: "keeps every release", logo: "/logos/near.svg", brand: "#00c08b" },
  { name: "Sputnik DAO", role: "votes on each release", logo: "/logos/near.svg", brand: "#8b78fe" },
  { name: "Intel TDX", role: "seals the engine", logo: "/logos/intel.svg", brand: "#0071c5" },
  { name: "NVIDIA CC", role: "attests the GPU", logo: "/logos/nvidia.svg", brand: "#76b900" },
]

function Logo({ m }: { m: Mark }) {
  if (m.img) {
    return (
      <img
        src={m.logo}
        alt={m.name}
        className="h-[calc(var(--gl)*1.9)] w-auto opacity-80 grayscale brightness-[0.35] transition-[filter,opacity] duration-[400ms] ease-gl group-hover:opacity-100 group-hover:grayscale-0 group-hover:brightness-100 max-[991px]:h-5"
      />
    )
  }
  return (
    <span
      aria-hidden="true"
      className="block size-[calc(var(--gl)*2.2)] bg-ink transition-colors duration-[400ms] ease-gl group-hover:bg-[var(--brand)] max-[991px]:size-6"
      style={{ mask: `url(${m.logo}) center / contain no-repeat`, WebkitMask: `url(${m.logo}) center / contain no-repeat` }}
    />
  )
}

/** Greenlock logo ticker: white band, pinned label box, 70s linear drift; logos ink by default, brand colour on hover. */
export function Ticker() {
  const row = [...MARKS, ...MARKS]
  return (
    <section className="relative flex h-[calc(var(--gl)*9)] items-center overflow-hidden bg-white max-[991px]:h-auto max-[991px]:flex-col max-[991px]:items-start max-[991px]:gap-4 max-[991px]:py-6">
      <p className="gl-body3 relative z-[2] flex h-full w-[calc(var(--gl)*45)] shrink-0 items-center bg-white px-[calc(var(--gl)*2.25)] max-[991px]:w-auto max-[991px]:px-4">
        Sealed by the stack NEAR builders
        <br className="max-[991px]:hidden" /> already trust
      </p>
      <div className="flex min-w-0 flex-1 overflow-hidden">
        <ul className="gl-ticker-track flex shrink-0 items-center gap-[calc(var(--gl)*6)] pr-[calc(var(--gl)*6)] hover:[animation-play-state:paused]">
          {row.map((m, i) => (
            <li
              key={i}
              aria-hidden={i >= MARKS.length}
              className="group flex shrink-0 items-center gap-[calc(var(--gl)*0.9)] whitespace-nowrap"
              style={{ "--brand": m.brand ?? "var(--ink)" } as React.CSSProperties}
            >
              <Logo m={m} />
              <span className="flex flex-col">
                {!m.wide && (
                  <span className={cn("text-[calc(var(--gl)*1.55)] leading-tight font-semibold text-ink max-[991px]:text-base")}>{m.name}</span>
                )}
                <span className="text-[calc(var(--gl)*1.05)] leading-tight text-[var(--gray-350)] max-[991px]:text-xs">{m.role}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
