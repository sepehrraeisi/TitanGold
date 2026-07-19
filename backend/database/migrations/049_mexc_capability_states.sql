-- MEXC End-to-End Program — additive capability state + verification history
-- Non-destructive, reversible, no plaintext credentials, no duplicate credential columns.

BEGIN;

CREATE TABLE IF NOT EXISTS mexc_connection_capability_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES exchange_connections(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  capability_id TEXT NOT NULL,
  provider_support TEXT NULL,
  key_grant TEXT NULL,
  verification_state TEXT NULL,
  operational_state TEXT NULL,
  last_verified_at TIMESTAMPTZ NULL,
  last_failure_code TEXT NULL,
  sanitized_reason TEXT NULL,
  source_of_evidence TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT mexc_cap_state_unique UNIQUE (connection_id, capability_id),
  CONSTRAINT mexc_cap_state_capability_nonempty CHECK (char_length(capability_id) > 0)
);

CREATE INDEX IF NOT EXISTS idx_mexc_cap_state_owner
  ON mexc_connection_capability_state (owner_id);

CREATE INDEX IF NOT EXISTS idx_mexc_cap_state_connection
  ON mexc_connection_capability_state (connection_id);

CREATE INDEX IF NOT EXISTS idx_mexc_cap_state_capability
  ON mexc_connection_capability_state (capability_id);

CREATE TABLE IF NOT EXISTS mexc_capability_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES exchange_connections(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  capability_id TEXT NOT NULL,
  probe_id TEXT NULL,
  correlation_id TEXT NULL,
  provider_support TEXT NULL,
  key_grant TEXT NULL,
  verification_state TEXT NULL,
  operational_state TEXT NULL,
  last_failure_code TEXT NULL,
  sanitized_reason TEXT NULL,
  source_of_evidence TEXT NULL,
  latency_ms INTEGER NULL,
  tested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT mexc_cap_verif_no_balance_payload CHECK (
    sanitized_reason IS NULL OR char_length(sanitized_reason) <= 500
  )
);

CREATE INDEX IF NOT EXISTS idx_mexc_cap_verif_owner_tested
  ON mexc_capability_verifications (owner_id, tested_at DESC);

CREATE INDEX IF NOT EXISTS idx_mexc_cap_verif_connection
  ON mexc_capability_verifications (connection_id);

CREATE INDEX IF NOT EXISTS idx_mexc_cap_verif_correlation
  ON mexc_capability_verifications (correlation_id);

CREATE TABLE IF NOT EXISTS mexc_connection_consumer_bindings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES exchange_connections(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  consumer_id TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  notes TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT mexc_consumer_bind_unique UNIQUE (connection_id, consumer_id)
);

CREATE INDEX IF NOT EXISTS idx_mexc_consumer_bind_owner
  ON mexc_connection_consumer_bindings (owner_id);

COMMENT ON TABLE mexc_connection_capability_state IS
  'Canonical per-capability state for MEXC Connections. No secrets or balances.';
COMMENT ON TABLE mexc_capability_verifications IS
  'Safe verification history. Stores sanitized metadata only.';
COMMENT ON TABLE mexc_connection_consumer_bindings IS
  'Optional user-level consumer enablement bindings for MEXC connection.';

COMMIT;

-- Rollback plan (manual):
-- BEGIN;
-- DROP TABLE IF EXISTS mexc_connection_consumer_bindings;
-- DROP TABLE IF EXISTS mexc_capability_verifications;
-- DROP TABLE IF EXISTS mexc_connection_capability_state;
-- COMMIT;
