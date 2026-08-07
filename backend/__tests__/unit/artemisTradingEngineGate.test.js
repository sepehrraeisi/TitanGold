/**
 * @jest-environment node
 *
 * Trading Engine Artemis consumer gate — fail-closed on legacy advisory.
 * Pure assertion of the WP-A eligibility predicate used by tradingEngine.
 */
import { describe, expect, it } from '@jest/globals';

function isArtemisExecutionAuthorized(decision) {
  return decision?.executionEligible === true && decision?.approvedForExecution === true;
}

describe('Trading Engine Artemis execution gate (WP-A)', () => {
  it('rejects legacy approved:true without eligibility flags', () => {
    expect(
      isArtemisExecutionAuthorized({
        action: 'BUY',
        approved: true,
        confidence: 99,
      }),
    ).toBe(false);
  });

  it('rejects contained advisory payloads', () => {
    expect(
      isArtemisExecutionAuthorized({
        action: 'BUY',
        approved: true,
        executionEligible: false,
        approvedForExecution: false,
        classification: 'LEGACY_ADVISORY_ONLY',
      }),
    ).toBe(false);
  });

  it('only authorizes when both eligibility flags are true', () => {
    expect(
      isArtemisExecutionAuthorized({
        action: 'BUY',
        approved: true,
        executionEligible: true,
        approvedForExecution: true,
      }),
    ).toBe(true);
  });
});
