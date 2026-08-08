/**
 * @jest-environment node
 *
 * Trading Engine Artemis consumer gate — tests the REAL production predicate.
 * No provider I/O. No orders. Does not enable Live execution.
 */
import { describe, expect, it } from '@jest/globals';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isArtemisDecisionExecutionAuthorized } from '../../services/artemisExecutionGate.js';

const engineSource = fs.readFileSync(
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../engine/tradingEngine.js'),
  'utf8',
);

describe('Trading Engine Artemis execution gate (production predicate)', () => {
  it('tradingEngine.js uses the shared production helper', () => {
    expect(engineSource).toMatch(
      /import \{ isArtemisDecisionExecutionAuthorized \} from '\.\.\/services\/artemisExecutionGate\.js'/,
    );
    expect(engineSource).toMatch(/approved:\s*isArtemisDecisionExecutionAuthorized\(decision\)/);
  });

  it('rejects approved:true without eligibility flags', () => {
    expect(
      isArtemisDecisionExecutionAuthorized({
        action: 'BUY',
        approved: true,
        confidence: 99,
      }),
    ).toBe(false);
  });

  it('rejects approved:true when executionEligible and approvedForExecution are false', () => {
    expect(
      isArtemisDecisionExecutionAuthorized({
        action: 'BUY',
        approved: true,
        executionEligible: false,
        approvedForExecution: false,
        classification: 'LEGACY_ADVISORY_ONLY',
      }),
    ).toBe(false);
  });

  it('rejects eligibility flags true with HOLD or invalid action', () => {
    expect(
      isArtemisDecisionExecutionAuthorized({
        action: 'HOLD',
        executionEligible: true,
        approvedForExecution: true,
      }),
    ).toBe(false);
    expect(
      isArtemisDecisionExecutionAuthorized({
        action: 'WAIT',
        executionEligible: true,
        approvedForExecution: true,
      }),
    ).toBe(false);
  });

  it('permits BUY/SELL/EXECUTE only when both eligibility flags are true', () => {
    expect(
      isArtemisDecisionExecutionAuthorized({
        action: 'BUY',
        executionEligible: true,
        approvedForExecution: true,
      }),
    ).toBe(true);
    expect(
      isArtemisDecisionExecutionAuthorized({
        action: 'SELL',
        executionEligible: true,
        approvedForExecution: true,
      }),
    ).toBe(true);
    expect(
      isArtemisDecisionExecutionAuthorized({
        action: 'EXECUTE',
        executionEligible: true,
        approvedForExecution: true,
      }),
    ).toBe(true);
  });
});
