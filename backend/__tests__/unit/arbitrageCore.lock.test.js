/**
 * @jest-environment node
 */
import { describe, expect, it, beforeEach, afterEach } from '@jest/globals';
import {
  acquireScanLock,
  releaseScanLock,
  resetMemoryLocksForTests,
  withScanLock,
} from '../../services/arbitrageScanLock.js';

describe('arbitrageCore scan lock', () => {
  beforeEach(() => {
    resetMemoryLocksForTests();
  });

  afterEach(() => {
    resetMemoryLocksForTests();
  });

  it('rejects duplicate lock acquisition for same agent', async () => {
    const agentId = '00000000-0000-4000-8000-000000000001';
    const first = await acquireScanLock({ agentId, owner: 'user:1', trigger: 'manual' });
    expect(first.acquired).toBe(true);

    const second = await acquireScanLock({ agentId, owner: 'user:2', trigger: 'manual' });
    expect(second.acquired).toBe(false);
    expect(second.reason).toBe('scan_in_progress');

    await releaseScanLock(agentId);
  });

  it('withScanLock throws 409 when scan already in progress', async () => {
    const agentId = '00000000-0000-4000-8000-000000000002';
    await acquireScanLock({ agentId, owner: 'user:1', trigger: 'manual' });

    await expect(
      withScanLock(agentId, 'user:2', 'manual', async () => 'should-not-run'),
    ).rejects.toMatchObject({
      code: 'SCAN_IN_PROGRESS',
      status: 409,
    });

    await releaseScanLock(agentId);
  });

  it('allows lock after release', async () => {
    const agentId = '00000000-0000-4000-8000-000000000003';
    const first = await acquireScanLock({ agentId, owner: 'user:1', trigger: 'manual' });
    expect(first.acquired).toBe(true);
    await releaseScanLock(agentId);

    const second = await acquireScanLock({ agentId, owner: 'user:2', trigger: 'manual' });
    expect(second.acquired).toBe(true);
    await releaseScanLock(agentId);
  });
});
