/**
 * @jest-environment node
 *
 * Artemis B10 — disposable PostgreSQL integration tests.
 * Runs ONLY when TITAN_B10_DISPOSABLE_PG=1 and DATABASE_URL targets
 * loopback titangold_b10_test. Never falls back to production.
 */
import { describe, expect, it, beforeAll } from '@jest/globals';
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
import { CANONICALIZATION_VERSION, buildCanonicalDecisionPayload } from '../../services/artemisDecisionCanonicalJson.js';
import {
  persistArtemisDecision,
  getDecisionById,
  listEvidenceRefs,
  PERSIST_STATUS,
  PERSIST_ERROR,
} from '../../services/artemisDecisionPersistenceService.js';
import { query } from '../../database/db.js';

const ENABLED = process.env.TITAN_B10_DISPOSABLE_PG === '1';

function assertDisposableSafety() {
  if (!ENABLED) {
    return { ok: false, reason: 'flag_off' };
  }
  const url = process.env.DATABASE_URL || '';
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('B10 disposable PG: invalid DATABASE_URL');
  }
  const host = parsed.hostname;
  const db = parsed.pathname.replace(/^\//, '');
  if (host !== '127.0.0.1' && host !== 'localhost') {
    throw new Error(`B10 disposable PG: host must be loopback, got ${host}`);
  }
  if (db !== 'titangold_b10_test') {
    throw new Error(`B10 disposable PG: database must be titangold_b10_test, got ${db}`);
  }
  return { ok: true };
}

function sampleDecision(id, contextId, overrides = {}) {
  return buildContractOnlyArtemisDecision({
    decisionId: id,
    decisionContextId: contextId,
    createdAt: '2026-08-10T12:10:00.000Z',
    analysisAt: '2026-08-10T12:00:00.000Z',
    symbol: 'BTC/USDT',
    venue: 'mexc',
    marketType: 'spot',
    timeframe: '1h',
    evidenceRefs: [
      {
        agentId: 'trend',
        runId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
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

const suite = ENABLED ? describe : describe.skip;

suite('B10 disposable PG integration', () => {
  beforeAll(() => {
    assertDisposableSafety();
  });

  it('persists Decision + refs and round-trips with integrity verification', async () => {
    const decision = sampleDecision(
      '11111111-1111-4111-8111-111111111101',
      '22222222-2222-4222-8222-222222222201',
    );
    const persisted = await persistArtemisDecision(decision, { writer: 'b10-integration' });
    expect(persisted.ok).toBe(true);
    expect(persisted.status).toBe(PERSIST_STATUS.PERSISTED);

    const loaded = await getDecisionById(decision.decisionId);
    expect(loaded.ok).toBe(true);
    expect(loaded.found).toBe(true);
    expect(loaded.decision.decisionId).toBe(decision.decisionId);
    expect(loaded.payloadSha256).toBe(buildCanonicalDecisionPayload(decision).payloadSha256);
    expect(loaded.canonicalizationVersion).toBe(CANONICALIZATION_VERSION);

    const refs = await listEvidenceRefs(decision.decisionId);
    expect(refs.ok).toBe(true);
    expect(refs.evidenceRefs).toHaveLength(1);
    expect(refs.evidenceRefs[0].ordinal).toBe(0);
  });

  it('same ID / same payload => ALREADY_PERSISTED', async () => {
    const decision = sampleDecision(
      '11111111-1111-4111-8111-111111111102',
      '22222222-2222-4222-8222-222222222202',
    );
    const first = await persistArtemisDecision(decision, { writer: 'b10-integration' });
    expect(first.status).toBe(PERSIST_STATUS.PERSISTED);
    const second = await persistArtemisDecision(decision, { writer: 'b10-integration' });
    expect(second.ok).toBe(true);
    expect(second.status).toBe(PERSIST_STATUS.ALREADY_PERSISTED);
  });

  it('same ID / different payload => DECISION_ID_CONFLICT', async () => {
    const a = sampleDecision(
      '11111111-1111-4111-8111-111111111103',
      '22222222-2222-4222-8222-222222222203',
      { timeframe: '1h' },
    );
    const b = sampleDecision(
      '11111111-1111-4111-8111-111111111103',
      '22222222-2222-4222-8222-222222222203',
      { timeframe: '4h' },
    );
    expect((await persistArtemisDecision(a, { writer: 'b10-integration' })).ok).toBe(true);
    const conflict = await persistArtemisDecision(b, { writer: 'b10-integration' });
    expect(conflict.ok).toBe(false);
    expect(conflict.code).toBe(PERSIST_ERROR.DECISION_ID_CONFLICT);
  });

  it('FK RESTRICT prevents parent DELETE while child exists', async () => {
    const decision = sampleDecision(
      '11111111-1111-4111-8111-111111111104',
      '22222222-2222-4222-8222-222222222204',
    );
    expect((await persistArtemisDecision(decision, { writer: 'b10-integration' })).ok).toBe(true);
    await expect(
      query('DELETE FROM artemis_decisions WHERE decision_id = $1', [decision.decisionId]),
    ).rejects.toMatchObject({ code: '23503' });
    const still = await query(
      'SELECT decision_id FROM artemis_decisions WHERE decision_id = $1',
      [decision.decisionId],
    );
    expect(still.rows).toHaveLength(1);
  });

  it('eligibility / hash / writer DB CHECKs reject invalid rows', async () => {
    const decision = sampleDecision(
      '11111111-1111-4111-8111-111111111105',
      '22222222-2222-4222-8222-222222222205',
    );
    const canonical = buildCanonicalDecisionPayload(decision);
    const insertSql = `
      INSERT INTO artemis_decisions (
        decision_id, decision_context_id, schema_version, contract_version,
        policy_version, implementation_version, created_at, analysis_at, expires_at,
        symbol, venue, market_type, timeframe, analysis_horizon, synthesis_outcome,
        observed_direction, conflict_state, classification, maturity_stage,
        decision_eligible, execution_eligible, decision_payload, payload_sha256,
        payload_bytes, canonicalization_version, writer
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,
        $20,$21,$22::jsonb,$23,$24,$25,$26
      )`;

    const mk = (over = {}) => ([
      over.decisionId || '11111111-1111-4111-8111-1111111111a1',
      decision.decisionContextId,
      decision.schemaVersion,
      decision.contractVersion,
      decision.policyVersion,
      decision.implementationVersion,
      decision.createdAt,
      decision.analysisAt,
      null,
      decision.symbol,
      decision.venue,
      decision.marketType,
      decision.timeframe,
      null,
      decision.synthesisOutcome,
      decision.direction,
      decision.conflictState,
      decision.classification,
      decision.maturityStage,
      over.decisionEligible ?? false,
      over.executionEligible ?? false,
      canonical.canonicalUtf8,
      over.payloadSha256 ?? canonical.payloadSha256,
      canonical.payloadBytes,
      CANONICALIZATION_VERSION,
      over.writer ?? 'writer',
    ]);

    await expect(query(insertSql, mk({
      decisionId: '11111111-1111-4111-8111-1111111111a1',
      decisionEligible: true,
    }))).rejects.toMatchObject({ code: '23514' });

    await expect(query(insertSql, mk({
      decisionId: '11111111-1111-4111-8111-1111111111a2',
      payloadSha256: 'NOT_A_HASH',
    }))).rejects.toMatchObject({ code: '23514' });

    await expect(query(insertSql, mk({
      decisionId: '11111111-1111-4111-8111-1111111111a3',
      writer: '   ',
    }))).rejects.toMatchObject({ code: '23514' });
  });

  it('atomic rollback: parent does not remain when child insert fails', async () => {
    const decision = sampleDecision(
      '11111111-1111-4111-8111-111111111106',
      '22222222-2222-4222-8222-222222222206',
    );
    await query(`
      ALTER TABLE artemis_decision_evidence_refs
      ADD CONSTRAINT artemis_b10_test_only_reject_agent
      CHECK (agent_id <> 'trend' OR decision_id <> '11111111-1111-4111-8111-111111111106')
    `);
    await expect(
      persistArtemisDecision(decision, { writer: 'b10-integration' }),
    ).rejects.toBeTruthy();
    const rows = await query(
      'SELECT decision_id FROM artemis_decisions WHERE decision_id = $1',
      [decision.decisionId],
    );
    expect(rows.rows).toHaveLength(0);
  });

  it('integrity tamper detection fails closed on read', async () => {
    const decision = sampleDecision(
      '11111111-1111-4111-8111-111111111107',
      '22222222-2222-4222-8222-222222222207',
    );
    const canonical = buildCanonicalDecisionPayload(decision);
    await query(
      `INSERT INTO artemis_decisions (
        decision_id, decision_context_id, schema_version, contract_version,
        policy_version, implementation_version, created_at, analysis_at, expires_at,
        symbol, venue, market_type, timeframe, analysis_horizon, synthesis_outcome,
        observed_direction, conflict_state, classification, maturity_stage,
        decision_eligible, execution_eligible, decision_payload, payload_sha256,
        payload_bytes, canonicalization_version, writer
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,
        $20,$21,$22::jsonb,$23,$24,$25,$26
      )`,
      [
        decision.decisionId,
        decision.decisionContextId,
        decision.schemaVersion,
        decision.contractVersion,
        decision.policyVersion,
        decision.implementationVersion,
        decision.createdAt,
        decision.analysisAt,
        null,
        decision.symbol,
        decision.venue,
        decision.marketType,
        decision.timeframe,
        null,
        decision.synthesisOutcome,
        decision.direction,
        decision.conflictState,
        decision.classification,
        decision.maturityStage,
        false,
        false,
        canonical.canonicalUtf8,
        'a'.repeat(64),
        canonical.payloadBytes,
        CANONICALIZATION_VERSION,
        'tamper',
      ],
    );
    const loaded = await getDecisionById(decision.decisionId);
    expect(loaded.ok).toBe(false);
    expect(loaded.code).toBe(PERSIST_ERROR.INTEGRITY_FAILED);
  });

  it('evidence projection drift fails closed', async () => {
    const decision = sampleDecision(
      '11111111-1111-4111-8111-111111111108',
      '22222222-2222-4222-8222-222222222208',
    );
    expect((await persistArtemisDecision(decision, { writer: 'b10-integration' })).ok).toBe(true);
    await query(
      `UPDATE artemis_decision_evidence_refs
       SET freshness = 'stale'
       WHERE decision_id = $1 AND ordinal = 0`,
      [decision.decisionId],
    );
    const refs = await listEvidenceRefs(decision.decisionId);
    expect(refs.ok).toBe(false);
    expect(refs.code).toBe(PERSIST_ERROR.EVIDENCE_INTEGRITY_FAILED);
  });

  it('uppercase UUID Decision round-trips with normalized SQL columns', async () => {
    const upperDecisionId = 'AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAA10';
    const upperContextId = 'BBBBBBBB-BBBB-4BBB-8BBB-BBBBBBBBBB10';
    const upperRunId = 'CCCCCCCC-CCCC-4CCC-8CCC-CCCCCCCCCC10';
    const decision = sampleDecision(upperDecisionId, upperContextId, {
      evidenceRefs: [
        {
          agentId: 'trend',
          runId: upperRunId,
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
    });

    const persisted = await persistArtemisDecision(decision, { writer: 'b10-integration' });
    expect(persisted.ok).toBe(true);
    expect(persisted.status).toBe(PERSIST_STATUS.PERSISTED);
    expect(persisted.decisionId).toBe(upperDecisionId.toLowerCase());

    const raw = await query(
      `SELECT decision_id, decision_context_id FROM artemis_decisions WHERE decision_id = $1`,
      [upperDecisionId.toLowerCase()],
    );
    expect(raw.rows).toHaveLength(1);
    expect(raw.rows[0].decision_id).toBe(upperDecisionId.toLowerCase());
    expect(raw.rows[0].decision_context_id).toBe(upperContextId.toLowerCase());

    const loaded = await getDecisionById(upperDecisionId);
    expect(loaded.ok).toBe(true);
    expect(loaded.found).toBe(true);
    expect(loaded.decision.decisionId).toBe(upperDecisionId);
    expect(loaded.decision.decisionContextId).toBe(upperContextId);
    expect(loaded.payloadSha256).toBe(buildCanonicalDecisionPayload(decision).payloadSha256);

    const refRaw = await query(
      `SELECT run_id FROM artemis_decision_evidence_refs WHERE decision_id = $1 AND ordinal = 0`,
      [upperDecisionId.toLowerCase()],
    );
    expect(refRaw.rows[0].run_id).toBe(upperRunId.toLowerCase());

    const refs = await listEvidenceRefs(upperDecisionId);
    expect(refs.ok).toBe(true);
    expect(refs.evidenceRefs).toHaveLength(1);
    expect(refs.evidenceRefs[0].runId).toBe(upperRunId.toLowerCase());
    expect(refs.evidenceRefs[0].refPayload.runId).toBe(upperRunId);
  });

  it('does not require or write ai_decisions', async () => {
    const before = await query('SELECT count(*)::int AS c FROM ai_decisions').catch((err) => ({
      error: err,
    }));
    // If ai_decisions exists on disposable (empty base), B10 must not change it.
    if (!before.error) {
      const decision = sampleDecision(
        '11111111-1111-4111-8111-111111111109',
        '22222222-2222-4222-8222-222222222209',
      );
      await persistArtemisDecision(decision, { writer: 'b10-integration' });
      const after = await query('SELECT count(*)::int AS c FROM ai_decisions');
      expect(after.rows[0].c).toBe(before.rows[0].c);
    } else {
      // Disposable schema without ai_decisions is acceptable for B10-only migration.
      expect(true).toBe(true);
    }
  });
});
