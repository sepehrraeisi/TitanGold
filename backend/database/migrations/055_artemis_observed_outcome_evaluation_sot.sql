-- Artemis S8-OBSERVED-OUTCOME-EVALUATION-SOT — append-only Evaluation envelope store
-- Additive only. Does NOT alter market_snapshots, collected_data, ai_decisions,
-- system_logs, artemis_decisions (B10), artemis_market_context_observations,
-- artemis_observed_outcomes, or Data Hub tables.
-- Fail-closed: CREATE TABLE (no IF NOT EXISTS).
-- Transaction ownership: node-pg-migrate (no manual BEGIN/COMMIT).
-- DO NOT execute against live DB until Owner explicitly authorizes.
-- No server-clock timestamps — all times come from validated Evaluation artifact.
-- Replay / Calibration / realized PnL columns are intentionally absent.
-- This SoT stores already-validated Evaluation artifacts only; it does not
-- perform evaluation logic.

CREATE TABLE artemis_observed_outcome_evaluations (
  evaluation_id UUID PRIMARY KEY,
  payload_sha256 TEXT NOT NULL,

  decision_id UUID NOT NULL,
  outcome_id UUID NOT NULL,
  decision_context_id UUID NOT NULL,
  shadow_recording_artifact_id UUID NOT NULL,
  market_context_id UUID NOT NULL,

  task_id UUID NULL,
  binding_id UUID NULL,
  shadow_cycle_envelope_id UUID NULL,

  evaluation_status TEXT NOT NULL,
  observation_class TEXT NOT NULL,

  decision_timestamp TIMESTAMPTZ NULL,
  outcome_observed_at TIMESTAMPTZ NULL,
  evaluated_at TIMESTAMPTZ NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL,

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
  evaluation_persisted BOOLEAN NOT NULL,
  evaluation_runtime_activated BOOLEAN NOT NULL,
  worker_activated BOOLEAN NOT NULL,
  scheduler_activated BOOLEAN NOT NULL,

  CONSTRAINT artemis_ooe_payload_sha256_chk
    CHECK (payload_sha256 ~ '^[0-9a-f]{64}$'),
  CONSTRAINT artemis_ooe_writer_nonempty_chk
    CHECK (btrim(writer) <> ''),
  CONSTRAINT artemis_ooe_payload_object_chk
    CHECK (jsonb_typeof(durable_payload) = 'object'),
  CONSTRAINT artemis_ooe_evaluation_status_chk
    CHECK (evaluation_status IN (
      'MATCH',
      'MISMATCH',
      'INSUFFICIENT_DATA',
      'BLOCKED',
      'UNAVAILABLE'
    )),
  CONSTRAINT artemis_ooe_decision_eligible_false_chk
    CHECK (decision_eligible IS FALSE),
  CONSTRAINT artemis_ooe_execution_eligible_false_chk
    CHECK (execution_eligible IS FALSE),
  CONSTRAINT artemis_ooe_approved_for_execution_false_chk
    CHECK (approved_for_execution IS FALSE),
  CONSTRAINT artemis_ooe_live_trading_false_chk
    CHECK (live_trading_enabled IS FALSE),
  CONSTRAINT artemis_ooe_paper_trading_false_chk
    CHECK (paper_trading_enabled IS FALSE),
  CONSTRAINT artemis_ooe_provider_connected_false_chk
    CHECK (provider_connected IS FALSE),
  CONSTRAINT artemis_ooe_shadow_runtime_false_chk
    CHECK (shadow_runtime_activated IS FALSE),
  CONSTRAINT artemis_ooe_persistence_enabled_false_chk
    CHECK (persistence_enabled IS FALSE),
  CONSTRAINT artemis_ooe_b10_write_false_chk
    CHECK (b10_write_attempted IS FALSE),
  CONSTRAINT artemis_ooe_evaluation_persisted_false_chk
    CHECK (evaluation_persisted IS FALSE),
  CONSTRAINT artemis_ooe_evaluation_runtime_false_chk
    CHECK (evaluation_runtime_activated IS FALSE),
  CONSTRAINT artemis_ooe_worker_activated_false_chk
    CHECK (worker_activated IS FALSE),
  CONSTRAINT artemis_ooe_scheduler_activated_false_chk
    CHECK (scheduler_activated IS FALSE),
  CONSTRAINT artemis_ooe_evaluated_vs_recorded_chk
    CHECK (evaluated_at <= recorded_at)
);

-- Idempotency / conflict: same evaluation_id cannot coexist with different
-- payloads (PRIMARY KEY already enforces identity). payload_sha256 is stored
-- for application-level identical vs conflict comparison on insert attempts.

CREATE UNIQUE INDEX uq_artemis_ooe_identity_payload
  ON artemis_observed_outcome_evaluations (evaluation_id, payload_sha256);

CREATE INDEX idx_artemis_ooe_decision_id
  ON artemis_observed_outcome_evaluations (decision_id);

CREATE INDEX idx_artemis_ooe_outcome_id
  ON artemis_observed_outcome_evaluations (outcome_id);

CREATE INDEX idx_artemis_ooe_decision_context_id
  ON artemis_observed_outcome_evaluations (decision_context_id);

CREATE INDEX idx_artemis_ooe_shadow_recording_id
  ON artemis_observed_outcome_evaluations (shadow_recording_artifact_id);

CREATE INDEX idx_artemis_ooe_evaluated_at
  ON artemis_observed_outcome_evaluations (evaluated_at DESC);

CREATE INDEX idx_artemis_ooe_evaluation_status
  ON artemis_observed_outcome_evaluations (evaluation_status);
