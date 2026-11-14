import { Link } from "react-router"
import { LegalLink, LegalPage, type LegalSection } from "@/components/gl/legal-page"

const SECTIONS: LegalSection[] = [
  {
    title: "No passwords, no cookies",
    body: (
      <p>
        There is no sign-up form and no password. You join with your own NEAR wallet, or try the judge demo with no wallet at all. Bandsheet
        sets no cookies and runs no analytics or tracking scripts.
      </p>
    ),
  },
  {
    title: "Your wallet and your posting key",
    body: (
      <>
        <p>
          When you join with a wallet, it signs a one-time message that proves you hold the account. Your browser then makes a posting key:
          it can only call submit on the union account and holds no funds. It is kept in this tab's session storage and nowhere else, and
          closing the tab clears it.
        </p>
        <p>
          Each entry is signed by your wallet and posted by the posting key, so your account never appears next to your entry on chain. The
          shared judge-demo key is the one exception: our server holds it so anyone can try the demo, and signs with it when you choose it.
        </p>
      </>
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
    title: "Which account holds which slot",
    body: (
      <p>
        For members who join with a wallet, a second D1 database keeps the account name and its member slot (a hash of the posting key),
        single-use sign-in nonces, and, for each wallet-signed entry, the account, slot, entry hash and time. This link is never written to
        NEAR. It lets the chapel replace a member's old key when they join again and lets a member prove an entry is theirs. It never holds a
        pay figure.
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
        NEAR AI Cloud reads payslips, OutLayer runs the sealed engine, your own wallet (through NEAR Connect) signs, NEAR testnet RPC providers serve chain reads, Eurostat supplies public
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
