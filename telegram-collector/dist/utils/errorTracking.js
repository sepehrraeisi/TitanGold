/**
 * Database Helper Functions for Error Tracking
 * 
 * These functions update telegram_channels table with error information
 * and success/recovery tracking.
 */

const { Pool } = require('pg');
const logger = console;

// Create a persistent pool for error tracking
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5433'),
  database: process.env.DB_NAME || 'titangold_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || ''
});

/**
 * Record a polling error for a channel
 * Increments error_count and stores the error message
 */
async function recordChannelError(channelId, error) {
  try {
    const errorMessage = error?.message || String(error);
    const result = await pool.query(`
      UPDATE telegram_channels 
      SET 
        last_error = $1,
        last_error_at = NOW(),
        error_count = error_count + 1,
        consecutive_success_count = 0
      WHERE id = $2
      RETURNING error_count, last_error_at
    `, [errorMessage, channelId]);

    if (result.rows.length > 0) {
      const { error_count, last_error_at } = result.rows[0];
      logger.log(`   📝 Recorded error for channel ${channelId}: error_count=${error_count}`);
      return { error_count, last_error_at };
    }

    return null;
  } catch (err) {
    logger.error(`   ⚠️ Failed to record error for channel ${channelId}:`, err.message);
    return null;
  }
}

/**
 * Record a successful poll for a channel
 * Resets error_count and increments consecutive_success_count
 */
async function recordChannelSuccess(channelId) {
  try {
    const result = await pool.query(`
      UPDATE telegram_channels 
      SET 
        error_count = 0,
        last_error = NULL,
        last_error_at = NULL,
        consecutive_success_count = consecutive_success_count + 1
      WHERE id = $1
      RETURNING consecutive_success_count
    `, [channelId]);

    if (result.rows.length > 0) {
      const { consecutive_success_count } = result.rows[0];
      
      // Log recovery if this was the first success after errors
      if (consecutive_success_count === 1) {
        logger.log(`   ✅ Channel ${channelId} recovered from errors`);
      }
      
      return { consecutive_success_count };
    }

    return null;
  } catch (err) {
    logger.error(`   ⚠️ Failed to record success for channel ${channelId}:`, err.message);
    return null;
  }
}

/**
 * Get channel with error stats
 */
async function getChannelErrorStats(channelId) {
  try {
    const result = await pool.query(`
      SELECT 
        id,
        username,
        title,
        priority,
        error_count,
        last_error,
        last_error_at,
        consecutive_success_count,
        last_synced_at
      FROM telegram_channels 
      WHERE id = $1
    `, [channelId]);

    return result.rows[0] || null;
  } catch (err) {
    logger.error(`   ⚠️ Failed to get error stats for channel ${channelId}:`, err.message);
    return null;
  }
}

/**
 * Get all channels with persistent errors (3+ consecutive errors)
 */
async function getChannelsWithPersistentErrors(minErrorCount = 3) {
  try {
    const result = await pool.query(`
      SELECT 
        id,
        username,
        title,
        priority,
        error_count,
        last_error,
        last_error_at,
        last_synced_at,
        EXTRACT(EPOCH FROM (NOW() - last_error_at))/60 as minutes_since_error
      FROM telegram_channels 
      WHERE error_count >= $1 
      AND is_active = true
      ORDER BY priority DESC, error_count DESC, last_error_at DESC
    `, [minErrorCount]);

    return result.rows;
  } catch (err) {
    logger.error(`   ⚠️ Failed to get channels with persistent errors:`, err.message);
    return [];
  }
}

/**
 * Categorize error message into common types
 */
function categorizeError(errorMessage) {
  if (!errorMessage) return 'UNKNOWN';
  
  const msg = errorMessage.toLowerCase();
  
  if (msg.includes('timeout') || msg.includes('timed out')) return 'TIMEOUT';
  if (msg.includes('auth') || msg.includes('unauthorized') || msg.includes('session')) return 'AUTH';
  if (msg.includes('network') || msg.includes('connection') || msg.includes('econnrefused')) return 'NETWORK';
  if (msg.includes('rate') || msg.includes('flood') || msg.includes('too many')) return 'RATE_LIMIT';
  if (msg.includes('not found') || msg.includes('invalid channel')) return 'NOT_FOUND';
  if (msg.includes('permission') || msg.includes('access denied')) return 'PERMISSION';
  
  return 'OTHER';
}

module.exports = {
  recordChannelError,
  recordChannelSuccess,
  getChannelErrorStats,
  getChannelsWithPersistentErrors,
  categorizeError,
};
