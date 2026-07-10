import { query } from '../database/db.js';
import { encryptSecret, decryptSecret, isEncrypted } from '../utils/crypto.js';
import { logger } from './logger.js';
import { assertAccessControlGateway } from '../middleware/accessControlGateway.js';
import { enforcePublishingPolicy } from './filterRulesGateway.js';
import {
  isPublisherDryRunForced,
  isServerSafetyOverrideActive,
  resolvePublishDeliveryContext,
  consumeLiveTestIfNeeded,
  attachRuntimeFields,
} from './telegramPublisherRuntimeModeService.js';

export { isPublisherDryRunForced, isServerSafetyOverrideActive };

export function mapPublisherRow(row) {
  return {
    id: row.id,
    name: row.name,
    channel_id: row.channel_id,
    channel_username: row.channel_username,
    channel_title: row.channel_title,
    has_bot_token: Boolean(row.bot_token_encrypted),
    is_active: row.is_active,
    language: row.language || 'en',
    template: row.template || '',
    schedule_config: row.schedule_config || {},
    sent_count: row.sent_count ?? 0,
    last_sent_at: row.last_sent_at ? new Date(row.last_sent_at).toISOString() : null,
    created_at: new Date(row.created_at).toISOString(),
    updated_at: new Date(row.updated_at).toISOString(),
  };
}

export function formatMessageFromTemplate(template, variables = {}) {
  let message = template || '{message}';
  for (const [key, value] of Object.entries(variables)) {
    if (value !== undefined && value !== null) {
      message = message.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value));
    }
  }
  if (variables.message) {
    message = message.replace(/\{message\}/g, variables.message);
  }
  message = message.replace(/\{[^}]+\}/g, '');
  return message.trim() || variables.message || '';
}

function normalizeChatId(channelId) {
  let clean = String(channelId || '').trim();
  if (!/^-?\d+$/.test(clean) && !clean.startsWith('@')) {
    clean = `@${clean}`;
  }
  return clean;
}

export async function sendTelegramBotMessage(botToken, channelId, text) {
  const chatId = normalizeChatId(channelId);
  const url = `https://api.telegram.org/bot${botToken.trim()}/sendMessage`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: text.slice(0, 4096),
      parse_mode: 'Markdown',
      disable_web_page_preview: true,
    }),
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.ok) {
    const err =
      body.description ||
      `Telegram API HTTP ${response.status}`;
    throw new Error(err);
  }
  return String(body.result?.message_id ?? '');
}

export async function recordPublisherHistory({
  publisherId,
  sourceId = null,
  dataType = null,
  contentType,
  contentSummary,
  status,
  telegramMessageId,
  errorMessage,
  errorCode = null,
  userId = null,
  metadata = {},
}) {
  const result = await query(
    `INSERT INTO publisher_delivery_history
      (
        publisher_id, source_id, data_type, content_type, content_summary,
        status, telegram_message_id, error_message, error_code, created_by, metadata
      )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING *`,
    [
      publisherId,
      sourceId,
      dataType || null,
      contentType || null,
      contentSummary ? String(contentSummary).slice(0, 2000) : null,
      status,
      telegramMessageId || null,
      errorMessage ? String(errorMessage).slice(0, 2000) : null,
      errorCode || null,
      userId || null,
      JSON.stringify(metadata),
    ],
  );
  return result.rows[0];
}

export function mapPublisherMappingRow(row) {
  return {
    id: row.id,
    source_id: row.source_id,
    source_name: row.source_name,
    source_type: row.source_type,
    publisher_id: row.publisher_id,
    publisher_name: row.publisher_name,
    publisher_channel_id: row.publisher_channel_id,
    publisher_channel_username: row.publisher_channel_username,
    is_enabled: row.is_enabled === true,
    template_id: row.template_id || null,
    last_activity_at: row.last_activity_at ? new Date(row.last_activity_at).toISOString() : null,
    last_status: row.last_status || null,
    created_at: new Date(row.created_at).toISOString(),
    updated_at: new Date(row.updated_at).toISOString(),
  };
}

const MAPPING_SELECT = `
  SELECT
    m.id,
    m.source_id,
    ds.name AS source_name,
    ds.type AS source_type,
    m.publisher_id,
    tp.name AS publisher_name,
    tp.channel_id AS publisher_channel_id,
    tp.channel_username AS publisher_channel_username,
    m.is_enabled,
    m.template_id,
    m.created_at,
    m.updated_at,
    last_history.created_at AS last_activity_at,
    last_history.status AS last_status
  FROM datahub_publisher_source_mappings m
  JOIN data_sources ds ON ds.id = m.source_id
  JOIN telegram_publishers tp ON tp.id = m.publisher_id
  LEFT JOIN LATERAL (
    SELECT h.created_at, h.status
    FROM publisher_delivery_history h
    WHERE h.publisher_id = m.publisher_id
      AND h.source_id = m.source_id
    ORDER BY h.created_at DESC
    LIMIT 1
  ) last_history ON true
`;

export async function listPublisherMappings({ includeDisabled = true } = {}) {
  const result = await query(
    `${MAPPING_SELECT}
     ${includeDisabled ? '' : 'WHERE m.is_enabled = true'}
     ORDER BY ds.name ASC, tp.name ASC`,
  );
  return result.rows.map(mapPublisherMappingRow);
}

export async function createPublisherMapping({
  sourceId,
  publisherId,
  isEnabled = true,
  templateId = null,
  userId = null,
}) {
  const result = await query(
    `INSERT INTO datahub_publisher_source_mappings
      (source_id, publisher_id, is_enabled, template_id, created_by)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (source_id, publisher_id)
     DO UPDATE SET
       is_enabled = EXCLUDED.is_enabled,
       template_id = EXCLUDED.template_id,
       updated_at = NOW()
     RETURNING id`,
    [sourceId, publisherId, isEnabled, templateId, userId],
  );
  const mapped = await query(`${MAPPING_SELECT} WHERE m.id = $1`, [result.rows[0].id]);
  return mapPublisherMappingRow(mapped.rows[0]);
}

export async function updatePublisherMapping(id, {
  sourceId,
  publisherId,
  isEnabled,
  templateId,
}) {
  const existing = await query('SELECT * FROM datahub_publisher_source_mappings WHERE id = $1', [id]);
  if (existing.rows.length === 0) {
    const err = new Error('Publisher mapping not found');
    err.status = 404;
    throw err;
  }
  const row = existing.rows[0];
  const result = await query(
    `UPDATE datahub_publisher_source_mappings SET
       source_id = $2,
       publisher_id = $3,
       is_enabled = $4,
       template_id = $5,
       updated_at = NOW()
     WHERE id = $1
     RETURNING id`,
    [
      id,
      sourceId || row.source_id,
      publisherId || row.publisher_id,
      isEnabled !== undefined ? isEnabled : row.is_enabled,
      templateId !== undefined ? templateId : row.template_id,
    ],
  );
  const mapped = await query(`${MAPPING_SELECT} WHERE m.id = $1`, [result.rows[0].id]);
  return mapPublisherMappingRow(mapped.rows[0]);
}

export async function disablePublisherMapping(id) {
  return updatePublisherMapping(id, { isEnabled: false });
}

async function assertPublisherMapping({ publisherId, sourceId, allowTemporaryPublish }) {
  if (allowTemporaryPublish) return { temporary: true };
  const result = await query(
    `SELECT id FROM datahub_publisher_source_mappings
     WHERE publisher_id = $1
       AND source_id = $2
       AND is_enabled = true
     LIMIT 1`,
    [publisherId, sourceId],
  );
  if (result.rows.length > 0) return { mappingId: result.rows[0].id };
  const err = new Error('Source is not mapped to this publisher. Create or enable a source mapping, or explicitly use temporary/manual publish.');
  err.status = 409;
  err.code = 'PUBLISHER_MAPPING_REQUIRED';
  throw err;
}

export async function getPublisherById(id, { includeToken = false } = {}) {
  const result = await query('SELECT * FROM telegram_publishers WHERE id = $1', [id]);
  if (result.rows.length === 0) return null;
  const row = result.rows[0];
  const mapped = mapPublisherRow(row);
  if (includeToken && row.bot_token_encrypted) {
    try {
      mapped._botToken = isEncrypted(row.bot_token_encrypted)
        ? decryptSecret(row.bot_token_encrypted)
        : row.bot_token_encrypted;
    } catch (e) {
      logger.warn('Failed to decrypt bot token for publisher', { id, error: e.message });
      mapped._botToken = null;
    }
  }
  return mapped;
}

export async function listPublisherMetrics() {
  const result = await query(`
    SELECT
      (SELECT COUNT(*)::int FROM telegram_publishers WHERE is_active = true) AS total_channels,
      COUNT(*) FILTER (WHERE status = 'sent' AND created_at > NOW() - INTERVAL '24 hours')::int AS delivered_24h,
      COUNT(*) FILTER (WHERE status = 'failed' AND created_at > NOW() - INTERVAL '24 hours')::int AS failed_24h
    FROM publisher_delivery_history
  `);
  const row = result.rows[0] || {};
  const delivered = parseInt(row.delivered_24h, 10) || 0;
  const failed = parseInt(row.failed_24h, 10) || 0;
  const total = delivered + failed;
  return {
    totalChannels: parseInt(row.total_channels, 10) || 0,
    delivered24h: delivered,
    failed24h: failed,
    successRate: total === 0 ? 100 : Math.round((delivered / total) * 100),
  };
}

export async function runPublisherTest(publisherId, message, userId) {
  const runtimeContext = await resolvePublishDeliveryContext();
  const row = await query('SELECT * FROM telegram_publishers WHERE id = $1', [publisherId]);
  if (row.rows.length === 0) {
    const err = new Error('Publisher not found');
    err.status = 404;
    throw err;
  }
  const publisher = row.rows[0];
  if (!publisher.is_active) {
    const err = new Error('Publisher is disabled');
    err.status = 400;
    throw err;
  }

  const dryRun = !runtimeContext.willSendLive || !publisher.bot_token_encrypted;
  const deliveryMode = dryRun ? 'dry_run' : runtimeContext.deliveryMode;
  const text =
    formatMessageFromTemplate(publisher.template, { message, title: 'Test' }) ||
    message;

  if (dryRun) {
    const history = await recordPublisherHistory({
      publisherId,
      contentType: 'test',
      contentSummary: text.slice(0, 500),
      status: 'dry_run',
      userId,
      metadata: {
        mode: 'test',
        user_id: userId,
        delivery_mode: 'dry_run',
        configured_mode: runtimeContext.configuredMode,
        effective_mode: runtimeContext.effectiveMode,
        server_safety_override: runtimeContext.serverSafetyOverride,
      },
    });
    return attachRuntimeFields({
      success: true,
      dry_run: true,
      status: 'dry_run',
      telegram_message_id: null,
      error: null,
      history_id: history.id,
    }, runtimeContext);
  }

  let token;
  try {
    token = isEncrypted(publisher.bot_token_encrypted)
      ? decryptSecret(publisher.bot_token_encrypted)
      : publisher.bot_token_encrypted;
  } catch (e) {
    const history = await recordPublisherHistory({
      publisherId,
      contentType: 'test',
      contentSummary: text.slice(0, 500),
      status: 'failed',
      errorMessage: `Token decrypt failed: ${e.message}`,
      errorCode: 'BOT_TOKEN_DECRYPT_FAILED',
      userId,
      metadata: { mode: 'test', user_id: userId },
    });
    return attachRuntimeFields({
      success: false,
      dry_run: false,
      status: 'failed',
      telegram_message_id: null,
      error: history.error_message,
      history_id: history.id,
    }, runtimeContext);
  }

  try {
    const messageId = await sendTelegramBotMessage(token, publisher.channel_id, text);
    const history = await recordPublisherHistory({
      publisherId,
      contentType: 'test',
      contentSummary: text.slice(0, 500),
      status: 'sent',
      telegramMessageId: messageId,
      userId,
      metadata: {
        mode: 'test',
        user_id: userId,
        delivery_mode: deliveryMode,
        configured_mode: runtimeContext.configuredMode,
        effective_mode: runtimeContext.effectiveMode,
        server_safety_override: runtimeContext.serverSafetyOverride,
      },
    });
    let liveTestConsumed = false;
    if (deliveryMode === 'live_test') {
      const consumed = await consumeLiveTestIfNeeded({ userId, historyId: history.id });
      liveTestConsumed = consumed.consumed;
    }
    return attachRuntimeFields({
      success: true,
      dry_run: false,
      status: 'sent',
      telegram_message_id: messageId,
      error: null,
      history_id: history.id,
    }, runtimeContext, { liveTestConsumed });
  } catch (e) {
    const history = await recordPublisherHistory({
      publisherId,
      contentType: 'test',
      contentSummary: text.slice(0, 500),
      status: 'failed',
      errorMessage: e.message,
      errorCode: 'TELEGRAM_SEND_FAILED',
      userId,
      metadata: { mode: 'test', user_id: userId },
    });
    return attachRuntimeFields({
      success: false,
      dry_run: false,
      status: 'failed',
      telegram_message_id: null,
      error: e.message,
      history_id: history.id,
    }, runtimeContext);
  }
}

export async function runPublisherPublish(
  publisherId,
  {
    message,
    content_type,
    confirm_publish,
    title,
    content,
    source_id: sourceId,
    data_type: dataType,
    allow_temporary_publish: allowTemporaryPublish = false,
    accessControl = null,
    dry_run: requestDryRun = false,
  },
  userId,
) {
  if (!confirm_publish) {
    const err = new Error('confirm_publish must be true to send a live message');
    err.status = 400;
    throw err;
  }

  const row = await query('SELECT * FROM telegram_publishers WHERE id = $1', [publisherId]);
  if (row.rows.length === 0) {
    const err = new Error('Publisher not found');
    err.status = 404;
    throw err;
  }
  const publisher = row.rows[0];
  if (!publisher.is_active) {
    const err = new Error('Publisher is disabled');
    err.status = 400;
    err.code = 'PUBLISHER_DISABLED';
    throw err;
  }

  const text = formatMessageFromTemplate(publisher.template, {
    message,
    title,
    content,
  });

  try {
    await assertPublisherMapping({ publisherId, sourceId, allowTemporaryPublish });
    assertAccessControlGateway({
      accessControl,
      sourceId,
      agentKey: 'publisher',
    });

    await enforcePublishingPolicy({
      sourceId,
      text: message || content || title,
      message,
      dataType,
      metadata: { content_type },
      userId,
      enforcementPath: 'telegram_publisher',
    });
  } catch (e) {
    const history = await recordPublisherHistory({
      publisherId,
      sourceId,
      dataType,
      contentType: content_type,
      contentSummary: text.slice(0, 500),
      status: [
        'FILTER_RULE_BLOCKED',
        'SOURCE_ACCESS_DENIED',
        'PUBLISHER_MAPPING_REQUIRED',
      ].includes(e.code)
        ? 'blocked'
        : 'failed',
      errorMessage: e.message,
      errorCode: e.code || 'PUBLISH_POLICY_FAILED',
      userId,
      metadata: {
        mode: 'publish',
        user_id: userId,
        confirm_publish,
        allow_temporary_publish: allowTemporaryPublish,
        request_dry_run: Boolean(requestDryRun),
        reason: e.reason,
        rule: e.rule,
      },
    });
    e.history_id = history.id;
    throw e;
  }

  const runtimeContext = await resolvePublishDeliveryContext();
  const hasToken = Boolean(publisher.bot_token_encrypted);
  const requestedDryRun = Boolean(requestDryRun);

  if (confirm_publish && !hasToken && runtimeContext.willSendLive && !requestedDryRun) {
    const history = await recordPublisherHistory({
      publisherId,
      contentType: content_type,
      sourceId,
      dataType,
      contentSummary: text.slice(0, 500),
      status: 'failed',
      errorMessage: 'Bot token required for live publish',
      errorCode: 'BOT_TOKEN_MISSING',
      userId,
      metadata: { mode: 'publish', user_id: userId, confirm_publish, request_dry_run: requestedDryRun },
    });
    const err = new Error('Bot token required for live publish');
    err.status = 401;
    err.code = 'BOT_TOKEN_MISSING';
    err.history_id = history.id;
    throw err;
  }

  const dryRun = requestedDryRun || !runtimeContext.willSendLive || !hasToken;
  const deliveryMode = dryRun ? 'dry_run' : runtimeContext.deliveryMode;

  if (dryRun) {
    const history = await recordPublisherHistory({
      publisherId,
      contentType: content_type,
      sourceId,
      dataType,
      contentSummary: text.slice(0, 500),
      status: 'dry_run',
      userId,
      metadata: {
        mode: 'publish',
        user_id: userId,
        confirm_publish,
        delivery_mode: 'dry_run',
        allow_temporary_publish: allowTemporaryPublish,
        request_dry_run: requestedDryRun,
        configured_mode: runtimeContext.configuredMode,
        effective_mode: runtimeContext.effectiveMode,
        server_safety_override: runtimeContext.serverSafetyOverride,
      },
    });
    return attachRuntimeFields({
      success: true,
      dry_run: true,
      status: 'dry_run',
      telegram_message_id: null,
      error: null,
      history_id: history.id,
    }, runtimeContext);
  }

  let token;
  try {
    token = isEncrypted(publisher.bot_token_encrypted)
      ? decryptSecret(publisher.bot_token_encrypted)
      : publisher.bot_token_encrypted;
  } catch (e) {
    const history = await recordPublisherHistory({
      publisherId,
      contentType: content_type,
      sourceId,
      dataType,
      contentSummary: text.slice(0, 500),
      status: 'failed',
      errorMessage: `Token decrypt failed: ${e.message}`,
      errorCode: 'BOT_TOKEN_DECRYPT_FAILED',
      userId,
      metadata: { mode: 'publish', user_id: userId },
    });
    return attachRuntimeFields({
      success: false,
      dry_run: false,
      status: 'failed',
      telegram_message_id: null,
      error: history.error_message,
      history_id: history.id,
    }, runtimeContext);
  }

  try {
    const messageId = await sendTelegramBotMessage(token, publisher.channel_id, text);
    await query(
      `UPDATE telegram_publishers
       SET sent_count = sent_count + 1, last_sent_at = NOW(), updated_at = NOW()
       WHERE id = $1`,
      [publisherId],
    );
    const history = await recordPublisherHistory({
      publisherId,
      contentType: content_type,
      sourceId,
      dataType,
      contentSummary: text.slice(0, 500),
      status: 'sent',
      telegramMessageId: messageId,
      userId,
      metadata: {
        mode: 'publish',
        user_id: userId,
        delivery_mode: deliveryMode,
        allow_temporary_publish: allowTemporaryPublish,
        configured_mode: runtimeContext.configuredMode,
        effective_mode: runtimeContext.effectiveMode,
        server_safety_override: runtimeContext.serverSafetyOverride,
      },
    });
    let liveTestConsumed = false;
    if (deliveryMode === 'live_test') {
      const consumed = await consumeLiveTestIfNeeded({ userId, historyId: history.id });
      liveTestConsumed = consumed.consumed;
    }
    return attachRuntimeFields({
      success: true,
      dry_run: false,
      status: 'sent',
      telegram_message_id: messageId,
      error: null,
      history_id: history.id,
    }, runtimeContext, { liveTestConsumed });
  } catch (e) {
    const history = await recordPublisherHistory({
      publisherId,
      contentType: content_type,
      sourceId,
      dataType,
      contentSummary: text.slice(0, 500),
      status: 'failed',
      errorMessage: e.message,
      errorCode: 'TELEGRAM_SEND_FAILED',
      userId,
      metadata: { mode: 'publish', user_id: userId },
    });
    return attachRuntimeFields({
      success: false,
      dry_run: false,
      status: 'failed',
      telegram_message_id: null,
      error: e.message,
      history_id: history.id,
    }, runtimeContext);
  }
}

export function encryptBotTokenOptional(botToken) {
  if (!botToken) return null;
  try {
    return encryptSecret(botToken);
  } catch (e) {
    logger.warn('MASTER_KEY missing; storing token as plain (dev only)');
    return botToken;
  }
}
