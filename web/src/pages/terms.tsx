import { Link } from "react-router"
import { LegalLink, LegalPage, type LegalSection } from "@/components/gl/legal-page"

const SECTIONS: LegalSection[] = [
  {
    title: "A demo, not a service",
    body: (
      <p>
        Bandsheet is a hackathon entry. It runs one synthetic chapel, Harbour Courier, on NEAR testnet. It is provided as is, without any
        warranty, and may change or stop at any time.
      </p>
    ),
  },
  {
    title: "Testnet only, nothing is sold",
    body: (
      <p>
        There is no mainnet contract, no real money and no payment. Testnet tokens have no value. The{" "}
        <Link to="/pricing" className="wipe font-medium text-ink">pricing page</Link> describes the plans we intend to offer; nothing is charged
        today.
      </p>
    ),
  },
  {
    title: "Limits",
    body: (
      <p>
        Payslip reads are limited to 2,000 a calendar month for the chapel, and the demo's NEAR AI Cloud spending has a hard cap of USD 2.50.
        When either is reached, reading pauses and you can type your figures in instead. The AI routes are also rate-limited per visitor.
      </p>
    ),
  },
  {
    title: "Bands are averages",
    body: (
      <p>
        A released band is the mean pay of at least k members (k = 3 here). A gap between you and the band is a reason to ask questions, not
        proof of unfair pay. Eurostat figures are a national survey from a past year and describe a broad occupation group.
      </p>
    ),
  },
  {
    title: "Not legal advice",
    body: (
      <p>
        The pay-information letter is a draft based on Article 7 of Directive (EU) 2023/970, the Pay Transparency Directive. National law may
        add to it. Check the draft with your union or an adviser before you send it.
      </p>
    ),
  },
  {
    title: "Use it fairly",
    body: (
      <p>
        Try to break the privacy guarantees as much as you like; that is what the Attack lab is for. Please don't flood the service, upload
        malware, or use it to process someone else's pay data without their consent.
      </p>
    ),
  },
  {
    title: "Open source",
    body: (
      <p>
        The code is MIT-licensed on <LegalLink href="https://github.com/RosarySpinola/bandsheet">GitHub</LegalLink>. How data is handled is set
        out in the <Link to="/privacy" className="wipe font-medium text-ink">privacy notice</Link>.
      </p>
    ),
  },
]

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms"
      lede="Short and plain: what this demo is, what it isn't, and the limits it runs under."
      updated="14 November 2026"
      sections={SECTIONS}
    />
  )
}
