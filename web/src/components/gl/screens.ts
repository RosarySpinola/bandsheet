import type { GlyphKind } from "./glyph"

export type ScreenLink = { to: string; title: string; kind: GlyphKind; blurb: string }

/** The demo unit's screens; drives the nav mega-panel, the landing "Explore" list and the app sidebar. */
export const SCREENS: ScreenLink[] = [
  {
    to: "/unit/submit",
    title: "Submit a payslip",
    kind: "submit",
    blurb: "A member's key, a payslip read inside NEAR AI Cloud's enclave, sealed to the engine and sent gas-free.",
  },
  {
    to: "/unit/releases",
    title: "Release ledger",
    kind: "ledger",
    blurb: "Every band published and every band refused, with the equation that would have exposed someone.",
  },
  {
    to: "/unit/attack",
    title: "Attack lab",
    kind: "attack",
    blurb: "Play the attacker. Subtract two releases and watch a typical tool give up a salary. Then try Bandsheet.",
  },
  {
    to: "/unit/vote",
    title: "Chapel vote",
    kind: "vote",
    blurb: "Releases are asked for by Sputnik DAO proposal. Council seats vote; only a passed vote reaches the engine.",
  },
  {
    to: "/unit/stand",
    title: "Where do I stand",
    kind: "stand",
    blurb: "Your figure against your band, answered privately, with an Article 7 pay-information letter drafted for you.",
  },
  {
    to: "/unit/verify",
    title: "Verify it yourself",
    kind: "verify",
    blurb: "The policy, the engine's build hash, the enclave key and the attestations. Check each one without trusting us.",
  },
]
