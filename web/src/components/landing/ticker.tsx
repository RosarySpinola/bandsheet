type Mark = { name: string; logo: string; img?: boolean; brand: string }

/* Official marks: simple-icons (CC0) for NEAR, Intel, NVIDIA; OutLayer's own symbol from outlayer.ai. */
const MARKS: Mark[] = [
  { name: "NEAR AI Cloud", logo: "/logos/near.svg", brand: "#00c08b" },
  { name: "OutLayer", logo: "/logos/outlayer-wordmark.png", img: true, brand: "#0f3026" },
  { name: "Sputnik DAO", logo: "/logos/near.svg", brand: "#8b78fe" },
  { name: "Intel TDX", logo: "/logos/intel.svg", brand: "#0071c5" },
  { name: "NVIDIA", logo: "/logos/nvidia.svg", brand: "#76b900" },
  { name: "NEAR Connect", logo: "/logos/near.svg", brand: "#00c08b" },
]

function Logo({ m }: { m: Mark }) {
  if (m.img) {
    return <img src={m.logo} alt={m.name} width={1257} height={214} className="h-[calc(var(--gl)*2.3)] w-auto grayscale brightness-[0.3] max-[991px]:h-6" />
  }
  return (
    <span
      aria-hidden="true"
      className="block size-[calc(var(--gl)*2.3)] bg-ink transition-colors duration-[400ms] ease-gl group-hover:bg-[var(--brand)] max-[991px]:size-6"
      style={{ mask: `url(${m.logo}) center / contain no-repeat`, WebkitMask: `url(${m.logo}) center / contain no-repeat` }}
    />
  )
}

/** Greenlock logo ticker: white band, label pinned left in a white box, 70s linear drift of ink wordmarks. */
export function Ticker() {
  const row = [...MARKS, ...MARKS, ...MARKS, ...MARKS]
  return (
    <section className="relative flex h-[calc(var(--gl)*8.25)] items-center overflow-hidden bg-white max-[991px]:h-auto max-[991px]:flex-col max-[991px]:items-start max-[991px]:gap-3 max-[991px]:py-5">
      <p className="gl-body3 relative z-[2] flex h-full w-[calc(var(--gl)*30)] shrink-0 items-center bg-white pl-[calc(var(--gl)*2.25)] max-[991px]:w-auto max-[991px]:px-4">
        Sealed by the stack NEAR
        <br className="max-[991px]:hidden" /> builders already trust
      </p>
      <div className="flex w-full min-w-0 flex-1 overflow-hidden">
        <ul className="gl-ticker-track flex shrink-0 items-center gap-[calc(var(--gl)*6)] pr-[calc(var(--gl)*6)] max-[991px]:gap-10 max-[991px]:pr-10">
          {row.map((m, i) => (
            <li
              key={i}
              aria-hidden={i >= MARKS.length}
              className="group flex shrink-0 items-center gap-[calc(var(--gl)*0.75)] whitespace-nowrap"
              style={{ "--brand": m.brand } as React.CSSProperties}
            >
              <Logo m={m} />
              {!m.img && <span className="text-[calc(var(--gl)*2.1)] leading-none font-semibold tracking-[-0.02em] text-ink max-[991px]:text-lg">{m.name}</span>}
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
