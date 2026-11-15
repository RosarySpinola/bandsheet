import { createContext, useContext, type ReactNode } from "react"
import { CONTRACT } from "@/lib/chain"
import type { ExtractResponse } from "@/lib/api"
import type { GlOption } from "../gl-select"
import { UNIT_NAME } from "../nav"
import { joinHref } from "../session"
import type { SampleKind } from "./use-submit-flow"

/**
 * What the submit steps say and link to. The demo chapel uses the defaults (so its pages are unchanged); a judge's
 * own unit (/u/:unitId/submit) provides its name, contract, links, payslip options and DKIM card.
 */
export type SubmitScope = {
  unitName: string
  /** "chapel" for the demo, "unit" for a judge's own unit. */
  noun: string
  contract: string
  switchKeyHref: string
  standHref: string
  /** Replaces the demo's Harbour Courier samples under the upload area. */
  samples?: ReactNode
  /** Replaces the demo's DKIM card (which reads the demo contract's trusted employers). */
  dkimCard?: (p: { preview?: NonNullable<ExtractResponse["dkim_preview"]> | null; email: boolean; sample: SampleKind | null }) => ReactNode
  siteOptions?: GlOption[]
  /** Shown on the receipt under "Your entry is filed." (the unit's DKIM-verified or self-attested badge). */
  doneNote?: ReactNode
  /**
   * A unit's wallet-bound send: the Send button waits until the wallet call is prepared, shows the unit's own labels,
   * and the note replaces the demo's posting-key line. The demo has none.
   */
  sendGate?: { ready: boolean; label: string; busyLabel: string; note: ReactNode; status?: ReactNode }
}

export const DEMO_SCOPE: SubmitScope = {
  unitName: UNIT_NAME,
  noun: "chapel",
  contract: CONTRACT,
  switchKeyHref: joinHref("/unit/submit"),
  standHref: "/unit/stand",
}

const Ctx = createContext<SubmitScope>(DEMO_SCOPE)

export const SubmitScopeProvider = ({ value, children }: { value: SubmitScope; children: ReactNode }) => <Ctx.Provider value={value}>{children}</Ctx.Provider>

export const useSubmitScope = () => useContext(Ctx)
