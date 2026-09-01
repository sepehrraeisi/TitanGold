/**
 * @jest-environment node
 */
import { describe, expect, it } from '@jest/globals';
import {
  AGENT_CONTRACT_ROLE,
  AUTHORITY_CLASS,
  AVAILABILITY,
  CANONICAL_AGENT_IDS,
  CONTRACT_VERSION,
  CONTROL_AGENT_IDS,
  DATA_QUALITY_STATUS,
  EXECUTION_AGENT_IDS,
  FEASIBILITY_AGENT_IDS,
  FOUNDATION_PACKAGE_ID,
  FOUNDATION_STAGE,
  SCHEMA_VERSION,
  validateEvidenceEnvelope,
} from '../../contracts/artemisEvidenceContract.js';
import {
  normalizeAndValidateEvidenceEnvelope,
} from '../../contracts/artemisEvidenceFoundation.js';
import { applyCanonicalAgentId, listCanonicalAgentKeys } from '../../services/artemisAgentIdentity.js';
import { ARTEMIS_AGENT_CATALOG } from '../../../constants/artemisAgentCatalog.js';
import {
  fixtureControlRisk,
  fixtureEvidenceTrend,
  fixtureExecutionOrder,
  fixtureFeasibilityLiquidity,
  fixtureOpportunityPricePrediction,
} from '../fixtures/artemisStage2EvidenceFixtures.js';

function hasError(result, code, field) {
  return (result.errors || []).some((error) => (
    error.code === code && (!field || error.field === field || String(error.field).startsWith(field))
  ));
}

describe('Artemis Core Stage 2 canonical evidence foundation', () => {
  it('keeps schema/contract 1.0.0 and Stage 2 foundation metadata', () => {
    expect(SCHEMA_VERSION).toBe('1.0.0');
    expect(CONTRACT_VERSION).toBe('artemis-evidence-1.0.0');
    expect(FOUNDATION_STAGE).toBe(2);
    expect(FOUNDATION_PACKAGE_ID).toBe('canonical-evidence-foundation');
  });

  it('reuses the catalog identity owner without a parallel registry', () => {
    const catalogKeys = ARTEMIS_AGENT_CATALOG.map((row) => row.key);
    expect(listCanonicalAgentKeys()).toEqual(catalogKeys);
    expect([...CANONICAL_AGENT_IDS].sort()).toEqual([...catalogKeys].sort());
    expect(Object.keys(AGENT_CONTRACT_ROLE).sort()).toEqual([...catalogKeys].sort());
  });

  it('accepts five authority-class fixtures without production adapters', () => {
    const trend = validateEvidenceEnvelope(fixtureEvidenceTrend());
    const prediction = validateEvidenceEnvelope(fixtureOpportunityPricePrediction());
    const risk = validateEvidenceEnvelope(fixtureControlRisk());
    const liquidity = validateEvidenceEnvelope(fixtureFeasibilityLiquidity());
    const order = validateEvidenceEnvelope(fixtureExecutionOrder());
    expect(trend.ok).toBe(true);
    expect(prediction.ok).toBe(true);
    expect(risk.ok).toBe(true);
    expect(liquidity.ok).toBe(true);
    expect(order.ok).toBe(true);
    expect(fixtureEvidenceTrend().authorityClass).toBe(AUTHORITY_CLASS.ANALYTICAL_EVIDENCE);
    expect(fixtureOpportunityPricePrediction().authorityClass).toBe(AUTHORITY_CLASS.OPPORTUNITY_FORECAST);
    expect(fixtureControlRisk().authorityClass).toBe(AUTHORITY_CLASS.CONTROL_VETO);
    expect(fixtureFeasibilityLiquidity().authorityClass).toBe(AUTHORITY_CLASS.EXECUTION_FEASIBILITY);
    expect(fixtureExecutionOrder().authorityClass).toBe(AUTHORITY_CLASS.EXECUTION);
  });

  it('rejects invalid schemaVersion and contractVersion', () => {
    const schema = validateEvidenceEnvelope({ ...fixtureEvidenceTrend(), schemaVersion: '2.0.0' });
    const contract = validateEvidenceEnvelope({ ...fixtureEvidenceTrend(), contractVersion: 'artemis-evidence-9.9.9' });
    expect(schema.ok).toBe(false);
    expect(hasError(schema, 'bad_schema_version')).toBe(true);
    expect(contract.ok).toBe(false);
    expect(hasError(contract, 'bad_contract_version')).toBe(true);
  });

  it('rejects unknown Agent IDs and legacy agent-N without mapping them', () => {
    const unknown = validateEvidenceEnvelope({ ...fixtureEvidenceTrend(), agentId: 'not_an_agent' });
    const legacy = validateEvidenceEnvelope({ ...fixtureEvidenceTrend(), agentId: 'agent-1' });
    expect(unknown.ok).toBe(false);
    expect(hasError(unknown, 'unknown_agent_id')).toBe(true);
    expect(legacy.ok).toBe(false);
    expect(hasError(legacy, 'unknown_agent_id')).toBe(true);
    expect(applyCanonicalAgentId({ agentId: 'agent-1' }).agentId).toBe('agent-1');
    expect(applyCanonicalAgentId({ agentId: 'ghost' }).agentId).toBe('ghost');
  });

  it('normalizes approved aliases before validation and rejects them inside the validator', () => {
    const aliased = { ...fixtureEvidenceTrend(), agentId: 'trend_detection' };
    expect(validateEvidenceEnvelope(aliased).ok).toBe(false);
    expect(hasError(validateEvidenceEnvelope(aliased), 'unknown_agent_id')).toBe(true);
    expect(applyCanonicalAgentId(aliased).agentId).toBe('trend');
    expect(normalizeAndValidateEvidenceEnvelope(aliased).ok).toBe(true);
  });

  it('accepts Stage 2 availability tokens and requires unavailableReason', () => {
    for (const availability of [
      AVAILABILITY.NOT_RUN,
      AVAILABILITY.PROVIDER_UNAVAILABLE,
      AVAILABILITY.CONTRACT_ERROR,
    ]) {
      const result = validateEvidenceEnvelope({
        ...fixtureEvidenceTrend(),
        availability,
        unavailableReason: `fixture_${availability}`,
        conclusion: { direction: 'not_applicable' },
      });
      expect(result.ok).toBe(true);
    }
  });

  it('rejects unavailable envelopes that claim a directional success', () => {
    const result = validateEvidenceEnvelope({
      ...fixtureEvidenceTrend(),
      availability: AVAILABILITY.NOT_RUN,
      unavailableReason: 'agent_not_run',
      conclusion: { direction: 'bullish' },
    });
    expect(result.ok).toBe(false);
    expect(hasError(result, 'unavailable_must_not_claim_success')).toBe(true);
  });

  it('does not treat omitted directional conclusion as a neutral vote', () => {
    const envelope = fixtureControlRisk();
    delete envelope.conclusion;
    const result = validateEvidenceEnvelope(envelope);
    expect(result.ok).toBe(true);
    expect(envelope.conclusion).toBeUndefined();
  });

  it('validates freshness stale vs expired policy', () => {
    const stale = validateEvidenceEnvelope({
      ...fixtureEvidenceTrend(),
      freshness: { status: 'stale', reasonKey: 'source_stale' },
    });
    expect(stale.ok).toBe(true);

    const expiredSchemaValid = validateEvidenceEnvelope({
      ...fixtureEvidenceTrend(),
      freshness: { status: 'expired', reasonKey: 'source_expired' },
      expiryTimestamp: '2026-08-10T11:59:00.000Z',
    });
    expect(expiredSchemaValid.ok).toBe(true);

    const expiredRejected = validateEvidenceEnvelope({
      ...fixtureEvidenceTrend(),
      freshness: { status: 'expired', reasonKey: 'source_expired' },
      expiryTimestamp: '2026-08-10T11:59:00.000Z',
    }, { rejectExpired: true, nowMs: Date.parse('2026-08-10T12:10:00.000Z') });
    expect(expiredRejected.ok).toBe(false);
    expect(hasError(expiredRejected, 'expired_evidence_rejected')).toBe(true);
  });

  it('rejects malformed and impossible timestamps', () => {
    const malformed = validateEvidenceEnvelope({
      ...fixtureEvidenceTrend(),
      analysisTimestamp: 'not-a-timestamp',
    });
    expect(malformed.ok).toBe(false);
    expect(hasError(malformed, 'invalid_timestamp', 'analysisTimestamp')).toBe(true);

    const impossible = validateEvidenceEnvelope({
      ...fixtureEvidenceTrend(),
      sourceTimestamp: '2026-08-10T13:00:00.000Z',
      analysisTimestamp: '2026-08-10T12:00:00.000Z',
    });
    expect(impossible.ok).toBe(false);
    expect(hasError(impossible, 'impossible_timestamp_order', 'sourceTimestamp')).toBe(true);
  });

  it('requires provenance/method for available confidence and rejects fake zeros', () => {
    const missingMethod = validateEvidenceEnvelope({
      ...fixtureEvidenceTrend(),
      confidence: {
        availability: 'available',
        value: 0.5,
        scale: 'unit_interval',
        kind: 'HEURISTIC',
        calibrationState: 'uncalibrated',
        sampleWindow: { availability: 'unavailable' },
      },
    });
    expect(missingMethod.ok).toBe(false);
    expect(hasError(missingMethod, 'confidence_method_required')).toBe(true);

    const fakeZero = validateEvidenceEnvelope({
      ...fixtureEvidenceTrend(),
      confidence: {
        availability: 'unavailable',
        value: 0,
        kind: 'UNAVAILABLE',
        scale: 'unknown',
        calibrationState: 'unavailable',
        sampleWindow: { availability: 'unavailable' },
      },
    });
    expect(fakeZero.ok).toBe(false);
    expect(hasError(fakeZero, 'unavailable_must_not_include_measured_fields')).toBe(true);
  });

  it('rejects predictive confidence on control/execution roles', () => {
    const result = validateEvidenceEnvelope({
      ...fixtureControlRisk(),
      confidence: {
        availability: 'available',
        value: 0.9,
        scale: 'unit_interval',
        kind: 'MODEL_PROBABILITY',
        calibrationState: 'uncalibrated',
        sampleWindow: { availability: 'unavailable' },
        provenance: { writer: 'test', methodKey: 'should_not_apply' },
      },
    });
    expect(result.ok).toBe(false);
    expect(hasError(result, 'confidence_kind_role_mismatch')).toBe(true);
  });

  it('preserves correlationFamily on envelope and evidence items', () => {
    const envelope = fixtureEvidenceTrend();
    expect(envelope.correlationFamily).toBe('ohlcv_candle_family');
    expect(envelope.evidence.items[0].correlationFamily).toBe('ohlcv_candle_family');
    const bad = validateEvidenceEnvelope({
      ...envelope,
      correlationFamily: 'made_up_family',
    });
    expect(bad.ok).toBe(false);
    expect(hasError(bad, 'invalid_correlation_family')).toBe(true);
  });

  it('validates evidence items and rejects unknown item fields', () => {
    const valid = validateEvidenceEnvelope(fixtureEvidenceTrend());
    expect(valid.ok).toBe(true);

    const malformed = validateEvidenceEnvelope({
      ...fixtureEvidenceTrend(),
      evidence: {
        items: [{
          evidenceId: 'x',
          evidenceType: 'not-a-type',
          canonicalSource: 'trend.adx.value',
          directionalContribution: 'supports',
        }],
      },
    });
    expect(malformed.ok).toBe(false);
    expect(hasError(malformed, 'invalid_evidence_type')).toBe(true);

    const unknownItemField = validateEvidenceEnvelope({
      ...fixtureEvidenceTrend(),
      evidence: {
        items: [{
          evidenceId: 'x',
          evidenceType: 'indicator',
          canonicalSource: 'trend.adx.value',
          directionalContribution: 'supports',
          rawReasonCode: 'INTERNAL_X',
        }],
      },
    });
    expect(unknownItemField.ok).toBe(false);
    expect(hasError(unknownItemField, 'unknown_field')).toBe(true);
  });

  it('prevents risk/control and execution roles from masquerading as directional evidence', () => {
    expect(CONTROL_AGENT_IDS).toEqual(['risk', 'portfolio', 'optimization']);
    expect(FEASIBILITY_AGENT_IDS).toEqual(['liquidity']);
    expect(EXECUTION_AGENT_IDS).toEqual(['order']);

    const riskVote = validateEvidenceEnvelope({
      ...fixtureControlRisk(),
      conclusion: { direction: 'bullish', signal: 'BUY' },
    });
    expect(riskVote.ok).toBe(false);
    expect(hasError(riskVote, 'role_analytical_vote_forbidden')).toBe(true);

    const orderVote = validateEvidenceEnvelope({
      ...fixtureExecutionOrder(),
      conclusion: { direction: 'bearish', signal: 'SELL' },
    });
    expect(orderVote.ok).toBe(false);
    expect(hasError(orderVote, 'role_analytical_vote_forbidden')).toBe(true);
  });

  it('rejects unknown top-level fields and omitted-field remains valid', () => {
    const unknown = validateEvidenceEnvelope({ ...fixtureEvidenceTrend(), extraVoteWeight: 1 });
    expect(unknown.ok).toBe(false);
    expect(unknown.code).toBe('unknown_field');

    const omitted = fixtureEvidenceTrend();
    delete omitted.baseAsset;
    delete omitted.quoteAsset;
    delete omitted.ownershipScope;
    expect(validateEvidenceEnvelope(omitted).ok).toBe(true);
  });

  it('accepts additive data-quality invalid/unknown without renaming ok', () => {
    expect(DATA_QUALITY_STATUS.OK).toBe('ok');
    const invalid = validateEvidenceEnvelope({
      ...fixtureEvidenceTrend(),
      dataQuality: { ...fixtureEvidenceTrend().dataQuality, status: 'invalid' },
    });
    const unknown = validateEvidenceEnvelope({
      ...fixtureEvidenceTrend(),
      dataQuality: { ...fixtureEvidenceTrend().dataQuality, status: 'unknown' },
    });
    expect(invalid.ok).toBe(true);
    expect(unknown.ok).toBe(true);
  });
});
