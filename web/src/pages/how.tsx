import { Link } from "react-router"
import { SiteHeader } from "@/components/gl/site-header"
import { SiteFooter } from "@/components/gl/site-footer"
import { Reveal } from "@/components/gl/reveal"
import { cn } from "@/lib/utils"

const WAYS = [
  {
    name: "Your own unit",
    tag: "Your team, your payslips",
    tone: "bg-band",
    points: [
      "Start it from your NEAR wallet on the units contract. You hold its first council seat.",
      "Colleagues join with your invite link. Their wallets sign, but never sit next to an entry on chain.",
      "Add your own payslip: DKIM-verified when your employer's email domain is listed, otherwise badged self-attested.",
      "A release runs when more than half of the unit's council approves it, in the contract, from their own wallets.",
      "One member publishes nothing (n\u00a0<\u00a03). The council can add up to 8 synthetic colleagues, labelled as sample data everywhere.",
    ],
    cta: { to: "/start", label: "Start your unit" },
  },
  {
    name: "The example chapel",
    tag: "A synthetic newsroom, ready to explore",
    tone: "bg-lav-soft",
    points: [
      "The Harbour Courier, a fictional newsroom: synthetic members and pay, with real sealed entries and releases on NEAR testnet.",
      "Every release is a Sputnik DAO proposal; two of its three council seats must approve it.",
      "Release #3 required the employer's DKIM signature: 37 of 38 payslips verified, one forgery refused.",
      "The attack lab replays the subtraction that gives up one salary in a typical tool.",
    ],
    cta: { to: "/unit", label: "Explore the example chapel" },
  },
]

const SHARED = [
  ["Read privately.", "NEAR AI Cloud reads the payslip inside a TEE, after its attestation checks out against a fresh nonce. Nothing is stored."],
  ["Sealed in your browser.", "The confirmed entry is sealed to a key that exists only inside the OutLayer enclave, then posted gas-free by a key that can only call submit."],
  ["Asked by vote.", "Nobody can query the box on a whim. A release runs only after the council's vote passes: in your unit's own council, or the example chapel's DAO."],
  ["Decided in a sealed engine.", "The same OutLayer engine build on Intel TDX replays every earlier release and withholds any cell that would expose one person. Bands and refusals land on NEAR."],
] as const

function Arrow({ to, children, className }: { to: string; children: React.ReactNode; className?: string }) {
  return (
    <Link to={to} className={cn("group inline-flex w-fit items-baseline gap-[calc(var(--gl)*0.4)] font-semibold text-ink", className)}>
      <span className="wipe group-hover:after:scale-x-100">{children}</span>
      <span aria-hidden="true" className="text-[0.8em]">↳</span>
    </Link>
  )
}

/** Public How it works: both ways in (your own unit, the example chapel), then the four layers they share. */
export default function HowPage() {
  return (
    <div className="min-h-svh bg-white">
      <SiteHeader />
      <main className="gl-section pt-[calc(var(--gl)*12)]! max-[991px]:pt-28!">
        <div className="gl-container flex flex-col gap-[calc(var(--gl)*5)] max-[991px]:gap-12">
          <Reveal>
            <h1 className="gl-h1">How it works</h1>
            <p className="gl-body1 mt-[var(--gl)] max-w-[calc(var(--gl)*52)]">
              Pool pay privately, publish average pay by group, and refuse any table that would single someone out. Run it for your own team, or look around a finished one first.
            </p>
          </Reveal>

          <div className="grid grid-cols-2 gap-[calc(var(--gl)*2)] max-[991px]:grid-cols-1">
            {WAYS.map((w, i) => (
              <Reveal key={w.name} delay={i * 200} className={cn("flex flex-col gap-[calc(var(--gl)*1.5)] p-[calc(var(--gl)*3)] max-[991px]:gap-4 max-[991px]:p-6", w.tone)}>
                <div className="flex flex-col gap-1">
                  <h2 className="gl-h3">{w.name}</h2>
                  <p className="text-[calc(var(--gl)*1.25)] text-muted-foreground max-[991px]:text-[0.9375rem]">{w.tag}</p>
                </div>
                <ul className="flex flex-col">
                  {w.points.map((p) => (
                    <li key={p} className="flex gap-3 border-b border-ink/15 py-[calc(var(--gl)*0.9)] text-[calc(var(--gl)*1.3)] leading-[1.55] text-ink max-[991px]:py-3 max-[991px]:text-[0.9375rem]">
                      <span className="mt-[0.6em] size-2 shrink-0 bg-lav" aria-hidden="true" />
                      {p}
                    </li>
                  ))}
                </ul>
                <Arrow to={w.cta.to} className="mt-auto text-[calc(var(--gl)*1.75)] max-[991px]:text-lg">
                  {w.cta.label}
                </Arrow>
              </Reveal>
            ))}
          </div>

          <section className="flex flex-col gap-[calc(var(--gl)*2)]" aria-labelledby="shared">
            <Reveal>
              <h2 id="shared" className="gl-h2">What both share</h2>
            </Reveal>
            <ol className="flex flex-col border-t-2 border-ink">
              {SHARED.map(([title, body], i) => (
                <Reveal key={title} as="li" className="grid grid-cols-[calc(var(--gl)*4)_minmax(0,1fr)_minmax(0,1.6fr)] gap-[calc(var(--gl)*2)] border-b border-border py-[calc(var(--gl)*2)] max-[991px]:grid-cols-[2.5rem_minmax(0,1fr)] max-[991px]:gap-x-3 max-[991px]:gap-y-2 max-[991px]:py-6">
                  <span className="gl-num text-[calc(var(--gl)*1.75)] text-[var(--gray-300)] max-[991px]:text-xl">0{i + 1}</span>
                  <h3 className="gl-h3">{title}</h3>
                  <p className="gl-body3 max-[991px]:col-start-2 max-[991px]:text-[0.9375rem]! max-[991px]:leading-[1.6]!">{body}</p>
                </Reveal>
              ))}
            </ol>
            <div className="flex flex-wrap gap-x-[calc(var(--gl)*3)] gap-y-3 pt-[var(--gl)]">
              <Arrow to="/unit/how" className="text-[calc(var(--gl)*1.5)] max-[991px]:text-base">
                The four layers in depth
              </Arrow>
              <Arrow to="/unit/verify" className="text-[calc(var(--gl)*1.5)] max-[991px]:text-base">
                Verify it yourself
              </Arrow>
            </div>
          </section>
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}
