import type { UnitPurpose } from "@bandsheet/core";
import type { AuthD1, NonceCheck } from "../auth/store";
import { NONCE_TTL_MS } from "../auth/store";

export interface UnitMemberRow {
  account_id: string;
  unit_id: number;
  member_public_key: string;
  slot: string;
  joined_at: number;
  add_tx: string;
}

export interface UnitBindingRow {
  account_id: string;
  unit_id: number;
  slot: string;
  ct_sha256: string;
  signed_at: number;
}

/** One attack-lab change (deploy/migrations-auth/0004_unit_attacks.sql). The figure is a synthetic sample, never a member's. */
export interface AttackRow {
  unit_id: number;
  started_at: number;
  account_id: string;
  release_id: number;
  query: string;
  cell: Record<string, string>;
  action: "add" | "remove";
  public_key: string;
  grade: string;
  gender: string;
  site: string;
  gross_annual_eur: number;
  txs: string[];
}

export interface GrantRow {
  account_id: string;
  ip: string;
  tx: string;
  granted_at: number;
}

/** Off-chain units state (D1 tables in deploy/migrations-auth/0002_units.sql). The account <-> slot link lives only here. */
export interface UnitStore {
  issueNonce(nonce: string, purpose: UnitPurpose, now: number): Promise<number>;
  consumeNonce(nonce: string, purpose: UnitPurpose, now: number): Promise<NonceCheck>;
  getMember(accountId: string, unitId: number): Promise<UnitMemberRow | null>;
  putMember(row: UnitMemberRow): Promise<void>;
  addBinding(row: UnitBindingRow): Promise<void>;
  getGrant(accountId: string): Promise<GrantRow | null>;
  grantsFromIp(ip: string, since: number): Promise<number>;
  /** Records a grant; false when the account already had one (atomic: two requests cannot both win). */
  putGrant(row: GrantRow): Promise<boolean>;
  /** Fill in the transfer hash once it landed, or drop the reservation when the transfer failed. */
  finishGrant(accountId: string, tx: string): Promise<void>;
  dropGrant(accountId: string): Promise<void>;
  /** The unit_run transaction sent for a proposal, so the release it produced can link it. */
  putRun(unitId: number, proposalId: number, tx: string, now: number): Promise<void>;
  runsOf(unitId: number): Promise<{ proposal_id: number; tx: string }[]>;
  putAttack(row: AttackRow): Promise<void>;
  /** Newest first, at most 20. */
  attacksOf(unitId: number): Promise<AttackRow[]>;
}

interface NonceRow {
  purpose: string;
  expires_at: number;
  consumed_at: number | null;
}

const judge = (row: NonceRow | null | undefined, purpose: string, now: number): NonceCheck => {
  if (!row) return "unknown";
  if (row.purpose !== purpose) return "wrong_purpose";
  if (row.consumed_at !== null) return "used";
  if (row.expires_at <= now) return "expired";
  return "ok";
};

export class MemoryUnitStore implements UnitStore {
  readonly nonces = new Map<string, NonceRow>();
  readonly members = new Map<string, UnitMemberRow>();
  readonly bindings: UnitBindingRow[] = [];
  readonly grants = new Map<string, GrantRow>();
  readonly runs: { unit_id: number; proposal_id: number; tx: string; started_at: number }[] = [];

  async putRun(unitId: number, proposalId: number, tx: string, now: number) {
    this.runs.push({ unit_id: unitId, proposal_id: proposalId, tx, started_at: now });
  }
  async runsOf(unitId: number) {
    return this.runs.filter((r) => r.unit_id === unitId).map((r) => ({ proposal_id: r.proposal_id, tx: r.tx }));
  }
  readonly attacks: AttackRow[] = [];
  async putAttack(row: AttackRow) {
    this.attacks.push(row);
  }
  async attacksOf(unitId: number) {
    return this.attacks.filter((a) => a.unit_id === unitId).sort((a, b) => b.started_at - a.started_at).slice(0, 20);
  }

  async issueNonce(nonce: string, purpose: UnitPurpose, now: number) {
    this.nonces.set(nonce, { purpose, expires_at: now + NONCE_TTL_MS, consumed_at: null });
    return now + NONCE_TTL_MS;
  }
  async consumeNonce(nonce: string, purpose: UnitPurpose, now: number) {
    const row = this.nonces.get(nonce);
    const v = judge(row, purpose, now);
    if (v === "ok") row!.consumed_at = now;
    return v;
  }
  async getMember(accountId: string, unitId: number) {
    return this.members.get(`${accountId}|${unitId}`) ?? null;
  }
  async putMember(row: UnitMemberRow) {
    this.members.set(`${row.account_id}|${row.unit_id}`, row);
  }
  async addBinding(row: UnitBindingRow) {
    if (!this.bindings.some((b) => b.account_id === row.account_id && b.unit_id === row.unit_id && b.ct_sha256 === row.ct_sha256)) this.bindings.push(row);
  }
  async getGrant(accountId: string) {
    return this.grants.get(accountId) ?? null;
  }
  async grantsFromIp(ip: string, since: number) {
    return [...this.grants.values()].filter((g) => g.ip === ip && g.granted_at >= since).length;
  }
  async putGrant(row: GrantRow) {
    if (this.grants.has(row.account_id)) return false;
    this.grants.set(row.account_id, row);
    return true;
  }
  async finishGrant(accountId: string, tx: string) {
    const g = this.grants.get(accountId);
    if (g) g.tx = tx;
  }
  async dropGrant(accountId: string) {
    this.grants.delete(accountId);
  }
}

export class D1UnitStore implements UnitStore {
  constructor(private readonly db: AuthD1) {}

  async issueNonce(nonce: string, purpose: UnitPurpose, now: number) {
    await this.db.prepare("INSERT INTO unit_nonces (nonce, purpose, issued_at, expires_at) VALUES (?, ?, ?, ?)").bind(nonce, purpose, now, now + NONCE_TTL_MS).run();
    return now + NONCE_TTL_MS;
  }
  async consumeNonce(nonce: string, purpose: UnitPurpose, now: number) {
    const r = await this.db
      .prepare("UPDATE unit_nonces SET consumed_at = ? WHERE nonce = ? AND purpose = ? AND consumed_at IS NULL AND expires_at > ?")
      .bind(now, nonce, purpose, now)
      .run();
    if (r.meta?.changes === 1) return "ok";
    const row = await this.db.prepare("SELECT purpose, expires_at, consumed_at FROM unit_nonces WHERE nonce = ?").bind(nonce).first<NonceRow>();
    const v = judge(row, purpose, now);
    return v === "ok" ? "used" : v;
  }
  async getMember(accountId: string, unitId: number) {
    return this.db
      .prepare("SELECT account_id, unit_id, member_public_key, slot, joined_at, add_tx FROM unit_members WHERE account_id = ? AND unit_id = ?")
      .bind(accountId, unitId)
      .first<UnitMemberRow>();
  }
  async putMember(m: UnitMemberRow) {
    await this.db
      .prepare(
        "INSERT INTO unit_members (account_id, unit_id, member_public_key, slot, joined_at, add_tx) VALUES (?, ?, ?, ?, ?, ?) " +
          "ON CONFLICT(account_id, unit_id) DO UPDATE SET member_public_key = excluded.member_public_key, slot = excluded.slot, " +
          "joined_at = excluded.joined_at, add_tx = excluded.add_tx",
      )
      .bind(m.account_id, m.unit_id, m.member_public_key, m.slot, m.joined_at, m.add_tx)
      .run();
  }
  async addBinding(b: UnitBindingRow) {
    await this.db
      .prepare("INSERT OR IGNORE INTO unit_bindings (account_id, unit_id, slot, ct_sha256, signed_at) VALUES (?, ?, ?, ?, ?)")
      .bind(b.account_id, b.unit_id, b.slot, b.ct_sha256, b.signed_at)
      .run();
  }
  async getGrant(accountId: string) {
    return this.db.prepare("SELECT account_id, ip, tx, granted_at FROM sponsor_grants WHERE account_id = ?").bind(accountId).first<GrantRow>();
  }
  async grantsFromIp(ip: string, since: number) {
    const r = await this.db.prepare("SELECT COUNT(*) AS n FROM sponsor_grants WHERE ip = ? AND granted_at >= ?").bind(ip, since).first<{ n: number }>();
    return Number(r?.n ?? 0);
  }
  async putGrant(g: GrantRow) {
    const r = await this.db
      .prepare("INSERT OR IGNORE INTO sponsor_grants (account_id, ip, tx, granted_at) VALUES (?, ?, ?, ?)")
      .bind(g.account_id, g.ip, g.tx, g.granted_at)
      .run();
    return r.meta?.changes === 1;
  }
  async finishGrant(accountId: string, tx: string) {
    await this.db.prepare("UPDATE sponsor_grants SET tx = ? WHERE account_id = ?").bind(tx, accountId).run();
  }
  async dropGrant(accountId: string) {
    await this.db.prepare("DELETE FROM sponsor_grants WHERE account_id = ?").bind(accountId).run();
  }
  async putRun(unitId: number, proposalId: number, tx: string, now: number) {
    await this.db.prepare("INSERT OR IGNORE INTO unit_runs (unit_id, proposal_id, tx, started_at) VALUES (?, ?, ?, ?)").bind(unitId, proposalId, tx, now).run();
  }
  async runsOf(unitId: number) {
    // D1 statements also have all(); the narrow AuthD1 type only declares run() and first().
    const stmt = this.db.prepare("SELECT proposal_id, tx FROM unit_runs WHERE unit_id = ? ORDER BY started_at").bind(unitId) as unknown as {
      all(): Promise<{ results?: { proposal_id: number; tx: string }[] }>;
    };
    return (await stmt.all()).results ?? [];
  }
  async putAttack(a: AttackRow) {
    await this.db
      .prepare(
        "INSERT INTO unit_attacks (unit_id, started_at, account_id, release_id, query, cell, action, public_key, grade, gender, site, gross_annual_eur, txs) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .bind(a.unit_id, a.started_at, a.account_id, a.release_id, a.query, JSON.stringify(a.cell), a.action, a.public_key, a.grade, a.gender, a.site, a.gross_annual_eur, JSON.stringify(a.txs))
      .run();
  }
  async attacksOf(unitId: number) {
    type Raw = Omit<AttackRow, "cell" | "txs"> & { cell: string; txs: string };
    const stmt = this.db.prepare("SELECT * FROM unit_attacks WHERE unit_id = ? ORDER BY started_at DESC LIMIT 20").bind(unitId) as unknown as {
      all(): Promise<{ results?: Raw[] }>;
    };
    const rows = (await stmt.all()).results ?? [];
    return rows.map((x) => ({ ...x, cell: JSON.parse(x.cell) as Record<string, string>, txs: JSON.parse(x.txs) as string[] }));
  }
}
