import { createClient } from 'redis';
import { logger } from '../services/logger.js';

let redisClient = null;
let isConnecting = false;

function buildRedisOptions({ allowPassword = true } = {}) {
  const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
  const redisPassword = process.env.REDIS_PASSWORD;
  const parsedUrl = new URL(redisUrl);
  if (!allowPassword) {
    parsedUrl.username = '';
    parsedUrl.password = '';
  }

  const clientOptions = {
    url: parsedUrl.toString(),
    socket: {
      reconnectStrategy: (retries) => {
        if (retries > 10) {
          logger.error('❌ Redis: Max reconnection attempts reached');
          return new Error('Max reconnection attempts reached');
        }
        return Math.min(retries * 50, 3000);
      }
    }
  };

  if (allowPassword && redisPassword && !redisUrl.includes('@')) {
    clientOptions.password = redisPassword;
  }

  return clientOptions;
}

function redisEnvHasPassword() {
  const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
  const parsedUrl = new URL(redisUrl);
  return Boolean(process.env.REDIS_PASSWORD || parsedUrl.password);
}

function isAuthMismatch(error) {
  const message = String(error?.message || '').toLowerCase();
  return message.includes('auth') && (
    message.includes('failed') ||
    message.includes('client sent auth') ||
    message.includes('no password')
  );
}

async function acceptsUnauthenticatedRedis() {
  if (!redisEnvHasPassword()) return false;
  let probe = null;
  try {
    probe = createClient({
      ...buildRedisOptions({ allowPassword: false }),
      socket: {
        reconnectStrategy: false,
      },
    });
    await probe.connect();
    await probe.ping();
    return true;
  } catch {
    return false;
  } finally {
    if (probe?.isOpen) {
      await probe.quit();
    }
  }
}

async function connectRedisClient(clientOptions) {
  const client = createClient(clientOptions);

  client.on('error', (err) => {
    logger.error('❌ Redis Client Error:', err.message);
  });

  client.on('connect', () => {
    logger.info('🔗 Redis: Connected');
  });

  client.on('reconnecting', () => {
    logger.info('🔄 Redis: Reconnecting...');
  });

  client.on('ready', () => {
    logger.info('✅ Redis: Ready');
  });

  await client.connect();
  return client;
}

/**
 * Get or create Redis client
 * @returns {Promise<RedisClient>}
 */
export async function getRedisClient() {
  if (redisClient && redisClient.isOpen) {
    return redisClient;
  }

  if (isConnecting) {
    // Wait for connection to complete
    await new Promise(resolve => setTimeout(resolve, 100));
    return getRedisClient();
  }

  isConnecting = true;

  try {
    try {
      if (await acceptsUnauthenticatedRedis()) {
        logger.warn('⚠️ Redis password ignored because server accepts unauthenticated local connection');
        redisClient = await connectRedisClient(buildRedisOptions({ allowPassword: false }));
      } else {
        redisClient = await connectRedisClient(buildRedisOptions());
      }
    } catch (error) {
      if (!isAuthMismatch(error)) throw error;
      logger.warn('⚠️ Redis auth failed; retrying without password for local unauthenticated Redis');
      redisClient = await connectRedisClient(buildRedisOptions({ allowPassword: false }));
    }

    isConnecting = false;
    return redisClient;
  } catch (error) {
    isConnecting = false;
    redisClient = null;
    logger.error('❌ Redis connection failed:', error.message);
    throw error;
  }
}

/**
 * Close Redis connection
 */
export async function closeRedis() {
  if (redisClient && redisClient.isOpen) {
    await redisClient.quit();
    logger.info('🔌 Redis: Connection closed');
  }
}

/**
 * Check if Redis is available
 * @returns {boolean}
 */
export function isRedisAvailable() {
  return redisClient && redisClient.isOpen;
}

/**
 * Get Redis info for monitoring
 * @returns {Promise<Object>} Redis stats
 */
export async function getRedisInfo() {
  try {
    if (!isRedisAvailable()) {
      return {
        status: 'disconnected',
        message: 'Redis client not connected'
      };
    }

    const client = await getRedisClient();
    
    // Get Redis INFO
    const info = await client.info();
    const lines = info.split('\r\n');
    const stats = {};
    
    lines.forEach(line => {
      if (line && !line.startsWith('#') && line.includes(':')) {
        const [key, value] = line.split(':');
        stats[key] = value;
      }
    });

    // Get memory info
    const memoryInfo = {
      used_memory: parseInt(stats.used_memory || 0),
      used_memory_human: stats.used_memory_human,
      used_memory_peak_human: stats.used_memory_peak_human,
      maxmemory: parseInt(stats.maxmemory || 0),
      maxmemory_human: stats.maxmemory_human || 'unlimited'
    };

    // Calculate hit rate
    const hits = parseInt(stats.keyspace_hits || 0);
    const misses = parseInt(stats.keyspace_misses || 0);
    const hitRate = hits + misses > 0 ? ((hits / (hits + misses)) * 100).toFixed(2) : 0;

    // Get connected clients
    const connectedClients = parseInt(stats.connected_clients || 0);

    // Get uptime
    const uptimeInSeconds = parseInt(stats.uptime_in_seconds || 0);

    return {
      status: 'connected',
      version: stats.redis_version,
      uptime: uptimeInSeconds,
      memory: memoryInfo,
      stats: {
        connected_clients: connectedClients,
        total_commands_processed: parseInt(stats.total_commands_processed || 0),
        keyspace_hits: hits,
        keyspace_misses: misses,
        hit_rate: parseFloat(hitRate),
        evicted_keys: parseInt(stats.evicted_keys || 0),
        expired_keys: parseInt(stats.expired_keys || 0)
      },
      persistence: {
        rdb_last_save_time: parseInt(stats.rdb_last_save_time || 0),
        aof_enabled: stats.aof_enabled === '1',
        aof_last_rewrite_time_sec: parseInt(stats.aof_last_rewrite_time_sec || -1)
      }
    };
  } catch (error) {
    logger.error('❌ Failed to get Redis info:', error.message);
    return {
      status: 'error',
      message: error.message
    };
  }
}

export default {
  getRedisClient,
  closeRedis,
  isRedisAvailable,
  getRedisInfo
};
