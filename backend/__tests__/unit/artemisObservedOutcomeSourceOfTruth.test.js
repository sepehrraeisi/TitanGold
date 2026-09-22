/**
 * @jest-environment node
 *
 * Artemis Core Stage 8 — Observed Outcome Source of Truth (S8-OBSERVED-OUTCOME-SOT).
 */
import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  AVAILABILITY,
  FRESHNESS_STATUS,
  MARKET_TYPE,
} from '../../contracts/artemisEvidenceContract.js';
import { DECISION_CONTRACT_VERSION } from '../../contracts/artemisDecisionContract.js';
import { DECISION_CONTEXT_CONTRACT_VERSION } from '../../contracts/artemisDecisionContextContract.js';
import { MARKET_CONTEXT_CONTRACT_VERSION } from '../../contracts/artemisMarketContextContract.js';
import { SHADOW_RECORDING_CONTRACT_VERSION } from '../../contracts/artemisShadowDecisionRecordingBoundaryContract.js';
import { SHADOW_RUNTIME_CONTRACT_VERSION } from '../../contracts/artemisShadowRuntimeLibraryBoundaryContract.js';
import { SHADOW_TASK_STATE_CONTRACT_VERSION } from '../../contracts/artemisShadowTaskStateBoundaryContract.js';
import { SHADOW_TASK_CYCLE_BINDING_CONTRACT_VERSION } from '../../contracts/artemisShadowTaskCycleCompositionBoundaryContract.js';
import {
  OBSERVED_OUTCOME_CONTRACT_VERSION,
  OBSERVED_OUTCOME_OWNERSHIP_ROLE,
  OBSERVED_OUTCOME_SOT_STATUS as CONTRACT_SOT_STATUS,
  REQUIRED_HARD_FLAGS,
  buildObservedOutcome,
} from '../../contracts/artemisObservedOutcomeContract.js';
import {
  ACCEPT_STATUS,
  OBSERVED_OUTCOME_SOT_CONTRACT_VERSION,
  OBSERVED_OUTCOME_SOT_IS_SOURCE_OF_TRUTH,
  OBSERVED_OUTCOME_SOT_OWNERSHIP_ROLE,
  OBSERVED_OUTCOME_SOT_SLICE_ID,
  OBSERVED_OUTCOME_SOT_WRITER,
  computeOutcomePayloadSha256,
  composeOutcomeRecord,
  buildDurableOutcomePayload,
} from '../../contracts/artemisObservedOutcomeSourceOfTruthContract.js';
import {
  acceptObservedOutcome,
  createInMemoryObservedOutcomeStore,
  getForbiddenImportMarkers,
  getOutcomeById,
  rejectDelete,
  rejectUpdate,
} from '../../services/artemisObservedOutcomeSourceOfTruthService.js';

const DECISION_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const CONTEXT_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const MC_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const RECORDING_ID = '66666666-6666-4666-8666-666666666666';
const TASK_ID = '77777777-7777-4777-8777-777777777777';
const BINDING_ID = '88888888-8888-4888-8888-888888888888';
const CYCLE_ID = '55555555-5555-4555-8555-555555555555';
const OTHER_UUID = '11111111-1111-4111-8111-111111111111';

const ANALYSIS_AT = '2026-09-22T10:00:00.000Z';
const SOURCE_TS = '2026-09-22T10:59:00.000Z';
const OUTCOME_OBSERVED_AT = '2026-09-22T11:00:00.000Z';
const RECORDED_AT = '2026-09-22T11:00:01.000Z';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const SOT_CONTRACT_PATH = path.join(
  DIR,
  '../../contracts/artemisObservedOutcomeSourceOfTruthContract.js',
);
const SOT_SERVICE_PATH = path.join(
  DIR,
  '../../services/artemisObservedOutcomeSourceOfTruthService.js',
);
const OUTCOME_CONTRACT_PATH = path.join(
  DIR,
  '../../contracts/artemisObservedOutcomeContract.js',
);
const MIGRATION_PATH = path.join(
  DIR,
  '../../database/migrations/054_artemis_observed_outcome_sot.sql',
);

const PROTECTED_PATHS = [
  '../../contracts/artemisRiskControlRuntimeBoundaryContract.js',
  '../../contracts/artemisPortfolioControlSizingBoundaryContract.js',
  '../../contracts/artemisLiquidityExecutionFeasibilityBoundaryContract.js',
  '../../contracts/artemisRuntimeCapabilityBoundaryContract.js',
  '../../contracts/artemisOrderManagementExecutionBoundaryContract.js',
  '../../contracts/artemisControlChainContract.js',
  '../../contracts/artemisShadowDecisionRecordingBoundaryContract.js',
  '../../contracts/artemisMarketContextContract.js',
  '../../contracts/artemisMarketContextSourceOfTruthContract.js',
  '../../contracts/artemisObservedOutcomeContract.js',
  '../../contracts/artemisShadowRuntimeLibraryBoundaryContract.js',
  '../../contracts/artemisShadowTaskStateBoundaryContract.js',
  '../../contracts/artemisShadowTaskCycleCompositionBoundaryContract.js',
  '../../contracts/artemisShadowTaskStateActivationBoundaryContract.js',
];

function decisionRef(overrides = {}) {
  return {
    decisionId: DECISION_ID,
    contractVersion: DECISION_CONTRACT_VERSION,
    decisionContextId: CONTEXT_ID,
    analysisAt: ANALYSIS_AT,
    ...overrides,
  };
}

function decisionContextRef(overrides = {}) {
  return {
    contextId: CONTEXT_ID,
    contractVersion: DECISION_CONTEXT_CONTRACT_VERSION,
    ...overrides,
  };
}

function shadowRecordingRef(overrides = {}) {
  return {
    shadowRecordingArtifactId: RECORDING_ID,
    contractVersion: SHADOW_RECORDING_CONTRACT_VERSION,
    ...overrides,
  };
}

function marketContextRef(overrides = {}) {
  return {
    marketContextId: MC_ID,
    contractVersion: MARKET_CONTEXT_CONTRACT_VERSION,
    venue: 'mexc',
    marketType: MARKET_TYPE.SPOT,
    symbol: 'BTC/USDT',
    timeframe: '1h',
    freshnessStatus: FRESHNESS_STATUS.FRESH,
    sourceTimestamp: SOURCE_TS,
    availability: AVAILABILITY.AVAILABLE,
    ...overrides,
  };
}

function validInput(overrides = {}) {
  return {
    decisionRef: decisionRef(),
    decisionContextRef: decisionContextRef(),
    shadowRecordingRef: shadowRecordingRef(),
    marketContextRef: marketContextRef(),
    outcomeObservedAt: OUTCOME_OBSERVED_AT,
    recordedAt: RECORDED_AT,
    ...overrides,
  };
}

function expectValidationFail(result) {
  expect(result.ok).toBe(false);
  expect(result.code).toBe(ACCEPT_STATUS.VALIDATION_FAILED);
}

function zeroSideEffectAudit(sideEffects) {
  expect(sideEffects.networkRequestCount).toBe(0);
  expect(sideEffects.providerRequestCount).toBe(0);
  expect(sideEffects.llmCallCount).toBe(0);
  expect(sideEffects.orderOperationCount).toBe(0);
  expect(sideEffects.financialExecutionCount).toBe(0);
  expect(sideEffects.dbWriteCount).toBe(0);
  expect(sideEffects.redisWriteCount).toBe(0);
  expect(sideEffects.network).toBe(0);
  expect(sideEffects.provider).toBe(0);
  expect(sideEffects.llm).toBe(0);
  expect(sideEffects.orders).toBe(0);
  expect(sideEffects.wallet).toBe(0);
  expect(sideEffects.financialExecution).toBe(0);
  expect(sideEffects.worker).toBe(0);
  expect(sideEffects.scheduler).toBe(0);
  expect(sideEffects.feeder).toBe(0);
  expect(sideEffects.b10).toBe(0);
  expect(sideEffects.outcomeEvaluation).toBe(0);
}

describe('artemisObservedOutcomeSourceOfTruth — S8-OBSERVED-OUTCOME-SOT', () => {
  it('1. valid outcome accepted', () => {
    const store = createInMemoryObservedOutcomeStore();
    const result = acceptObservedOutcome(validInput(), { store });
    expect(result.ok).toBe(true);
    expect(result.code).toBe(ACCEPT_STATUS.ACCEPTED);
    expect(result.outcomeId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-8[0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(result.payloadSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(result.record.ownership.role).toBe(OBSERVED_OUTCOME_SOT_OWNERSHIP_ROLE);
    expect(result.record.ownership.isSourceOfTruth).toBe(true);
    expect(result.sideEffects.sotAppendCount).toBe(1);
    zeroSideEffectAudit(result.sideEffects);
    expect(store.getStats().rowCount).toBe(1);
  });

  it('2. missing required field rejected', () => {
    const store = createInMemoryObservedOutcomeStore();
    const input = validInput();
    delete input.decisionRef;
    expectValidationFail(acceptObservedOutcome(input, { store }));
    expect(store.getStats().rowCount).toBe(0);
  });

  it('3. unknown field rejected', () => {
    const store = createInMemoryObservedOutcomeStore();
    expectValidationFail(acceptObservedOutcome(validInput({
      unknownExtra: true,
    }), { store }));
  });

  it('4–5. deterministic outcomeId; identical repeated acceptance', () => {
    const store = createInMemoryObservedOutcomeStore();
    const a = acceptObservedOutcome(validInput(), { store });
    const b = acceptObservedOutcome(validInput(), { store });
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
    expect(a.outcomeId).toBe(b.outcomeId);
    expect(a.payloadSha256).toBe(b.payloadSha256);
    expect(b.code).toBe(ACCEPT_STATUS.ALREADY_PRESENT);
    expect(b.sideEffects.sotAppendCount).toBe(0);
    expect(store.getStats().rowCount).toBe(1);
  });

  it('6. malformed / conflicting outcomeId rejected at validation', () => {
    const store = createInMemoryObservedOutcomeStore();
    expectValidationFail(acceptObservedOutcome(validInput({
      outcomeId: OTHER_UUID,
    }), { store }));
  });

  it('7–14. lineage mismatches fail closed', () => {
    const store = createInMemoryObservedOutcomeStore();
    expectValidationFail(acceptObservedOutcome(validInput({
      lineage: { decisionId: OTHER_UUID },
    }), { store }));
    expectValidationFail(acceptObservedOutcome(validInput({
      lineage: { decisionContextId: OTHER_UUID },
    }), { store }));
    expectValidationFail(acceptObservedOutcome(validInput({
      lineage: { shadowRecordingArtifactId: OTHER_UUID },
    }), { store }));
    expectValidationFail(acceptObservedOutcome(validInput({
      lineage: { marketContextId: OTHER_UUID },
    }), { store }));
    expectValidationFail(acceptObservedOutcome(validInput({
      taskRef: {
        taskId: TASK_ID,
        contractVersion: SHADOW_TASK_STATE_CONTRACT_VERSION,
      },
      lineage: { taskId: OTHER_UUID },
    }), { store }));
    expectValidationFail(acceptObservedOutcome(validInput({
      cycleBindingRef: {
        bindingId: BINDING_ID,
        contractVersion: SHADOW_TASK_CYCLE_BINDING_CONTRACT_VERSION,
      },
      lineage: { bindingId: OTHER_UUID },
    }), { store }));
    expectValidationFail(acceptObservedOutcome(validInput({
      shadowCycleEnvelopeRef: {
        shadowCycleEnvelopeId: CYCLE_ID,
        contractVersion: SHADOW_RUNTIME_CONTRACT_VERSION,
      },
      lineage: { shadowCycleEnvelopeId: OTHER_UUID },
    }), { store }));
  });

  it('9–11. decision / context / shadowRecording / marketContext mismatch', () => {
    const store = createInMemoryObservedOutcomeStore();
    expectValidationFail(acceptObservedOutcome(validInput({
      decisionContextRef: decisionContextRef({ contextId: OTHER_UUID }),
    }), { store }));
    expectValidationFail(acceptObservedOutcome(validInput({
      lineage: {
        shadowRecordingArtifactId: OTHER_UUID,
      },
    }), { store }));
    expectValidationFail(acceptObservedOutcome(validInput({
      lineage: {
        marketContextId: OTHER_UUID,
      },
    }), { store }));
    expectValidationFail(acceptObservedOutcome(validInput({
      marketContextRef: marketContextRef({
        contractVersion: 'not-a-valid-mc-version',
      }),
    }), { store }));
  });

  it('15. contractVersion on refs must match canonical', () => {
    const store = createInMemoryObservedOutcomeStore();
    expectValidationFail(acceptObservedOutcome(validInput({
      decisionRef: decisionRef({ contractVersion: 'bad' }),
    }), { store }));
  });

  it('16. sourceTimestamp mismatch in provenance rejected', () => {
    const store = createInMemoryObservedOutcomeStore();
    expectValidationFail(acceptObservedOutcome(validInput({
      provenance: {
        writer: 'x',
        methodKey: 'y',
        stage: 'z',
        sourceTimestamp: '2026-09-22T09:00:00.000Z',
      },
    }), { store }));
  });

  it('17. invalid outcomeObservedAt rejected', () => {
    const store = createInMemoryObservedOutcomeStore();
    expectValidationFail(acceptObservedOutcome(validInput({
      outcomeObservedAt: 'not-iso',
    }), { store }));
  });

  it('18. look-ahead / pre-decision rejection', () => {
    const store = createInMemoryObservedOutcomeStore();
    expectValidationFail(acceptObservedOutcome(validInput({
      outcomeObservedAt: '2026-09-22T09:00:00.000Z',
      recordedAt: '2026-09-22T09:00:01.000Z',
      marketContextRef: marketContextRef({
        sourceTimestamp: '2026-09-22T08:59:00.000Z',
      }),
    }), { store }));
    expectValidationFail(acceptObservedOutcome(validInput({
      marketContextRef: marketContextRef({
        sourceTimestamp: '2026-09-22T11:30:00.000Z',
      }),
    }), { store }));
  });

  it('19. provenance allowlist / required fields', () => {
    const store = createInMemoryObservedOutcomeStore();
    expectValidationFail(acceptObservedOutcome(validInput({
      provenance: { writer: 'only-writer' },
    }), { store }));
  });

  it('20. hard authority flag true rejected', () => {
    const store = createInMemoryObservedOutcomeStore();
    for (const key of Object.keys(REQUIRED_HARD_FLAGS)) {
      expectValidationFail(acceptObservedOutcome(validInput({
        [key]: true,
      }), { store }));
    }
  });

  it('21–23. duplicate identical vs conflicting; no overwrite', () => {
    const store = createInMemoryObservedOutcomeStore();
    const first = acceptObservedOutcome(validInput(), { store });
    expect(first.code).toBe(ACCEPT_STATUS.ACCEPTED);

    const identical = acceptObservedOutcome(validInput(), { store });
    expect(identical.code).toBe(ACCEPT_STATUS.ALREADY_PRESENT);
    expect(store.getStats().rowCount).toBe(1);

    // Same identity, different non-identity payload field (recordedAt later).
    // recordedAt is NOT in identity hash — so same outcomeId, different payload → CONFLICT
    const conflict = acceptObservedOutcome(validInput({
      recordedAt: '2026-09-22T11:00:05.000Z',
    }), { store });
    expect(conflict.ok).toBe(false);
    expect(conflict.code).toBe(ACCEPT_STATUS.CONFLICT);
    expect(conflict.existingPayloadSha256).toBe(first.payloadSha256);
    expect(conflict.attemptedPayloadSha256).not.toBe(first.payloadSha256);

    const still = getOutcomeById(first.outcomeId, { store });
    expect(still.ok).toBe(true);
    expect(still.record.payloadSha256).toBe(first.payloadSha256);
    expect(still.record.recordedAt).toBe(RECORDED_AT);
    expect(store.getStats().rowCount).toBe(1);
  });

  it('24–25. append-only and immutable returned artifact', () => {
    const store = createInMemoryObservedOutcomeStore();
    const result = acceptObservedOutcome(validInput(), { store });
    expect(result.ok).toBe(true);
    expect(Object.isFrozen(result.record)).toBe(true);

    const originalSha = result.record.payloadSha256;
    try {
      result.record.payloadSha256 = 'mutated';
    } catch {
      // frozen may throw in strict mode
    }
    expect(result.record.payloadSha256).toBe(originalSha);

    const stored = store.getByOutcomeId(result.outcomeId);
    expect(stored.payloadSha256).toBe(originalSha);
    try {
      stored.writer = 'attacker';
    } catch {
      // ignore
    }
    expect(store.getByOutcomeId(result.outcomeId).writer).toBe(OBSERVED_OUTCOME_SOT_WRITER);
  });

  it('26–27. no update / delete API', () => {
    const store = createInMemoryObservedOutcomeStore();
    acceptObservedOutcome(validInput(), { store });
    const up = rejectUpdate(store);
    expect(up.ok).toBe(false);
    expect(up.code).toBe('APPEND_ONLY_NO_UPDATE');
    const del = rejectDelete(store);
    expect(del.ok).toBe(false);
    expect(del.code).toBe('APPEND_ONLY_NO_DELETE');
    expect(store.getStats().rowCount).toBe(1);
  });

  it('28–35. zero side effects on accept', () => {
    const store = createInMemoryObservedOutcomeStore();
    const result = acceptObservedOutcome(validInput(), { store });
    zeroSideEffectAudit(result.sideEffects);
  });

  it('36–37. deterministic repeated acceptance / retry', () => {
    const store = createInMemoryObservedOutcomeStore();
    const built = buildObservedOutcome(validInput());
    expect(built.ok).toBe(true);
    const r1 = acceptObservedOutcome(validInput(), { store });
    const r2 = acceptObservedOutcome(validInput(), { store });
    const r3 = acceptObservedOutcome(validInput(), { store });
    expect(r1.outcomeId).toBe(built.artifact.outcomeId);
    expect(r2.outcomeId).toBe(r1.outcomeId);
    expect(r3.code).toBe(ACCEPT_STATUS.ALREADY_PRESENT);
    expect(store.getStats().appendCount).toBe(1);
  });

  it('38. cross-cycle / different identity is independent append', () => {
    const store = createInMemoryObservedOutcomeStore();
    const a = acceptObservedOutcome(validInput(), { store });
    const b = acceptObservedOutcome(validInput({
      shadowCycleEnvelopeRef: {
        shadowCycleEnvelopeId: CYCLE_ID,
        contractVersion: SHADOW_RUNTIME_CONTRACT_VERSION,
      },
    }), { store });
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
    expect(b.code).toBe(ACCEPT_STATUS.ACCEPTED);
    expect(a.outcomeId).not.toBe(b.outcomeId);
    expect(store.getStats().rowCount).toBe(2);
  });

  it('task/binding linkage when present', () => {
    const store = createInMemoryObservedOutcomeStore();
    const result = acceptObservedOutcome(validInput({
      taskRef: {
        taskId: TASK_ID,
        contractVersion: SHADOW_TASK_STATE_CONTRACT_VERSION,
      },
      cycleBindingRef: {
        bindingId: BINDING_ID,
        contractVersion: SHADOW_TASK_CYCLE_BINDING_CONTRACT_VERSION,
      },
    }), { store });
    expect(result.ok).toBe(true);
    expect(result.record.taskId).toBe(TASK_ID);
    expect(result.record.bindingId).toBe(BINDING_ID);
    expect(result.record.outcomeArtifact.taskRef.taskId).toBe(TASK_ID);
  });

  it('payload hash deterministic from durable payload', () => {
    const built = buildObservedOutcome(validInput());
    const payload = buildDurableOutcomePayload(built.artifact);
    const h1 = computeOutcomePayloadSha256(payload);
    const h2 = computeOutcomePayloadSha256(payload);
    expect(h1).toBe(h2);
    const record = composeOutcomeRecord(built.artifact);
    expect(record.payloadSha256).toBe(h1);
  });

  it('Outcome Contract remains validation boundary (unchanged semantics)', () => {
    expect(CONTRACT_SOT_STATUS).toBe('MISSING');
    expect(OBSERVED_OUTCOME_OWNERSHIP_ROLE).toBe('VALIDATION_BOUNDARY');
    expect(OBSERVED_OUTCOME_SOT_IS_SOURCE_OF_TRUTH).toBe(true);
    expect(OBSERVED_OUTCOME_SOT_OWNERSHIP_ROLE).toBe('SOURCE_OF_TRUTH');
    expect(OBSERVED_OUTCOME_SOT_SLICE_ID).toBe('S8-OBSERVED-OUTCOME-SOT');
  });

  it('39. migration authored — static schema validation', () => {
    const sql = readFileSync(MIGRATION_PATH, 'utf8');
    expect(sql).toContain('CREATE TABLE artemis_observed_outcomes');
    expect(sql).toContain('outcome_id UUID PRIMARY KEY');
    expect(sql).toContain('payload_sha256');
    expect(sql).toContain('decision_id');
    expect(sql).toContain('decision_context_id');
    expect(sql).toContain('shadow_recording_artifact_id');
    expect(sql).toContain('market_context_id');
    expect(sql).toContain('uq_artemis_oo_identity_payload');
    expect(sql).toContain('decision_eligible IS FALSE');
    expect(sql).toContain('DO NOT execute against live DB');
    expect(sql).not.toMatch(/realized_pnl/i);
    expect(sql).not.toMatch(/DROP TABLE/i);
    // No transactional BEGIN/COMMIT ownership in migration body (node-pg-migrate owns tx).
    // Comment text may mention BEGIN/COMMIT — assert executable statements absent.
    const sqlWithoutComments = sql
      .split('\n')
      .filter((line) => !line.trim().startsWith('--'))
      .join('\n');
    expect(sqlWithoutComments).not.toMatch(/(^|\s)BEGIN\s*;/i);
    expect(sqlWithoutComments).not.toMatch(/(^|\s)COMMIT\s*;/i);
    expect(sqlWithoutComments).not.toContain('IF NOT EXISTS');
  });

  it('40. protected surfaces untouched; import hygiene', () => {
    const sotContract = readFileSync(SOT_CONTRACT_PATH, 'utf8');
    const sotService = readFileSync(SOT_SERVICE_PATH, 'utf8');
    const outcomeContract = readFileSync(OUTCOME_CONTRACT_PATH, 'utf8');

    expect(sotContract).toContain(OBSERVED_OUTCOME_SOT_CONTRACT_VERSION);
    expect(sotService).toContain('createInMemoryObservedOutcomeStore');
    expect(outcomeContract).toContain(OBSERVED_OUTCOME_CONTRACT_VERSION);
    expect(outcomeContract).toContain("OBSERVED_OUTCOME_SOT_STATUS = 'MISSING'");

    for (const marker of getForbiddenImportMarkers()) {
      const importRe = new RegExp(`from\\s+['"][^'"]*${marker}[^'"]*['"]`);
      expect(sotService).not.toMatch(importRe);
      expect(sotContract).not.toMatch(importRe);
    }

    for (const rel of PROTECTED_PATHS) {
      const full = path.join(DIR, rel);
      const before = readFileSync(full, 'utf8');
      expect(before.length).toBeGreaterThan(100);
      expect(before).not.toContain('OBSERVED_OUTCOME_SOT_IS_SOURCE_OF_TRUTH');
    }
  });

  it('getOutcomeById requires store; returns clone', () => {
    expect(getOutcomeById(OTHER_UUID, {}).ok).toBe(false);
    const store = createInMemoryObservedOutcomeStore();
    const accepted = acceptObservedOutcome(validInput(), { store });
    const found = getOutcomeById(accepted.outcomeId, { store });
    expect(found.ok).toBe(true);
    expect(Object.isFrozen(found.record)).toBe(true);
    expect(getOutcomeById(OTHER_UUID, { store }).code).toBe('not_found');
  });

  it('hard flags on stored record remain false', () => {
    const store = createInMemoryObservedOutcomeStore();
    const result = acceptObservedOutcome(validInput(), { store });
    for (const [k, v] of Object.entries(REQUIRED_HARD_FLAGS)) {
      expect(result.record.hardFlags[k]).toBe(v);
      expect(result.hardFlags[k]).toBe(false);
    }
  });
});
