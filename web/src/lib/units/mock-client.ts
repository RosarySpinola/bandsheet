import { ApiError } from "@/lib/api"
import { CONTRACT, view } from "@/lib/chain"
import { LIMITS, PLANNED_UNITS_CONTRACT, SPONSOR_AMOUNT_NEAR, mockFailure } from "./config"
import { fakeTx, load, save, settle, syntheticEntries, tick, type MProposal, type MUnit } from "./mock-state"
import { UnitViewSchema, UnitsPolicySchema, toUnit, type Unit, type UnitsPolicy } from "./schemas"
import { inviteHashOf } from "./invite"
import { ChainRefused, WalletCancelled } from "./wallet-bridge"
import { traceSignCall } from "@/lib/wallet/gesture"
import type { Conn, ContractCall, UnitsClient, UnitsWallet } from "./types"

/** Mock mode: the same interfaces as the chain client and wallet, answered from mock-state in this browser. */

/** The planned units account, so mock screens read like the live ones; every mock surface also says "mock". */
export const MOCK_CONTRACT = PLANNED_UNITS_CONTRACT
export const MOCK_ACCOUNT = "mira-okafor.testnet"
const MOCK_WASM = "69d5616c0e1f4ab2b9d3c87a51f06e2d94c2aa0b7e3d5f18c6b4a9e2d7c03b26"

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

function guardRead(): void {
  if (mockFailure() === "rpc") throw new ApiError("NEAR testnet did not answer (mock: ?fail=rpc).", "CHAIN_READ", 503)
}

function withUnit<T>(id: number, fn: (u: MUnit) => T): T {
  const s = load()
  const u = s.units.find((x) => x.id === id)
  if (!u) throw new ApiError(`There is no unit ${id} on the units contract.`, "UNIT_NOT_FOUND", 404)
  const out = fn(u)
  save(s)
  return out
}

const rawUnit = (u: MUnit) => ({
  id: u.id, name: u.name, creator: u.creator, council: u.council, dkim_domains: u.dkim_domains, pending_seats: u.pending_seats ?? [],
  member_count: u.members.length, entry_count: u.entries.length, synthetic_count: u.entries.filter((e) => e.kind === "synthetic").length, release_count: u.releases.length, created_at: u.created_at, issuers: [],
})
const unitOf = (u: MUnit): Unit => toUnit(rawUnit(u))

let policyCache: UnitsPolicy | null = null

const BALANCE = "bandsheet.units.mock.balance"
const readBalance = () => {
  try {
    return Number(window.sessionStorage.getItem(BALANCE) ?? "0")
  } catch {
    return 0
  }
}

export const mockClient: UnitsClient = {
  mode: "mock",
  contract: MOCK_CONTRACT,

  /** The real engine key (same OutLayer project as the demo), so sealing in mock mode is the real sealing. */
  policy: async () => {
    guardRead()
    if (policyCache) return policyCache
    const p = await view<{ policy: { k: number; enclave_pubkey: string; wasm_sha256: string; policy_hash: string } }>(CONTRACT, "get_policy")
    policyCache = UnitsPolicySchema.parse({ policy: { ...p.policy, wasm_sha256: p.policy.wasm_sha256 || MOCK_WASM } })
    return policyCache
  },

  view: async (id) => {
    guardRead()
    await sleep(250)
    const s = load()
    if (tick(s, policyCache?.wasmSha256 ?? MOCK_WASM)) save(s)
    const u = s.units.find((x) => x.id === id)
    if (!u) throw new ApiError(`There is no unit ${id} on the units contract.`, "UNIT_NOT_FOUND", 404)
    return UnitViewSchema.parse({ unit: rawUnit(u), proposals: u.proposals, releases: u.releases })
  },

  unitsOf: async (account) => {
    guardRead()
    return load().units.filter((u) => u.council.includes(account) || u.members.some((m) => m.account === account)).map(unitOf)
  },

  balance: async () => {
    guardRead()
    return readBalance()
  },

  sponsor: async () => {
    await sleep(2600)
    try {
      window.sessionStorage.setItem(BALANCE, String(SPONSOR_AMOUNT_NEAR))
    } catch {
      // storage blocked
    }
    return { funded: true, tx: { hash: fakeTx() }, balance: String(SPONSOR_AMOUNT_NEAR) }
  },

  nonce: async () => ({ nonce: btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""), recipient: MOCK_CONTRACT }),

  join: async (id, body) => {
    await sleep(1400)
    const hash = inviteHashOf(body.invite_code)
    const { slotIdFromNearPublicKey } = await import("@bandsheet/core")
    return withUnit(id, (u) => {
      if (hash !== u.invite_code_hash) throw new ApiError("This invite code is not this unit's code.", "INVITE_INVALID", 403)
      // Joining again (say, from another browser) replaces the account's earlier posting key, as on the server.
      u.members = u.members.filter((m) => m.account !== body.account_id)
      const slot = slotIdFromNearPublicKey(body.member_public_key)
      u.members.push({ slot, synthetic: false, account: body.account_id })
      return { slot, tx: { hash: fakeTx() }, unit_id: id }
    })
  },

  synthetic: async (id, body) => {
    await sleep(3200)
    return withUnit(id, (u) => {
      if (!u.council.includes(body.account_id)) throw new ApiError("Only a council seat can add synthetic colleagues.", "NOT_COUNCIL", 403)
      const have = u.entries.filter((e) => e.kind === "synthetic").length
      const n = Math.min(body.n, LIMITS.synthetic - have)
      if (n <= 0) throw new ApiError(`This unit already has the most synthetic colleagues allowed (${LIMITS.synthetic}).`, "SYNTHETIC_CAP", 409)
      const added = syntheticEntries(n, have)
      u.members.push(...added.map((e) => ({ slot: e.slot, synthetic: true })))
      u.entries.push(...added)
      return { added: n, txs: added.map(() => ({ hash: fakeTx() })), synthetic_total: have + n }
    })
  },

  issuerSupplied: async (id, body) => mockClient.issuer(id, body.eml),

  issuer: async (id, eml) => {
    await sleep(900)
    const head = eml.slice(0, 20000)
    const d = /DKIM-Signature:[\s\S]*?\bd=([^;\s]+)/i.exec(head)?.[1]
    const sel = /DKIM-Signature:[\s\S]*?\bs=([^;\s]+)/i.exec(head)?.[1]
    if (!d || !sel) throw new ApiError("This email carries no DKIM signature.", "EML_NO_DKIM", 400)
    return withUnit(id, (u) => {
      if (!u.dkim_domains.includes(d.toLowerCase())) throw new ApiError(`${d} is not one of this unit's employer domains.`, "DOMAIN_NOT_LISTED", 403)
      return { domain: d, selector: sel, tx: { hash: fakeTx() } }
    })
  },

  unitOfSlot: async (slot) => {
    guardRead()
    const u = load().units.find((x) => x.members.some((m) => m.slot === slot))
    return u ? { unitId: u.id, synthetic: false, hasEntry: u.entries.some((e) => e.slot === slot) } : null
  },

  entry: async (_id, _body, meta) => {
    const invite = meta.invite
    await sleep(1800)
    return withUnit(meta.unitId, (u) => {
      if (!u.members.some((m) => m.slot === invite.slot)) throw new ApiError("submit refused on chain: not a registered member", "NOT_MEMBER")
      u.entries = u.entries.filter((e) => e.slot !== invite.slot)
      u.entries.push({ slot: invite.slot, kind: meta.kind, grade: meta.entry.grade, gender: meta.entry.gender, site: meta.entry.site, gross: meta.entry.gross_annual_eur })
      return { tx: fakeTx(), count: u.entries.length }
    })
  },

  /** The answer is written by NEAR AI Cloud from the bands the server reads on chain; a mock unit has none there. */
  run: async (id, proposalId) => {
    await sleep(1500)
    return withUnit(id, (u) => {
      const p = u.proposals.find((x) => x.id === proposalId)
      if (!p || p.status !== "Approved") throw new ApiError("That proposal is not approved, so the engine cannot run it.", "NOT_APPROVED", 409)
      p.status = "Running"
      p.run_at = Date.now() + 9000
      return { status: "running", tx: { hash: fakeTx() }, proposal_id: proposalId }
    })
  },

  stand: async () => {
    await sleep(600)
    throw new ApiError("In mock mode this unit lives only in this browser, so the server has no bands of yours to answer from. Where do I stand works here once the units contract is live.", "MOCK_ONLY")
  },
}

/* ---------- mock wallet: approvals take a moment; ?fail=reject or ?fail=chain shows those outcomes ---------- */

async function approve(): Promise<void> {
  await sleep(1600)
  const f = mockFailure()
  if (f === "reject") throw new WalletCancelled()
}

function apply(conn: Conn, call: ContractCall): unknown {
  const a = call.args as Record<string, never>
  const s = load()
  if (call.method === "create_unit") {
    const mine = s.units.filter((u) => u.creator === conn.accountId).length
    if (mine >= LIMITS.unitsPerAccount) throw new ChainRefused(`An account can create at most ${LIMITS.unitsPerAccount} units.`, fakeTx())
    const id = s.next++
    s.units.push({ id, name: a.name, creator: conn.accountId, council: [conn.accountId], dkim_domains: a.dkim_domains, invite_code_hash: a.invite_code_hash, members: [], entries: [], proposals: [], releases: [], created_at: Date.now() })
    save(s)
    return id
  }
  const u = s.units.find((x) => x.id === Number(a.unit_id))
  if (!u) throw new ChainRefused("No such unit.", fakeTx())
  if (!u.council.includes(conn.accountId)) throw new ChainRefused("Only a council seat can do this.", fakeTx())
  let out: unknown = null
  if (call.method === "unit_add_council") {
    if (u.council.length >= LIMITS.councilSeats) throw new ChainRefused(`A council has at most ${LIMITS.councilSeats} seats.`, fakeTx())
    // One seat adds at once; otherwise each call is one approval and the seat lands past half the council.
    const pending = (u.pending_seats ??= [])
    let p = pending.find((x) => x.account_id === a.account_id)
    if (!p) pending.push((p = { account_id: a.account_id, approvals: [] }))
    if (!p.approvals.includes(conn.accountId)) p.approvals.push(conn.accountId)
    if (p.approvals.length * 2 > u.council.length) {
      u.council.push(a.account_id)
      u.pending_seats = pending.filter((x) => x !== p)
      out = "added"
    } else out = "pending"
  } else if (call.method === "unit_withdraw_proposal") {
    const p = u.proposals.find((x) => x.id === Number(a.proposal_id))
    if (!p || p.status !== "Open" || p.proposer !== conn.accountId) throw new ChainRefused("Only the proposer can withdraw an open proposal.", fakeTx())
    p.status = "Withdrawn"
  } else if (call.method === "unit_rotate_invite") {
    u.invite_code_hash = a.invite_code_hash
  } else if (call.method === "unit_add_dkim_domain") {
    if (!u.dkim_domains.includes(a.domain)) u.dkim_domains.push(a.domain)
  } else if (call.method === "unit_propose_release") {
    const p = { id: u.proposals.length + 1, proposer: conn.accountId, query: JSON.parse(a.query) as MProposal["query"], approvals: [conn.accountId], rejections: [], status: "Open" as const, release_id: null, created_at: Date.now() }
    u.proposals.push(p)
    settle(u, p)
    out = p.id
  } else if (call.method === "unit_vote") {
    const p = u.proposals.find((x) => x.id === Number(a.proposal_id))
    if (!p || p.status !== "Open") throw new ChainRefused("This proposal is no longer open.", fakeTx())
    if (p.approvals.includes(conn.accountId) || p.rejections.includes(conn.accountId)) throw new ChainRefused("This seat has already voted.", fakeTx())
    ;(a.approve ? p.approvals : p.rejections).push(conn.accountId)
    settle(u, p)
    out = p.status === "Open" ? "open" : p.status === "Approved" ? "approved" : "rejected"
  }
  save(s)
  return out
}

export const mockWallet: UnitsWallet = {
  restore: async () => {
    try {
      return window.sessionStorage.getItem("bandsheet.units.mock.conn") ? { accountId: MOCK_ACCOUNT, walletId: "mock", handle: null } : null
    } catch {
      return null
    }
  },
  connect: async () => {
    await approve()
    try {
      window.sessionStorage.setItem("bandsheet.units.mock.conn", "1")
    } catch {
      // storage blocked
    }
    return { accountId: MOCK_ACCOUNT, walletId: "mock", handle: null }
  },
  disconnect: async () => {
    try {
      window.sessionStorage.removeItem("bandsheet.units.mock.conn")
    } catch {
      // storage blocked
    }
  },
  // The mock records its sign starts in window.__bsSignTrace too, so the tap rule can be checked without a wallet.
  prepareCall: async (conn, call) => ({
    send: () => {
      traceSignCall(`mock:signAndSendTransaction:${call.method}`)
      return approve().then(async () => {
        await sleep(1200)
        if (mockFailure() === "chain") throw new ChainRefused("The contract refused it (mock: ?fail=chain).", fakeTx())
        return { hash: fakeTx(), value: apply(conn, call) }
      })
    },
  }),
  prepareMessage: async (conn, msg) => ({
    sign: () => {
      traceSignCall(`mock:signMessage:${msg.message.split(":")[0]}`)
      return approve().then(() => ({ accountId: conn.accountId, publicKey: "ed25519:mock", signature: "mock-signature", scheme: "nep413" as const }))
    },
  }),
}
