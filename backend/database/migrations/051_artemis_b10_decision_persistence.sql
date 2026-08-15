-- Artemis B10 — append-only Decision persistence (OPTION C)
-- Additive only. Does NOT alter ai_decisions or system_logs.
-- Fail-closed: CREATE TABLE (no IF NOT EXISTS).
-- Transaction ownership: node-pg-migrate (no manual BEGIN/COMMIT).
-- DO NOT execute against live DB until Owner explicitly authorizes.

CREATE TABLE artemis_decisions (
  decision_id UUID PRIMARY KEY,
  decision_context_id UUID NOT NULL,
  schema_version TEXT NOT NULL,
  contract_version TEXT NOT NULL,
  policy_version TEXT NULL,
  implementation_version TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  analysis_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NULL,
  symbol TEXT NULL,
  venue TEXT NULL,
  market_type TEXT NULL,
  timeframe TEXT NULL,
  analysis_horizon TEXT NULL,
  synthesis_outcome TEXT NOT NULL,
  observed_direction TEXT NULL,
  conflict_state TEXT NULL,
  classification TEXT NOT NULL,
  maturity_stage TEXT NOT NULL,
  decision_eligible BOOLEAN NOT NULL,
  execution_eligible BOOLEAN NOT NULL,
  decision_payload JSONB NOT NULL,
  payload_sha256 TEXT NOT NULL,
  payload_bytes INTEGER NOT NULL,
  canonicalization_version TEXT NOT NULL,
  persisted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  writer TEXT NOT NULL,
  CONSTRAINT artemis_decisions_payload_bytes_chk
    CHECK (payload_bytes > 0 AND payload_bytes <= 16384),
  CONSTRAINT artemis_decisions_payload_sha256_chk
    CHECK (payload_sha256 ~ '^[0-9a-f]{64}$'),
  CONSTRAINT artemis_decisions_canonicalization_version_chk
    CHECK (btrim(canonicalization_version) <> ''),
  CONSTRAINT artemis_decisions_writer_nonempty_chk
    CHECK (btrim(writer) <> ''),
  CONSTRAINT artemis_decisions_decision_eligible_false_chk
    CHECK (decision_eligible IS FALSE),
  CONSTRAINT artemis_decisions_execution_eligible_false_chk
    CHECK (execution_eligible IS FALSE),
  CONSTRAINT artemis_decisions_payload_object_chk
    CHECK (jsonb_typeof(decision_payload) = 'object')
);

CREATE INDEX idx_artemis_decisions_context_created
  ON artemis_decisions (decision_context_id, created_at DESC);

CREATE INDEX idx_artemis_decisions_symbol_created
  ON artemis_decisions (symbol, created_at DESC)
  WHERE symbol IS NOT NULL;

CREATE TABLE artemis_decision_evidence_refs (
  decision_id UUID NOT NULL
    REFERENCES artemis_decisions (decision_id) ON DELETE RESTRICT,
  ordinal INTEGER NOT NULL,
  agent_id TEXT NOT NULL,
  run_id UUID NULL,
  agent_record_id UUID NULL,
  evidence_contract_version TEXT NOT NULL,
  role TEXT NULL,
  authority_class TEXT NULL,
  correlation_family TEXT NULL,
  freshness TEXT NULL,
  availability TEXT NULL,
  admission_state TEXT NULL,
  admission_reason TEXT NULL,
  confirmation_semantics TEXT NULL,
  symbol TEXT NULL,
  venue TEXT NULL,
  market_type TEXT NULL,
  timeframe TEXT NULL,
  analysis_horizon TEXT NULL,
  analysis_timestamp TIMESTAMPTZ NULL,
  ref_payload JSONB NOT NULL,
  PRIMARY KEY (decision_id, ordinal),
  CONSTRAINT artemis_decision_evidence_refs_ordinal_chk
    CHECK (ordinal >= 0 AND ordinal < 32),
  CONSTRAINT artemis_decision_evidence_refs_agent_nonempty_chk
    CHECK (btrim(agent_id) <> ''),
  CONSTRAINT artemis_decision_evidence_refs_payload_object_chk
    CHECK (jsonb_typeof(ref_payload) = 'object')
);

CREATE INDEX idx_artemis_decision_evidence_refs_agent_run
  ON artemis_decision_evidence_refs (agent_id, run_id);

COMMENT ON TABLE artemis_decisions IS
  'B10 append-only ArtemisDecision store. decision_payload JSONB is canonical SoT. Never reuse ai_decisions.';
COMMENT ON TABLE artemis_decision_evidence_refs IS
  'B10 normalized Decision-safe evidence refs with deterministic ordinal. FK RESTRICT to artemis_decisions.';
COMMENT ON COLUMN artemis_decisions.decision_payload IS
  'Exact validated canonical ArtemisDecision. Authority over projection columns.';
COMMENT ON COLUMN artemis_decisions.payload_sha256 IS
  'Lowercase SHA-256 hex of deterministic canonical UTF-8 JSON bytes of decision_payload content.';
COMMENT ON COLUMN artemis_decisions.canonicalization_version IS
  'TitanGold-owned canonicalization algorithm id, e.g. titangold-json-c14n-1.';

-- Rollback plan (manual / DESTRUCTIVE — OWNER AUTHORIZATION REQUIRED):
-- DROP TABLE IF EXISTS artemis_decision_evidence_refs;
-- DROP TABLE IF EXISTS artemis_decisions;
-- Preferred operational rollback: disable B10 writer and preserve rows.
