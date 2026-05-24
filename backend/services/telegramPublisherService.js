import { query } from '../database/db.js';
import { encryptSecret, decryptSecret, isEncrypted } from '../utils/crypto.js';
import { logger } from './logger.js';

export function isPublisherDryRunForced() {
  if (process.env.TELEGRAM_PUBLISHER_DRY_RUN === 'true') return true;
  if (process.env.TELEGRAM_PUBLISHER_DRY_RUN === 'false') return false;
  return process.env.NODE_ENV !== 'production';
}

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
  contentType,
  contentSummary,
  status,
  telegramMessageId,
  errorMessage,
  metadata = {},
}) {
  const result = await query(
    `INSERT INTO publisher_delivery_history
      (publisher_id, content_type, content_summary, status, telegram_message_id, error_message, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      publisherId,
      contentType || null,
      contentSummary ? String(contentSummary).slice(0, 2000) : null,
      status,
      telegramMessageId || null,
      errorMessage ? String(errorMessage).slice(0, 2000) : null,
      JSON.stringify(metadata),
    ],
  );
  return result.rows[0];
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

  const dryRun = isPublisherDryRunForced() || !publisher.bot_token_encrypted;
  const text =
    formatMessageFromTemplate(publisher.template, { message, title: 'Test' }) ||
    message;

  if (dryRun) {
    const history = await recordPublisherHistory({
      publisherId,
      contentType: 'test',
      contentSummary: text.slice(0, 500),
      status: 'dry_run',
      metadata: { mode: 'test', user_id: userId },
    });
    return {
      success: true,
      dry_run: true,
      status: 'dry_run',
      telegram_message_id: null,
      error: null,
      history_id: history.id,
    };
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
      metadata: { mode: 'test', user_id: userId },
    });
    return {
      success: false,
      dry_run: false,
      status: 'failed',
      telegram_message_id: null,
      error: history.error_message,
      history_id: history.id,
    };
  }

  try {
    const messageId = await sendTelegramBotMessage(token, publisher.channel_id, text);
    const history = await recordPublisherHistory({
      publisherId,
      contentType: 'test',
      contentSummary: text.slice(0, 500),
      status: 'test',
      telegramMessageId: messageId,
      metadata: { mode: 'test', user_id: userId },
    });
    return {
      success: true,
      dry_run: false,
      status: 'test',
      telegram_message_id: messageId,
      error: null,
      history_id: history.id,
    };
  } catch (e) {
    const history = await recordPublisherHistory({
      publisherId,
      contentType: 'test',
      contentSummary: text.slice(0, 500),
      status: 'failed',
      errorMessage: e.message,
      metadata: { mode: 'test', user_id: userId },
    });
    return {
      success: false,
      dry_run: false,
      status: 'failed',
      telegram_message_id: null,
      error: e.message,
      history_id: history.id,
    };
  }
}

export async function runPublisherPublish(
  publisherId,
  { message, content_type, confirm_publish, title, content },
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
    throw err;
  }

  const text = formatMessageFromTemplate(publisher.template, {
    message,
    title,
    content,
  });

  const dryRun = isPublisherDryRunForced() || !publisher.bot_token_encrypted;

  if (dryRun) {
    const history = await recordPublisherHistory({
      publisherId,
      contentType: content_type,
      contentSummary: text.slice(0, 500),
      status: 'dry_run',
      metadata: { mode: 'publish', user_id: userId, confirm_publish },
    });
    return {
      success: true,
      dry_run: true,
      status: 'dry_run',
      telegram_message_id: null,
      error: null,
      history_id: history.id,
    };
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
      contentSummary: text.slice(0, 500),
      status: 'failed',
      errorMessage: `Token decrypt failed: ${e.message}`,
      metadata: { mode: 'publish', user_id: userId },
    });
    return {
      success: false,
      dry_run: false,
      status: 'failed',
      telegram_message_id: null,
      error: history.error_message,
      history_id: history.id,
    };
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
      contentSummary: text.slice(0, 500),
      status: 'sent',
      telegramMessageId: messageId,
      metadata: { mode: 'publish', user_id: userId },
    });
    return {
      success: true,
      dry_run: false,
      status: 'sent',
      telegram_message_id: messageId,
      error: null,
      history_id: history.id,
    };
  } catch (e) {
    const history = await recordPublisherHistory({
      publisherId,
      contentType: content_type,
      contentSummary: text.slice(0, 500),
      status: 'failed',
      errorMessage: e.message,
      metadata: { mode: 'publish', user_id: userId },
    });
    return {
      success: false,
      dry_run: false,
      status: 'failed',
      telegram_message_id: null,
      error: e.message,
      history_id: history.id,
    };
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
