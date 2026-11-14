import { useSyncExternalStore } from "react"
import { z } from "zod"

/**
 * Who joined in this tab with a NEAR account (NEAR Auth or a NEAR Connect wallet). Kept in sessionStorage only,
 * like the member key. It names the account so the member can bind a submission to it; the server keeps the
 * account <-> slot link off chain.
 */
const KEY = "bandsheet.identity.v1"
const EVENT = "bandsheet:identity"

export const IdentitySchema = z.object({
  account_id: z.string(),
  method: z.enum(["near-auth", "near-connect"]),
  /** The account's own signing key (not the member key). */
  public_key: z.string(),
  wallet_id: z.string().optional(),
  slot: z.string(),
})
export type Identity = z.infer<typeof IdentitySchema>

let cache: { raw: string | null; value: Identity | null } = { raw: null, value: null }

function read(): Identity | null {
  let raw: string | null = null
  try {
    raw = window.sessionStorage.getItem(KEY)
  } catch {
    return null
  }
  if (raw === cache.raw) return cache.value
  let value: Identity | null = null
  try {
    const p = IdentitySchema.safeParse(raw ? JSON.parse(raw) : null)
    value = p.success ? p.data : null
  } catch {
    value = null
  }
  cache = { raw, value }
  return value
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb)
  window.addEventListener("storage", cb)
  return () => {
    window.removeEventListener(EVENT, cb)
    window.removeEventListener("storage", cb)
  }
}

export const useIdentity = (): Identity | null => useSyncExternalStore(subscribe, read, () => null)

export function setIdentity(i: Identity | null): void {
  try {
    if (i) window.sessionStorage.setItem(KEY, JSON.stringify(IdentitySchema.parse(i)))
    else window.sessionStorage.removeItem(KEY)
  } catch {
    // storage blocked: the identity lasts for this page only
  }
  window.dispatchEvent(new Event(EVENT))
}

/** Short form for tight spaces: implicit (64-hex) ids become head…tail. */
export const shortAccount = (id: string) => (/^[0-9a-f]{64}$/.test(id) ? `${id.slice(0, 8)}…${id.slice(-6)}` : id)
