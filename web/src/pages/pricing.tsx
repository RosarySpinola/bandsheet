import { useState } from "react"
import { Link } from "react-router"
import { Check, ChevronDown, Minus } from "lucide-react"
import { cn } from "@/lib/utils"
import { SiteHeader } from "@/components/gl/site-header"
import { SiteFooter } from "@/components/gl/site-footer"
import { Reveal } from "@/components/gl/reveal"

const ROWS: [string, boolean | string, boolean | string][] = [
  ["Members per unit", "Up to 500", "Unlimited, many units"],
  ["Payslip reads inside NEAR AI Cloud's TEE", "2,000 a month", "Pooled across units"],
  ["Releases by DAO vote, history-checked", true, true],
  ["Attack-safe engine on OutLayer (Intel TDX)", true, true],
  ["Release and refusal ledger on NEAR", true, true],
  ["Article 7 pay-information letters", true, true],
  ["Cross-unit federation bands", false, true],
  ["Your own engine build, pinned and attested", false, true],
]

const FAQ = [
  ["What counts as usage?", "One payslip read inside NEAR AI Cloud's enclave. Releases, votes, refusals and letters are not metered."],
  ["What happens at the limit?", "The 2,001st payslip read in a calendar month is refused, and reading starts again on the 1st (UTC). Members can still type their figures in, and releases keep working."],
  ["Who pays?", "The union or committee, never the member. A member only ever needs the one-purpose key their committee gives them."],
  ["Is there a judges' code?", "Not needed. The demo unit runs on NEAR testnet with synthetic data, and every feature is open without paying."],
  ["How do we switch plans?", "Write to us and we move the unit across. The contract, the ledger and the release history stay exactly where they are."],
] as const

export default function PricingPage() {
  return (
    <div className="min-h-svh bg-white">
      <SiteHeader />
      <main className="gl-section pt-[calc(var(--gl)*12)]! max-[991px]:pt-28!">
        <div className="gl-container flex flex-col gap-[calc(var(--gl)*5)]">
          <Reveal>
            <h1 className="gl-h1">Choose your plan</h1>
            <p className="gl-body1 mt-[var(--gl)] max-w-[calc(var(--gl)*48)]">
              Free for a single chapel, every feature included. Federations pay per member.
            </p>
          </Reveal>

          <div className="grid grid-cols-2 gap-[calc(var(--gl)*2)] max-[991px]:grid-cols-1">
            <Reveal delay={0} className="flex flex-col gap-[calc(var(--gl)*2)] bg-band p-[calc(var(--gl)*3)] max-[991px]:p-6">
              <p className="text-[calc(var(--gl)*1.75)] font-semibold text-ink max-[991px]:text-lg">Chapel</p>
              <p className="gl-num text-[calc(var(--gl)*5)] leading-none text-ink max-[991px]:text-5xl">$0</p>
              <p className="gl-body3 max-[991px]:text-[0.9375rem]! max-[991px]:leading-[1.6]!">One union chapel or works council, up to 500 members. Everything Bandsheet does.</p>
              <Link to="/unit/join" className="mt-auto w-fit bg-ink px-[calc(var(--gl)*3)] py-[calc(var(--gl)*1.5)] text-[calc(var(--gl)*1.75)] text-white transition-colors duration-[400ms] ease-gl hover:bg-[#164537] max-[991px]:px-6 max-[991px]:py-3 max-[991px]:text-base">
                Open the demo unit
              </Link>
            </Reveal>
            <Reveal delay={200} className="flex flex-col gap-[calc(var(--gl)*2)] bg-indigo p-[calc(var(--gl)*3)] text-white max-[991px]:p-6">
              <p className="text-[calc(var(--gl)*1.75)] font-semibold max-[991px]:text-lg">Bandsheet Federation</p>
              {/* The unit wraps as one piece onto its own line on narrow screens, never mid-phrase. */}
              <p className="flex flex-wrap items-baseline gap-x-[calc(var(--gl)*0.75)] gap-y-2">
                <span className="gl-num text-[calc(var(--gl)*5)] leading-none max-[991px]:text-5xl">$0.50</span>
                <span className="text-[calc(var(--gl)*1.5)] whitespace-nowrap max-[991px]:text-base">per member a month</span>
              </p>
              <p className="gl-body3 max-[991px]:text-[0.9375rem]! max-[991px]:leading-[1.6]! text-white!">For federations and multi-employer bargaining: many units, cross-unit bands, your own pinned engine build.</p>
              <a href="https://github.com/RosarySpinola/bandsheet/issues" target="_blank" rel="noreferrer" className="mt-auto w-fit bg-white px-[calc(var(--gl)*3)] py-[calc(var(--gl)*1.5)] text-[calc(var(--gl)*1.75)] text-indigo transition-colors duration-[400ms] ease-gl hover:bg-lav-soft max-[991px]:px-6 max-[991px]:py-3 max-[991px]:text-base">
                Contact us
              </a>
            </Reveal>
          </div>

          <Reveal>
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b-2 border-ink">
                  <th className="gl-body3 max-[991px]:text-[0.9375rem]! max-[991px]:leading-[1.6]! py-3 font-semibold">Compare</th>
                  <th className="gl-body3 max-[991px]:text-[0.9375rem]! max-[991px]:leading-[1.6]! py-3 font-semibold">Chapel</th>
                  <th className="gl-body3 max-[991px]:text-[0.9375rem]! max-[991px]:leading-[1.6]! py-3 font-semibold">Federation</th>
                </tr>
              </thead>
              <tbody>
                {ROWS.map(([label, a, b]) => (
                  <tr key={label} className="border-b border-border">
                    <td className="gl-body3 max-[991px]:text-[0.9375rem]! max-[991px]:leading-[1.6]! py-[calc(var(--gl)*1.1)] pr-4 max-[991px]:py-3">{label}</td>
                    <Cell v={a} />
                    <Cell v={b} />
                  </tr>
                ))}
              </tbody>
            </table>
          </Reveal>

          <Reveal className="max-w-[calc(var(--gl)*70)]">
            <h2 className="gl-h2 gl-h2-sb mb-[calc(var(--gl)*1.5)]">Questions</h2>
            {FAQ.map(([q, a]) => (
              <Faq key={q} q={q} a={a} />
            ))}
          </Reveal>
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}

function Cell({ v }: { v: boolean | string }) {
  return (
    <td className="gl-body3 max-[991px]:text-[0.9375rem]! max-[991px]:leading-[1.6]! py-[calc(var(--gl)*1.1)] max-[991px]:py-3">
      {typeof v === "string" ? v : v ? <Check className="size-5 text-ink" aria-label="Included" /> : <Minus className="size-5 text-inactive" aria-label="Not included" />}
    </td>
  )
}

/** Greenlock accordion: 200ms height, chevron 0 -> 180deg, title #94a8a2 -> ink in 400ms. */
function Faq({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border-b border-border">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex w-full cursor-pointer items-center justify-between py-[calc(var(--gl)*1.5)] text-left text-[calc(var(--gl)*1.75)] transition-colors duration-[400ms] ease-gl max-[991px]:py-4 max-[991px]:text-lg",
          open ? "text-ink" : "text-[var(--gray-300)]",
        )}
      >
        {q}
        <ChevronDown className={cn("size-6 shrink-0 transition-transform duration-200", open && "rotate-180")} />
      </button>
      <div className={cn("grid transition-[grid-template-rows] duration-200", open ? "grid-rows-[1fr] ease-out" : "grid-rows-[0fr] ease-in")}>
        <p className="gl-body3 max-[991px]:text-[0.9375rem]! max-[991px]:leading-[1.6]! overflow-hidden pb-0 data-[open=true]:pb-4" data-open={open}>
          {a}
        </p>
      </div>
    </div>
  )
}
