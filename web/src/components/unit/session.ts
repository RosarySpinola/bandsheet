import { useSyncExternalStore } from "react"
import { z } from "zod"

/**
 * The active member key for this tab. It lives in sessionStorage only (cleared when the tab closes):
 * a testnet function-call key that can do nothing but call `submit` on the unit contract.
 */
const KEY = "bandsheet.member.v1"
const EVENT = "bandsheet:member"

export const MemberSchema = z.object({
  /** The invite JSON as given (account_id, contract_id, private_key, …). */
  invite: z.record(z.string(), z.unknown()),
  slot: z.string().regex(/^[0-9a-f]{64}$/),
  publicKey: z.string(),
  demo: z.boolean(),
  joinedAt: z.number(),
})
export type Member = z.infer<typeof MemberSchema>

let cache: { raw: string | null; value: Member | null } = { raw: null, value: null }

function read(): Member | null {
  let raw: string | null = null
  try {
    raw = window.sessionStorage.getItem(KEY)
  } catch {
    return null
  }
  if (raw === cache.raw) return cache.value
  let value: Member | null = null
  try {
    const p = MemberSchema.safeParse(raw ? JSON.parse(raw) : null)
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

export function useMember(): Member | null {
  return useSyncExternalStore(subscribe, read, () => null)
}

export function setMember(m: Member): void {
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(MemberSchema.parse(m)))
  } catch {
    // storage blocked (private mode): the member stays signed out; the join page says so
  }
  window.dispatchEvent(new Event(EVENT))
}

export function clearMember(): void {
  try {
    window.sessionStorage.removeItem(KEY)
  } catch {
    // nothing stored
  }
  window.dispatchEvent(new Event(EVENT))
}

/** Where to send a member who has no key yet, returning them to `next` afterwards. */
export const joinHref = (next: string) => `/unit/join?next=${encodeURIComponent(next)}`
