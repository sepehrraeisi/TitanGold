import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';

dotenv.config();

// Connection pool configuration (DATABASE-005)
const poolConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 5432,  // PostgreSQL is on port 5433
  database: process.env.DB_NAME || 'titangold_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
  
  // Pool size configuration (DATABASE-005)
  max: parseInt(process.env.DB_POOL_MAX) || 20,  // Maximum pool size (configurable via env)
  min: parseInt(process.env.DB_POOL_MIN) || 2,   // Minimum pool size
  
  // Timeout configuration (DATABASE-005)
  idleTimeoutMillis: parseInt(process.env.DB_POOL_IDLE_TIMEOUT) || 30000,  // 30 seconds
  connectionTimeoutMillis: parseInt(process.env.DB_POOL_CONNECTION_TIMEOUT) || 2000,  // 2 seconds
  maxLifetimeSeconds: parseInt(process.env.DB_POOL_MAX_LIFETIME) || 3600,  // 1 hour (60 * 60)
  
  // Connection leak detection (DATABASE-005)
  allowExitOnIdle: false,  // Keep pool alive even if all connections are idle
  
  // SSL Configuration
  ssl: process.env.DB_SSL === 'true' ? {
    rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false',
    // For localhost with self-signed cert, we need to allow unauthorized
    // In production with proper certs, set DB_SSL_REJECT_UNAUTHORIZED=true
  } : false,
};

// Create PostgreSQL connection pool
const pool = new Pool(poolConfig);

// Pool monitoring metrics (DATABASE-005)
let poolMetrics = {
  totalConnections: 0,
  activeConnections: 0,
  idleConnections: 0,
  waitingClients: 0,
  lastUpdated: new Date(),
};

// Update pool metrics
const updatePoolMetrics = () => {
  poolMetrics = {
    totalConnections: pool.totalCount,
    activeConnections: pool.totalCount - pool.idleCount,
    idleConnections: pool.idleCount,
    waitingClients: pool.waitingCount,
    lastUpdated: new Date(),
  };
};

// Connection leak detection (DATABASE-005)
const connectionAcquireTimes = new Map();
const CONNECTION_LEAK_THRESHOLD = parseInt(process.env.DB_POOL_LEAK_THRESHOLD) || 30000; // 30 seconds

// Test database connection
pool.on('connect', (client) => {
  console.log('✅ Connected to PostgreSQL database');
  updatePoolMetrics();
});

pool.on('acquire', (client) => {
  // Track connection acquisition time for leak detection
  const acquireTime = Date.now();
  connectionAcquireTimes.set(client, acquireTime);
  updatePoolMetrics();
});

pool.on('release', (client) => {
  // Check for connection leaks
  const acquireTime = connectionAcquireTimes.get(client);
  if (acquireTime) {
    const holdTime = Date.now() - acquireTime;
    if (holdTime > CONNECTION_LEAK_THRESHOLD) {
      console.warn(`⚠️  Connection leak detected: held for ${holdTime}ms (threshold: ${CONNECTION_LEAK_THRESHOLD}ms)`);
    }
    connectionAcquireTimes.delete(client);
  }
  updatePoolMetrics();
});

pool.on('remove', (client) => {
  connectionAcquireTimes.delete(client);
  updatePoolMetrics();
});

pool.on('error', (err) => {
  console.error('❌ Unexpected error on idle client', err);
  updatePoolMetrics();
  process.exit(-1);
});

// Query helper function
export const query = async (text, params) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log('📊 Query executed:', { text, duration, rows: res.rowCount });
    return res;
  } catch (error) {
    console.error('❌ Query error:', error);
    throw error;
  }
};

// Transaction helper
export const transaction = async (callback) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

// Get client from pool for complex operations
export const getClient = () => pool.connect();

// Get pool metrics (DATABASE-005)
export const getPoolMetrics = () => {
  updatePoolMetrics();
  return {
    ...poolMetrics,
    config: {
      max: poolConfig.max,
      min: poolConfig.min,
      idleTimeoutMs: poolConfig.idleTimeoutMillis,
      connectionTimeoutMs: poolConfig.connectionTimeoutMillis,
      maxLifetimeSeconds: poolConfig.maxLifetimeSeconds,
    },
    utilization: poolMetrics.totalConnections > 0 
      ? ((poolMetrics.activeConnections / poolConfig.max) * 100).toFixed(2) + '%'
      : '0%',
  };
};

// Check connection leaks (DATABASE-005)
export const checkConnectionLeaks = () => {
  const now = Date.now();
  const leaks = [];
  
  connectionAcquireTimes.forEach((acquireTime, client) => {
    const holdTime = now - acquireTime;
    if (holdTime > CONNECTION_LEAK_THRESHOLD) {
      leaks.push({
        client: client.processID,
        holdTimeMs: holdTime,
        thresholdMs: CONNECTION_LEAK_THRESHOLD,
      });
    }
  });
  
  return {
    hasLeaks: leaks.length > 0,
    leakCount: leaks.length,
    leaks,
    totalTrackedConnections: connectionAcquireTimes.size,
  };
};

// Graceful shutdown (DATABASE-005)
export const shutdownPool = async () => {
  console.log('🔄 Shutting down database connection pool...');
  await pool.end();
  console.log('✅ Database connection pool closed');
};

// Log pool metrics periodically (DATABASE-005)
if (process.env.DB_POOL_METRICS_INTERVAL) {
  const interval = parseInt(process.env.DB_POOL_METRICS_INTERVAL);
  setInterval(() => {
    const metrics = getPoolMetrics();
    console.log('📊 Pool Metrics:', metrics);
    
    const leakStatus = checkConnectionLeaks();
    if (leakStatus.hasLeaks) {
      console.warn('⚠️  Connection Leaks:', leakStatus);
    }
  }, interval);
}

export default pool;
