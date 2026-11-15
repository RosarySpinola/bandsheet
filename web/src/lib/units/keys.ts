import { useSyncExternalStore } from "react"
import { z } from "zod"
import type { Member } from "@/components/unit/session"
import type { EntryKind } from "./types"

/**
 * A member's posting key for one unit: a function-call key on the units account that can only call `submit`.
 * Kept in this browser's localStorage per unit (testnet, no funds), so a judge can come back to their unit.
 * Also remembers how their last entry was attested, for the badge.
 */
const KEY = (unitId: number) => `bandsheet.units.key.v1.${unitId}`
const EVENT = "bandsheet:unit-key"

export const UnitKeySchema = z.object({
  unitId: z.number(),
  accountId: z.string(),
  contractId: z.string(),
  privateKey: z.string().startsWith("ed25519:"),
  publicKey: z.string(),
  slot: z.string(),
  joinedAt: z.number(),
  last: z.object({ kind: z.enum(["dkim", "self", "synthetic"]), at: z.number(), tx: z.string().nullable() }).nullable().default(null),
})
export type UnitKey = z.infer<typeof UnitKeySchema>

const cache = new Map<number, { raw: string | null; value: UnitKey | null }>()

export function readUnitKey(unitId: number): UnitKey | null {
  let raw: string | null = null
  try {
    raw = window.localStorage.getItem(KEY(unitId))
  } catch {
    return null
  }
  const c = cache.get(unitId)
  if (c && c.raw === raw) return c.value
  let value: UnitKey | null = null
  try {
    const p = UnitKeySchema.safeParse(raw ? JSON.parse(raw) : null)
    value = p.success ? p.data : null
  } catch {
    value = null
  }
  cache.set(unitId, { raw, value })
  return value
}

export function writeUnitKey(k: UnitKey | null, unitId = k?.unitId ?? -1): void {
  try {
    if (k) window.localStorage.setItem(KEY(unitId), JSON.stringify(UnitKeySchema.parse(k)))
    else window.localStorage.removeItem(KEY(unitId))
  } catch {
    // storage blocked: the key lasts for this page only
  }
  window.dispatchEvent(new Event(EVENT))
}

export function recordEntry(unitId: number, kind: EntryKind, tx: string | null): void {
  const k = readUnitKey(unitId)
  if (k) writeUnitKey({ ...k, last: { kind, at: Date.now(), tx } })
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb)
  window.addEventListener("storage", cb)
  return () => {
    window.removeEventListener(EVENT, cb)
    window.removeEventListener("storage", cb)
  }
}

export const useUnitKey = (unitId: number): UnitKey | null => useSyncExternalStore(subscribe, () => readUnitKey(unitId), () => null)

/** The demo submit flow's Member shape, built from a unit key, so the same flow code seals and sends. */
export function memberOf(k: UnitKey): Member {
  return {
    invite: { account_id: k.contractId, contract_id: k.contractId, private_key: k.privateKey },
    slot: k.slot,
    publicKey: k.publicKey,
    demo: false,
    joinedAt: k.joinedAt,
  }
}
