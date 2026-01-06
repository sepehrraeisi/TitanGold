import { createClient } from 'redis';

let redisClient = null;
let isConnecting = false;

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
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    
    redisClient = createClient({
      url: redisUrl,
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > 10) {
            console.error('❌ Redis: Max reconnection attempts reached');
            return new Error('Max reconnection attempts reached');
          }
          // Exponential backoff: 50ms, 100ms, 200ms, ...
          return Math.min(retries * 50, 3000);
        }
      }
    });

    redisClient.on('error', (err) => {
      console.error('❌ Redis Client Error:', err.message);
    });

    redisClient.on('connect', () => {
      console.log('🔗 Redis: Connected');
    });

    redisClient.on('reconnecting', () => {
      console.log('🔄 Redis: Reconnecting...');
    });

    redisClient.on('ready', () => {
      console.log('✅ Redis: Ready');
    });

    await redisClient.connect();
    
    isConnecting = false;
    return redisClient;
  } catch (error) {
    isConnecting = false;
    console.error('❌ Redis connection failed:', error.message);
    throw error;
  }
}

/**
 * Close Redis connection
 */
export async function closeRedis() {
  if (redisClient && redisClient.isOpen) {
    await redisClient.quit();
    console.log('🔌 Redis: Connection closed');
  }
}

/**
 * Check if Redis is available
 * @returns {boolean}
 */
export function isRedisAvailable() {
  return redisClient && redisClient.isOpen;
}

export default {
  getRedisClient,
  closeRedis,
  isRedisAvailable
};
