/**
 * AI-FOUNDATION-R2 — scheduled agent resolver + allowlist
 * @jest-environment node
 */
import { describe, expect, it, jest, beforeEach } from '@jest/globals';

const mockQuery = jest.fn();

jest.unstable_mockModule('../../database/db.js', () => ({
  query: mockQuery,
  default: { query: mockQuery },
}));

const {
  normalizeAgentAllowlist,
  resolveScheduledAgent,
  isSafeAnalyticalUnderEmergencyStop,
  RESOLVE_REASON,
} = await import('../../services/scheduledAgentResolver.js');

describe('normalizeAgentAllowlist', () => {
  it('empty array means nobody (not all agents)', () => {
    const r = normalizeAgentAllowlist([]);
    expect(r.ok).toBe(true);
    expect(r.keys).toEqual([]);
  });

  it('null/undefined yields empty allowlist', () => {
    expect(normalizeAgentAllowlist(null).keys).toEqual([]);
    expect(normalizeAgentAllowlist(undefined).keys).toEqual([]);
  });

  it('deduplicates agent_key values', () => {
    const r = normalizeAgentAllowlist(['arbitrage', 'Arbitrage', 'arbitrage']);
    expect(r.ok).toBe(true);
    expect(r.keys).toEqual(['arbitrage']);
  });

  it('rejects synthetic agent-N ids', () => {
    const r = normalizeAgentAllowlist(['agent-6']);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe(RESOLVE_REASON.SYNTHETIC_ID);
  });

  it('rejects malformed non-array', () => {
    const r = normalizeAgentAllowlist('arbitrage');
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('MALFORMED');
  });

  it('rejects empty string entries', () => {
    const r = normalizeAgentAllowlist(['']);
    expect(r.ok).toBe(false);
  });
});

describe('resolveScheduledAgent', () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  it('resolves arbitrage agent_key to canonical UUID', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{
        id: '04b6ca95-5fd3-471d-a568-bd7f1c391d83',
        agent_key: 'arbitrage',
        name: 'Arbitrage Agent',
        status: 'active',
        is_enabled: true,
      }],
    });
    const r = await resolveScheduledAgent('arbitrage');
    expect(r.ok).toBe(true);
    expect(r.agentKey).toBe('arbitrage');
    expect(r.agentId).toBe('04b6ca95-5fd3-471d-a568-bd7f1c391d83');
    expect(r.liveCapable).toBe(false);
  });

  it('resolves UUID when present', async () => {
    const id = '04b6ca95-5fd3-471d-a568-bd7f1c391d83';
    mockQuery.mockResolvedValueOnce({
      rows: [{
        id,
        agent_key: 'arbitrage',
        name: 'Arbitrage Agent',
        status: 'active',
        is_enabled: true,
      }],
    });
    const r = await resolveScheduledAgent(id);
    expect(r.ok).toBe(true);
    expect(r.agentId).toBe(id);
  });

  it('rejects agent-6 synthetic id without DB lookup', async () => {
    const r = await resolveScheduledAgent('agent-6');
    expect(r.ok).toBe(false);
    expect(r.reason).toBe(RESOLVE_REASON.SYNTHETIC_ID);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('fails closed for unknown key', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const r = await resolveScheduledAgent('no_such_agent');
    expect(r.ok).toBe(false);
    expect(r.reason).toBe(RESOLVE_REASON.UNKNOWN);
  });

  it('skips disabled agent', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{
        id: '04b6ca95-5fd3-471d-a568-bd7f1c391d83',
        agent_key: 'arbitrage',
        name: 'Arbitrage Agent',
        status: 'active',
        is_enabled: false,
      }],
    });
    const r = await resolveScheduledAgent('arbitrage');
    expect(r.ok).toBe(false);
    expect(r.reason).toBe(RESOLVE_REASON.DISABLED);
  });

  it('skips paused agent', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{
        id: '04b6ca95-5fd3-471d-a568-bd7f1c391d83',
        agent_key: 'arbitrage',
        name: 'Arbitrage Agent',
        status: 'paused',
        is_enabled: true,
      }],
    });
    const r = await resolveScheduledAgent('arbitrage');
    expect(r.ok).toBe(false);
    expect(r.reason).toBe(RESOLVE_REASON.PAUSED);
  });

  it('fails closed on ambiguous duplicate keys', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        { id: 'a', agent_key: 'arbitrage', name: 'A', status: 'active', is_enabled: true },
        { id: 'b', agent_key: 'arbitrage', name: 'B', status: 'active', is_enabled: true },
      ],
    });
    const r = await resolveScheduledAgent('arbitrage');
    expect(r.ok).toBe(false);
    expect(r.reason).toBe(RESOLVE_REASON.AMBIGUOUS);
  });
});

describe('isSafeAnalyticalUnderEmergencyStop', () => {
  it('allows arbitrage (not live capable)', () => {
    expect(isSafeAnalyticalUnderEmergencyStop('arbitrage')).toBe(true);
  });

  it('blocks order (live capable)', () => {
    expect(isSafeAnalyticalUnderEmergencyStop('order')).toBe(false);
  });
});
