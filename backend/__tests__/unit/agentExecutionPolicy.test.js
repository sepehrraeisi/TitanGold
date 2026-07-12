/**
 * @jest-environment node
 */
import { describe, expect, it, jest, beforeEach } from '@jest/globals';

const mockQuery = jest.fn();

jest.unstable_mockModule('../../database/db.js', () => ({ query: mockQuery }));
jest.unstable_mockModule('../../services/logger.js', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

jest.unstable_mockModule('../../services/runtimeExecutionStateService.js', () => ({
  getRuntimeExecutionState: jest.fn(async () => ({
    globalMode: 'demo',
    killSwitchActive: true,
    version: 1,
  })),
  getEffectiveGlobalMode: jest.fn(async () => 'demo'),
  isKillSwitchActive: jest.fn(async () => true),
  isDeploymentEngineEnabled: jest.fn(() => true),
}));

const { evaluateExecutionPolicy, REASON } = await import('../../services/agentExecutionPolicyService.js');

describe('agentExecutionPolicyService', () => {
  beforeEach(() => {
    mockQuery.mockReset();
    mockQuery.mockResolvedValue({ rows: [{ mode: 'live' }] });
  });

  it('denies user without execute capability', async () => {
    const decision = await evaluateExecutionPolicy({
      identityType: 'user',
      user: { id: '1', role: 'user' },
      agentKey: 'technical',
      agentEnabled: true,
      action: 'agent.run',
    });
    expect(decision.allowed).toBe(false);
    expect(decision.reasonCode).toBe(REASON.CAPABILITY_DENIED);
  });

  it('allows admin safe run in demo with side effects suppressed for webhooks path', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ mode: 'demo' }] })
      .mockResolvedValueOnce({ rows: [{ c: 0 }] });
    const decision = await evaluateExecutionPolicy({
      identityType: 'user',
      user: { id: '1', role: 'admin' },
      agentKey: 'technical',
      agentEnabled: true,
      action: 'agent.run',
    });
    expect(decision.allowed).toBe(true);
    expect(decision.effectiveMode).toBe('dry_run');
  });

  it('blocks live order action under kill switch', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ mode: 'live' }] })
      .mockResolvedValueOnce({ rows: [{ c: 1 }] });
    const decision = await evaluateExecutionPolicy({
      identityType: 'user',
      user: { id: '1', role: 'admin' },
      agentKey: 'order',
      agentEnabled: true,
      params: { action: 'place_order' },
      confirmLive: true,
      action: 'agent.run',
    });
    expect(decision.allowed).toBe(false);
    expect(decision.reasonCode).toBe(REASON.KILL_SWITCH_ACTIVE);
  });

  it('denies unclassified agent', async () => {
    const decision = await evaluateExecutionPolicy({
      identityType: 'user',
      user: { id: '1', role: 'admin' },
      agentKey: 'unknown_agent',
      agentEnabled: true,
      action: 'agent.run',
    });
    expect(decision.allowed).toBe(false);
    expect(decision.reasonCode).toBe(REASON.AGENT_UNCLASSIFIED);
  });
});
