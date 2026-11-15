-- Units ("start your own unit", contracts/units). Additive: new tables only, the demo's tables are untouched.
-- The account <-> slot link for unit members lives here only, never on chain.

CREATE TABLE IF NOT EXISTS unit_nonces (
  nonce TEXT PRIMARY KEY,
  purpose TEXT NOT NULL CHECK (purpose IN ('unit_join', 'unit_synthetic', 'unit_entry', 'unit_issuer')),
  issued_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  consumed_at INTEGER
);
CREATE INDEX IF NOT EXISTS unit_nonces_expires ON unit_nonces (expires_at);

-- One active posting key per (account, unit). Re-joining revokes the old key on chain and replaces this row.
CREATE TABLE IF NOT EXISTS unit_members (
  account_id TEXT NOT NULL,
  unit_id INTEGER NOT NULL,
  member_public_key TEXT NOT NULL,
  slot TEXT NOT NULL UNIQUE,
  joined_at INTEGER NOT NULL,
  add_tx TEXT NOT NULL,
  PRIMARY KEY (account_id, unit_id)
);

CREATE TABLE IF NOT EXISTS unit_bindings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id TEXT NOT NULL,
  unit_id INTEGER NOT NULL,
  slot TEXT NOT NULL,
  ct_sha256 TEXT NOT NULL,
  signed_at INTEGER NOT NULL,
  UNIQUE (account_id, unit_id, ct_sha256)
);

-- One gas grant per account, ever; the IP is kept to cap grants per address per day.
CREATE TABLE IF NOT EXISTS sponsor_grants (
  account_id TEXT PRIMARY KEY,
  ip TEXT NOT NULL,
  tx TEXT NOT NULL,
  granted_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS sponsor_grants_ip ON sponsor_grants (ip, granted_at);
