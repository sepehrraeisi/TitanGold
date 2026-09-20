-- Artemis S8-MC-SOT — append-only Market Context observation envelope store
-- Additive only. Does NOT alter market_snapshots, collected_data, ai_decisions,
-- system_logs, artemis_decisions (B10), or Data Hub tables.
-- Fail-closed: CREATE TABLE (no IF NOT EXISTS).
-- Transaction ownership: node-pg-migrate (no manual BEGIN/COMMIT).
-- DO NOT execute against live DB until Owner explicitly authorizes.
-- No server-clock timestamps — all times come from attested envelope.
-- Envelope metadata only — raw market series storage is forbidden.

CREATE TABLE artemis_market_context_observations (
  observation_row_id UUID PRIMARY KEY,
  uniqueness_key TEXT NOT NULL,
  envelope_sha256 TEXT NOT NULL,
  market_context_id UUID NOT NULL,

  venue TEXT NOT NULL,
  market_type TEXT NOT NULL,
  symbol TEXT NOT NULL,
  base_asset TEXT NOT NULL,
  quote_asset TEXT NOT NULL,
  timeframe TEXT NOT NULL,
  horizon TEXT NULL,

  source_timestamp TIMESTAMPTZ NOT NULL,
  ingestion_timestamp TIMESTAMPTZ NOT NULL,
  freshness_status TEXT NOT NULL,
  expiry_timestamp TIMESTAMPTZ NULL,
  availability TEXT NOT NULL,
  source_class TEXT NOT NULL,
  correlation_family TEXT NOT NULL,

  writer TEXT NOT NULL,
  method_key TEXT NOT NULL,
  stage TEXT NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL,
  policy_version TEXT NOT NULL,
  schema_version TEXT NOT NULL,
  contract_version TEXT NOT NULL,
  implementation_version TEXT NULL,
  note TEXT NULL,

  durable_payload JSONB NOT NULL,

  decision_eligible BOOLEAN NOT NULL,
  execution_eligible BOOLEAN NOT NULL,
  approved_for_execution BOOLEAN NOT NULL,
  live_trading_enabled BOOLEAN NOT NULL,
  paper_trading_enabled BOOLEAN NOT NULL,
  provider_connected BOOLEAN NOT NULL,

  CONSTRAINT artemis_mc_obs_envelope_sha256_chk
    CHECK (envelope_sha256 ~ '^[0-9a-f]{64}$'),
  CONSTRAINT artemis_mc_obs_uniqueness_key_nonempty_chk
    CHECK (btrim(uniqueness_key) <> ''),
  CONSTRAINT artemis_mc_obs_writer_nonempty_chk
    CHECK (btrim(writer) <> ''),
  CONSTRAINT artemis_mc_obs_payload_object_chk
    CHECK (jsonb_typeof(durable_payload) = 'object'),
  CONSTRAINT artemis_mc_obs_freshness_usable_chk
    CHECK (freshness_status IN ('fresh', 'aged')),
  CONSTRAINT artemis_mc_obs_decision_eligible_false_chk
    CHECK (decision_eligible IS FALSE),
  CONSTRAINT artemis_mc_obs_execution_eligible_false_chk
    CHECK (execution_eligible IS FALSE),
  CONSTRAINT artemis_mc_obs_approved_for_execution_false_chk
    CHECK (approved_for_execution IS FALSE),
  CONSTRAINT artemis_mc_obs_live_trading_false_chk
    CHECK (live_trading_enabled IS FALSE),
  CONSTRAINT artemis_mc_obs_paper_trading_false_chk
    CHECK (paper_trading_enabled IS FALSE),
  CONSTRAINT artemis_mc_obs_provider_connected_false_chk
    CHECK (provider_connected IS FALSE),
  CONSTRAINT artemis_mc_obs_source_vs_ingest_chk
    CHECK (source_timestamp <= ingestion_timestamp)
);

-- Owner-locked uniqueness: venue + marketType + symbol + timeframe + sourceTimestamp + sourceClass
CREATE UNIQUE INDEX uq_artemis_mc_obs_identity
  ON artemis_market_context_observations (
    venue,
    market_type,
    symbol,
    timeframe,
    source_timestamp,
    source_class
  );

CREATE INDEX idx_artemis_mc_obs_market_context_id
  ON artemis_market_context_observations (market_context_id);

CREATE INDEX idx_artemis_mc_obs_symbol_source_ts
  ON artemis_market_context_observations (symbol, source_timestamp DESC);
