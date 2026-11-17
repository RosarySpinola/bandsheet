import type { Ciphertext, Entry, UnitPurpose } from "@bandsheet/core"
import type { Invite } from "@bandsheet/core/near"
import type { StandResponse } from "@/lib/api"
import type { Attack, AttackPrep, IssuerResult, RunResult, SponsorResult, SyntheticResult, Unit, UnitJoinResult, UnitsPolicy, UnitView } from "./schemas"

/** Where a sealed entry's figure came from, as the badge shows it. */
export type EntryKind = "dkim" | "self" | "synthetic"

/**
 * A wallet's signed statement, the demo's claim shape (INTERFACE.md "Server"): public_key is the WALLET's key
 * (absent for EIP-191). NEP-413 recipient is the units contract; the nonce comes from POST /api/units/nonce.
 */
export type UnitClaim = { scheme: "nep413" | "eip191"; account_id: string; public_key?: string; signature: string; nonce: string }

export type JoinBody = UnitClaim & { member_public_key: string; invite_code: string }
export type SyntheticBody = UnitClaim & { n: number; grade?: Entry["grade"] }
export type EntryBody = UnitClaim & { signed_tx: string }
/** The attack lab: change one published cell of `release_id` by one synthetic colleague. */
export type AttackBody = UnitClaim & { release_id: number; cell: Record<string, string> }

export type StandBody = { gross_annual_eur: number; grade: Entry["grade"]; country: "MT" | "GR" | "DE" | "FR" | "IE"; unit_id: number }

export type EntryReceipt = { tx: string | null; count: number | null }
export type EntryMeta = { unitId: number; kind: EntryKind; entry: Omit<Entry, "slot" | "submitted_at"> }

/** Reads and server calls. Two implementations: chain (contract views + /api/units) and mock (this browser only). */
export interface UnitsClient {
  readonly mode: "mock" | "chain"
  readonly contract: string
  policy(): Promise<UnitsPolicy>
  view(unitId: number): Promise<UnitView>
  unitsOf(accountId: string): Promise<Unit[]>
  /** Balance in NEAR (not yocto). */
  balance(accountId: string): Promise<number>
  sponsor(accountId: string): Promise<SponsorResult>
  nonce(purpose: UnitPurpose): Promise<{ nonce: string; recipient: string }>
  join(unitId: number, body: JoinBody): Promise<UnitJoinResult>
  synthetic(unitId: number, body: SyntheticBody): Promise<SyntheticResult>
  /** The raw .eml text; the server reads d= and s= and records the key if the domain is listed. */
  issuer(unitId: number, emlText: string): Promise<IssuerResult>
  /** A council seat supplies the employer key for a listed domain with no DNS record (recorded as "supplied, not DNS"). */
  issuerSupplied(unitId: number, body: { eml: string; supplied_key: string; claim: UnitClaim }): Promise<IssuerResult>
  /** unit_of_slot: the unit a posting key's slot belongs to, or null. */
  unitOfSlot(slot: string): Promise<{ unitId: number; synthetic: boolean; hasEntry: boolean } | null>
  /**
   * The wallet-bound entry: the server checks the wallet's claim over sha256(ciphertext JSON), then broadcasts the
   * posting key's signed submit. Mock mode also gets the plain fields so its engine can count them.
   */
  entry(unitId: number, body: EntryBody, meta: EntryMeta & { invite: Invite; sealed: Ciphertext }): Promise<EntryReceipt>
  stand(body: StandBody): Promise<StandResponse>
  /** Start the engine for an approved proposal: the server sends the 300 Tgas unit_run from the sponsor. */
  run(unitId: number, proposalId: number): Promise<RunResult>
  /** Council-signed: one synthetic colleague in or out of a published cell, so the same table can be asked again. */
  attackPrep(unitId: number, body: AttackBody): Promise<AttackPrep>
  /** The lab's changes on this unit, newest first. */
  attacks(unitId: number): Promise<Attack[]>
}

/** A wallet connected through NEAR Connect (or the mock wallet). */
export type Conn = { accountId: string; walletId: string; handle: unknown }

export type ContractCall = { method: string; args: Record<string, unknown>; gas: string; deposit?: string }
export type TxResult = { hash: string | null; value: unknown }
export type SignedMessage = { accountId: string; publicKey?: string; signature: string; scheme: "nep413" | "eip191" }

/** Everything loaded before the tap; send()/sign() start the wallet call synchronously inside it. */
export type PreparedCall = { send: () => Promise<TxResult> }
export type PreparedMessage = { sign: () => Promise<SignedMessage> }

export interface UnitsWallet {
  restore(): Promise<Conn | null>
  connect(): Promise<Conn>
  disconnect(): Promise<void>
  prepareCall(conn: Conn, call: ContractCall): Promise<PreparedCall>
  prepareMessage(conn: Conn, msg: { message: string; recipient: string; nonce: string }): Promise<PreparedMessage>
}

/** A signed message as the server's claim. */
export const claimOf = (s: SignedMessage, nonce: string): UnitClaim => ({
  scheme: s.scheme,
  account_id: s.accountId,
  ...(s.scheme === "nep413" && s.publicKey ? { public_key: s.publicKey } : {}),
  signature: s.signature,
  nonce,
})
