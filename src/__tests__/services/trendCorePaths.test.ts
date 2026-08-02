import { describe, expect, it } from 'vitest';
import { buildTrendCoreApiPath } from '../../../services/trendCorePaths.ts';

describe('trendCorePaths', () => {
  it('builds canonical trend core API paths', () => {
    const agentId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
    expect(buildTrendCoreApiPath(agentId, 'overview')).toBe(
      `/api/v1/ai-agents/${agentId}/trend/overview`,
    );
    expect(buildTrendCoreApiPath(agentId, 'analyze')).toBe(
      `/api/v1/ai-agents/${agentId}/trend/analyze`,
    );
    expect(buildTrendCoreApiPath(agentId, 'runs/abc')).toBe(
      `/api/v1/ai-agents/${agentId}/trend/runs/abc`,
    );
  });
});
