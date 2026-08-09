/**
 * @jest-environment node
 */
import { describe, expect, it } from '@jest/globals';
import {
  containLegacyArtemisDecision,
  LEGACY_ADVISORY_CLASSIFICATION,
  NOT_EXECUTION_ELIGIBLE,
  LEGACY_ADVISORY_STAGE,
} from '../../services/artemisDecisionContainment.js';

describe('Artemis WP-A legacy decision containment', () => {
  it('marks advisory payloads as not execution-eligible', () => {
    const out = containLegacyArtemisDecision({
      action: 'BUY',
      approved: true,
      reason: 'legacy moe',
      confidence: 88,
    });

    expect(out.approved).toBe(true);
    expect(out.executionEligible).toBe(false);
    expect(out.approvedForExecution).toBe(false);
    expect(out.classification).toBe(LEGACY_ADVISORY_CLASSIFICATION);
    expect(out.executionEligibility).toBe(NOT_EXECUTION_ELIGIBLE);
    expect(out.maturityStage).toBe(LEGACY_ADVISORY_STAGE);
    expect(out.advisoryOnly).toBe(true);
    expect(out.sideEffectsSuppressed).toBe(true);
    expect(out.legacyApprovedFieldSemantics).toContain('advisory_signal_only');
  });

  it('preserves fail-closed HOLD while remaining advisory-only', () => {
    const out = containLegacyArtemisDecision(
      {
        action: 'HOLD',
        approved: false,
        reason: 'policy',
        confidence: 0,
      },
      { sideEffectsSuppressed: true },
    );

    expect(out.action).toBe('HOLD');
    expect(out.executionEligible).toBe(false);
    expect(out.approvedForExecution).toBe(false);
  });

  it('never allows approved:true to imply execution authorization', () => {
    const out = containLegacyArtemisDecision({
      action: 'SELL',
      approved: true,
      reason: 'advisory',
      confidence: 91,
      signals: 3,
    });
    expect(out.approved === true && out.executionEligible === true).toBe(false);
    expect(out.approvedForExecution).toBe(false);
  });
});
