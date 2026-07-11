/**
 * @jest-environment node
 */
import { describe, expect, it, beforeEach } from '@jest/globals';
import {
  buildPipelineNormalizationSummary,
  loadedResponse,
  unloadedResponse,
  PIPELINE_NORM_SUMMARY_CACHE_KEY,
} from '../../services/pipelineNormalizationSummary.js';
import { buildPipelineCapacityView } from '../../services/pipelineCapacity.js';
import { clearPipelineSnapshotCache } from '../../services/pipelineSnapshotCache.js';
import {
  pipelineNormalizationSummaryResponseSchema,
  pipelineCapacityResponseSchema,
} from '../../schemas/dataHubSchemas.js';

describe('pipelineNormalizationSummary', () => {
  beforeEach(() => {
    clearPipelineSnapshotCache();
  });

  it('loadedResponse never uses fake zeros for unavailable state', () => {
    const unloaded = unloadedResponse('query_timeout');
    expect(unloaded.totalProcessed).toBeNull();
    expect(unloaded.meta.loaded).toBe(false);
    expect(pipelineNormalizationSummaryResponseSchema.safeParse(unloaded).success).toBe(true);
  });

  it('loadedResponse shapes real counts with pass rate', () => {
    const loaded = loadedResponse(
      {
        total_processed: 100,
        passed: 95,
        warnings: 3,
        rejected: 5,
        last_processed_at: new Date().toISOString(),
      },
      120,
    );
    expect(loaded.meta.loaded).toBe(true);
    expect(loaded.totalProcessed).toBe(100);
    expect(loaded.passRate).toBe(0.95);
    expect(pipelineNormalizationSummaryResponseSchema.safeParse(loaded).success).toBe(true);
  });

  it('buildPipelineNormalizationSummary returns schema-valid payload', async () => {
    const summary = await buildPipelineNormalizationSummary();
    expect(summary.windowHours).toBe(24);
    expect(pipelineNormalizationSummaryResponseSchema.safeParse(summary).success).toBe(true);
    if (summary.meta.loaded) {
      expect(summary.totalProcessed).not.toBeNull();
    } else {
      expect(summary.totalProcessed).toBeNull();
    }
  }, 120_000);
});

describe('pipelineCapacity', () => {
  it('buildPipelineCapacityView is read-only with no write controls', async () => {
    const view = await buildPipelineCapacityView();
    expect(view.mode).toBe('config_only');
    expect(view.modeLabel).toBe('configuration_only');
    expect(view.schedulerStatus).toBeDefined();
    expect(view.meta.readOnly).toBe(true);
    expect(view.meta.writeControlsAvailable).toBe(false);
    expect(view.transfer.batchSize).toBeGreaterThan(0);
    expect(view.normalization.batchSize).toBeGreaterThan(0);
    expect(pipelineCapacityResponseSchema.safeParse(view).success).toBe(true);
  });

  it('capacity response does not expose POST/mode write fields', async () => {
    const view = await buildPipelineCapacityView();
    expect(view).not.toHaveProperty('confirm_capacity_change');
    expect(view).not.toHaveProperty('allowedModes');
    expect(view.meta.notes).toContain('runtime_mode_presets_planned');
  });
});
