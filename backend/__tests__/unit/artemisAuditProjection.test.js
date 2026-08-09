/**
 * @jest-environment node
 */
import { describe, expect, it } from '@jest/globals';
import {
  ARTEMIS_PRODUCT_AUDIT_FORBIDDEN_KEYS,
  productAuditContainsForbiddenField,
  projectAdvisoryRecord,
  projectAgentRunRecord,
} from '../../services/artemisAuditProjection.js';

const RAW_ADVISORY = {
  id: 'log-1',
  level: 'info',
  category: 'artemis_decision',
  message: 'HOLD BTC/USDT — advisory only',
  metadata: {
    action: 'HOLD',
    opportunity: { symbol: 'BTC/USDT', type: 'spot' },
    decision: { action: 'HOLD', reason: 'legacy moe', classification: 'LEGACY_ADVISORY_ONLY' },
    context: {
      portfolioValue: 12500,
      dailyLoss: 40,
      dailyProfit: 12,
      activeTrades: 1,
      maxTrades: 3,
    },
    signals: [{ agent: 'technical', direction: 'buy' }],
    providers: [{ name: 'openai', raw: { choices: [] } }],
  },
  created_at: '2026-08-08T12:00:00.000Z',
};

const RAW_AGENT_RUN = {
  id: 'd1',
  agent_id: 'a1',
  agent_key: 'technical',
  agent_name: 'Technical',
  input: { symbol: 'ETH/USDT', context: { portfolioValue: 99, secret: 'nope' } },
  output: { action: 'BUY', providers: [{ raw: true }] },
  was_successful: true,
  confidence: 0.81,
  created_at: '2026-08-08T12:01:00.000Z',
};

describe('Artemis consumer-safe audit projection', () => {
  it('projects advisory records without raw metadata/context', () => {
    const projected = projectAdvisoryRecord(RAW_ADVISORY);
    expect(projected).toMatchObject({
      id: 'log-1',
      level: 'info',
      classification: 'LEGACY_ADVISORY_ONLY',
      action: 'HOLD',
      symbol: 'BTC/USDT',
      message: 'HOLD BTC/USDT — advisory only',
      executionEligible: false,
      advisoryOnly: true,
    });
    expect(projected.timestamp).toBe('2026-08-08T12:00:00.000Z');
    expect(projected.created_at).toBe('2026-08-08T12:00:00.000Z');
    expect(productAuditContainsForbiddenField(projected)).toBe(false);
    for (const key of ARTEMIS_PRODUCT_AUDIT_FORBIDDEN_KEYS) {
      expect(projected).not.toHaveProperty(key);
    }
  });

  it('projects agent runs without raw input/output', () => {
    const projected = projectAgentRunRecord(RAW_AGENT_RUN);
    expect(projected).toMatchObject({
      id: 'd1',
      agentId: 'a1',
      agentKey: 'technical',
      agentName: 'Technical',
      successful: true,
      recordedScore: 0.81,
      symbol: 'ETH/USDT',
      action: 'BUY',
    });
    expect(productAuditContainsForbiddenField(projected)).toBe(false);
    expect(projected.input).toBeUndefined();
    expect(projected.output).toBeUndefined();
  });

  it('does not treat a message mentioning portfolioValue as a leaked field', () => {
    const projected = projectAdvisoryRecord({
      id: 2,
      message: 'portfolioValue check recorded as advisory reason',
      metadata: { action: 'HOLD' },
      created_at: '2026-08-08T12:02:00.000Z',
    });
    expect(productAuditContainsForbiddenField(projected)).toBe(false);
    expect(projected.message).toMatch(/portfolioValue/);
  });
});
