import { unitStatement, type Ciphertext } from "@bandsheet/core"
import type { Invite } from "@bandsheet/core/near"
import { ApiError } from "@/lib/api"
import { GAS } from "./config"
import { units, unitsWallet } from "./index"
import { makeInvite, rememberInvite, sha256Hex } from "./invite"
import { findTx, inviteIs, proposalSince, unitWithInvite, voteOn } from "./late"
import { writeUnitKey } from "./keys"
import type { Prepared } from "./use-tap"
import { claimOf, type Conn, type EntryMeta, type EntryReceipt, type SignedMessage, type TxResult } from "./types"

/**
 * Preparers for each units wallet action (see use-tap). Each awaits everything first and returns a start() whose
 * first statement is the wallet call. Council actions are transactions; join, synthetic and entry are NEP-413
 * messages (EIP-191 for an Ethereum wallet). Shapes follow contracts/units/INTERFACE.md.
 */

/** `late`: the wallet reported a decline (or lost touch) but the chain shows it landed; `tx` then comes from nearblocks. */
export type Landed<T> = { tx: string | null; value: T; late?: boolean }

const asNumber = (v: unknown, what: string): number => {
  const n = typeof v === "number" ? v : typeof v === "string" && /^\d+$/.test(v) ? Number(v) : NaN
  if (!Number.isInteger(n)) throw new ApiError(`The contract did not return a ${what}.`, "BAD_RESPONSE")
  return n
}
const landed = <T>(r: TxResult, value: T): Landed<T> => ({ tx: r.hash, value })
/** A landing found by reading the chain after the wallet said no: look up its transaction, best effort. */
const landedLate = async <T>(conn: Conn, method: string, since: number, value: T): Promise<Landed<T>> => ({ tx: await findTx(conn.accountId, method, since), value, late: true })

function sameAccount(s: SignedMessage, conn: Conn): void {
  if (s.accountId !== conn.accountId) throw new ApiError(`The wallet signed as ${s.accountId}, not ${conn.accountId}. Nothing was sent.`, "WRONG_ACCOUNT")
}

export type Created = { unitId: number; code: string }

export async function prepareCreate(conn: Conn, name: string, domains: string[]): Promise<Prepared<Landed<Created>>> {
  // The secret stays in this closure (memory only) until the outcome is known; only its hash goes on chain.
  const invite = makeInvite()
  const call = await unitsWallet.prepareCall(conn, { method: "create_unit", args: { name, invite_code_hash: invite.hash, dkim_domains: domains }, gas: GAS.create })
  let since = 0
  return {
    start: () => {
      since = Date.now()
      return call.send().then((r) => {
        const unitId = asNumber(r.value, "unit id")
        rememberInvite(unitId, invite.secret)
        return landed(r, { unitId, code: invite.secret })
      })
    },
    late: async () => {
      const unitId = await unitWithInvite(conn.accountId, invite.hash)
      if (unitId === null) return null
      rememberInvite(unitId, invite.secret)
      return landedLate(conn, "create_unit", since, { unitId, code: invite.secret })
    },
  }
}

export type Joined = { slot: string; tx: string | null }

/** A fresh posting key is made in this browser; the wallet signs "Bandsheet join unit <id>: <posting key>". */
export async function prepareJoin(conn: Conn, unitId: number, secret: string): Promise<Prepared<Joined>> {
  const near = await import("@bandsheet/core/near")
  const key = near.generateMemberKey()
  const issued = await units.nonce("unit_join")
  const msg = await unitsWallet.prepareMessage(conn, { message: unitStatement("unit_join", unitId, key.publicKey), recipient: issued.recipient, nonce: issued.nonce })
  return {
    start: (mark) =>
      msg.sign().then(async (s) => {
        sameAccount(s, conn)
        mark("posting")
        const out = await units.join(unitId, { ...claimOf(s, issued.nonce), member_public_key: key.publicKey, invite_code: secret })
        writeUnitKey({ unitId, accountId: conn.accountId, contractId: units.contract, privateKey: key.privateKey, publicKey: key.publicKey, slot: key.slot, joinedAt: Date.now(), last: null })
        return { slot: out.slot || key.slot, tx: out.tx?.hash ?? null }
      }),
  }
}

export async function prepareSynthetic(conn: Conn, unitId: number, n: number): Promise<Prepared<{ added: number; txs: string[] }>> {
  const issued = await units.nonce("unit_synthetic")
  const msg = await unitsWallet.prepareMessage(conn, { message: unitStatement("unit_synthetic", unitId, String(n)), recipient: issued.recipient, nonce: issued.nonce })
  return {
    start: (mark) =>
      msg.sign().then(async (s) => {
        sameAccount(s, conn)
        mark("posting")
        const out = await units.synthetic(unitId, { ...claimOf(s, issued.nonce), n })
        return { added: out.added, txs: out.txs.map((t) => t.hash) }
      }),
  }
}

/**
 * A council seat supplies the employer's DKIM key for a listed test domain that has no DNS record. The wallet signs
 * "Bandsheet issuer <id>: <domain> <selector>"; the server checks the seat and records the key as "supplied, not DNS".
 */
export async function prepareSuppliedIssuer(conn: Conn, unitId: number, domain: string, selector: string, eml: string, key: string) {
  const issued = await units.nonce("unit_issuer")
  const msg = await unitsWallet.prepareMessage(conn, { message: unitStatement("unit_issuer", unitId, `${domain} ${selector}`), recipient: issued.recipient, nonce: issued.nonce })
  return {
    start: (mark: (s: "wallet" | "posting") => void) =>
      msg.sign().then((s) => {
        sameAccount(s, conn)
        mark("posting")
        return units.issuerSupplied(unitId, { eml, supplied_key: key.trim(), claim: claimOf(s, issued.nonce) })
      }),
  }
}

/**
 * A wallet-bound entry. Right after sealing: the posting key signs submit(ciphertext) here but does not send it, and
 * the wallet call for "Bandsheet unit <id> entry: <sha256 of the ciphertext JSON>" is made ready. On the tap the
 * wallet signs; only then does the server broadcast the posting key's transaction. A decline posts nothing.
 */
export async function prepareEntry(conn: Conn, invite: Invite, sealed: Ciphertext, meta: EntryMeta): Promise<Prepared<EntryReceipt>> {
  // Mock mode has no units account to sign against, so it skips the posting key's transaction.
  const { signedTxB64, ctText } =
    units.mode === "mock" ? { signedTxB64: "mock", ctText: JSON.stringify(sealed) } : await (await import("@bandsheet/core/near")).signSubmitTx(invite, sealed, { gasTeras: 10 })
  const hash = await sha256Hex(ctText)
  const issued = await units.nonce("unit_entry")
  const msg = await unitsWallet.prepareMessage(conn, { message: unitStatement("unit_entry", meta.unitId, hash), recipient: issued.recipient, nonce: issued.nonce })
  return {
    start: (mark) =>
      msg.sign().then(async (s) => {
        sameAccount(s, conn)
        mark("posting")
        return units.entry(meta.unitId, { ...claimOf(s, issued.nonce), signed_tx: signedTxB64 }, { ...meta, invite, sealed })
      }),
  }
}

export type Query = { group_by: ("grade" | "gender" | "site")[]; filter?: Record<string, string> }

/** The query as the contract takes it: JSON text, keys group_by, filter and stat only, at most 512 bytes. */
export function queryText(q: Query): string {
  const text = JSON.stringify({ group_by: q.group_by, ...(q.filter && Object.keys(q.filter).length ? { filter: q.filter } : {}), stat: "mean" })
  if (new TextEncoder().encode(text).length > 512) throw new ApiError("That request is too long for the contract (512 bytes at most).", "QUERY_TOO_LONG")
  return text
}

/** On a one-seat council the proposal passes and the engine runs in this same call. */
export async function preparePropose(conn: Conn, unitId: number, query: Query): Promise<Prepared<Landed<number>>> {
  const text = queryText(query)
  const call = await unitsWallet.prepareCall(conn, { method: "unit_propose_release", args: { unit_id: unitId, query: text }, gas: GAS.propose })
  let since = 0
  return {
    start: () => {
      since = Date.now()
      return call.send().then((r) => landed(r, asNumber(r.value, "proposal id")))
    },
    late: async () => {
      const id = await proposalSince(unitId, conn.accountId, text, since)
      return id === null ? null : landedLate(conn, "unit_propose_release", since, id)
    },
  }
}

/** Returns the proposal's status after the vote: "open", "running" or "rejected". */
export async function prepareVote(conn: Conn, unitId: number, proposalId: number, approve: boolean): Promise<Prepared<Landed<string | null>>> {
  const call = await unitsWallet.prepareCall(conn, { method: "unit_vote", args: { unit_id: unitId, proposal_id: proposalId, approve }, gas: GAS.vote })
  let since = 0
  return {
    start: () => {
      since = Date.now()
      return call.send().then((r) => landed(r, typeof r.value === "string" ? r.value : null))
    },
    late: async () => {
      const status = await voteOn(unitId, proposalId, conn.accountId, approve)
      return status === null ? null : landedLate(conn, "unit_vote", since, status)
    },
  }
}

/**
 * "added" on a one-seat council; otherwise each call is one approval and the seat lands once more than half of the
 * current council has called it for that account ("pending" until then).
 */
export async function prepareAddCouncil(conn: Conn, unitId: number, accountId: string): Promise<Prepared<Landed<"added" | "pending">>> {
  const call = await unitsWallet.prepareCall(conn, { method: "unit_add_council", args: { unit_id: unitId, account_id: accountId }, gas: GAS.council })
  return { start: () => call.send().then((r) => landed(r, r.value === "pending" ? "pending" : "added")) }
}

/** The proposer takes back an open proposal. */
export async function prepareWithdraw(conn: Conn, unitId: number, proposalId: number): Promise<Prepared<Landed<null>>> {
  const call = await unitsWallet.prepareCall(conn, { method: "unit_withdraw_proposal", args: { unit_id: unitId, proposal_id: proposalId }, gas: GAS.council })
  return { start: () => call.send().then((r) => landed(r, null)) }
}

/** "New invite link": a fresh secret; the old link stops working, members stay. */
export async function prepareRotateInvite(conn: Conn, unitId: number): Promise<Prepared<Landed<string>>> {
  const invite = makeInvite()
  const call = await unitsWallet.prepareCall(conn, { method: "unit_rotate_invite", args: { unit_id: unitId, invite_code_hash: invite.hash }, gas: GAS.council })
  let since = 0
  return {
    start: () => {
      since = Date.now()
      return call.send().then((r) => {
        rememberInvite(unitId, invite.secret)
        return landed(r, invite.secret)
      })
    },
    late: async () => {
      if (!(await inviteIs(unitId, invite.hash))) return null
      rememberInvite(unitId, invite.secret)
      return landedLate(conn, "unit_rotate_invite", since, invite.secret)
    },
  }
}

export async function prepareAddDomain(conn: Conn, unitId: number, domain: string): Promise<Prepared<Landed<null>>> {
  const call = await unitsWallet.prepareCall(conn, { method: "unit_add_dkim_domain", args: { unit_id: unitId, domain }, gas: GAS.council })
  return { start: () => call.send().then((r) => landed(r, null)) }
}

/** Employer DKIM domains as typed: lower case, no scheme or path, de-duplicated. */
export function parseDomains(text: string): { domains: string[]; bad: string[] } {
  const parts = text.split(/[\s,;]+/).map((d) => d.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/^@/, "")).filter(Boolean)
  const ok = (d: string) => /^(?=.{3,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(d)
  return { domains: [...new Set(parts.filter(ok))], bad: parts.filter((d) => !ok(d)) }
}
