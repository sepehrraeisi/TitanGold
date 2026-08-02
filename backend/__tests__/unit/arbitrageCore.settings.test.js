/**
 * @jest-environment node
 */
import { describe, expect, it } from '@jest/globals';
import {
  buildSettingsDto,
  validateSettingsInput,
  SETTINGS_DEFAULTS,
  FIELD_SOURCES,
} from '../../services/arbitrageDomain.js';

describe('arbitrageCore settings contract', () => {
  it('buildSettingsDto marks configured vs default field sources from raw config', () => {
    const dto = buildSettingsDto({
      symbols: ['BTCUSDT', 'ETHUSDT'],
      opportunityThresholdBps: 25,
      feeBps: 12,
      slippageBps: 8,
      settingsVersion: 3,
    });

    expect(dto.minimumNetSpreadBps).toBe(25);
    expect(dto.fields.monitoredSymbols.source).toBe(FIELD_SOURCES.CONFIGURED);
    expect(dto.fields.minimumNetSpreadBps.source).toBe(FIELD_SOURCES.CONFIGURED);
    expect(dto.fields.assumedFeesBps.effective).toBe(12);
    expect(dto.fields.minimumGrossSpreadBps.reasonCode).toBe('engine_threshold_read_only');
    expect(dto.fields.scanIntervalSeconds.readOnly).toBe(true);
    expect(dto.fields.autoExecute.supported).toBe(false);
    expect(dto.executionSupported).toBe(false);
  });

  it('buildSettingsDto applies defaults with explicit source metadata', () => {
    const dto = buildSettingsDto({});
    expect(dto.monitoredSymbols).toEqual(SETTINGS_DEFAULTS.monitoredSymbols);
    expect(dto.fields.monitoredSymbols.source).toBe(FIELD_SOURCES.DEFAULT);
    expect(dto.fields.minimumNetSpreadBps.source).toBe(FIELD_SOURCES.DEFAULT);
    expect(dto.notificationDeliveryAvailable).toBe(false);
  });

  it('buildSettingsDto normalizes legacy autoExecute to blocked effective false', () => {
    const dto = buildSettingsDto({
      symbols: ['BTCUSDT'],
      execution: { autoExecute: true },
      autoTrade: true,
    });

    expect(dto.legacyExecutionPreferenceIgnored).toBe(true);
    expect(dto.fields.autoExecute.effective).toBe(false);
    expect(dto.fields.autoExecute.source).toBe(FIELD_SOURCES.LEGACY_NORMALIZED);
  });

  it('validateSettingsInput rejects unknown and forbidden fields', () => {
    const result = validateSettingsInput({
      monitoredSymbols: ['BTCUSDT'],
      apiSecret: 'secret',
      monitoringState: 'paused',
      unknownField: true,
    });

    expect(result.ok).toBe(false);
    expect(result.codes).toContain('FORBIDDEN_FIELD');
    expect(result.codes).toContain('UNKNOWN_FIELD');
  });

  it('validateSettingsInput rejects invalid numerics and symbol issues', () => {
    const dup = validateSettingsInput({
      monitoredSymbols: ['BTCUSDT', 'BTCUSDT'],
    });
    expect(dup.ok).toBe(false);
    expect(dup.codes).toContain('SYMBOLS_DUPLICATE');

    const net = validateSettingsInput({
      monitoredSymbols: ['BTCUSDT'],
      minimumNetSpreadBps: 5,
      assumedFeesBps: 10,
      assumedSlippageBps: 10,
    });
    expect(net.ok).toBe(false);
    expect(net.codes).toContain('NET_SPREAD_TOO_LOW');

    const nan = validateSettingsInput({
      monitoredSymbols: ['BTCUSDT'],
      assumedFeesBps: Number.NaN,
    });
    expect(nan.ok).toBe(false);
    expect(nan.codes).toContain('NUMERIC_INVALID');
  });

  it('validateSettingsInput rejects autoExecute writes', () => {
    const result = validateSettingsInput({
      monitoredSymbols: ['BTCUSDT'],
      execution: { autoExecute: true },
    });
    expect(result.ok).toBe(false);
    expect(result.codes).toContain('AUTO_EXECUTE_BLOCKED');
  });
});
