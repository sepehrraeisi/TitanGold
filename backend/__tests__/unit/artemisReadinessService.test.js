/**
 * @jest-environment node
 */
import { describe, expect, it, jest, beforeEach } from '@jest/globals';

const mockGetRuntimeExecutionState = jest.fn();
const mockBuildRuntimeView = jest.fn();
const mockQuery = jest.fn();
const mockGetProviderHealth = jest.fn();
const mockCountActiveProviderInstances = jest.fn();

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
  getProviderHealth: mockGetProviderHealth,
  countActiveProviderInstances: mockCountActiveProviderInstances,
  getQuorum: (n) => Math.max(2, Math.ceil((Number(n) || 0) * 0.4)),
}));

const { buildArtemisReadiness } = await import('../../services/artemisReadinessService.js');

describe('Artemis WP-A readiness aggregation', () => {
  beforeEach(() => {
    mockGetRuntimeExecutionState.mockReset();
    mockBuildRuntimeView.mockReset();
    mockQuery.mockReset();
    mockGetProviderHealth.mockReset();
    mockCountActiveProviderInstances.mockReset();
    mockGetProviderHealth.mockResolvedValue([{ provider: 'openai', healthy_keys: 1, enabled_keys: 1, total_keys: 1 }]);
    mockCountActiveProviderInstances.mockResolvedValue(1);
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
      if (text.includes("category = 'artemis_decision'") && text.includes('COUNT(')) {
        return { rows: [{ c: 2, latest: new Date().toISOString() }] };
      }
      if (text.includes("category = 'artemis_decision'")) {
        return {
          rows: [
            {
              id: 'log-1',
              level: 'info',
              category: 'artemis_decision',
              message: 'HOLD BTC/USDT',
              metadata: { action: 'HOLD', opportunity: { symbol: 'BTC/USDT' } },
              created_at: new Date().toISOString(),
            },
          ],
        };
      }
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
    expect(readiness.advisory.count).toBe(2);
    expect(readiness.advisory.recent).toHaveLength(1);
    expect(readiness.advisory.detailsAvailable).toBe(true);
    expect(readiness.advisory.recent[0]).toMatchObject({
      action: 'HOLD',
      symbol: 'BTC/USDT',
      executionEligible: false,
      advisoryOnly: true,
    });
    expect(readiness.advisory.recent[0].metadata).toBeUndefined();
    expect(JSON.stringify(readiness.advisory.recent)).not.toMatch(/opportunity/);
    expect(readiness.agentRuns.count).toBe(3);
    expect(readiness.agentRuns.detailsAvailable).toBe(false);
    expect(readiness.providers.configured).toBe(1);
    expect(readiness.providers.healthy).toBe(1);
    expect(readiness.providers.activeUsableInstances).toBe(1);
    expect(readiness.providers.quorum).toBe(2);
    expect(readiness.providers.ready).toBe(false);
  });

  it('one usable provider with canonical quorum 2 is not ready', async () => {
    mockGetRuntimeExecutionState.mockResolvedValue({ killSwitchActive: false });
    mockBuildRuntimeView.mockReturnValue({ requestedMode: 'demo', effectiveMode: 'demo', killSwitchActive: false });
    mockQuery.mockResolvedValue({ rows: [] });
    mockCountActiveProviderInstances.mockResolvedValue(1);
    mockGetProviderHealth.mockResolvedValue([{ provider: 'openai', healthy_keys: 1, enabled_keys: 1, total_keys: 1 }]);
    const readiness = await buildArtemisReadiness({});
    expect(readiness.providers.truth).toBe('MEASURED');
    expect(readiness.providers.activeUsableInstances).toBe(1);
    expect(readiness.providers.quorum).toBe(2);
    expect(readiness.providers.ready).toBe(false);
  });

  it('two usable providers satisfying quorum 2 are ready', async () => {
    mockGetRuntimeExecutionState.mockResolvedValue({ killSwitchActive: false });
    mockBuildRuntimeView.mockReturnValue({ requestedMode: 'demo', effectiveMode: 'demo', killSwitchActive: false });
    mockQuery.mockResolvedValue({ rows: [] });
    mockCountActiveProviderInstances.mockResolvedValue(2);
    mockGetProviderHealth.mockResolvedValue([
      { provider: 'openai', healthy_keys: 1, enabled_keys: 1, total_keys: 1 },
      { provider: 'anthropic', healthy_keys: 1, enabled_keys: 1, total_keys: 1 },
    ]);
    const readiness = await buildArtemisReadiness({});
    expect(readiness.providers.configured).toBe(2);
    expect(readiness.providers.healthy).toBe(2);
    expect(readiness.providers.activeUsableInstances).toBe(2);
    expect(readiness.providers.quorum).toBe(2);
    expect(readiness.providers.ready).toBe(true);
  });

  it('provider health unavailable stays unavailable, not zero/success', async () => {
    mockGetRuntimeExecutionState.mockResolvedValue({ killSwitchActive: false });
    mockBuildRuntimeView.mockReturnValue({ requestedMode: 'demo', effectiveMode: 'demo', killSwitchActive: false });
    mockQuery.mockResolvedValue({ rows: [] });
    mockCountActiveProviderInstances.mockRejectedValue(new Error('provider pool redis timeout'));
    mockGetProviderHealth.mockRejectedValue(new Error('provider pool redis timeout'));
    const readiness = await buildArtemisReadiness({});
    expect(readiness.providers.truth).toBe('UNAVAILABLE');
    expect(readiness.providers.ready).toBeNull();
    expect(readiness.providers.quorum).toBeNull();
    expect(readiness.providers.activeUsableInstances).toBeNull();
    expect(readiness.providers.configured).toBeNull();
    expect(readiness.providers.healthy).toBeNull();
  });

  it('keeps advisory count when recent rows fail to load', async () => {
    mockGetRuntimeExecutionState.mockResolvedValue({ killSwitchActive: false });
    mockBuildRuntimeView.mockReturnValue({ requestedMode: 'demo', effectiveMode: 'demo', killSwitchActive: false });
    mockQuery.mockImplementation(async (sql) => {
      const text = String(sql);
      if (text.includes("category = 'artemis_decision'") && text.includes('COUNT(')) {
        return { rows: [{ c: 7, latest: new Date().toISOString() }] };
      }
      if (text.includes("category = 'artemis_decision'")) throw new Error('rows unavailable');
      if (text.includes('FROM ai_decisions d')) throw new Error('recent runs unavailable');
      if (text.includes('FROM ai_decisions')) return { rows: [{ c: 6051, latest: new Date().toISOString() }] };
      return { rows: [] };
    });
    const readiness = await buildArtemisReadiness({});
    expect(readiness.advisory.count).toBe(7);
    expect(readiness.advisory.recent).toEqual([]);
    expect(readiness.advisory.detailsAvailable).toBe(false);
    expect(readiness.agentRuns.count).toBe(6051);
    expect(readiness.agentRuns.recent).toEqual([]);
    expect(readiness.agentRuns.detailsAvailable).toBe(false);
  });

  it('survives runtime SSOT failure without fabricating readiness', async () => {
    mockGetRuntimeExecutionState.mockRejectedValue(new Error('redis down'));
    const readiness = await buildArtemisReadiness({});
    expect(readiness.executionEligible).toBe(false);
    expect(readiness.runtime).toBeNull();
    expect(readiness.runtimeTruth).toBe('UNAVAILABLE');
  });
});
