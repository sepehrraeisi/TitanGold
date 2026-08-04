import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AGENT_KEYS, toRegistryKey } from '../../../../../constants/agentKeys';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../..');

describe('Trend agent key canonical routing', () => {
  it('maps frontend trend_detection constant to registry key trend', () => {
    expect(toRegistryKey(AGENT_KEYS.TREND)).toBe('trend');
    expect(AGENT_KEYS.TREND).toBe('trend_detection');
  });

  it('AIAgents workspace keys include backend canonical trend key', () => {
    const source = readFileSync(join(repoRoot, 'components/ai/AIAgents.tsx'), 'utf8');
    expect(source).toContain("AGENT_KEYS.TREND");
    expect(source).toContain("'trend'");
    expect(source).toContain('isWorkspaceAgentKey');
    expect(source).toContain('TrendAgentPopup');
  });

  it('backend trend run service accepts trend and trend_detection', () => {
    const source = readFileSync(join(repoRoot, 'backend/services/trendRunService.js'), 'utf8');
    expect(source).toContain("agent.agent_key !== TREND_AGENT_KEY && agent.agent_key !== 'trend_detection'");
  });
});
