/**
 * @jest-environment node
 */
import { describe, expect, it } from '@jest/globals';
import {
  buildBacklogTrend,
  classifyBacklogSeverity,
  computeCatchUpHoursLive,
  computeTrendDirection,
  estimateBacklog24hAgo,
  findBacklogSnapshot24hAgo,
} from '../../services/pipelineBacklogTrend.js';
import { buildPipelineCapacityView } from '../../services/pipelineCapacity.js';
import { pipelineCapacityResponseSchema } from '../../schemas/dataHubSchemas.js';

describe('pipelineBacklogTrend', () => {
  it('classifies backlog severity', () => {
    expect(classifyBacklogSeverity(99_999)).toBe('normal');
    expect(classifyBacklogSeverity(250_000)).toBe('warning');
    expect(classifyBacklogSeverity(600_000)).toBe('critical');
  });

  it('estimates backlog 24h ago from flow balance', () => {
    expect(
      estimateBacklog24hAgo({
        currentBacklog: 743_569,
        incoming24h: 76_128,
        processed24h: 144_900,
      }),
    ).toBe(743_569 - 76_128 + 144_900);
  });

  it('computes trend direction from historical comparison', () => {
    expect(computeTrendDirection(743_569, 600_000).direction).toBe('up');
    expect(computeTrendDirection(500_000, 600_000).direction).toBe('down');
    expect(computeTrendDirection(600_000, 601_000).direction).toBe('stable');
  });

  it('buildBacklogTrend uses flow balance when no redis history', async () => {
    const trend = await buildBacklogTrend({
      currentBacklog: 743_569,
      incoming24h: 76_128,
      processed24h: 144_900,
    });
    expect(trend.loaded).toBe(true);
    expect(['up', 'down', 'stable']).toContain(trend.direction);
    expect(trend.source).toBe('flow_balance_estimate');
  });

  it('buildBacklogTrend unavailable when backlog missing', async () => {
    const trend = await buildBacklogTrend({
      currentBacklog: null,
      incoming24h: 100,
      processed24h: 100,
    });
    expect(trend.loaded).toBe(false);
    expect(trend.display).toBeNull();
  });

  it('findBacklogSnapshot24hAgo picks closest entry within tolerance', () => {
    const now = Date.parse('2026-07-04T12:00:00.000Z');
    const history = [
      { capturedAt: '2026-07-03T08:00:00.000Z', backlogTotal: 700_000 },
      { capturedAt: '2026-07-03T11:55:00.000Z', backlogTotal: 710_000 },
    ];
    const match = findBacklogSnapshot24hAgo(history, now);
    expect(match?.backlogTotal).toBe(710_000);
  });

  it('catch-up hours derived live not cached', () => {
    expect(computeCatchUpHoursLive(720_000, 6000)).toBe(120);
    expect(computeCatchUpHoursLive(0, 6000)).toBe(0);
    expect(computeCatchUpHoursLive(100, 0)).toBeNull();
  });
});

describe('pipelineCapacity polish', () => {
  it('includes scheduler status and no balanced mode label', async () => {
    const view = await buildPipelineCapacityView();
    expect(view.modeLabel).toBe('configuration_only');
    expect(view.modeLabel).not.toBe('balanced');
    expect(['running', 'stopped', 'unknown']).toContain(view.schedulerStatus);
    expect(pipelineCapacityResponseSchema.safeParse(view).success).toBe(true);
  });
});
