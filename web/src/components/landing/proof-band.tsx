import { Reveal } from "@/components/gl/reveal"

const STATS = [
  { value: "0 of 100", label: "generated attacks leaked a salary" },
  { value: "931 cells", label: "still published, of the typical tool's 1,265" },
  { value: "37 of 38", label: "payslips verified in release #3, one forgery refused" },
]

/** Greenlock "numbers" band: centred serif claim, calm sub, a row of three marks. */
export function ProofBand() {
  return (
    <section id="proof" className="gl-section bg-band text-center">
      <div className="gl-container"><div className="mx-auto flex max-w-[calc(var(--gl)*72)] flex-col items-center gap-[calc(var(--gl)*2)]">
        <Reveal duration={500}>
          <h2 className="gl-h1 max-[479px]:text-[calc(var(--gl)*2.9)] max-[479px]:leading-[calc(var(--gl)*3.1)]">
            A typical pay tool gave up a salary in 95 of 100 attacks. Bandsheet gave up none.
          </h2>
        </Reveal>
        <Reveal duration={500} delay={200}>
          <p className="gl-body3 mx-auto max-w-[calc(var(--gl)*43)]">
            100 generated join, leave and overlap attacks, solved by an independent exact attacker that shares no code
            with our engine. Same synthetic payroll, same rule: hide groups under 3.
          </p>
        </Reveal>
      </div>
      <Reveal duration={500} delay={400}>
        <div className="mt-[calc(var(--gl)*5)] flex flex-wrap items-start justify-center gap-[calc(var(--gl)*7)] max-[991px]:gap-x-5 max-[991px]:gap-y-6">
          {STATS.map((s) => (
            <div key={s.value} className="flex max-w-[calc(var(--gl)*17)] items-center gap-[calc(var(--gl)*1.25)] max-[991px]:max-w-[10.5rem] max-[991px]:gap-1.5">
              <Laurel />
              <div className="flex flex-col items-center gap-1">
                <span className="gl-num text-[calc(var(--gl)*3)] leading-none whitespace-nowrap text-ink max-[991px]:text-[1.35rem]">{s.value}</span>
                <span className="text-center text-[calc(var(--gl)*1.15)] leading-snug text-[var(--gray-350)] max-[991px]:text-[0.7rem]">{s.label}</span>
              </div>
              <Laurel flip />
            </div>
          ))}
        </div>
      </Reveal>
      </div>
    </section>
  )
}

function Laurel({ flip }: { flip?: boolean }) {
  return (
    <svg viewBox="0 0 20 60" className="h-[calc(var(--gl)*5.5)] w-auto shrink-0 text-ink max-[991px]:h-12" style={flip ? { transform: "scaleX(-1)" } : undefined} aria-hidden="true">
      <path d="M14 4 C4 18 4 42 14 56" fill="none" stroke="currentColor" strokeWidth="1.5" />
      {[10, 20, 30, 40, 50].map((y, i) => (
        <ellipse key={y} cx={i % 2 ? 9 : 7.5} cy={y} rx="4.2" ry="2" transform={`rotate(-35 8 ${y})`} fill="currentColor" />
      ))}
    </svg>
  )
}
