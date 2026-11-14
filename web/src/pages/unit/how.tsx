import { ArrowDown, ArrowRight } from "lucide-react"
import { Fragment } from "react"
import { Reveal } from "@/components/gl/reveal"
import { Page } from "@/components/unit/page"
import { PageHeader } from "@/components/unit/page-header"
import { CtaLink } from "@/components/unit/links"
import { NavGlyph } from "@/components/unit/nav-glyph"
import { cn } from "@/lib/utils"

const FLOW = ["Payslip", "NEAR AI Cloud TEE", "Sealed in your browser", "NEAR contract", "Chapel vote", "OutLayer TEE", "Band or refusal on NEAR"]

const LAYERS = [
  {
    n: "01",
    kind: "submit" as const,
    title: "Read privately.",
    who: "NEAR AI Cloud",
    body: "A member drops in a payslip. NEAR AI Cloud reads it inside a GPU enclave, and before a single byte is sent the server checks a fresh attestation; afterwards it checks the signed response. The member confirms the fields, they are sealed in the browser to the engine's key, and the payslip itself is never stored.",
    points: ["Attestation checked against a fresh nonce", "Response signature verified against the attested signer", "Only four fields and a slot id are sealed"],
    link: { to: "/unit/submit", label: "Submit a payslip" },
  },
  {
    n: "02",
    kind: "vote" as const,
    title: "Asked by the chapel.",
    who: "Sputnik DAO on NEAR",
    body: "Nobody can query the box on a whim. A release is a Sputnik DAO proposal: pay by grade, by site, by gender. Members vote, and only a passed vote reaches the engine. Every request is public; every answer is accounted for.",
    points: ["Each proposal names its query", "Votes are on-chain", "A passed vote calls the contract, which calls OutLayer"],
    link: { to: "/unit/vote", label: "See the chapel vote" },
  },
  {
    n: "03",
    kind: "ledger" as const,
    title: "Decided in a sealed engine.",
    who: "OutLayer, Intel TDX",
    body: "OutLayer runs the audit inside Intel TDX with a key that exists only in the enclave. It replays every earlier release, solves the attacker's equations first, and withholds any cell that would expose one person. The bands and the refusals both land on NEAR with the hashes of what ran.",
    points: ["Cells under k members are never shown", "Cells that subtraction would expose are withheld", "Each run is attested with its WASM, input and output hashes"],
    link: { to: "/unit/releases", label: "Open the release ledger" },
  },
]

export default function How() {
  return (
    <Page>
      <PageHeader
        glyph="how"
        eyebrow="Learn"
        title="How it works"
        lede="Three layers, each run by a different party, so no single one of them, us included, ever holds a member's figure in the clear."
      />

      <Reveal>
        <ol className="flex flex-col items-start gap-2 bg-band p-6 md:flex-row md:flex-wrap md:items-center md:gap-3 md:p-8" aria-label="The path of one entry">
          {FLOW.map((step, i) => (
            <Fragment key={step}>
              <li className={cn("px-3 py-2 text-[0.9375rem] font-semibold", i === 0 || i === FLOW.length - 1 ? "bg-ink text-white" : "bg-white text-ink")}>{step}</li>
              {i < FLOW.length - 1 && (
                <li aria-hidden="true" className="text-ink/50">
                  <ArrowDown className="size-4 md:hidden" />
                  <ArrowRight className="hidden size-4 md:block" />
                </li>
              )}
            </Fragment>
          ))}
        </ol>
      </Reveal>

      <div className="flex flex-col">
        {LAYERS.map((l, i) => (
          <Reveal key={l.n} delay={0}>
            <section className="grid grid-cols-1 gap-8 border-t-2 border-ink py-12 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] md:gap-14 md:py-16">
              <div className="flex flex-col gap-5">
                <div className="flex items-center gap-4">
                  <span className="gl-num text-[1.5rem] text-[var(--gray-300)]">{l.n}</span>
                  <NavGlyph kind={l.kind} className="size-12" />
                </div>
                <h2 className="font-serif text-[2.25rem] leading-[1.08] font-medium text-ink md:text-[2.75rem]">{l.title}</h2>
                <p className="text-[0.9375rem] font-medium text-muted-foreground">{l.who}</p>
              </div>
              <div className="flex flex-col gap-6">
                <p className="text-[1.125rem] leading-[1.65] text-foreground">{l.body}</p>
                <ul className="flex flex-col">
                  {l.points.map((p) => (
                    <li key={p} className="flex items-center gap-3 border-b border-border py-3 text-[1rem] text-ink">
                      <span className="size-2 shrink-0 bg-lav" aria-hidden="true" />
                      {p}
                    </li>
                  ))}
                </ul>
                <CtaLink to={l.link.to}>{l.link.label}</CtaLink>
              </div>
            </section>
            {i === LAYERS.length - 1 && <div className="border-t-2 border-ink" />}
          </Reveal>
        ))}
      </div>

      <Reveal className="flex flex-col items-start gap-4 bg-lav-soft p-8 md:p-12">
        <p className="font-serif text-[2rem] leading-tight text-ink">Don't take our word for it.</p>
        <p className="max-w-[40rem] text-[1.0625rem] leading-relaxed text-foreground">
          The policy, the engine build, the enclave key and every release's attestation can be checked from NEAR testnet and OutLayer
          directly.
        </p>
        <CtaLink to="/unit/verify" size="lg">
          Verify it yourself
        </CtaLink>
      </Reveal>
    </Page>
  )
}
