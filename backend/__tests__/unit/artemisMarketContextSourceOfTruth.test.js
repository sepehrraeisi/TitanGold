/**
 * @jest-environment node
 *
 * Artemis Core Stage 8 — Market Context Source of Truth (S8-MC-SOT) unit tests.
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
  MARKET_CONTEXT_CONTRACT_VERSION,
  MARKET_CONTEXT_SOT_STATUS as MC_CONTRACT_SOT_STATUS,
  MARKET_SOURCE_CLASS,
  MARKET_CONTEXT_STAGE,
  NEW_SOT_OWNER_REQUIRED,
  buildMarketContext,
} from '../../contracts/artemisMarketContextContract.js';
import {
  ACCEPT_STATUS,
  MARKET_CONTEXT_SOT_CONTRACT_VERSION,
  MARKET_CONTEXT_SOT_IS_SOURCE_OF_TRUTH,
  MARKET_CONTEXT_SOT_SLICE_ID,
  OBSERVATION_UNIQUENESS_TUPLE,
  buildObservationRowId,
  buildObservationUniquenessKey,
  computeEnvelopeSha256,
  composeObservationRecord,
} from '../../contracts/artemisMarketContextSourceOfTruthContract.js';
import {
  acceptAttestedObservation,
  createInMemoryMarketContextObservationStore,
  getForbiddenImportMarkers,
  getObservationByRowId,
  getObservationByUniqueness,
  rejectDelete,
  rejectUpdate,
} from '../../services/artemisMarketContextSourceOfTruthService.js';

const CONTEXT_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const SOURCE_TS = '2026-09-20T11:00:00.000Z';
const INGEST_TS = '2026-09-20T11:00:05.000Z';
const RECORDED_AT = '2026-09-20T11:00:05.000Z';
const EXPIRY_TS = '2026-09-20T12:00:00.000Z';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const SOT_CONTRACT_PATH = path.join(DIR, '../../contracts/artemisMarketContextSourceOfTruthContract.js');
const SOT_SERVICE_PATH = path.join(DIR, '../../services/artemisMarketContextSourceOfTruthService.js');
const MC_CONTRACT_PATH = path.join(DIR, '../../contracts/artemisMarketContextContract.js');
const C81_PATH = path.join(DIR, '../../contracts/artemisShadowDecisionRecordingBoundaryContract.js');
const C1_PATH = path.join(DIR, '../../contracts/artemisRiskControlRuntimeBoundaryContract.js');
const C3_PATH = path.join(DIR, '../../contracts/artemisPortfolioControlSizingBoundaryContract.js');
const C4_PATH = path.join(DIR, '../../contracts/artemisLiquidityExecutionFeasibilityBoundaryContract.js');
const C5_PATH = path.join(DIR, '../../contracts/artemisRuntimeCapabilityBoundaryContract.js');
const C6_PATH = path.join(DIR, '../../contracts/artemisOrderManagementExecutionBoundaryContract.js');
const MIGRATION_PATH = path.join(
  DIR,
  '../../database/migrations/053_artemis_market_context_observation_sot.sql',
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

function expectFail(result, code) {
  expect(result.ok).toBe(false);
  if (code) {
    const match = result.code === code
      || result.validationCode === code
      || (Array.isArray(result.errors)
        && result.errors.some((e) => e.code === code || e.field?.includes(code)));
    expect(match).toBe(true);
  }
}

describe('artemisMarketContextSourceOfTruth — S8-MC-SOT', () => {
  it('A — valid attested envelope accepted', () => {
    const store = createInMemoryMarketContextObservationStore();
    const result = acceptAttestedObservation(baseInput(), { store });
    expect(result.ok).toBe(true);
    expect(result.code).toBe(ACCEPT_STATUS.ACCEPTED);
    expect(result.observationRowId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-8[0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(result.marketContextId).toBeTruthy();
    expect(result.observationRowId).not.toBe(result.marketContextId);
    expect(result.sideEffects.sotAppendCount).toBe(1);
    expect(result.sideEffects.networkRequestCount).toBe(0);
    expect(result.hardFlags.decisionEligible).toBe(false);
    expect(store.getStats().rowCount).toBe(1);
  });

  it('B — invalid/missing venue rejected', () => {
    const store = createInMemoryMarketContextObservationStore();
    const input = baseInput({ identity: baseIdentity({ venue: undefined }) });
    delete input.identity.venue;
    expectFail(acceptAttestedObservation(input, { store }), ACCEPT_STATUS.VALIDATION_FAILED);
    expect(store.getStats().rowCount).toBe(0);
  });

  it('C — invalid/missing marketType rejected', () => {
    const store = createInMemoryMarketContextObservationStore();
    const input = baseInput({ identity: baseIdentity({ marketType: 'not_a_market' }) });
    expectFail(acceptAttestedObservation(input, { store }), ACCEPT_STATUS.VALIDATION_FAILED);
  });

  it('D — invalid/missing symbol rejected', () => {
    const store = createInMemoryMarketContextObservationStore();
    const input = baseInput({ identity: baseIdentity({ symbol: '' }) });
    expectFail(acceptAttestedObservation(input, { store }), ACCEPT_STATUS.VALIDATION_FAILED);
  });

  it('E — invalid/missing timeframe rejected', () => {
    const store = createInMemoryMarketContextObservationStore();
    const input = baseInput({ identity: baseIdentity({ timeframe: '99y' }) });
    expectFail(acceptAttestedObservation(input, { store }), ACCEPT_STATUS.VALIDATION_FAILED);
  });

  it('F — invalid sourceTimestamp rejected', () => {
    const store = createInMemoryMarketContextObservationStore();
    const input = baseInput({
      observation: baseObservation({ sourceTimestamp: 'not-iso' }),
    });
    expectFail(acceptAttestedObservation(input, { store }), ACCEPT_STATUS.VALIDATION_FAILED);
  });

  it('G — future sourceTimestamp rejected', () => {
    const store = createInMemoryMarketContextObservationStore();
    const input = baseInput({
      observation: baseObservation({
        sourceTimestamp: '2026-09-20T12:00:00.000Z',
        ingestionTimestamp: INGEST_TS,
      }),
      recordedAt: RECORDED_AT,
    });
    const result = acceptAttestedObservation(input, { store });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'future_source_timestamp'
      || e.code === 'source_after_ingestion')).toBe(true);
  });

  it('H — sourceTimestamp > ingestionTimestamp rejected', () => {
    const store = createInMemoryMarketContextObservationStore();
    const input = baseInput({
      observation: baseObservation({
        sourceTimestamp: '2026-09-20T11:00:10.000Z',
        ingestionTimestamp: INGEST_TS,
      }),
      recordedAt: '2026-09-20T11:00:10.000Z',
    });
    const result = acceptAttestedObservation(input, { store });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'source_after_ingestion')).toBe(true);
  });

  it('I — FRESH accepted', () => {
    const store = createInMemoryMarketContextObservationStore();
    const result = acceptAttestedObservation(baseInput({
      observation: baseObservation({ freshnessStatus: FRESHNESS_STATUS.FRESH }),
    }), { store });
    expect(result.ok).toBe(true);
    expect(result.record.freshnessStatus).toBe(FRESHNESS_STATUS.FRESH);
  });

  it('J — AGED accepted', () => {
    const store = createInMemoryMarketContextObservationStore();
    const result = acceptAttestedObservation(baseInput({
      observation: baseObservation({ freshnessStatus: FRESHNESS_STATUS.AGED }),
      identity: baseIdentity({ symbol: 'ETH/USDT', baseAsset: 'ETH' }),
    }), { store });
    expect(result.ok).toBe(true);
    expect(result.record.freshnessStatus).toBe(FRESHNESS_STATUS.AGED);
  });

  it('K — STALE rejected', () => {
    const store = createInMemoryMarketContextObservationStore();
    expectFail(acceptAttestedObservation(baseInput({
      observation: baseObservation({ freshnessStatus: FRESHNESS_STATUS.STALE }),
    }), { store }), ACCEPT_STATUS.VALIDATION_FAILED);
  });

  it('L — EXPIRED rejected', () => {
    const store = createInMemoryMarketContextObservationStore();
    expectFail(acceptAttestedObservation(baseInput({
      observation: baseObservation({ freshnessStatus: FRESHNESS_STATUS.EXPIRED }),
    }), { store }), ACCEPT_STATUS.VALIDATION_FAILED);
  });

  it('M — UNKNOWN rejected', () => {
    const store = createInMemoryMarketContextObservationStore();
    expectFail(acceptAttestedObservation(baseInput({
      observation: baseObservation({ freshnessStatus: FRESHNESS_STATUS.UNKNOWN }),
    }), { store }), ACCEPT_STATUS.VALIDATION_FAILED);
  });

  it('N — UNAVAILABLE rejected', () => {
    const store = createInMemoryMarketContextObservationStore();
    expectFail(acceptAttestedObservation(baseInput({
      observation: baseObservation({ freshnessStatus: FRESHNESS_STATUS.UNAVAILABLE }),
    }), { store }), ACCEPT_STATUS.VALIDATION_FAILED);
  });

  it('O — identical observation duplicate → no-op', () => {
    const store = createInMemoryMarketContextObservationStore();
    const input = baseInput();
    const first = acceptAttestedObservation(input, { store });
    const second = acceptAttestedObservation(input, { store });
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(second.code).toBe(ACCEPT_STATUS.ALREADY_PRESENT);
    expect(second.observationRowId).toBe(first.observationRowId);
    expect(second.envelopeSha256).toBe(first.envelopeSha256);
    expect(second.sideEffects.sotAppendCount).toBe(0);
    expect(store.getStats().rowCount).toBe(1);
  });

  it('P — same identity + different payload → reject', () => {
    const store = createInMemoryMarketContextObservationStore();
    const first = acceptAttestedObservation(baseInput(), { store });
    expect(first.ok).toBe(true);
    const conflict = acceptAttestedObservation(baseInput({
      observation: baseObservation({
        provenance: {
          writer: 'testMarketAttestor',
          methodKey: 'attest_public_market_identity',
          stage: MARKET_CONTEXT_STAGE,
          recordedAt: INGEST_TS,
          sourceClass: MARKET_SOURCE_CLASS.PUBLIC_MARKET_DATA_ATTESTATION,
          note: 'different-attested-payload',
        },
      }),
    }), { store });
    expect(conflict.ok).toBe(false);
    expect(conflict.code).toBe(ACCEPT_STATUS.CONFLICT);
    expect(store.getStats().rowCount).toBe(1);
  });

  it('Q — same timestamp + different sourceClass → distinct rows', () => {
    const store = createInMemoryMarketContextObservationStore();
    const a = acceptAttestedObservation(baseInput({
      observation: baseObservation({
        sourceClass: MARKET_SOURCE_CLASS.PUBLIC_MARKET_DATA_ATTESTATION,
        provenance: {
          writer: 'attestorA',
          methodKey: 'attest_a',
          stage: MARKET_CONTEXT_STAGE,
          recordedAt: INGEST_TS,
          sourceClass: MARKET_SOURCE_CLASS.PUBLIC_MARKET_DATA_ATTESTATION,
        },
      }),
    }), { store });
    const b = acceptAttestedObservation(baseInput({
      observation: baseObservation({
        sourceClass: MARKET_SOURCE_CLASS.INTERNAL_ATTESTED,
        provenance: {
          writer: 'attestorB',
          methodKey: 'attest_b',
          stage: MARKET_CONTEXT_STAGE,
          recordedAt: INGEST_TS,
          sourceClass: MARKET_SOURCE_CLASS.INTERNAL_ATTESTED,
        },
      }),
    }), { store });
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
    expect(a.observationRowId).not.toBe(b.observationRowId);
    expect(store.getStats().rowCount).toBe(2);
  });

  it('R — baseAsset/quoteAsset validation retained', () => {
    const store = createInMemoryMarketContextObservationStore();
    expectFail(acceptAttestedObservation(baseInput({
      identity: baseIdentity({ baseAsset: undefined }),
    }), { store }), ACCEPT_STATUS.VALIDATION_FAILED);
  });

  it('S — horizon optional behavior', () => {
    const store = createInMemoryMarketContextObservationStore();
    const identity = baseIdentity();
    delete identity.horizon;
    const result = acceptAttestedObservation(baseInput({
      identity,
      identityExtra: undefined,
    }), { store });
    // rebuild cleanly
    const store2 = createInMemoryMarketContextObservationStore();
    const id = {
      venue: 'mexc',
      marketType: MARKET_TYPE.SPOT,
      symbol: 'SOL/USDT',
      baseAsset: 'SOL',
      quoteAsset: 'USDT',
      timeframe: '1h',
    };
    const ok = acceptAttestedObservation(baseInput({ identity: id }), { store: store2 });
    expect(ok.ok).toBe(true);
    expect(ok.record.horizon).toBeNull();
  });

  it('T — provenance spoof rejected', () => {
    const store = createInMemoryMarketContextObservationStore();
    expectFail(acceptAttestedObservation(baseInput({
      observation: baseObservation({
        provenance: {
          writer: 'x',
          methodKey: 'y',
          stage: MARKET_CONTEXT_STAGE,
          recordedAt: INGEST_TS,
          forgedAuthority: 'admin',
        },
      }),
    }), { store }), ACCEPT_STATUS.VALIDATION_FAILED);
  });

  it('U — unknown top-level fields rejected', () => {
    const store = createInMemoryMarketContextObservationStore();
    expectFail(acceptAttestedObservation({
      ...baseInput(),
      extraTop: true,
    }, { store }), ACCEPT_STATUS.VALIDATION_FAILED);
  });

  it('V — unknown nested fields rejected', () => {
    const store = createInMemoryMarketContextObservationStore();
    expectFail(acceptAttestedObservation(baseInput({
      identity: { ...baseIdentity(), feedId: 'f1' },
    }), { store }), ACCEPT_STATUS.VALIDATION_FAILED);
  });

  it('W — order/execution contamination rejected', () => {
    const store = createInMemoryMarketContextObservationStore();
    expectFail(acceptAttestedObservation({
      ...baseInput(),
      orderId: 'ord-1',
    }, { store }), ACCEPT_STATUS.VALIDATION_FAILED);
  });

  it('X — wallet/financial contamination rejected', () => {
    const store = createInMemoryMarketContextObservationStore();
    expectFail(acceptAttestedObservation({
      ...baseInput(),
      withdrawal: { amount: 1 },
    }, { store }), ACCEPT_STATUS.VALIDATION_FAILED);
  });

  it('Y — provider/network contamination rejected', () => {
    const store = createInMemoryMarketContextObservationStore();
    expectFail(acceptAttestedObservation({
      ...baseInput(),
      providerPayload: { raw: true },
    }, { store }), ACCEPT_STATUS.VALIDATION_FAILED);
  });

  it('Z — outcome contamination rejected', () => {
    const store = createInMemoryMarketContextObservationStore();
    expectFail(acceptAttestedObservation({
      ...baseInput(),
      observedOutcome: { pnl: 1 },
    }, { store }), ACCEPT_STATUS.VALIDATION_FAILED);
  });

  it('AA — hard execution flags always false', () => {
    const store = createInMemoryMarketContextObservationStore();
    const result = acceptAttestedObservation(baseInput(), { store });
    expect(result.hardFlags).toEqual({
      decisionEligible: false,
      executionEligible: false,
      approvedForExecution: false,
      liveTradingEnabled: false,
      paperTradingEnabled: false,
      providerConnected: false,
    });
  });

  it('AB — deterministic identical input', () => {
    const store1 = createInMemoryMarketContextObservationStore();
    const store2 = createInMemoryMarketContextObservationStore();
    const a = acceptAttestedObservation(baseInput(), { store: store1 });
    const b = acceptAttestedObservation(baseInput(), { store: store2 });
    expect(a.observationRowId).toBe(b.observationRowId);
    expect(a.envelopeSha256).toBe(b.envelopeSha256);
    expect(a.uniquenessKey).toBe(b.uniquenessKey);
  });

  it('AC — append-only: no update', () => {
    const store = createInMemoryMarketContextObservationStore();
    const result = rejectUpdate(store);
    expect(result.ok).toBe(false);
    expect(result.code).toBe('APPEND_ONLY_NO_UPDATE');
  });

  it('AD — append-only: no delete', () => {
    const store = createInMemoryMarketContextObservationStore();
    const result = rejectDelete(store);
    expect(result.ok).toBe(false);
    expect(result.code).toBe('APPEND_ONLY_NO_DELETE');
  });

  it('AE — deterministic lookup/reference', () => {
    const store = createInMemoryMarketContextObservationStore();
    const accepted = acceptAttestedObservation(baseInput(), { store });
    const byId = getObservationByRowId(accepted.observationRowId, { store });
    const byKey = getObservationByUniqueness({
      venue: 'mexc',
      marketType: MARKET_TYPE.SPOT,
      symbol: 'BTC/USDT',
      timeframe: '1h',
      sourceTimestamp: SOURCE_TS,
      sourceClass: MARKET_SOURCE_CLASS.PUBLIC_MARKET_DATA_ATTESTATION,
    }, { store });
    expect(byId.ok).toBe(true);
    expect(byKey.ok).toBe(true);
    expect(byId.record.observationRowId).toBe(accepted.observationRowId);
    expect(byKey.record.observationRowId).toBe(accepted.observationRowId);
    expect(byId.marketContextRef.marketContextId).toBe(accepted.marketContextId);
  });

  it('AF — marketContextId is NOT observation identity', () => {
    const store = createInMemoryMarketContextObservationStore();
    const a = acceptAttestedObservation(baseInput({ decisionContextId: CONTEXT_ID }), { store });
    const store2 = createInMemoryMarketContextObservationStore();
    const otherCtx = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
    const b = acceptAttestedObservation(baseInput({ decisionContextId: otherCtx }), { store: store2 });
    expect(a.observationRowId).toBe(b.observationRowId);
    expect(a.marketContextId).not.toBe(b.marketContextId);
    expect(OBSERVATION_UNIQUENESS_TUPLE).toBe(
      'venue + marketType + symbol + timeframe + sourceTimestamp + sourceClass',
    );
  });

  it('AG — no sourceObservationId requirement', () => {
    const src = `${readFileSync(SOT_CONTRACT_PATH, 'utf8')}\n${readFileSync(SOT_SERVICE_PATH, 'utf8')}`;
    expect(src.includes('sourceObservationId')).toBe(false);
    const store = createInMemoryMarketContextObservationStore();
    expect(acceptAttestedObservation(baseInput(), { store }).ok).toBe(true);
  });

  it('AH — no feedId requirement', () => {
    const src = `${readFileSync(SOT_CONTRACT_PATH, 'utf8')}\n${readFileSync(SOT_SERVICE_PATH, 'utf8')}`;
    expect(/\bfeedId\b/.test(src)).toBe(false);
  });

  it('AI — no transportId requirement', () => {
    const src = `${readFileSync(SOT_CONTRACT_PATH, 'utf8')}\n${readFileSync(SOT_SERVICE_PATH, 'utf8')}`;
    expect(/\btransportId\b/.test(src)).toBe(false);
  });

  it('AJ — no raw OHLCV storage', () => {
    const migration = readFileSync(MIGRATION_PATH, 'utf8');
    expect(migration).not.toMatch(/\bopen\b|\bhigh\b|\blow\b|\bclose\b|\bvolume\b/i);
    expect(migration).not.toContain('ohlcv_');
    expect(migration).not.toContain('order_book');
    expect(migration).not.toContain('ticker_series');
    const store = createInMemoryMarketContextObservationStore();
    const result = acceptAttestedObservation(baseInput(), { store });
    const keys = Object.keys(result.record.durablePayload);
    expect(keys).not.toContain('ohlcv');
    expect(keys).not.toContain('candles');
    expect(keys).not.toContain('orderBook');
  });

  it('AK — no market-proxy/MEXC/CCXT imports', () => {
    const serviceSrc = readFileSync(SOT_SERVICE_PATH, 'utf8');
    const contractSrc = readFileSync(SOT_CONTRACT_PATH, 'utf8');
    for (const marker of getForbiddenImportMarkers()) {
      expect(serviceSrc.includes(`from '${marker}`)
        || serviceSrc.includes(`from "${marker}`)
        || serviceSrc.includes(`require('${marker}`)
        || serviceSrc.includes(`require("${marker}`)).toBe(false);
      expect(contractSrc.includes(`from '../services/${marker}`)
        || contractSrc.includes(`from '../../${marker}`)).toBe(false);
    }
    expect(serviceSrc).not.toMatch(/from ['"].*mexc/i);
    expect(serviceSrc).not.toMatch(/from ['"].*ccxt/i);
    expect(serviceSrc).not.toMatch(/from ['"].*market-proxy/i);
    expect(serviceSrc).not.toMatch(/from ['"]axios['"]/);
    expect(serviceSrc).not.toMatch(/\bfetch\s*\(/);
  });

  it('AL–AT — zero external side effects on accept', () => {
    const store = createInMemoryMarketContextObservationStore();
    const result = acceptAttestedObservation(baseInput(), { store });
    expect(result.sideEffects).toMatchObject({
      dbWriteCount: 0,
      redisWriteCount: 0,
      networkRequestCount: 0,
      providerRequestCount: 0,
      llmCallCount: 0,
      orderOperationCount: 0,
      financialExecutionCount: 0,
      runtimeMutationCount: 0,
      emergencyStopClearCount: 0,
      sotAppendCount: 1,
      sotUpdateCount: 0,
      sotDeleteCount: 0,
    });
  });

  it('ownership — SoT is source of truth; S8-MC contract remains validation-only', () => {
    expect(MARKET_CONTEXT_SOT_IS_SOURCE_OF_TRUTH).toBe(true);
    expect(MARKET_CONTEXT_SOT_SLICE_ID).toBe('S8-MC-SOT');
    expect(MC_CONTRACT_SOT_STATUS).toBe('MISSING');
    expect(NEW_SOT_OWNER_REQUIRED).toBe(true);
    const built = buildMarketContext(baseInput());
    expect(built.artifact.ownership.isSourceOfTruth).toBe(false);
  });

  it('migration — uniqueness index matches Owner lock', () => {
    const sql = readFileSync(MIGRATION_PATH, 'utf8');
    expect(sql).toContain('CREATE TABLE artemis_market_context_observations');
    expect(sql).toContain('uq_artemis_mc_obs_identity');
    expect(sql).toMatch(/venue[\s\S]*market_type[\s\S]*symbol[\s\S]*timeframe[\s\S]*source_timestamp[\s\S]*source_class/);
    expect(sql).not.toMatch(/^\s*[^-\n]*DEFAULT\s+NOW\s*\(/im);
    expect(sql).not.toMatch(/CREATE\s+TABLE\s+artemis_decisions/i);
    expect(sql).not.toMatch(/CREATE\s+TABLE\s+market_snapshots/i);
    expect(sql).not.toMatch(/CREATE\s+TABLE\s+collected_data/i);
  });

  it('helpers — uniqueness key and row id are stable', () => {
    const parts = {
      venue: 'mexc',
      marketType: MARKET_TYPE.SPOT,
      symbol: 'BTC/USDT',
      timeframe: '1h',
      sourceTimestamp: SOURCE_TS,
      sourceClass: MARKET_SOURCE_CLASS.PUBLIC_MARKET_DATA_ATTESTATION,
    };
    expect(buildObservationUniquenessKey(parts)).toBe(
      `mexc|${MARKET_TYPE.SPOT}|BTC/USDT|1h|${SOURCE_TS}|${MARKET_SOURCE_CLASS.PUBLIC_MARKET_DATA_ATTESTATION}`,
    );
    expect(buildObservationRowId(parts)).toBe(buildObservationRowId(parts));
    const payload = { a: 1, b: 'x' };
    expect(computeEnvelopeSha256(payload)).toBe(computeEnvelopeSha256({ b: 'x', a: 1 }));
  });

  it('composeObservationRecord — freezes durable record from validated artifact', () => {
    const built = buildMarketContext(baseInput());
    const record = composeObservationRecord(built.artifact);
    expect(record.contractVersion).toBe(MARKET_CONTEXT_SOT_CONTRACT_VERSION);
    expect(record.marketContextId).toBe(built.artifact.marketContextId);
    expect(() => {
      record.venue = 'mutated';
    }).toThrow();
  });

  it('regression — S8-MC / C8.1 / C1 / C3–C6 files unchanged content markers', () => {
    const mc = readFileSync(MC_CONTRACT_PATH, 'utf8');
    expect(mc).toContain("MARKET_CONTEXT_SLICE_ID = 'S8-MC-CONTRACT'");
    expect(mc).toContain('isSourceOfTruth: false');
    expect(mc).toContain(MARKET_CONTEXT_CONTRACT_VERSION);

    const c81 = readFileSync(C81_PATH, 'utf8');
    expect(c81).toContain('SHADOW_DECISION_RECORDING');

    for (const p of [C1_PATH, C3_PATH, C4_PATH, C5_PATH, C6_PATH]) {
      const body = readFileSync(p, 'utf8');
      expect(body.length).toBeGreaterThan(100);
      expect(body).not.toContain('S8-MC-SOT');
      expect(body).not.toContain('artemisMarketContextSourceOfTruth');
    }
  });

  it('F late/out-of-order with new identity accepted when freshness valid', () => {
    const store = createInMemoryMarketContextObservationStore();
    acceptAttestedObservation(baseInput(), { store });
    const late = acceptAttestedObservation(baseInput({
      identity: baseIdentity({ symbol: 'ADA/USDT', baseAsset: 'ADA' }),
      observation: baseObservation({
        sourceTimestamp: '2026-09-20T10:59:00.000Z',
        ingestionTimestamp: INGEST_TS,
        freshnessStatus: FRESHNESS_STATUS.AGED,
      }),
    }), { store });
    expect(late.ok).toBe(true);
    expect(store.getStats().rowCount).toBe(2);
  });
});
