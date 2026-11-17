import type { NavItem } from "@/components/unit/nav"

/** A judge's own unit: the demo shell's screens, scoped to /u/:unitId, plus Invite and its own attack lab. No pricing. */
export function unitNav(unitId: number): { label: string; items: NavItem[] }[] {
  const base = `/u/${unitId}`
  return [
    {
      label: "Work",
      items: [
        { to: base, title: "Overview", kind: "overview", blurb: "Your unit, its bands and what is waiting for a vote." },
        { to: `${base}/submit`, title: "Submit a payslip", kind: "submit", blurb: "Seal your own payslip to the engine." },
        { to: `${base}/stand`, title: "Where do I stand", kind: "stand", blurb: "Your pay against your unit's bands." },
      ],
    },
    {
      label: "Records",
      items: [
        { to: `${base}/releases`, title: "Release ledger", kind: "ledger", blurb: "Every release and refusal." },
        { to: `${base}/vote`, title: "Council vote", kind: "vote", blurb: "Propose a release and vote it from your wallet." },
        { to: `${base}/attack`, title: "Attack lab", kind: "attack", blurb: "Change one group by one synthetic colleague, then subtract." },
      ],
    },
    {
      label: "Unit",
      items: [
        { to: `${base}/invite`, title: "Invite and council", kind: "invite", blurb: "Invite colleagues, add seats and employer domains." },
        { to: `${base}/verify`, title: "Verify it yourself", kind: "verify", blurb: "The policy, engine hash and attestations." },
      ],
    },
  ]
}

export const unitActive = (pathname: string, to: string, unitId: number) =>
  to === `/u/${unitId}` ? pathname === to || pathname === `${to}/` : pathname.startsWith(to)
