/**
 * Staging Environment Configuration (INFRA-008)
 * 
 * Configuration for staging/QA environment.
 * Production-like settings with some debug capabilities for testing.
 * 
 * NOTE: All secrets MUST come from environment variables, never hardcoded.
 */

import { getEnvVar } from './schema.js';

export default {
  // Environment
  nodeEnv: 'staging',

  // Server
  port: getEnvVar('PORT', 'number', 5001),

  // Database - All values MUST come from environment
  database: {
    host: getEnvVar('DB_HOST', 'string'),
    port: getEnvVar('DB_PORT', 'number', 5432),
    name: getEnvVar('DB_NAME', 'string'),
    user: getEnvVar('DB_USER', 'string'),
    password: getEnvVar('DB_PASSWORD', 'string'), // Required in staging
    url: getEnvVar('DATABASE_URL', 'string'),
    ssl: getEnvVar('DB_SSL', 'boolean', true), // Enforce SSL in staging
    sslRejectUnauthorized: getEnvVar('DB_SSL_REJECT_UNAUTHORIZED', 'boolean', true)
  },

  // Database Pool - Production-like settings
  dbPool: {
    max: getEnvVar('DB_POOL_MAX', 'number', 20),
    min: getEnvVar('DB_POOL_MIN', 'number', 5),
    idleTimeout: getEnvVar('DB_POOL_IDLE_TIMEOUT', 'number', 30000),
    connectionTimeout: getEnvVar('DB_POOL_CONNECTION_TIMEOUT', 'number', 2000),
    maxLifetime: getEnvVar('DB_POOL_MAX_LIFETIME', 'number', 3600),
    leakThreshold: getEnvVar('DB_POOL_LEAK_THRESHOLD', 'number', 30000)
  },

  // JWT - MUST be provided via environment variables
  jwt: {
    secret: getEnvVar('JWT_SECRET', 'string'), // Required - no default
    expiresIn: getEnvVar('JWT_EXPIRES_IN', 'string', '7d'),
    refreshExpiresIn: getEnvVar('REFRESH_TOKEN_EXPIRES_IN', 'string', '30d')
  },

  // Redis
  redis: {
    url: getEnvVar('REDIS_URL', 'string', 'redis://localhost:6379'),
    password: getEnvVar('REDIS_PASSWORD', 'string') // Often required in staging
  },

  // CORS - Staging domain whitelisting
  cors: {
    allowedOrigins: getEnvVar('CORS_ALLOWED_ORIGINS', 'array', [
      'https://staging.titangold.com',
      'https://staging-app.titangold.com',
      'http://localhost:3000' // For testing
    ])
  },

  // Rate Limiting - Production-like but slightly more permissive
  rateLimit: {
    windowMs: getEnvVar('RATE_LIMIT_WINDOW_MS', 'number', 900000), // 15 minutes
    maxRequests: getEnvVar('RATE_LIMIT_MAX_REQUESTS', 'number', 200)
  },

  // Encryption - MUST be provided via environment variables
  encryption: {
    key: getEnvVar('ENCRYPTION_KEY', 'string') // Required - no default
  },

  // Engine
  engine: {
    enabled: getEnvVar('ENGINE_ENABLED', 'boolean', false)
  },

  // Git
  git: {
    sha: getEnvVar('GIT_SHA', 'string', 'staging-unknown')
  },

  // External API
  externalApi: {
    sslVerify: getEnvVar('EXTERNAL_API_SSL_VERIFY', 'boolean', true) // Enforce SSL verification
  },

  // Staging-specific settings
  logging: {
    level: 'info',
    prettyPrint: false,
    includeStack: true // Keep stack traces for debugging
  },

  security: {
    helmetEnabled: true,
    corsStrict: true,
    trustProxy: true // Usually behind load balancer
  },

  features: {
    swaggerUI: true, // Keep API docs for testing
    debugEndpoints: true, // Allow debug endpoints
    hotReload: false
  }
};
