/**
 * @jest-environment node
 *
 * Artemis Core Stage 8 — S8-OBSERVED-OUTCOME-CONTRACT
 * Observed Outcome Contract Boundary unit tests.
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
  OBSERVED_OUTCOME_ARTIFACT_TYPE,
  OBSERVED_OUTCOME_AUTHORITY_CLASS,
  OBSERVED_OUTCOME_CONTRACT_VERSION,
  OBSERVED_OUTCOME_LIMITATIONS,
  OBSERVED_OUTCOME_METHOD_KEY,
  OBSERVED_OUTCOME_OWNERSHIP_ROLE,
  OBSERVED_OUTCOME_POLICY_VERSION,
  OBSERVED_OUTCOME_SCHEMA_VERSION,
  OBSERVED_OUTCOME_SLICE_ID,
  OBSERVED_OUTCOME_SOT_STATUS,
  OBSERVED_OUTCOME_STAGE,
  OBSERVED_OUTCOME_WRITER,
  OUTCOME_EVALUATION_STATUS,
  REALIZED_PNL_STATUS,
  REQUIRED_HARD_FLAGS,
  ZERO_OBSERVED_OUTCOME_SIDE_EFFECTS,
  buildObservedOutcome,
  validateObservedOutcome,
} from '../../contracts/artemisObservedOutcomeContract.js';

const DECISION_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const CONTEXT_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const MC_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const RECORDING_ID = '66666666-6666-4666-8666-666666666666';
const TASK_ID = '77777777-7777-4777-8777-777777777777';
const BINDING_ID = '88888888-8888-4888-8888-888888888888';
const CYCLE_ID = '55555555-5555-4555-8555-555555555555';
const CORRELATION_ID = '99999999-9999-4999-8999-999999999999';
const OTHER_UUID = '11111111-1111-4111-8111-111111111111';

const ANALYSIS_AT = '2026-09-22T10:00:00.000Z';
const SOURCE_TS = '2026-09-22T10:59:00.000Z';
const OUTCOME_OBSERVED_AT = '2026-09-22T11:00:00.000Z';
const RECORDED_AT = '2026-09-22T11:00:01.000Z';

const CONTRACT_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../contracts/artemisObservedOutcomeContract.js',
);

const PROTECTED_CONTRACT_PATHS = [
  '../../contracts/artemisRiskControlRuntimeBoundaryContract.js',
  '../../contracts/artemisPortfolioControlSizingBoundaryContract.js',
  '../../contracts/artemisLiquidityExecutionFeasibilityBoundaryContract.js',
  '../../contracts/artemisRuntimeCapabilityBoundaryContract.js',
  '../../contracts/artemisOrderManagementExecutionBoundaryContract.js',
  '../../contracts/artemisControlChainContract.js',
  '../../contracts/artemisShadowDecisionRecordingBoundaryContract.js',
  '../../contracts/artemisMarketContextContract.js',
  '../../contracts/artemisMarketContextSourceOfTruthContract.js',
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

function expectReject(result, fieldOrCode, code) {
  expect(result.ok).toBe(false);
  expect(result.artifact).toBeNull();
  const errors = result.errors || [];
  if (code) {
    expect(errors.some((e) => e.field === fieldOrCode && e.code === code)).toBe(true);
  } else {
    expect(errors.some((e) => e.code === fieldOrCode || e.field === fieldOrCode)).toBe(true);
  }
}

describe('S8-OBSERVED-OUTCOME-CONTRACT — Observed Outcome Contract Boundary', () => {
  it('1. accepts a valid observed outcome', () => {
    const result = buildObservedOutcome(validInput());
    expect(result.ok).toBe(true);
    expect(result.code).toBe('OBSERVED_OUTCOME_BUILT');
    expect(result.artifact.artifactType).toBe(OBSERVED_OUTCOME_ARTIFACT_TYPE);
    expect(result.artifact.authorityClass).toBe(OBSERVED_OUTCOME_AUTHORITY_CLASS);
    expect(result.artifact.sliceId).toBe(OBSERVED_OUTCOME_SLICE_ID);
    expect(result.artifact.schemaVersion).toBe(OBSERVED_OUTCOME_SCHEMA_VERSION);
    expect(result.artifact.contractVersion).toBe(OBSERVED_OUTCOME_CONTRACT_VERSION);
    expect(result.artifact.policyVersion).toBe(OBSERVED_OUTCOME_POLICY_VERSION);
    expect(result.artifact.outcomeEvaluationStatus).toBe(OUTCOME_EVALUATION_STATUS);
    expect(result.artifact.realizedPnlStatus).toBe(REALIZED_PNL_STATUS);
    expect(result.artifact.sotStatus).toBe(OBSERVED_OUTCOME_SOT_STATUS);
    expect(result.artifact.ownershipRole).toBe(OBSERVED_OUTCOME_OWNERSHIP_ROLE);
    expect(result.artifact.limitations).toEqual([...OBSERVED_OUTCOME_LIMITATIONS]);
  });

  it('2–3. produces deterministic outcomeId; identical input => identical artifact id', () => {
    const a = buildObservedOutcome(validInput());
    const b = buildObservedOutcome(validInput());
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
    expect(a.artifact.outcomeId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-8[0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(a.artifact.outcomeId).toBe(b.artifact.outcomeId);
    expect(JSON.stringify(a.artifact)).toBe(JSON.stringify(b.artifact));
  });

  it('4. rejects conflicting identity (outcomeId mismatch)', () => {
    const result = buildObservedOutcome(validInput({ outcomeId: OTHER_UUID }));
    expectReject(result, 'outcomeId', 'outcome_id_conflict');
  });

  it('5. rejects missing outcome identity inputs', () => {
    const result = buildObservedOutcome(validInput({
      decisionRef: undefined,
      shadowRecordingRef: undefined,
    }));
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'missing_outcome_identity_inputs'
      || e.code === 'required_object')).toBe(true);
  });

  it('6. rejects invalid decision reference', () => {
    expectReject(
      buildObservedOutcome(validInput({
        decisionRef: decisionRef({ decisionId: 'not-a-uuid' }),
      })),
      'decisionRef.decisionId',
      'invalid_decision_id',
    );
  });

  it('7. rejects invalid decisionContext reference', () => {
    expectReject(
      buildObservedOutcome(validInput({
        decisionContextRef: decisionContextRef({ contextId: 'bad' }),
      })),
      'decisionContextRef.contextId',
      'invalid_context_id',
    );
  });

  it('8. rejects invalid C8.1 recording reference', () => {
    expectReject(
      buildObservedOutcome(validInput({
        shadowRecordingRef: shadowRecordingRef({
          shadowRecordingArtifactId: 'zzz',
        }),
      })),
      'shadowRecordingRef.shadowRecordingArtifactId',
      'invalid_shadow_recording_id',
    );
  });

  it('9. rejects invalid task/cycle lineage refs', () => {
    expectReject(
      buildObservedOutcome(validInput({
        taskRef: { taskId: 'bad', contractVersion: SHADOW_TASK_STATE_CONTRACT_VERSION },
      })),
      'taskRef.taskId',
      'invalid_task_id',
    );
    expectReject(
      buildObservedOutcome(validInput({
        cycleBindingRef: {
          bindingId: 'bad',
          contractVersion: SHADOW_TASK_CYCLE_BINDING_CONTRACT_VERSION,
        },
      })),
      'cycleBindingRef.bindingId',
      'invalid_binding_id',
    );
  });

  it('10. accepts valid post-horizon marketContextRef', () => {
    const result = buildObservedOutcome(validInput({
      marketContextRef: marketContextRef({
        sourceTimestamp: '2026-09-22T10:30:00.000Z',
      }),
    }));
    expect(result.ok).toBe(true);
    expect(result.artifact.marketContextRef.marketContextId).toBe(MC_ID);
  });

  it('11. rejects invalid marketContextRef', () => {
    expectReject(
      buildObservedOutcome(validInput({
        marketContextRef: marketContextRef({ marketContextId: 'nope' }),
      })),
      'marketContextRef.marketContextId',
      'invalid_market_context_id',
    );
  });

  it('12. rejects pre-decision outcomeObservedAt', () => {
    expectReject(
      buildObservedOutcome(validInput({
        outcomeObservedAt: '2026-09-22T09:00:00.000Z',
      })),
      'outcomeObservedAt',
      'pre_decision_outcome_observed_at',
    );
  });

  it('13. rejects malformed timestamp', () => {
    expectReject(
      buildObservedOutcome(validInput({ outcomeObservedAt: 'not-iso' })),
      'outcomeObservedAt',
      'invalid_iso_timestamp',
    );
  });

  it('14. rejects sourceTimestamp inconsistency (pre-decision source)', () => {
    expectReject(
      buildObservedOutcome(validInput({
        marketContextRef: marketContextRef({
          sourceTimestamp: '2026-09-22T09:00:00.000Z',
        }),
      })),
      'marketContextRef.sourceTimestamp',
      'pre_decision_source_timestamp',
    );
  });

  it('15. rejects future/temporal lookahead (source after observed)', () => {
    expectReject(
      buildObservedOutcome(validInput({
        marketContextRef: marketContextRef({
          sourceTimestamp: '2026-09-22T12:00:00.000Z',
        }),
      })),
      'marketContextRef.sourceTimestamp',
      'source_timestamp_after_outcome_observed_at',
    );
  });

  it('16–18. rejects raw OHLCV / ticker / orderbook', () => {
    for (const key of ['ohlcv', 'ticker', 'orderBook']) {
      expectReject(
        buildObservedOutcome(validInput({ [key]: { x: 1 } })),
        key,
        'forbidden_field',
      );
      expectReject(
        buildObservedOutcome(validInput({
          marketContextRef: marketContextRef({ [key]: [] }),
        })),
        `marketContextRef.${key}`,
      );
    }
  });

  it('19. rejects provider/network fields', () => {
    expectReject(
      buildObservedOutcome(validInput({ providerPayload: {} })),
      'providerPayload',
      'forbidden_field',
    );
    expectReject(
      buildObservedOutcome(validInput({ signedQuery: 'x' })),
      'signedQuery',
      'forbidden_field',
    );
  });

  it('20. rejects realizedPnl', () => {
    expectReject(
      buildObservedOutcome(validInput({ realizedPnl: 12.5 })),
      'realizedPnl',
      'forbidden_field',
    );
  });

  it('21. rejects execution fields', () => {
    for (const key of ['order', 'orderId', 'executionIntent', 'executionCommand', 'fill', 'fillPrice']) {
      expectReject(buildObservedOutcome(validInput({ [key]: true })), key, 'forbidden_field');
    }
  });

  it('22. rejects wallet/transfer/withdrawal', () => {
    for (const key of ['wallet', 'transfer', 'withdrawal']) {
      expectReject(buildObservedOutcome(validInput({ [key]: {} })), key, 'forbidden_field');
    }
  });

  it('23–26. rejects evaluationResult / calibrationScore / performanceScore / lookahead', () => {
    for (const key of ['evaluationResult', 'calibrationScore', 'performanceScore', 'lookahead', 'lookAhead']) {
      expectReject(buildObservedOutcome(validInput({ [key]: 1 })), key, 'forbidden_field');
    }
  });

  it('27. rejects unknown fields', () => {
    expectReject(
      buildObservedOutcome(validInput({ totallyUnknownField: 1 })),
      'input.totallyUnknownField',
      'unknown_field',
    );
  });

  it('28–35. authority flags always hard-false; outcomeRecorded observation-only', () => {
    const result = buildObservedOutcome(validInput());
    expect(result.ok).toBe(true);
    for (const [key, value] of Object.entries(REQUIRED_HARD_FLAGS)) {
      expect(result.artifact[key]).toBe(value);
      expect(result.artifact[key]).toBe(false);
    }
    expect(result.artifact.outcomeRecorded).toBe(true);
    expect(result.artifact.outcomeRecorded).not.toBe('trade executed');
    expect(result.artifact.realizedPnlStatus).toBe('UNSUPPORTED_FOR_SHADOW');

    for (const flag of Object.keys(REQUIRED_HARD_FLAGS)) {
      expectReject(
        buildObservedOutcome(validInput({ [flag]: true })),
        flag,
        'hard_flag_must_be_false',
      );
    }
  });

  it('36–42. protected surfaces remain importable / unchanged by this module', async () => {
    for (const rel of PROTECTED_CONTRACT_PATHS) {
      // Dynamic import proves modules load; this slice must not mutate them.
      // eslint-disable-next-line no-await-in-loop
      const mod = await import(rel);
      expect(mod).toBeTruthy();
    }
    const src = readFileSync(CONTRACT_PATH, 'utf8');
    expect(src).not.toMatch(/artemisExecutionGate|tradingEngine|startArtemisScheduler/);
    expect(src).not.toMatch(/from ['"].*pg['"]|from ['"]ioredis|from ['"]axios|from ['"]ccxt/);
    expect(src).not.toMatch(/createPool|fetch\(|http\.request|net\.connect/);
  });

  it('43. zero-side-effect counters remain zero', () => {
    const result = buildObservedOutcome(validInput());
    expect(result.ok).toBe(true);
    expect(result.sideEffects).toEqual({ ...ZERO_OBSERVED_OUTCOME_SIDE_EFFECTS });
    expect(result.artifact.sideEffects).toEqual({ ...ZERO_OBSERVED_OUTCOME_SIDE_EFFECTS });
    for (const value of Object.values(result.sideEffects)) {
      expect(value).toBe(0);
    }
  });

  it('44. deterministic serialization / artifact stability + validate alias', () => {
    const a = buildObservedOutcome(validInput({ correlationId: CORRELATION_ID }));
    const b = validateObservedOutcome(validInput({ correlationId: CORRELATION_ID }));
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
    expect(JSON.stringify(a.artifact)).toBe(JSON.stringify(b.artifact));
    expect(Object.isFrozen(a.artifact)).toBe(true);
  });

  it('accepts optional task / binding / cycle envelope lineage', () => {
    const result = buildObservedOutcome(validInput({
      taskRef: {
        taskId: TASK_ID,
        contractVersion: SHADOW_TASK_STATE_CONTRACT_VERSION,
        attempt: 1,
        status: 'SUCCEEDED',
      },
      cycleBindingRef: {
        bindingId: BINDING_ID,
        contractVersion: SHADOW_TASK_CYCLE_BINDING_CONTRACT_VERSION,
      },
      shadowCycleEnvelopeRef: {
        shadowCycleEnvelopeId: CYCLE_ID,
        contractVersion: SHADOW_RUNTIME_CONTRACT_VERSION,
      },
    }));
    expect(result.ok).toBe(true);
    expect(result.artifact.taskRef.taskId).toBe(TASK_ID);
    expect(result.artifact.cycleBindingRef.bindingId).toBe(BINDING_ID);
    expect(result.artifact.shadowCycleEnvelopeRef.shadowCycleEnvelopeId).toBe(CYCLE_ID);
    expect(result.artifact.lineage.taskId).toBe(TASK_ID);
    expect(result.artifact.lineage.bindingId).toBe(BINDING_ID);
    expect(result.artifact.lineage.shadowCycleEnvelopeId).toBe(CYCLE_ID);
  });

  it('rejects context id mismatch between decision and context refs', () => {
    expectReject(
      buildObservedOutcome(validInput({
        decisionContextRef: decisionContextRef({ contextId: OTHER_UUID }),
      })),
      'decisionContextRef.contextId',
      'context_id_mismatch',
    );
  });

  it('rejects unusable freshness and unavailable market context', () => {
    expectReject(
      buildObservedOutcome(validInput({
        marketContextRef: marketContextRef({
          freshnessStatus: FRESHNESS_STATUS.STALE,
        }),
      })),
      'marketContextRef.freshnessStatus',
      'unusable_freshness',
    );
    expectReject(
      buildObservedOutcome(validInput({
        marketContextRef: marketContextRef({
          availability: AVAILABILITY.UNAVAILABLE,
        }),
      })),
      'marketContextRef.availability',
      'unavailable_market_context',
    );
  });

  it('rejects provenance sourceTimestamp inconsistency', () => {
    expectReject(
      buildObservedOutcome(validInput({
        provenance: {
          writer: OBSERVED_OUTCOME_WRITER,
          methodKey: OBSERVED_OUTCOME_METHOD_KEY,
          stage: OBSERVED_OUTCOME_STAGE,
          sourceTimestamp: '2026-09-22T10:01:00.000Z',
        },
      })),
      'provenance.sourceTimestamp',
      'source_timestamp_inconsistency',
    );
  });

  it('rejects worker/scheduler/runtime activation fields', () => {
    for (const key of [
      'runId', 'workerId', 'lease', 'lock', 'queueState', 'schedulerState',
      'scheduleAt', 'cron', 'PM2', 'b10', 'shadowWorker', 'shadowScheduler',
      'requestedRuntimeMode', 'effectiveRuntimeMode', 'emergencyStopClear',
    ]) {
      expectReject(buildObservedOutcome(validInput({ [key]: 'x' })), key, 'forbidden_field');
    }
  });

  it('rejects incompatible upstream contract versions', () => {
    expectReject(
      buildObservedOutcome(validInput({
        decisionRef: decisionRef({ contractVersion: 'wrong' }),
      })),
      'decisionRef.contractVersion',
      'incompatible_decision_contract',
    );
  });

  it('rejects outcomeObservedAt after recordedAt', () => {
    expectReject(
      buildObservedOutcome(validInput({
        outcomeObservedAt: '2026-09-22T12:00:00.000Z',
        recordedAt: '2026-09-22T11:00:01.000Z',
      })),
      'outcomeObservedAt',
      'outcome_observed_at_after_recorded_at',
    );
  });

  it('does not reuse decisionId/taskId/marketContextId as outcomeId', () => {
    const result = buildObservedOutcome(validInput());
    expect(result.ok).toBe(true);
    expect(result.artifact.outcomeId).not.toBe(DECISION_ID);
    expect(result.artifact.outcomeId).not.toBe(CONTEXT_ID);
    expect(result.artifact.outcomeId).not.toBe(MC_ID);
    expect(result.artifact.outcomeId).not.toBe(RECORDING_ID);
  });

  it('source file has no IO / provider / random identity imports', () => {
    const src = readFileSync(CONTRACT_PATH, 'utf8');
    expect(src).not.toMatch(/Date\.now\(|Math\.random\(|randomUUID\(|randomBytes\(/);
    expect(src).not.toMatch(/from ['"]pg['"]|from ['"]ioredis|from ['"]node:http|from ['"]axios|from ['"]ccxt|from ['"]node-fetch/);
    expect(src).toMatch(/VALIDATION_BOUNDARY/);
    expect(src).toMatch(/UNSUPPORTED_FOR_SHADOW/);
    expect(src).toMatch(/OUTCOME_EVALUATION_STATUS = 'DEFERRED'/);
  });
});
