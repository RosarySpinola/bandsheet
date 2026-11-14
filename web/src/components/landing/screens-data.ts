export type ScreenSlide = {
  img: string
  alt: string
  to: string
  cta: string
  title: string
  steps: { head: string; body: string }[]
}

/** Real captures of the live demo unit (bandsheet.pages.dev, NEAR testnet, synthetic chapel). */
export const SCREEN_SLIDES: ScreenSlide[] = [
  {
    img: "/landing/screen-attack.webp",
    alt: "Attack lab: the typical tool's subtraction gives €70,000, Bandsheet shows Withheld",
    to: "/unit/attack",
    cta: "Open the attack lab",
    title: "Subtract two honest tables",
    steps: [
      { head: "Pick Release #1 and #2, Senior", body: "Both tables pass the rule that hides groups under 3." },
      { head: "A typical tool gives up €70,000", body: "10 × €63,160 − 9 × €62,400: one person's exact salary." },
      { head: "Bandsheet shows the refusal", body: "The cell is withheld, and its witness is on NEAR testnet." },
    ],
  },
  {
    img: "/landing/screen-releases.webp",
    alt: "Release ledger: release #3 with 37 payslips verified and 1 forged payslip refused",
    to: "/unit/releases",
    cta: "Open the release ledger",
    title: "Every release, every refusal",
    steps: [
      { head: "37 of 38 payslips verified", body: "Release #3 required the employer's DKIM signature." },
      { head: "One forged payslip refused", body: "Reported by reason and count only: dkim_bad_signature." },
      { head: "Senior withheld, the rest published", body: "Each row links its transaction and OutLayer attestation." },
    ],
  },
  {
    img: "/landing/screen-vote.webp",
    alt: "Chapel vote: a Sputnik DAO proposal waiting for council seats",
    to: "/unit/vote",
    cta: "Open the chapel vote",
    title: "Asked for, then voted",
    steps: [
      { head: "Every table is a proposal", body: "Filed on the chapel's Sputnik DAO, in public." },
      { head: "Two of three seats approve", body: "Council seats vote from their own wallets." },
      { head: "Only a passed vote reaches the engine", body: "The same DAO decides which employer keys to trust." },
    ],
  },
  {
    img: "/landing/screen-join.webp",
    alt: "Join your chapel: connect a NEAR wallet, next to a sealed release card",
    to: "/unit/join",
    cta: "Join your chapel",
    title: "Join with your own wallet",
    steps: [
      { head: "Connect through NEAR Connect", body: "Meteor and other NEAR wallets, or an Ethereum wallet." },
      { head: "Vouch for a posting key", body: "It can only call submit. It cannot hold or move funds." },
      { head: "Entries go on chain gas-free", body: "Sealed in your browser; your wallet never sits next to an entry." },
    ],
  },
  {
    img: "/landing/screen-verify.webp",
    alt: "Verify it yourself: the policy k = 3 and the enclave public key, each with a command",
    to: "/unit/verify",
    cta: "Verify it yourself",
    title: "Trust nothing on this page",
    steps: [
      { head: "The policy, read from the contract", body: "k = 3: the smallest group the engine will publish." },
      { head: "The engine build and enclave key", body: "Each one with the command that checks it." },
      { head: "pnpm verify", body: "Re-checks 19 claims, read-only, in about six seconds." },
    ],
  },
]
