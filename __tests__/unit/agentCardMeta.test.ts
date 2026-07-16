import { describe, expect, it } from 'vitest';
import {
  effectiveExecutionModeLabelKey,
  formatAccuracy,
  formatLastRun,
  getAgentExecutionKind,
  mapAgentOperationalState,
  normalizeEffectiveExecutionMode,
  shellOperationalStatusLabelKey,
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
    expect(formatLastRun(undefined)).toBe('Never');
    expect(formatLastRun('1990-01-01T00:00:00.000Z')).toBe('Never');
    expect(formatLastRun('2026-07-14T12:00:00.000Z')).not.toBe('Never');
  });

  it('maps operational states', () => {
    expect(mapAgentOperationalState('active')).toBe('ready');
    expect(mapAgentOperationalState('inactive')).toBe('paused');
    expect(mapAgentOperationalState('error')).toBe('error');
  });

  it('normalizes effective execution mode without exposing raw casing', () => {
    expect(normalizeEffectiveExecutionMode('DRY_RUN')).toBe('dry_run');
    expect(normalizeEffectiveExecutionMode('dry-run')).toBe('dry_run');
    expect(normalizeEffectiveExecutionMode('demo')).toBe('demo');
    expect(normalizeEffectiveExecutionMode('live')).toBe('live');
    expect(effectiveExecutionModeLabelKey('DRY_RUN')).toBe('execution_mode_dry_run');
  });

  it('maps shell operational label ready → active for control-panel chrome', () => {
    expect(shellOperationalStatusLabelKey('ready')).toBe('active');
    expect(shellOperationalStatusLabelKey('paused')).toBe('agent_state_paused');
    expect(shellOperationalStatusLabelKey('running')).toBe('agent_state_running');
  });
});
