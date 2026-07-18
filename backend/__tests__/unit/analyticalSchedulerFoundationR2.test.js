/**
 * AI-FOUNDATION-R2 — analytical scheduler timer + kill-switch separation
 * @jest-environment node
 */
import { describe, expect, it, jest, beforeEach, afterEach } from '@jest/globals';

const mockQuery = jest.fn();
const mockExecuteAgentRun = jest.fn();
const mockIsKillSwitchActive = jest.fn();
const published = [];

jest.unstable_mockModule('../../database/db.js', () => ({
  query: mockQuery,
  default: { query: mockQuery },
}));

jest.unstable_mockModule('../../services/agentExecutionService.js', () => ({
  executeAgentRun: mockExecuteAgentRun,
  writeExecutionAudit: jest.fn(),
}));

jest.unstable_mockModule('../../services/runtimeExecutionStateService.js', () => ({
  isKillSwitchActive: mockIsKillSwitchActive,
  getRuntimeExecutionState: jest.fn(),
}));

jest.unstable_mockModule('../../services/analyticalSchedulerStatus.js', () => ({
  publishAnalyticalSchedulerStatus: async (s) => { published.push(s); },
  buildEmptyStatus: (overrides = {}) => ({
    owner: 'titan-engine-worker',
    pid: 1,
    host: 'test',
    isRunning: false,
    agentsEnabled: false,
    allowlist: [],
    registeredJobs: [],
    activeIntervals: [],
    emergencyStopSeparation: false,
    lastTickAt: null,
    lastSuccessAt: null,
    lastFailureAt: null,
    lastSkipReason: null,
    lastRun: null,
    updatedAt: new Date().toISOString(),
    statusVersion: 1,
    ...overrides,
  }),
  readAnalyticalSchedulerStatus: async () => ({ status: null, stale: true, source: 'test' }),
  REDIS_ANALYTICAL_SCHEDULER_STATUS_KEY: 'titan:scheduler:analytical_status',
  ANALYTICAL_SCHEDULER_STATUS_TTL_SEC: 90,
}));

jest.unstable_mockModule('../../jobs/dataFetchScheduler.js', () => ({
  runDataFetchJob: jest.fn(),
}));
jest.unstable_mockModule('../../services/maintenance.js', () => ({
  maintenanceService: { runFullSiteMaintenance: jest.fn() },
}));
jest.unstable_mockModule('../../services/telegramPipeline.js', () => ({
  transferTelegramMessagesToPipeline: jest.fn(),
  TELEGRAM_TRANSFER_DEFAULT_BATCH: 50,
}));
jest.unstable_mockModule('../../services/normalizationWorker.js', () => ({
  processNormalizationBatch: jest.fn(),
  NORMALIZATION_DEFAULT_BATCH: 150,
}));

describe('SchedulerService AI-FOUNDATION-R2', () => {
  let scheduler;
  let SchedulerServiceClass;

  beforeEach(async () => {
    jest.resetModules();
    published.length = 0;
    mockQuery.mockReset();
    mockExecuteAgentRun.mockReset();
    mockIsKillSwitchActive.mockReset();
    mockIsKillSwitchActive.mockResolvedValue(true);
    mockQuery.mockImplementation(async (sql) => {
      if (String(sql).includes('scheduler_config')) {
        return {
          rows: [{
            config: {
              agents: { enabled: true, interval: 60000, agents: ['arbitrage'] },
            },
          }],
        };
      }
      if (String(sql).includes('FROM ai_agents')) {
        return {
          rows: [{
            id: '04b6ca95-5fd3-471d-a568-bd7f1c391d83',
            agent_key: 'arbitrage',
            name: 'Arbitrage Agent',
            status: 'active',
            is_enabled: true,
          }],
        };
      }
      return { rows: [] };
    });
    mockExecuteAgentRun.mockResolvedValue({
      ok: true,
      result: { decision_type: 'arbitrage_scan', contractVersion: '2.0.0-wp1a', legacy: false },
      policy: { effectiveMode: 'dry_run' },
      sideEffectsSuppressed: true,
    });

    jest.useFakeTimers();
    const mod = await import('../../engine/scheduler.js');
    // Fresh instance via constructing behavior: use exported singleton but reset state
    scheduler = mod.scheduler;
    await scheduler.stop();
    scheduler.emergencyStopSeparation = false;
    scheduler._status = { lastTickAt: null, lastSuccessAt: null, lastFailureAt: null, lastSkipReason: null, lastRun: null };
  });

  afterEach(async () => {
    await scheduler.stop();
    jest.useRealTimers();
  });

  it('creates one agents timer and does not duplicate on ensure', async () => {
    await scheduler.applyEmergencyStopSeparation();
    expect(scheduler.intervals.has('agents')).toBe(true);
    expect(scheduler.intervals.size).toBeGreaterThanOrEqual(1);
    const first = scheduler.intervals.get('agents');
    await scheduler.applyEmergencyStopSeparation();
    expect(scheduler.intervals.get('agents')).toBe(first);
    expect(scheduler.emergencyStopSeparation).toBe(true);
  });

  it('empty allowlist does not invoke executeAgentRun', async () => {
    mockQuery.mockImplementation(async (sql) => {
      if (String(sql).includes('scheduler_config')) {
        return { rows: [{ config: { agents: { enabled: true, interval: 60000, agents: [] } } }] };
      }
      return { rows: [] };
    });
    await scheduler.loadConfig();
    scheduler.isRunning = true;
    await scheduler.ensureAnalyticalAgentScheduler();
    await scheduler.runAgentTick();
    expect(mockExecuteAgentRun).not.toHaveBeenCalled();
    expect(scheduler._status.lastSkipReason).toBe('empty_allowlist');
  });

  it('runs only allowlisted arbitrage via canonical UUID', async () => {
    await scheduler.loadConfig();
    scheduler.isRunning = true;
    await scheduler.ensureAnalyticalAgentScheduler();
    await scheduler.runAgentTick();
    expect(mockExecuteAgentRun).toHaveBeenCalledTimes(1);
    const args = mockExecuteAgentRun.mock.calls[0][0];
    expect(args.agentId).toBe('04b6ca95-5fd3-471d-a568-bd7f1c391d83');
    expect(args.identityType).toBe('system');
    expect(args.confirmLive).toBe(false);
    expect(args.input.trigger).toBe('scheduler');
  });

  it('skips live-capable agents under kill switch', async () => {
    mockIsKillSwitchActive.mockResolvedValue(true);
    mockQuery.mockImplementation(async (sql) => {
      if (String(sql).includes('scheduler_config')) {
        return { rows: [{ config: { agents: { enabled: true, interval: 60000, agents: ['order'] } } }] };
      }
      if (String(sql).includes('FROM ai_agents')) {
        return {
          rows: [{
            id: '11111111-1111-4111-8111-111111111111',
            agent_key: 'order',
            name: 'Order',
            status: 'active',
            is_enabled: true,
          }],
        };
      }
      return { rows: [] };
    });
    await scheduler.loadConfig();
    scheduler.isRunning = true;
    await scheduler.runAgentTick();
    expect(mockExecuteAgentRun).not.toHaveBeenCalled();
    expect(scheduler._status.lastSkipReason).toBe('live_capable_blocked_by_emergency_stop');
  });

  it('overlap lock prevents duplicate concurrent run', async () => {
    let release;
    const gate = new Promise((resolve) => { release = resolve; });
    mockExecuteAgentRun.mockImplementation(async () => {
      await gate;
      return {
        ok: true,
        result: { decision_type: 'arbitrage_scan' },
        policy: { effectiveMode: 'dry_run' },
        sideEffectsSuppressed: true,
      };
    });
    await scheduler.loadConfig();
    scheduler.isRunning = true;
    const p1 = scheduler.executeAllowlistedAgent('arbitrage', { killSwitchActive: true });
    const p2 = scheduler.executeAllowlistedAgent('arbitrage', { killSwitchActive: true });
    await Promise.resolve();
    release();
    await Promise.all([p1, p2]);
    expect(mockExecuteAgentRun).toHaveBeenCalledTimes(1);
  });
});
