/**
 * @jest-environment node
 *
 * Artemis Core Stage 9 — S9-REPLAY-RESULT-CONTRACT dedicated tests
 * ARTEMIS_REPLAY_RESULT_CONTRACT_BOUNDARY
 *
 * Library-only RESULT semantic envelope. No replay / reconstruction /
 * recomputation / comparison / evaluation execution.
 */

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from '@jest/globals';

import {
  DECISION_LINEAGE_CONTRACT_VERSION,
  RECONSTRUCTABILITY_STATUS,
} from '../../contracts/artemisDecisionLineageContract.js';
import {
  REPLAY_ARTIFACT_TYPE,
  REPLAY_AUTHORITY_CLASS,
  REPLAY_CONTRACT_VERSION,
  REPLAY_MODE,
  REPLAY_SLICE_ID,
  buildArtemisReplayRequest,
} from '../../contracts/artemisReplayContract.js';
import {
  CANONICAL_WHERE_UPSTREAM_SUPPORTS,
  FORBIDDEN_REPLAY_RESULT_KEYS,
  MAX_REPLAY_RESULT_UTF8_BYTES,
  REPLAY_RESULT_ARTIFACT_TYPE,
  REPLAY_RESULT_AUTHORITY_CLASS,
  REPLAY_RESULT_CLASSIFICATION,
  REPLAY_RESULT_CONTRACT_VERSION,
  REPLAY_RESULT_IS_SOURCE_OF_TRUTH,
  REPLAY_RESULT_METHOD_KEY,
  REPLAY_RESULT_OWNERSHIP_ROLE,
  REPLAY_RESULT_POLICY_VERSION,
  REPLAY_RESULT_SCHEMA_VERSION,
  REPLAY_RESULT_SLICE_ID,
  REQUIRED_HARD_FLAGS,
  UPSTREAM_METADATA_UNAVAILABLE,
  ZERO_REPLAY_RESULT_SIDE_EFFECTS,
  buildArtemisReplayResult,
  computeReplayResultId,
  extractSourceReplayRef,
  hashToUuid,
  validateArtemisReplayResult,
} from '../../contracts/artemisReplayResultContract.js';

const RESULT_RECORDED_AT = '2026-09-22T12:30:00.000Z';
const REPLAY_RECORDED_AT = '2026-09-22T12:00:00.000Z';
const CUTOFF_AT = '2026-09-22T10:00:00.000Z';
const LINEAGE_RECORDED_AT = '2026-09-22T11:00:00.000Z';
const ANALYSIS_AT = '2026-09-22T10:00:00.000Z';
const CREATED_AT = '2026-09-22T10:00:01.000Z';

const LINEAGE_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const OTHER_LINEAGE_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const OTHER_UUID = '33333333-3333-4333-8333-333333333333';

const CONTRACT_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../contracts/artemisReplayResultContract.js'
);
const REPLAY_CONTRACT_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../contracts/artemisReplayContract.js'
);
const LINEAGE_CONTRACT_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../contracts/artemisDecisionLineageContract.js'
);

const PROTECTED_CONTRACT_PATHS = [
  '../../contracts/artemisReplayContract.js',
  '../../contracts/artemisDecisionLineageContract.js',
  '../../contracts/artemisDecisionContract.js',
  '../../contracts/artemisDecisionContextContract.js',
  '../../contracts/artemisEvidenceContract.js',
  '../../contracts/artemisEvidenceOrchestrationContract.js',
  '../../contracts/artemisMarketContextContract.js',
  '../../contracts/artemisMarketContextSourceOfTruthContract.js',
  '../../contracts/artemisShadowDecisionRecordingBoundaryContract.js',
  '../../contracts/artemisShadowRuntimeLibraryBoundaryContract.js',
  '../../contracts/artemisShadowTaskStateBoundaryContract.js',
  '../../contracts/artemisShadowTaskCycleCompositionBoundaryContract.js',
  '../../contracts/artemisShadowTaskStateActivationBoundaryContract.js',
  '../../contracts/artemisObservedOutcomeContract.js',
  '../../contracts/artemisObservedOutcomeSourceOfTruthContract.js',
  '../../contracts/artemisObservedOutcomeEvaluationContract.js',
  '../../contracts/artemisObservedOutcomeEvaluationSourceOfTruthContract.js',
  '../../contracts/artemisRiskControlRuntimeBoundaryContract.js',
  '../../contracts/artemisPortfolioControlSizingBoundaryContract.js',
  '../../contracts/artemisLiquidityExecutionFeasibilityBoundaryContract.js',
  '../../contracts/artemisRuntimeCapabilityBoundaryContract.js',
  '../../contracts/artemisOrderManagementExecutionBoundaryContract.js',
];

const BASELINE_PROTECTED_HASHES = new Map(
  PROTECTED_CONTRACT_PATHS.map((rel) => {
    const abs = path.join(path.dirname(fileURLToPath(import.meta.url)), rel);
    const sha = createHash('sha256').update(readFileSync(abs)).digest('hex');
    return [rel, sha];
  })
);

function thinLineageRef(overrides = {}) {
  return {
    lineageId: LINEAGE_ID,
    contractVersion: DECISION_LINEAGE_CONTRACT_VERSION,
    reconstructabilityStatus: RECONSTRUCTABILITY_STATUS.COMPLETE,
    recordedAt: LINEAGE_RECORDED_AT,
    decisionAnalysisAt: ANALYSIS_AT,
    decisionCreatedAt: CREATED_AT,
    ...overrides,
  };
}

function buildReplayRequest(mode = REPLAY_MODE.ORIGINAL_HISTORICAL, overrides = {}) {
  return buildArtemisReplayRequest({
    recordedAt: REPLAY_RECORDED_AT,
    replayMode: mode,
    historicalCutoffAt: CUTOFF_AT,
    sourceLineageRef: thinLineageRef(),
    ...overrides,
  });
}

function thinSourceReplayRef(overrides = {}) {
  const replay = buildReplayRequest();
  return {
    replayId: replay.replayId,
    contractVersion: REPLAY_CONTRACT_VERSION,
    replayMode: REPLAY_MODE.ORIGINAL_HISTORICAL,
    historicalCutoffAt: CUTOFF_AT,
    recordedAt: REPLAY_RECORDED_AT,
    lineageId: LINEAGE_ID,
    ...overrides,
  };
}

function validOriginalResult(overrides = {}) {
  return {
    recordedAt: RESULT_RECORDED_AT,
    resultClassification: REPLAY_RESULT_CLASSIFICATION.ORIGINAL_HISTORICAL,
    sourceReplayRef: thinSourceReplayRef(),
    ...overrides,
  };
}

function validRecomputationResult(overrides = {}) {
  const replay = buildReplayRequest(REPLAY_MODE.CURRENT_RECOMPUTATION);
  return {
    recordedAt: RESULT_RECORDED_AT,
    resultClassification: REPLAY_RESULT_CLASSIFICATION.CURRENT_RECOMPUTATION,
    sourceReplayRef: {
      replayId: replay.replayId,
      contractVersion: REPLAY_CONTRACT_VERSION,
      replayMode: REPLAY_MODE.CURRENT_RECOMPUTATION,
      historicalCutoffAt: CUTOFF_AT,
      recordedAt: REPLAY_RECORDED_AT,
      lineageId: LINEAGE_ID,
    },
    ...overrides,
  };
}

function expectFail(fn, code) {
  try {
    fn();
    throw new Error(`Expected failure ${code}`);
  } catch (err) {
    expect(err.code).toBe(code);
  }
}

describe('artemisReplayResultContract — S9-REPLAY-RESULT-CONTRACT', () => {
  describe('minimal valid envelopes', () => {
    it('1. builds minimal valid ORIGINAL_HISTORICAL result', () => {
      const art = buildArtemisReplayResult(validOriginalResult());
      expect(art.resultClassification).toBe(REPLAY_MODE.ORIGINAL_HISTORICAL);
      expect(art.artifactType).toBe(REPLAY_RESULT_ARTIFACT_TYPE);
      expect(art.sourceReplayRef.historicalCutoffAt).toBe(CUTOFF_AT);
    });

    it('2. builds minimal valid CURRENT_RECOMPUTATION result', () => {
      const art = buildArtemisReplayResult(validRecomputationResult());
      expect(art.resultClassification).toBe(REPLAY_MODE.CURRENT_RECOMPUTATION);
      expect(art.provenance.resultClassification).toBe(REPLAY_MODE.CURRENT_RECOMPUTATION);
    });

    it('3. authorityClass=REPLAY (never REPLAY_RESULT)', () => {
      const art = buildArtemisReplayResult(validOriginalResult());
      expect(art.authorityClass).toBe('REPLAY');
      expect(art.authorityClass).toBe(REPLAY_AUTHORITY_CLASS);
      expect(REPLAY_RESULT_AUTHORITY_CLASS).toBe(REPLAY_AUTHORITY_CLASS);
      expect(art.authorityClass).not.toBe('REPLAY_RESULT');
    });

    it('4. isSourceOfTruth=false', () => {
      const art = buildArtemisReplayResult(validOriginalResult());
      expect(art.isSourceOfTruth).toBe(false);
      expect(REPLAY_RESULT_IS_SOURCE_OF_TRUTH).toBe(false);
      expect(art.ownershipRole).toBe(REPLAY_RESULT_OWNERSHIP_ROLE);
      expect(art.sliceId).toBe(REPLAY_RESULT_SLICE_ID);
      expect(art.schemaVersion).toBe(REPLAY_RESULT_SCHEMA_VERSION);
      expect(art.contractVersion).toBe(REPLAY_RESULT_CONTRACT_VERSION);
    });
  });

  describe('deterministic result identity', () => {
    it('5. produces deterministic replayResultId', () => {
      const art = buildArtemisReplayResult(validOriginalResult());
      expect(art.replayResultId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
      );
      const expected = computeReplayResultId({
        sourceReplayId: art.sourceReplayRef.replayId,
        resultClassification: REPLAY_MODE.ORIGINAL_HISTORICAL,
        historicalCutoffAt: CUTOFF_AT,
        lineageId: LINEAGE_ID,
        implementationVersion: REPLAY_RESULT_CONTRACT_VERSION,
      });
      expect(art.replayResultId).toBe(expected);
    });

    it('6. identical semantic input => identical replayResultId', () => {
      const a = buildArtemisReplayResult(validOriginalResult());
      const b = buildArtemisReplayResult(validOriginalResult());
      expect(a.replayResultId).toBe(b.replayResultId);
    });

    it('7. source replayId change => result ID changes', () => {
      const a = buildArtemisReplayResult(validOriginalResult());
      const otherReplay = buildReplayRequest(REPLAY_MODE.ORIGINAL_HISTORICAL, {
        sourceLineageRef: thinLineageRef({ lineageId: OTHER_LINEAGE_ID }),
      });
      const b = buildArtemisReplayResult(
        validOriginalResult({
          sourceReplayRef: thinSourceReplayRef({
            replayId: otherReplay.replayId,
            lineageId: OTHER_LINEAGE_ID,
          }),
        })
      );
      expect(a.replayResultId).not.toBe(b.replayResultId);
    });

    it('8. classification change => result ID changes', () => {
      const a = buildArtemisReplayResult(validOriginalResult());
      const b = buildArtemisReplayResult(validRecomputationResult());
      expect(a.replayResultId).not.toBe(b.replayResultId);
    });

    it('recordedAt bookkeeping does not alter replayResultId', () => {
      const a = buildArtemisReplayResult(validOriginalResult());
      const b = buildArtemisReplayResult(
        validOriginalResult({ recordedAt: '2026-09-22T14:00:00.000Z' })
      );
      expect(a.replayResultId).toBe(b.replayResultId);
      expect(a.recordedAt).not.toBe(b.recordedAt);
    });

    it('9. matching caller-supplied replayResultId accepted', () => {
      const base = buildArtemisReplayResult(validOriginalResult());
      const art = buildArtemisReplayResult(
        validOriginalResult({ replayResultId: base.replayResultId })
      );
      expect(art.replayResultId).toBe(base.replayResultId);
    });

    it('10. conflicting replayResultId rejected', () => {
      expectFail(
        () => buildArtemisReplayResult(validOriginalResult({ replayResultId: OTHER_UUID })),
        'REPLAY_RESULT_ID_CONFLICT'
      );
    });

    it('hashToUuid is deterministic and UUIDv4-shaped', () => {
      const a = hashToUuid(['x', 'y']);
      const b = hashToUuid(['x', 'y']);
      expect(a).toBe(b);
      expect(a[14]).toBe('4');
    });
  });

  describe('source Replay binding', () => {
    it('11. source replayId required', () => {
      expectFail(
        () =>
          buildArtemisReplayResult({
            recordedAt: RESULT_RECORDED_AT,
            resultClassification: REPLAY_MODE.ORIGINAL_HISTORICAL,
          }),
        'REPLAY_RESULT_SOURCE_REPLAY_REQUIRED'
      );
    });

    it('12. malformed replayId rejected', () => {
      expectFail(
        () =>
          buildArtemisReplayResult(
            validOriginalResult({
              sourceReplayRef: thinSourceReplayRef({ replayId: 'not-a-uuid' }),
            })
          ),
        'REPLAY_RESULT_SOURCE_REPLAY_ID_INVALID'
      );
    });

    it('13. source Replay contract version consistency', () => {
      expectFail(
        () =>
          buildArtemisReplayResult(
            validOriginalResult({
              sourceReplayRef: thinSourceReplayRef({
                contractVersion: 'artemis-replay-0.0.0',
              }),
            })
          ),
        'REPLAY_RESULT_SOURCE_REPLAY_CONTRACT_VERSION_MISMATCH'
      );
    });

    it('14. source replayMode consistency with classification', () => {
      expectFail(
        () =>
          buildArtemisReplayResult(
            validOriginalResult({
              resultClassification: REPLAY_MODE.CURRENT_RECOMPUTATION,
            })
          ),
        'REPLAY_RESULT_CLASSIFICATION_SOURCE_MODE_MISMATCH'
      );
    });

    it('15. source historicalCutoffAt preserved', () => {
      const art = buildArtemisReplayResult(validOriginalResult());
      expect(art.sourceReplayRef.historicalCutoffAt).toBe(CUTOFF_AT);
    });

    it('16. source lineageId preserved where available', () => {
      const art = buildArtemisReplayResult(validOriginalResult());
      expect(art.sourceReplayRef.lineageId).toBe(LINEAGE_ID);
    });

    it('17. source recordedAt preserved where available', () => {
      const art = buildArtemisReplayResult(validOriginalResult());
      expect(art.sourceReplayRef.recordedAt).toBe(REPLAY_RECORDED_AT);
    });
  });

  describe('sourceReplayArtifact extract', () => {
    it('18. accepts valid sourceReplayArtifact', () => {
      const replay = buildReplayRequest();
      const art = buildArtemisReplayResult({
        recordedAt: RESULT_RECORDED_AT,
        resultClassification: REPLAY_MODE.ORIGINAL_HISTORICAL,
        sourceReplayArtifact: replay,
      });
      expect(art.sourceReplayRef.replayId).toBe(replay.replayId);
    });

    it('19. source artifact converted to thin ref', () => {
      const replay = buildReplayRequest();
      const art = buildArtemisReplayResult({
        recordedAt: RESULT_RECORDED_AT,
        resultClassification: REPLAY_MODE.ORIGINAL_HISTORICAL,
        sourceReplayArtifact: replay,
      });
      expect(Object.keys(art.sourceReplayRef).sort()).toEqual(
        ['contractVersion', 'historicalCutoffAt', 'lineageId', 'recordedAt', 'replayId', 'replayMode'].sort()
      );
    });

    it('20. full source Replay artifact not embedded in output', () => {
      const replay = buildReplayRequest();
      const art = buildArtemisReplayResult({
        recordedAt: RESULT_RECORDED_AT,
        resultClassification: REPLAY_MODE.ORIGINAL_HISTORICAL,
        sourceReplayArtifact: replay,
      });
      expect(art.sourceReplayArtifact).toBeUndefined();
      expect(art.sourceLineageRef).toBeUndefined();
      expect(JSON.stringify(art)).not.toContain('sourceLineageRef');
    });

    it('21. sourceReplayRef + artifact matching accepted', () => {
      const replay = buildReplayRequest();
      const art = buildArtemisReplayResult({
        recordedAt: RESULT_RECORDED_AT,
        resultClassification: REPLAY_MODE.ORIGINAL_HISTORICAL,
        sourceReplayArtifact: replay,
        sourceReplayRef: {
          replayId: replay.replayId,
          contractVersion: REPLAY_CONTRACT_VERSION,
          replayMode: REPLAY_MODE.ORIGINAL_HISTORICAL,
          historicalCutoffAt: CUTOFF_AT,
          recordedAt: REPLAY_RECORDED_AT,
          lineageId: LINEAGE_ID,
        },
      });
      expect(art.sourceReplayRef.replayId).toBe(replay.replayId);
    });

    it('22. sourceReplayRef + artifact replayId conflict rejected', () => {
      const replay = buildReplayRequest();
      const other = buildReplayRequest(REPLAY_MODE.ORIGINAL_HISTORICAL, {
        sourceLineageRef: thinLineageRef({ lineageId: OTHER_LINEAGE_ID }),
      });
      expectFail(
        () =>
          buildArtemisReplayResult({
            recordedAt: RESULT_RECORDED_AT,
            resultClassification: REPLAY_MODE.ORIGINAL_HISTORICAL,
            sourceReplayArtifact: replay,
            sourceReplayRef: thinSourceReplayRef({ replayId: other.replayId }),
          }),
        'REPLAY_RESULT_SOURCE_REPLAY_ID_CONFLICT'
      );
    });

    it('23. replayMode conflict rejected', () => {
      const replay = buildReplayRequest();
      expectFail(
        () =>
          buildArtemisReplayResult({
            recordedAt: RESULT_RECORDED_AT,
            resultClassification: REPLAY_MODE.ORIGINAL_HISTORICAL,
            sourceReplayArtifact: replay,
            sourceReplayRef: thinSourceReplayRef({
              replayId: replay.replayId,
              replayMode: REPLAY_MODE.CURRENT_RECOMPUTATION,
            }),
          }),
        'REPLAY_RESULT_SOURCE_REPLAY_MODE_CONFLICT'
      );
    });

    it('24. historicalCutoff conflict rejected', () => {
      const replay = buildReplayRequest();
      expectFail(
        () =>
          buildArtemisReplayResult({
            recordedAt: RESULT_RECORDED_AT,
            resultClassification: REPLAY_MODE.ORIGINAL_HISTORICAL,
            sourceReplayArtifact: replay,
            sourceReplayRef: thinSourceReplayRef({
              replayId: replay.replayId,
              historicalCutoffAt: '2026-09-22T09:00:00.000Z',
            }),
          }),
        'REPLAY_RESULT_SOURCE_HISTORICAL_CUTOFF_CONFLICT'
      );
    });

    it('25. lineageId conflict rejected', () => {
      const replay = buildReplayRequest();
      expectFail(
        () =>
          buildArtemisReplayResult({
            recordedAt: RESULT_RECORDED_AT,
            resultClassification: REPLAY_MODE.ORIGINAL_HISTORICAL,
            sourceReplayArtifact: replay,
            sourceReplayRef: thinSourceReplayRef({
              replayId: replay.replayId,
              lineageId: OTHER_LINEAGE_ID,
            }),
          }),
        'REPLAY_RESULT_SOURCE_LINEAGE_ID_CONFLICT'
      );
    });

    it('extractSourceReplayRef rejects wrong artifactType', () => {
      const replay = buildReplayRequest();
      expectFail(
        () => extractSourceReplayRef({ ...replay, artifactType: 'WRONG' }),
        'REPLAY_RESULT_SOURCE_REPLAY_ARTIFACT_TYPE_INVALID'
      );
    });

    it('extractSourceReplayRef rejects wrong authority', () => {
      const replay = buildReplayRequest();
      expectFail(
        () => extractSourceReplayRef({ ...replay, authorityClass: 'DECISION_LINEAGE' }),
        'REPLAY_RESULT_SOURCE_REPLAY_AUTHORITY_INVALID'
      );
    });
  });

  describe('result classification vocabulary', () => {
    it('26. ORIGINAL_HISTORICAL classification accepted', () => {
      const art = buildArtemisReplayResult(validOriginalResult());
      expect(art.resultClassification).toBe(REPLAY_MODE.ORIGINAL_HISTORICAL);
    });

    it('27. CURRENT_RECOMPUTATION classification accepted', () => {
      const art = buildArtemisReplayResult(validRecomputationResult());
      expect(art.resultClassification).toBe(REPLAY_MODE.CURRENT_RECOMPUTATION);
    });

    it('28. unknown result classification rejected', () => {
      expectFail(
        () =>
          buildArtemisReplayResult(
            validOriginalResult({ resultClassification: 'SUCCESS' })
          ),
        'REPLAY_RESULT_CLASSIFICATION_UNKNOWN'
      );
    });

    it('29. no silent classification conversion — PAPER rejected', () => {
      expectFail(
        () =>
          buildArtemisReplayResult(validOriginalResult({ resultClassification: 'PAPER' })),
        'REPLAY_RESULT_CLASSIFICATION_UNKNOWN'
      );
    });

    it('30. ORIGINAL source cannot become CURRENT result', () => {
      expectFail(
        () =>
          buildArtemisReplayResult(
            validOriginalResult({
              resultClassification: REPLAY_MODE.CURRENT_RECOMPUTATION,
            })
          ),
        'REPLAY_RESULT_CLASSIFICATION_SOURCE_MODE_MISMATCH'
      );
    });

    it('31. CURRENT source cannot claim ORIGINAL historical result', () => {
      const replay = buildReplayRequest(REPLAY_MODE.CURRENT_RECOMPUTATION);
      expectFail(
        () =>
          buildArtemisReplayResult({
            recordedAt: RESULT_RECORDED_AT,
            resultClassification: REPLAY_MODE.ORIGINAL_HISTORICAL,
            sourceReplayRef: {
              replayId: replay.replayId,
              contractVersion: REPLAY_CONTRACT_VERSION,
              replayMode: REPLAY_MODE.CURRENT_RECOMPUTATION,
              historicalCutoffAt: CUTOFF_AT,
              recordedAt: REPLAY_RECORDED_AT,
              lineageId: LINEAGE_ID,
            },
          }),
        'REPLAY_RESULT_CLASSIFICATION_SOURCE_MODE_MISMATCH'
      );
    });
  });

  describe('temporal integrity', () => {
    it('32. explicit recordedAt required', () => {
      const { recordedAt: _r, ...rest } = validOriginalResult();
      expectFail(() => buildArtemisReplayResult(rest), 'REPLAY_RESULT_RECORDED_AT_INVALID');
    });

    it('33. malformed recordedAt rejected', () => {
      expectFail(
        () => buildArtemisReplayResult(validOriginalResult({ recordedAt: 'not-iso' })),
        'REPLAY_RESULT_RECORDED_AT_INVALID'
      );
    });

    it('34. hidden current clock not used (same ID across wall-clock)', () => {
      const a = buildArtemisReplayResult(validOriginalResult());
      const b = buildArtemisReplayResult(validOriginalResult());
      expect(a.replayResultId).toBe(b.replayResultId);
      expect(a.recordedAt).toBe(RESULT_RECORDED_AT);
    });

    it('35. result recordedAt before source rejected', () => {
      expectFail(
        () =>
          buildArtemisReplayResult(
            validOriginalResult({ recordedAt: '2026-09-22T11:00:00.000Z' })
          ),
        'REPLAY_RESULT_RECORDED_AT_BEFORE_SOURCE'
      );
    });
  });

  describe('look-ahead / contamination', () => {
    const cases = [
      ['36. lookahead', { lookahead: true }],
      ['37. futureData', { futureData: {} }],
      ['38. futureEvidence', { futureEvidence: {} }],
      ['39. futureMarketData', { futureMarketData: {} }],
      ['40. currentDataAsHistorical', { currentDataAsHistorical: true }],
      ['41. currentModelAsHistorical', { currentModelAsHistorical: true }],
      ['42. currentProviderAsHistorical', { currentProviderAsHistorical: true }],
    ];
    for (const [name, extra] of cases) {
      it(name, () => {
        expectFail(
          () => buildArtemisReplayResult(validOriginalResult(extra)),
          'REPLAY_RESULT_FORBIDDEN_FIELD'
        );
      });
    }
  });

  describe('raw market / provider payload rejection', () => {
    const cases = [
      ['43. ohlcv', { ohlcv: [] }],
      ['44. candles', { candles: [] }],
      ['45. ticker', { ticker: {} }],
      ['46. orderBook', { orderBook: {} }],
      ['46b. depth', { depth: {} }],
      ['47. rawMarketData', { rawMarketData: {} }],
      ['48. providerResponse', { providerResponse: {} }],
      ['49. exchangeResponse', { exchangeResponse: {} }],
    ];
    for (const [name, extra] of cases) {
      it(name, () => {
        expectFail(
          () => buildArtemisReplayResult(validOriginalResult(extra)),
          'REPLAY_RESULT_FORBIDDEN_FIELD'
        );
      });
    }
  });

  describe('no result payload fabrication', () => {
    const cases = [
      ['50. replayedDecision', { replayedDecision: {} }],
      ['51. reconstructedDecision', { reconstructedDecision: {} }],
      ['52. recomputedDecision', { recomputedDecision: {} }],
      ['53. replayedEvidence', { replayedEvidence: {} }],
      ['54. recomputedEvidence', { recomputedEvidence: {} }],
      ['55. modelOutput', { modelOutput: {} }],
      ['56. providerOutput', { providerOutput: {} }],
    ];
    for (const [name, extra] of cases) {
      it(name, () => {
        expectFail(
          () => buildArtemisReplayResult(validOriginalResult(extra)),
          'REPLAY_RESULT_FORBIDDEN_FIELD'
        );
      });
    }
  });

  describe('no Outcome / Evaluation / comparison', () => {
    const cases = [
      ['57. outcome', { outcome: {} }],
      ['58. evaluation', { evaluation: {} }],
      ['59. evaluationScore', { evaluationScore: 1 }],
      ['60. comparisonResult', { comparisonResult: {} }],
      ['61. delta', { delta: 1 }],
      ['61b. matchRate', { matchRate: 0.9 }],
      ['61c. agreementRate', { agreementRate: 1 }],
    ];
    for (const [name, extra] of cases) {
      it(name, () => {
        expectFail(
          () => buildArtemisReplayResult(validOriginalResult(extra)),
          'REPLAY_RESULT_FORBIDDEN_FIELD'
        );
      });
    }
  });

  describe('financial contamination', () => {
    const cases = [
      ['62. realizedPnl', { realizedPnl: 1 }],
      ['63. simulatedPnl', { simulatedPnl: 1 }],
      ['64. ROI', { ROI: 1 }],
      ['65. profit', { profit: 1 }],
      ['66. financialResult', { financialResult: {} }],
      ['66b. wallet', { wallet: {} }],
      ['66c. order', { order: {} }],
    ];
    for (const [name, extra] of cases) {
      it(name, () => {
        expectFail(
          () => buildArtemisReplayResult(validOriginalResult(extra)),
          'REPLAY_RESULT_FORBIDDEN_FIELD'
        );
      });
    }
  });

  describe('version honesty', () => {
    it('67. modelVersion fabrication rejected', () => {
      expectFail(
        () =>
          buildArtemisReplayResult(
            validOriginalResult({
              versions: { modelVersion: 'gpt-x' },
            })
          ),
        'REPLAY_RESULT_FORBIDDEN_FIELD'
      );
    });

    it('68. configurationVersion fabrication rejected', () => {
      expectFail(
        () =>
          buildArtemisReplayResult(
            validOriginalResult({
              versions: { configurationVersion: 'cfg-1' },
            })
          ),
        'REPLAY_RESULT_FORBIDDEN_FIELD'
      );
    });

    it('69. model snapshot ID rejected', () => {
      expectFail(
        () =>
          buildArtemisReplayResult(
            validOriginalResult({
              versions: { modelSnapshotId: OTHER_UUID },
            })
          ),
        'REPLAY_RESULT_FORBIDDEN_FIELD'
      );
    });

    it('70. configuration snapshot ID rejected', () => {
      expectFail(
        () =>
          buildArtemisReplayResult(
            validOriginalResult({
              versions: { configurationSnapshotId: OTHER_UUID },
            })
          ),
        'REPLAY_RESULT_FORBIDDEN_FIELD'
      );
    });

    it('upstream unavailable metadata remains unavailable', () => {
      const art = buildArtemisReplayResult(validOriginalResult());
      expect(art.versions.modelVersionCanonicalStatus).toBe(UPSTREAM_METADATA_UNAVAILABLE);
      expect(art.versions.configurationVersionCanonicalStatus).toBe(
        UPSTREAM_METADATA_UNAVAILABLE
      );
      expect(art.versions.policyVersionCanonicalStatus).toBe(CANONICAL_WHERE_UPSTREAM_SUPPORTS);
      expect(art.versions.implementationVersionCanonicalStatus).toBe(
        CANONICAL_WHERE_UPSTREAM_SUPPORTS
      );
    });
  });

  describe('strict allowlist / fail-closed', () => {
    it('71. unknown top-level field rejected', () => {
      expectFail(
        () => buildArtemisReplayResult(validOriginalResult({ unexpectedField: 1 })),
        'REPLAY_RESULT_UNKNOWN_FIELD'
      );
    });

    it('72. unknown nested source ref field rejected', () => {
      expectFail(
        () =>
          buildArtemisReplayResult(
            validOriginalResult({
              sourceReplayRef: thinSourceReplayRef({ extra: 1 }),
            })
          ),
        'REPLAY_RESULT_SOURCE_REPLAY_REF_UNKNOWN_FIELD'
      );
    });

    it('73. unknown provenance field rejected', () => {
      expectFail(
        () =>
          buildArtemisReplayResult(
            validOriginalResult({
              provenance: { writer: 'x', weird: 'y' },
            })
          ),
        'REPLAY_RESULT_PROVENANCE_UNKNOWN_FIELD'
      );
    });

    it('74. unknown versions field rejected', () => {
      expectFail(
        () =>
          buildArtemisReplayResult(
            validOriginalResult({
              versions: { mysteryVersion: '1' },
            })
          ),
        'REPLAY_RESULT_VERSIONS_UNKNOWN_FIELD'
      );
    });

    it('75. secret field rejected', () => {
      expectFail(
        () =>
          buildArtemisReplayResult(
            validOriginalResult({
              provenance: { writer: 'x', apiKey: 'sekrit' },
            })
          ),
        'REPLAY_RESULT_FORBIDDEN_FIELD'
      );
    });
  });

  describe('hard authority flags', () => {
    it('76. executionEligible=true rejected', () => {
      expectFail(
        () => buildArtemisReplayResult(validOriginalResult({ executionEligible: true })),
        'REPLAY_RESULT_AUTHORITY_FLAG_INVALID'
      );
    });

    it('77. replayActivated=true rejected', () => {
      expectFail(
        () => buildArtemisReplayResult(validOriginalResult({ replayActivated: true })),
        'REPLAY_RESULT_AUTHORITY_FLAG_INVALID'
      );
    });

    it('78. replayExecutionAuthorized=true rejected', () => {
      expectFail(
        () =>
          buildArtemisReplayResult(
            validOriginalResult({ replayExecutionAuthorized: true })
          ),
        'REPLAY_RESULT_AUTHORITY_FLAG_INVALID'
      );
    });

    it('79. reconstructionExecutionAuthorized=true rejected', () => {
      expectFail(
        () =>
          buildArtemisReplayResult(
            validOriginalResult({ reconstructionExecutionAuthorized: true })
          ),
        'REPLAY_RESULT_AUTHORITY_FLAG_INVALID'
      );
    });

    it('80. modelRecomputationAuthorized=true rejected', () => {
      expectFail(
        () =>
          buildArtemisReplayResult(
            validOriginalResult({ modelRecomputationAuthorized: true })
          ),
        'REPLAY_RESULT_AUTHORITY_FLAG_INVALID'
      );
    });

    it('81. providerRecomputationAuthorized=true rejected', () => {
      expectFail(
        () =>
          buildArtemisReplayResult(
            validOriginalResult({ providerRecomputationAuthorized: true })
          ),
        'REPLAY_RESULT_AUTHORITY_FLAG_INVALID'
      );
    });

    it('82. persistenceEnabled=true rejected', () => {
      expectFail(
        () => buildArtemisReplayResult(validOriginalResult({ persistenceEnabled: true })),
        'REPLAY_RESULT_AUTHORITY_FLAG_INVALID'
      );
    });

    it('all REQUIRED_HARD_FLAGS false on artifact', () => {
      const art = buildArtemisReplayResult(validOriginalResult());
      for (const [k, v] of Object.entries(REQUIRED_HARD_FLAGS)) {
        expect(art[k]).toBe(false);
        expect(v).toBe(false);
      }
    });
  });

  describe('provenance / immutability / size / side effects', () => {
    it('83. provenance preserved', () => {
      const art = buildArtemisReplayResult(validOriginalResult());
      expect(art.provenance.writer).toBe('artemisReplayResultContract');
      expect(art.provenance.methodKey).toBe(REPLAY_RESULT_METHOD_KEY);
      expect(art.provenance.stage).toBe('ARTEMIS_CORE_STAGE_9');
      expect(art.provenance.policyVersion).toBe(REPLAY_RESULT_POLICY_VERSION);
    });

    it('84. classification provenance consistent', () => {
      const art = buildArtemisReplayResult(validOriginalResult());
      expect(art.provenance.resultClassification).toBe(art.resultClassification);
    });

    it('85. upstream unavailable in provenance', () => {
      const art = buildArtemisReplayResult(validOriginalResult());
      expect(art.provenance.modelVersionCanonicalStatus).toBe(UPSTREAM_METADATA_UNAVAILABLE);
      expect(art.provenance.configurationVersionCanonicalStatus).toBe(
        UPSTREAM_METADATA_UNAVAILABLE
      );
    });

    it('86. deterministic identity excludes hidden time', () => {
      const id1 = computeReplayResultId({
        sourceReplayId: OTHER_UUID,
        resultClassification: REPLAY_MODE.ORIGINAL_HISTORICAL,
        historicalCutoffAt: CUTOFF_AT,
        lineageId: LINEAGE_ID,
        implementationVersion: REPLAY_RESULT_CONTRACT_VERSION,
      });
      const id2 = computeReplayResultId({
        sourceReplayId: OTHER_UUID,
        resultClassification: REPLAY_MODE.ORIGINAL_HISTORICAL,
        historicalCutoffAt: CUTOFF_AT,
        lineageId: LINEAGE_ID,
        implementationVersion: REPLAY_RESULT_CONTRACT_VERSION,
      });
      expect(id1).toBe(id2);
    });

    it('87. immutable result', () => {
      const art = buildArtemisReplayResult(validOriginalResult());
      expect(Object.isFrozen(art)).toBe(true);
      expect(Object.isFrozen(art.sourceReplayRef)).toBe(true);
      expect(Object.isFrozen(art.sideEffects)).toBe(true);
      expect(() => {
        art.resultClassification = 'MUTATED';
      }).toThrow();
    });

    it('88. caller mutation cannot alter result', () => {
      const input = validOriginalResult();
      const art = buildArtemisReplayResult(input);
      input.resultClassification = REPLAY_MODE.CURRENT_RECOMPUTATION;
      input.sourceReplayRef.replayId = OTHER_UUID;
      expect(art.resultClassification).toBe(REPLAY_MODE.ORIGINAL_HISTORICAL);
      expect(art.sourceReplayRef.replayId).not.toBe(OTHER_UUID);
    });

    it('89. artifact size bound enforced', () => {
      const art = buildArtemisReplayResult(validOriginalResult());
      const bytes = Buffer.byteLength(JSON.stringify(art), 'utf8');
      expect(bytes).toBeLessThanOrEqual(MAX_REPLAY_RESULT_UTF8_BYTES);
      expect(MAX_REPLAY_RESULT_UTF8_BYTES).toBeLessThanOrEqual(24 * 1024);
    });

    it('90. zero side effects', () => {
      const art = buildArtemisReplayResult(validOriginalResult());
      expect(art.sideEffects).toEqual(ZERO_REPLAY_RESULT_SIDE_EFFECTS);
      expect(art.sideEffects.replayExecution).toBe(0);
      expect(art.sideEffects.reconstructionExecution).toBe(0);
      expect(art.sideEffects.modelRecomputation).toBe(0);
      expect(art.sideEffects.providerRecomputation).toBe(0);
      expect(art.sideEffects.comparisonExecution).toBe(0);
      expect(art.sideEffects.evaluationExecution).toBe(0);
      expect(art.sideEffects.dbWriteCount).toBe(0);
      expect(art.sideEffects.networkRequestCount).toBe(0);
    });

    it('nonzero sideEffects rejected', () => {
      expectFail(
        () =>
          buildArtemisReplayResult(
            validOriginalResult({
              sideEffects: { ...ZERO_REPLAY_RESULT_SIDE_EFFECTS, comparisonExecution: 1 },
            })
          ),
        'REPLAY_RESULT_SIDE_EFFECTS_NONZERO'
      );
    });

    it('validateArtemisReplayResult aliases build', () => {
      const a = buildArtemisReplayResult(validOriginalResult());
      const b = validateArtemisReplayResult(validOriginalResult());
      expect(a).toEqual(b);
    });
  });

  describe('import hygiene', () => {
    const src = readFileSync(CONTRACT_PATH, 'utf8');

    it('91. no DB imports', () => {
      expect(src).not.toMatch(/from ['"].*database/);
      expect(src).not.toMatch(/node-pg|pg\.Pool|createPool/);
    });

    it('92. no Redis imports', () => {
      expect(src).not.toMatch(/ioredis|createClient|from ['"].*redis/i);
    });

    it('93. no provider/network imports', () => {
      expect(src).not.toMatch(/mexc|ccxt|axios|node-fetch|undici/i);
      expect(src).not.toMatch(/market-proxy|marketProxy/);
    });

    it('94. no LLM imports', () => {
      expect(src).not.toMatch(/openai|anthropic|gemini|deepseek/i);
    });

    it('95. no Worker/Scheduler imports', () => {
      expect(src).not.toMatch(/engineWorkerLeader|scheduler\.js|messageQueue/);
      expect(src).not.toMatch(/startArtemisScheduler/);
    });

    it('96. no B10 import', () => {
      expect(src).not.toMatch(/b10WriteAttempted:\s*true/);
      expect(src).toMatch(/b10WriteAttempted:\s*false/);
    });

    it('97. no Replay Service import', () => {
      expect(src).not.toMatch(/artemisReplayService/);
      expect(src).not.toMatch(/from ['"].*services\//);
    });

    it('98. no Replay Engine import', () => {
      expect(src).not.toMatch(/artemisReplayEngine/);
      expect(src).not.toMatch(/from ['"].*repositories\//);
    });

    it('99. no reconstruction / trading / orchestrator imports', () => {
      expect(src).not.toMatch(/artemisOrchestrator|artemisExecutionGate|tradingEngine/);
      expect(src).not.toMatch(/runtimeExecutionStateService|artemisDecisionPersistenceService/);
    });

    it('100. no evaluation/comparison execution — flags stay false / counters zero', () => {
      const art = buildArtemisReplayResult(validOriginalResult());
      expect(art.sideEffects.comparisonExecution).toBe(0);
      expect(art.sideEffects.evaluationExecution).toBe(0);
      expect(art.replayExecutionAuthorized).toBe(false);
      expect(art.reconstructionExecutionAuthorized).toBe(false);
      expect(art.modelRecomputationAuthorized).toBe(false);
      expect(art.providerRecomputationAuthorized).toBe(false);
    });

    it('imports only crypto helpers + Replay Contract', () => {
      expect(src).toMatch(/from ['"]\.\/artemisReplayContract\.js['"]/);
      expect(src).toMatch(/from ['"]\.\/artemisEvidenceContract\.js['"]/);
      expect(src).not.toMatch(/from ['"]\.\/artemisDecisionLineageContract\.js['"]/);
    });
  });

  describe('protected surfaces', () => {
    it('101. Replay Contract file unchanged', () => {
      const before = createHash('sha256').update(readFileSync(REPLAY_CONTRACT_PATH)).digest('hex');
      buildArtemisReplayResult(validOriginalResult());
      const after = createHash('sha256').update(readFileSync(REPLAY_CONTRACT_PATH)).digest('hex');
      expect(after).toBe(before);
      expect(BASELINE_PROTECTED_HASHES.get('../../contracts/artemisReplayContract.js')).toBe(after);
    });

    it('102. Decision Lineage file unchanged', () => {
      const before = createHash('sha256').update(readFileSync(LINEAGE_CONTRACT_PATH)).digest('hex');
      buildArtemisReplayResult(validOriginalResult());
      const after = createHash('sha256').update(readFileSync(LINEAGE_CONTRACT_PATH)).digest('hex');
      expect(after).toBe(before);
    });

    it('103. frozen Stage 8 / Control Chain / lineage owners unchanged', () => {
      for (const [rel, expected] of BASELINE_PROTECTED_HASHES) {
        const abs = path.join(path.dirname(fileURLToPath(import.meta.url)), rel);
        const actual = createHash('sha256').update(readFileSync(abs)).digest('hex');
        expect(actual).toBe(expected);
      }
    });

    it('isSourceOfTruth=true rejected', () => {
      expectFail(
        () => buildArtemisReplayResult(validOriginalResult({ isSourceOfTruth: true })),
        'REPLAY_RESULT_IS_SOURCE_OF_TRUTH_INVALID'
      );
    });

    it('authorityClass REPLAY_RESULT rejected', () => {
      expectFail(
        () =>
          buildArtemisReplayResult(
            validOriginalResult({ authorityClass: 'REPLAY_RESULT' })
          ),
        'REPLAY_RESULT_AUTHORITY_CLASS_MISMATCH'
      );
    });
  });

  describe('adversarial extras', () => {
    it('LIVE / SIMULATION / ORDER_REPLAY classifications rejected', () => {
      for (const bad of ['LIVE', 'SIMULATION', 'ORDER_REPLAY', 'PROVIDER_REPLAY', 'FAIL']) {
        expectFail(
          () =>
            buildArtemisReplayResult(validOriginalResult({ resultClassification: bad })),
          'REPLAY_RESULT_CLASSIFICATION_UNKNOWN'
        );
      }
    });

    it('source artifact with wrong contract version rejected', () => {
      const replay = buildReplayRequest();
      expectFail(
        () =>
          extractSourceReplayRef({
            ...replay,
            contractVersion: 'artemis-replay-0.0.1',
          }),
        'REPLAY_RESULT_SOURCE_REPLAY_CONTRACT_VERSION_MISMATCH'
      );
    });

    it('source artifact with replayActivated=true rejected', () => {
      const replay = buildReplayRequest();
      expectFail(
        () => extractSourceReplayRef({ ...replay, replayActivated: true }),
        'REPLAY_RESULT_SOURCE_REPLAY_AUTHORITY_INVALID'
      );
    });

    it('source artifact wrong sliceId rejected', () => {
      const replay = buildReplayRequest();
      expectFail(
        () => extractSourceReplayRef({ ...replay, sliceId: 'S9-WRONG' }),
        'REPLAY_RESULT_SOURCE_REPLAY_SLICE_INVALID'
      );
    });

    it('malformed lineageId on thin ref rejected', () => {
      expectFail(
        () =>
          buildArtemisReplayResult(
            validOriginalResult({
              sourceReplayRef: thinSourceReplayRef({ lineageId: 'bad' }),
            })
          ),
        'REPLAY_RESULT_SOURCE_LINEAGE_ID_INVALID'
      );
    });

    it('missing historicalCutoffAt on thin ref rejected', () => {
      const ref = thinSourceReplayRef();
      delete ref.historicalCutoffAt;
      expectFail(
        () =>
          buildArtemisReplayResult({
            recordedAt: RESULT_RECORDED_AT,
            resultClassification: REPLAY_MODE.ORIGINAL_HISTORICAL,
            sourceReplayRef: ref,
          }),
        'REPLAY_RESULT_SOURCE_HISTORICAL_CUTOFF_REQUIRED'
      );
    });

    it('missing replayMode on thin ref rejected', () => {
      const ref = thinSourceReplayRef();
      delete ref.replayMode;
      expectFail(
        () =>
          buildArtemisReplayResult({
            recordedAt: RESULT_RECORDED_AT,
            resultClassification: REPLAY_MODE.ORIGINAL_HISTORICAL,
            sourceReplayRef: ref,
          }),
        'REPLAY_RESULT_SOURCE_REPLAY_MODE_REQUIRED'
      );
    });

    it('FORBIDDEN_REPLAY_RESULT_KEYS includes comparison and fabrication keys', () => {
      expect(FORBIDDEN_REPLAY_RESULT_KEYS.has('comparisonResult')).toBe(true);
      expect(FORBIDDEN_REPLAY_RESULT_KEYS.has('replayedDecision')).toBe(true);
      expect(FORBIDDEN_REPLAY_RESULT_KEYS.has('evaluationScore')).toBe(true);
      expect(FORBIDDEN_REPLAY_RESULT_KEYS.has('realizedPnl')).toBe(true);
    });

    it('nested forbidden key under provenance note path is scanned', () => {
      expectFail(
        () =>
          buildArtemisReplayResult(
            validOriginalResult({
              limitations: ['ok'],
              provenance: {
                writer: 'artemisReplayResultContract',
                methodKey: REPLAY_RESULT_METHOD_KEY,
                stage: 'ARTEMIS_CORE_STAGE_9',
                recordedAt: RESULT_RECORDED_AT,
                policyVersion: REPLAY_RESULT_POLICY_VERSION,
                implementationVersion: REPLAY_RESULT_CONTRACT_VERSION,
                resultClassification: REPLAY_MODE.ORIGINAL_HISTORICAL,
                modelVersionCanonicalStatus: UPSTREAM_METADATA_UNAVAILABLE,
                configurationVersionCanonicalStatus: UPSTREAM_METADATA_UNAVAILABLE,
                note: 'x',
                lookahead: true,
              },
            })
          ),
        'REPLAY_RESULT_FORBIDDEN_FIELD'
      );
    });

    it('artifactType / sliceId / schema mismatch rejected', () => {
      expectFail(
        () =>
          buildArtemisReplayResult(
            validOriginalResult({ artifactType: REPLAY_ARTIFACT_TYPE })
          ),
        'REPLAY_RESULT_ARTIFACT_TYPE_MISMATCH'
      );
      expectFail(
        () =>
          buildArtemisReplayResult(
            validOriginalResult({ sliceId: REPLAY_SLICE_ID })
          ),
        'REPLAY_RESULT_SLICE_ID_MISMATCH'
      );
    });
  });
});
