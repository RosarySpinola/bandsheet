-- Bandsheet sign-in state (D1 database bound as AUTH_DB, separate from the spend ledger in deploy/migrations).
-- The account <-> slot link is kept here only, never on chain: on chain it would deanonymise entries.

-- Single-use nonces. consumed_at is set atomically by /api/auth/join and /api/auth/entry; relayed_at by the NEAR Auth relay.
CREATE TABLE IF NOT EXISTS auth_nonces (
  nonce TEXT PRIMARY KEY,
  purpose TEXT NOT NULL CHECK (purpose IN ('join', 'entry')),
  issued_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  relayed_at INTEGER,
  consumed_at INTEGER
);
CREATE INDEX IF NOT EXISTS auth_nonces_expires ON auth_nonces (expires_at);

-- One active member key per signed-in account. Re-joining revokes the old key on chain and replaces this row.
CREATE TABLE IF NOT EXISTS auth_members (
  account_id TEXT PRIMARY KEY,
  member_public_key TEXT NOT NULL,
  slot TEXT NOT NULL UNIQUE,
  method TEXT NOT NULL,
  joined_at INTEGER NOT NULL,
  add_tx TEXT NOT NULL
);

-- A signed-in member's signature over the sha256 of a sealed entry they submitted.
CREATE TABLE IF NOT EXISTS entry_bindings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id TEXT NOT NULL,
  slot TEXT NOT NULL,
  ct_sha256 TEXT NOT NULL,
  method TEXT NOT NULL,
  signed_at INTEGER NOT NULL,
  UNIQUE (account_id, ct_sha256)
);
