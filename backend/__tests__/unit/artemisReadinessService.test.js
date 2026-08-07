/**
 * @jest-environment node
 */
import { describe, expect, it, jest, beforeEach } from '@jest/globals';

const mockGetRuntimeExecutionState = jest.fn();
const mockBuildRuntimeView = jest.fn();
const mockQuery = jest.fn();

jest.unstable_mockModule('../../services/runtimeExecutionStateService.js', () => ({
  getRuntimeExecutionState: mockGetRuntimeExecutionState,
  buildRuntimeView: mockBuildRuntimeView,
}));

jest.unstable_mockModule('../../database/db.js', () => ({
  query: mockQuery,
}));

jest.unstable_mockModule('../../services/logger.js', () => ({
  logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn() },
}));

const { buildArtemisReadiness } = await import('../../services/artemisReadinessService.js');

describe('Artemis WP-A readiness aggregation', () => {
  beforeEach(() => {
    mockGetRuntimeExecutionState.mockReset();
    mockBuildRuntimeView.mockReset();
    mockQuery.mockReset();
  });

  it('returns LEGACY_ADVISORY readiness with executionEligible false', async () => {
    mockGetRuntimeExecutionState.mockResolvedValue({ killSwitchActive: false });
    mockBuildRuntimeView.mockReturnValue({
      requestedMode: 'demo',
      effectiveMode: 'demo',
      killSwitchActive: false,
    });
    mockQuery.mockResolvedValue({ rows: [{ mode: 'demo' }] });

    const readiness = await buildArtemisReadiness({ userId: 'u1' });

    expect(readiness.executionEligible).toBe(false);
    expect(readiness.maturityStage).toBe('LEGACY_ADVISORY');
    expect(readiness.contract.implemented).toBe(false);
    expect(readiness.evidence.readiness).toBe('UNAVAILABLE');
    expect(readiness.orchestration.realAgentCoordination).toBe(false);
    expect(readiness.controlChain.liquidity.readiness).toBe('BLOCKED');
    expect(readiness.controlChain.order.authority).toBe('execution_only');
    expect(readiness.limitations.length).toBeGreaterThan(0);
    expect(readiness.runtimeTruth).toBe('MEASURED');
  });

  it('survives runtime SSOT failure without fabricating readiness', async () => {
    mockGetRuntimeExecutionState.mockRejectedValue(new Error('redis down'));
    const readiness = await buildArtemisReadiness({});
    expect(readiness.executionEligible).toBe(false);
    expect(readiness.runtime).toBeNull();
    expect(readiness.runtimeTruth).toBe('UNAVAILABLE');
  });
});
