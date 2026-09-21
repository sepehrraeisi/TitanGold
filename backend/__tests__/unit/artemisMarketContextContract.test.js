/**
 * @jest-environment node
 *
 * Artemis Core Stage 8 — Market Context Contract Boundary (S8-MC-CONTRACT) unit tests.
 */
import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  AVAILABILITY,
  CORRELATION_FAMILY,
  FRESHNESS_STATUS,
  MARKET_TYPE,
} from '../../contracts/artemisEvidenceContract.js';
import {
  DECISION_CONTEXT_CONTRACT_VERSION,
} from '../../contracts/artemisDecisionContextContract.js';
import {
  SHADOW_RECORDING_CONTRACT_VERSION,
} from '../../contracts/artemisShadowDecisionRecordingBoundaryContract.js';
import {
  ALLOWED_TIMEFRAMES,
  FORBIDDEN_MARKET_CONTEXT_SOT_OWNERS,
  MARKET_CONTEXT_ARTIFACT_TYPE,
  MARKET_CONTEXT_AUTHORITY_CLASS,
  MARKET_CONTEXT_CONTRACT_VERSION,
  MARKET_CONTEXT_OWNERSHIP_ROLE,
  MARKET_CONTEXT_POLICY_VERSION,
  MARKET_CONTEXT_SCHEMA_VERSION,
  MARKET_CONTEXT_SLICE_ID,
  MARKET_CONTEXT_SOT_STATUS,
  MARKET_CONTEXT_STAGE,
  MARKET_CONTEXT_WRITER,
  MARKET_SOURCE_CLASS,
  NEW_SOT_OWNER_REQUIRED,
  REQUIRED_HARD_FLAGS,
  ZERO_MARKET_CONTEXT_SIDE_EFFECTS,
  buildMarketContext,
  toMarketContextRef,
  validateMarketContext,
} from '../../contracts/artemisMarketContextContract.js';

const CONTEXT_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const SOURCE_TS = '2026-09-20T11:00:00.000Z';
const INGEST_TS = '2026-09-20T11:00:05.000Z';
const RECORDED_AT = '2026-09-20T11:00:05.000Z';
const EXPIRY_TS = '2026-09-20T12:00:00.000Z';

const CONTRACT_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../contracts/artemisMarketContextContract.js',
);
const C81_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../contracts/artemisShadowDecisionRecordingBoundaryContract.js',
);

function baseIdentity(overrides = {}) {
  return {
    venue: 'mexc',
    marketType: MARKET_TYPE.SPOT,
    symbol: 'BTC/USDT',
    baseAsset: 'BTC',
    quoteAsset: 'USDT',
    timeframe: '1h',
    horizon: 'intraday',
    ...overrides,
  };
}

function baseObservation(overrides = {}) {
  return {
    sourceTimestamp: SOURCE_TS,
    ingestionTimestamp: INGEST_TS,
    freshnessStatus: FRESHNESS_STATUS.FRESH,
    expiryTimestamp: EXPIRY_TS,
    availability: AVAILABILITY.AVAILABLE,
    sourceClass: MARKET_SOURCE_CLASS.PUBLIC_MARKET_DATA_ATTESTATION,
    correlationFamily: CORRELATION_FAMILY.OHLCV_CANDLE,
    provenance: {
      writer: 'testMarketAttestor',
      methodKey: 'attest_public_market_identity',
      stage: MARKET_CONTEXT_STAGE,
      recordedAt: INGEST_TS,
      sourceClass: MARKET_SOURCE_CLASS.PUBLIC_MARKET_DATA_ATTESTATION,
    },
    ...overrides,
  };
}

function baseInput(overrides = {}) {
  return {
    identity: baseIdentity(),
    observation: baseObservation(),
    recordedAt: RECORDED_AT,
    decisionContextId: CONTEXT_ID,
    decisionEligible: false,
    executionEligible: false,
    approvedForExecution: false,
    liveTradingEnabled: false,
    paperTradingEnabled: false,
    providerConnected: false,
    ...overrides,
  };
}

function expectFail(result, codeOrField) {
  expect(result.ok).toBe(false);
  if (codeOrField) {
    const match = result.code === codeOrField
      || (Array.isArray(result.errors)
        && result.errors.some((e) => e.code === codeOrField || e.field === codeOrField
          || e.field?.endsWith(`.${codeOrField}`)
          || e.field?.includes(codeOrField)));
    expect(match).toBe(true);
  }
}

describe('artemisMarketContextContract — S8-MC-CONTRACT', () => {
  it('1. accepts valid market identity', () => {
    const result = buildMarketContext(baseInput());
    expect(result.ok).toBe(true);
    expect(result.artifact.identity).toEqual(expect.objectContaining({
      venue: 'mexc',
      marketType: MARKET_TYPE.SPOT,
      symbol: 'BTC/USDT',
      baseAsset: 'BTC',
      quoteAsset: 'USDT',
      timeframe: '1h',
      horizon: 'intraday',
    }));
  });

  it('2. accepts valid observation envelope', () => {
    const result = buildMarketContext(baseInput());
    expect(result.ok).toBe(true);
    expect(result.artifact.observation).toEqual(expect.objectContaining({
      sourceTimestamp: SOURCE_TS,
      ingestionTimestamp: INGEST_TS,
      freshnessStatus: FRESHNESS_STATUS.FRESH,
      availability: AVAILABILITY.AVAILABLE,
      sourceClass: MARKET_SOURCE_CLASS.PUBLIC_MARKET_DATA_ATTESTATION,
      correlationFamily: CORRELATION_FAMILY.OHLCV_CANDLE,
    }));
  });

  it('3. produces deterministic artifact identity for identical input', () => {
    const a = buildMarketContext(baseInput());
    const b = buildMarketContext(baseInput());
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
    expect(a.artifact.marketContextId).toBe(b.artifact.marketContextId);
    expect(a.artifact.contractVersion).toBe(MARKET_CONTEXT_CONTRACT_VERSION);
    expect(a.artifact.schemaVersion).toBe(MARKET_CONTEXT_SCHEMA_VERSION);
    expect(a.artifact.policyVersion).toBe(MARKET_CONTEXT_POLICY_VERSION);
    expect(a.artifact.artifactType).toBe(MARKET_CONTEXT_ARTIFACT_TYPE);
    expect(a.artifact.authorityClass).toBe(MARKET_CONTEXT_AUTHORITY_CLASS);
  });

  it('4. fails closed on missing venue', () => {
    const result = buildMarketContext(baseInput({
      identity: baseIdentity({ venue: undefined }),
    }));
    expectFail(result, 'required_string');
    expect(result.errors.some((e) => e.field === 'identity.venue')).toBe(true);
  });

  it('5. fails closed on missing symbol', () => {
    const result = buildMarketContext(baseInput({
      identity: baseIdentity({ symbol: '' }),
    }));
    expectFail(result, 'identity.symbol');
  });

  it('6. fails closed on malformed symbol', () => {
    const result = buildMarketContext(baseInput({
      identity: baseIdentity({ symbol: 'btc-usdt' }),
    }));
    expectFail(result, 'malformed_symbol');
  });

  it('7. fails closed on missing timeframe', () => {
    const result = buildMarketContext(baseInput({
      identity: baseIdentity({ timeframe: undefined }),
    }));
    expectFail(result, 'required_timeframe');
  });

  it('8. fails closed on malformed timeframe', () => {
    const result = buildMarketContext(baseInput({
      identity: baseIdentity({ timeframe: 'hourly' }),
    }));
    expectFail(result, 'malformed_timeframe');
  });

  it('9. fails closed on malformed source timestamp', () => {
    const result = buildMarketContext(baseInput({
      observation: baseObservation({ sourceTimestamp: 'not-a-timestamp' }),
    }));
    expectFail(result, 'malformed_source_timestamp');
  });

  it('10. fails closed on future source timestamp', () => {
    const result = buildMarketContext(baseInput({
      observation: baseObservation({
        sourceTimestamp: '2099-01-01T00:00:00.000Z',
        ingestionTimestamp: INGEST_TS,
      }),
    }));
    expectFail(result, 'future_source_timestamp');
  });

  it('11. fails closed on stale observation', () => {
    const result = buildMarketContext(baseInput({
      observation: baseObservation({ freshnessStatus: FRESHNESS_STATUS.STALE }),
    }));
    expectFail(result, 'stale_observation');
  });

  it('12. fails closed on expired observation (freshness)', () => {
    const result = buildMarketContext(baseInput({
      observation: baseObservation({ freshnessStatus: FRESHNESS_STATUS.EXPIRED }),
    }));
    expectFail(result, 'expired_observation');
  });

  it('12b. fails closed on expired observation (expiryTimestamp before ingestion)', () => {
    const result = buildMarketContext(baseInput({
      observation: baseObservation({ expiryTimestamp: '2026-09-20T10:00:00.000Z' }),
    }));
    expectFail(result, 'expired_observation');
  });

  it('13. fails closed on unavailable source', () => {
    const result = buildMarketContext(baseInput({
      observation: baseObservation({ availability: AVAILABILITY.UNAVAILABLE }),
    }));
    expectFail(result, 'unavailable_source');
  });

  it('14. fails closed on unknown freshness', () => {
    const result = buildMarketContext(baseInput({
      observation: baseObservation({ freshnessStatus: FRESHNESS_STATUS.UNKNOWN }),
    }));
    expectFail(result, 'unknown_freshness');
  });

  it('15. fails closed on invalid provenance', () => {
    const result = buildMarketContext(baseInput({
      observation: baseObservation({
        provenance: {
          writer: '',
          methodKey: '',
          stage: MARKET_CONTEXT_STAGE,
          recordedAt: INGEST_TS,
        },
      }),
    }));
    expectFail(result, 'required_string');
  });

  it('16. fails closed on invalid correlationFamily', () => {
    const result = buildMarketContext(baseInput({
      observation: baseObservation({ correlationFamily: 'not_a_family' }),
    }));
    expectFail(result, 'invalid_correlation_family');
  });

  it('17. fails closed on unknown fields', () => {
    const result = buildMarketContext({
      ...baseInput(),
      mysteryField: true,
    });
    expectFail(result, 'unknown_field');
  });

  it('18. fails closed on credentials contamination', () => {
    const result = buildMarketContext({
      ...baseInput(),
      credentials: { user: 'x' },
    });
    expect(result.ok).toBe(false);
    expect(
      result.errors.some((e) => e.code === 'forbidden_field' || e.code === 'secret_contamination'
        || e.field === 'credentials'),
    ).toBe(true);
  });

  it('19. fails closed on apiKey contamination', () => {
    const result = buildMarketContext({
      ...baseInput(),
      apiKey: 'sk-test',
    });
    expect(result.ok).toBe(false);
    expect(
      result.errors.some((e) => e.field === 'apiKey'
        || e.code === 'forbidden_field'
        || e.code === 'secret_contamination'),
    ).toBe(true);
  });

  it('20. fails closed on signed payload contamination', () => {
    const result = buildMarketContext({
      ...baseInput(),
      signedPayload: 'abc',
    });
    expectFail(result, 'forbidden_field');
  });

  it('21. fails closed on executionIntent contamination', () => {
    const result = buildMarketContext({
      ...baseInput(),
      executionIntent: { side: 'BUY' },
    });
    expectFail(result, 'forbidden_field');
  });

  it('22. fails closed on order contamination', () => {
    const result = buildMarketContext({
      ...baseInput(),
      order: { id: '1' },
    });
    expectFail(result, 'forbidden_field');
  });

  it('23. fails closed on walletAction contamination', () => {
    const result = buildMarketContext({
      ...baseInput(),
      walletAction: { type: 'withdraw' },
    });
    expectFail(result, 'forbidden_field');
  });

  it('24. fails closed on BUY/SELL/LONG/SHORT contamination', () => {
    const buy = buildMarketContext({
      ...baseInput(),
      identity: { ...baseIdentity(), note: undefined },
      observation: { ...baseObservation(), direction: 'BUY' },
    });
    // direction is unknown_field on observation allowlist
    expect(buy.ok).toBe(false);

    const nested = buildMarketContext({
      ...baseInput(),
      action: 'SELL',
    });
    expect(nested.ok).toBe(false);
  });

  it('24b. fails closed when nested execution authority value appears', () => {
    const result = buildMarketContext({
      ...baseInput(),
      lineage: { decisionContextId: CONTEXT_ID, side: 'LONG' },
    });
    expect(result.ok).toBe(false);
  });

  it('25. fails closed on provider transaction contamination', () => {
    const result = buildMarketContext({
      ...baseInput(),
      providerTransaction: { txId: 'x' },
    });
    expectFail(result, 'forbidden_field');
  });

  it('25b. fails closed on fabricated marketSnapshot / OHLCV contamination', () => {
    const snap = buildMarketContext({
      ...baseInput(),
      marketSnapshot: { last: 1 },
    });
    expectFail(snap, 'forbidden_field');

    const ohlcv = buildMarketContext({
      ...baseInput(),
      observation: { ...baseObservation(), ohlcv: [[1, 2, 3, 4, 5]] },
    });
    expect(ohlcv.ok).toBe(false);
  });

  it('26. C8.1 reference compatibility (S8-C81-MC-REF may consume ref semantics)', () => {
    const result = buildMarketContext(baseInput());
    expect(result.ok).toBe(true);
    expect(result.artifact.compatibility.c81ReferenceCompatible).toBe(true);
    expect(result.artifact.compatibility.doesNotModifyC81).toBe(true);
    expect(result.artifact.compatibility.shadowRecordingContractVersion)
      .toBe(SHADOW_RECORDING_CONTRACT_VERSION);

    const ref = toMarketContextRef(result.artifact);
    expect(ref.ok).toBe(true);
    expect(ref.ref.marketContextId).toBe(result.artifact.marketContextId);
    expect(ref.ref.contractVersion).toBe(MARKET_CONTEXT_CONTRACT_VERSION);

    // C8.1 may validate optional marketContextRef using mirrored S8-MC semantics,
    // but must not import this contract (circular dependency; SoT ownership unchanged).
    const c81Source = readFileSync(C81_PATH, 'utf8');
    expect(c81Source).toContain('SHADOW_DECISION_RECORDING');
    expect(c81Source).toContain('marketContextRef');
    expect(c81Source).not.toMatch(/from ['"]\.\/artemisMarketContextContract\.js['"]/);
    expect(c81Source).toContain(MARKET_CONTEXT_CONTRACT_VERSION);
  });

  it('27. Decision Context identity compatibility', () => {
    const result = buildMarketContext(baseInput({
      decisionContextId: CONTEXT_ID,
      lineage: {
        decisionContextId: CONTEXT_ID,
        decisionContextContractVersion: DECISION_CONTEXT_CONTRACT_VERSION,
      },
    }));
    expect(result.ok).toBe(true);
    expect(result.artifact.decisionContextId).toBe(CONTEXT_ID);
    expect(result.artifact.lineage.decisionContextContractVersion)
      .toBe(DECISION_CONTEXT_CONTRACT_VERSION);
    expect(result.artifact.compatibility.decisionContextContractVersion)
      .toBe(DECISION_CONTEXT_CONTRACT_VERSION);
  });

  it('28. evidence / observation separation (no evidence payload ownership)', () => {
    const result = buildMarketContext(baseInput());
    expect(result.ok).toBe(true);
    expect(result.artifact.ownership.role).toBe(MARKET_CONTEXT_OWNERSHIP_ROLE);
    expect(result.artifact.ownership.isSourceOfTruth).toBe(false);
    expect(result.artifact.ownership.sotStatus).toBe(MARKET_CONTEXT_SOT_STATUS);
    expect(result.artifact.ownership.newSotOwnerRequired).toBe(NEW_SOT_OWNER_REQUIRED);
    expect(NEW_SOT_OWNER_REQUIRED).toBe(true);
    expect(FORBIDDEN_MARKET_CONTEXT_SOT_OWNERS).toEqual(expect.arrayContaining([
      'EvidenceOrchestrationSet',
      'DecisionContext',
      'market-proxy',
      'mexcService',
      'ccxt',
    ]));
    expect(result.artifact).not.toHaveProperty('evidence');
    expect(result.artifact).not.toHaveProperty('evidenceItems');
  });

  it('29. source has no network imports', () => {
    const source = readFileSync(CONTRACT_PATH, 'utf8');
    expect(source).not.toMatch(/\bfetch\s*\(/);
    expect(source).not.toMatch(/from ['"]node:http['"]/);
    expect(source).not.toMatch(/from ['"]axios['"]/);
    expect(source).not.toMatch(/from ['"]ccxt['"]/);
    expect(source).not.toMatch(/from ['"][^'"]*market-proxy[^'"]*['"]/);
    expect(source).not.toMatch(/from ['"][^'"]*mexcService[^'"]*['"]/);
    expect(source).not.toMatch(/require\(['"][^'"]*ccxt[^'"]*['"]\)/);
    expect(source).not.toMatch(/require\(['"][^'"]*axios[^'"]*['"]\)/);
  });

  it('30. source has no DB imports', () => {
    const source = readFileSync(CONTRACT_PATH, 'utf8');
    expect(source).not.toMatch(/from ['"].*db\.js['"]/);
    expect(source).not.toMatch(/from ['"]pg['"]/);
    expect(source).not.toMatch(/createPool/);
    expect(source).not.toMatch(/node-pg/);
  });

  it('31. source has no Redis imports', () => {
    const source = readFileSync(CONTRACT_PATH, 'utf8');
    expect(source).not.toMatch(/ioredis/i);
    expect(source).not.toMatch(/createClient/);
    expect(source).not.toMatch(/from ['"].*redis/);
  });

  it('32. zero provider request side effects', () => {
    const result = buildMarketContext(baseInput());
    expect(result.ok).toBe(true);
    expect(result.sideEffects.providerRequestCount).toBe(0);
    expect(result.artifact.sideEffects).toEqual(ZERO_MARKET_CONTEXT_SIDE_EFFECTS);
  });

  it('33. zero order side effects and hard flags false', () => {
    const result = buildMarketContext(baseInput());
    expect(result.ok).toBe(true);
    expect(result.artifact.sideEffects.orderOperationCount).toBe(0);
    expect(result.artifact).toMatchObject(REQUIRED_HARD_FLAGS);
  });

  it('34. zero financial mutation counters', () => {
    const result = buildMarketContext(baseInput());
    expect(result.ok).toBe(true);
    expect(result.artifact.sideEffects.financialExecutionCount).toBe(0);
    expect(result.artifact.sideEffects.dbWriteCount).toBe(0);
    expect(result.artifact.sideEffects.redisWriteCount).toBe(0);
    expect(result.artifact.sideEffects.networkRequestCount).toBe(0);
    expect(result.artifact.sideEffects.llmCallCount).toBe(0);
  });

  it('35. validateMarketContext alias is deterministic identical to build', () => {
    const input = baseInput();
    const a = buildMarketContext(input);
    const b = validateMarketContext(input);
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
    expect(a.artifact).toEqual(b.artifact);
  });

  it('rejects hard-flag escalation', () => {
    const result = buildMarketContext(baseInput({ executionEligible: true }));
    expectFail(result, 'hard_flag_must_be_false');
  });

  it('rejects paperTradingEnabled true', () => {
    const result = buildMarketContext(baseInput({ paperTradingEnabled: true }));
    expectFail(result, 'hard_flag_must_be_false');
  });

  it('rejects liveTradingEnabled true', () => {
    const result = buildMarketContext(baseInput({ liveTradingEnabled: true }));
    expectFail(result, 'hard_flag_must_be_false');
  });

  it('rejects symbol/base/quote mismatch', () => {
    const result = buildMarketContext(baseInput({
      identity: baseIdentity({ symbol: 'ETH/USDT', baseAsset: 'BTC', quoteAsset: 'USDT' }),
    }));
    expectFail(result, 'symbol_base_quote_mismatch');
  });

  it('rejects unknown source class', () => {
    const result = buildMarketContext(baseInput({
      observation: baseObservation({ sourceClass: 'mexc' }),
    }));
    expectFail(result, 'unknown_source_class');
  });

  it('rejects missing marketType', () => {
    const result = buildMarketContext(baseInput({
      identity: baseIdentity({ marketType: undefined }),
    }));
    expectFail(result, 'required_market_type');
  });

  it('accepts aged freshness as usable', () => {
    const result = buildMarketContext(baseInput({
      observation: baseObservation({ freshnessStatus: FRESHNESS_STATUS.AGED }),
    }));
    expect(result.ok).toBe(true);
  });

  it('exports slice identity constants', () => {
    expect(MARKET_CONTEXT_SLICE_ID).toBe('S8-MC-CONTRACT');
    expect(MARKET_CONTEXT_STAGE).toBe('ARTEMIS_CORE_STAGE_8_MARKET_CONTEXT_CONTRACT_BOUNDARY');
    expect(MARKET_CONTEXT_WRITER).toBe('artemisMarketContextContract');
    expect(ALLOWED_TIMEFRAMES).toContain('1h');
  });

  it('rejects incompatible decision context contract version in lineage', () => {
    const result = buildMarketContext(baseInput({
      lineage: {
        decisionContextId: CONTEXT_ID,
        decisionContextContractVersion: 'not-a-real-version',
      },
    }));
    expectFail(result, 'incompatible_decision_context_contract');
  });

  it('freezes artifact deeply', () => {
    const result = buildMarketContext(baseInput());
    expect(result.ok).toBe(true);
    expect(Object.isFrozen(result.artifact)).toBe(true);
    expect(Object.isFrozen(result.artifact.identity)).toBe(true);
    expect(Object.isFrozen(result.artifact.observation)).toBe(true);
  });
});
