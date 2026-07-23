/**
 * @jest-environment node
 */
import { describe, expect, it } from '@jest/globals';
import { buildAgentStatusProjection } from '../../services/agentStatusProjection.js';
import { buildAgentProductStatus } from '../../services/agentProductStatus.js';
import { listAgentKeys } from '../../services/agents/registry.js';

describe('agentStatusParity', () => {
  const baseCtx = {
    allowlist: ['arbitrage'],
    schedulerRunning: true,
    killSwitchActive: true,
    effectiveMode: 'demo',
  };

  it('Arbitrage exposes separated scheduled/allowlisted flags with executionEligible false', () => {
    const p = buildAgentStatusProjection({
      agent: {
        agent_key: 'arbitrage',
        status: 'active',
        is_enabled: true,
        config: { symbols: ['BTCUSDT'] },
        metadata: { last_result: { status: 'completed', candidateStats: { total: 1 } } },
        last_active_at: new Date().toISOString(),
      },
      ...baseCtx,
    });
    expect(p.registered).toBe(true);
    expect(p.configured).toBe(true);
    expect(p.enabled).toBe(true);
    expect(p.allowlisted).toBe(true);
    expect(p.scheduled).toBe(true);
    expect(p.executionEligible).toBe(false);
    expect(p.consumerEligible).toBe(true);
    expect(p.schedulerOwner).toBe('titan-engine-worker');
  });

  it('non-Arbitrage agents are not allowlisted or scheduled', () => {
    for (const key of listAgentKeys()) {
      if (key === 'arbitrage') continue;
      const p = buildAgentStatusProjection({
        agent: { agent_key: key, status: 'active', is_enabled: true, config: { x: 1 }, metadata: {} },
        ...baseCtx,
      });
      expect(p.allowlisted).toBe(false);
      expect(p.scheduled).toBe(false);
      expect(p.executionEligible).toBe(false);
    }
  });

  it('unknown agent fails closed', () => {
    const p = buildAgentStatusProjection({
      agent: { agent_key: 'unknown_agent_xyz', status: 'active', is_enabled: true, config: {}, metadata: {} },
      ...baseCtx,
    });
    expect(p.registered).toBe(false);
    expect(p.scheduled).toBe(false);
    expect(p.consumerEligible).toBe(false);
  });

  it('API productStatus matches projection semantics for all canonical agents', () => {
    for (const key of listAgentKeys()) {
      const projection = buildAgentStatusProjection({
        agent: {
          agent_key: key,
          status: 'active',
          is_enabled: true,
          config: key === 'arbitrage' ? { symbols: ['BTCUSDT'] } : { x: 1 },
          metadata: key === 'arbitrage' ? { last_result: { status: 'completed' } } : {},
          last_active_at: key === 'arbitrage' ? new Date().toISOString() : null,
        },
        ...baseCtx,
      });
      const product = buildAgentProductStatus(projection, {
        killSwitchActive: true,
        effectiveMode: 'demo',
      });
      if (key === 'arbitrage') {
        expect(['scheduled', 'operational']).toContain(product.primaryState);
      } else if (key === 'order') {
        expect(product.primaryState).toBe('blocked');
      } else {
        expect(product.primaryState).toBe('limited');
      }
      expect(product.primaryLabelKey).not.toBe('active');
    }
  });
});
