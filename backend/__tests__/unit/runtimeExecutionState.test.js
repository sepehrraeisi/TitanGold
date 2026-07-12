/**
 * @jest-environment node
 */
import { describe, expect, it, jest, beforeEach } from '@jest/globals';

const mockQuery = jest.fn();
const mockRedis = {
  setEx: jest.fn(),
  get: jest.fn(),
  publish: jest.fn(),
  isOpen: true,
};

jest.unstable_mockModule('../../database/db.js', () => ({ query: mockQuery }));
jest.unstable_mockModule('../../utils/redis.js', () => ({
  getRedisClient: jest.fn(async () => mockRedis),
  isRedisAvailable: jest.fn(() => true),
}));
jest.unstable_mockModule('../../services/logger.js', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const runtime = await import('../../services/runtimeExecutionStateService.js');

describe('runtimeExecutionStateService', () => {
  beforeEach(() => {
    mockQuery.mockReset();
    mockRedis.setEx.mockReset();
    mockRedis.get.mockReset();
    mockRedis.publish.mockReset();
  });

  it('ensureDefaultRuntimeState persists demo + kill switch', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const state = await runtime.ensureDefaultRuntimeState();
    expect(state.globalMode).toBe('demo');
    expect(state.killSwitchActive).toBe(true);
    expect(mockQuery).toHaveBeenCalled();
  });

  it('getEffectiveGlobalMode returns demo when kill switch active', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{
        value: { globalMode: 'live', killSwitchActive: true, version: 2 },
        updated_at: new Date(),
      }],
    });
    const mode = await runtime.getEffectiveGlobalMode();
    expect(mode).toBe('demo');
  });

  it('activateKillSwitch publishes pub/sub event', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ value: { globalMode: 'demo', killSwitchActive: false, version: 1 }, updated_at: new Date() }],
    });
    mockQuery.mockResolvedValueOnce({ rows: [] });
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await runtime.activateKillSwitch('test', { userId: 'u1' });
    expect(mockRedis.publish).toHaveBeenCalled();
  });

  it('setGlobalRuntimeMode blocks live without confirmation endpoint', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ value: { globalMode: 'demo', killSwitchActive: true, version: 1 }, updated_at: new Date() }],
    });
    await expect(runtime.setGlobalRuntimeMode('live')).rejects.toMatchObject({ code: 'GLOBAL_LIVE_REQUIRES_CONFIRMATION' });
  });

  it('buildRuntimeView separates requested and effective mode', () => {
    const view = runtime.buildRuntimeView(
      { globalMode: 'demo', killSwitchActive: true, version: 3, workerAckRevision: 3, workerAckAt: 'x' },
      { requestedMode: 'live', providerConnected: false },
    );
    expect(view.requestedMode).toBe('live');
    expect(view.effectiveMode).toBe('demo');
    expect(view.workerAcknowledged).toBe(true);
  });
});
