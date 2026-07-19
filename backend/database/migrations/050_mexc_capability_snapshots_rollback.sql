-- MEXC-E2E remediation — append-only snapshots + verification runs for rollback
-- Non-destructive additive. Never alters encrypted credentials.

BEGIN;

CREATE TABLE IF NOT EXISTS mexc_capability_state_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES exchange_connections(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  correlation_id TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'pre_probe',
  snapshot_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT mexc_cap_snap_kind_nonempty CHECK (char_length(kind) > 0)
);

CREATE INDEX IF NOT EXISTS idx_mexc_cap_snap_connection
  ON mexc_capability_state_snapshots (connection_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_mexc_cap_snap_corr
  ON mexc_capability_state_snapshots (correlation_id);

CREATE TABLE IF NOT EXISTS mexc_capability_verification_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES exchange_connections(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  correlation_id TEXT NOT NULL,
  snapshot_id UUID NULL REFERENCES mexc_capability_state_snapshots(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'planned',
  notes TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT mexc_cap_run_status_nonempty CHECK (char_length(status) > 0)
);

CREATE INDEX IF NOT EXISTS idx_mexc_cap_run_connection
  ON mexc_capability_verification_runs (connection_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_mexc_cap_run_corr
  ON mexc_capability_verification_runs (correlation_id);

-- Optional run_status on append-only history (additive; never delete rows)
ALTER TABLE mexc_capability_verifications
  ADD COLUMN IF NOT EXISTS run_status TEXT NULL;

COMMENT ON TABLE mexc_capability_state_snapshots IS
  'Pre-probe capability-state snapshots for transactional rollback. No secrets.';
COMMENT ON TABLE mexc_capability_verification_runs IS
  'Verification run lifecycle (planned/running/succeeded/failed/rolled_back/superseded).';
COMMENT ON COLUMN mexc_capability_verifications.run_status IS
  'Optional lifecycle marker; history rows remain append-only and are never deleted.';

COMMIT;

-- Rollback plan (manual — tables only; never touch exchange_connections credentials):
-- BEGIN;
-- ALTER TABLE mexc_capability_verifications DROP COLUMN IF EXISTS run_status;
-- DROP TABLE IF EXISTS mexc_capability_verification_runs;
-- DROP TABLE IF EXISTS mexc_capability_state_snapshots;
-- COMMIT;
