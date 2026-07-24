/**
 * Legacy/orphan containment — fail-closed static verification
 * @jest-environment node
 */
import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');

function read(rel) {
  return readFileSync(path.join(root, rel), 'utf8');
}

describe('legacyAgentContainment', () => {
  it('tradingEngine legacy scanner requires TRADING_ENGINE_ENABLED and is blocked under Emergency Stop', () => {
    const workerSrc = read('workers/engineWorkerLeader.js');
    const engineSrc = read('engine/tradingEngine.js');
    expect(workerSrc).toContain('TRADING_ENGINE_ENABLED');
    expect(workerSrc).toMatch(/Trading Engine not started — Emergency Stop active/);
    expect(engineSrc).toContain('startArbitrageScanner');
  });

  it('engineWorkerLeader does not mount a second analytical scheduler HTTP server', () => {
    const src = read('workers/engineWorkerLeader.js');
    expect(src).not.toMatch(/express\s*\(\s*\)/);
    expect(src).toContain('ensureAnalyticalAgentScheduler');
  });

  it('liquidity-agent route does not register unknown agent keys in scheduler allowlist', () => {
    const src = read('routes/liquidity-agent.js');
    expect(src).not.toContain('normalizeAgentAllowlist');
    expect(src).not.toMatch(/allowlist\s*=\s*\[/);
  });

  it('HTTP server does not start analytical scheduler timers (worker-owned)', () => {
    const src = read('server.js');
    expect(src).not.toMatch(/scheduler\.start\s*\(/);
    expect(src).not.toContain('ensureAnalyticalAgentScheduler');
  });

  it('scheduledAgentResolver rejects unknown agents fail-closed', async () => {
    const { resolveScheduledAgent } = await import('../../services/scheduledAgentResolver.js');
    const result = await resolveScheduledAgent('unknown_agent_xyz');
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('UNKNOWN');
  });
});
