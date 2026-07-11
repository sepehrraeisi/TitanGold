/**
 * DH-NOTIFICATIONS-SETTINGS-P2 — route-level safety checks.
 * @jest-environment node
 */

import { jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';

const mockQuery = jest.fn();
const mockGetPreferences = jest.fn();
const mockUpdatePreferences = jest.fn();
const mockGetChannels = jest.fn();
const mockGetHistory = jest.fn();
const mockTestChannel = jest.fn();
const mockCreateEvent = jest.fn();

jest.unstable_mockModule('../../database/db.js', () => ({
  query: mockQuery,
  default: { query: mockQuery, pool: { connect: jest.fn() } },
  pool: { connect: jest.fn() },
}));

jest.unstable_mockModule('../../middleware/auth.js', () => ({
  authenticate: (req, _res, next) => {
    req.user = { id: 'user-1', role: req.headers['x-test-role'] || 'trader' };
    next();
  },
  authorize: (...roles) => (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  },
}));

jest.unstable_mockModule('../../middleware/rateLimits.js', () => ({
  preferencesLimiter: (_req, _res, next) => next(),
}));

jest.unstable_mockModule('../../services/logger.js', () => ({
  logger: {
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  },
}));

jest.unstable_mockModule('../../services/notificationService.js', () => ({
  NOTIFICATION_ERROR_CODES: {
    LIVE_CONFIRMATION_REQUIRED: 'LIVE_CONFIRMATION_REQUIRED',
    LIVE_NOT_SUPPORTED_YET: 'LIVE_NOT_SUPPORTED_YET',
  },
  getNotificationPreferences: mockGetPreferences,
  updateNotificationPreferences: mockUpdatePreferences,
  getNotificationChannels: mockGetChannels,
  getNotificationHistory: mockGetHistory,
  testNotificationChannel: mockTestChannel,
  createNotificationEvent: mockCreateEvent,
}));

const notificationsRouter = (await import('../../routes/notifications.js')).default;
const emailRouter = (await import('../../routes/email.js')).default;
const userPreferencesRouter = (await import('../../routes/userPreferences.js')).default;

function app() {
  const server = express();
  server.use(express.json());
  server.use('/api/v1/notifications', notificationsRouter);
  server.use('/api/v1/email', emailRouter);
  server.use('/api/v1/user-preferences', userPreferencesRouter);
  return server;
}

describe('notification routes safety', () => {
  beforeEach(() => {
    mockQuery.mockReset();
    mockGetPreferences.mockResolvedValue({ telegram_enabled: false, frequency_level: 'normal' });
    mockUpdatePreferences.mockResolvedValue({ telegram_enabled: true, frequency_level: 'normal' });
    mockGetChannels.mockResolvedValue({
      telegram: { configured: true, provider: 'telegram_publisher', publisherName: 'Safe Publisher' },
      browser: { enabled: false },
      email: { status: 'coming_soon' },
    });
    mockGetHistory.mockResolvedValue({ notifications: [], total: 0, limit: 50, offset: 0 });
    mockTestChannel.mockResolvedValue({ success: true, status: 'dry_run', dry_run: true });
    mockCreateEvent.mockResolvedValue({ success: true, status: 'dry_run', dry_run: true });
    mockQuery.mockResolvedValue({ rows: [{ count: 0 }] });
  });

  test('new preferences/channels/history/test endpoints are wired and safe', async () => {
    mockGetPreferences.mockResolvedValue({
      telegram_enabled: false,
      browser_enabled: true,
      frequency_level: 'normal',
      browser: { enabled: true, updated_at: '2026-06-20T00:00:00.000Z' },
    });
    mockUpdatePreferences.mockResolvedValue({
      telegram_enabled: true,
      browser_enabled: true,
      frequency_level: 'normal',
      browser: { enabled: true, updated_at: '2026-06-20T00:00:00.000Z' },
    });

    const preferencesResult = await request(app()).get('/api/v1/notifications/preferences').expect(200);
    await request(app()).put('/api/v1/notifications/preferences').send({ bot_token: 'secret' }).expect(200);
    await request(app()).put('/api/v1/notifications/preferences').send({ browser_enabled: true }).expect(200);
    await request(app()).get('/api/v1/notifications/channels').expect(200);
    await request(app()).get('/api/v1/notifications/history').expect(200);
    const testResult = await request(app()).post('/api/v1/notifications/test').send({ channel: 'telegram' }).expect(200);

    expect(preferencesResult.body.preferences.browser_enabled).toBe(true);
    expect(preferencesResult.body.preferences.browser).toEqual({
      enabled: true,
      updated_at: '2026-06-20T00:00:00.000Z',
    });
    expect(testResult.body.status).toBe('dry_run');
    expect(mockUpdatePreferences).toHaveBeenCalledWith('user-1', { bot_token: 'secret' });
    expect(mockUpdatePreferences).toHaveBeenCalledWith('user-1', { browser_enabled: true });
    expect(mockTestChannel).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1', channel: 'telegram', dryRun: true, confirmLive: false }),
    );
  });

  test('broadcast is admin-only and live mode is unsupported', async () => {
    await request(app()).post('/api/v1/notifications/broadcast').send({ dry_run: true }).expect(403);
    const dryRun = await request(app())
      .post('/api/v1/notifications/broadcast')
      .set('x-test-role', 'admin')
      .send({ dry_run: true })
      .expect(200);
    expect(dryRun.body.dry_run).toBe(true);

    const live = await request(app())
      .post('/api/v1/notifications/broadcast')
      .set('x-test-role', 'admin')
      .send({ dry_run: false, confirm_live: true })
      .expect(400);
    expect(live.body.code).toBe('LIVE_NOT_SUPPORTED_YET');
  });

  test('email test/send are dry-run by default and live unsupported', async () => {
    const dryRun = await request(app()).post('/api/v1/email/send').send({}).expect(200);
    expect(dryRun.body.dry_run).toBe(true);

    const live = await request(app())
      .post('/api/v1/email/test')
      .send({ dry_run: false, confirm_live: true })
      .expect(400);
    expect(live.body.code).toBe('LIVE_NOT_SUPPORTED_YET');
  });

  test('legacy telegram settings endpoint no longer accepts bot tokens', async () => {
    await request(app())
      .put('/api/v1/user-preferences/telegram')
      .send({ botToken: 'secret', chatId: '123', enabled: true })
      .expect(400);

    const dryRun = await request(app())
      .post('/api/v1/user-preferences/telegram/test')
      .send({})
      .expect(200);
    expect(dryRun.body.status).toBe('dry_run');
    expect(mockTestChannel).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1', channel: 'telegram', dryRun: true }),
    );
  });
});
