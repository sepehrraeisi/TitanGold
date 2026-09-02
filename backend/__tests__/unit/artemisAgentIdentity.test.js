/**
 * @jest-environment node
 */
import { describe, expect, it } from '@jest/globals';
import {
  applyCanonicalAgentId,
  listCanonicalAgentKeys,
  resolveArtemisAgentIdentity,
  requireCanonicalAgentId,
} from '../../services/artemisAgentIdentity.js';

describe('Artemis WP-B.1 agent identity', () => {
  it('resolves stable agent_key and approved aliases', () => {
    expect(resolveArtemisAgentIdentity('trend')).toMatchObject({ status: 'ok', agentId: 'trend' });
    expect(resolveArtemisAgentIdentity('trend_detection')).toMatchObject({ status: 'ok', agentId: 'trend' });
    expect(resolveArtemisAgentIdentity('technical_analysis')).toMatchObject({ status: 'ok', agentId: 'technical' });
    expect(resolveArtemisAgentIdentity('pattern_recognition')).toMatchObject({ status: 'ok', agentId: 'pattern' });
    expect(resolveArtemisAgentIdentity('volume_analysis')).toMatchObject({ status: 'ok', agentId: 'volume' });
    expect(resolveArtemisAgentIdentity('sentiment_analysis')).toMatchObject({ status: 'ok', agentId: 'sentiment' });
    expect(resolveArtemisAgentIdentity('fundamental_analysis')).toMatchObject({ status: 'ok', agentId: 'fundamental' });
    expect(resolveArtemisAgentIdentity('market_timing')).toMatchObject({ status: 'ok', agentId: 'timing' });
    expect(resolveArtemisAgentIdentity('risk_management')).toMatchObject({ status: 'ok', agentId: 'risk' });
    expect(resolveArtemisAgentIdentity('portfolio_allocation')).toMatchObject({ status: 'ok', agentId: 'portfolio' });
    expect(resolveArtemisAgentIdentity('portfolio_management')).toMatchObject({ status: 'ok', agentId: 'portfolio' });
    expect(resolveArtemisAgentIdentity('liquidity_analysis')).toMatchObject({ status: 'ok', agentId: 'liquidity' });
    expect(resolveArtemisAgentIdentity('order_management')).toMatchObject({ status: 'ok', agentId: 'order' });
    expect(resolveArtemisAgentIdentity('arbitrage')).toMatchObject({ status: 'ok', agentId: 'arbitrage' });
  });

  it('never maps legacy agent-N ids onto real Agents', () => {
    expect(resolveArtemisAgentIdentity('agent-1')).toMatchObject({
      status: 'legacy_unavailable',
      agentId: null,
      reason: 'legacy_agent_n',
    });
    expect(resolveArtemisAgentIdentity('agent-15')).toMatchObject({ status: 'legacy_unavailable', agentId: null });
    expect(resolveArtemisAgentIdentity('unknown-agent')).toMatchObject({ status: 'unknown', agentId: null });
    expect(resolveArtemisAgentIdentity('')).toMatchObject({ status: 'invalid', agentId: null });
  });

  it('requireCanonicalAgentId throws for unresolved identities', () => {
    expect(requireCanonicalAgentId('trend_detection')).toBe('trend');
    expect(() => requireCanonicalAgentId('agent-7')).toThrow(/Invalid Artemis agent identity/);
  });

  it('lists exactly 15 canonical keys including optimization', () => {
    const keys = listCanonicalAgentKeys();
    expect(keys).toHaveLength(15);
    expect(keys).toEqual(expect.arrayContaining(['trend', 'arbitrage', 'volume', 'pattern', 'optimization']));
  });

  it('applyCanonicalAgentId rewrites aliases and leaves unknown/legacy unchanged', () => {
    expect(applyCanonicalAgentId({ agentId: 'trend_detection' })).toEqual({ agentId: 'trend' });
    expect(applyCanonicalAgentId({ agentId: 'agent-3' }).agentId).toBe('agent-3');
    expect(applyCanonicalAgentId({ agentId: 'unknown-agent' }).agentId).toBe('unknown-agent');
  });
});
