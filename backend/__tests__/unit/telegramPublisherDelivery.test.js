/**
 * DH-TELEGRAM-PUBLISHER-P1 — delivery path gates (dry-run / confirm / secrets).
 * @jest-environment node
 */
import { describe, expect, it, jest, beforeEach, afterEach } from '@jest/globals';

const mockQuery = jest.fn();

jest.unstable_mockModule('../../database/db.js', () => ({
  query: mockQuery,
}));

const mockFetch = jest.fn();
global.fetch = mockFetch;

const {
  isPublisherDryRunForced,
  runPublisherTest,
  runPublisherPublish,
} = await import('../../services/telegramPublisherService.js');

const PUBLISHER_ID = '887495e6-0b47-4450-88ef-35dd43477f9a';
const SOURCE_ID = '11111111-1111-4111-8111-111111111111';

const accessControl = {
  enforced: true,
  allowed: true,
  sourceId: SOURCE_ID,
  agentKey: 'publisher',
};

describe('telegramPublisherDelivery gates', () => {
  beforeEach(() => {
    mockQuery.mockReset();
    mockFetch.mockReset();
    delete process.env.TELEGRAM_PUBLISHER_FORCE_DRY_RUN;
    process.env.NODE_ENV = 'test';
  });

  afterEach(() => {
    delete process.env.TELEGRAM_PUBLISHER_DRY_RUN;
    delete process.env.TELEGRAM_PUBLISHER_FORCE_DRY_RUN;
  });

  it('isPublisherDryRunForced respects TELEGRAM_PUBLISHER_FORCE_DRY_RUN=true', () => {
    process.env.TELEGRAM_PUBLISHER_FORCE_DRY_RUN = 'true';
    expect(isPublisherDryRunForced()).toBe(true);
  });

  it('runPublisherTest records dry_run without calling Telegram API when forced', async () => {
    process.env.TELEGRAM_PUBLISHER_FORCE_DRY_RUN = 'true';
    mockQuery.mockImplementation(async (sql) => {
      const text = String(sql);
      if (text.includes('telegram_publisher_runtime_settings')) {
        return {
          rows: [{
            id: 'default',
            mode: 'live',
            is_live_enabled: true,
            live_test_expires_at: null,
            live_test_remaining_sends: 0,
            reason: 'test',
            created_at: new Date(),
            updated_at: new Date(),
            last_changed_at: new Date(),
          }],
        };
      }
      if (text.includes('FROM publisher_delivery_history')) {
        return { rows: [{ sent_today: 0, dry_runs_today: 0, failed_today: 0, last_telegram_delivery_at: null }] };
      }
      if (text.includes('SELECT * FROM telegram_publishers')) {
        return {
          rows: [{
            id: PUBLISHER_ID,
            is_active: true,
            template: '{message}',
            channel_id: '104595348',
            bot_token_encrypted: 'enc:token',
          }],
        };
      }
      if (text.includes('INSERT INTO publisher_delivery_history')) {
        return { rows: [{ id: 'hist-1' }] };
      }
      return { rows: [] };
    });

    const result = await runPublisherTest(PUBLISHER_ID, 'dry-run test', 'user-1');
    expect(result.dry_run).toBe(true);
    expect(result.status).toBe('dry_run');
    expect(result.telegram_message_id).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('runPublisherPublish rejects without confirm_publish', async () => {
    await expect(
      runPublisherPublish(PUBLISHER_ID, { message: 'x', source_id: SOURCE_ID }, 'user-1'),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('runPublisherPublish dry-run records history without telegram_message_id', async () => {
    process.env.TELEGRAM_PUBLISHER_FORCE_DRY_RUN = 'true';
    mockQuery.mockImplementation(async (sql) => {
      const text = String(sql);
      if (text.includes('telegram_publisher_runtime_settings')) {
        return {
          rows: [{
            id: 'default',
            mode: 'live',
            is_live_enabled: true,
            live_test_expires_at: null,
            live_test_remaining_sends: 0,
            reason: 'test',
            created_at: new Date(),
            updated_at: new Date(),
            last_changed_at: new Date(),
          }],
        };
      }
      if (text.includes('FROM publisher_delivery_history')) {
        return { rows: [{ sent_today: 0, dry_runs_today: 0, failed_today: 0, last_telegram_delivery_at: null }] };
      }
      if (text.includes('SELECT * FROM datahub_filter_rules')) return { rows: [] };
      if (text.includes('SELECT id FROM datahub_publisher_source_mappings')) {
        return { rows: [{ id: 'mapping-1' }] };
      }
      if (text.includes('SELECT * FROM telegram_publishers')) {
        return {
          rows: [{
            id: PUBLISHER_ID,
            is_active: true,
            template: '{message}',
            channel_id: '104595348',
            bot_token_encrypted: 'enc:token',
          }],
        };
      }
      if (text.includes('INSERT INTO publisher_delivery_history')) {
        return { rows: [{ id: 'hist-2' }] };
      }
      return { rows: [] };
    });

    const result = await runPublisherPublish(
      PUBLISHER_ID,
      {
        message: 'hello',
        confirm_publish: true,
        source_id: SOURCE_ID,
        content_type: 'manual',
        accessControl,
      },
      'user-1',
    );
    expect(result.dry_run).toBe(true);
    expect(result.telegram_message_id).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
