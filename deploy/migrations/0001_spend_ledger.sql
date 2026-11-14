-- NEAR AI spend ledger: one row per attestation, completion and signature call. The sum is checked against the USD 2.50 cap.
CREATE TABLE IF NOT EXISTS spend_ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts TEXT NOT NULL,
  model TEXT NOT NULL,
  kind TEXT NOT NULL,
  prompt_tokens INTEGER NOT NULL DEFAULT 0,
  completion_tokens INTEGER NOT NULL DEFAULT 0,
  cost_usd REAL NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS spend_ledger_ts ON spend_ledger (ts);
