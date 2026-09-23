/**
 * @jest-environment node
 *
 * Artemis Core Stage 9 — S9-REPLAY-CONTRACT
 * ARTEMIS_REPLAY_CONTRACT_BOUNDARY unit tests.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from '@jest/globals';
import {
  DECISION_LINEAGE_CONTRACT_VERSION,
  RECONSTRUCTABILITY_STATUS,
  buildDecisionLineage,
} from '../../contracts/artemisDecisionLineageContract.js';
import { DECISION_CONTRACT_VERSION } from '../../contracts/artemisDecisionContract.js';
import { DECISION_CONTEXT_CONTRACT_VERSION } from '../../contracts/artemisDecisionContextContract.js';
import {
  REPLAY_ARTIFACT_TYPE,
  REPLAY_AUTHORITY_CLASS,
  REPLAY_CONTRACT_VERSION,
  REPLAY_IS_SOURCE_OF_TRUTH,
  REPLAY_MODE,
  REPLAY_OWNERSHIP_ROLE,
  REPLAY_SCHEMA_VERSION,
  REPLAY_SLICE_ID,
  REQUIRED_HARD_FLAGS,
  UPSTREAM_METADATA_UNAVAILABLE,
  ZERO_REPLAY_SIDE_EFFECTS,
  buildArtemisReplayRequest,
  computeReplayId,
  hashToUuid,
  validateArtemisReplayRequest,
} from '../../contracts/artemisReplayContract.js';

const LINEAGE_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const OTHER_LINEAGE_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const DECISION_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const CONTEXT_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

const ANALYSIS_AT = '2026-09-22T10:00:00.000Z';
const CREATED_AT = '2026-09-22T10:00:01.000Z';
const LINEAGE_RECORDED_AT = '2026-09-22T11:00:03.000Z';
const CUTOFF_AT = '2026-09-22T10:00:00.000Z';
const CUTOFF_AFTER_DECISION = '2026-09-22T12:00:00.000Z';
const REPLAY_RECORDED_AT = '2026-09-22T12:30:00.000Z';

const CONTRACT_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../contracts/artemisReplayContract.js',
);

const LINEAGE_CONTRACT_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../contracts/artemisDecisionLineageContract.js',
);

const PROTECTED_CONTRACT_PATHS = [
  '../../contracts/artemisDecisionLineageContract.js',
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
  '../../contracts/artemisObservedOutcomeContract.js',
  '../../contracts/artemisObservedOutcomeSourceOfTruthContract.js',
  '../../contracts/artemisObservedOutcomeEvaluationContract.js',
  '../../contracts/artemisObservedOutcomeEvaluationSourceOfTruthContract.js',
  '../../contracts/artemisDecisionContract.js',
  '../../contracts/artemisDecisionContextContract.js',
  '../../contracts/artemisEvidenceOrchestrationContract.js',
];

const BASELINE_PROTECTED_HASHES = new Map(
  PROTECTED_CONTRACT_PATHS.map((rel) => {
    const abs = path.join(path.dirname(fileURLToPath(import.meta.url)), rel);
    const sha = createHash('sha256').update(readFileSync(abs)).digest('hex');
    return [rel, sha];
  }),
);

function thinSourceRef(overrides = {}) {
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

function validOriginalInput(overrides = {}) {
  return {
    recordedAt: REPLAY_RECORDED_AT,
    replayMode: REPLAY_MODE.ORIGINAL_HISTORICAL,
    historicalCutoffAt: CUTOFF_AT,
    sourceLineageRef: thinSourceRef(),
    ...overrides,
  };
}

function validRecomputationInput(overrides = {}) {
  return {
    recordedAt: REPLAY_RECORDED_AT,
    replayMode: REPLAY_MODE.CURRENT_RECOMPUTATION,
    historicalCutoffAt: CUTOFF_AT,
    sourceLineageRef: thinSourceRef(),
    ...overrides,
  };
}

function buildLineageArtifact(overrides = {}) {
  const result = buildDecisionLineage({
    decisionRef: {
      decisionId: DECISION_ID,
      contractVersion: DECISION_CONTRACT_VERSION,
      decisionContextId: CONTEXT_ID,
      analysisAt: ANALYSIS_AT,
      createdAt: CREATED_AT,
    },
    // PARTIAL reconstructability — enough for Replay Contract acceptance
    decisionContextRef: {
      contextId: CONTEXT_ID,
      contractVersion: DECISION_CONTEXT_CONTRACT_VERSION,
    },
    recordedAt: LINEAGE_RECORDED_AT,
    ...overrides,
  });
  if (!result || result.ok !== true || !result.artifact) {
    throw new Error(`buildDecisionLineage failed: ${result?.code || 'unknown'} ${result?.message || ''}`);
  }
  return result.artifact;
}

function expectFail(fn, code) {
  try {
    fn();
    throw new Error(`Expected failure ${code}`);
  } catch (err) {
    expect(err.code).toBe(code);
  }
}

describe('artemisReplayContract — S9-REPLAY-CONTRACT', () => {
  describe('minimal valid requests', () => {
    it('1. builds minimal valid ORIGINAL_HISTORICAL request', () => {
      const art = buildArtemisReplayRequest(validOriginalInput());
      expect(art.replayMode).toBe(REPLAY_MODE.ORIGINAL_HISTORICAL);
      expect(art.artifactType).toBe(REPLAY_ARTIFACT_TYPE);
      expect(art.historicalCutoffAt).toBe(CUTOFF_AT);
      expect(art.sourceLineageRef.lineageId).toBe(LINEAGE_ID);
    });

    it('2. builds minimal valid CURRENT_RECOMPUTATION request', () => {
      const art = buildArtemisReplayRequest(validRecomputationInput());
      expect(art.replayMode).toBe(REPLAY_MODE.CURRENT_RECOMPUTATION);
      expect(art.provenance.historicalClassification).toBe('CURRENT_RECOMPUTATION_INTENT');
    });

    it('3. isSourceOfTruth=false', () => {
      const art = buildArtemisReplayRequest(validOriginalInput());
      expect(art.isSourceOfTruth).toBe(false);
      expect(REPLAY_IS_SOURCE_OF_TRUTH).toBe(false);
      expect(art.ownershipRole).toBe(REPLAY_OWNERSHIP_ROLE);
    });

    it('4. authorityClass=REPLAY', () => {
      const art = buildArtemisReplayRequest(validOriginalInput());
      expect(art.authorityClass).toBe(REPLAY_AUTHORITY_CLASS);
      expect(art.sliceId).toBe(REPLAY_SLICE_ID);
      expect(art.schemaVersion).toBe(REPLAY_SCHEMA_VERSION);
      expect(art.contractVersion).toBe(REPLAY_CONTRACT_VERSION);
    });
  });

  describe('deterministic replay identity', () => {
    it('5. produces deterministic replayId', () => {
      const art = buildArtemisReplayRequest(validOriginalInput());
      expect(art.replayId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
      );
      const expected = computeReplayId({
        lineageId: LINEAGE_ID,
        replayMode: REPLAY_MODE.ORIGINAL_HISTORICAL,
        historicalCutoffAt: CUTOFF_AT,
        implementationVersion: REPLAY_CONTRACT_VERSION,
      });
      expect(art.replayId).toBe(expected);
    });

    it('6. identical input => identical replayId', () => {
      const a = buildArtemisReplayRequest(validOriginalInput());
      const b = buildArtemisReplayRequest(validOriginalInput());
      expect(a.replayId).toBe(b.replayId);
    });

    it('7. semantic identity change => replayId changes', () => {
      const a = buildArtemisReplayRequest(validOriginalInput());
      const b = buildArtemisReplayRequest(
        validOriginalInput({ replayMode: REPLAY_MODE.CURRENT_RECOMPUTATION })
      );
      const c = buildArtemisReplayRequest(
        validOriginalInput({
          historicalCutoffAt: '2026-09-22T09:59:00.000Z',
        })
      );
      const d = buildArtemisReplayRequest(
        validOriginalInput({
          sourceLineageRef: thinSourceRef({ lineageId: OTHER_LINEAGE_ID }),
        })
      );
      expect(a.replayId).not.toBe(b.replayId);
      expect(a.replayId).not.toBe(c.replayId);
      expect(a.replayId).not.toBe(d.replayId);
    });

    it('recordedAt bookkeeping does not alter replayId', () => {
      const a = buildArtemisReplayRequest(validOriginalInput());
      const b = buildArtemisReplayRequest(
        validOriginalInput({ recordedAt: '2026-09-22T13:00:00.000Z' })
      );
      expect(a.replayId).toBe(b.replayId);
      expect(a.recordedAt).not.toBe(b.recordedAt);
    });

    it('8. matching caller-supplied replayId accepted', () => {
      const expected = computeReplayId({
        lineageId: LINEAGE_ID,
        replayMode: REPLAY_MODE.ORIGINAL_HISTORICAL,
        historicalCutoffAt: CUTOFF_AT,
        implementationVersion: REPLAY_CONTRACT_VERSION,
      });
      const art = buildArtemisReplayRequest(validOriginalInput({ replayId: expected }));
      expect(art.replayId).toBe(expected);
    });

    it('9. conflicting replayId rejected', () => {
      expectFail(
        () =>
          buildArtemisReplayRequest(
            validOriginalInput({ replayId: OTHER_LINEAGE_ID })
          ),
        'REPLAY_ID_CONFLICT'
      );
    });

    it('hashToUuid is deterministic and UUIDv4-shaped', () => {
      const a = hashToUuid(['x', 'y']);
      const b = hashToUuid(['x', 'y']);
      expect(a).toBe(b);
      expect(a[14]).toBe('4');
    });
  });

  describe('source lineage binding', () => {
    it('10. source lineageId required', () => {
      expectFail(
        () =>
          buildArtemisReplayRequest({
            recordedAt: REPLAY_RECORDED_AT,
            replayMode: REPLAY_MODE.ORIGINAL_HISTORICAL,
            historicalCutoffAt: CUTOFF_AT,
          }),
        'REPLAY_SOURCE_LINEAGE_REQUIRED'
      );
    });

    it('11. malformed lineageId rejected', () => {
      expectFail(
        () =>
          buildArtemisReplayRequest(
            validOriginalInput({
              sourceLineageRef: thinSourceRef({ lineageId: 'not-a-uuid' }),
            })
          ),
        'REPLAY_SOURCE_LINEAGE_ID_INVALID'
      );
    });

    it('12. source lineage contract version consistency', () => {
      const art = buildArtemisReplayRequest(validOriginalInput());
      expect(art.sourceLineageRef.contractVersion).toBe(DECISION_LINEAGE_CONTRACT_VERSION);
      expect(art.versions.decisionLineageContractVersion).toBe(DECISION_LINEAGE_CONTRACT_VERSION);
    });

    it('13. lineage reference mismatch rejected', () => {
      expectFail(
        () =>
          buildArtemisReplayRequest(
            validOriginalInput({
              sourceLineageRef: thinSourceRef({
                contractVersion: 'wrong-lineage-version',
              }),
            })
          ),
        'REPLAY_SOURCE_LINEAGE_CONTRACT_VERSION_MISMATCH'
      );
    });

    it('accepts Decision Lineage artifact and extracts thin refs only', () => {
      const lineage = buildLineageArtifact();
      const art = buildArtemisReplayRequest({
        recordedAt: REPLAY_RECORDED_AT,
        replayMode: REPLAY_MODE.ORIGINAL_HISTORICAL,
        historicalCutoffAt: CUTOFF_AT,
        sourceLineageArtifact: lineage,
      });
      expect(art.sourceLineageRef.lineageId).toBe(lineage.lineageId);
      expect(art.sourceLineageRef.decisionAnalysisAt).toBe(ANALYSIS_AT);
      expect(art.sourceLineageArtifact).toBeUndefined();
      expect(art.preDecision).toBeUndefined();
      expect(art.decision).toBeUndefined();
      expect(art.postDecision).toBeUndefined();
    });

    it('rejects conflicting thin ref vs artifact lineageId', () => {
      const lineage = buildLineageArtifact();
      expectFail(
        () =>
          buildArtemisReplayRequest({
            recordedAt: REPLAY_RECORDED_AT,
            replayMode: REPLAY_MODE.ORIGINAL_HISTORICAL,
            historicalCutoffAt: CUTOFF_AT,
            sourceLineageArtifact: lineage,
            sourceLineageRef: thinSourceRef({ lineageId: OTHER_LINEAGE_ID }),
          }),
        'REPLAY_SOURCE_LINEAGE_ID_CONFLICT'
      );
    });

    it('rejects INSUFFICIENT reconstructability', () => {
      expectFail(
        () =>
          buildArtemisReplayRequest(
            validOriginalInput({
              sourceLineageRef: thinSourceRef({
                reconstructabilityStatus: RECONSTRUCTABILITY_STATUS.INSUFFICIENT,
              }),
            })
          ),
        'REPLAY_SOURCE_LINEAGE_INSUFFICIENT'
      );
    });

    it('accepts PARTIAL reconstructability with limitation note', () => {
      const art = buildArtemisReplayRequest(
        validOriginalInput({
          sourceLineageRef: thinSourceRef({
            reconstructabilityStatus: RECONSTRUCTABILITY_STATUS.PARTIAL,
          }),
        })
      );
      expect(art.sourceLineageRef.reconstructabilityStatus).toBe(
        RECONSTRUCTABILITY_STATUS.PARTIAL
      );
      expect(art.limitations).toContain('source_lineage_reconstructability=PARTIAL');
    });
  });

  describe('replay modes', () => {
    it('14. ORIGINAL_HISTORICAL enum accepted', () => {
      const art = buildArtemisReplayRequest(validOriginalInput());
      expect(art.replayMode).toBe('ORIGINAL_HISTORICAL');
    });

    it('15. CURRENT_RECOMPUTATION enum accepted', () => {
      const art = buildArtemisReplayRequest(validRecomputationInput());
      expect(art.replayMode).toBe('CURRENT_RECOMPUTATION');
    });

    it('16. unknown Replay mode rejected', () => {
      expectFail(
        () =>
          buildArtemisReplayRequest(
            validOriginalInput({ replayMode: 'PAPER_REPLAY' })
          ),
        'REPLAY_MODE_UNKNOWN'
      );
      expectFail(
        () =>
          buildArtemisReplayRequest(
            validOriginalInput({ replayMode: 'LIVE_REPLAY' })
          ),
        'REPLAY_MODE_UNKNOWN'
      );
      expectFail(
        () =>
          buildArtemisReplayRequest(
            validOriginalInput({ replayMode: 'SIMULATION_REPLAY' })
          ),
        'REPLAY_MODE_UNKNOWN'
      );
    });

    it('17. no silent mode conversion — CURRENT cannot claim ORIGINAL classification', () => {
      expectFail(
        () =>
          buildArtemisReplayRequest(
            validRecomputationInput({
              provenance: { historicalClassification: 'ORIGINAL_HISTORICAL' },
            })
          ),
        'REPLAY_MODE_CLASSIFICATION_CONFLICT'
      );
    });
  });

  describe('historical cutoff', () => {
    it('18. historical cutoff required', () => {
      const input = validOriginalInput();
      delete input.historicalCutoffAt;
      expectFail(() => buildArtemisReplayRequest(input), 'REPLAY_HISTORICAL_CUTOFF_REQUIRED');
    });

    it('19. malformed cutoff rejected', () => {
      expectFail(
        () =>
          buildArtemisReplayRequest(
            validOriginalInput({ historicalCutoffAt: 'not-iso' })
          ),
        'REPLAY_HISTORICAL_CUTOFF_INVALID'
      );
    });

    it('20. hidden current time not used — no Date.now in contract identity path', () => {
      const src = readFileSync(CONTRACT_PATH, 'utf8');
      expect(src).not.toMatch(/Date\.now\s*\(/);
      expect(src).not.toMatch(/Math\.random\s*\(/);
      expect(src).not.toMatch(/randomUUID\s*\(/);
      expect(src).not.toMatch(/randomBytes\s*\(/);
    });

    it('21. ORIGINAL cutoff beyond Decision boundary rejected', () => {
      expectFail(
        () =>
          buildArtemisReplayRequest(
            validOriginalInput({ historicalCutoffAt: CUTOFF_AFTER_DECISION })
          ),
        'REPLAY_HISTORICAL_CUTOFF_BEYOND_DECISION_BOUNDARY'
      );
    });

    it('22. cutoff consistency with source lineage recordedAt', () => {
      expectFail(
        () =>
          buildArtemisReplayRequest(
            validOriginalInput({
              // analysisAt allows this cutoff, but lineage recordedAt is earlier
              historicalCutoffAt: '2026-09-22T10:00:00.000Z',
              sourceLineageRef: thinSourceRef({
                recordedAt: '2026-09-22T09:00:00.000Z',
                decisionAnalysisAt: '2026-09-22T10:00:00.000Z',
              }),
            })
          ),
        'REPLAY_HISTORICAL_CUTOFF_AFTER_LINEAGE_RECORDED_AT'
      );
    });

    it('ORIGINAL without Decision boundary fails closed', () => {
      expectFail(
        () =>
          buildArtemisReplayRequest(
            validOriginalInput({
              sourceLineageRef: {
                lineageId: LINEAGE_ID,
                contractVersion: DECISION_LINEAGE_CONTRACT_VERSION,
                reconstructabilityStatus: RECONSTRUCTABILITY_STATUS.COMPLETE,
              },
            })
          ),
        'REPLAY_DECISION_BOUNDARY_REQUIRED'
      );
    });

    it('no silent clamp — cutoff at createdAt when analysisAt earlier still uses analysisAt boundary', () => {
      // analysisAt = 10:00, createdAt = 10:00:01; cutoff = 10:00:01 > analysisAt → reject
      expectFail(
        () =>
          buildArtemisReplayRequest(
            validOriginalInput({
              historicalCutoffAt: CREATED_AT,
            })
          ),
        'REPLAY_HISTORICAL_CUTOFF_BEYOND_DECISION_BOUNDARY'
      );
    });
  });

  describe('look-ahead / leakage protection', () => {
    const leakCases = [
      ['23. futureData', { futureData: true }, 'REPLAY_FORBIDDEN_FIELD'],
      ['24. futureEvidence', { futureEvidence: [] }, 'REPLAY_FORBIDDEN_FIELD'],
      ['25a. lookahead', { lookahead: true }, 'REPLAY_FORBIDDEN_FIELD'],
      ['25b. lookAhead', { lookAhead: true }, 'REPLAY_FORBIDDEN_FIELD'],
      ['26. currentDataAsHistorical', { currentDataAsHistorical: true }, 'REPLAY_FORBIDDEN_FIELD'],
      ['27. currentModelAsHistorical', { currentModelAsHistorical: true }, 'REPLAY_FORBIDDEN_FIELD'],
      ['28. currentProviderAsHistorical', { currentProviderAsHistorical: true }, 'REPLAY_FORBIDDEN_FIELD'],
      ['29. raw OHLCV', { ohlcv: [] }, 'REPLAY_FORBIDDEN_FIELD'],
      ['30. candles', { candles: [] }, 'REPLAY_FORBIDDEN_FIELD'],
      ['31. ticker', { ticker: {} }, 'REPLAY_FORBIDDEN_FIELD'],
      ['32a. orderBook', { orderBook: {} }, 'REPLAY_FORBIDDEN_FIELD'],
      ['32b. depth', { depth: {} }, 'REPLAY_FORBIDDEN_FIELD'],
      ['33. provider payload', { providerPayload: {} }, 'REPLAY_FORBIDDEN_FIELD'],
      ['34. exchange response', { exchangeResponse: {} }, 'REPLAY_FORBIDDEN_FIELD'],
      ['35. direct Outcome payload', { outcome: { id: 1 } }, 'REPLAY_FORBIDDEN_FIELD'],
      ['36. direct Evaluation payload', { evaluation: { id: 1 } }, 'REPLAY_FORBIDDEN_FIELD'],
      ['37. outcomeId as Decision input', { outcomeId: OTHER_LINEAGE_ID }, 'REPLAY_FORBIDDEN_FIELD'],
      ['38. evaluationId as Decision input', { evaluationId: OTHER_LINEAGE_ID }, 'REPLAY_FORBIDDEN_FIELD'],
    ];

    for (const [name, extra, code] of leakCases) {
      it(name, () => {
        expectFail(() => buildArtemisReplayRequest(validOriginalInput(extra)), code);
      });
    }

    it('nested futureEvidence in provenance rejected', () => {
      expectFail(
        () =>
          buildArtemisReplayRequest(
            validOriginalInput({
              provenance: { note: 'x', futureEvidence: true },
            })
          ),
        'REPLAY_FORBIDDEN_FIELD'
      );
    });
  });

  describe('version honesty', () => {
    it('39. modelVersion cannot be fabricated', () => {
      expectFail(
        () =>
          buildArtemisReplayRequest(validOriginalInput({ modelVersion: 'gpt-x' })),
        'REPLAY_FORBIDDEN_FIELD'
      );
    });

    it('40. configurationVersion cannot be fabricated', () => {
      expectFail(
        () =>
          buildArtemisReplayRequest(
            validOriginalInput({ configurationVersion: 'cfg-1' })
          ),
        'REPLAY_FORBIDDEN_FIELD'
      );
    });

    it('50. unavailable metadata remains unavailable', () => {
      const art = buildArtemisReplayRequest(validOriginalInput());
      expect(art.versions.modelVersionCanonicalStatus).toBe(UPSTREAM_METADATA_UNAVAILABLE);
      expect(art.versions.configurationVersionCanonicalStatus).toBe(
        UPSTREAM_METADATA_UNAVAILABLE
      );
      expect(art.versions.modelVersion).toBeUndefined();
      expect(art.versions.configurationVersion).toBeUndefined();
      expect(art.provenance.modelVersionCanonicalStatus).toBe(UPSTREAM_METADATA_UNAVAILABLE);
    });
  });

  describe('strict validation', () => {
    it('41. unknown top-level field rejected', () => {
      expectFail(
        () =>
          buildArtemisReplayRequest(validOriginalInput({ unexpectedField: 1 })),
        'REPLAY_UNKNOWN_FIELD'
      );
    });

    it('42. unknown nested field rejected', () => {
      expectFail(
        () =>
          buildArtemisReplayRequest(
            validOriginalInput({
              sourceLineageRef: thinSourceRef({ extra: 1 }),
            })
          ),
        'REPLAY_SOURCE_LINEAGE_REF_UNKNOWN_FIELD'
      );
    });

    it('43. secret field rejected', () => {
      expectFail(
        () =>
          buildArtemisReplayRequest(validOriginalInput({ apiKey: 'x' })),
        'REPLAY_FORBIDDEN_FIELD'
      );
    });

    it('44. authority flag true rejected', () => {
      expectFail(
        () =>
          buildArtemisReplayRequest(
            validOriginalInput({ executionEligible: true })
          ),
        'REPLAY_AUTHORITY_FLAG_INVALID'
      );
    });

    it('45. replayActivated=true rejected', () => {
      expectFail(
        () =>
          buildArtemisReplayRequest(
            validOriginalInput({ replayActivated: true })
          ),
        'REPLAY_AUTHORITY_FLAG_INVALID'
      );
    });

    it('46. executionEligible=true rejected', () => {
      expectFail(
        () =>
          buildArtemisReplayRequest(
            validOriginalInput({ executionEligible: true })
          ),
        'REPLAY_AUTHORITY_FLAG_INVALID'
      );
    });

    it('47. persistenceEnabled=true rejected', () => {
      expectFail(
        () =>
          buildArtemisReplayRequest(
            validOriginalInput({ persistenceEnabled: true })
          ),
        'REPLAY_AUTHORITY_FLAG_INVALID'
      );
    });

    it('replayExecutionAuthorized=true rejected', () => {
      expectFail(
        () =>
          buildArtemisReplayRequest(
            validOriginalInput({ replayExecutionAuthorized: true })
          ),
        'REPLAY_AUTHORITY_FLAG_INVALID'
      );
    });
  });

  describe('provenance / immutability / side effects', () => {
    it('48. provenance preserved', () => {
      const art = buildArtemisReplayRequest(validOriginalInput());
      expect(art.provenance.writer).toBe('artemisReplayContract');
      expect(art.provenance.historicalClassification).toBe('ORIGINAL_HISTORICAL');
      expect(art.provenance.stage).toBe('ARTEMIS_CORE_STAGE_9');
    });

    it('49. historical/recomputed classification preserved', () => {
      const orig = buildArtemisReplayRequest(validOriginalInput());
      const re = buildArtemisReplayRequest(validRecomputationInput());
      expect(orig.provenance.historicalClassification).toBe('ORIGINAL_HISTORICAL');
      expect(re.provenance.historicalClassification).toBe('CURRENT_RECOMPUTATION_INTENT');
    });

    it('51. immutable artifact', () => {
      const art = buildArtemisReplayRequest(validOriginalInput());
      expect(Object.isFrozen(art)).toBe(true);
      expect(Object.isFrozen(art.sourceLineageRef)).toBe(true);
      expect(Object.isFrozen(art.sideEffects)).toBe(true);
      expect(() => {
        art.replayMode = 'LIVE_REPLAY';
      }).toThrow();
    });

    it('52. caller-input mutation cannot alter result', () => {
      const input = validOriginalInput();
      const art = buildArtemisReplayRequest(input);
      input.replayMode = REPLAY_MODE.CURRENT_RECOMPUTATION;
      input.sourceLineageRef.lineageId = OTHER_LINEAGE_ID;
      input.historicalCutoffAt = CUTOFF_AFTER_DECISION;
      expect(art.replayMode).toBe(REPLAY_MODE.ORIGINAL_HISTORICAL);
      expect(art.sourceLineageRef.lineageId).toBe(LINEAGE_ID);
      expect(art.historicalCutoffAt).toBe(CUTOFF_AT);
    });

    it('53. zero side effects', () => {
      const art = buildArtemisReplayRequest(validOriginalInput());
      expect(art.sideEffects).toEqual(ZERO_REPLAY_SIDE_EFFECTS);
      expect(art.sideEffects.replayExecution).toBe(0);
      expect(art.sideEffects.reconstructionExecution).toBe(0);
      expect(art.sideEffects.modelRecomputation).toBe(0);
      expect(art.sideEffects.providerRecomputation).toBe(0);
      for (const [k, v] of Object.entries(REQUIRED_HARD_FLAGS)) {
        expect(art[k]).toBe(v);
      }
    });

    it('nonzero sideEffects rejected', () => {
      expectFail(
        () =>
          buildArtemisReplayRequest(
            validOriginalInput({ sideEffects: { replayExecution: 1 } })
          ),
        'REPLAY_SIDE_EFFECTS_NONZERO'
      );
    });
  });

  describe('import hygiene / no execution', () => {
    const src = readFileSync(CONTRACT_PATH, 'utf8');

    it('54. no DB imports', () => {
      expect(src).not.toMatch(/from ['"].*database/);
      expect(src).not.toMatch(/from ['"].*\/db/);
      expect(src).not.toMatch(/pg\b/);
      expect(src).not.toMatch(/sequelize/i);
    });

    it('55. no Redis imports', () => {
      expect(src).not.toMatch(/ioredis/i);
      expect(src).not.toMatch(/from ['"].*redis/i);
    });

    it('56. no provider/network imports', () => {
      expect(src).not.toMatch(/mexc/i);
      expect(src).not.toMatch(/ccxt/i);
      expect(src).not.toMatch(/market-proxy/);
      expect(src).not.toMatch(/node-fetch|axios|undici/);
    });

    it('57. no LLM imports', () => {
      expect(src).not.toMatch(/openai/i);
      expect(src).not.toMatch(/anthropic/i);
      expect(src).not.toMatch(/from ['"].*llm/i);
    });

    it('58. no Worker/Scheduler imports', () => {
      expect(src).not.toMatch(/engineWorkerLeader/);
      expect(src).not.toMatch(/scheduler\.js/);
      expect(src).not.toMatch(/messageQueue/);
      expect(src).not.toMatch(/startArtemisScheduler/);
    });

    it('59. no B10 dependency', () => {
      // Hard flag `b10WriteAttempted` is required false — do not ban substring "b10".
      expect(src).not.toMatch(/from ['"].*b10/i);
      expect(src).not.toMatch(/artemisDecisionPersistenceService/);
      expect(src).not.toMatch(/runtimeExecutionStateService/);
      expect(src).toMatch(/b10WriteAttempted:\s*false/);
    });

    it('60. no Replay Engine/service import', () => {
      expect(src).not.toMatch(/artemisReplayService/);
      expect(src).not.toMatch(/artemisReplayEngine/);
      expect(src).not.toMatch(/from ['"].*services\//);
      expect(src).not.toMatch(/from ['"].*repositories\//);
    });

    it('61-63. no reconstruction / model / provider recomputation flags', () => {
      const art = buildArtemisReplayRequest(validOriginalInput());
      expect(art.reconstructionExecutionAuthorized).toBe(false);
      expect(art.modelRecomputationAuthorized).toBe(false);
      expect(art.providerRecomputationAuthorized).toBe(false);
      expect(art.replayExecutionAuthorized).toBe(false);
    });
  });

  describe('financial contamination', () => {
    const financial = [
      ['64a. order', { order: {} }],
      ['64b. orders', { orders: [] }],
      ['64c. orderId', { orderId: OTHER_LINEAGE_ID }],
      ['64d. executionIntent', { executionIntent: {} }],
      ['64e. wallet', { wallet: {} }],
      ['64f. balance', { balance: 1 }],
      ['64g. transfer', { transfer: {} }],
      ['64h. withdrawal', { withdrawal: {} }],
      ['64i. tradeExecution', { tradeExecution: {} }],
      ['65a. realizedPnl', { realizedPnl: 1 }],
      ['65b. pnl', { pnl: 1 }],
      ['65c. ROI', { ROI: 1 }],
      ['65d. profit', { profit: 1 }],
      ['65e. financialResult', { financialResult: {} }],
      ['67a. replayedDecision', { replayedDecision: {} }],
      ['67b. recomputedEvaluation', { recomputedEvaluation: {} }],
      ['67c. simulatedPnl', { simulatedPnl: 1 }],
    ];

    for (const [name, extra] of financial) {
      it(name, () => {
        expectFail(
          () => buildArtemisReplayRequest(validOriginalInput(extra)),
          'REPLAY_FORBIDDEN_FIELD'
        );
      });
    }
  });

  describe('size / validate alias / protected surfaces', () => {
    it('66. artifact byte bound enforced conceptually (successful artifact under bound)', () => {
      const art = buildArtemisReplayRequest(validOriginalInput());
      const bytes = Buffer.byteLength(JSON.stringify(art), 'utf8');
      expect(bytes).toBeLessThan(24 * 1024);
    });

    it('validateArtemisReplayRequest aliases build', () => {
      const a = buildArtemisReplayRequest(validOriginalInput());
      const b = validateArtemisReplayRequest(validOriginalInput());
      expect(a).toEqual(b);
    });

    it('67. Decision Lineage source remains unchanged', () => {
      const before = createHash('sha256').update(readFileSync(LINEAGE_CONTRACT_PATH)).digest('hex');
      buildArtemisReplayRequest(validOriginalInput());
      const after = createHash('sha256').update(readFileSync(LINEAGE_CONTRACT_PATH)).digest('hex');
      expect(after).toBe(before);
      expect(BASELINE_PROTECTED_HASHES.get('../../contracts/artemisDecisionLineageContract.js')).toBe(
        after
      );
    });

    it('68. Stage 8 / Control Chain protected owners unchanged', () => {
      for (const [rel, expected] of BASELINE_PROTECTED_HASHES) {
        const abs = path.join(path.dirname(fileURLToPath(import.meta.url)), rel);
        const actual = createHash('sha256').update(readFileSync(abs)).digest('hex');
        expect(actual).toBe(expected);
      }
    });

    it('isSourceOfTruth=true rejected', () => {
      expectFail(
        () =>
          buildArtemisReplayRequest(validOriginalInput({ isSourceOfTruth: true })),
        'REPLAY_IS_SOURCE_OF_TRUTH_INVALID'
      );
    });

    it('does not embed full lineage payload when both ref and artifact provided', () => {
      const lineage = buildLineageArtifact();
      const art = buildArtemisReplayRequest({
        recordedAt: REPLAY_RECORDED_AT,
        replayMode: REPLAY_MODE.ORIGINAL_HISTORICAL,
        historicalCutoffAt: CUTOFF_AT,
        sourceLineageArtifact: lineage,
        sourceLineageRef: {
          lineageId: lineage.lineageId,
          contractVersion: lineage.contractVersion,
          reconstructabilityStatus: lineage.reconstructabilityStatus,
          recordedAt: lineage.recordedAt,
        },
      });
      expect(JSON.stringify(art)).not.toContain('"preDecision"');
      expect(JSON.stringify(art)).not.toContain('"postDecision"');
      expect(art.sourceLineageRef.lineageId).toBe(lineage.lineageId);
    });
  });
});
