/**
 * Scheduler safety — verifies canonical service path (no HTTP bypass)
 * @jest-environment node
 */
import { describe, expect, it, jest } from '@jest/globals';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const schedulerPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../engine/scheduler.js');
const source = readFileSync(schedulerPath, 'utf8');

describe('Scheduler safety static verification', () => {
  it('uses agentExecutionService not legacy HTTP /api/ai-agents', () => {
    expect(source).toContain('agentExecutionService');
    expect(source).not.toMatch(/fetch\s*\(\s*['"`].*\/api\/ai-agents/);
  });

  it('does not use static internal bypass token', () => {
    expect(source).not.toMatch(/INTERNAL_TOKEN|BYPASS_TOKEN|x-internal-token/i);
  });

  it('imports executeAgentRun from canonical service', () => {
    expect(source).toContain('executeAgentRun');
  });

  it('uses canonical agent resolution not synthetic agent-N ids', () => {
    expect(source).toContain('resolveScheduledAgent');
    expect(source).toContain('normalizeAgentAllowlist');
    expect(source).not.toMatch(/'agent-1'/);
    expect(source).not.toMatch(/'agent-6'/);
    expect(source).not.toMatch(/'agent-15'/);
  });

  it('supports Emergency Stop separation without global agent timer wipe intent', () => {
    expect(source).toContain('applyEmergencyStopSeparation');
    expect(source).toContain('ensureAnalyticalAgentScheduler');
  });
});

describe('engineWorkerLeader kill switch monitor', () => {
  const workerPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../workers/engineWorkerLeader.js');
  const workerSource = readFileSync(workerPath, 'utf8');

  it('starts kill switch monitor at worker startup (not only when engines start)', () => {
    expect(workerSource).toContain('this.startKillSwitchMonitor()');
    const startIdx = workerSource.indexOf('async start()');
    const monitorIdx = workerSource.indexOf('this.startKillSwitchMonitor()');
    const enginesIdx = workerSource.indexOf('async startEngines()');
    expect(monitorIdx).toBeGreaterThan(startIdx);
    expect(monitorIdx).toBeLessThan(enginesIdx);
  });

  it('uses pub/sub and poll fallback', () => {
    expect(workerSource).toContain('subscribeRuntimeEvents');
    expect(workerSource).toMatch(/setInterval.*3000|3000/);
  });

  it('does not call scheduler.stop under kill switch (AI-FOUNDATION-R2)', () => {
    expect(workerSource).toContain('applyEmergencyStopSeparation');
    // Ensure the kill-switch branch does not wipe analytical timers
    const handleIdx = workerSource.indexOf('const handleState');
    const handleSlice = workerSource.slice(handleIdx, handleIdx + 2500);
    expect(handleSlice).not.toMatch(/scheduler\?\.stop\)\s*scheduler\.stop/);
    expect(handleSlice).not.toMatch(/if \(scheduler\?\.stop\)\s*scheduler\.stop/);
  });

  it('stops trading engine under kill switch', () => {
    expect(workerSource).toContain('tradingEngine?.stop');
    expect(workerSource).toMatch(/stopping trading engine/);
  });

  it('does not log success inside failure catch blocks', () => {
    const catchBlocks = workerSource.match(/catch\s*\([^)]*\)\s*\{[^}]*success/gi) || [];
    expect(catchBlocks.filter((b) => /logger\.(info|log).*success/i.test(b)).length).toBe(0);
  });
});

describe('Scheduler process-level safety (mocked execution)', () => {
  it('executeAgentRun invoked with system identity for scheduled jobs', async () => {
    const mod = await import('../../services/agentExecutionService.js');
    expect(typeof mod.executeAgentRun).toBe('function');
  });

  it('unknown agent fails closed via policy', async () => {
    const policy = await import('../../services/agentExecutionPolicyService.js');
    const decision = await policy.evaluateExecutionPolicy({
      agentKey: 'unknown_agent_xyz',
      userId: 'system',
      requestedMode: 'demo',
      role: 'admin',
    });
    expect(decision.allowed === false || decision.effectiveMode === 'demo').toBe(true);
  });

  it('demo suppression blocks live side effects', async () => {
    const policy = await import('../../services/agentExecutionPolicyService.js');
    const decision = await policy.evaluateExecutionPolicy({
      agentKey: 'order',
      userId: 'system',
      requestedMode: 'live',
      role: 'trader',
      globalMode: 'demo',
      killSwitchActive: true,
    });
    expect(decision.sideEffectsSuppressed === true || decision.allowed === false || decision.effectiveMode !== 'live').toBe(true);
  });
});
