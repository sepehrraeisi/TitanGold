/**
 * @jest-environment node
 */
import { describe, expect, it } from '@jest/globals';
import {
  ADAPTER_VERSIONS,
  AGENT_CONTRACT_ROLE,
  AUTHORITY_CLASS,
  CONTRACT_VERSION,
  MAX_ENVELOPE_UTF8_BYTES,
  SCHEMA_VERSION,
  validateEvidenceEnvelope,
} from '../../contracts/artemisEvidenceContract.js';

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

describe('Artemis WP-B.1 evidence contract', () => {
  it('accepts a strict 1.0.0 envelope', () => {
    const result = validateEvidenceEnvelope(baseEnvelope());
    expect(result.ok).toBe(true);
    expect(result.bytes).toBeGreaterThan(0);
    expect(result.bytes).toBeLessThanOrEqual(MAX_ENVELOPE_UTF8_BYTES);
  });

  it('rejects unknown top-level fields', () => {
    const result = validateEvidenceEnvelope(baseEnvelope({ fakeField: true }));
    expect(result.ok).toBe(false);
    expect(result.code).toBe('unknown_field');
    expect(result.fields).toContain('fakeField');
  });

  it('rejects schema/contract version mismatch', () => {
    const schema = validateEvidenceEnvelope(baseEnvelope({ schemaVersion: '2.0.0' }));
    expect(schema.ok).toBe(false);
    expect(schema.errors.some((e) => e.code === 'bad_schema_version')).toBe(true);

    const contract = validateEvidenceEnvelope(baseEnvelope({ contractVersion: 'artemis-evidence-9.9.9' }));
    expect(contract.ok).toBe(false);
    expect(contract.errors.some((e) => e.code === 'bad_contract_version')).toBe(true);
  });

  it('rejects authority mismatch and forbidden execution semantics', () => {
    const mismatch = validateEvidenceEnvelope(baseEnvelope({
      agentId: 'trend',
      agentRole: AUTHORITY_CLASS.EXECUTION,
      authorityClass: AUTHORITY_CLASS.EXECUTION,
    }));
    expect(mismatch.ok).toBe(false);
    expect(mismatch.errors.some((e) => e.code === 'authority_mismatch')).toBe(true);

    const executable = validateEvidenceEnvelope(baseEnvelope({ executionClass: 'executable' }));
    expect(executable.ok).toBe(false);
    expect(executable.errors.some((e) => e.code === 'forbidden_execution_semantics' || e.code === 'invalid_execution_class')).toBe(true);
  });

  it('rejects secret keys and oversized envelopes', () => {
    const secret = validateEvidenceEnvelope(baseEnvelope({
      provenance: { writer: 'test', api_key: 'should-not-exist' },
    }));
    expect(secret.ok).toBe(false);
    expect(secret.errors.some((e) => e.code === 'forbidden_secret_keys')).toBe(true);

    const huge = validateEvidenceEnvelope(baseEnvelope({
      limitations: ['advisory_only', 'x'.repeat(9000)],
    }));
    expect(huge.ok).toBe(false);
    expect(huge.errors.some((e) => e.code === 'envelope_too_large')).toBe(true);
  });

  it('keeps Optimization not_applicable and adapter versions separate from contractVersion', () => {
    expect(AGENT_CONTRACT_ROLE.optimization.authorityClass).toBe(AUTHORITY_CLASS.NOT_APPLICABLE);
    expect(ADAPTER_VERSIONS.trend).toBe('1.0.0');
    expect(CONTRACT_VERSION).toBe('artemis-evidence-1.0.0');
    expect(SCHEMA_VERSION).toBe('1.0.0');
  });
});
