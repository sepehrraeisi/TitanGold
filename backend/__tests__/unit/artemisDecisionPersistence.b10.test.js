/**
 * @jest-environment node
 *
 * Artemis B10 — persistence service unit tests (mocked DB; no live DB).
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
  CONFLICT_STATE,
  CONFIRMATION_SEMANTICS,
  DIRECTION_OR_ABSTAIN,
  EVIDENCE_ADMISSION_STATE,
  LIQUIDITY_STATUS,
  RISK_STATUS,
  SYNTHESIS_OUTCOME,
  buildContractOnlyArtemisDecision,
} from '../../contracts/artemisDecisionContract.js';
import {
  AUTHORITY_CLASS,
  CONTRACT_VERSION as EVIDENCE_CONTRACT_VERSION,
  CORRELATION_FAMILY,
} from '../../contracts/artemisEvidenceContract.js';
import { ADMISSION_REASON } from '../../services/artemisEvidenceAdmissionService.js';
import {
  CANONICALIZATION_VERSION,
  buildCanonicalDecisionPayload,
} from '../../services/artemisDecisionCanonicalJson.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATION_PATH = join(
  __dirname,
  '../../database/migrations/051_artemis_b10_decision_persistence.sql',
);

const DECISION_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const CONTEXT_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const TREND_RUN = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

const mockQuery = jest.fn();
const mockTransaction = jest.fn();

jest.unstable_mockModule('../../database/db.js', () => ({
  query: mockQuery,
  transaction: mockTransaction,
}));

const {
  persistArtemisDecision,
  getDecisionById,
  listDecisionsByContextId,
  listEvidenceRefs,
  verifyStoredDecisionRow,
  projectUuidOrNull,
  projectTimestampOrNull,
  PERSIST_STATUS,
  PERSIST_ERROR,
} = await import('../../services/artemisDecisionPersistenceService.js');

function sampleDecision(overrides = {}) {
  return buildContractOnlyArtemisDecision({
    decisionId: DECISION_ID,
    decisionContextId: CONTEXT_ID,
    createdAt: '2026-08-10T12:10:00.000Z',
    analysisAt: '2026-08-10T12:00:00.000Z',
    symbol: 'BTC/USDT',
    venue: 'mexc',
    marketType: 'spot',
    timeframe: '1h',
    evidenceRefs: [
      {
        agentId: 'trend',
        runId: TREND_RUN,
        evidenceContractVersion: EVIDENCE_CONTRACT_VERSION,
        role: AUTHORITY_CLASS.ANALYTICAL_EVIDENCE,
        authorityClass: AUTHORITY_CLASS.ANALYTICAL_EVIDENCE,
        correlationFamily: CORRELATION_FAMILY.OHLCV_CANDLE,
        freshness: 'fresh',
        availability: 'available',
        admissionState: EVIDENCE_ADMISSION_STATE.ADMITTED,
        admissionReason: ADMISSION_REASON.VALID_ANALYTICAL_EVIDENCE,
        confirmationSemantics: CONFIRMATION_SEMANTICS.DIRECTIONAL_CANDIDATE,
      },
    ],
    synthesisOutcome: SYNTHESIS_OUTCOME.UNSPECIFIED,
    direction: DIRECTION_OR_ABSTAIN.UNAVAILABLE,
    conflictState: CONFLICT_STATE.NONE,
    riskStatus: RISK_STATUS.UNAVAILABLE,
    liquidityStatus: LIQUIDITY_STATUS.UNAVAILABLE,
    ...overrides,
  });
}

function collectSql(calls) {
  return calls.map((args) => String(args[0]));
}

function durableRowFromDecision(decision, extras = {}) {
  const canonical = buildCanonicalDecisionPayload(decision);
  return {
    decision_id: projectUuidOrNull(decision.decisionId),
    decision_context_id: projectUuidOrNull(decision.decisionContextId),
    schema_version: decision.schemaVersion,
    contract_version: decision.contractVersion,
    policy_version: decision.policyVersion,
    implementation_version: decision.implementationVersion,
    created_at: decision.createdAt,
    analysis_at: decision.analysisAt,
    expires_at: decision.expiresAt ?? null,
    symbol: decision.symbol ?? null,
    venue: decision.venue ?? null,
    market_type: decision.marketType ?? null,
    timeframe: decision.timeframe ?? null,
    analysis_horizon: decision.analysisHorizon ?? null,
    synthesis_outcome: decision.synthesisOutcome,
    observed_direction: decision.direction ?? null,
    conflict_state: decision.conflictState ?? null,
    classification: decision.classification,
    maturity_stage: decision.maturityStage,
    decision_eligible: false,
    execution_eligible: false,
    decision_payload: canonical.canonicalObject,
    payload_sha256: canonical.payloadSha256,
    payload_bytes: canonical.payloadBytes,
    canonicalization_version: CANONICALIZATION_VERSION,
    persisted_at: '2026-08-10T12:11:00.000Z',
    writer: 'b10-unit-test',
    ...extras,
  };
}

beforeEach(() => {
  mockQuery.mockReset();
  mockTransaction.mockReset();
  mockTransaction.mockImplementation(async (fn) => {
    const client = { query: jest.fn(async () => ({ rows: [], rowCount: 1 })) };
    return fn(client);
  });
});

describe('B10 migration SQL (static; not executed)', () => {
  const sql = readFileSync(MIGRATION_PATH, 'utf8');

  it('uses fail-closed CREATE TABLE without IF NOT EXISTS', () => {
    expect(sql).toMatch(/CREATE TABLE artemis_decisions/);
    expect(sql).toMatch(/CREATE TABLE artemis_decision_evidence_refs/);
    expect(sql).not.toMatch(/CREATE TABLE IF NOT EXISTS/);
    expect(sql).not.toMatch(/CREATE INDEX IF NOT EXISTS/);
  });

  it('includes hardened checks and FK RESTRICT', () => {
    expect(sql).toMatch(/canonicalization_version TEXT NOT NULL/);
    expect(sql).toMatch(/payload_sha256 ~ '\^\[0-9a-f\]\{64\}\$'/);
    expect(sql).toMatch(/btrim\(writer\) <> ''/);
    expect(sql).toMatch(/decision_eligible IS FALSE/);
    expect(sql).toMatch(/execution_eligible IS FALSE/);
    expect(sql).toMatch(/jsonb_typeof\(decision_payload\) = 'object'/);
    expect(sql).toMatch(/jsonb_typeof\(ref_payload\) = 'object'/);
    expect(sql).toMatch(/ON DELETE RESTRICT/);
    expect(sql).not.toMatch(/^BEGIN;/m);
    expect(sql).not.toMatch(/^COMMIT;/m);
    expect(sql).not.toMatch(/^\s*DROP /m);
  });

  it('does not alter ai_decisions or system_logs', () => {
    expect(sql.toLowerCase()).not.toMatch(/alter\s+table\s+ai_decisions/);
    expect(sql.toLowerCase()).not.toMatch(/alter\s+table\s+system_logs/);
    expect(sql).not.toMatch(/REFERENCES\s+ai_decisions/i);
  });
});

describe('projection helpers', () => {
  it('projects unavailable UUID/timestamp to NULL', () => {
    expect(projectUuidOrNull('unavailable')).toBeNull();
    expect(projectUuidOrNull({ availability: 'unavailable' })).toBeNull();
    expect(projectUuidOrNull(TREND_RUN)).toBe(TREND_RUN);
    expect(projectTimestampOrNull({ availability: 'unavailable' })).toBeNull();
    expect(projectTimestampOrNull('2026-08-10T12:00:00.000Z')).toBe('2026-08-10T12:00:00.000Z');
  });

  it('normalizes UUID projections to lowercase trimmed form', () => {
    expect(projectUuidOrNull(TREND_RUN.toUpperCase())).toBe(TREND_RUN);
    expect(projectUuidOrNull(`  ${TREND_RUN}  `)).toBe(TREND_RUN);
    expect(projectUuidOrNull(`  ${TREND_RUN.toUpperCase()}  `)).toBe(TREND_RUN);
  });
});

describe('persistArtemisDecision', () => {
  it('inserts canonicalization_version and projects from canonicalObject', async () => {
    const decision = sampleDecision({
      expiresAt: { availability: 'unavailable', reasonKey: 'none' },
      evidenceRefs: [{
        agentId: 'trend',
        runId: 'unavailable',
        agentRecordId: { availability: 'unavailable', reasonKey: 'missing_run' },
        evidenceContractVersion: EVIDENCE_CONTRACT_VERSION,
        role: AUTHORITY_CLASS.ANALYTICAL_EVIDENCE,
        authorityClass: AUTHORITY_CLASS.ANALYTICAL_EVIDENCE,
        correlationFamily: CORRELATION_FAMILY.OHLCV_CANDLE,
        freshness: { availability: 'unavailable', reasonKey: 'freshness_unknown' },
        availability: 'available',
        admissionState: EVIDENCE_ADMISSION_STATE.ADMITTED_NON_CONFIRMING,
        admissionReason: ADMISSION_REASON.FRESHNESS_UNKNOWN,
        confirmationSemantics: CONFIRMATION_SEMANTICS.NON_CONFIRMING,
        analysisTimestamp: { availability: 'unavailable', reasonKey: 'no_ts' },
      }],
    });

    const clientQueries = [];
    mockTransaction.mockImplementation(async (fn) => {
      const client = {
        query: jest.fn(async (sql, params) => {
          clientQueries.push({ sql, params });
          return { rows: [], rowCount: 1 };
        }),
      };
      return fn(client);
    });

    const result = await persistArtemisDecision(decision, { writer: 'b10-unit-test' });
    expect(result.ok).toBe(true);
    expect(result.status).toBe(PERSIST_STATUS.PERSISTED);
    expect(result.canonicalizationVersion).toBe(CANONICALIZATION_VERSION);

    const parentParams = clientQueries[0].params;
    expect(parentParams[24]).toBe(CANONICALIZATION_VERSION);
    expect(parentParams[8]).toBeNull(); // expires_at projection
    expect(parentParams[19]).toBe(false);
    expect(parentParams[20]).toBe(false);

    const refParams = clientQueries[1].params;
    expect(refParams[3]).toBeNull(); // run_id
    expect(refParams[4]).toBeNull(); // agent_record_id
    expect(refParams[9]).toBeNull(); // freshness column
    expect(refParams[19]).toBeNull(); // analysis_timestamp
    const refPayload = JSON.parse(refParams[20]);
    expect(refPayload.runId).toBe('unavailable');
    expect(refPayload.agentRecordId).toEqual({ availability: 'unavailable', reasonKey: 'missing_run' });
    expect(refPayload.analysisTimestamp).toEqual({ availability: 'unavailable', reasonKey: 'no_ts' });
  });

  it('same decision_id + same hash => ALREADY after verifying stored row', async () => {
    const decision = sampleDecision();
    const canonical = buildCanonicalDecisionPayload(decision);
    mockTransaction.mockRejectedValueOnce(Object.assign(new Error('dup'), { code: '23505' }));
    mockQuery.mockResolvedValueOnce({ rows: [durableRowFromDecision(decision)] });

    const result = await persistArtemisDecision(decision, { writer: 'b10-unit-test' });
    expect(result.ok).toBe(true);
    expect(result.status).toBe(PERSIST_STATUS.ALREADY_PERSISTED);
    expect(result.payloadSha256).toBe(canonical.payloadSha256);
    expect(result.decision.decisionId).toBe(DECISION_ID);
  });

  it('corrupted existing row cannot return ALREADY', async () => {
    const decision = sampleDecision();
    mockTransaction.mockRejectedValueOnce(Object.assign(new Error('dup'), { code: '23505' }));
    mockQuery.mockResolvedValueOnce({
      rows: [durableRowFromDecision(decision, { payload_sha256: '0'.repeat(64) })],
    });
    const result = await persistArtemisDecision(decision, { writer: 'b10-unit-test' });
    expect(result.ok).toBe(false);
    expect(result.code).toBe(PERSIST_ERROR.INTEGRITY_FAILED);
  });

  it('same decision_id + different hash => CONFLICT after integrity', async () => {
    const decision = sampleDecision();
    const other = sampleDecision({ timeframe: '4h' });
    mockTransaction.mockRejectedValueOnce(Object.assign(new Error('dup'), { code: '23505' }));
    mockQuery.mockResolvedValueOnce({ rows: [durableRowFromDecision(other)] });
    const result = await persistArtemisDecision(decision, { writer: 'b10-unit-test' });
    expect(result.ok).toBe(false);
    expect(result.code).toBe(PERSIST_ERROR.DECISION_ID_CONFLICT);
  });

  it('validation failure produces zero writes', async () => {
    const bad = sampleDecision();
    bad.decisionEligible = true;
    const result = await persistArtemisDecision(bad, { writer: 'b10-unit-test' });
    expect(result.ok).toBe(false);
    expect(result.code).toBe(PERSIST_ERROR.VALIDATION_FAILED);
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it('canonicalization failure for BigInt returns CANONICALIZATION_FAILED with zero writes', async () => {
    const decision = sampleDecision();
    const exotic = { ...decision, analysisHorizon: 1n };
    const result = await persistArtemisDecision(exotic, { writer: 'b10-unit-test' });
    expect(result.ok).toBe(false);
    expect(result.code).toBe(PERSIST_ERROR.CANONICALIZATION_FAILED);
    expect(mockTransaction).not.toHaveBeenCalled();
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('canonicalization failure for circular input returns CANONICALIZATION_FAILED with zero writes', async () => {
    const decision = sampleDecision();
    decision._cycle = decision;
    const result = await persistArtemisDecision(decision, { writer: 'b10-unit-test' });
    expect(result.ok).toBe(false);
    expect(result.code).toBe(PERSIST_ERROR.CANONICALIZATION_FAILED);
    expect(result.codeDetail).toBe('CIRCULAR_REFERENCE');
    expect(mockTransaction).not.toHaveBeenCalled();
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('uppercase parent UUIDs project lowercase while payload preserves exact case', async () => {
    const upperDecisionId = DECISION_ID.toUpperCase();
    const upperContextId = CONTEXT_ID.toUpperCase();
    const upperRun = TREND_RUN.toUpperCase();
    const decision = sampleDecision({
      decisionId: upperDecisionId,
      decisionContextId: upperContextId,
      evidenceRefs: [{
        agentId: 'trend',
        runId: upperRun,
        evidenceContractVersion: EVIDENCE_CONTRACT_VERSION,
        role: AUTHORITY_CLASS.ANALYTICAL_EVIDENCE,
        authorityClass: AUTHORITY_CLASS.ANALYTICAL_EVIDENCE,
        correlationFamily: CORRELATION_FAMILY.OHLCV_CANDLE,
        freshness: 'fresh',
        availability: 'available',
        admissionState: EVIDENCE_ADMISSION_STATE.ADMITTED,
        admissionReason: ADMISSION_REASON.VALID_ANALYTICAL_EVIDENCE,
        confirmationSemantics: CONFIRMATION_SEMANTICS.DIRECTIONAL_CANDIDATE,
      }],
    });

    const clientQueries = [];
    mockTransaction.mockImplementation(async (fn) => {
      const client = {
        query: jest.fn(async (sql, params) => {
          clientQueries.push({ sql, params });
          return { rows: [], rowCount: 1 };
        }),
      };
      return fn(client);
    });

    const result = await persistArtemisDecision(decision, { writer: 'b10-unit-test' });
    expect(result.ok).toBe(true);
    expect(result.decisionId).toBe(DECISION_ID);
    expect(clientQueries[0].params[0]).toBe(DECISION_ID);
    expect(clientQueries[0].params[1]).toBe(CONTEXT_ID);
    const payload = JSON.parse(clientQueries[0].params[21]);
    expect(payload.decisionId).toBe(upperDecisionId);
    expect(payload.decisionContextId).toBe(upperContextId);
    expect(clientQueries[1].params[3]).toBe(TREND_RUN);
    const refPayload = JSON.parse(clientQueries[1].params[20]);
    expect(refPayload.runId).toBe(upperRun);
  });

  it('whitespace UUID parent ids normalize on projection and verify without PROJECTION_MISMATCH', async () => {
    const wsDecisionId = `  ${DECISION_ID}  `;
    const wsContextId = `  ${CONTEXT_ID}  `;
    const decision = sampleDecision({
      decisionId: wsDecisionId,
      decisionContextId: wsContextId,
    });
    const clientQueries = [];
    mockTransaction.mockImplementation(async (fn) => {
      const client = {
        query: jest.fn(async (sql, params) => {
          clientQueries.push({ sql, params });
          return { rows: [], rowCount: 1 };
        }),
      };
      return fn(client);
    });
    const result = await persistArtemisDecision(decision, { writer: 'b10-unit-test' });
    expect(result.ok).toBe(true);
    expect(clientQueries[0].params[0]).toBe(DECISION_ID);
    expect(clientQueries[0].params[1]).toBe(CONTEXT_ID);
    const payload = JSON.parse(clientQueries[0].params[21]);
    expect(payload.decisionId).toBe(wsDecisionId);
    const verified = verifyStoredDecisionRow(durableRowFromDecision(decision));
    expect(verified.ok).toBe(true);
  });

  it('atomic rollback when evidence insert fails', async () => {
    mockTransaction.mockImplementation(async (fn) => {
      const client = {
        query: jest.fn(async (sql) => {
          if (String(sql).includes('artemis_decision_evidence_refs')) {
            throw new Error('simulated evidence insert failure');
          }
          return { rows: [], rowCount: 1 };
        }),
      };
      await fn(client);
    });
    await expect(
      persistArtemisDecision(sampleDecision(), { writer: 'b10-unit-test' }),
    ).rejects.toThrow(/simulated evidence insert failure/);
  });
});

describe('verifyStoredDecisionRow / reads', () => {
  it('fails unsupported canonicalization version', () => {
    const row = durableRowFromDecision(sampleDecision(), {
      canonicalization_version: 'other-c14n',
    });
    const result = verifyStoredDecisionRow(row);
    expect(result.code).toBe(PERSIST_ERROR.UNSUPPORTED_CANONICALIZATION_VERSION);
  });

  it('fails unsupported contract version', () => {
    const decision = sampleDecision();
    const row = durableRowFromDecision(decision);
    row.decision_payload = { ...row.decision_payload, contractVersion: 'artemis-decision-9.9.9' };
    row.contract_version = 'artemis-decision-9.9.9';
    const result = verifyStoredDecisionRow(row);
    expect(result.code).toBe(PERSIST_ERROR.UNSUPPORTED_CONTRACT_VERSION);
  });

  it('fails stored validation / hash / bytes / projection mismatch', () => {
    const decision = sampleDecision();
    const base = durableRowFromDecision(decision);

    const badPayload = durableRowFromDecision(decision);
    badPayload.decision_payload = { ...badPayload.decision_payload, decisionEligible: true };
    expect(verifyStoredDecisionRow(badPayload).code).toBe(PERSIST_ERROR.VALIDATION_FAILED);

    expect(verifyStoredDecisionRow({
      ...base,
      payload_sha256: 'a'.repeat(64),
    }).code).toBe(PERSIST_ERROR.INTEGRITY_FAILED);

    expect(verifyStoredDecisionRow({
      ...base,
      payload_bytes: 1,
    }).code).toBe(PERSIST_ERROR.INTEGRITY_FAILED);

    expect(verifyStoredDecisionRow({
      ...base,
      symbol: 'ETH/USDT',
    }).code).toBe(PERSIST_ERROR.PROJECTION_MISMATCH);
  });

  it('getDecisionById returns verified Decision metadata', async () => {
    const decision = sampleDecision();
    mockQuery.mockResolvedValueOnce({ rows: [durableRowFromDecision(decision)] });
    const result = await getDecisionById(DECISION_ID);
    expect(result.ok).toBe(true);
    expect(result.found).toBe(true);
    expect(result.decision.decisionId).toBe(DECISION_ID);
    expect(result.canonicalizationVersion).toBe(CANONICALIZATION_VERSION);
    expect(result.payloadSha256).toHaveLength(64);
  });

  it('malformed read UUIDs return INVALID_ARGUMENT with zero DB queries', async () => {
    for (const bad of ['abc', 'run-1', '', 'not-a-uuid']) {
      mockQuery.mockClear();
      const byId = await getDecisionById(bad);
      expect(byId.ok).toBe(false);
      expect(byId.code).toBe(PERSIST_ERROR.INVALID_ARGUMENT);
      expect(mockQuery).not.toHaveBeenCalled();

      mockQuery.mockClear();
      const byCtx = await listDecisionsByContextId(bad);
      expect(byCtx.ok).toBe(false);
      expect(byCtx.code).toBe(PERSIST_ERROR.INVALID_ARGUMENT);
      expect(mockQuery).not.toHaveBeenCalled();

      mockQuery.mockClear();
      const refs = await listEvidenceRefs(bad);
      expect(refs.ok).toBe(false);
      expect(refs.code).toBe(PERSIST_ERROR.INVALID_ARGUMENT);
      expect(mockQuery).not.toHaveBeenCalled();
    }
  });

  it('uppercase decisionId queries normalized lowercase UUID', async () => {
    const decision = sampleDecision();
    mockQuery.mockResolvedValueOnce({ rows: [durableRowFromDecision(decision)] });
    const result = await getDecisionById(DECISION_ID.toUpperCase());
    expect(result.ok).toBe(true);
    expect(result.found).toBe(true);
    expect(mockQuery.mock.calls[0][1][0]).toBe(DECISION_ID);
  });

  it('uppercase UUID projection verifies without PROJECTION_MISMATCH', () => {
    const decision = sampleDecision({
      decisionId: DECISION_ID.toUpperCase(),
      decisionContextId: CONTEXT_ID.toUpperCase(),
      evidenceRefs: [{
        agentId: 'trend',
        runId: TREND_RUN.toUpperCase(),
        evidenceContractVersion: EVIDENCE_CONTRACT_VERSION,
        role: AUTHORITY_CLASS.ANALYTICAL_EVIDENCE,
        authorityClass: AUTHORITY_CLASS.ANALYTICAL_EVIDENCE,
        correlationFamily: CORRELATION_FAMILY.OHLCV_CANDLE,
        freshness: 'fresh',
        availability: 'available',
        admissionState: EVIDENCE_ADMISSION_STATE.ADMITTED,
        admissionReason: ADMISSION_REASON.VALID_ANALYTICAL_EVIDENCE,
        confirmationSemantics: CONFIRMATION_SEMANTICS.DIRECTIONAL_CANDIDATE,
      }],
    });
    const row = durableRowFromDecision(decision);
    expect(row.decision_id).toBe(DECISION_ID);
    expect(row.decision_context_id).toBe(CONTEXT_ID);
    expect(row.decision_payload.decisionId).toBe(DECISION_ID.toUpperCase());
    const verified = verifyStoredDecisionRow(row);
    expect(verified.ok).toBe(true);
  });

  it('listDecisionsByContextId fails closed on corrupt row', async () => {
    const decision = sampleDecision();
    mockQuery.mockResolvedValueOnce({
      rows: [durableRowFromDecision(decision, { payload_sha256: 'f'.repeat(64) })],
    });
    const result = await listDecisionsByContextId(CONTEXT_ID);
    expect(result.ok).toBe(false);
    expect(result.code).toBe(PERSIST_ERROR.INTEGRITY_FAILED);
  });

  it('listEvidenceRefs detects child count / ordinal / payload / projection drift', async () => {
    const decision = sampleDecision();
    const parent = durableRowFromDecision(decision);

    // count drift
    mockQuery
      .mockResolvedValueOnce({ rows: [parent] })
      .mockResolvedValueOnce({ rows: [] });
    let result = await listEvidenceRefs(DECISION_ID);
    expect(result.code).toBe(PERSIST_ERROR.EVIDENCE_INTEGRITY_FAILED);

    // ordinal drift
    mockQuery
      .mockResolvedValueOnce({ rows: [parent] })
      .mockResolvedValueOnce({
        rows: [{
          decision_id: DECISION_ID,
          ordinal: 5,
          agent_id: 'trend',
          run_id: TREND_RUN,
          agent_record_id: null,
          evidence_contract_version: EVIDENCE_CONTRACT_VERSION,
          role: AUTHORITY_CLASS.ANALYTICAL_EVIDENCE,
          authority_class: AUTHORITY_CLASS.ANALYTICAL_EVIDENCE,
          correlation_family: CORRELATION_FAMILY.OHLCV_CANDLE,
          freshness: 'fresh',
          availability: 'available',
          admission_state: EVIDENCE_ADMISSION_STATE.ADMITTED,
          admission_reason: ADMISSION_REASON.VALID_ANALYTICAL_EVIDENCE,
          confirmation_semantics: CONFIRMATION_SEMANTICS.DIRECTIONAL_CANDIDATE,
          symbol: null,
          venue: null,
          market_type: null,
          timeframe: null,
          analysis_horizon: null,
          analysis_timestamp: null,
          ref_payload: decision.evidenceRefs[0],
        }],
      });
    result = await listEvidenceRefs(DECISION_ID);
    expect(result.code).toBe(PERSIST_ERROR.EVIDENCE_INTEGRITY_FAILED);

    // ref_payload drift
    mockQuery
      .mockResolvedValueOnce({ rows: [parent] })
      .mockResolvedValueOnce({
        rows: [{
          decision_id: DECISION_ID,
          ordinal: 0,
          agent_id: 'trend',
          run_id: TREND_RUN,
          agent_record_id: null,
          evidence_contract_version: EVIDENCE_CONTRACT_VERSION,
          role: AUTHORITY_CLASS.ANALYTICAL_EVIDENCE,
          authority_class: AUTHORITY_CLASS.ANALYTICAL_EVIDENCE,
          correlation_family: CORRELATION_FAMILY.OHLCV_CANDLE,
          freshness: 'fresh',
          availability: 'available',
          admission_state: EVIDENCE_ADMISSION_STATE.ADMITTED,
          admission_reason: ADMISSION_REASON.VALID_ANALYTICAL_EVIDENCE,
          confirmation_semantics: CONFIRMATION_SEMANTICS.DIRECTIONAL_CANDIDATE,
          symbol: null,
          venue: null,
          market_type: null,
          timeframe: null,
          analysis_horizon: null,
          analysis_timestamp: null,
          ref_payload: { ...decision.evidenceRefs[0], agentId: 'volume' },
        }],
      });
    result = await listEvidenceRefs(DECISION_ID);
    expect(result.code).toBe(PERSIST_ERROR.EVIDENCE_INTEGRITY_FAILED);

    // projection drift (freshness column wrong while payload ok)
    mockQuery
      .mockResolvedValueOnce({ rows: [parent] })
      .mockResolvedValueOnce({
        rows: [{
          decision_id: DECISION_ID,
          ordinal: 0,
          agent_id: 'trend',
          run_id: TREND_RUN,
          agent_record_id: null,
          evidence_contract_version: EVIDENCE_CONTRACT_VERSION,
          role: AUTHORITY_CLASS.ANALYTICAL_EVIDENCE,
          authority_class: AUTHORITY_CLASS.ANALYTICAL_EVIDENCE,
          correlation_family: CORRELATION_FAMILY.OHLCV_CANDLE,
          freshness: 'stale',
          availability: 'available',
          admission_state: EVIDENCE_ADMISSION_STATE.ADMITTED,
          admission_reason: ADMISSION_REASON.VALID_ANALYTICAL_EVIDENCE,
          confirmation_semantics: CONFIRMATION_SEMANTICS.DIRECTIONAL_CANDIDATE,
          symbol: null,
          venue: null,
          market_type: null,
          timeframe: null,
          analysis_horizon: null,
          analysis_timestamp: null,
          ref_payload: decision.evidenceRefs[0],
        }],
      });
    result = await listEvidenceRefs(DECISION_ID);
    expect(result.code).toBe(PERSIST_ERROR.EVIDENCE_INTEGRITY_FAILED);
  });
});

describe('SQL safety regression', () => {
  it('never emits UPDATE/DELETE or touches ai_decisions/system_logs', async () => {
    const decision = sampleDecision();
    const seen = [];
    mockTransaction.mockImplementation(async (fn) => {
      const client = {
        query: jest.fn(async (sql) => {
          seen.push(sql);
          return { rows: [], rowCount: 1 };
        }),
      };
      return fn(client);
    });
    await persistArtemisDecision(decision, { writer: 'b10-unit-test' });
    mockQuery.mockResolvedValue({ rows: [] });
    await getDecisionById(DECISION_ID);
    await listDecisionsByContextId(CONTEXT_ID);
    const blob = seen.concat(collectSql(mockQuery.mock.calls)).join('\n').toLowerCase();
    expect(blob).not.toMatch(/\bupdate\b|\bdelete\b/);
    expect(blob).not.toContain('ai_decisions');
    expect(blob).not.toContain('system_logs');
  });
});
