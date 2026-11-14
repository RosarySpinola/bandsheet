import { ApiError } from "@/lib/api"
import { gradeRank } from "@/lib/format"

/** Bandsheet-specific wording for releases, queries and DAO errors. Generic formatters live in lib/format. */

const GENDER_WORD: Record<string, string> = { F: "Women", M: "Men", X: "Non-binary" }

export function valueLabel(field: string, value: string): string {
  if (field === "gender") return GENDER_WORD[value] ?? value
  if (field === "site") return `${value} site`
  return value
}

/** "Senior" or "Senior · Women" for a cell key. */
export function keyLabel(key: Record<string, string>): string {
  return Object.entries(key).map(([f, v]) => valueLabel(f, v)).join(" · ") || "All members"
}

/** Grade ladder first, then label. */
export function keySort(a: Record<string, string>, b: Record<string, string>): number {
  return gradeRank(a.grade) - gradeRank(b.grade) || keyLabel(a).localeCompare(keyLabel(b))
}

export type QueryLike = { group_by?: string[]; filter?: Record<string, string> | null } | null | undefined

export function asQuery(q: unknown): QueryLike {
  return q && typeof q === "object" ? (q as QueryLike) : null
}

/** "Mean pay by grade and gender, Port site only" */
export function describeQuery(q: QueryLike): string {
  if (!q || !Array.isArray(q.group_by) || q.group_by.length === 0) return "Pay-band request"
  const by = q.group_by
  const list = by.length > 1 ? `${by.slice(0, -1).join(", ")} and ${by.at(-1)}` : by[0]
  const filt = Object.entries(q.filter ?? {})
  const tail = filt.length ? `, ${filt.map(([f, v]) => valueLabel(f, v)).join(", ")} only` : ""
  return `Mean pay by ${list}${tail}`
}

export const fieldHeading = (fields: string[] | undefined) =>
  (fields?.length ? fields : ["group"]).map((f) => f.charAt(0).toUpperCase() + f.slice(1)).join(" · ")

export type ReleaseStatus = "released" | "partially_released" | "refused" | "error"
export const REASON_LABEL: Record<string, string> = {
  small_cell: "Small cell",
  differencing: "Differencing",
}

/** Plain words for the DAO routes' error codes. Returned as an ApiError so ErrorState can show it. */
const DAO_WORDS: Record<string, string> = {
  LOW_GAS_BALANCE: "The council account is low on testnet NEAR for gas, so nothing was sent. Top it up from the testnet faucet, then try again.",
  RATE_LIMITED: "NEAR testnet is rate-limiting requests right now. Wait about thirty seconds and try again.",
  PROPOSAL_CLOSED: "This proposal has already closed, so it no longer takes votes.",
  ALREADY_VOTED: "That council seat has already voted on this proposal.",
  COUNCIL_KEY_MISSING: "This server does not hold that council seat's key, so it cannot vote for it.",
  PROPOSAL_NOT_FOUND: "That proposal does not exist on the DAO.",
  NOT_A_RELEASE_PROPOSAL: "That proposal is not a release request for this chapel.",
  BAD_REQUEST: "The request was not valid. Pick at least one field to group by.",
}

export function daoError(err: unknown): unknown {
  if (!(err instanceof ApiError)) return err
  if (err.status === 429) return new ApiError(DAO_WORDS.RATE_LIMITED!, "RATE_LIMITED", 429)
  if (err.code === "CHAIN_REJECTED") {
    const why = err.message.replace(/^the chain refused:?\s*/i, "")
    return new ApiError(`The chain refused the transaction${why ? `: ${why}` : "."}`, "CHAIN_REJECTED", err.status)
  }
  const words = DAO_WORDS[err.code]
  return words ? new ApiError(words, err.code, err.status) : err
}
