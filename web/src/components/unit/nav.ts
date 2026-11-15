import { SCREENS, type ScreenLink } from "@/components/gl/screens"

export type NavItem = Omit<ScreenLink, "kind"> & { kind: ScreenLink["kind"] | "overview" | "how" | "help" | "pricing" }

const screen = (to: string): NavItem => {
  const s = SCREENS.find((x) => x.to === to)
  if (!s) throw new Error(`unknown screen ${to}`)
  return s
}

export const OVERVIEW: NavItem = { to: "/unit", title: "Overview", kind: "overview", blurb: "The unit, its latest bands and what is waiting for a vote." }
export const HOW: NavItem = { to: "/unit/how", title: "How it works", kind: "how", blurb: "The three layers: a reader, a sealed engine and a public record." }
export const HELP: NavItem = { to: "/unit/help", title: "Help", kind: "help", blurb: "What is stored, what a refusal means, and who can ask for a release." }

/** Plans, inside the app shell (the public site has the same content at /pricing). */
export const PRICING: NavItem = { to: "/unit/pricing", title: "Pricing", kind: "pricing", blurb: "Free for one chapel; federations pay per member." }

/** Sidebar groups: Work, Records, Learn. */
export const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  { label: "Work", items: [OVERVIEW, screen("/unit/submit"), screen("/unit/stand")] },
  { label: "Records", items: [screen("/unit/releases"), screen("/unit/attack"), screen("/unit/vote")] },
  { label: "Learn", items: [HOW, HELP, screen("/unit/verify"), PRICING] },
]

export const NAV: NavItem[] = NAV_GROUPS.flatMap((g) => g.items)

export const UNIT_NAME = "Harbour Courier chapel"
