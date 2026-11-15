-- The unit_run transaction the server sent for each approved unit proposal (POST /api/units/:id/run), so each release
-- can link the run that produced it. Additive: a new table only.
CREATE TABLE IF NOT EXISTS unit_runs (
  unit_id INTEGER NOT NULL,
  proposal_id INTEGER NOT NULL,
  tx TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  PRIMARY KEY (unit_id, proposal_id, tx)
);
