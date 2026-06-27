/**
 * DH-NOTIFICATIONS-SETTINGS-P2 — unified notification center safety.
 * @jest-environment node
 */

import { jest } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const mockQuery = jest.fn();
const mockEnforceSourceAccess = jest.fn();
const mockEnforcePublishingPolicy = jest.fn();
let scenario = 'configured';

jest.unstable_mockModule('../../database/db.js', () => ({
  query: mockQuery,
}));

jest.unstable_mockModule('../../middleware/accessControlGateway.js', () => ({
  enforceSourceAccess: mockEnforceSourceAccess,
  RUNTIME_AGENT_KEYS: { PUBLISHER: 'publisher' },
}));

jest.unstable_mockModule('../../services/filterRulesGateway.js', () => ({
  enforcePublishingPolicy: mockEnforcePublishingPolicy,
  isFilterRuleBlockedError: error => error?.code === 'FILTER_RULE_BLOCKED',
}));

jest.unstable_mockModule('../../services/logger.js', () => ({
  logger: {
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  },
}));

const {
  getNotificationPreferences,
  updateNotificationPreferences,
  getNotificationChannels,
  testNotificationChannel,
  createNotificationEvent,
} = await import('../../services/notificationService.js');

function historyRow(overrides = {}) {
  return {
    id: 7,
    user_id: 'user-1',
    channel: 'telegram',
    message_type: 'test',
    title: 'Notification Test',
    message: 'Notification channel test',
    message_preview: 'Notification channel test',
    status: 'dry_run',
    dry_run: true,
    source_id: null,
    publisher_id: 'pub-1',
    destination_masked: '@cha***',
    error_code: null,
    error_message: null,
    metadata: {},
    created_at: new Date('2026-06-20T00:00:00Z'),
    read_at: null,
    ...overrides,
  };
}

function publisherRow() {
  return {
    id: 'pub-1',
    name: 'Safe Publisher',
    channel_id: '@channel',
    channel_username: '@channel',
    channel_title: 'Channel',
    is_active: true,
    bot_token_encrypted: 'encrypted',
  };
}

function mockDb() {
  mockQuery.mockImplementation(async sql => {
    const text = String(sql);
    if (text.includes('FROM notification_preferences')) return { rows: [] };
    if (text.includes('INSERT INTO notification_preferences')) {
      return {
        rows: [{
          telegram_enabled: true,
          browser_enabled: true,
          email_enabled: false,
          quiet_hours_enabled: true,
          quiet_hours_start: '21:00:00',
          quiet_hours_end: '07:00:00',
          do_not_disturb_enabled: true,
          frequency_level: 'normal',
          updated_at: new Date('2026-06-20T00:00:00Z'),
        }],
      };
    }
    if (text.includes('FROM datahub_publisher_source_mappings')) {
      return scenario === 'missing-mapping' ? { rows: [] } : { rows: [publisherRow()] };
    }
    if (text.includes('FROM telegram_publishers')) {
      return scenario === 'not-configured' ? { rows: [] } : { rows: [publisherRow()] };
    }
    if (text.includes('INSERT INTO notification_history')) return { rows: [historyRow()] };
    if (text.includes('SELECT *') && text.includes('FROM notification_history')) return { rows: [] };
    if (text.includes('COUNT(*)::int AS count')) return { rows: [{ count: 0 }] };
    return { rows: [] };
  });
}

describe('notificationService safety', () => {
  beforeEach(() => {
    scenario = 'configured';
    mockQuery.mockReset();
    mockEnforceSourceAccess.mockReset();
    mockEnforcePublishingPolicy.mockReset();
    mockEnforceSourceAccess.mockResolvedValue({ allowed: true, reason: 'allowed' });
    mockEnforcePublishingPolicy.mockResolvedValue({ allowed: true });
    mockDb();
  });

  test('GET preferences returns safe defaults without secrets', async () => {
    const preferences = await getNotificationPreferences('user-1');

    expect(preferences).toMatchObject({
      telegram_enabled: false,
      browser_enabled: false,
      frequency_level: 'normal',
    });
    expect(JSON.stringify(preferences)).not.toMatch(/botToken|bot_token|chatId|chat_id/i);
  });

  test('PUT preferences saves only allowed fields', async () => {
    const preferences = await updateNotificationPreferences('user-1', {
      telegram_enabled: true,
      browser_enabled: true,
      browser: { enabled: true },
      email_enabled: true,
      quiet_hours_enabled: true,
      quiet_hours_start: '21:00',
      quiet_hours_end: '07:00',
      do_not_disturb_enabled: true,
      frequency_level: 'urgent',
      bot_token: 'secret',
    });

    expect(preferences.frequency_level).toBe('normal');
    expect(preferences.browser_enabled).toBe(true);
    expect(preferences.browser).toEqual({
      enabled: true,
      updated_at: '2026-06-20T00:00:00.000Z',
    });
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO notification_preferences'),
      expect.not.arrayContaining(['secret']),
    );
  });

  test('GET preferences returns browser preference view', async () => {
    mockQuery.mockImplementationOnce(async () => ({
      rows: [{
        telegram_enabled: false,
        browser_enabled: true,
        email_enabled: false,
        quiet_hours_enabled: false,
        quiet_hours_start: '22:00:00',
        quiet_hours_end: '08:00:00',
        do_not_disturb_enabled: false,
        frequency_level: 'normal',
        updated_at: new Date('2026-06-20T00:00:00Z'),
      }],
    }));

    const preferences = await getNotificationPreferences('user-1');

    expect(preferences.browser_enabled).toBe(true);
    expect(preferences.browser).toEqual({
      enabled: true,
      updated_at: '2026-06-20T00:00:00.000Z',
    });
  });

  test('GET channels returns persisted browser preference state', async () => {
    mockQuery.mockImplementationOnce(async () => ({
      rows: [{
        telegram_enabled: false,
        browser_enabled: true,
        email_enabled: false,
        quiet_hours_enabled: false,
        quiet_hours_start: '22:00:00',
        quiet_hours_end: '08:00:00',
        do_not_disturb_enabled: false,
        frequency_level: 'normal',
        updated_at: new Date('2026-06-20T00:00:00Z'),
      }],
    }));

    const channels = await getNotificationChannels('user-1');

    expect(channels.browser).toEqual({
      status: 'enabled',
      configured: true,
      enabled: true,
    });
  });

  test('Telegram test defaults to dry-run and writes notification history', async () => {
    const result = await testNotificationChannel({ userId: 'user-1', channel: 'telegram' });

    expect(result.status).toBe('dry_run');
    expect(result.dry_run).toBe(true);
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO notification_history'),
      expect.arrayContaining(['telegram', 'test', 'dry_run', true]),
    );
  });

  test('live test without confirm throws before any send path', async () => {
    await expect(
      testNotificationChannel({
        userId: 'user-1',
        channel: 'telegram',
        dryRun: false,
        confirmLive: false,
      }),
    ).rejects.toMatchObject({ code: 'LIVE_CONFIRMATION_REQUIRED', status: 400 });
  });

  test('email live with confirm is explicitly unsupported', async () => {
    await expect(
      testNotificationChannel({
        userId: 'user-1',
        channel: 'email',
        dryRun: false,
        confirmLive: true,
      }),
    ).rejects.toMatchObject({ code: 'LIVE_NOT_SUPPORTED_YET', status: 400 });
  });

  test('source-derived Telegram notifications enforce ACL, filter, and mapping', async () => {
    await createNotificationEvent({
      userId: 'user-1',
      channel: 'telegram',
      messageType: 'source_alert',
      title: 'Source alert',
      message: 'source-derived payload',
      sourceId: 'source-1',
      dryRun: true,
    });

    expect(mockEnforceSourceAccess).toHaveBeenCalledWith(
      null,
      expect.objectContaining({ sourceId: 'source-1', agentKey: 'publisher' }),
    );
    expect(mockEnforcePublishingPolicy).toHaveBeenCalledWith(
      expect.objectContaining({ sourceId: 'source-1', enforcementPath: 'notification_service' }),
    );
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('FROM datahub_publisher_source_mappings'),
      ['source-1'],
    );
  });

  test('missing publisher mapping records skipped/blocked history', async () => {
    scenario = 'missing-mapping';

    const result = await createNotificationEvent({
      userId: 'user-1',
      channel: 'telegram',
      messageType: 'source_alert',
      title: 'Source alert',
      message: 'source-derived payload',
      sourceId: 'source-1',
      dryRun: true,
    });

    expect(result.success).toBe(false);
    expect(result.code).toBe('PUBLISHER_MAPPING_REQUIRED');
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO notification_history'),
      expect.arrayContaining(['skipped', true, 'source-1', null, null, 'PUBLISHER_MAPPING_REQUIRED']),
    );
  });

  test('ACL blocked source-derived notification records blocked history', async () => {
    mockEnforceSourceAccess.mockResolvedValueOnce({ allowed: false, reason: 'blocked_by_acl' });

    const result = await createNotificationEvent({
      userId: 'user-1',
      channel: 'telegram',
      messageType: 'source_alert',
      title: 'Source alert',
      message: 'source-derived payload',
      sourceId: 'source-1',
      dryRun: true,
    });

    expect(result.success).toBe(false);
    expect(result.code).toBe('SOURCE_ACCESS_DENIED');
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO notification_history'),
      expect.arrayContaining(['blocked', true, 'source-1', null, null, 'SOURCE_ACCESS_DENIED']),
    );
  });

  test('filter blocked source-derived notification records blocked history', async () => {
    const error = new Error('blocked by filter');
    error.code = 'FILTER_RULE_BLOCKED';
    mockEnforcePublishingPolicy.mockRejectedValueOnce(error);

    const result = await createNotificationEvent({
      userId: 'user-1',
      channel: 'telegram',
      messageType: 'source_alert',
      title: 'Source alert',
      message: 'source-derived payload',
      sourceId: 'source-1',
      dryRun: true,
    });

    expect(result.success).toBe(false);
    expect(result.code).toBe('FILTER_RULE_BLOCKED');
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO notification_history'),
      expect.arrayContaining(['blocked', true, 'source-1', null, null, 'FILTER_RULE_BLOCKED']),
    );
  });

  test('favorite alert monitor no longer imports Telegram Bot API', () => {
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const monitorPath = path.resolve(__dirname, '../../services/favoritesAlertMonitor.js');
    const source = fs.readFileSync(monitorPath, 'utf8');

    expect(source).not.toMatch(/node-telegram-bot-api|new TelegramBot|sendMessage\(/);
    expect(source).toMatch(/createNotificationEvent/);
  });
});
