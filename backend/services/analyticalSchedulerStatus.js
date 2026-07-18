/**
 * Worker-authoritative analytical scheduler status.
 * Redis cache with TTL — not a second ownership of schedule config.
 * Owner process: titan-engine-worker.
 */

import { getRedisClient, isRedisAvailable } from '../utils/redis.js';
import { logger } from './logger.js';
import os from 'os';

export const REDIS_ANALYTICAL_SCHEDULER_STATUS_KEY = 'titan:scheduler:analytical_status';
/** Must exceed agents.interval (default 300s) so status remains fresh between ticks. */
export const ANALYTICAL_SCHEDULER_STATUS_TTL_SEC = 700;

/**
 * @typedef {object} AnalyticalSchedulerStatus
 * @property {string} owner
 * @property {number} pid
 * @property {string} host
 * @property {boolean} isRunning
 * @property {boolean} agentsEnabled
 * @property {string[]} allowlist
 * @property {string[]} registeredJobs
 * @property {string[]} activeIntervals
 * @property {boolean} emergencyStopSeparation
 * @property {string|null} lastTickAt
 * @property {string|null} lastSuccessAt
 * @property {string|null} lastFailureAt
 * @property {string|null} lastSkipReason
 * @property {object|null} lastRun
 * @property {string} updatedAt
 * @property {number} statusVersion
 */

export function buildEmptyStatus(overrides = {}) {
  return {
    owner: 'titan-engine-worker',
    pid: process.pid,
    host: os.hostname(),
    isRunning: false,
    agentsEnabled: false,
    allowlist: [],
    registeredJobs: [],
    activeIntervals: [],
    emergencyStopSeparation: false,
    lastTickAt: null,
    lastSuccessAt: null,
    lastFailureAt: null,
    lastSkipReason: null,
    lastRun: null,
    updatedAt: new Date().toISOString(),
    statusVersion: 1,
    ...overrides,
  };
}

export async function publishAnalyticalSchedulerStatus(status) {
  if (process.env.NODE_ENV === 'test') return;
  if (!isRedisAvailable()) return;
  try {
    const client = await getRedisClient();
    const payload = {
      ...status,
      updatedAt: new Date().toISOString(),
      pid: process.pid,
      host: os.hostname(),
      owner: 'titan-engine-worker',
    };
    await client.set(
      REDIS_ANALYTICAL_SCHEDULER_STATUS_KEY,
      JSON.stringify(payload),
      { EX: ANALYTICAL_SCHEDULER_STATUS_TTL_SEC },
    );
  } catch (err) {
    logger.warn('analytical_scheduler_status_publish_failed', { error: err.message });
  }
}

/**
 * @returns {Promise<{ status: AnalyticalSchedulerStatus|null, stale: boolean, source: string }>}
 */
export async function readAnalyticalSchedulerStatus() {
  if (!isRedisAvailable()) {
    return { status: null, stale: true, source: 'unavailable' };
  }
  try {
    const client = await getRedisClient();
    const raw = await client.get(REDIS_ANALYTICAL_SCHEDULER_STATUS_KEY);
    if (!raw) {
      return { status: null, stale: true, source: 'missing' };
    }
    const status = JSON.parse(raw);
    const updatedMs = Date.parse(status.updatedAt || '');
    const ageMs = Number.isFinite(updatedMs) ? Date.now() - updatedMs : Infinity;
    const stale = ageMs > ANALYTICAL_SCHEDULER_STATUS_TTL_SEC * 1000;
    return { status, stale, source: 'worker-redis' };
  } catch (err) {
    logger.warn('analytical_scheduler_status_read_failed', { error: err.message });
    return { status: null, stale: true, source: 'error' };
  }
}
