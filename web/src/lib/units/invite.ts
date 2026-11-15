import { inviteHashOf, newUnitInvite } from "@bandsheet/core"

/**
 * Invites (contracts/units/INTERFACE.md). The link carries a random secret S; invite_code = sha256(S) and the
 * contract stores sha256(invite_code), so nothing on chain can be replayed through the server. S is shown once: it
 * lives in this module's memory for the tab (so the creator can copy it from the invite page), and is gone on reload.
 */

export type NewInvite = { secret: string; hash: string }

export function makeInvite(): NewInvite {
  const { secret, hash } = newUnitInvite()
  return { secret, hash }
}

export { inviteHashOf }

export async function sha256Hex(text: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text))
  return Array.from(new Uint8Array(d), (b) => b.toString(16).padStart(2, "0")).join("")
}

export const inviteLink = (unitId: number, secret: string, origin = window.location.origin) => `${origin}/join/${unitId}?code=${encodeURIComponent(secret)}`

const shown = new Map<number, string>()

export const rememberInvite = (unitId: number, secret: string) => void shown.set(unitId, secret)
export const shownInvite = (unitId: number): string | null => shown.get(unitId) ?? null

/** Secrets as pasted: base64url, case-sensitive; spaces and a pasted full link are tolerated. */
export function normaliseCode(s: string): string {
  const t = s.trim()
  const fromLink = /[?&]code=([^&\s]+)/.exec(t)?.[1]
  return decodeURIComponent(fromLink ?? t).replace(/\s+/g, "")
}
export const looksLikeCode = (s: string) => /^[A-Za-z0-9_-]{16,64}$/.test(normaliseCode(s))
export const CODE_EXAMPLE = "q3VfX0n4-2kHcR8wTb1yLw"
