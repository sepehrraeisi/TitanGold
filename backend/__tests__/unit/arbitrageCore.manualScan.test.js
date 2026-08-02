/**
 * @jest-environment node
 */
import { describe, expect, it, beforeEach } from '@jest/globals';
import {
  readIdempotentScanResponse,
  resetIdempotencyStoreForTests,
  storeIdempotentScanResponse,
} from '../../services/arbitrageScanIdempotency.js';
import { withScanLock, resetMemoryLocksForTests } from '../../services/arbitrageScanLock.js';

describe('arbitrage manual scan idempotency', () => {
  beforeEach(() => {
    resetIdempotencyStoreForTests();
    resetMemoryLocksForTests();
  });

  it('returns cached response for the same idempotency key', async () => {
    const payload = { ok: true, scanRun: { runId: 'run-1' } };
    await storeIdempotentScanResponse('agent-1', 'key-a', payload);
    const cached = await readIdempotentScanResponse('agent-1', 'key-a');
    expect(cached).toEqual(payload);
  });

  it('does not reuse idempotency cache across agents', async () => {
    await storeIdempotentScanResponse('agent-1', 'key-a', { ok: true });
    const cached = await readIdempotentScanResponse('agent-2', 'key-a');
    expect(cached).toBeNull();
  });
});

describe('arbitrage scan lock conflict code', () => {
  beforeEach(() => {
    resetMemoryLocksForTests();
  });

  it('throws ARBITRAGE_SCAN_IN_PROGRESS when lock is held', async () => {
    await withScanLock('agent-1', 'owner-a', 'manual', async () => {
      await expect(
        withScanLock('agent-1', 'owner-b', 'manual', async () => 'noop'),
      ).rejects.toMatchObject({
        code: 'ARBITRAGE_SCAN_IN_PROGRESS',
        status: 409,
      });
    });
  });
});
