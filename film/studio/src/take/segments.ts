/**
 * The one source of truth for the v4 take (film 597–3621): which take moment is on screen at each film frame.
 * Re-timing the film is an edit here only. `checkTake()` runs at import, so a broken mapping refuses to render.
 *
 * Take time is milliseconds on one global clock (the screencast's epoch-ms frame names). Each film frame shows the
 * tab's latest screencast JPEG at or before its take time (Frame.tsx), linked into public/take/<role>/ by
 * scripts/take-link.cjs; `t0` is the tab's first frame.
 */
import take from "./take.json"

export const SOURCE: "placeholder" | "take" = "take"

export type Tab = { id: string; src: string; frames: number[]; t0: number; dur: number; url: string; kind: "app" | "meteor" | "nearblocks" }
export type Seg = { from: number; to: number; tab: string; ms: [number, number]; url?: string }
export type InsertKind = "receipt" | "forgery" | "chain" | "grids" | "terminal" | "mcp" | "close"
export type Insert = { kind: InsertKind; from: number; to: number }
export type Label = { text: string; from: number; to: number; tone?: "wallet" | "landed" }
/** A moment that must be readable: covered at ≤ 1× (or a freeze), never under an insert, for ≥ 1.5 s. */
export type Moment = { what: string; from: number; to: number }

export const TAKE_FROM = 597
export const TAKE_TO = 3621

/* ---------- tabs: roles by kind and open order (take.json, from scripts/take-marks.mjs) ---------- */
type RawTab = { id: string; kind: Tab["kind"]; t0: number; dur: number; first_url: string; last_url: string; frames: number[] }
const raw = (take.tabs as RawTab[]).slice().sort((x, y) => x.t0 - y.t0)
const ofKind = (k: Tab["kind"]) => raw.filter((t) => t.kind === k)
const APP_HOST = "localhost:4280"
const ROLE = {
  app: ofKind("app")[0],
  meteorJoin: ofKind("meteor")[0],
  meteorEntry: ofKind("meteor")[1],
  meteorVote: ofKind("meteor")[2],
  nbEntry: ofKind("nearblocks")[0],
  nbVote: ofKind("nearblocks")[1],
}
type Role = keyof typeof ROLE
const shortUrl = (u: string) => u.replace(/^https?:\/\//, "").replace(/\?.*$/, "")
export const TABS: Tab[] = (Object.keys(ROLE) as Role[]).map((r) => {
  const t = ROLE[r]
  if (!t) throw new Error(`take: no tab for role ${r}`)
  return { id: r, src: t.id, frames: t.frames, t0: t.t0, dur: t.dur, kind: t.kind, url: t.kind === "app" ? APP_HOST : shortUrl(t.last_url) }
})
const txOf = (r: Role) => ROLE[r].last_url.match(/txns\/([A-Za-z0-9]+)/)?.[1] ?? ""
const short = (h: string) => `${h.slice(0, 6)}…${h.slice(-4)}`
export const TX = { entry: txOf("nbEntry"), vote: txOf("nbVote") }

/* ---------- the cut: [take mark, seconds after it] → film frames ---------- */
const M = take.marks as Record<string, number>
const at = (mark: string, off = 0) => {
  if (!(mark in M)) throw new Error(`take: no mark "${mark}"`)
  return M[mark] + off * 1000
}
type Pt = [string, number]
type Spec = { to: number; tab: Role; a: Pt; b?: Pt; path?: string }
const SPEC: Spec[] = [
  // 597–692 "Band-sheet is built to stop exactly that." landing → Join → Meteor sign-in → member card
  { to: 625, tab: "app", a: ["landing start app", 0.3], path: "/" },
  { to: 640, tab: "app", a: ["landing start app", 0.3], b: ["landing click Join your chapel", 0.1], path: "/" },
  { to: 652, tab: "app", a: ["join page shown", 0], b: ["join connect clicked", 0.5], path: "/unit/join" },
  { to: 662, tab: "meteorJoin", a: ["meteor connect request shown", 0], b: ["meteor connect request shown", 1.9] },
  { to: 728, tab: "meteorJoin", a: ["meteor approve-click sign join message", -2.2], b: ["meteor approve-click sign join message", 0] },
  { to: 776, tab: "app", a: ["join member card shown", -0.2], b: ["join member card shown", 1.4], path: "/unit/join" },
  // 692–908 submit: sample email → reading → Verified 28/28
  { to: 788, tab: "app", a: ["submit enter chapel", -0.5], b: ["submit enter chapel", 1.5], path: "/unit/join" },
  { to: 800, tab: "app", a: ["submit page", -1.4], b: ["submit page", 0.6], path: "/unit/submit" },
  { to: 836, tab: "app", a: ["submit page", 1.1], b: ["submit sample email clicked", 0.4], path: "/unit/submit" },
  { to: 850, tab: "app", a: ["submit sample email clicked", 0.4], b: ["submit sample email clicked", 3.1], path: "/unit/submit" },
  { to: 880, tab: "app", a: ["submit verified panel", -4], b: ["submit verified panel", 0], path: "/unit/submit" },
  { to: 906, tab: "app", a: ["submit verified panel", 0], b: ["submit verified panel", 0.85], path: "/unit/submit" },
  { to: 1199, tab: "app", a: ["submit verified panel", 0.85], path: "/unit/submit" }, // receipt insert
  // 1217–1599 seal → sign with wallet → Meteor → filed + tx → nearblocks
  { to: 1225, tab: "app", a: ["submit seal clicked", -4.5], b: ["submit seal clicked", 0.2], path: "/unit/submit" },
  { to: 1260, tab: "app", a: ["submit seal clicked", 0.2], b: ["submit sealed envelope shown", 0.7], path: "/unit/submit" },
  { to: 1300, tab: "app", a: ["submit sealed envelope shown", 0.7], b: ["submit sealed envelope shown", 2.0], path: "/unit/submit" },
  { to: 1320, tab: "app", a: ["submit sign-with-wallet clicked", -3.6], b: ["submit sign-with-wallet clicked", 0.2], path: "/unit/submit" },
  { to: 1386, tab: "meteorEntry", a: ["meteor approve-click sign entry", -2.2], b: ["meteor approve-click sign entry", 0] },
  { to: 1400, tab: "app", a: ["submit entry filed shown", -2.5], b: ["submit entry filed shown", 0.2], path: "/unit/submit" },
  { to: 1460, tab: "app", a: ["submit entry filed shown", 0.2], b: ["submit entry filed shown", 2.2], path: "/unit/submit" },
  { to: 1545, tab: "nbEntry", a: ["nearblocks entry success shown", 0.1] },
  // 1599–2067 releases: Release #3 refused a forged payslip (dkim_bad_signature)
  { to: 1575, tab: "app", a: ["releases open", -3], b: ["releases open", 0.5], path: "/unit/submit" },
  { to: 1760, tab: "app", a: ["releases open", 0.5], b: ["releases refusal dkim_bad_signature shown", 0], path: "/unit/releases" },
  { to: 1938, tab: "app", a: ["releases refusal dkim_bad_signature shown", 0], b: ["releases refusal dkim_bad_signature shown", 5.9], path: "/unit/releases" },
  { to: 2034, tab: "app", a: ["releases refusal dkim_bad_signature shown", 5.9], path: "/unit/releases" }, // forgery insert
  { to: 2080, tab: "app", a: ["releases refusal dkim_bad_signature shown", 5.9], b: ["releases refusal dkim_bad_signature shown", 7.4], path: "/unit/releases" },
  // 2075–2432 vote: seat panel → Approve → Meteor act_proposal → tx → nearblocks
  { to: 2100, tab: "app", a: ["vote open", -0.2], b: ["vote open", 3.7], path: "/unit/vote" },
  { to: 2135, tab: "app", a: ["vote approve clicked", -6.8], b: ["vote approve clicked", 0.1], path: "/unit/vote" },
  { to: 2201, tab: "meteorVote", a: ["meteor approve-click vote tx", -2.2], b: ["meteor approve-click vote tx", 0] },
  { to: 2222, tab: "app", a: ["vote tx shown in panel", -3.4], b: ["vote tx shown in panel", 0.5], path: "/unit/vote" },
  { to: 2302, tab: "app", a: ["vote tx shown in panel", 0.5], path: "/unit/vote" }, // chain insert
  { to: 2350, tab: "app", a: ["vote tx shown in panel", 0.5], b: ["vote tx shown in panel", 2.1], path: "/unit/vote" },
  { to: 2370, tab: "nbVote", a: ["nearblocks vote success shown", -3.6], b: ["nearblocks vote success shown", 0] },
  { to: 2420, tab: "nbVote", a: ["nearblocks vote success shown", 0], b: ["nearblocks vote success shown", 1.6] },
  // 2432–2643 releases: four bands, Senior withheld, the witness line
  { to: 2672, tab: "app", a: ["releases bands and witness shown", 0], b: ["releases bands and witness shown", 8.4], path: "/unit/releases" },
  { to: 2951, tab: "app", a: ["releases bands and witness shown", 8.4], path: "/unit/releases" }, // grids insert
  // 2955–3104 verify page
  { to: 2985, tab: "app", a: ["verify scrolling", -5.6], b: ["verify scrolling", 0], path: "/unit/verify" },
  { to: 3100, tab: "app", a: ["verify scrolling", 0], b: ["verify scroll end", 0], path: "/unit/verify" },
  // 3104–3173 attack lab: Subtract → €70,000 vs withheld
  { to: 3125, tab: "app", a: ["attack open", 1.3], b: ["attack subtract clicked", 0.3], path: "/unit/attack" },
  { to: 3140, tab: "app", a: ["attack subtract clicked", 0.3], b: ["attack subtract clicked", 3.2], path: "/unit/attack" },
  { to: 3150, tab: "app", a: ["attack 70000 vs withheld shown", -1.9], b: ["attack 70000 vs withheld shown", 0], path: "/unit/attack" },
  { to: 3200, tab: "app", a: ["attack 70000 vs withheld shown", 0], b: ["attack 70000 vs withheld shown", 1.66], path: "/unit/attack" },
  { to: 3405, tab: "app", a: ["attack 70000 vs withheld shown", 1.66], path: "/unit/attack" }, // MCP insert
  // 3411–3621 stand: position, Malta median, Article 7 letter
  { to: 3430, tab: "app", a: ["stand answer shown", -4.4], b: ["stand answer shown", 0], path: "/unit/stand" },
  { to: 3460, tab: "app", a: ["stand answer shown", 0], b: ["stand answer shown", 1.0], path: "/unit/stand" },
  { to: 3490, tab: "app", a: ["stand malta median", -5.4], b: ["stand malta median", 0], path: "/unit/stand" },
  { to: 3525, tab: "app", a: ["stand malta median", 0], b: ["stand malta median", 1.17], path: "/unit/stand" },
  { to: 3545, tab: "app", a: ["stand malta median", 1.17], b: ["stand article 7 letter", 0.3], path: "/unit/stand" },
  { to: 3566, tab: "app", a: ["stand article 7 letter", 0.3], b: ["stand article 7 letter", 1.0], path: "/unit/stand" },
  { to: 3621, tab: "app", a: ["stand article 7 letter", 1.0], path: "/unit/stand" }, // close insert → S8
]
export const SEGS: Seg[] = SPEC.map((s, i) => ({
  from: i === 0 ? TAKE_FROM : SPEC[i - 1].to,
  to: s.to,
  tab: s.tab,
  ms: [at(...s.a), at(...(s.b ?? s.a))],
  url: s.path ? APP_HOST + s.path : undefined,
}))

export const INSERTS: Insert[] = [
  { kind: "receipt", from: 906, to: 1190 },
  { kind: "forgery", from: 1938, to: 2026 },
  { kind: "chain", from: 2222, to: 2294 },
  { kind: "grids", from: 2672, to: 2942 },
  { kind: "mcp", from: 3200, to: 3396 },
  { kind: "close", from: 3566, to: 3621 },
]

export const LABELS: Label[] = [
  { text: "Meteor wallet · approve sign-in", from: 652, to: 728, tone: "wallet" },
  { text: "Meteor wallet · sign this entry", from: 1320, to: 1386, tone: "wallet" },
  { text: `Landed on NEAR testnet · ${short(TX.entry)}`, from: 1400, to: 1545, tone: "landed" },
  { text: "Meteor wallet · approve vote", from: 2135, to: 2201, tone: "wallet" },
  { text: `Landed on NEAR testnet · ${short(TX.vote)}`, from: 2302, to: 2420, tone: "landed" },
]

export const MOMENTS: Moment[] = [
  { what: "Meteor approve sign-in", from: 662, to: 728 },
  { what: "Meteor sign entry", from: 1320, to: 1386 },
  { what: "entry tx hash", from: 1400, to: 1460 },
  { what: "nearblocks entry success", from: 1460, to: 1545 },
  { what: "Release #3 refusal line", from: 1760, to: 1938 },
  { what: "Meteor approve vote", from: 2135, to: 2201 },
  { what: "vote tx hash", from: 2302, to: 2350 },
  { what: "nearblocks vote success", from: 2370, to: 2420 },
  { what: "€70,000 vs withheld", from: 3150, to: 3200 },
]

const MAX_RATE = 6
const MIN_READ = 45
const FPS = 30

export const tabById = (id: string) => {
  const t = TABS.find((x) => x.id === id)
  if (!t) throw new Error(`take: unknown tab ${id}`)
  return t
}

/** Take time (ms) on screen at film frame `f` (absolute). Linear within a segment; holds freeze. */
export function takeAt(f: number): { tab: Tab; ms: number; seg: Seg } {
  const seg = SEGS.find((s) => f >= s.from && f < s.to) ?? (f < TAKE_FROM ? SEGS[0] : SEGS[SEGS.length - 1])
  const t = Math.min(1, Math.max(0, (f - seg.from) / (seg.to - seg.from)))
  return { tab: tabById(seg.tab), ms: seg.ms[0] + (seg.ms[1] - seg.ms[0]) * t, seg }
}
export const rateOf = (s: Seg) => (s.ms[1] - s.ms[0]) / (((s.to - s.from) / FPS) * 1000)

/** Refuses a mapping that breaks the brief's rules. */
export function checkTake() {
  const err: string[] = []
  if (SEGS[0].from !== TAKE_FROM || SEGS[SEGS.length - 1].to !== TAKE_TO) err.push("segments must cover 597–3621")
  SEGS.forEach((s, i) => {
    const tab = TABS.find((x) => x.id === s.tab)
    if (!tab) err.push(`seg ${i}: unknown tab ${s.tab}`)
    if (s.to <= s.from) err.push(`seg ${i}: empty`)
    if (s.ms[1] < s.ms[0]) err.push(`seg ${i}: runs backwards`)
    if (rateOf(s) > MAX_RATE + 1e-6) err.push(`seg ${i}: ${rateOf(s).toFixed(2)}× exceeds ${MAX_RATE}×`)
    if (tab && (s.ms[0] < tab.t0 || s.ms[1] > tab.t0 + tab.dur + 1)) err.push(`seg ${i}: outside tab ${tab.id}`)
    const prev = SEGS[i - 1]
    if (prev && prev.to !== s.from) err.push(`seg ${i}: gap/overlap at ${s.from}`)
    if (prev && s.ms[0] < prev.ms[1]) err.push(`seg ${i}: take time goes backwards at ${s.from}`)
  })
  INSERTS.forEach((n) => {
    // the take frame under an insert is frozen, so the cut back lands on exactly the frame it left
    const a = takeAt(n.from)
    const b = takeAt(Math.min(n.to + 6, TAKE_TO - 1)) // and it stays on that frame a beat after the reveal
    if (a.tab.id !== b.tab.id || Math.abs(a.ms - b.ms) > 0.5) err.push(`insert ${n.kind}: take not frozen across ${n.from}–${n.to}`)
  })
  MOMENTS.forEach((m) => {
    if (m.to - m.from < MIN_READ) err.push(`moment "${m.what}": shorter than 1.5 s`)
    for (let f = m.from; f < m.to; f++) {
      if (rateOf(takeAt(f).seg) > 1.0001) {
        err.push(`moment "${m.what}": not at 1× at frame ${f}`)
        break
      }
      if (INSERTS.some((n) => f >= n.from && f < n.to)) {
        err.push(`moment "${m.what}": covered by an insert at ${f}`)
        break
      }
    }
  })
  if (err.length) throw new Error(`take mapping refused:\n${err.join("\n")}`)
}
checkTake()
