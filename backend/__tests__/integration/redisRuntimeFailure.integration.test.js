/**
 * Redis failure-mode integration tests for runtime SSOT
 * @jest-environment node
 */
import { describe, expect, it, jest, beforeEach } from '@jest/globals';

const mockQuery = jest.fn();
const mockRedisGet = jest.fn();
const mockRedisSet = jest.fn();
const mockPublish = jest.fn();
let redisAvailable = true;
let redisGetThrows = false;

jest.unstable_mockModule('../../database/db.js', () => ({ query: mockQuery }));
jest.unstable_mockModule('../../services/logger.js', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));
jest.unstable_mockModule('../../utils/redis.js', () => ({
  isRedisAvailable: () => redisAvailable,
  getRedisClient: jest.fn(async () => ({
    get: (...args) => {
      if (redisGetThrows) throw new Error('Redis unavailable');
      return mockRedisGet(...args);
    },
    setEx: mockRedisSet,
    publish: mockPublish,
    duplicate: jest.fn(async () => ({
      connect: jest.fn(),
      subscribe: jest.fn(),
    })),
  })),
}));

const svc = await import('../../services/runtimeExecutionStateService.js');

const PG_STATE = {
  globalMode: 'demo',
  killSwitchActive: true,
  version: 5,
  workerAckRevision: 5,
  workerAckAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

describe('Redis failure-mode runtime SSOT', () => {
  beforeEach(() => {
    mockQuery.mockReset();
    mockRedisGet.mockReset();
    mockRedisSet.mockReset();
    redisAvailable = true;
    redisGetThrows = false;
    mockQuery.mockResolvedValue({
      rows: [{ value: PG_STATE, updated_at: new Date() }],
    });
  });

  it('PostgreSQL wins when Redis has stale live mode', async () => {
    mockRedisGet.mockResolvedValue(JSON.stringify({ globalMode: 'live', killSwitchActive: false, version: 3 }));
    const state = await svc.getRuntimeExecutionState({ preferCache: true });
    expect(state.killSwitchActive).toBe(true);
    expect(state.globalMode).toBe('demo');
  });

  it('PostgreSQL wins when Redis has invalid JSON', async () => {
    mockRedisGet.mockResolvedValue('not-json{{{');
    const state = await svc.getRuntimeExecutionState({ preferCache: true });
    expect(state.killSwitchActive).toBe(true);
  });

  it('falls back to PG when Redis unavailable', async () => {
    redisAvailable = false;
    redisGetThrows = true;
    const state = await svc.getRuntimeExecutionState({ preferCache: true });
    expect(state.killSwitchActive).toBe(true);
    expect(mockQuery).toHaveBeenCalled();
  });

  it('missing PG row initializes safe defaults', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    mockQuery.mockResolvedValueOnce({ rows: [{ value: { ...PG_STATE, killSwitchActive: true }, updated_at: new Date() }] });
    const state = await svc.ensureDefaultRuntimeState();
    expect(state.killSwitchActive).toBe(true);
    expect(state.globalMode).toBe('demo');
  });

  it('getEffectiveGlobalMode returns demo when kill switch active', async () => {
    mockQuery.mockResolvedValue({
      rows: [{ value: { ...PG_STATE, globalMode: 'live', killSwitchActive: true }, updated_at: new Date() }],
    });
    const mode = await svc.getEffectiveGlobalMode();
    expect(mode).toBe('demo');
  });

  it('buildRuntimeView marks worker ack when revision matches', async () => {
    const view = svc.buildRuntimeView(PG_STATE);
    expect(view.workerAcknowledged).toBe(true);
    expect(view.effectiveMode).toBe('demo');
  });

  it('older Redis version does not weaken kill switch', async () => {
    mockRedisGet.mockResolvedValue(JSON.stringify({ globalMode: 'live', killSwitchActive: false, version: 1 }));
    mockQuery.mockResolvedValue({
      rows: [{ value: { ...PG_STATE, killSwitchActive: true, version: 10 }, updated_at: new Date() }],
    });
    const state = await svc.getRuntimeExecutionState({ preferCache: false });
    expect(state.killSwitchActive).toBe(true);
  });

  it('invalid newer revision is ignored — PG authoritative', async () => {
    mockRedisGet.mockResolvedValue(JSON.stringify({ globalMode: 'live', killSwitchActive: false, version: 99999 }));
    const state = await svc.getRuntimeExecutionState({ preferCache: true });
    expect(state.killSwitchActive).toBe(true);
    expect(state.globalMode).toBe('demo');
  });

  it('stale runtime value with kill switch off in Redis still fails closed', async () => {
    mockRedisGet.mockResolvedValue(JSON.stringify({ globalMode: 'demo', killSwitchActive: false, version: 5 }));
    const state = await svc.getRuntimeExecutionState({ preferCache: true });
    expect(state.killSwitchActive).toBe(true);
  });

  it('Redis get throws — falls back to PostgreSQL', async () => {
    redisGetThrows = true;
    const state = await svc.getRuntimeExecutionState({ preferCache: true });
    expect(state.killSwitchActive).toBe(true);
    expect(mockQuery).toHaveBeenCalled();
  });
});
