import type { Invite } from "@bandsheet/core/near"
import { ApiError, getDemoInvite } from "@/lib/api"
import { CONTRACT, view } from "@/lib/chain"

export type KeySource = "demo" | "paste" | "outsider" | "stored"
export type CheckedKey = { invite: Invite; raw: Record<string, unknown>; member: boolean; demo: boolean }

/** near-api-js loads only when a key is actually opened. */
export const nearLib = () => import("@bandsheet/core/near")

/**
 * Turn a key source into a parsed invite, then ask the contract whether its slot is a member.
 * "outsider" makes a fresh random key so the refusal can be seen live.
 */
export async function checkKey(source: KeySource, input?: string | Record<string, unknown>, demoFlag = false): Promise<CheckedKey> {
  const near = await nearLib()
  let raw: Record<string, unknown>
  if (source === "demo") raw = await getDemoInvite()
  else if (source === "outsider") {
    const k = near.generateMemberKey()
    raw = { account_id: CONTRACT, contract_id: CONTRACT, private_key: k.privateKey }
  } else if (typeof input === "object" && input) raw = input
  else {
    try {
      const parsed: unknown = JSON.parse(input ?? "")
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("not an object")
      raw = parsed as Record<string, unknown>
    } catch {
      throw new ApiError("That is not a JSON invite.", "INVITE_INVALID")
    }
  }
  let invite: Invite
  try {
    invite = near.parseInvite(raw, CONTRACT)
  } catch (e) {
    throw new ApiError(e instanceof Error ? e.message : "invite could not be read", "INVITE_INVALID")
  }
  if (invite.contractId !== CONTRACT) {
    throw new ApiError(`This invite is for ${invite.contractId}, not this chapel's contract.`, "INVITE_INVALID")
  }
  const member = await view<boolean>(invite.contractId, "is_member", { slot: invite.slot })
  return { invite, raw, member: Boolean(member), demo: source === "demo" || demoFlag }
}
