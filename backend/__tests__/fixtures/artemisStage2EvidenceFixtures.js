/**
 * Stage 2 test-only fixtures. Not production adapters. Not Stage 3 rollout.
 */
import {
  AGENT_CONTRACT_ROLE,
  AUTHORITY_CLASS,
  CONTRACT_VERSION,
  CORRELATION_FAMILY,
  SCHEMA_VERSION,
} from '../../contracts/artemisEvidenceContract.js';

const ANALYSIS_TS = '2026-08-10T12:00:00.000Z';
const SOURCE_TS = '2026-08-10T11:00:00.000Z';

const UNAVAILABLE_CONFIDENCE = Object.freeze({
  availability: 'unavailable',
  kind: 'UNAVAILABLE',
  scale: 'unknown',
  calibrationState: 'unavailable',
  sampleWindow: { availability: 'unavailable' },
  reasonKey: 'stage2_fixture_no_defensible_confidence',
});

const BASE_QUALITY = Object.freeze({
  status: 'ok',
  sourceAvailability: 'available',
  coverage: 'unavailable',
  completeness: 'unavailable',
  staleness: 'unknown',
  providerDegradation: 'unavailable',
  sampleAdequacy: 'unavailable',
});

function roleFields(agentId) {
  return AGENT_CONTRACT_ROLE[agentId];
}

function baseEnvelope(agentId, extra = {}) {
  const role = roleFields(agentId);
  return {
    schemaVersion: SCHEMA_VERSION,
    contractVersion: CONTRACT_VERSION,
    adapterVersion: '1.0.0',
    agentId,
    agentRole: role.agentRole,
    authorityClass: role.authorityClass,
    analysisTimestamp: ANALYSIS_TS,
    sourceTimestamp: SOURCE_TS,
    sourceCandleTimestamp: SOURCE_TS,
    createdAt: ANALYSIS_TS,
    completedAt: ANALYSIS_TS,
    availability: extra.availability || 'available',
    unavailableReason: extra.unavailableReason ?? null,
    lifecycleStatus: extra.lifecycleStatus || 'completed',
    limitations: extra.limitations || ['advisory_only', 'stage2_fixture'],
    executionClass: extra.executionClass || 'advisory_only',
    freshness: extra.freshness || { status: 'fresh', reasonKey: 'source_fresh', sourceTimestamp: SOURCE_TS },
    dataQuality: extra.dataQuality || { ...BASE_QUALITY },
    provenance: extra.provenance || { writer: 'stage2-fixture', source: 'test', methodKey: 'stage2_fixture' },
    confidence: extra.confidence || { ...UNAVAILABLE_CONFIDENCE },
    correlationFamily: extra.correlationFamily,
    conclusion: extra.conclusion,
    evidence: extra.evidence,
    opportunity: extra.opportunity,
    control: extra.control,
    allocation: extra.allocation,
    feasibility: extra.feasibility,
    invalidatingConditions: extra.invalidatingConditions,
    riskFlags: extra.riskFlags,
    ownershipScope: extra.ownershipScope,
    marketType: extra.marketType || 'spot',
    symbol: extra.symbol || 'BTC/USDT',
    baseAsset: extra.baseAsset || 'BTC',
    quoteAsset: extra.quoteAsset || 'USDT',
    timeframe: extra.timeframe || '1h',
    analysisHorizon: extra.analysisHorizon,
    expiryTimestamp: extra.expiryTimestamp,
    recommendedNextActionClass: extra.recommendedNextActionClass || 'observe',
    ...omitKnown(extra),
  };
}

function omitKnown(extra) {
  const copy = { ...extra };
  for (const key of [
    'availability', 'unavailableReason', 'lifecycleStatus', 'limitations', 'executionClass',
    'freshness', 'dataQuality', 'provenance', 'confidence', 'correlationFamily', 'conclusion',
    'evidence', 'opportunity', 'control', 'allocation', 'feasibility', 'invalidatingConditions',
    'riskFlags', 'ownershipScope', 'marketType', 'symbol', 'baseAsset', 'quoteAsset', 'timeframe',
    'analysisHorizon', 'expiryTimestamp', 'recommendedNextActionClass',
  ]) {
    delete copy[key];
  }
  return copy;
}

export function fixtureEvidenceTrend() {
  return baseEnvelope('trend', {
    correlationFamily: CORRELATION_FAMILY.OHLCV_CANDLE,
    conclusion: {
      direction: 'bullish',
      regime: 'trending',
      strength: { value: 72, scale: 'percent_100', provenance: 'fixture.trend.strength' },
    },
    evidence: {
      items: [{
        evidenceId: 'trend-adx',
        evidenceType: 'indicator',
        canonicalSource: 'trend.adx.value',
        value: 31.2,
        unit: 'adx',
        directionalContribution: 'supports',
        interpretation: 'adx_above_threshold',
        freshness: { status: 'fresh', reasonKey: 'source_fresh' },
        provenance: { writer: 'stage2-fixture', source: 'test' },
        quality: 'ok',
        limitation: 'strength_is_not_confidence',
        correlationFamily: CORRELATION_FAMILY.OHLCV_CANDLE,
        explanationKey: 'trend_adx_support',
        severity: 'medium',
      }],
    },
  });
}

export function fixtureOpportunityPricePrediction() {
  return baseEnvelope('price_prediction', {
    correlationFamily: CORRELATION_FAMILY.OHLCV_CANDLE,
    analysisHorizon: '4h',
    conclusion: { direction: 'bullish', signal: 'observe' },
    opportunity: {
      kind: 'forecast',
      availability: 'available',
      horizon: '4h',
      invalidatingConditionKeys: ['regime_break'],
    },
    invalidatingConditions: ['regime_break'],
    confidence: {
      availability: 'available',
      value: 0.61,
      scale: 'unit_interval',
      kind: 'HEURISTIC',
      calibrationState: 'uncalibrated',
      sampleWindow: { availability: 'unavailable' },
      provenance: { writer: 'stage2-fixture', path: 'fixture.probability', methodKey: 'heuristic_not_calibrated' },
    },
  });
}

export function fixtureControlRisk() {
  return baseEnvelope('risk', {
    correlationFamily: CORRELATION_FAMILY.ACCOUNT_STATE,
    conclusion: { direction: 'not_applicable' },
    control: {
      kind: 'veto',
      availability: 'available',
      outcome: 'reject',
      reasonKey: 'fixture_risk_veto',
    },
    riskFlags: ['drawdown_limit'],
    recommendedNextActionClass: 'none',
  });
}

export function fixtureFeasibilityLiquidity() {
  return baseEnvelope('liquidity', {
    correlationFamily: CORRELATION_FAMILY.MICROSTRUCTURE,
    conclusion: { direction: 'not_applicable' },
    feasibility: {
      availability: 'available',
      spread: 0.12,
      depth: 15000,
      slippage: 0.04,
      maxFeasibleSize: 2.5,
      bookTimestamp: SOURCE_TS,
      expiryTimestamp: '2026-08-10T12:01:00.000Z',
    },
    recommendedNextActionClass: 'observe',
  });
}

export function fixtureExecutionOrder() {
  return baseEnvelope('order', {
    correlationFamily: CORRELATION_FAMILY.EXECUTION_PATH,
    executionClass: 'none',
    conclusion: { direction: 'not_applicable' },
    recommendedNextActionClass: 'not_applicable',
    limitations: ['advisory_only', 'not_execution_eligible', 'stage2_fixture'],
  });
}

export const STAGE2_AUTHORITY_FIXTURES = Object.freeze({
  evidence: fixtureEvidenceTrend,
  opportunity: fixtureOpportunityPricePrediction,
  control: fixtureControlRisk,
  feasibility: fixtureFeasibilityLiquidity,
  execution: fixtureExecutionOrder,
});

export { AUTHORITY_CLASS };
