import { useCallback, useEffect, useRef, useState } from "react"
import { watchLate } from "./late"
import { ChainRefused, WalletCancelled } from "./wallet-bridge"

/**
 * One wallet action under the tap rule. `prepare` does every await (nonce, wallet code, args) as soon as `key` is set;
 * `tap()` then calls the prepared `start` synchronously inside the click, so a web wallet's tab is never blocked.
 * After any outcome it prepares again (nonces are single use), unless the key went null.
 * A transaction action can also give `late`: after a decline or a lost wallet answer it reads the chain for about a
 * minute, and if the transaction landed anyway the tap resolves with that result (phase done, `late: true`).
 */
export type Stage = "wallet" | "posting"
export type Prepared<R> = { start: (mark: (s: Stage) => void) => Promise<R>; late?: () => Promise<R | null> }

export type TapPhase<R> =
  | { s: "idle" }
  | { s: "preparing" }
  | { s: "ready" }
  | { s: "busy"; stage: Stage }
  | { s: "done"; result: R; late?: boolean }
  /** `checking`: reading the chain for a late approval; `checked`: read for a minute and nothing landed. */
  | { s: "rejected"; checking?: boolean; checked?: boolean }
  | { s: "error"; error: unknown; checking?: boolean; checked?: boolean }
  | { s: "unprepared"; error: unknown }

export function useTap<R>(key: string | null, prepare: () => Promise<Prepared<R>>) {
  const [phase, setPhase] = useState<TapPhase<R>>({ s: "idle" })
  const ready = useRef<Prepared<R> | null>(null)
  const latest = useRef(prepare)
  // Runs before the prepare effect below (effects run in order), so it always prepares with the latest inputs.
  useEffect(() => {
    latest.current = prepare
  })
  const [round, setRound] = useState(0)
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])
  const [armed, setArmed] = useState(false)

  useEffect(() => {
    ready.current = null
    setArmed(false)
    if (key === null) return setPhase((p) => (p.s === "done" ? p : { s: "idle" }))
    let live = true
    setPhase((p) => (p.s === "done" || p.s === "rejected" || p.s === "error" ? p : { s: "preparing" }))
    latest.current().then(
      (p) => {
        if (!live) return
        ready.current = p
        setArmed(true)
        setPhase((ph) => (ph.s === "done" || ph.s === "rejected" || ph.s === "error" ? ph : { s: "ready" }))
      },
      (error) => live && setPhase({ s: "unprepared", error }),
    )
    return () => {
      live = false
    }
  }, [key, round])

  const tap = useCallback((): Promise<R> | null => {
    const p = ready.current
    if (!p) return null
    ready.current = null
    setArmed(false)
    // Synchronous: the wallet call inside start() begins before this handler returns.
    const run = p.start((stage) => setPhase({ s: "busy", stage }))
    setPhase({ s: "busy", stage: "wallet" })
    const settled = run.then(
      (result) => {
        setPhase({ s: "done", result })
        return result
      },
      async (error: unknown) => {
        const failed: TapPhase<R> = error instanceof WalletCancelled ? { s: "rejected" } : { s: "error", error }
        // A contract refusal is final; anything else may still have landed (approved after the page stopped waiting).
        if (!p.late || error instanceof ChainRefused) {
          setPhase(failed)
          throw error
        }
        setPhase({ ...failed, checking: true })
        const late = await watchLate(p.late, () => mounted.current)
        if (late === null) {
          setPhase({ ...failed, checked: true })
          throw error
        }
        setPhase({ s: "done", result: late, late: true })
        return late
      },
    )
    settled.finally(() => setRound((r) => r + 1)).catch(() => undefined)
    return settled
  }, [])

  /** Back to ready (after an error or a finished action the person wants to repeat). */
  const reset = useCallback(() => setPhase(ready.current ? { s: "ready" } : { s: "preparing" }), [])
  const retryPrepare = useCallback(() => setRound((r) => r + 1), [])

  return { phase, tap, reset, retryPrepare, canTap: armed && phase.s !== "busy" }
}
