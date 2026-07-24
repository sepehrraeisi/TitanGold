/**
 * @jest-environment node
 */
import { describe, expect, it } from '@jest/globals';
import { buildAgentProductStatus } from '../../services/agentProductStatus.js';
import { buildAgentStatusProjection } from '../../services/agentStatusProjection.js';
import { listAgentKeys } from '../../services/agents/registry.js';

describe('agentProductStatus backend', () => {
  const baseCtx = {
    allowlist: ['arbitrage'],
    schedulerRunning: true,
    killSwitchActive: true,
    effectiveMode: 'demo',
  };

  it('Arbitrage product status is scheduled or operational, never generic active', () => {
    const projection = buildAgentStatusProjection({
      agent: {
        agent_key: 'arbitrage',
        status: 'active',
        is_enabled: true,
        config: { symbols: ['BTCUSDT'] },
        metadata: { last_result: { status: 'completed' } },
        last_active_at: new Date().toISOString(),
      },
      ...baseCtx,
    });
    const product = buildAgentProductStatus(projection, {
      killSwitchActive: true,
      effectiveMode: 'demo',
    });
    expect(['scheduled', 'operational']).toContain(product.primaryState);
    expect(product.primaryLabelKey).not.toBe('active');
  });

  it('non-Arbitrage enabled agents are Limited', () => {
    for (const key of listAgentKeys()) {
      if (key === 'arbitrage' || key === 'order') continue;
      const projection = buildAgentStatusProjection({
        agent: { agent_key: key, status: 'active', is_enabled: true, config: { x: 1 }, metadata: {} },
        ...baseCtx,
      });
      const product = buildAgentProductStatus(projection, {
        killSwitchActive: true,
        effectiveMode: 'demo',
      });
      expect(product.primaryState).toBe('limited');
      expect(product.primaryLabelKey).toBe('agent_product_limited');
    }
  });

  it('Order Management is Blocked in demo + emergency stop runtime', () => {
    const projection = buildAgentStatusProjection({
      agent: { agent_key: 'order', status: 'active', is_enabled: true, config: { x: 1 }, metadata: {} },
      ...baseCtx,
    });
    const product = buildAgentProductStatus(projection, {
      killSwitchActive: true,
      effectiveMode: 'demo',
    });
    expect(product.primaryState).toBe('blocked');
    expect(product.primaryLabelKey).toBe('agent_product_blocked');
  });
});
