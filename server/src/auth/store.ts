import type { Purpose } from "./statement";

/** Nonce lifetime: long enough for a wallet popup or an Auth0 consent, short enough to be useless later. */
export const NONCE_TTL_MS = 10 * 60_000;

export type NonceCheck = "ok" | "unknown" | "expired" | "used" | "wrong_purpose" | "relayed";

export interface MemberRow {
  account_id: string;
  member_public_key: string;
  slot: string;
  method: string;
  joined_at: number;
  add_tx: string;
}

export interface BindingRow {
  account_id: string;
  slot: string;
  ct_sha256: string;
  method: string;
  signed_at: number;
}

/**
 * Off-chain auth state. The account <-> slot link lives here and only here: putting it on chain would
 * deanonymise every entry. Nonces are single-use; consume is atomic.
 */
export interface AuthStore {
  issueNonce(nonce: string, purpose: Purpose, now: number): Promise<number>;
  /** Mark a nonce as used by the NEAR Auth relay (one relay per nonce); does not consume it. */
  markRelayed(nonce: string, purpose: Purpose, now: number): Promise<NonceCheck>;
  consumeNonce(nonce: string, purpose: Purpose, now: number): Promise<NonceCheck>;
  getMember(accountId: string): Promise<MemberRow | null>;
  putMember(row: MemberRow): Promise<void>;
  addBinding(row: BindingRow): Promise<void>;
}

interface NonceRow {
  purpose: Purpose;
  expires_at: number;
  relayed_at: number | null;
  consumed_at: number | null;
}

const judge = (row: NonceRow | null | undefined, purpose: Purpose, now: number): NonceCheck => {
  if (!row) return "unknown";
  if (row.purpose !== purpose) return "wrong_purpose";
  if (row.consumed_at !== null) return "used";
  if (row.expires_at <= now) return "expired";
  return "ok";
};

/** In-memory store for the local Node server and tests (state is lost on restart). */
export class MemoryAuthStore implements AuthStore {
  readonly nonces = new Map<string, NonceRow>();
  readonly members = new Map<string, MemberRow>();
  readonly bindings: BindingRow[] = [];

  async issueNonce(nonce: string, purpose: Purpose, now: number) {
    const expires = now + NONCE_TTL_MS;
    this.nonces.set(nonce, { purpose, expires_at: expires, relayed_at: null, consumed_at: null });
    return expires;
  }
  async markRelayed(nonce: string, purpose: Purpose, now: number) {
    const row = this.nonces.get(nonce);
    const v = judge(row, purpose, now);
    if (v !== "ok") return v;
    if (row!.relayed_at !== null) return "relayed";
    row!.relayed_at = now;
    return "ok";
  }
  async consumeNonce(nonce: string, purpose: Purpose, now: number) {
    const row = this.nonces.get(nonce);
    const v = judge(row, purpose, now);
    if (v === "ok") row!.consumed_at = now;
    return v;
  }
  async getMember(accountId: string) {
    return this.members.get(accountId) ?? null;
  }
  async putMember(row: MemberRow) {
    this.members.set(row.account_id, row);
  }
  async addBinding(row: BindingRow) {
    if (!this.bindings.some((b) => b.account_id === row.account_id && b.ct_sha256 === row.ct_sha256)) this.bindings.push(row);
  }
}

/** The slice of Cloudflare D1 used here (run() exposes meta.changes for atomic consume). */
export interface AuthD1 {
  prepare(sql: string): {
    bind(...values: unknown[]): { run(): Promise<{ meta?: { changes?: number } }>; first<T = unknown>(): Promise<T | null> };
  };
}

/** D1 store (tables in deploy/migrations/0002_auth.sql, database bound as AUTH_DB). */
export class D1AuthStore implements AuthStore {
  constructor(private readonly db: AuthD1) {}

  private row(nonce: string) {
    return this.db.prepare("SELECT purpose, expires_at, relayed_at, consumed_at FROM auth_nonces WHERE nonce = ?").bind(nonce).first<NonceRow>();
  }
  async issueNonce(nonce: string, purpose: Purpose, now: number) {
    const expires = now + NONCE_TTL_MS;
    await this.db.prepare("INSERT INTO auth_nonces (nonce, purpose, issued_at, expires_at) VALUES (?, ?, ?, ?)").bind(nonce, purpose, now, expires).run();
    return expires;
  }
  async markRelayed(nonce: string, purpose: Purpose, now: number) {
    const r = await this.db
      .prepare("UPDATE auth_nonces SET relayed_at = ? WHERE nonce = ? AND purpose = ? AND relayed_at IS NULL AND consumed_at IS NULL AND expires_at > ?")
      .bind(now, nonce, purpose, now)
      .run();
    if (r.meta?.changes === 1) return "ok";
    const v = judge(await this.row(nonce), purpose, now);
    return v === "ok" ? "relayed" : v;
  }
  async consumeNonce(nonce: string, purpose: Purpose, now: number) {
    const r = await this.db
      .prepare("UPDATE auth_nonces SET consumed_at = ? WHERE nonce = ? AND purpose = ? AND consumed_at IS NULL AND expires_at > ?")
      .bind(now, nonce, purpose, now)
      .run();
    if (r.meta?.changes === 1) return "ok";
    const v = judge(await this.row(nonce), purpose, now);
    return v === "ok" ? "used" : v;
  }
  async getMember(accountId: string) {
    return this.db
      .prepare("SELECT account_id, member_public_key, slot, method, joined_at, add_tx FROM auth_members WHERE account_id = ?")
      .bind(accountId)
      .first<MemberRow>();
  }
  async putMember(m: MemberRow) {
    await this.db
      .prepare(
        "INSERT INTO auth_members (account_id, member_public_key, slot, method, joined_at, add_tx) VALUES (?, ?, ?, ?, ?, ?) " +
          "ON CONFLICT(account_id) DO UPDATE SET member_public_key = excluded.member_public_key, slot = excluded.slot, " +
          "method = excluded.method, joined_at = excluded.joined_at, add_tx = excluded.add_tx",
      )
      .bind(m.account_id, m.member_public_key, m.slot, m.method, m.joined_at, m.add_tx)
      .run();
  }
  async addBinding(b: BindingRow) {
    await this.db
      .prepare("INSERT OR IGNORE INTO entry_bindings (account_id, slot, ct_sha256, method, signed_at) VALUES (?, ?, ?, ?, ?)")
      .bind(b.account_id, b.slot, b.ct_sha256, b.method, b.signed_at)
      .run();
  }
}
