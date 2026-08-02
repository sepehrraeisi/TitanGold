/**
 * @jest-environment node
 */
import { describe, expect, it } from '@jest/globals';
import {
  buildArbitrageIntegrationsDto,
  INTEGRATIONS_REASON_CODES,
  INTEGRATION_OPERATIONAL_STATE,
  INTEGRATION_VERIFICATION_STATE,
  MONITORING_STATE,
} from '../../services/arbitrageDomain.js';

describe('arbitrageCore integrations contract', () => {
  const baseContext = {
    product: {
      agentKey: 'arbitrage',
      displayName: 'MEXC Spot Spread Monitor',
    },
    settings: {
      monitoringState: MONITORING_STATE.ACTIVE,
      notificationPreference: false,
      notificationDeliveryAvailable: false,
      updatedAt: '2026-07-24T10:00:00.000Z',
      fields: {
        notificationPreference: { source: 'default' },
      },
    },
    schedulerRead: {
      status: {
        owner: 'titan-engine-worker',
        agentsEnabled: true,
        allowlist: ['arbitrage'],
        registeredJobs: ['arbitrage'],
        lastTickAt: '2026-07-24T10:05:00.000Z',
        lastSuccessAt: '2026-07-24T10:04:00.000Z',
        lastRun: { agentKey: 'arbitrage', completedAt: '2026-07-24T10:04:00.000Z' },
      },
      stale: false,
      source: 'worker-redis',
    },
    runtimeState: {
      globalMode: 'demo',
      killSwitchActive: true,
    },
    latestScanRow: {
      was_successful: true,
      created_at: '2026-07-24T10:04:00.000Z',
      output_data: {},
    },
    historicalSummary: {
      totalScanRuns: 5,
      latestSuccessfulRunAt: '2026-07-24T10:04:00.000Z',
    },
    redisConfigured: true,
    redisVerificationState: INTEGRATION_VERIFICATION_STATE.UNVERIFIED,
  };

  it('buildArbitrageIntegrationsDto exposes canonical top-level readiness fields', () => {
    const dto = buildArbitrageIntegrationsDto(baseContext);

    expect(dto.productId).toBe('arbitrage');
    expect(dto.dataContractVersion).toBe('1.0');
    expect(dto.publicDataReady).toBe(true);
    expect(dto.schedulingReady).toBe(true);
    expect(dto.persistenceReady).toBe(true);
    expect(dto.notificationDeliveryReady).toBe(false);
    expect(dto.executionReady).toBe(false);
    expect(Array.isArray(dto.items)).toBe(true);
    expect(dto.items.length).toBeGreaterThanOrEqual(9);
    expect(dto.limitations.length).toBeGreaterThan(0);
    expect(dto.availableActions.some(a => a.target === 'settings')).toBe(true);
  });

  it('public MEXC data does not imply private account access', () => {
    const dto = buildArbitrageIntegrationsDto(baseContext);
    const mexc = dto.items.find(i => i.id === 'mexc_public_market_data');
    const connections = dto.items.find(i => i.id === 'connections_private_mexc');

    expect(mexc?.technicalDetails?.credentialRequired).toBe(false);
    expect(mexc?.technicalDetails?.privateAccountIntegration).toBe(false);
    expect(mexc?.technicalDetails?.authorizesExecution).toBe(false);
    expect(connections?.operationalState).toBe(INTEGRATION_OPERATIONAL_STATE.NOT_REQUIRED);
    expect(connections?.requiredForMonitoring).toBe(false);
  });

  it('scheduler dimensions remain separate in technicalDetails', () => {
    const dto = buildArbitrageIntegrationsDto(baseContext);
    const scheduler = dto.items.find(i => i.id === 'scheduler');
    const dims = scheduler?.technicalDetails?.dimensions;

    expect(dims?.owner).toBe('titan-engine-worker');
    expect(dims?.registered).toBe(true);
    expect(dims?.allowlisted).toBe(true);
    expect(dims?.enabled).toBe(true);
    expect(dims?.lastTickAt).toBeTruthy();
  });

  it('redis unknown/unverified state fails closed without claiming healthy', () => {
    const dto = buildArbitrageIntegrationsDto({
      ...baseContext,
      redisConfigured: false,
      redisVerificationState: INTEGRATION_VERIFICATION_STATE.UNKNOWN,
    });
    const redis = dto.items.find(i => i.id === 'redis_scan_lock');

    expect(redis?.operationalState).toBe(INTEGRATION_OPERATIONAL_STATE.LIMITED);
    expect(redis?.verificationState).toBe(INTEGRATION_VERIFICATION_STATE.UNKNOWN);
    expect(redis?.reasonCode).toBe(INTEGRATIONS_REASON_CODES.REDIS_MEMORY_FALLBACK);
  });

  it('separates notification preference from delivery readiness', () => {
    const dto = buildArbitrageIntegrationsDto(baseContext);
    const pref = dto.items.find(i => i.id === 'notification_preference');
    const delivery = dto.items.find(i => i.id === 'notification_delivery');

    expect(pref?.category).toBe('notifications');
    expect(delivery?.operationalState).toBe(INTEGRATION_OPERATIONAL_STATE.UNAVAILABLE);
    expect(delivery?.technicalDetails?.deliveryOperational).toBe(false);
    expect(dto.notificationDeliveryReady).toBe(false);
  });

  it('execution blocked reasons include demo and emergency stop', () => {
    const dto = buildArbitrageIntegrationsDto(baseContext);
    const execution = dto.items.find(i => i.id === 'financial_execution');
    const reasons = execution?.technicalDetails?.blockedReasons;

    expect(execution?.operationalState).toBe(INTEGRATION_OPERATIONAL_STATE.BLOCKED);
    expect(reasons).toContain(INTEGRATIONS_REASON_CODES.EXECUTION_NOT_SUPPORTED);
    expect(reasons).toContain(INTEGRATIONS_REASON_CODES.EXECUTION_DEMO_RUNTIME);
    expect(reasons).toContain(INTEGRATIONS_REASON_CODES.EXECUTION_EMERGENCY_STOP);
    expect(dto.executionSupported).toBe(false);
  });

  it('sanitized output contains no secrets or connection strings', () => {
    const dto = buildArbitrageIntegrationsDto(baseContext);
    const serialized = JSON.stringify(dto);

    expect(serialized).not.toMatch(/postgres/i);
    expect(serialized).not.toMatch(/password/i);
    expect(serialized).not.toMatch(/api[_-]?secret/i);
    expect(serialized).not.toMatch(/jdbc:/i);
  });
});
