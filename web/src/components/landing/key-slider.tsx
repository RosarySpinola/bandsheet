import { useState } from "react"
import { cn } from "@/lib/utils"

const SLIDES = [
  {
    title: "Read privately.",
    body: "A member drops in a payslip. NEAR AI Cloud reads it inside a GPU enclave, and before a single byte is sent we check a fresh attestation and, afterwards, the signed response. The member confirms five fields. The payslip itself is never stored.",
  },
  {
    title: "Asked by the chapel.",
    body: "Nobody can query the box on a whim. A release is a Sputnik DAO proposal: pay by grade, by site, by gender. Members vote, and only a passed vote reaches the engine. Every request is public; every answer is accounted for.",
  },
  {
    title: "Decided in a sealed engine.",
    body: "OutLayer runs our audit inside Intel TDX with a key that exists only in the enclave. It replays every earlier release, solves the attacker's equations first, and withholds any cell that would expose one person. The result and the refusal both land on NEAR.",
  },
]

/** Greenlock key-message slider: next slide peeks, 500ms slide, active ink / inactive #909294, tiny dots. */
export function KeySlider() {
  const [i, setI] = useState(0)
  return (
    <section className="gl-section overflow-hidden bg-band">
      <div className="gl-container">
        <div className="w-[92%] max-[991px]:w-full">
          <div
            className="flex gap-[calc(var(--gl)*16)] transition-transform duration-500 ease-gl max-[991px]:flex-col max-[991px]:gap-10 max-[991px]:transform-none!"
            style={{ transform: `translateX(calc(${-i} * (50% + var(--gl) * 8)))` }}
          >
            {SLIDES.map((s, k) => (
              <button
                type="button"
                key={s.title}
                onClick={() => setI(Math.min(k, SLIDES.length - 2))}
                className={cn(
                  "flex w-[calc(50%-var(--gl)*8)] shrink-0 cursor-pointer flex-col gap-[var(--gl)] text-left transition-colors duration-[400ms] ease-gl max-[991px]:w-full",
                  k === i || k === i + 1 ? "text-ink" : "text-[var(--slide-off)]",
                )}
              >
                <h3 className="text-[calc(var(--gl)*2)] leading-[calc(var(--gl)*2.6)] font-semibold max-[991px]:text-xl">{s.title}</h3>
                <p className="gl-body3 text-inherit!">{s.body}</p>
              </button>
            ))}
          </div>
        </div>
        <div className="mt-[calc(var(--gl)*5)] flex justify-center gap-2 max-[991px]:hidden" role="tablist" aria-label="Slides">
          {[0, 1].map((d) => (
            <button
              key={d}
              type="button"
              role="tab"
              aria-selected={i === d}
              aria-label={`Slide ${d + 1}`}
              onClick={() => setI(d)}
              className={cn(
                "size-2 cursor-pointer rounded-full border border-ink transition-colors duration-100",
                i === d ? "bg-ink" : "bg-transparent",
              )}
            />
          ))}
        </div>
      </div>
    </section>
  )
}
