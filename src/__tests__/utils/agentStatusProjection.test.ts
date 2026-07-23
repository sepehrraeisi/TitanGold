import { describe, expect, it } from 'vitest';
import {
  resolveOperationalPresentation,
  lifecycleLabelKey,
} from '../../../utils/agentStatusProjection.ts';

describe('agentStatusProjection frontend', () => {
  it('does not collapse allowlisted and scheduled into one state', () => {
    const scheduled = resolveOperationalPresentation({
      statusProjection: {
        agentKey: 'arbitrage',
        registered: true,
        configured: true,
        enabled: true,
        allowlisted: true,
        scheduled: true,
        running: false,
        healthy: true,
        dataReady: true,
        consumerRegistered: true,
        consumerEligible: true,
        executionEligible: false,
        executionEligibleWhenLive: false,
        liveCapable: false,
        sideEffectClass: 'external_read',
        lastRunStatus: 'success',
        schedulerOwner: 'titan-engine-worker',
      },
    });
    expect(scheduled.labelKey).toBe('agent_state_scheduled');

    const allowlistedOnly = resolveOperationalPresentation({
      statusProjection: {
        agentKey: 'technical',
        registered: true,
        configured: true,
        enabled: true,
        allowlisted: true,
        scheduled: false,
        running: false,
        healthy: true,
        dataReady: false,
        consumerRegistered: false,
        consumerEligible: false,
        executionEligible: false,
        executionEligibleWhenLive: false,
        liveCapable: false,
        sideEffectClass: 'analytical',
        lastRunStatus: 'never',
        schedulerOwner: 'titan-engine-worker',
      },
    });
    expect(allowlistedOnly.labelKey).toBe('agent_state_allowlisted');
  });

  it('maps lifecycle keys for product UI', () => {
    expect(lifecycleLabelKey('validated')).toBe('arbitrage_lifecycle_validated');
    expect(lifecycleLabelKey('blocked')).toBe('arbitrage_lifecycle_blocked');
  });
});
