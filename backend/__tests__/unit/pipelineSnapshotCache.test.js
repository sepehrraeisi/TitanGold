import { describe, it, expect, beforeEach } from '@jest/globals';
import { clearPipelineSnapshotCache, getOrLoadCached } from '../../services/pipelineSnapshotCache.js';

describe('pipelineSnapshotCache', () => {
  beforeEach(() => {
    clearPipelineSnapshotCache();
  });

  it('returns cached value within TTL', async () => {
    let loads = 0;
    const loader = async () => {
      loads += 1;
      return { ok: true };
    };
    const a = await getOrLoadCached('test:key', loader, 60_000);
    const b = await getOrLoadCached('test:key', loader, 60_000);
    expect(a).toEqual({ ok: true });
    expect(b).toEqual({ ok: true });
    expect(loads).toBe(1);
  });
});
