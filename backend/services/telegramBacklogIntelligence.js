import { query } from '../database/db.js';

/** Minimum assumed throughput when 24h observation is zero (read-only floor, not a scheduler change). */
export const BACKLOG_THROUGHPUT_FLOOR_MSG_PER_HOUR = 1;

/**
 * Observed Telegram transfer throughput from messages marked processed in the last 24h.
 * @returns {Promise<{ processed24h: number, messagesPerHour: number, messagesPerDay: number, observedWindowHours: number }>}
 */
export async function fetchTransferThroughput24h() {
  const result = await query(`
    SELECT COUNT(*)::int AS processed_24h
    FROM telegram_messages
    WHERE is_processed = true
      AND processed_at > NOW() - INTERVAL '24 hours'
  `);
  const processed24h = Number(result.rows[0]?.processed_24h || 0);
  const messagesPerHour = Math.max(
    BACKLOG_THROUGHPUT_FLOOR_MSG_PER_HOUR,
    processed24h / 24,
  );
  return {
    processed24h,
    messagesPerHour,
    messagesPerDay: processed24h,
    observedWindowHours: 24,
  };
}

/**
 * @param {number} totalMessages
 * @param {number} messagesPerHour
 * @returns {{ estimatedWaitHours: number, estimatedWaitDays: number }}
 */
export function estimateWaitFromThroughput(totalMessages, messagesPerHour) {
  const rate = Math.max(BACKLOG_THROUGHPUT_FLOOR_MSG_PER_HOUR, messagesPerHour || 0);
  const estimatedWaitHours = totalMessages <= 0 ? 0 : totalMessages / rate;
  return {
    estimatedWaitHours: Number(estimatedWaitHours.toFixed(2)),
    estimatedWaitDays: Number((estimatedWaitHours / 24).toFixed(2)),
  };
}

/**
 * Batch backlog intelligence for collector channel UUIDs (telegram_channels.id).
 * @param {string[]} collectorChannelUuids
 * @param {{ messagesPerHour: number }} throughput
 * @returns {Promise<Map<string, object>>} channel uuid → backlog intel
 */
export async function batchCollectorBacklogIntelligence(collectorChannelUuids, throughput) {
  const map = new Map();
  const ids = [...new Set(collectorChannelUuids.filter(Boolean))];
  if (ids.length === 0) return map;

  const [backlogRows] = await Promise.all([
    query(
      `SELECT tm.channel_id,
              COUNT(*)::int AS backlog_count,
              MIN(tm.telegram_created_at) AS oldest_queued_at,
              MAX(tm.telegram_created_at) AS newest_queued_at
       FROM telegram_messages tm
       WHERE tm.channel_id = ANY($1::uuid[])
         AND tm.is_processed = false
       GROUP BY tm.channel_id`,
      [ids],
    ),
  ]);

  const ranked = backlogRows.rows
    .filter((r) => Number(r.backlog_count) > 0 && r.oldest_queued_at)
    .sort(
      (a, b) =>
        new Date(a.oldest_queued_at).getTime() - new Date(b.oldest_queued_at).getTime(),
    );

  const rankByChannel = new Map();
  ranked.forEach((row, index) => {
    rankByChannel.set(row.channel_id, index + 1);
  });

  for (const row of backlogRows.rows) {
    const backlogCount = Number(row.backlog_count || 0);
    const messagesAheadInQueue = 0;
    const totalWaitMessages = backlogCount;
    const { estimatedWaitHours, estimatedWaitDays } = estimateWaitFromThroughput(
      totalWaitMessages,
      throughput.messagesPerHour,
    );

    map.set(row.channel_id, {
      backlogCount,
      oldestQueuedAt: row.oldest_queued_at
        ? new Date(row.oldest_queued_at).toISOString()
        : undefined,
      newestQueuedAt: row.newest_queued_at
        ? new Date(row.newest_queued_at).toISOString()
        : undefined,
      messagesAheadInQueue,
      estimatedWaitHours,
      estimatedWaitDays,
      queuePositionRank: rankByChannel.get(row.channel_id),
    });
  }

  return map;
}

/**
 * Global backlog summary for pipeline snapshot metadata.
 */
export async function fetchGlobalTelegramBacklogSummary() {
  const result = await query(`
    SELECT
      COUNT(*) FILTER (WHERE is_processed = false)::int AS unprocessed_total,
      MIN(telegram_created_at) FILTER (WHERE is_processed = false) AS oldest_unprocessed,
      MAX(telegram_created_at) FILTER (WHERE is_processed = false) AS newest_unprocessed
    FROM telegram_messages
  `);
  const row = result.rows[0] || {};
  return {
    unprocessedTotal: Number(row.unprocessed_total || 0),
    oldestUnprocessed: row.oldest_unprocessed
      ? new Date(row.oldest_unprocessed).toISOString()
      : undefined,
    newestUnprocessed: row.newest_unprocessed
      ? new Date(row.newest_unprocessed).toISOString()
      : undefined,
  };
}
