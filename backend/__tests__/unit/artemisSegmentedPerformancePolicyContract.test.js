/**
 * Artemis Segmented Performance Policy Contract — dedicated unit tests
 * Stage 10 S10-SEGMENTED-PERFORMANCE-POLICY-CONTRACT
 *
 * Covers canonical segment dims, deterministic identity, GLOBAL_AVERAGE_ONLY
 * bypass closed, regime/sample/trust/promotion fail-closed, deep immutability,
 * homogeneous cohort, version binding, zero side effects, import hygiene.
 */

import { describe, expect, test } from '@jest/globals';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  AUTHORIZED_CANONICAL_SEGMENT_DIMENSIONS,
  CANONICAL_SEGMENT_DIMENSION_ORDER,
  CANONICAL_VERSION_BINDING_FIELDS,
  COHORT_DESCRIPTOR_ALLOWLIST,
  REGIME_IDENTITY_CANONICAL,
  REGIME_CLASSIFIER,
  REGIME_CREATION,
  ANALYSIS_HORIZON_SEGMENTATION,
  SAMPLE_SUFFICIENCY_OWNER,
  SAMPLE_SUFFICIENCY_POLICY,
  GLOBAL_AVERAGE_ONLY,
  GLOBAL_AVERAGE_ONLY_BYPASS,
  TRUST_WEIGHTING,
  PROMOTION,
  DEMOTION,
  CALIBRATION_EXECUTION,
  BINARY_BRIER_EXECUTION,
  SEGMENT_SCOPE,
  SEGMENT_IDENTITY_STATUS,
  UNSUPPORTED_SEGMENTATION_DIMENSIONS,
  FORBIDDEN_SAMPLE_SUFFICIENCY_FIELDS,
  FORBIDDEN_TRUST_PROMOTION_FIELDS,
  FORBIDDEN_CALIBRATION_METRIC_FIELDS,
  REQUIRED_HARD_FLAGS,
  ZERO_SEGMENTED_PERFORMANCE_POLICY_SIDE_EFFECTS,
  SEGMENTED_PERFORMANCE_POLICY_LIMITATIONS,
  SEGMENTED_PERFORMANCE_POLICY_SCHEMA_VERSION,
  SEGMENTED_PERFORMANCE_POLICY_CONTRACT_VERSION,
  SEGMENTED_PERFORMANCE_POLICY_POLICY_VERSION,
  SEGMENTED_PERFORMANCE_POLICY_IMPLEMENTATION_VERSION,
  SEGMENTED_PERFORMANCE_POLICY_ARTIFACT_TYPE,
  SEGMENTED_PERFORMANCE_POLICY_AUTHORITY_CLASS,
  SEGMENTED_PERFORMANCE_POLICY_SLICE_ID,
  SEGMENTED_PERFORMANCE_POLICY_OFFICIAL_NAME,
  SEGMENTED_PERFORMANCE_POLICY_OWNERSHIP_ROLE,
  SEGMENTED_PERFORMANCE_POLICY_IS_SOURCE_OF_TRUTH,
  SEGMENTED_PERFORMANCE_POLICY_DESCRIPTOR,
  SegmentedPerformancePolicyContractError,
  getSegmentedPerformancePolicyDescriptor,
  validateSegmentedPerformancePolicyDescriptor,
  computeCanonicalSegmentId,
  validateCanonicalSegmentIdentity,
  validateCohortDescriptor,
  assertHomogeneousSegmentCohort,
  assertNotGlobalAverageOnlyBypass,
  default as policyDefault,
} from '../../contracts/artemisSegmentedPerformancePolicyContract.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONTRACT_PATH = path.resolve(
  __dirname,
  '../../contracts/artemisSegmentedPerformancePolicyContract.js',
);

function baseSegment(overrides = {}) {
  return {
    venue: 'mexc',
    marketType: 'spot',
    symbol: 'BTC/USDT',
    timeframe: '1h',
    ...overrides,
  };
}

function cloneDescriptor() {
  return structuredClone(getSegmentedPerformancePolicyDescriptor());
}

function expectFail(fn, code) {
  try {
    fn();
    throw new Error(`Expected failure ${code} but succeeded`);
  } catch (err) {
    expect(err).toBeInstanceOf(SegmentedPerformancePolicyContractError);
    expect(err.code).toBe(code);
  }
}

describe('artemisSegmentedPerformancePolicyContract — governed semantics', () => {
  test('1. valid canonical segment', () => {
    const result = validateCanonicalSegmentIdentity(baseSegment());
    expect(result.segmentScope).toBe(SEGMENT_SCOPE.SEGMENTED);
    expect(result.segmentIdentityStatus).toBe(SEGMENT_IDENTITY_STATUS.AVAILABLE);
    expect(result.venue).toBe('mexc');
    expect(result.marketType).toBe('spot');
    expect(result.symbol).toBe('BTC/USDT');
    expect(result.timeframe).toBe('1h');
    expect(result.isSourceOfTruth).toBe(false);
    expect(result.regimeIdentityCanonical).toBe(false);
  });

  test('2. deterministic identity', () => {
    const a = computeCanonicalSegmentId(baseSegment());
    const b = computeCanonicalSegmentId(baseSegment());
    expect(a).toBe(b);
    expect(typeof a).toBe('string');
    expect(a).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  test('3. repeated identical calls', () => {
    const first = validateCanonicalSegmentIdentity(baseSegment());
    const second = validateCanonicalSegmentIdentity(baseSegment());
    expect(first.segmentId).toBe(second.segmentId);
    expect(first).toEqual(second);
  });

  test('4. deep immutability', () => {
    const result = validateCanonicalSegmentIdentity(baseSegment());
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.hardFlags)).toBe(true);
    expect(Object.isFrozen(result.sideEffects)).toBe(true);
    expect(Object.isFrozen(result.provenance)).toBe(true);
    expect(Object.isFrozen(result.limitations)).toBe(true);
    expect(() => {
      result.venue = 'binance';
    }).toThrow();
    expect(() => {
      result.hardFlags.decisionEligible = true;
    }).toThrow();
  });

  test('5. nested mutation protection — caller input mutation after build', () => {
    const input = baseSegment();
    const result = validateCanonicalSegmentIdentity(input);
    input.venue = 'binance';
    input.symbol = 'ETH/USDT';
    expect(result.venue).toBe('mexc');
    expect(result.symbol).toBe('BTC/USDT');
    const again = validateCanonicalSegmentIdentity(baseSegment());
    expect(result.segmentId).toBe(again.segmentId);
  });

  test('6. missing venue rejected', () => {
    const { venue, ...rest } = baseSegment();
    expectFail(
      () => validateCanonicalSegmentIdentity(rest),
      'SEGMENTED_PERFORMANCE_POLICY_SEGMENT_DIMENSION_MISSING',
    );
  });

  test('7. missing marketType rejected', () => {
    const { marketType, ...rest } = baseSegment();
    expectFail(
      () => validateCanonicalSegmentIdentity(rest),
      'SEGMENTED_PERFORMANCE_POLICY_SEGMENT_DIMENSION_MISSING',
    );
  });

  test('8. missing symbol rejected', () => {
    const { symbol, ...rest } = baseSegment();
    expectFail(
      () => validateCanonicalSegmentIdentity(rest),
      'SEGMENTED_PERFORMANCE_POLICY_SEGMENT_DIMENSION_MISSING',
    );
  });

  test('9. missing timeframe rejected', () => {
    const { timeframe, ...rest } = baseSegment();
    expectFail(
      () => validateCanonicalSegmentIdentity(rest),
      'SEGMENTED_PERFORMANCE_POLICY_SEGMENT_DIMENSION_MISSING',
    );
  });

  test('10. unsupported dimension rejected', () => {
    expectFail(
      () => validateCanonicalSegmentIdentity({ ...baseSegment(), agentRole: 'evidence' }),
      'SEGMENTED_PERFORMANCE_POLICY_UNSUPPORTED_DIMENSION',
    );
  });

  test('11. unknown dimension rejected', () => {
    expectFail(
      () => validateCanonicalSegmentIdentity({ ...baseSegment(), fancyDim: 'x' }),
      'SEGMENTED_PERFORMANCE_POLICY_SEGMENT_UNKNOWN_FIELD',
    );
  });

  test('12. regime supplied rejected', () => {
    expectFail(
      () => validateCanonicalSegmentIdentity({ ...baseSegment(), regime: 'bull' }),
      'SEGMENTED_PERFORMANCE_POLICY_UNSUPPORTED_DIMENSION',
    );
    expectFail(
      () => validateCanonicalSegmentIdentity({ ...baseSegment(), marketRegime: 'trending' }),
      'SEGMENTED_PERFORMANCE_POLICY_UNSUPPORTED_DIMENSION',
    );
  });

  test('13. analysisHorizon as segmentation dimension rejected', () => {
    expectFail(
      () => validateCanonicalSegmentIdentity({
        ...baseSegment(),
        analysisHorizon: '24h',
      }),
      'SEGMENTED_PERFORMANCE_POLICY_UNSUPPORTED_DIMENSION',
    );
  });

  test('14. caller-supplied segmentId mismatch rejected', () => {
    expectFail(
      () => validateCanonicalSegmentIdentity({
        ...baseSegment(),
        segmentId: '00000000-0000-4000-8000-000000000000',
      }),
      'SEGMENTED_PERFORMANCE_POLICY_SEGMENT_ID_MISMATCH',
    );
  });

  test('15. fabricated segmentId rejected', () => {
    expectFail(
      () => validateCanonicalSegmentIdentity({
        ...baseSegment(),
        segmentId: 'not-a-real-segment-id',
      }),
      'SEGMENTED_PERFORMANCE_POLICY_SEGMENT_ID_MISMATCH',
    );
  });

  test('16. mixed venue cohort rejected', () => {
    expectFail(
      () => assertHomogeneousSegmentCohort([
        baseSegment(),
        baseSegment({ venue: 'binance' }),
      ]),
      'MIXED_COHORT',
    );
  });

  test('17. mixed marketType cohort rejected', () => {
    expectFail(
      () => assertHomogeneousSegmentCohort([
        baseSegment(),
        baseSegment({ marketType: 'futures' }),
      ]),
      'MIXED_COHORT',
    );
  });

  test('18. mixed symbol cohort rejected', () => {
    expectFail(
      () => assertHomogeneousSegmentCohort([
        baseSegment(),
        baseSegment({ symbol: 'ETH/USDT' }),
      ]),
      'MIXED_COHORT',
    );
  });

  test('19. mixed timeframe cohort rejected', () => {
    expectFail(
      () => assertHomogeneousSegmentCohort([
        baseSegment(),
        baseSegment({ timeframe: '4h' }),
      ]),
      'MIXED_COHORT',
    );
  });

  test('20. incompatible method/version cohort rejected', () => {
    expectFail(
      () => assertHomogeneousSegmentCohort([
        { ...baseSegment(), methodKey: 'a', policyVersion: '1.0.0', contractVersion: 'c1' },
        { ...baseSegment(), methodKey: 'b', policyVersion: '1.0.0', contractVersion: 'c1' },
      ]),
      'MIXED_EVALUATION_VERSION_COHORT',
    );
    expectFail(
      () => assertHomogeneousSegmentCohort([
        {
          ...baseSegment(),
          methodKey: 'a',
          methodImplementationVersion: '1',
          evaluationImplementationVersion: '1',
          policyVersion: 'p1',
          contractVersion: 'c1',
        },
        {
          ...baseSegment(),
          methodKey: 'a',
          methodImplementationVersion: '1',
          evaluationImplementationVersion: '1',
          policyVersion: 'p2',
          contractVersion: 'c1',
        },
      ]),
      'MIXED_EVALUATION_VERSION_COHORT',
    );
  });

  test('21. caller authority override rejected', () => {
    const d = cloneDescriptor();
    d.authorityClass = 'CALIBRATION';
    expectFail(
      () => validateSegmentedPerformancePolicyDescriptor(d),
      'SEGMENTED_PERFORMANCE_POLICY_AUTHORITY_CLASS_MISMATCH',
    );
  });

  test('22. policyVersion override rejected', () => {
    const d = cloneDescriptor();
    d.policyVersion = 'evil-policy';
    expectFail(
      () => validateSegmentedPerformancePolicyDescriptor(d),
      'SEGMENTED_PERFORMANCE_POLICY_POLICY_VERSION_MISMATCH',
    );
  });

  test('23. contractVersion override rejected', () => {
    const d = cloneDescriptor();
    d.contractVersion = 'evil-contract';
    expectFail(
      () => validateSegmentedPerformancePolicyDescriptor(d),
      'SEGMENTED_PERFORMANCE_POLICY_CONTRACT_VERSION_MISMATCH',
    );
  });

  test('24. implementationVersion override rejected', () => {
    const d = cloneDescriptor();
    d.implementationVersion = '9.9.9';
    expectFail(
      () => validateSegmentedPerformancePolicyDescriptor(d),
      'SEGMENTED_PERFORMANCE_POLICY_IMPLEMENTATION_VERSION_MISMATCH',
    );
  });

  test('25. hard-flag escalation rejected', () => {
    const d = cloneDescriptor();
    d.hardFlags.decisionEligible = true;
    expectFail(
      () => validateSegmentedPerformancePolicyDescriptor(d),
      'SEGMENTED_PERFORMANCE_POLICY_HARD_FLAG_ESCALATION',
    );
    const d2 = cloneDescriptor();
    d2.hardFlags.executionEligible = true;
    expectFail(
      () => validateSegmentedPerformancePolicyDescriptor(d2),
      'SEGMENTED_PERFORMANCE_POLICY_HARD_FLAG_ESCALATION',
    );
    const d3 = cloneDescriptor();
    d3.hardFlags.calibrationExecution = true;
    expectFail(
      () => validateSegmentedPerformancePolicyDescriptor(d3),
      'SEGMENTED_PERFORMANCE_POLICY_HARD_FLAG_ESCALATION',
    );
  });

  test('26. unknown top-level field rejected', () => {
    const d = cloneDescriptor();
    d.extraTop = 'nope';
    expectFail(
      () => validateSegmentedPerformancePolicyDescriptor(d),
      'SEGMENTED_PERFORMANCE_POLICY_DESCRIPTOR_UNKNOWN_FIELD',
    );
  });

  test('27. unknown nested field rejected', () => {
    const d = cloneDescriptor();
    d.hardFlags.extraFlag = false;
    expectFail(
      () => validateSegmentedPerformancePolicyDescriptor(d),
      'SEGMENTED_PERFORMANCE_POLICY_HARD_FLAGS_UNKNOWN_FIELD',
    );
  });

  test('28. sample threshold field rejected', () => {
    expectFail(
      () => validateCanonicalSegmentIdentity({
        ...baseSegment(),
        minimumN: 30,
      }),
      'SEGMENTED_PERFORMANCE_POLICY_SAMPLE_SUFFICIENCY_FORBIDDEN',
    );
    expectFail(
      () => validateCanonicalSegmentIdentity({
        ...baseSegment(),
        minSampleSize: 10,
      }),
      'SEGMENTED_PERFORMANCE_POLICY_SAMPLE_SUFFICIENCY_FORBIDDEN',
    );
  });

  test('29. trust field rejected', () => {
    expectFail(
      () => validateCanonicalSegmentIdentity({
        ...baseSegment(),
        trustScore: 0.9,
      }),
      'SEGMENTED_PERFORMANCE_POLICY_TRUST_PROMOTION_FORBIDDEN',
    );
  });

  test('30. promotion field rejected', () => {
    expectFail(
      () => validateCanonicalSegmentIdentity({
        ...baseSegment(),
        promotionEligible: true,
      }),
      'SEGMENTED_PERFORMANCE_POLICY_TRUST_PROMOTION_FORBIDDEN',
    );
  });

  test('31. demotion field rejected', () => {
    expectFail(
      () => validateCanonicalSegmentIdentity({
        ...baseSegment(),
        demotionStatus: 'demoted',
      }),
      'SEGMENTED_PERFORMANCE_POLICY_TRUST_PROMOTION_FORBIDDEN',
    );
  });

  test('32. calibration metric rejected', () => {
    expectFail(
      () => validateCanonicalSegmentIdentity({
        ...baseSegment(),
        calibrationScore: 0.1,
      }),
      'SEGMENTED_PERFORMANCE_POLICY_CALIBRATION_METRIC_FORBIDDEN',
    );
  });

  test('33. Brier field rejected', () => {
    expectFail(
      () => validateCanonicalSegmentIdentity({
        ...baseSegment(),
        brier: 0.2,
      }),
      'SEGMENTED_PERFORMANCE_POLICY_CALIBRATION_METRIC_FORBIDDEN',
    );
  });

  test('34. runtime field rejected on claim', () => {
    expectFail(
      () => assertNotGlobalAverageOnlyBypass({
        segmented: true,
        ...baseSegment(),
        runtimeActivated: true,
      }),
      'SEGMENTED_PERFORMANCE_POLICY_CLAIM_FORBIDDEN_FIELD',
    );
  });

  test('35. persistence field rejected on claim', () => {
    expectFail(
      () => assertNotGlobalAverageOnlyBypass({
        segmented: true,
        ...baseSegment(),
        persistenceEnabled: true,
      }),
      'SEGMENTED_PERFORMANCE_POLICY_CLAIM_FORBIDDEN_FIELD',
    );
  });

  test('36. provider/network field rejected', () => {
    expectFail(
      () => assertNotGlobalAverageOnlyBypass({
        segmented: true,
        ...baseSegment(),
        providerConnected: true,
      }),
      'SEGMENTED_PERFORMANCE_POLICY_CLAIM_FORBIDDEN_FIELD',
    );
  });

  test('37. raw market payload rejected', () => {
    expectFail(
      () => validateCanonicalSegmentIdentity({
        ...baseSegment(),
        ohlcv: [{ open: 1 }],
      }),
      'SEGMENTED_PERFORMANCE_POLICY_SEGMENT_UNKNOWN_FIELD',
    );
    expectFail(
      () => assertNotGlobalAverageOnlyBypass({
        segmented: true,
        ...baseSegment(),
        ticker: { last: 1 },
      }),
      'SEGMENTED_PERFORMANCE_POLICY_CLAIM_FORBIDDEN_FIELD',
    );
  });

  test('38. no Date.now dependency', () => {
    const src = fs.readFileSync(CONTRACT_PATH, 'utf8');
    expect(src).not.toMatch(/\bDate\.now\s*\(/);
    expect(src).not.toMatch(/\bnew\s+Date\s*\(/);
  });

  test('39. no random identity', () => {
    const src = fs.readFileSync(CONTRACT_PATH, 'utf8');
    expect(src).not.toMatch(/\bMath\.random\s*\(/);
    expect(src).not.toMatch(/\brandomUUID\s*\(/);
    expect(src).not.toMatch(/\brandomBytes\s*\(/);
  });

  test('40. zero side effects', () => {
    const result = validateCanonicalSegmentIdentity(baseSegment());
    for (const [k, v] of Object.entries(ZERO_SEGMENTED_PERFORMANCE_POLICY_SIDE_EFFECTS)) {
      expect(result.sideEffects[k]).toBe(0);
      expect(v).toBe(0);
    }
    const d = getSegmentedPerformancePolicyDescriptor();
    for (const [k, v] of Object.entries(d.sideEffects)) {
      expect(v).toBe(0);
    }
  });

  test('41–45. no DB / Redis / network / provider / runtime / worker / scheduler imports', () => {
    const src = fs.readFileSync(CONTRACT_PATH, 'utf8');
    expect(src).not.toMatch(/from\s+['"].*db['"]/);
    expect(src).not.toMatch(/from\s+['"].*redis['"]/);
    expect(src).not.toMatch(/from\s+['"].*pg['"]/);
    expect(src).not.toMatch(/require\s*\(\s*['"]pg['"]/);
    expect(src).not.toMatch(/ioredis/i);
    expect(src).not.toMatch(/node-fetch|undici|axios/i);
    expect(src).not.toMatch(/from\s+['"].*mexc/i);
    expect(src).not.toMatch(/from\s+['"].*ccxt/i);
    expect(src).not.toMatch(/from\s+['"].*runtimeExecutionState/i);
    expect(src).not.toMatch(/from\s+['"].*engineWorker/i);
    expect(src).not.toMatch(/from\s+['"].*scheduler/i);
    expect(src).not.toMatch(/from\s+['"].*artemisOrchestrator/i);
    // Only Replay hashToUuid import allowed besides nothing else production.
    expect(src).toMatch(/from\s+['"]\.\/artemisReplayContract\.js['"]/);
  });

  test('46. no Source-of-Truth claim', () => {
    expect(SEGMENTED_PERFORMANCE_POLICY_IS_SOURCE_OF_TRUTH).toBe(false);
    const d = getSegmentedPerformancePolicyDescriptor();
    expect(d.isSourceOfTruth).toBe(false);
    const result = validateCanonicalSegmentIdentity(baseSegment());
    expect(result.isSourceOfTruth).toBe(false);
    expect(result.ownershipRole).toBe(SEGMENTED_PERFORMANCE_POLICY_OWNERSHIP_ROLE);
  });

  test('47. global-only artifact cannot masquerade as segmented', () => {
    expectFail(
      () => assertNotGlobalAverageOnlyBypass({
        segmentScope: SEGMENT_SCOPE.GLOBAL_AVERAGE_ONLY,
        segmented: true,
      }),
      'SEGMENTED_PERFORMANCE_POLICY_GLOBAL_AVERAGE_BYPASS',
    );
    expectFail(
      () => assertNotGlobalAverageOnlyBypass({
        globalAverageOnly: true,
        claimType: 'GLOBAL_AVERAGE_ONLY',
      }),
      'SEGMENTED_PERFORMANCE_POLICY_GLOBAL_AVERAGE_NOT_SUFFICIENT',
    );
  });

  test('48. unavailable segment cannot become global', () => {
    expectFail(
      () => assertNotGlobalAverageOnlyBypass({
        segmentScope: SEGMENT_SCOPE.UNAVAILABLE,
        segmented: true,
        segmentId: 'x',
      }),
      'SEGMENTED_PERFORMANCE_POLICY_INVALID_SEGMENT_SCOPE_COERCION',
    );
  });

  test('49. unsupported segment cannot become global', () => {
    expectFail(
      () => assertNotGlobalAverageOnlyBypass({
        segmentScope: SEGMENT_SCOPE.UNSUPPORTED,
        segmented: true,
      }),
      'SEGMENTED_PERFORMANCE_POLICY_INVALID_SEGMENT_SCOPE_COERCION',
    );
    expectFail(
      () => assertNotGlobalAverageOnlyBypass({
        segmentScope: SEGMENT_SCOPE.MISSING,
      }),
      'SEGMENTED_PERFORMANCE_POLICY_SEGMENT_SCOPE_NOT_SEGMENTED',
    );
  });

  test('50. canonical version binding preserved', () => {
    expect(SEGMENTED_PERFORMANCE_POLICY_SCHEMA_VERSION).toBe('1.0.0');
    expect(SEGMENTED_PERFORMANCE_POLICY_CONTRACT_VERSION).toBe(
      'artemis-segmented-performance-policy-1.0.0',
    );
    expect(SEGMENTED_PERFORMANCE_POLICY_POLICY_VERSION).toBe(
      'artemis-segmented-performance-policy-policy-1.0.0',
    );
    expect(SEGMENTED_PERFORMANCE_POLICY_IMPLEMENTATION_VERSION).toBe('1.0.0');
    expect(SEGMENTED_PERFORMANCE_POLICY_ARTIFACT_TYPE).toBe(
      'ARTEMIS_SEGMENTED_PERFORMANCE_POLICY',
    );
    expect(SEGMENTED_PERFORMANCE_POLICY_AUTHORITY_CLASS).toBe('OUTCOME_EVALUATION');
    expect(SEGMENTED_PERFORMANCE_POLICY_SLICE_ID).toBe(
      'S10-SEGMENTED-PERFORMANCE-POLICY-CONTRACT',
    );
    expect(SEGMENTED_PERFORMANCE_POLICY_OFFICIAL_NAME).toBe(
      'ARTEMIS_SEGMENTED_PERFORMANCE_POLICY_CONTRACT_BOUNDARY',
    );
    const d = getSegmentedPerformancePolicyDescriptor();
    expect(d.contractVersion).toBe(SEGMENTED_PERFORMANCE_POLICY_CONTRACT_VERSION);
    expect(d.policyVersion).toBe(SEGMENTED_PERFORMANCE_POLICY_POLICY_VERSION);
    expect(validateSegmentedPerformancePolicyDescriptor(cloneDescriptor())).toBe(
      SEGMENTED_PERFORMANCE_POLICY_DESCRIPTOR,
    );
  });
});

describe('artemisSegmentedPerformancePolicyContract — additional semantics', () => {
  test('canonical segment dimensions are exactly four', () => {
    expect(AUTHORIZED_CANONICAL_SEGMENT_DIMENSIONS).toEqual([
      'venue',
      'marketType',
      'symbol',
      'timeframe',
    ]);
    expect(CANONICAL_SEGMENT_DIMENSION_ORDER).toEqual([
      'venue',
      'marketType',
      'symbol',
      'timeframe',
    ]);
    expect(Object.isFrozen(AUTHORIZED_CANONICAL_SEGMENT_DIMENSIONS)).toBe(true);
    expect(REGIME_IDENTITY_CANONICAL).toBe(false);
    expect(REGIME_CLASSIFIER).toBe(false);
    expect(REGIME_CREATION).toBe(false);
    expect(ANALYSIS_HORIZON_SEGMENTATION).toBe(false);
    expect(SAMPLE_SUFFICIENCY_OWNER).toBe('NONE');
    expect(SAMPLE_SUFFICIENCY_POLICY).toBe(
      'UNDEFINED / DEFERRED / LATER_STAGE10_DEPENDENCY',
    );
    expect(GLOBAL_AVERAGE_ONLY).toBe('NOT_SUFFICIENT_FOR_STAGE10');
    expect(GLOBAL_AVERAGE_ONLY_BYPASS).toBe('CLOSED');
    expect(TRUST_WEIGHTING).toBe('NOT_AUTHORIZED');
    expect(PROMOTION).toBe('NOT_AUTHORIZED');
    expect(DEMOTION).toBe('NOT_AUTHORIZED');
    expect(CALIBRATION_EXECUTION).toBe(false);
    expect(BINARY_BRIER_EXECUTION).toBe(false);
  });

  test('matching caller-supplied segmentId accepted', () => {
    const id = computeCanonicalSegmentId(baseSegment());
    const result = validateCanonicalSegmentIdentity({
      ...baseSegment(),
      segmentId: id,
    });
    expect(result.segmentId).toBe(id);
  });

  test('homogeneous cohort with version binding succeeds', () => {
    const item = {
      ...baseSegment(),
      methodKey: 'directional.v1',
      methodImplementationVersion: '1.0.0',
      evaluationImplementationVersion: '1.0.0',
      policyVersion: 'eval-policy-1.0.0',
      contractVersion: 'eval-contract-1.0.0',
    };
    const result = assertHomogeneousSegmentCohort([item, { ...item }, { ...item }]);
    expect(result.homogeneous).toBe(true);
    expect(result.count).toBe(3);
    expect(result.segmentId).toBe(computeCanonicalSegmentId(baseSegment()));
    expect(result.cohort.methodKey).toBe('directional.v1');
  });

  test('validateCohortDescriptor fills absent version fields as null', () => {
    const c = validateCohortDescriptor(baseSegment());
    for (const f of CANONICAL_VERSION_BINDING_FIELDS) {
      expect(c[f]).toBeNull();
    }
    expect(COHORT_DESCRIPTOR_ALLOWLIST).toEqual([
      ...AUTHORIZED_CANONICAL_SEGMENT_DIMENSIONS,
      ...CANONICAL_VERSION_BINDING_FIELDS,
    ]);
  });

  test('all-null segment dims → UNAVAILABLE identity (not global)', () => {
    const result = validateCanonicalSegmentIdentity({
      venue: null,
      marketType: null,
      symbol: null,
      timeframe: null,
    });
    expect(result.segmentIdentityStatus).toBe(SEGMENT_IDENTITY_STATUS.UNAVAILABLE);
    expect(result.segmentScope).toBe(SEGMENT_SCOPE.SEGMENTED);
  });

  test('empty string dimension rejected', () => {
    expectFail(
      () => validateCanonicalSegmentIdentity(baseSegment({ symbol: '' })),
      'SEGMENTED_PERFORMANCE_POLICY_SEGMENT_DIMENSION_EMPTY',
    );
  });

  test('valid segmented claim via assertNotGlobalAverageOnlyBypass', () => {
    const result = assertNotGlobalAverageOnlyBypass({
      segmented: true,
      ...baseSegment(),
    });
    expect(result.segmentId).toBe(computeCanonicalSegmentId(baseSegment()));
  });

  test('descriptor hard flags all false and frozen', () => {
    const d = getSegmentedPerformancePolicyDescriptor();
    for (const [k, v] of Object.entries(REQUIRED_HARD_FLAGS)) {
      expect(d.hardFlags[k]).toBe(false);
      expect(v).toBe(false);
    }
    expect(Object.isFrozen(d)).toBe(true);
    expect(Object.isFrozen(SEGMENTED_PERFORMANCE_POLICY_DESCRIPTOR)).toBe(true);
  });

  test('default export surface is frozen and non-executing', () => {
    expect(Object.isFrozen(policyDefault)).toBe(true);
    expect(policyDefault.getSegmentedPerformancePolicyDescriptor).toBe(
      getSegmentedPerformancePolicyDescriptor,
    );
    expect(policyDefault.CALIBRATION_EXECUTION).toBe(false);
    expect(policyDefault.BINARY_BRIER_EXECUTION).toBe(false);
    expect(policyDefault.REGIME_IDENTITY_CANONICAL).toBe(false);
  });

  test('limitations include Stage 10 baseline strings', () => {
    expect(SEGMENTED_PERFORMANCE_POLICY_LIMITATIONS).toEqual(
      expect.arrayContaining([
        'regime_identity_canonical_no',
        'global_average_only_bypass_closed',
        'sample_sufficiency_policy_deferred',
        'library_only',
        'is_source_of_truth_false',
        'no_trust_mutation',
        'no_promotion_execution',
        'no_demotion_execution',
        'no_calibration_execution',
      ]),
    );
  });
});

describe('artemisSegmentedPerformancePolicyContract — adversarial', () => {
  test('A. sliceId / ownershipRole / artifactType override rejected', () => {
    for (const [field, value, code] of [
      ['sliceId', 'OTHER-SLICE', 'SEGMENTED_PERFORMANCE_POLICY_SLICE_ID_MISMATCH'],
      [
        'ownershipRole',
        'SOURCE_OF_TRUTH',
        'SEGMENTED_PERFORMANCE_POLICY_OWNERSHIP_ROLE_MISMATCH',
      ],
      [
        'artifactType',
        'ARTEMIS_EVIL',
        'SEGMENTED_PERFORMANCE_POLICY_ARTIFACT_TYPE_MISMATCH',
      ],
      [
        'officialName',
        'OTHER',
        'SEGMENTED_PERFORMANCE_POLICY_OFFICIAL_NAME_MISMATCH',
      ],
    ]) {
      const d = cloneDescriptor();
      d[field] = value;
      expectFail(() => validateSegmentedPerformancePolicyDescriptor(d), code);
    }
  });

  test('B. isSourceOfTruth true rejected', () => {
    const d = cloneDescriptor();
    d.isSourceOfTruth = true;
    expectFail(
      () => validateSegmentedPerformancePolicyDescriptor(d),
      'SEGMENTED_PERFORMANCE_POLICY_IS_SOURCE_OF_TRUTH_MISMATCH',
    );
  });

  test('C. side-effect nonzero rejected', () => {
    const d = cloneDescriptor();
    d.sideEffects.dbWriteCount = 1;
    expectFail(
      () => validateSegmentedPerformancePolicyDescriptor(d),
      'SEGMENTED_PERFORMANCE_POLICY_SIDE_EFFECT_NONZERO',
    );
  });

  test('D. regimeIdentityCanonical true rejected on descriptor', () => {
    const d = cloneDescriptor();
    d.regimeIdentityCanonical = true;
    expectFail(
      () => validateSegmentedPerformancePolicyDescriptor(d),
      'SEGMENTED_PERFORMANCE_POLICY_REGIME_IDENTITY_MISMATCH',
    );
  });

  test('E. dimension list mutation on descriptor rejected', () => {
    const d = cloneDescriptor();
    d.authorizedCanonicalSegmentDimensions = [
      'venue',
      'marketType',
      'symbol',
      'timeframe',
      'regime',
    ];
    expectFail(
      () => validateSegmentedPerformancePolicyDescriptor(d),
      'SEGMENTED_PERFORMANCE_POLICY_DIMENSIONS_MISMATCH',
    );
  });

  test('F. all unsupported segmentation dims fail closed', () => {
    for (const dim of UNSUPPORTED_SEGMENTATION_DIMENSIONS) {
      expectFail(
        () => validateCanonicalSegmentIdentity({ ...baseSegment(), [dim]: 'x' }),
        'SEGMENTED_PERFORMANCE_POLICY_UNSUPPORTED_DIMENSION',
      );
    }
  });

  test('G. sample sufficiency field vocabulary fail closed', () => {
    for (const field of [
      'minimumN',
      'minSampleSize',
      'significanceLevel',
      'statisticalPower',
      'segmentMinimum',
    ]) {
      expect(FORBIDDEN_SAMPLE_SUFFICIENCY_FIELDS).toContain(field);
      expectFail(
        () => validateCanonicalSegmentIdentity({ ...baseSegment(), [field]: 1 }),
        'SEGMENTED_PERFORMANCE_POLICY_SAMPLE_SUFFICIENCY_FORBIDDEN',
      );
    }
  });

  test('H. trust/promotion vocabulary fail closed', () => {
    for (const field of ['trustScore', 'weight', 'promotionThreshold', 'demotionThreshold']) {
      expect(FORBIDDEN_TRUST_PROMOTION_FIELDS).toContain(field);
      expectFail(
        () => validateCanonicalSegmentIdentity({ ...baseSegment(), [field]: 1 }),
        'SEGMENTED_PERFORMANCE_POLICY_TRUST_PROMOTION_FORBIDDEN',
      );
    }
  });

  test('I. calibration vocabulary fail closed', () => {
    for (const field of ['brierScore', 'ece', 'logLoss', 'reliabilityCurve']) {
      expect(FORBIDDEN_CALIBRATION_METRIC_FIELDS).toContain(field);
      expectFail(
        () => validateCanonicalSegmentIdentity({ ...baseSegment(), [field]: 0.1 }),
        'SEGMENTED_PERFORMANCE_POLICY_CALIBRATION_METRIC_FORBIDDEN',
      );
    }
  });

  test('J. performance computation fields fail closed', () => {
    expectFail(
      () => validateCanonicalSegmentIdentity({
        ...baseSegment(),
        matchRate: 0.9,
      }),
      'SEGMENTED_PERFORMANCE_POLICY_PERFORMANCE_COMPUTATION_FORBIDDEN',
    );
  });

  test('K. non-object / array / null inputs fail closed', () => {
    expectFail(
      () => validateCanonicalSegmentIdentity(null),
      'SEGMENTED_PERFORMANCE_POLICY_SEGMENT_INVALID',
    );
    expectFail(
      () => validateCanonicalSegmentIdentity([]),
      'SEGMENTED_PERFORMANCE_POLICY_SEGMENT_INVALID',
    );
    expectFail(
      () => validateCanonicalSegmentIdentity('mexc'),
      'SEGMENTED_PERFORMANCE_POLICY_SEGMENT_INVALID',
    );
    expectFail(
      () => assertHomogeneousSegmentCohort([]),
      'SEGMENTED_PERFORMANCE_POLICY_COHORT_LIST_INVALID',
    );
  });

  test('L. different segments produce different identities', () => {
    const a = computeCanonicalSegmentId(baseSegment());
    const b = computeCanonicalSegmentId(baseSegment({ symbol: 'ETH/USDT' }));
    const c = computeCanonicalSegmentId(baseSegment({ timeframe: '4h' }));
    expect(a).not.toBe(b);
    expect(a).not.toBe(c);
    expect(b).not.toBe(c);
  });

  test('M. shallow-frozen parent cannot preserve mutable nested authority', () => {
    const result = validateCanonicalSegmentIdentity(baseSegment());
    const nested = result.hardFlags;
    expect(() => {
      nested.promotionExecution = true;
    }).toThrow();
    expect(result.hardFlags.promotionExecution).toBe(false);
  });

  test('N. secret-like keys rejected', () => {
    expectFail(
      () => validateCanonicalSegmentIdentity({
        ...baseSegment(),
        apiKey: 'secret',
      }),
      'SEGMENTED_PERFORMANCE_POLICY_SEGMENT_UNKNOWN_FIELD',
    );
  });

  test('O. missing segment claim without segment dims fails', () => {
    expectFail(
      () => assertNotGlobalAverageOnlyBypass({ segmented: true }),
      'SEGMENTED_PERFORMANCE_POLICY_SEGMENT_REQUIRED',
    );
  });

  test('P. getDescriptor returns same frozen singleton', () => {
    expect(getSegmentedPerformancePolicyDescriptor()).toBe(
      SEGMENTED_PERFORMANCE_POLICY_DESCRIPTOR,
    );
    expect(getSegmentedPerformancePolicyDescriptor()).toBe(
      getSegmentedPerformancePolicyDescriptor(),
    );
  });

  test('Q. empty limitations on descriptor rejected', () => {
    const d = cloneDescriptor();
    d.limitations = [];
    expectFail(
      () => validateSegmentedPerformancePolicyDescriptor(d),
      'SEGMENTED_PERFORMANCE_POLICY_LIMITATIONS_INVALID',
    );
  });

  test('R. callerSelfRegistration true rejected', () => {
    const d = cloneDescriptor();
    d.callerSelfRegistration = true;
    expectFail(
      () => validateSegmentedPerformancePolicyDescriptor(d),
      'SEGMENTED_PERFORMANCE_POLICY_SELF_REGISTRATION_FORBIDDEN',
    );
  });

  test('S. non-string segmentId rejected', () => {
    expectFail(
      () => validateCanonicalSegmentIdentity({
        ...baseSegment(),
        segmentId: 12345,
      }),
      'SEGMENTED_PERFORMANCE_POLICY_SEGMENT_ID_INVALID',
    );
  });

  test('T. numeric dimension type rejected', () => {
    expectFail(
      () => validateCanonicalSegmentIdentity(baseSegment({ venue: 1 })),
      'SEGMENTED_PERFORMANCE_POLICY_SEGMENT_DIMENSION_INVALID',
    );
  });
});
