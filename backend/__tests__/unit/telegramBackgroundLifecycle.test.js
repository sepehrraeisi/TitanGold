/**
 * Candidate B / B1 — Telegram always-on safe background lifecycle
 * @jest-environment node
 */
import { describe, expect, it, beforeEach, afterEach, jest } from '@jest/globals';

const mockQuery = jest.fn();
const mockTransfer = jest.fn();
const mockRecordLifecycle = jest.fn(async () => ({ written: true, degraded: false }));

jest.unstable_mockModule('../../database/db.js', () => ({
  query: mockQuery,
}));

jest.unstable_mockModule('../../services/telegramPipeline.js', () => ({
  transferTelegramMessagesToPipeline: mockTransfer,
  TELEGRAM_TRANSFER_DEFAULT_BATCH: 700,
}));

jest.unstable_mockModule('../../services/normalizationWorker.js', () => ({
  processNormalizationBatch: jest.fn(),
  NORMALIZATION_DEFAULT_BATCH: 50,
}));

jest.unstable_mockModule('../../jobs/dataFetchScheduler.js', () => ({
  runDataFetchJob: jest.fn(),
}));

jest.unstable_mockModule('../../services/maintenance.js', () => ({
  maintenanceService: {},
}));

jest.unstable_mockModule('../../services/scheduledAgentResolver.js', () => ({
  normalizeAgentAllowlist: () => ({ ok: true, keys: [] }),
  resolveScheduledAgent: jest.fn(),
  isSafeAnalyticalUnderEmergencyStop: () => true,
  logResolutionOutcome: jest.fn(),
}));

jest.unstable_mockModule('../../services/analyticalSchedulerStatus.js', () => ({
  publishAnalyticalSchedulerStatus: jest.fn(async () => undefined),
  buildEmptyStatus: () => ({}),
}));

jest.unstable_mockModule('../../services/runtimeExecutionStateService.js', () => ({
  isKillSwitchActive: jest.fn(async () => false),
}));

jest.unstable_mockModule('../../services/agentCapabilityRegistry.js', () => ({
  isLiveCapableAgent: () => false,
}));

jest.unstable_mockModule('../../services/pipelineSchedulerRuntime.js', () => ({
  classifyTelegramTransferLifecycleOutcome: (summary) => {
    if (summary?.skipped_run && summary.skip_reason === 'in_memory_lock') {
      return 'TICK_SKIP_IN_MEMORY';
    }
    if (summary?.skipped_run && summary.skip_reason === 'advisory_lock') {
      return 'TICK_SKIP_ADVISORY_LOCK';
    }
    if (Number(summary?.selected) === 0) return 'TICK_NOOP_SELECTED_ZERO';
    return 'TICK_SUCCESS';
  },
  recordTelegramLifecycleEvidence: mockRecordLifecycle,
  TELEGRAM_LIFECYCLE_OUTCOMES: {
    ARMED: 'ARMED',
    TICK_SUCCESS: 'TICK_SUCCESS',
    TICK_NOOP_SELECTED_ZERO: 'TICK_NOOP_SELECTED_ZERO',
    TICK_SKIP_IN_MEMORY: 'TICK_SKIP_IN_MEMORY',
    TICK_SKIP_ADVISORY_LOCK: 'TICK_SKIP_ADVISORY_LOCK',
    TICK_ERROR: 'TICK_ERROR',
    DISABLED: 'DISABLED',
    STOPPED: 'STOPPED',
    OBSERVABILITY_DEGRADED: 'OBSERVABILITY_DEGRADED',
  },
}));

const { scheduler } = await import('../../engine/scheduler.js');

describe('telegramBackgroundLifecycle (Candidate B / B1)', () => {
  const prevSchedulerEnabled = process.env.SCHEDULER_ENABLED;
  const prevTelegramInterval = process.env.TELEGRAM_PIPELINE_INTERVAL_MS;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.SCHEDULER_ENABLED = 'true';
    delete process.env.TELEGRAM_PIPELINE_INTERVAL_MS;
    mockQuery.mockResolvedValue({ rows: [{ config: {} }] });
    mockTransfer.mockResolvedValue({
      selected: 0,
      inserted: 0,
      processed: 0,
      errors: 0,
      skipped_run: false,
      durationMs: 1,
      backlogRemaining: 0,
    });
    // Clean timers from prior tests
    if (scheduler.intervals?.has('telegramPipeline')) {
      clearInterval(scheduler.intervals.get('telegramPipeline'));
      scheduler.intervals.delete('telegramPipeline');
    }
    scheduler.telegramBackgroundArmed = false;
    scheduler.isRunning = false;
    scheduler.emergencyStopSeparation = false;
    // Reset in-memory telegram config so prior updateConfig tests cannot leak
    scheduler.config.telegramPipeline = {
      enabled: true,
      interval: parseInt(process.env.TELEGRAM_PIPELINE_INTERVAL_MS, 10) || 5 * 60 * 1000,
    };
  });

  afterEach(async () => {
    await scheduler.stopTelegramBackgroundLifecycle();
    await scheduler.stop();
    process.env.SCHEDULER_ENABLED = prevSchedulerEnabled;
    if (prevTelegramInterval === undefined) {
      delete process.env.TELEGRAM_PIPELINE_INTERVAL_MS;
    } else {
      process.env.TELEGRAM_PIPELINE_INTERVAL_MS = prevTelegramInterval;
    }
  });

  it('arms Telegram background when generic hasWork is irrelevant / idle', async () => {
    const result = await scheduler.ensureTelegramBackgroundLifecycle();
    expect(result.armed).toBe(true);
    expect(scheduler.telegramBackgroundArmed).toBe(true);
    expect(scheduler.isRunning).toBe(false);
    expect(scheduler.intervals.has('telegramPipeline')).toBe(true);
    expect(result.timerCount).toBe(1);
    expect(mockRecordLifecycle).toHaveBeenCalledWith(
      expect.objectContaining({ state: 'ARMED' }),
    );
  });

  it('does not start Data Hub / Normalization / agents from background arm', async () => {
    await scheduler.ensureTelegramBackgroundLifecycle();
    expect(scheduler.intervals.has('dataHub')).toBe(false);
    expect(scheduler.intervals.has('normalization')).toBe(false);
    expect(scheduler.intervals.has('agents')).toBe(false);
    expect(scheduler.intervals.has('training')).toBe(false);
    expect(scheduler.intervals.has('artemis')).toBe(false);
  });

  it('repeated ensure is idempotent (timer count stays 1)', async () => {
    await scheduler.ensureTelegramBackgroundLifecycle();
    const second = await scheduler.ensureTelegramBackgroundLifecycle();
    expect(second.armed).toBe(true);
    expect(second.reason).toBe('already_armed');
    expect(second.timerCount).toBe(1);
    expect([...scheduler.intervals.keys()].filter((k) => k === 'telegramPipeline')).toHaveLength(1);
  });

  it('Telegram tick runs with isRunning=false when telegramBackgroundArmed=true', async () => {
    await scheduler.ensureTelegramBackgroundLifecycle();
    expect(scheduler.isRunning).toBe(false);
    await scheduler._runTelegramPipelineTick();
    expect(mockTransfer).toHaveBeenCalled();
  });

  it('full scheduler transition keeps Telegram timer count 1 -> 1', async () => {
    await scheduler.ensureTelegramBackgroundLifecycle();
    expect(scheduler.intervals.has('telegramPipeline')).toBe(true);
    await scheduler.start();
    expect(scheduler.isRunning).toBe(true);
    expect(scheduler.intervals.has('telegramPipeline')).toBe(true);
    expect([...scheduler.intervals.keys()].filter((k) => k === 'telegramPipeline')).toHaveLength(1);
  });

  it('SCHEDULER_ENABLED=false disables arming', async () => {
    process.env.SCHEDULER_ENABLED = 'false';
    const result = await scheduler.ensureTelegramBackgroundLifecycle();
    expect(result.armed).toBe(false);
    expect(result.disabled).toBe(true);
    expect(scheduler.intervals.has('telegramPipeline')).toBe(false);
  });

  it('telegramPipeline.enabled=false disables arming', async () => {
    mockQuery.mockResolvedValue({
      rows: [{ config: { telegramPipeline: { enabled: false, interval: 300000 } } }],
    });
    const result = await scheduler.ensureTelegramBackgroundLifecycle();
    expect(result.armed).toBe(false);
    expect(result.disabled).toBe(true);
    expect(result.reason).toBe('telegramPipeline_disabled');
  });

  it('strict config query failure does not arm (retryable)', async () => {
    mockQuery.mockRejectedValue(new Error('db down'));
    const result = await scheduler.ensureTelegramBackgroundLifecycle();
    expect(result.armed).toBe(false);
    expect(result.retryable).toBe(true);
    expect(result.reason).toBe('config_query_failed');
    expect(scheduler.telegramBackgroundArmed).toBe(false);
  });

  it('invalid interval cannot create zero/busy timer', async () => {
    mockQuery.mockResolvedValue({
      rows: [{ config: { telegramPipeline: { enabled: true, interval: 0 } } }],
    });
    process.env.TELEGRAM_PIPELINE_INTERVAL_MS = 'not-a-number';
    const result = await scheduler.ensureTelegramBackgroundLifecycle();
    expect(result.armed).toBe(true);
    expect(result.intervalMs).toBe(300000);
    expect(scheduler.resolveTelegramPipelineIntervalMs()).toBe(300000);
  });

  it('selected=0 records TICK_NOOP_SELECTED_ZERO', async () => {
    await scheduler.ensureTelegramBackgroundLifecycle();
    mockTransfer.mockResolvedValueOnce({
      selected: 0,
      inserted: 0,
      skipped_run: false,
      durationMs: 2,
    });
    await scheduler._runTelegramPipelineTick();
    expect(mockRecordLifecycle).toHaveBeenCalledWith(
      expect.objectContaining({ state: 'TICK_NOOP_SELECTED_ZERO' }),
    );
  });

  it('in-memory lock summary records TICK_SKIP_IN_MEMORY', async () => {
    await scheduler.ensureTelegramBackgroundLifecycle();
    mockTransfer.mockResolvedValueOnce({
      selected: 0,
      skipped_run: true,
      skip_reason: 'in_memory_lock',
    });
    await scheduler._runTelegramPipelineTick();
    expect(mockRecordLifecycle).toHaveBeenCalledWith(
      expect.objectContaining({ state: 'TICK_SKIP_IN_MEMORY' }),
    );
  });

  it('advisory lock summary records TICK_SKIP_ADVISORY_LOCK', async () => {
    await scheduler.ensureTelegramBackgroundLifecycle();
    mockTransfer.mockResolvedValueOnce({
      selected: 0,
      skipped_run: true,
      skip_reason: 'advisory_lock',
    });
    await scheduler._runTelegramPipelineTick();
    expect(mockRecordLifecycle).toHaveBeenCalledWith(
      expect.objectContaining({ state: 'TICK_SKIP_ADVISORY_LOCK' }),
    );
  });

  it('transfer throw records TICK_ERROR and timer remains armed', async () => {
    await scheduler.ensureTelegramBackgroundLifecycle();
    mockTransfer.mockRejectedValueOnce(new Error('boom'));
    await scheduler._runTelegramPipelineTick();
    expect(mockRecordLifecycle).toHaveBeenCalledWith(
      expect.objectContaining({ state: 'TICK_ERROR' }),
    );
    expect(scheduler.telegramBackgroundArmed).toBe(true);
    expect(scheduler.intervals.has('telegramPipeline')).toBe(true);
  });

  it('Redis observability degradation does not block transfer execution', async () => {
    mockRecordLifecycle.mockResolvedValueOnce({ written: false, degraded: true });
    await scheduler.ensureTelegramBackgroundLifecycle();
    mockTransfer.mockResolvedValueOnce({
      selected: 1,
      inserted: 1,
      skipped_run: false,
      durationMs: 5,
    });
    await scheduler._runTelegramPipelineTick();
    expect(mockTransfer).toHaveBeenCalled();
  });

  it('background-only stop clears Telegram timer', async () => {
    await scheduler.ensureTelegramBackgroundLifecycle();
    expect(scheduler.intervals.has('telegramPipeline')).toBe(true);
    mockRecordLifecycle.mockClear();
    const result = await scheduler.stopTelegramBackgroundLifecycle();
    expect(result.stopped).toBe(true);
    expect(result.timerCleared).toBe(true);
    expect(scheduler.telegramBackgroundArmed).toBe(false);
    expect(scheduler.intervals.has('telegramPipeline')).toBe(false);
    expect(mockRecordLifecycle).toHaveBeenCalledWith(
      expect.objectContaining({ state: 'STOPPED' }),
    );
  });

  it('stop while full isRunning leaves Telegram timer intact', async () => {
    await scheduler.ensureTelegramBackgroundLifecycle();
    scheduler.isRunning = true;
    mockRecordLifecycle.mockClear();
    const result = await scheduler.stopTelegramBackgroundLifecycle();
    expect(result.stopped).toBe(false);
    expect(result.backgroundOwnershipCleared).toBe(true);
    expect(result.timerCleared).toBe(false);
    expect(result.reason).toBe('full_scheduler_owns_timer');
    expect(result.timerCount).toBe(1);
    expect(scheduler.telegramBackgroundArmed).toBe(false);
    expect(scheduler.intervals.has('telegramPipeline')).toBe(true);
    expect(mockRecordLifecycle).not.toHaveBeenCalled();
    scheduler.isRunning = false;
  });

  it('updateConfig disable clears armed + timer (no inconsistent armed-without-timer)', async () => {
    await scheduler.ensureTelegramBackgroundLifecycle();
    expect(scheduler.telegramBackgroundArmed).toBe(true);
    mockQuery.mockResolvedValue({ rows: [] }); // saveConfig
    await scheduler.updateConfig('telegramPipeline', { enabled: false });
    expect(scheduler.config.telegramPipeline.enabled).toBe(false);
    expect(scheduler.telegramBackgroundArmed).toBe(false);
    expect(scheduler.intervals.has('telegramPipeline')).toBe(false);
  });

  it('updateConfig re-enable while armed restores missing timer', async () => {
    await scheduler.ensureTelegramBackgroundLifecycle();
    // Simulate inconsistent armed-without-timer (pre-fix defect surface)
    clearInterval(scheduler.intervals.get('telegramPipeline'));
    scheduler.intervals.delete('telegramPipeline');
    expect(scheduler.telegramBackgroundArmed).toBe(true);
    mockQuery.mockResolvedValue({ rows: [] });
    await scheduler.updateConfig('telegramPipeline', { enabled: true, interval: 300000 });
    expect(scheduler.telegramBackgroundArmed).toBe(true);
    expect(scheduler.intervals.has('telegramPipeline')).toBe(true);
  });

  it('loadConfig default throwOnError=false still swallows errors for full scheduler', async () => {
    mockQuery.mockRejectedValueOnce(new Error('transient'));
    await expect(scheduler.loadConfig()).resolves.toBeUndefined();
  });
});
