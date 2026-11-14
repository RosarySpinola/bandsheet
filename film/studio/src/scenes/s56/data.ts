/** S5–S6 content. Every figure is real (synthetic payroll, NEAR testnet); see tools/verify and enclave/evaluation. */

/** Footage slot F3 (/unit/releases, record #3) in a browser frame the camera travels onto. false = motion-graphics proof column. */
export const USE_F3 = true
export const F3_SRC = "footage/F3.mp4"
/** F3 source frame shown when the camera starts its travel (≈4.1 s: record #3 card scrolled to the top). */
export const F3_TRIM = 122

/**
 * /unit/attack recorded from https://bandsheet.pages.dev (agent-browser, headless, 1920×1080, 30 fps, 14 Nov 2026):
 * the cursor presses Subtract at source frame 57; €70,000 settles ≈111; Withheld ≈135, its lock ≈147.
 * (F7.mp4 is the landing page, not /unit/attack.)
 */
export const F7A_SRC = "footage/F7-attack.mp4"
export const F7A_CLICK = 57
/** The app's sidebar width in that recording (the crop removes it; our own sidebar stands in). */
export const F7A_SIDEBAR = 304

/** Release #3: the vote tx that triggered the OutLayer run (NEAR testnet, 14 Nov 2026). */
export const TX_HASH = "CqPS4C69oPj6BgaTxfW5ZAgJ9Zs8zuStD8DABJASCSH5"
export const txShort = (h: string) => (h.length > 16 ? `${h.slice(0, 8)}…${h.slice(-5)}` : h)
export const PROPOSAL = "Proposal #6"

export type Band = { grade: string; n: number; mean: number | null }
export const BANDS: Band[] = [
  { grade: "Junior", n: 8, mean: 30713 },
  { grade: "Reporter", n: 11, mean: 43000 },
  { grade: "Senior", n: 0, mean: null },
  { grade: "Editor", n: 5, mean: 81780 },
  { grade: "Chief", n: 3, mean: 109333 },
]
export const eur = (v: number) => `€${v.toLocaleString("en-GB")}`

export const SEATS = [
  { seat: "SEAT 1", id: "bs-c1-3f36b7", votes: true },
  { seat: "SEAT 2", id: "bs-c2-3f36b7", votes: true },
  { seat: "SEAT 3", id: "bs-c3-3f36b7", votes: false },
]

/** enclave/evaluation/results.json: the naive tool does not leak in cases 6, 8, 75, 87, 96. */
export const NAIVE_SAFE = new Set([6, 8, 75, 87, 96])
/** Each case's leak order (0..94) in case order, or -1 when the naive tool did not leak. */
export const LEAK_INDEX: number[] = (() => {
  let k = 0
  return Array.from({ length: 100 }, (_, i) => (NAIVE_SAFE.has(i) ? -1 : k++))
})()

/** `pnpm verify` real stdout after release #3 (14 Nov 2026), PASS lines in order, wording as printed. */
export const VERIFY_HEAD = "Bandsheet verify  (bandsheet-3f36b7.testnet, NEAR testnet, read-only, no keys)"
export const PASS_LINES = [
  "contract code hash on testnet 5414e7db7fd9... equals scripts/deployed.json",
  "local build contracts/bandsheet/out/bandsheet.wasm hashes to the same value",
  "policy k = 3 (expected 3)",
  "policy engine WASM sha256 69d5616cacc6... equals enclave/README.md",
  "policy enclave public key equals enclave/README.md (Kn0bVgYSbpi5...)",
  "3 release records read from the contract",
  "release #1 (released): attestation 3c7m4EdT... engine hash = v0.1.0 engine it ran under, input hash = record, output hash = record",
  "release #2 (partially_released): attestation ErEry8mF... engine hash = v0.1.0 engine it ran under, input hash = record, output hash = record",
  "release #3 (partially_released): attestation CqPS4C69... engine hash = current policy, input hash = record, output hash = record",
  "release #3 required employer DKIM (1 DAO-trusted issuer): 37 entries verified, rejected dkim_bad_signature: 1",
  "seed Seniors reproduce on-chain release #1: n=9, mean EUR 62400",
  "a naive tool publishing Senior twice exposes 10 x 63160 - 9 x 62400 = EUR 70000",
  'release #2 withheld Senior on-chain: "Release #2 Senior - Release #1 Senior isolates 1 member"',
  "evaluation: typical tool leaks in 95/100 cases, Bandsheet in 0/100",
  "exact salaries recovered: 187 (typical) vs 0 (Bandsheet)",
  "saved proof release1-attestation.json names the v0.1.0 engine it ran under",
  "saved proof release2-attestation.json names the v0.1.0 engine it ran under",
  "https://bandsheet.pages.dev/api/health is up and reports bandsheet-3f36b7.testnet",
  "https://bandsheet.pages.dev/api/unit: same contract, policy hashes and 3 releases as the chain",
]
/** The line the camera lingers on (DKIM gate). */
export const PASS_FOCUS = 9

/** The app sidebar S6 hands to S7 (end pose; see HANDOFF.md). */
export const SIDEBAR_W = 360
export const NAV = [
  "Overview",
  "Submit a payslip",
  "Where do I stand",
  "Release ledger",
  "Attack lab",
  "Chapel vote",
  "How it works",
  "Help",
  "Verify it yourself",
]
export const NAV_ACTIVE = 2
export const NAV_TOP = 236
export const NAV_PITCH = 52

/** T5 shared pose (screen space): the tx header on S5's last frame equals S6's first frame. */
export const TXH = { x: 120, labelY: 150, hashY: 196, size: 62, labelSize: 22 }
