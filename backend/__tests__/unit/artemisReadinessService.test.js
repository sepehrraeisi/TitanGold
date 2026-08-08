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

jest.unstable_mockModule('../../services/analyticalSchedulerStatus.js', () => ({
  readAnalyticalSchedulerStatus: async () => ({
    status: { owner: 'titan-engine-worker', allowlist: ['arbitrage'], agentsEnabled: true, isRunning: true, lastTickAt: null },
    stale: false,
    source: 'test',
  }),
}));

jest.unstable_mockModule('../../services/providerPool.js', () => ({
  getProviderHealth: async () => [{ provider: 'openai', healthy_keys: 1, enabled_keys: 1, total_keys: 1 }],
  getQuorum: () => 2,
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
    mockQuery.mockImplementation(async (sql) => {
      const text = String(sql);
      if (text.includes('user_preferences')) return { rows: [{ mode: 'demo' }] };
      if (text.includes('exchange_connections')) return { rows: [{ c: 1 }] };
      if (text.includes('FROM ai_agents')) {
        return { rows: [{ id: 'a1', agent_key: 'technical', name: 'Technical', type: 'technical', status: 'active', is_enabled: true }] };
      }
      if (text.includes("category = 'artemis_decision'")) return { rows: [{ c: 2, latest: new Date().toISOString() }] };
      if (text.includes('FROM ai_decisions d')) return { rows: [] };
      if (text.includes('FROM ai_decisions')) return { rows: [{ c: 3, latest: new Date().toISOString() }] };
      if (text.includes('FROM data_sources')) return { rows: [{ total_sources: 4, active_sources: 2 }] };
      if (text.includes('FROM artemis_state')) return { rows: [{ config: { decisionEngine: { strategy: 'mixture' } } }] };
      if (text.includes('system_config')) return { rows: [] };
      return { rows: [] };
    });

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
    expect(readiness.catalog.agents).toHaveLength(15);
    expect(readiness.inventory.truth).toBe('PERSISTED');
    expect(readiness.dataHub.status).toBe('available');
    expect(readiness.executionEligible).toBe(false);
    expect(readiness.blockers.some((b) => b.code === 'evidence_not_connected')).toBe(true);
  });

  it('survives runtime SSOT failure without fabricating readiness', async () => {
    mockGetRuntimeExecutionState.mockRejectedValue(new Error('redis down'));
    const readiness = await buildArtemisReadiness({});
    expect(readiness.executionEligible).toBe(false);
    expect(readiness.runtime).toBeNull();
    expect(readiness.runtimeTruth).toBe('UNAVAILABLE');
  });
});
