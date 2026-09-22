-- Artemis S8-OBSERVED-OUTCOME-SOT — append-only Observed Outcome envelope store
-- Additive only. Does NOT alter market_snapshots, collected_data, ai_decisions,
-- system_logs, artemis_decisions (B10), artemis_market_context_observations,
-- or Data Hub tables.
-- Fail-closed: CREATE TABLE (no IF NOT EXISTS).
-- Transaction ownership: node-pg-migrate (no manual BEGIN/COMMIT).
-- DO NOT execute against live DB until Owner explicitly authorizes.
-- No server-clock timestamps — all times come from validated Outcome artifact.
-- Outcome Evaluation / realized PnL columns are intentionally absent.

CREATE TABLE artemis_observed_outcomes (
  outcome_id UUID PRIMARY KEY,
  payload_sha256 TEXT NOT NULL,

  decision_id UUID NOT NULL,
  decision_context_id UUID NOT NULL,
  shadow_recording_artifact_id UUID NOT NULL,
  market_context_id UUID NOT NULL,

  outcome_observed_at TIMESTAMPTZ NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL,
  source_timestamp TIMESTAMPTZ NOT NULL,

  venue TEXT NOT NULL,
  market_type TEXT NOT NULL,
  symbol TEXT NOT NULL,
  timeframe TEXT NOT NULL,

  task_id UUID NULL,
  binding_id UUID NULL,
  shadow_cycle_envelope_id UUID NULL,
  correlation_id UUID NULL,

  writer TEXT NOT NULL,
  method_key TEXT NOT NULL,
  stage TEXT NOT NULL,
  policy_version TEXT NOT NULL,
  schema_version TEXT NOT NULL,
  contract_version TEXT NOT NULL,
  validation_contract_version TEXT NOT NULL,
  implementation_version TEXT NULL,

  durable_payload JSONB NOT NULL,

  decision_eligible BOOLEAN NOT NULL,
  execution_eligible BOOLEAN NOT NULL,
  approved_for_execution BOOLEAN NOT NULL,
  live_trading_enabled BOOLEAN NOT NULL,
  paper_trading_enabled BOOLEAN NOT NULL,
  provider_connected BOOLEAN NOT NULL,
  shadow_runtime_activated BOOLEAN NOT NULL,
  persistence_enabled BOOLEAN NOT NULL,
  b10_write_attempted BOOLEAN NOT NULL,

  CONSTRAINT artemis_oo_payload_sha256_chk
    CHECK (payload_sha256 ~ '^[0-9a-f]{64}$'),
  CONSTRAINT artemis_oo_writer_nonempty_chk
    CHECK (btrim(writer) <> ''),
  CONSTRAINT artemis_oo_payload_object_chk
    CHECK (jsonb_typeof(durable_payload) = 'object'),
  CONSTRAINT artemis_oo_decision_eligible_false_chk
    CHECK (decision_eligible IS FALSE),
  CONSTRAINT artemis_oo_execution_eligible_false_chk
    CHECK (execution_eligible IS FALSE),
  CONSTRAINT artemis_oo_approved_for_execution_false_chk
    CHECK (approved_for_execution IS FALSE),
  CONSTRAINT artemis_oo_live_trading_false_chk
    CHECK (live_trading_enabled IS FALSE),
  CONSTRAINT artemis_oo_paper_trading_false_chk
    CHECK (paper_trading_enabled IS FALSE),
  CONSTRAINT artemis_oo_provider_connected_false_chk
    CHECK (provider_connected IS FALSE),
  CONSTRAINT artemis_oo_shadow_runtime_false_chk
    CHECK (shadow_runtime_activated IS FALSE),
  CONSTRAINT artemis_oo_persistence_enabled_false_chk
    CHECK (persistence_enabled IS FALSE),
  CONSTRAINT artemis_oo_b10_write_false_chk
    CHECK (b10_write_attempted IS FALSE),
  CONSTRAINT artemis_oo_observed_vs_recorded_chk
    CHECK (outcome_observed_at <= recorded_at),
  CONSTRAINT artemis_oo_source_vs_observed_chk
    CHECK (source_timestamp <= outcome_observed_at)
);

-- Idempotency / conflict: same outcome_id cannot coexist with different payloads
-- (PRIMARY KEY already enforces single identity). payload_sha256 is stored for
-- application-level identical vs conflict comparison on insert attempts.

CREATE UNIQUE INDEX uq_artemis_oo_identity_payload
  ON artemis_observed_outcomes (outcome_id, payload_sha256);

CREATE INDEX idx_artemis_oo_decision_id
  ON artemis_observed_outcomes (decision_id);

CREATE INDEX idx_artemis_oo_decision_context_id
  ON artemis_observed_outcomes (decision_context_id);

CREATE INDEX idx_artemis_oo_market_context_id
  ON artemis_observed_outcomes (market_context_id);

CREATE INDEX idx_artemis_oo_shadow_recording_id
  ON artemis_observed_outcomes (shadow_recording_artifact_id);

CREATE INDEX idx_artemis_oo_symbol_observed_at
  ON artemis_observed_outcomes (symbol, outcome_observed_at DESC);
