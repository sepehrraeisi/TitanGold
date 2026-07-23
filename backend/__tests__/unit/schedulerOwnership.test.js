/**
 * @jest-environment node
 */
import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import { normalizeAgentAllowlist, RESOLVE_REASON } from '../../services/scheduledAgentResolver.js';

const root = path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))));

describe('Scheduler ownership', () => {
  it('engineWorkerLeader is the scheduler owner path', () => {
    const src = readFileSync(path.join(root, 'workers/engineWorkerLeader.js'), 'utf8');
    expect(src).toContain('scheduler');
    expect(src).toContain('ensureAnalyticalAgentScheduler');
  });

  it('backend HTTP server does not start a second scheduler loop', () => {
    const serverSrc = readFileSync(path.join(root, 'server.js'), 'utf8');
    expect(serverSrc).not.toMatch(/new Scheduler\(/i);
  });

  it('rejects synthetic agent ids in allowlist', () => {
    const result = normalizeAgentAllowlist(['agent-1', 'arbitrage']);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe(RESOLVE_REASON.SYNTHETIC_ID);
  });

  it('empty allowlist is fail-closed', () => {
    const result = normalizeAgentAllowlist([]);
    expect(result.ok).toBe(true);
    expect(result.keys).toEqual([]);
  });

  it('preserves arbitrage-only allowlist without expansion', () => {
    const result = normalizeAgentAllowlist(['arbitrage']);
    expect(result.ok).toBe(true);
    expect(result.keys).toEqual(['arbitrage']);
  });
});
