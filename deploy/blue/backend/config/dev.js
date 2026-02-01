/**
 * Development Environment Configuration (INFRA-008)
 * 
 * Configuration for local development environment.
 * Optimized for developer experience with verbose logging and relaxed security.
 * 
 * NOTE: All secrets MUST come from environment variables, never hardcoded.
 */

import { getEnvVar } from './schema.js';

export default {
  // Environment
  nodeEnv: 'development',

  // Server
  port: getEnvVar('PORT', 'number', 5001),

  // Database
  database: {
    host: getEnvVar('DB_HOST', 'string', 'localhost'),
    port: getEnvVar('DB_PORT', 'number', 5433),
    name: getEnvVar('DB_NAME', 'string', 'titangold_db'),
    user: getEnvVar('DB_USER', 'string', 'postgres'),
    password: getEnvVar('DB_PASSWORD', 'string', undefined), // Optional in dev (trust auth)
    url: getEnvVar('DATABASE_URL', 'string', undefined),
    ssl: getEnvVar('DB_SSL', 'boolean', false),
    sslRejectUnauthorized: getEnvVar('DB_SSL_REJECT_UNAUTHORIZED', 'boolean', false) // Relaxed for dev
  },

  // Database Pool - More relaxed for development
  dbPool: {
    max: getEnvVar('DB_POOL_MAX', 'number', 10), // Lower for dev
    min: getEnvVar('DB_POOL_MIN', 'number', 2),
    idleTimeout: getEnvVar('DB_POOL_IDLE_TIMEOUT', 'number', 30000),
    connectionTimeout: getEnvVar('DB_POOL_CONNECTION_TIMEOUT', 'number', 5000), // Higher timeout for dev
    maxLifetime: getEnvVar('DB_POOL_MAX_LIFETIME', 'number', 3600),
    leakThreshold: getEnvVar('DB_POOL_LEAK_THRESHOLD', 'number', 30000)
  },

  // JWT - Development secrets (must be overridden via env vars)
  jwt: {
    secret: getEnvVar('JWT_SECRET', 'string', 'dev_jwt_secret_change_in_production_minimum_32_chars'),
    expiresIn: getEnvVar('JWT_EXPIRES_IN', 'string', '7d'),
    refreshExpiresIn: getEnvVar('REFRESH_TOKEN_EXPIRES_IN', 'string', '30d')
  },

  // Redis
  redis: {
    url: getEnvVar('REDIS_URL', 'string', 'redis://localhost:6379'),
    password: getEnvVar('REDIS_PASSWORD', 'string', undefined)
  },

  // CORS - Permissive for local development
  cors: {
    allowedOrigins: getEnvVar('CORS_ALLOWED_ORIGINS', 'array', [
      'http://localhost:3000',
      'http://localhost:5173',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:5173',
      'http://localhost:5001' // For API docs
    ])
  },

  // Rate Limiting - More permissive for development
  rateLimit: {
    windowMs: getEnvVar('RATE_LIMIT_WINDOW_MS', 'number', 900000), // 15 minutes
    maxRequests: getEnvVar('RATE_LIMIT_MAX_REQUESTS', 'number', 1000) // Very high for dev
  },

  // Encryption - Development key (must be overridden via env vars)
  encryption: {
    key: getEnvVar('ENCRYPTION_KEY', 'string', 'dev_encryption_key_change_in_prod_32_chars_min')
  },

  // Engine - Disabled by default in dev (runs separately)
  engine: {
    enabled: getEnvVar('ENGINE_ENABLED', 'boolean', false)
  },

  // Git
  git: {
    sha: getEnvVar('GIT_SHA', 'string', 'dev-local')
  },

  // External API
  externalApi: {
    sslVerify: getEnvVar('EXTERNAL_API_SSL_VERIFY', 'boolean', false) // Relaxed for dev
  },

  // Development-specific settings
  logging: {
    level: 'debug',
    prettyPrint: true,
    includeStack: true
  },

  security: {
    helmetEnabled: true,
    corsStrict: false,
    trustProxy: false
  },

  features: {
    swaggerUI: true,
    debugEndpoints: true,
    hotReload: true
  }
};
