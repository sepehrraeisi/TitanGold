import { TELEGRAM_TRANSFER_DEFAULT_BATCH } from './telegramPipeline.js';
import { NORMALIZATION_DEFAULT_BATCH } from './normalizationWorker.js';
import { getNormalizationWorkerStats } from './normalizationWorker.js';
import { scheduler } from '../engine/scheduler.js';

const DEFAULT_TRANSFER_INTERVAL_MS = Number(process.env.TELEGRAM_PIPELINE_INTERVAL_MS) || 5 * 60 * 1000;
const DEFAULT_NORMALIZATION_INTERVAL_MS = 60 * 1000;

function msToMinutes(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return null;
  return Math.round(ms / 60_000);
}

/**
 * Read-only pipeline throughput configuration for operator visibility.
 * @returns {object}
 */
export function buildPipelineCapacityView() {
  let schedulerConfig = null;
  try {
    schedulerConfig = scheduler.getStatus()?.config ?? null;
  } catch {
    schedulerConfig = null;
  }

  const transferIntervalMs =
    schedulerConfig?.telegramPipeline?.interval ?? DEFAULT_TRANSFER_INTERVAL_MS;
  const normalizationIntervalMs =
    schedulerConfig?.normalization?.interval ?? DEFAULT_NORMALIZATION_INTERVAL_MS;
  const normalizationBatch =
    schedulerConfig?.normalization?.batchSize ?? NORMALIZATION_DEFAULT_BATCH;

  const normStats = getNormalizationWorkerStats();

  let schedulerStatus = 'unknown';
  try {
    const status = scheduler.getStatus();
    if (status?.isRunning === true) {
      schedulerStatus = 'running';
    } else if (status?.isRunning === false) {
      schedulerStatus = 'stopped';
    }
  } catch {
    schedulerStatus = 'unknown';
  }

  return {
    mode: 'config_only',
    modeLabel: 'configuration_only',
    schedulerStatus,
    transfer: {
      batchSize: TELEGRAM_TRANSFER_DEFAULT_BATCH,
      intervalMs: transferIntervalMs,
      intervalMinutes: msToMinutes(transferIntervalMs),
      runtimeAdjustable: false,
      source: 'constant:TELEGRAM_TRANSFER_DEFAULT_BATCH',
    },
    normalization: {
      batchSize: normalizationBatch,
      intervalMs: normalizationIntervalMs,
      intervalMinutes: msToMinutes(normalizationIntervalMs),
      runtimeAdjustable: 'partial',
      source: schedulerConfig ? 'scheduler.config' : 'default',
    },
    lastNormalizationRun: normStats?.at ?? null,
    lastNormalizationStats: normStats
      ? {
          processed: normStats.processed ?? null,
          errors: normStats.errors ?? null,
          durationMs: normStats.durationMs ?? null,
        }
      : null,
    meta: {
      loaded: true,
      readOnly: true,
      writeControlsAvailable: false,
      notes: [
        'transfer_batch_requires_deploy',
        'runtime_mode_presets_planned',
      ],
    },
  };
}
