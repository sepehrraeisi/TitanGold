/**
 * Artemis Core Stage 4 — read-only evidence ingestion disposition contract.
 *
 * Does not replace Stage 2 schema (artemisEvidenceContract) or Stage 3 adapters.
 * Does not admit evidence into a Decision Context (that remains WP-C.1 / later stages).
 * UNAVAILABLE / BLOCKED / NOT_APPLICABLE / STALE are never treated as NEUTRAL votes.
 */

export const INGESTION_STAGE = 4;
export const INGESTION_CONTRACT_VERSION = 'artemis-evidence-ingestion-1.0.0';
export const INGESTION_WRITER = 'artemisEvidenceIngestionService';

export const INGESTION_DISPOSITION = Object.freeze({
  ACCEPTED: 'ACCEPTED',
  REJECTED_INVALID: 'REJECTED_INVALID',
  REJECTED_IDENTITY: 'REJECTED_IDENTITY',
  REJECTED_STALE: 'REJECTED_STALE',
  REJECTED_EXPIRED: 'REJECTED_EXPIRED',
  REJECTED_CONTEXT: 'REJECTED_CONTEXT',
  UNAVAILABLE: 'UNAVAILABLE',
  BLOCKED: 'BLOCKED',
  NOT_APPLICABLE: 'NOT_APPLICABLE',
});

export const INGESTION_REASON = Object.freeze({
  VALID_CURRENT_EVIDENCE: 'valid_current_evidence',
  VALID_CONTROL_EVIDENCE: 'valid_control_evidence',
  VALID_METADATA_ONLY: 'valid_metadata_only',
  MISSING_SOURCE: 'missing_source',
  UNKNOWN_AGENT: 'unknown_agent',
  LEGACY_AGENT_N: 'legacy_agent_n',
  INVALID_IDENTITY: 'invalid_identity',
  ADAPTER_FAILED: 'adapter_failed',
  MISSING_TIMESTAMP: 'missing_timestamp',
  MALFORMED_TIMESTAMP: 'malformed_timestamp',
  INVALID_SCHEMA: 'invalid_schema',
  FORBIDDEN_FIELD: 'forbidden_field',
  AUTHORITY_MISMATCH: 'authority_mismatch',
  FORBIDDEN_EXECUTION_CLAIM: 'forbidden_execution_claim',
  INVALID_CORRELATION_FAMILY: 'invalid_correlation_family',
  OWNERSHIP_SCOPE_MISMATCH: 'ownership_scope_mismatch',
  CONTEXT_INCOMPATIBLE: 'context_incompatible',
  STALE: 'stale_not_current',
  EXPIRED: 'expired_not_current',
  FRESHNESS_UNKNOWN: 'freshness_unknown_fail_closed',
  DATA_QUALITY_BLOCKED: 'data_quality_blocked',
  UNAVAILABLE: 'unavailable',
  NOT_RUN: 'not_run',
  PROVIDER_UNAVAILABLE: 'provider_unavailable',
  CONTRACT_ERROR: 'contract_error',
  BLOCKED: 'blocked',
  NOT_APPLICABLE: 'not_applicable',
  MOCK_OR_PLACEHOLDER: 'mock_or_placeholder_source',
});

export const PERSISTENCE_MODEL = Object.freeze({
  CANONICAL_PERSISTED: 'canonical_persisted',
  LEGACY_RECONSTRUCTED: 'legacy_reconstructed',
});

export const OWNERSHIP_SCOPE = Object.freeze({
  GLOBAL: 'global',
  USER: 'user',
  MIXED: 'mixed',
});

export const MAX_INGEST_BATCH = 50;
export const DEFAULT_INGEST_BATCH = 20;

export const ZERO_SIDE_EFFECTS = Object.freeze({
  dbWrites: 0,
  redisWrites: 0,
  agentExecutions: 0,
  providerRequests: 0,
  orderOperations: 0,
  financialExecutions: 0,
});

export function isIngestionDisposition(value) {
  return Object.values(INGESTION_DISPOSITION).includes(value);
}

export default {
  INGESTION_STAGE,
  INGESTION_CONTRACT_VERSION,
  INGESTION_WRITER,
  INGESTION_DISPOSITION,
  INGESTION_REASON,
  PERSISTENCE_MODEL,
  OWNERSHIP_SCOPE,
  MAX_INGEST_BATCH,
  DEFAULT_INGEST_BATCH,
  ZERO_SIDE_EFFECTS,
  isIngestionDisposition,
};
