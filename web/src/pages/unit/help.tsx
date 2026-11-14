import type { ReactNode } from "react"
import { Accordion as A } from "radix-ui"
import { ChevronDown } from "lucide-react"
import { Reveal } from "@/components/gl/reveal"
import { Page } from "@/components/unit/page"
import { PageHeader } from "@/components/unit/page-header"
import { CtaLink } from "@/components/unit/links"

const FAQ: { q: string; a: ReactNode }[] = [
  {
    q: "What is stored, and where?",
    a: "The NEAR contract stores one sealed entry per member slot: an encrypted envelope holding gross annual pay, grade, gender and site. It is sealed in your browser to the engine's public key, so the contract, the chapel and our server only ever see ciphertext. Payslips are never stored: the server forwards them to NEAR AI Cloud's enclave, reads the reply and forgets both.",
  },
  {
    q: "What does a refusal mean?",
    a: "The sealed engine found that publishing a cell would let someone work out one member's pay, either because the group is smaller than k or because subtracting it from an earlier release isolates a single person. The cell is withheld and the refusal is logged on NEAR with the equation that would have exposed them. The last safely published figure stays the public band.",
  },
  {
    q: "Why is a cell withheld when it has more than k members?",
    a: "Because of differencing. If release #1 showed Senior pay for 9 people and release #2 shows it for 10, subtracting the two reveals the newcomer's salary exactly. The engine replays every earlier release before publishing and catches this; a typical n ≥ 3 tool does not. The Attack lab shows it step by step.",
  },
  {
    q: "Who can ask for a release?",
    a: "Any member can propose one through the chapel's Sputnik DAO: a table such as mean pay by grade, by site or by gender. It runs only if the vote passes, and the request, the vote and the result are all public on NEAR.",
  },
  {
    q: "What is k?",
    a: "The smallest number of members a published average may cover. This chapel uses k = 3, set in the contract policy. Raising it makes releases coarser; lowering it is not possible without a new policy, which resets every entry.",
  },
  {
    q: "What can my member key do?",
    a: "Exactly one thing: call submit on the chapel's contract, with a small gas allowance paid by the chapel. It cannot read entries, move funds or vote. Submitting again replaces your previous entry; the count stays the same.",
  },
  {
    q: "What does the Verified panel prove?",
    a: "That the model which read your payslip ran in a TEE whose attestation matched a nonce we generated for that request, and that the reply was signed by that same attested key. Each check is listed with its result, so a failed check is visible rather than hidden.",
  },
  {
    q: "What is the Article 7 letter?",
    a: "Article 7 of the EU Pay Transparency Directive (2023/970) gives workers the right to ask their employer for their own pay level and the average pay, by sex, of people doing the same work or work of equal value. Where do I stand drafts that request for you, without putting your figure in it.",
  },
  {
    q: "Is this real?",
    a: "The contracts, the DAO votes, the OutLayer runs and the NEAR AI Cloud calls are real, on NEAR testnet. The chapel and its members are synthetic: Harbour Courier is a fictional newsroom, and every salary in it was generated for this demo. No mainnet, no real pay data, no payments.",
  },
]

export default function Help() {
  return (
    <Page width="narrow">
      <PageHeader glyph="help" eyebrow="Learn" title="Help" lede="Plain answers about what Bandsheet keeps, what it refuses and why." />
      <Reveal>
        <A.Root type="single" collapsible defaultValue="item-0" className="flex flex-col border-t-2 border-ink">
          {FAQ.map((f, i) => (
            <A.Item key={f.q} value={`item-${i}`} className="group border-b border-border">
              <A.Header>
                <A.Trigger className="flex w-full cursor-pointer items-center justify-between gap-6 py-6 text-left text-[1.25rem] leading-snug font-semibold text-[var(--gray-300)] transition-colors duration-[400ms] ease-gl outline-none hover:text-ink focus-visible:text-ink data-[state=open]:text-ink md:text-[1.375rem]">
                  {f.q}
                  <ChevronDown className="size-6 shrink-0 transition-transform duration-200 ease-out group-data-[state=open]:rotate-180" />
                </A.Trigger>
              </A.Header>
              <A.Content className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
                <p className="max-w-[44rem] pb-7 text-[1.0625rem] leading-[1.7] text-foreground">{f.a}</p>
              </A.Content>
            </A.Item>
          ))}
        </A.Root>
      </Reveal>
      <Reveal className="flex flex-col items-start gap-3 bg-band p-8">
        <p className="font-serif text-[1.75rem] leading-tight text-ink">Still unsure?</p>
        <p className="text-[1rem] text-foreground">See the three layers, or check every claim against the chain yourself.</p>
        <div className="flex flex-wrap gap-x-8 gap-y-3 pt-2">
          <CtaLink to="/unit/how">How it works</CtaLink>
          <CtaLink to="/unit/verify">Verify it yourself</CtaLink>
        </div>
      </Reveal>
    </Page>
  )
}
