/**
 * @jest-environment node
 */
import { describe, expect, test } from '@jest/globals';
import {
  isFetchTimeoutIndicator,
  resolveFetchPathPipelineStatus,
} from '../../services/pipelineSourceQualityStatus.js';
import { mapCollectorOperationalToPipelineStatus } from '../../services/telegramCollectorSourceStatus.js';

describe('pipelineSourceQualityStatus (DH-PIPELINE-FIX-3)', () => {
  describe('resolveFetchPathPipelineStatus', () => {
    test('inactive source', () => {
      expect(resolveFetchPathPipelineStatus({ is_active: false })).toBe('inactive');
    });

    test('processed collected_data → success', () => {
      expect(resolveFetchPathPipelineStatus({ is_active: true, status: 'processed' })).toBe('success');
    });

    test('pending collected_data → pending_normalization', () => {
      expect(resolveFetchPathPipelineStatus({ is_active: true, status: 'pending' })).toBe(
        'pending_normalization',
      );
    });

    test('error collected_data → fetch_error', () => {
      expect(resolveFetchPathPipelineStatus({ is_active: true, status: 'error' })).toBe('fetch_error');
    });

    test('no collected_data + last_status success → no_data', () => {
      expect(
        resolveFetchPathPipelineStatus({
          is_active: true,
          status: null,
          ds_last_status: 'success',
        }),
      ).toBe('no_data');
    });

    test('no collected_data + last_status error → fetch_error', () => {
      expect(
        resolveFetchPathPipelineStatus({
          is_active: true,
          status: null,
          ds_last_status: 'error',
        }),
      ).toBe('fetch_error');
    });

    test('no collected_data + timeout message → fetch_timeout', () => {
      expect(
        resolveFetchPathPipelineStatus({
          is_active: true,
          status: null,
          ds_last_status: 'error',
          log_message: 'Connection timed out (10s limit)',
        }),
      ).toBe('fetch_timeout');
    });
  });

  describe('isFetchTimeoutIndicator', () => {
    test('detects ETIMEDOUT in message', () => {
      expect(isFetchTimeoutIndicator({ logMessage: 'connect ETIMEDOUT' })).toBe(true);
    });

    test('does not flag generic errors', () => {
      expect(isFetchTimeoutIndicator({ logMessage: '404 Not Found' })).toBe(false);
    });
  });

  describe('mapCollectorOperationalToPipelineStatus', () => {
    test('maps collector operational states', () => {
      expect(mapCollectorOperationalToPipelineStatus('active')).toBe('collector_active');
      expect(mapCollectorOperationalToPipelineStatus('pending')).toBe('collector_pending');
      expect(mapCollectorOperationalToPipelineStatus('linked')).toBe('collector_linked');
      expect(mapCollectorOperationalToPipelineStatus('error')).toBe('collector_error');
    });
  });
});
