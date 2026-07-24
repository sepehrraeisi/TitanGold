import { describe, expect, it } from 'vitest';
import {
  resolveAgentProductStatus,
  mapProductStateToFilterBucket,
} from '../../../utils/agentProductStatus.ts';

const baseProjection = {
  registered: true,
  configured: true,
  enabled: true,
  running: false,
  healthy: true,
  dataReady: true,
  consumerRegistered: true,
  consumerEligible: true,
  executionEligible: false,
  executionEligibleWhenLive: false,
  liveCapable: false,
  sideEffectClass: 'analytical',
  lastRunStatus: 'success' as const,
  schedulerOwner: 'titan-engine-worker',
};

const demoRuntime = { killSwitchActive: true, effectiveMode: 'demo' };

describe('agentProductStatus frontend', () => {
  it('Arbitrage scheduled with run evidence is Operational', () => {
    const status = resolveAgentProductStatus(
      {
        agent_key: 'arbitrage',
        statusProjection: {
          ...baseProjection,
          agentKey: 'arbitrage',
          allowlisted: true,
          scheduled: true,
        },
      },
      demoRuntime,
    );
    expect(status.primaryState).toBe('operational');
    expect(status.primaryLabelKey).toBe('agent_product_operational');
  });

  it('Arbitrage scheduled without run evidence stays Scheduled', () => {
    const status = resolveAgentProductStatus(
      {
        agent_key: 'arbitrage',
        statusProjection: {
          ...baseProjection,
          agentKey: 'arbitrage',
          allowlisted: true,
          scheduled: true,
          dataReady: false,
          lastRunStatus: 'never',
        },
      },
      demoRuntime,
    );
    expect(status.primaryState).toBe('scheduled');
    expect(status.primaryLabelKey).toBe('agent_state_scheduled');
  });

  it('non-scheduled analytical agents are Limited, not Active', () => {
    const status = resolveAgentProductStatus(
      {
        agent_key: 'technical',
        statusProjection: {
          ...baseProjection,
          agentKey: 'technical',
          allowlisted: false,
          scheduled: false,
          dataReady: true,
          consumerRegistered: false,
          consumerEligible: false,
        },
      },
      demoRuntime,
    );
    expect(status.primaryState).toBe('limited');
    expect(status.primaryLabelKey).toBe('agent_product_limited');
    expect(status.primaryReasonKey).toBe('agent_reason_not_scheduled');
  });

  it('Order Management is Blocked when financial execution is disabled', () => {
    const status = resolveAgentProductStatus(
      {
        agent_key: 'order',
        statusProjection: {
          ...baseProjection,
          agentKey: 'order',
          allowlisted: false,
          scheduled: false,
          liveCapable: true,
        },
      },
      demoRuntime,
    );
    expect(status.primaryState).toBe('blocked');
    expect(status.primaryLabelKey).toBe('agent_product_blocked');
    expect(status.primaryReasonKey).toBe('agent_reason_execution_disabled_runtime');
  });

  it('maps Limited to paused filter bucket', () => {
    const bucket = mapProductStateToFilterBucket({
      primaryState: 'limited',
      primaryLabelKey: 'agent_product_limited',
      tone: 'warning',
      primaryReasonKey: 'agent_reason_not_scheduled',
      safeDetails: [],
    });
    expect(bucket).toBe('paused');
  });
});
