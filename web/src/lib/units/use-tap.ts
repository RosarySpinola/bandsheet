import { useCallback, useEffect, useRef, useState } from "react"
import { WalletCancelled } from "./wallet-bridge"

/**
 * One wallet action under the tap rule. `prepare` does every await (nonce, wallet code, args) as soon as `key` is set;
 * `tap()` then calls the prepared `start` synchronously inside the click, so a web wallet's tab is never blocked.
 * After any outcome it prepares again (nonces are single use), unless the key went null.
 */
export type Stage = "wallet" | "posting"
export type Prepared<R> = { start: (mark: (s: Stage) => void) => Promise<R> }

export type TapPhase<R> =
  | { s: "idle" }
  | { s: "preparing" }
  | { s: "ready" }
  | { s: "busy"; stage: Stage }
  | { s: "done"; result: R }
  | { s: "rejected" }
  | { s: "error"; error: unknown }
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
    run.then(
      (result) => setPhase({ s: "done", result }),
      (error) => setPhase(error instanceof WalletCancelled ? { s: "rejected" } : { s: "error", error }),
    )
    run.finally(() => setRound((r) => r + 1)).catch(() => undefined)
    return run
  }, [])

  /** Back to ready (after an error or a finished action the person wants to repeat). */
  const reset = useCallback(() => setPhase(ready.current ? { s: "ready" } : { s: "preparing" }), [])
  const retryPrepare = useCallback(() => setRound((r) => r + 1), [])

  return { phase, tap, reset, retryPrepare, canTap: armed && phase.s !== "busy" }
}
