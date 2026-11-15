import { useCallback, useEffect, useMemo, useRef } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { ApiError } from "@/lib/api"
import { units, type Conn, type EntryKind, type EntryReceipt, type Unit } from "@/lib/units"
import { prepareEntry } from "@/lib/units/actions"
import { recordEntry } from "@/lib/units/keys"
import { useTap } from "@/lib/units/use-tap"
import { WalletCancelled } from "@/lib/units/wallet-bridge"
import type { SubmitFlow, SubmitTarget } from "@/components/unit/submit/use-submit-flow"
import { TxState } from "./tx-state"

/**
 * The unit's side of the shared submit flow. check() asks unit_of_slot whether the stored key is in this unit;
 * send() starts the prepared wallet call synchronously in the tap (POST /api/units/:id/entry after the signature).
 */
export function useUnitTarget(unit: Unit) {
  const qc = useQueryClient()
  const sendRef = useRef<(() => Promise<EntryReceipt> | null) | null>(null)
  const kindRef = useRef<EntryKind>("self")
  const accountRef = useRef<string | null>(null)
  const target = useMemo<SubmitTarget>(
    () => ({
      check: async (m) => {
        const near = await import("@bandsheet/core/near")
        let invite
        try {
          invite = near.parseInvite(m.invite, units.contract)
        } catch (e) {
          throw new ApiError(e instanceof Error ? e.message : "The stored key could not be read.", "INVITE_INVALID")
        }
        const at = await units.unitOfSlot(invite.slot)
        return { invite, member: at?.unitId === unit.id, demo: false }
      },
      send: async () => {
        const run = sendRef.current?.()
        if (!run) throw new ApiError("Your entry is still being made ready for your wallet. Try again in a moment.", "NOT_READY")
        try {
          const r = await run
          recordEntry(unit.id, kindRef.current, r.tx)
          void qc.invalidateQueries({ queryKey: ["units"] })
          return { ...r, account: accountRef.current ?? undefined }
        } catch (e) {
          if (e instanceof WalletCancelled) throw new ApiError("Your wallet did not sign, so nothing was posted.", "WALLET_REFUSED")
          throw e
        }
      },
    }),
    [unit.id, qc],
  )
  return { target, sendRef, kindRef, accountRef }
}

/** Prepares the wallet-bound entry as soon as the entry is sealed, and gives the Send step its gate. */
export function useUnitEntry(conn: Conn, unit: Unit, flow: SubmitFlow, kind: EntryKind, refs: ReturnType<typeof useUnitTarget>) {
  const inv = flow.invite.status === "done" ? flow.invite.data?.invite : undefined
  const sealed = flow.sealed
  const f = flow.fields
  const key = sealed && inv && f.grade && f.gender && f.site ? `${conn.accountId}:${sealed.ct.slice(-40)}:${kind}` : null
  const t = useTap<EntryReceipt>(key, () =>
    prepareEntry(conn, inv!, sealed!, { unitId: unit.id, kind, entry: { gross_annual_eur: Number(f.gross_annual_eur), grade: f.grade!, gender: f.gender!, site: f.site! } }),
  )
  const { tap } = t
  const send = useCallback(() => tap(), [tap])
  useEffect(() => {
    refs.sendRef.current = send
    refs.kindRef.current = kind
    refs.accountRef.current = conn.accountId
  }, [send, kind, refs, conn.accountId])

  const busy = t.phase.s === "busy"
  return {
    ready: t.canTap,
    label: t.canTap ? "Sign with your wallet and post" : t.phase.s === "unprepared" ? "Your wallet is not ready" : "Making your entry ready…",
    busyLabel: busy && t.phase.s === "busy" && t.phase.stage === "posting" ? "Posting…" : "Approve in your wallet…",
    status:
      t.phase.s === "busy" || t.phase.s === "preparing" || t.phase.s === "unprepared" ? (
        <TxState phase={t.phase} onRetryPrepare={t.retryPrepare} words={{ what: `the message "Bandsheet unit ${unit.id} entry: <hash>"`, busy: "Sign your entry in your wallet…", posting: "Signed. The registrar is posting your sealed entry…" }} />
      ) : null,
    note: (
      <p className="border-l-2 border-ink bg-band px-5 py-4 text-[0.9375rem] leading-relaxed text-foreground">
        Your wallet signs a message naming the sha256 of this sealed entry (free, no gas). Only then does Bandsheet post your posting key's <code className="font-mono">submit</code> to {units.contract}. Your wallet's account is never written next to your entry on chain; if you decline, nothing is posted.
      </p>
    ),
  }
}
