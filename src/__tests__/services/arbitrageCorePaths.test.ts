import { describe, expect, it } from 'vitest';
import { buildArbitrageCoreApiPath } from '../../../services/arbitrageCorePaths.ts';

describe('arbitrageCorePaths', () => {
  it('builds versioned canonical scan URL without trailing slash', () => {
    expect(buildArbitrageCoreApiPath('agent-123', 'scan')).toBe(
      '/api/v1/ai-agents/agent-123/arbitrage/scan',
    );
    expect(buildArbitrageCoreApiPath('agent-123', 'overview')).toBe(
      '/api/v1/ai-agents/agent-123/arbitrage/overview',
    );
  });
});
