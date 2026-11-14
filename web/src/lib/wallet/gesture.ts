/**
 * Web wallets (Meteor Web, MyNearWallet) open their signing tab with window.open, which browsers allow only shortly
 * after a user tap. Bandsheet therefore prepares everything first (nonce, sealing, the posting key's transaction) and
 * starts the wallet call inside the tap itself, with no network wait in between.
 *
 * QA hook: each wallet sign call records whether it started inside the click's task in window.__bsSignTrace.
 */
let inClickTask = false

if (typeof document !== "undefined") {
  document.addEventListener(
    "click",
    () => {
      inClickTask = true
      setTimeout(() => {
        inClickTask = false
      }, 0)
    },
    true,
  )
}

type Trace = { kind: string; inClickTask: boolean; at: number }

export function traceSignCall(kind: string): void {
  const w = window as unknown as { __bsSignTrace?: Trace[] }
  w.__bsSignTrace = [...(w.__bsSignTrace ?? []).slice(-9), { kind, inClickTask, at: Math.round(performance.now()) }]
}
