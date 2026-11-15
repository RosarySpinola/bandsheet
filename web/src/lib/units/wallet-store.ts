import { useSyncExternalStore } from "react"
import { WalletCancelled } from "./wallet-bridge"
import { unitsWallet } from "./index"
import type { Conn } from "./types"

/** One connected wallet for every units page and the sidebar. NEAR Connect remembers it across reloads. */
export type WalletState =
  | { status: "restoring" | "idle"; conn: null; note?: "cancelled" }
  | { status: "connecting"; conn: null }
  | { status: "connected"; conn: Conn }
  | { status: "error"; conn: null; error: unknown }

let state: WalletState = { status: "restoring", conn: null }
const listeners = new Set<() => void>()
const set = (s: WalletState) => {
  state = s
  listeners.forEach((l) => l())
}

let restoring: Promise<void> | null = null
function restoreOnce() {
  restoring ??= unitsWallet
    .restore()
    .then((c) => set(c ? { status: "connected", conn: c } : { status: "idle", conn: null }))
    .catch(() => set({ status: "idle", conn: null }))
}

function subscribe(cb: () => void) {
  listeners.add(cb)
  restoreOnce()
  return () => listeners.delete(cb)
}

export const useWallet = (): WalletState => useSyncExternalStore(subscribe, () => state, () => state)

export function connectWallet(): void {
  if (state.status === "connecting") return
  set({ status: "connecting", conn: null })
  unitsWallet.connect().then(
    (c) => set({ status: "connected", conn: c }),
    (error) => set(error instanceof WalletCancelled ? { status: "idle", conn: null, note: "cancelled" } : { status: "error", conn: null, error }),
  )
}

export function disconnectWallet(): void {
  void unitsWallet.disconnect()
  set({ status: "idle", conn: null })
}
