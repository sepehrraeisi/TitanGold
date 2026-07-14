import { describe, expect, it } from 'vitest';
import {
  formatAccuracy,
  formatLastRun,
  getAgentExecutionKind,
  mapAgentOperationalState,
} from '../../components/ai/shell/agentCardMeta.ts';

describe('agentCardMeta', () => {
  it('maps execution kinds', () => {
    expect(getAgentExecutionKind('technical')).toBe('analytical');
    expect(getAgentExecutionKind('arbitrage')).toBe('provider');
    expect(getAgentExecutionKind('order')).toBe('live_capable');
  });

  it('formats accuracy as N/A when uncalculable', () => {
    expect(formatAccuracy(0)).toBe('N/A');
    expect(formatAccuracy(null)).toBe('N/A');
    expect(formatAccuracy(82.5)).toBe('82.5%');
  });

  it('formats last run / never', () => {
    expect(formatLastRun(undefined)).toBe('Never run');
    expect(formatLastRun('1990-01-01T00:00:00.000Z')).toBe('Never run');
    expect(formatLastRun('2026-07-14T12:00:00.000Z')).not.toBe('Never run');
  });

  it('maps operational states', () => {
    expect(mapAgentOperationalState('active')).toBe('ready');
    expect(mapAgentOperationalState('inactive')).toBe('paused');
    expect(mapAgentOperationalState('error')).toBe('error');
  });
});
