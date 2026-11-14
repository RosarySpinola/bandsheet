import { useRef, useState } from "react"
import { cn } from "@/lib/utils"

const SLIDES = [
  {
    title: "Read inside a TEE.",
    body: "A member drops in the payslip email their payroll sent. NEAR AI Cloud reads it inside a TEE. Its attestation is checked first with a fresh nonce (Intel TDX and NVIDIA), then the signed answer is verified. Nothing is stored.",
  },
  {
    title: "Sealed in the browser.",
    body: "The browser seals each entry to a key that exists only inside an OutLayer enclave on Intel TDX. It goes on chain gas-free, posted by a key that can only call submit. Members join with their own NEAR wallet.",
  },
  {
    title: "Released only by vote.",
    body: "Nobody can query the box on a whim. Every table is a Sputnik DAO proposal, and two of the three council seats must approve it before the engine ever sees the request.",
  },
  {
    title: "Checked before it is published.",
    body: "The enclave checks the employer's DKIM signature against a key the DAO trusts, replays every earlier release and solves the attacker's equations. A refused cell and its witness are written to NEAR.",
  },
  {
    title: "Useful beyond the box.",
    body: "Bands come with Eurostat context (Malta, Professionals, SES 2018: €26,268 a year), a drafted EU Pay Transparency Directive Article 7 letter, and an MCP tool so a rep's assistant can read and verify releases.",
  },
]
const STOPS = SLIDES.length - 1

/** Greenlock key-message slider: half-width slides, next one peeks, 500ms slide, active ink / inactive #909294, tiny dots. */
export function KeySlider() {
  const [i, setI] = useState(0)
  const startX = useRef<number | null>(null)
  const go = (n: number) => setI(Math.max(0, Math.min(STOPS - 1, n)))

  return (
    <section className="gl-section overflow-hidden bg-band">
      <div
        className="gl-container touch-pan-y select-none max-[991px]:select-auto"
        onPointerDown={(e) => (startX.current = e.clientX)}
        onPointerUp={(e) => {
          if (startX.current === null) return
          const dx = e.clientX - startX.current
          startX.current = null
          if (Math.abs(dx) > 40) go(i + (dx < 0 ? 1 : -1))
        }}
      >
        <div
          className="flex transition-transform duration-500 ease-gl max-[991px]:flex-col max-[991px]:gap-10 max-[991px]:transform-none!"
          style={{ transform: `translateX(${-i * 50}%)` }}
        >
          {SLIDES.map((s, k) => {
            const on = k === i || k === i + 1
            return (
              <article
                key={s.title}
                onClick={() => go(k === i + 1 ? i + 1 : k)}
                className={cn(
                  "flex basis-1/2 shrink-0 cursor-pointer flex-col gap-[calc(var(--gl)*1.25)] pr-[calc(var(--gl)*12)] transition-colors duration-[400ms] ease-gl max-[991px]:basis-auto max-[991px]:cursor-auto max-[991px]:pr-0",
                  on ? "text-ink" : "text-[var(--slide-off)] max-[991px]:text-ink",
                )}
              >
                <h3 className="text-[calc(var(--gl)*2.25)] leading-[calc(var(--gl)*2.875)] font-semibold max-[991px]:text-[1.35rem] max-[991px]:leading-8">
                  {s.title}
                </h3>
                <p className="text-[calc(var(--gl)*1.75)] leading-[calc(var(--gl)*2.375)] max-[991px]:text-base max-[991px]:leading-7">{s.body}</p>
              </article>
            )
          })}
        </div>
        <div className="mt-[calc(var(--gl)*7)] flex justify-center gap-[calc(var(--gl)*0.75)] max-[991px]:hidden" role="tablist" aria-label="Slides">
          {Array.from({ length: STOPS }, (_, d) => (
            <button
              key={d}
              type="button"
              role="tab"
              aria-selected={i === d}
              aria-label={`Show slides ${d + 1} and ${d + 2}`}
              onClick={() => go(d)}
              className="grid size-6 cursor-pointer place-items-center"
            >
              <span className={cn("block size-[9px] rounded-full border-[1.5px] border-ink transition-colors duration-100", i === d ? "bg-ink" : "bg-transparent")} />
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}
