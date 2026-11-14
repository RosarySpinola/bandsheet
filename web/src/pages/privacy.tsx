import { Link } from "react-router"
import { LegalLink, LegalPage, type LegalSection } from "@/components/gl/legal-page"

const SECTIONS: LegalSection[] = [
  {
    title: "No accounts, no cookies",
    body: <p>There is no sign-up and no password. Bandsheet sets no cookies and runs no analytics or tracking scripts.</p>,
  },
  {
    title: "Your member key stays in this tab",
    body: (
      <p>
        When you join the chapel, your member key is kept in this browser tab's session storage and nowhere else. Closing the tab clears it.
        A key you paste is used in your browser to sign your entry. The shared demo member key is the one exception: our server holds it so
        anyone can try the demo, and signs with it when you choose it.
      </p>
    ),
  },
  {
    title: "What goes on NEAR testnet",
    body: (
      <>
        <p>
          One sealed entry per member slot. Your browser encrypts it to the engine's public key before it leaves: gross annual pay, grade,
          gender, site and, if you used one, the signed payroll email. The contract, the chapel and our server only ever see ciphertext; only
          the sealed OutLayer engine can open it.
        </p>
        <p>Release records, refusals, DAO proposals and votes are public on NEAR testnet, as any testnet transaction is.</p>
      </>
    ),
  },
  {
    title: "What our server keeps",
    body: (
      <p>
        A spend ledger in a Cloudflare D1 database: one row per NEAR AI Cloud call (time, model, kind of call, token counts and cost in US
        dollars), plus one zero-cost row per payslip read so the monthly read limit can be counted. No payslip, pay figure, file name, member
        key or IP address is written to it.
      </p>
    ),
  },
  {
    title: "Payslips and your figure",
    body: (
      <p>
        A payslip is sent once to NEAR AI Cloud's attested enclave to read the gross pay, then forgotten. On Where do I stand, your figure goes
        to the attested model with the public bands and the reply comes back to the page only. Neither is stored by Bandsheet. To enforce
        rate limits, the server holds your IP address briefly in memory; it is never written down.
      </p>
    ),
  },
  {
    title: "Please use the synthetic samples",
    body: (
      <p>
        The Harbour Courier chapel and every salary in it were generated for this demo. If you upload a real payslip it is handled as above,
        but it is still sent to NEAR AI Cloud, so the sample payroll emails are the better choice.
      </p>
    ),
  },
  {
    title: "Services involved",
    body: (
      <p>
        NEAR AI Cloud reads payslips, OutLayer runs the sealed engine, NEAR testnet RPC providers serve chain reads, Eurostat supplies public
        wage statistics and Cloudflare hosts the site and the spend ledger. See also the <Link to="/terms" className="wipe font-medium text-ink">terms</Link>.
      </p>
    ),
  },
  {
    title: "Questions",
    body: (
      <p>
        Open an issue on <LegalLink href="https://github.com/RosarySpinola/bandsheet/issues">GitHub</LegalLink>.
      </p>
    ),
  },
]

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy"
      lede="Bandsheet is a demo on NEAR testnet with a synthetic chapel. This is everything it keeps, and where."
      updated="14 November 2026"
      sections={SECTIONS}
    />
  )
}
