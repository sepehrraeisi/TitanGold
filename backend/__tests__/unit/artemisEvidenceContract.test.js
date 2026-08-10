/**
 * @jest-environment node
 */
import { describe, expect, it } from '@jest/globals';
import {
  ADAPTER_VERSIONS,
  AGENT_CONTRACT_ROLE,
  AUTHORITY_CLASS,
  CANONICAL_AGENT_IDS,
  CONTRACT_VERSION,
  MAX_ENVELOPE_UTF8_BYTES,
  SCHEMA_VERSION,
  validateEvidenceEnvelope,
} from '../../contracts/artemisEvidenceContract.js';
import { mapTrendPersistedRun } from '../../services/artemisEvidenceAdapters/trendAdapter.js';
import { mapArbitragePersistedRun } from '../../services/artemisEvidenceAdapters/arbitrageAdapter.js';
import { mapVolumePersistedRun } from '../../services/artemisEvidenceAdapters/volumeAdapter.js';

const NOW = Date.parse('2026-08-10T12:10:00.000Z');

function baseEnvelope(overrides = {}) {
  return {
    schemaVersion: SCHEMA_VERSION,
    contractVersion: CONTRACT_VERSION,
    adapterVersion: ADAPTER_VERSIONS.trend,
    agentId: 'trend',
    agentRole: AUTHORITY_CLASS.ANALYTICAL_EVIDENCE,
    authorityClass: AUTHORITY_CLASS.ANALYTICAL_EVIDENCE,
    runId: 'run-1',
    analysisTimestamp: '2026-08-10T12:00:00.000Z',
    availability: 'available',
    unavailableReason: null,
    lifecycleStatus: 'completed',
    limitations: ['advisory_only'],
    executionClass: 'advisory_only',
    freshness: { status: 'unknown', reasonKey: 'missing_proven_source_timestamp' },
    dataQuality: { status: 'degraded' },
    provenance: { writer: 'test' },
    confidence: { availability: 'unavailable', kind: 'UNAVAILABLE', scale: 'unknown' },
    conclusion: {
      direction: 'bullish',
      strength: { value: 72, scale: 'percent_100', provenance: 'trend.raw.trend.confidence' },
    },
    evidence: {
      items: [
        {
          evidenceId: 'trend-adx',
          evidenceType: 'indicator',
          canonicalSource: 'trend.adx.value',
          value: 31.2,
          directionalContribution: 'neutral',
        },
      ],
    },
    ...overrides,
  };
}

function hasError(result, code, field) {
  return (result.errors || []).some((error) => error.code === code && (!field || error.field === field || String(error.field).startsWith(field)));
}

describe('Artemis WP-B.1 evidence contract', () => {
  it('accepts a strict 1.0.0 envelope', () => {
    const result = validateEvidenceEnvelope(baseEnvelope());
    expect(result.ok).toBe(true);
    expect(result.bytes).toBeGreaterThan(0);
    expect(result.bytes).toBeLessThanOrEqual(MAX_ENVELOPE_UTF8_BYTES);
  });

  it('accepts all 15 canonical agentIds with matching authority', () => {
    expect(CANONICAL_AGENT_IDS).toHaveLength(15);
    for (const agentId of CANONICAL_AGENT_IDS) {
      const role = AGENT_CONTRACT_ROLE[agentId];
      const result = validateEvidenceEnvelope(baseEnvelope({
        agentId,
        agentRole: role.agentRole,
        authorityClass: role.authorityClass,
        adapterVersion: '1.0.0',
      }));
      expect(result.ok).toBe(true);
    }
  });

  it('accepts canonical Trend agentId=trend', () => {
    expect(validateEvidenceEnvelope(baseEnvelope({ agentId: 'trend' })).ok).toBe(true);
  });

  it('accepts explicit valid confidence exactly 0.5', () => {
    const result = validateEvidenceEnvelope(baseEnvelope({
      agentId: 'arbitrage',
      agentRole: AUTHORITY_CLASS.OPPORTUNITY_FORECAST,
      authorityClass: AUTHORITY_CLASS.OPPORTUNITY_FORECAST,
      adapterVersion: ADAPTER_VERSIONS.arbitrage,
      confidence: {
        availability: 'available',
        value: 0.5,
        scale: 'unit_interval',
        kind: 'HEURISTIC',
        calibrationState: 'uncalibrated',
        sampleWindow: { availability: 'unavailable' },
        provenance: { writer: 'agent_output', path: 'confidence', methodKey: 'explicit_agent_confidence' },
      },
      conclusion: { direction: 'not_applicable', signal: 'observe' },
    }));
    expect(result.ok).toBe(true);
  });

  it('accepts canonical Trend/Arbitrage/Volume adapter envelopes', () => {
    const trend = mapTrendPersistedRun({
      nowMs: NOW,
      row: { id: 'trend-run-1', agent_id: 'uuid-trend', created_at: '2026-08-10T12:00:00.000Z' },
      output: {
        symbol: 'BTC/USDT',
        timeframe: '1h',
        timestamp: '2026-08-10T12:00:00.000Z',
        last_candle_timestamp: '2026-08-10T11:00:00.000Z',
        trend: { direction: 'bullish', confidence: 72 },
        adx: { value: 31.4, di_plus: 28, di_minus: 12 },
      },
    });
    expect(validateEvidenceEnvelope(trend.envelope).ok).toBe(true);

    const arb = mapArbitragePersistedRun({
      nowMs: NOW,
      row: { id: 'arb-1', created_at: '2026-08-10T12:00:00.000Z', confidence: 0.5 },
      output: {
        timestamp: '2026-08-10T12:00:00.000Z',
        confidence: 0.5,
        candidates: [{ symbol: 'BTC/USDT', spreadPct: 0.8 }],
        summary: { spreadCandidates: 1 },
      },
    });
    expect(validateEvidenceEnvelope(arb.envelope).ok).toBe(true);

    const volume = mapVolumePersistedRun({
      nowMs: NOW,
      row: { id: 'vol-1', created_at: '2026-08-10T12:00:00.000Z', confidence: 0.5 },
      output: {
        symbol: 'BTC/USDT',
        timeframe: '1h',
        timestamp: '2026-08-10T12:00:00.000Z',
        last_candle_timestamp: '2026-08-10T11:00:00.000Z',
        obv: { current: 12 },
        vwap: { current: 101 },
        trading_recommendation: { action: 'BUY', confidence: 68 },
        metadata: { dataPoints: 48 },
      },
    });
    expect(validateEvidenceEnvelope(volume.envelope).ok).toBe(true);
  });

  it('rejects unknown agentId even with plausible authority', () => {
    const result = validateEvidenceEnvelope(baseEnvelope({
      agentId: 'some_fake_agent',
      agentRole: AUTHORITY_CLASS.ANALYTICAL_EVIDENCE,
      authorityClass: AUTHORITY_CLASS.ANALYTICAL_EVIDENCE,
    }));
    expect(result.ok).toBe(false);
    expect(hasError(result, 'unknown_agent_id', 'agentId')).toBe(true);
  });

  it('rejects legacy agent-N and raw alias agentId', () => {
    const legacy = validateEvidenceEnvelope(baseEnvelope({ agentId: 'agent-1' }));
    expect(legacy.ok).toBe(false);
    expect(hasError(legacy, 'unknown_agent_id', 'agentId')).toBe(true);

    const alias = validateEvidenceEnvelope(baseEnvelope({ agentId: 'trend_detection' }));
    expect(alias.ok).toBe(false);
    expect(hasError(alias, 'unknown_agent_id', 'agentId')).toBe(true);
  });

  it('rejects unknown top-level fields', () => {
    const result = validateEvidenceEnvelope(baseEnvelope({ fakeField: true }));
    expect(result.ok).toBe(false);
    expect(result.code).toBe('unknown_field');
    expect(result.fields).toContain('fakeField');
  });

  it('rejects unknown nested conclusion, confidence, freshness, dataQuality, provenance and EvidenceItem fields', () => {
    const conclusion = validateEvidenceEnvelope(baseEnvelope({
      conclusion: { direction: 'bullish', unexpectedConclusionFlag: true },
    }));
    expect(conclusion.ok).toBe(false);
    expect(hasError(conclusion, 'unknown_field', 'conclusion')).toBe(true);

    const confidence = validateEvidenceEnvelope(baseEnvelope({
      confidence: { availability: 'unavailable', kind: 'UNAVAILABLE', unexpectedInternalState: { x: 1 } },
    }));
    expect(confidence.ok).toBe(false);
    expect(hasError(confidence, 'unknown_field', 'confidence')).toBe(true);

    const freshness = validateEvidenceEnvelope(baseEnvelope({
      freshness: { status: 'unknown', unexpectedInternalState: { leaked: true } },
    }));
    expect(freshness.ok).toBe(false);
    expect(hasError(freshness, 'unknown_field', 'freshness')).toBe(true);

    const dq = validateEvidenceEnvelope(baseEnvelope({
      dataQuality: { status: 'ok', randomPayload: 'nope' },
    }));
    expect(dq.ok).toBe(false);
    expect(hasError(dq, 'unknown_field', 'dataQuality')).toBe(true);

    const provenance = validateEvidenceEnvelope(baseEnvelope({
      provenance: { writer: 'trend-adapter', arbitraryRawProviderPayload: { candles: [] } },
    }));
    expect(provenance.ok).toBe(false);
    expect(hasError(provenance, 'unknown_field', 'provenance')).toBe(true);

    const item = validateEvidenceEnvelope(baseEnvelope({
      evidence: {
        items: [{
          evidenceId: 'trend-adx',
          evidenceType: 'indicator',
          canonicalSource: 'trend.adx.value',
          value: 31.2,
          directionalContribution: 'neutral',
          internalBlob: { raw: true },
        }],
      },
    }));
    expect(item.ok).toBe(false);
    expect(hasError(item, 'unknown_field', 'evidence.items[0]')).toBe(true);
  });

  it('rejects nested evidence value objects and >32 evidence items', () => {
    const nested = validateEvidenceEnvelope(baseEnvelope({
      evidence: {
        items: [{
          evidenceId: 'bad',
          evidenceType: 'metric',
          canonicalSource: 'x',
          value: { nested: true },
          directionalContribution: 'neutral',
        }],
      },
    }));
    expect(nested.ok).toBe(false);
    expect(hasError(nested, 'nested_evidence_value_forbidden')).toBe(true);

    const many = validateEvidenceEnvelope(baseEnvelope({
      evidence: {
        items: Array.from({ length: 33 }, (_, i) => ({
          evidenceId: `e-${i}`,
          evidenceType: 'metric',
          canonicalSource: 'x',
          value: i,
          directionalContribution: 'neutral',
        })),
      },
    }));
    expect(many.ok).toBe(false);
    expect(hasError(many, 'evidence_item_limit')).toBe(true);
  });

  it('rejects schema/contract version mismatch', () => {
    const schema = validateEvidenceEnvelope(baseEnvelope({ schemaVersion: '2.0.0' }));
    expect(schema.ok).toBe(false);
    expect(hasError(schema, 'bad_schema_version')).toBe(true);

    const contract = validateEvidenceEnvelope(baseEnvelope({ contractVersion: 'artemis-evidence-9.9.9' }));
    expect(contract.ok).toBe(false);
    expect(hasError(contract, 'bad_contract_version')).toBe(true);
  });

  it('rejects authority mismatch and forbidden execution semantics', () => {
    const mismatch = validateEvidenceEnvelope(baseEnvelope({
      agentId: 'trend',
      agentRole: AUTHORITY_CLASS.EXECUTION,
      authorityClass: AUTHORITY_CLASS.EXECUTION,
    }));
    expect(mismatch.ok).toBe(false);
    expect(hasError(mismatch, 'authority_mismatch')).toBe(true);

    const executable = validateEvidenceEnvelope(baseEnvelope({ executionClass: 'executable' }));
    expect(executable.ok).toBe(false);
    expect(hasError(executable, 'forbidden_execution_semantics') || hasError(executable, 'invalid_execution_class')).toBe(true);
  });

  it('rejects secret keys, raw payload keys and oversized envelopes', () => {
    const secret = validateEvidenceEnvelope(baseEnvelope({
      provenance: { writer: 'test', api_key: 'should-not-exist' },
    }));
    expect(secret.ok).toBe(false);
    expect(hasError(secret, 'forbidden_secret_keys') || hasError(secret, 'unknown_field', 'provenance')).toBe(true);

    const raw = validateEvidenceEnvelope(baseEnvelope({
      evidence: {
        items: [{
          evidenceId: 'x',
          evidenceType: 'metric',
          canonicalSource: 'x',
          value: 1,
          directionalContribution: 'neutral',
          output_data: { leaked: true },
        }],
      },
    }));
    expect(raw.ok).toBe(false);

    const huge = validateEvidenceEnvelope(baseEnvelope({
      limitations: ['advisory_only', 'x'.repeat(9000)],
    }));
    expect(huge.ok).toBe(false);
    expect(hasError(huge, 'envelope_too_large')).toBe(true);
  });

  it('keeps Optimization not_applicable and adapter versions separate from contractVersion', () => {
    expect(AGENT_CONTRACT_ROLE.optimization.authorityClass).toBe(AUTHORITY_CLASS.NOT_APPLICABLE);
    expect(ADAPTER_VERSIONS.trend).toBe('1.0.0');
    expect(CONTRACT_VERSION).toBe('artemis-evidence-1.0.0');
    expect(SCHEMA_VERSION).toBe('1.0.0');
  });
});
