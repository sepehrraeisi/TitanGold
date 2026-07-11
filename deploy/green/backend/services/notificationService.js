import { query } from '../database/db.js';
import { logger } from './logger.js';
import { enforceSourceAccess, RUNTIME_AGENT_KEYS } from '../middleware/accessControlGateway.js';
import { enforcePublishingPolicy, isFilterRuleBlockedError } from './filterRulesGateway.js';

const ALLOWED_FREQUENCIES = new Set(['low', 'normal', 'high']);
const ALLOWED_CHANNELS = new Set(['telegram', 'browser', 'email', 'system']);
const HISTORY_LIMIT_MAX = 200;

export const NOTIFICATION_ERROR_CODES = {
  LIVE_CONFIRMATION_REQUIRED: 'LIVE_CONFIRMATION_REQUIRED',
  LIVE_NOT_SUPPORTED_YET: 'LIVE_NOT_SUPPORTED_YET',
  PUBLISHER_MAPPING_REQUIRED: 'PUBLISHER_MAPPING_REQUIRED',
  SOURCE_ACCESS_DENIED: 'SOURCE_ACCESS_DENIED',
  FILTER_RULE_BLOCKED: 'FILTER_RULE_BLOCKED',
  TELEGRAM_NOT_CONFIGURED: 'TELEGRAM_NOT_CONFIGURED',
  EMAIL_NOT_CONFIGURED: 'EMAIL_NOT_CONFIGURED',
  INVALID_CHANNEL: 'INVALID_CHANNEL',
};

const DEFAULT_PREFERENCES = {
  telegram_enabled: false,
  browser_enabled: false,
  email_enabled: false,
  quiet_hours_enabled: false,
  quiet_hours_start: '22:00',
  quiet_hours_end: '08:00',
  do_not_disturb_enabled: false,
  frequency_level: 'normal',
};

function toBool(value, fallback = false) {
  if (value === undefined || value === null) return fallback;
  return Boolean(value);
}

function normalizeTime(value, fallback) {
  if (!value) return fallback;
  const str = String(value).slice(0, 5);
  return /^\d{2}:\d{2}$/.test(str) ? str : fallback;
}

function sanitizePreferences(preferences = {}) {
  const frequency = ALLOWED_FREQUENCIES.has(preferences.frequency_level)
    ? preferences.frequency_level
    : DEFAULT_PREFERENCES.frequency_level;

  return {
    telegram_enabled: toBool(preferences.telegram_enabled, DEFAULT_PREFERENCES.telegram_enabled),
    browser_enabled: toBool(preferences.browser_enabled, DEFAULT_PREFERENCES.browser_enabled),
    email_enabled: toBool(preferences.email_enabled, DEFAULT_PREFERENCES.email_enabled),
    quiet_hours_enabled: toBool(preferences.quiet_hours_enabled, DEFAULT_PREFERENCES.quiet_hours_enabled),
    quiet_hours_start: normalizeTime(preferences.quiet_hours_start, DEFAULT_PREFERENCES.quiet_hours_start),
    quiet_hours_end: normalizeTime(preferences.quiet_hours_end, DEFAULT_PREFERENCES.quiet_hours_end),
    do_not_disturb_enabled: toBool(preferences.do_not_disturb_enabled, DEFAULT_PREFERENCES.do_not_disturb_enabled),
    frequency_level: frequency,
  };
}

function mapPreferencesRow(row) {
  if (!row) return { ...DEFAULT_PREFERENCES, is_default: true };
  return {
    telegram_enabled: row.telegram_enabled === true,
    browser_enabled: row.browser_enabled === true,
    email_enabled: row.email_enabled === true,
    quiet_hours_enabled: row.quiet_hours_enabled === true,
    quiet_hours_start: row.quiet_hours_start ? String(row.quiet_hours_start).slice(0, 5) : DEFAULT_PREFERENCES.quiet_hours_start,
    quiet_hours_end: row.quiet_hours_end ? String(row.quiet_hours_end).slice(0, 5) : DEFAULT_PREFERENCES.quiet_hours_end,
    do_not_disturb_enabled: row.do_not_disturb_enabled === true,
    frequency_level: row.frequency_level || DEFAULT_PREFERENCES.frequency_level,
    updated_at: row.updated_at ? new Date(row.updated_at).toISOString() : null,
    is_default: false,
  };
}

function maskDestination(destination) {
  if (!destination) return null;
  const value = String(destination).trim();
  if (!value) return null;
  if (value.startsWith('@')) {
    const body = value.slice(1);
    return body.length <= 3 ? '@***' : `@${body.slice(0, 3)}***`;
  }
  const last4 = value.replace(/\D/g, '').slice(-4) || value.slice(-4);
  return `****${last4}`;
}

function mapHistoryRow(row) {
  return {
    id: row.id,
    user_id: row.user_id,
    channel: row.channel || row.data?.channel || row.type,
    message_type: row.message_type || row.type,
    title: row.title,
    message_preview: row.message_preview || row.message?.slice(0, 500),
    status: row.status || 'sent',
    dry_run: row.dry_run === true,
    source_id: row.source_id || null,
    publisher_id: row.publisher_id || null,
    destination_masked: row.destination_masked || null,
    error_code: row.error_code || null,
    error_message: row.error_message || null,
    metadata: row.metadata || row.data || {},
    created_at: row.created_at ? new Date(row.created_at).toISOString() : null,
    read_at: row.read_at ? new Date(row.read_at).toISOString() : null,
  };
}

function notificationError(message, code, status = 400) {
  const err = new Error(message);
  err.code = code;
  err.status = status;
  return err;
}

async function selectDefaultTelegramPublisher() {
  const result = await query(
    `SELECT id, name, channel_id, channel_username, channel_title, is_active, bot_token_encrypted
     FROM telegram_publishers
     WHERE is_active = true
     ORDER BY updated_at DESC, created_at DESC
     LIMIT 1`,
  );
  return result.rows[0] || null;
}

async function selectMappedTelegramPublisher(sourceId) {
  const result = await query(
    `SELECT
       tp.id,
       tp.name,
       tp.channel_id,
       tp.channel_username,
       tp.channel_title,
       tp.is_active,
       tp.bot_token_encrypted
     FROM datahub_publisher_source_mappings m
     JOIN telegram_publishers tp ON tp.id = m.publisher_id
     WHERE m.source_id = $1
       AND m.is_enabled = true
       AND tp.is_active = true
     ORDER BY m.updated_at DESC, tp.updated_at DESC
     LIMIT 1`,
    [sourceId],
  );
  return result.rows[0] || null;
}

async function enforceSourceDerivedDelivery(event) {
  if (!event.source_id) return { publisher: null };

  const publisher = event.channel === 'telegram'
    ? await selectMappedTelegramPublisher(event.source_id)
    : null;

  if (event.channel === 'telegram' && !publisher) {
    throw notificationError(
      'Source is not mapped to an active Telegram Publisher',
      NOTIFICATION_ERROR_CODES.PUBLISHER_MAPPING_REQUIRED,
      403,
    );
  }

  const access = await enforceSourceAccess(null, {
    sourceId: event.source_id,
    agentKey: RUNTIME_AGENT_KEYS.PUBLISHER,
    userId: event.user_id,
    action: 'notification_delivery',
    dataType: event.data_type || event.message_type || null,
  });

  if (!access.allowed) {
    throw notificationError(
      access.reason || 'Source access denied by ACL',
      NOTIFICATION_ERROR_CODES.SOURCE_ACCESS_DENIED,
      403,
    );
  }

  await enforcePublishingPolicy({
    sourceId: event.source_id,
    message: event.message,
    text: event.message,
    dataType: event.data_type || event.message_type || null,
    metadata: event.metadata,
    userId: event.user_id,
    enforcementPath: 'notification_service',
  });

  return { publisher };
}

async function insertHistory({
  userId,
  channel,
  messageType,
  title,
  message,
  status,
  dryRun,
  sourceId = null,
  publisherId = null,
  destinationMasked = null,
  errorCode = null,
  errorMessage = null,
  metadata = {},
}) {
  const preview = String(message || title || '').slice(0, 500);
  const result = await query(
    `INSERT INTO notification_history (
       user_id, type, category, title, message, data,
       channel, message_type, message_preview, status, dry_run,
       source_id, publisher_id, destination_masked, error_code, error_message, metadata
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
     RETURNING *`,
    [
      userId,
      messageType,
      messageType,
      String(title || 'Notification').slice(0, 255),
      String(message || title || ''),
      JSON.stringify(metadata || {}),
      channel,
      messageType,
      preview,
      status,
      Boolean(dryRun),
      sourceId || null,
      publisherId || null,
      destinationMasked || null,
      errorCode || null,
      errorMessage || null,
      JSON.stringify(metadata || {}),
    ],
  );
  return mapHistoryRow(result.rows[0]);
}

export async function getNotificationPreferences(userId) {
  const result = await query(
    `SELECT *
     FROM notification_preferences
     WHERE user_id = $1`,
    [userId],
  );
  return mapPreferencesRow(result.rows[0]);
}

export async function updateNotificationPreferences(userId, preferences) {
  const safe = sanitizePreferences(preferences);
  const result = await query(
    `INSERT INTO notification_preferences (
       user_id, telegram_enabled, browser_enabled, email_enabled,
       quiet_hours_enabled, quiet_hours_start, quiet_hours_end,
       do_not_disturb_enabled, frequency_level
     )
     VALUES ($1, $2, $3, $4, $5, $6::time, $7::time, $8, $9)
     ON CONFLICT (user_id)
     DO UPDATE SET
       telegram_enabled = EXCLUDED.telegram_enabled,
       browser_enabled = EXCLUDED.browser_enabled,
       email_enabled = EXCLUDED.email_enabled,
       quiet_hours_enabled = EXCLUDED.quiet_hours_enabled,
       quiet_hours_start = EXCLUDED.quiet_hours_start,
       quiet_hours_end = EXCLUDED.quiet_hours_end,
       do_not_disturb_enabled = EXCLUDED.do_not_disturb_enabled,
       frequency_level = EXCLUDED.frequency_level,
       updated_at = NOW()
     RETURNING *`,
    [
      userId,
      safe.telegram_enabled,
      safe.browser_enabled,
      safe.email_enabled,
      safe.quiet_hours_enabled,
      safe.quiet_hours_start,
      safe.quiet_hours_end,
      safe.do_not_disturb_enabled,
      safe.frequency_level,
    ],
  );
  return mapPreferencesRow(result.rows[0]);
}

export async function getNotificationChannels(userId) {
  const preferences = await getNotificationPreferences(userId);
  const publisher = await selectDefaultTelegramPublisher();
  const destination = publisher?.channel_username || publisher?.channel_title || publisher?.channel_id || null;

  return {
    telegram: {
      status: publisher ? 'configured' : 'not_configured',
      provider: 'telegram_publisher',
      configured: Boolean(publisher),
      enabled: preferences.telegram_enabled,
      publisherId: publisher?.id || null,
      publisherName: publisher?.name || null,
      destinationMasked: maskDestination(destination),
    },
    browser: {
      status: preferences.browser_enabled ? 'enabled' : 'disabled',
      configured: true,
      enabled: preferences.browser_enabled,
    },
    email: {
      status: 'coming_soon',
      configured: false,
      enabled: false,
    },
  };
}

export async function getNotificationHistory(userId, filters = {}) {
  const limit = Math.min(Math.max(parseInt(filters.limit, 10) || 50, 1), HISTORY_LIMIT_MAX);
  const offset = Math.max(parseInt(filters.offset, 10) || 0, 0);
  const status = filters.status && filters.status !== 'all' ? String(filters.status) : null;

  const params = [userId];
  let where = 'WHERE user_id = $1';
  if (status) {
    params.push(status);
    where += ` AND status = $${params.length}`;
  }
  params.push(limit, offset);

  const result = await query(
    `SELECT *
     FROM notification_history
     ${where}
     ORDER BY created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );

  const countResult = await query(
    `SELECT COUNT(*)::int AS count
     FROM notification_history
     ${where}`,
    params.slice(0, status ? 2 : 1),
  );

  return {
    notifications: result.rows.map(mapHistoryRow),
    total: countResult.rows[0]?.count || 0,
    limit,
    offset,
  };
}

export async function deliverNotificationEvent(event, options = {}) {
  const dryRun = options.dryRun !== false;
  const confirmLive = options.confirmLive === true;

  if (!ALLOWED_CHANNELS.has(event.channel)) {
    throw notificationError('Invalid notification channel', NOTIFICATION_ERROR_CODES.INVALID_CHANNEL, 400);
  }

  if (!dryRun && !confirmLive) {
    throw notificationError(
      'confirm_live must be true for live notification delivery',
      NOTIFICATION_ERROR_CODES.LIVE_CONFIRMATION_REQUIRED,
      400,
    );
  }

  let publisher = null;
  try {
    const enforcement = await enforceSourceDerivedDelivery(event);
    publisher = enforcement.publisher;
  } catch (error) {
    const code = isFilterRuleBlockedError(error)
      ? NOTIFICATION_ERROR_CODES.FILTER_RULE_BLOCKED
      : error.code || 'NOTIFICATION_POLICY_BLOCKED';
    const status = code === NOTIFICATION_ERROR_CODES.PUBLISHER_MAPPING_REQUIRED ? 'skipped' : 'blocked';
    const history = await insertHistory({
      userId: event.user_id,
      channel: event.channel,
      messageType: event.message_type,
      title: event.title,
      message: event.message,
      status,
      dryRun,
      sourceId: event.source_id,
      publisherId: publisher?.id || null,
      errorCode: code,
      errorMessage: error.message,
      metadata: event.metadata,
    });
    return { success: false, status, dry_run: dryRun, code, history };
  }

  if (event.channel === 'telegram' && !publisher) {
    publisher = await selectDefaultTelegramPublisher();
  }

  if (event.channel === 'telegram' && !publisher) {
    const history = await insertHistory({
      userId: event.user_id,
      channel: event.channel,
      messageType: event.message_type,
      title: event.title,
      message: event.message,
      status: 'skipped',
      dryRun,
      sourceId: event.source_id,
      errorCode: NOTIFICATION_ERROR_CODES.TELEGRAM_NOT_CONFIGURED,
      errorMessage: 'No active Telegram Publisher is configured',
      metadata: event.metadata,
    });
    return {
      success: false,
      status: 'skipped',
      dry_run: dryRun,
      code: NOTIFICATION_ERROR_CODES.TELEGRAM_NOT_CONFIGURED,
      history,
    };
  }

  const destination = publisher?.channel_username || publisher?.channel_title || publisher?.channel_id || null;
  const destinationMasked = maskDestination(destination);

  if (!dryRun) {
    const history = await insertHistory({
      userId: event.user_id,
      channel: event.channel,
      messageType: event.message_type,
      title: event.title,
      message: event.message,
      status: 'skipped',
      dryRun: false,
      sourceId: event.source_id,
      publisherId: publisher?.id || null,
      destinationMasked,
      errorCode: NOTIFICATION_ERROR_CODES.LIVE_NOT_SUPPORTED_YET,
      errorMessage: 'Live notification delivery is not supported outside Telegram Publisher yet',
      metadata: event.metadata,
    });
    throw Object.assign(
      notificationError(
        'Live notification delivery is not supported yet',
        NOTIFICATION_ERROR_CODES.LIVE_NOT_SUPPORTED_YET,
        400,
      ),
      { history },
    );
  }

  const history = await insertHistory({
    userId: event.user_id,
    channel: event.channel,
    messageType: event.message_type,
    title: event.title,
    message: event.message,
    status: 'dry_run',
    dryRun: true,
    sourceId: event.source_id,
    publisherId: publisher?.id || null,
    destinationMasked,
    metadata: {
      ...(event.metadata || {}),
      provider: event.channel === 'telegram' ? 'telegram_publisher' : event.channel,
      publisher_name: publisher?.name || null,
    },
  });

  return {
    success: true,
    status: 'dry_run',
    dry_run: true,
    history,
  };
}

export async function createNotificationEvent(payload = {}) {
  const event = {
    user_id: payload.userId || payload.user_id,
    channel: payload.channel || 'system',
    message_type: payload.messageType || payload.message_type || 'system',
    title: payload.title || 'Notification',
    message: payload.message || payload.messagePreview || payload.title || 'Notification',
    source_id: payload.sourceId || payload.source_id || null,
    data_type: payload.dataType || payload.data_type || null,
    metadata: payload.metadata || {},
  };

  if (!event.user_id) {
    throw notificationError('user_id is required', 'USER_ID_REQUIRED', 400);
  }

  return deliverNotificationEvent(event, {
    dryRun: payload.dryRun !== false && payload.dry_run !== false,
    confirmLive: payload.confirmLive === true || payload.confirm_live === true,
  });
}

export async function testNotificationChannel({
  userId,
  channel,
  dryRun = true,
  confirmLive = false,
  sourceId = null,
  message = 'Notification channel test',
}) {
  const requestedDryRun = dryRun !== false;
  return createNotificationEvent({
    userId,
    channel,
    messageType: 'test',
    title: 'Notification Test',
    message,
    sourceId,
    dryRun: requestedDryRun,
    confirmLive,
    metadata: {
      mode: 'test',
      requested_at: new Date().toISOString(),
    },
  });
}

export async function recordNotificationSkipped({
  userId,
  channel,
  messageType,
  title,
  message,
  errorCode,
  errorMessage,
  metadata = {},
}) {
  return insertHistory({
    userId,
    channel,
    messageType,
    title,
    message,
    status: 'skipped',
    dryRun: false,
    errorCode,
    errorMessage,
    metadata,
  });
}

export function logNotificationWarning(message, context = {}) {
  logger.warn(message, context);
}
