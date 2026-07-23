/**
 * @jest-environment node
 */
import { describe, expect, it } from '@jest/globals';
import { buildAgentStatusProjection } from '../../services/agentStatusProjection.js';
import { hasAgent } from '../../services/agents/registry.js';

describe('agentStatusProjection', () => {
  it('exposes separated registered/enabled/allowlisted/scheduled flags', () => {
    const projection = buildAgentStatusProjection({
      agent: {
        agent_key: 'arbitrage',
        status: 'active',
        is_enabled: true,
        config: { symbols: ['BTCUSDT'] },
        metadata: { last_result: { status: 'completed' } },
        last_active_at: new Date().toISOString(),
      },
      allowlist: ['arbitrage'],
      schedulerRunning: true,
      killSwitchActive: true,
      effectiveMode: 'demo',
    });
    expect(projection.registered).toBe(true);
    expect(projection.configured).toBe(true);
    expect(projection.enabled).toBe(true);
    expect(projection.allowlisted).toBe(true);
    expect(projection.scheduled).toBe(true);
    expect(projection.executionEligible).toBe(false);
    expect(projection.consumerEligible).toBe(true);
    expect(projection.schedulerOwner).toBe('titan-engine-worker');
  });

  it('fail-closed for unknown agent keys', () => {
    const projection = buildAgentStatusProjection({
      agent: { agent_key: 'unknown_agent_xyz', status: 'active', is_enabled: true, config: {}, metadata: {} },
      allowlist: [],
    });
    expect(projection.registered).toBe(false);
    expect(projection.consumerRegistered).toBe(false);
  });

  it('canonical registry has no duplicate keys', () => {
    const keys = [
      'technical', 'risk', 'sentiment', 'pattern', 'price_prediction', 'arbitrage',
      'portfolio', 'liquidity', 'trend', 'optimization', 'order', 'fundamental',
      'market_intelligence', 'volume', 'timing',
    ];
    expect(new Set(keys).size).toBe(keys.length);
    for (const k of keys) expect(hasAgent(k)).toBe(true);
    expect(hasAgent('unknown_agent_xyz')).toBe(false);
  });
});
