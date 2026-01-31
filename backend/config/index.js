/**
 * Configuration Loader (INFRA-008)
 * 
 * Loads environment-specific configuration based on NODE_ENV.
 * Validates configuration on startup to catch errors early.
 * 
 * Usage:
 *   import config from './config/index.js';
 *   console.log(config.database.host);
 */

import dotenv from 'dotenv';
import { validate } from './schema.js';
import devConfig from './dev.js';
import stagingConfig from './staging.js';
import productionConfig from './production.js';

// Load .env file (must happen before config loading)
dotenv.config();

/**
 * Get NODE_ENV with fallback
 */
const nodeEnv = process.env.NODE_ENV || 'development';

/**
 * Load environment-specific configuration
 */
function loadConfig() {
  let config;

  switch (nodeEnv) {
    case 'production':
      config = productionConfig;
      break;

    case 'staging':
      config = stagingConfig;
      break;

    case 'test':
      // Use development config for tests with overrides
      config = {
        ...devConfig,
        nodeEnv: 'test',
        logging: {
          level: 'error', // Suppress logs in tests
          prettyPrint: false,
          includeStack: false
        }
      };
      break;

    case 'development':
    default:
      config = devConfig;
      break;
  }

  return config;
}

/**
 * Validate configuration and throw on errors
 */
function validateAndLoad() {
  const config = loadConfig();

  // Run validation
  const validation = validate(config);

  if (!validation.valid) {
    console.error('❌ Configuration Validation Failed:');
    console.error('');
    validation.errors.forEach(error => {
      console.error(`   ✗ ${error}`);
    });
    console.error('');
    console.error('💡 Fix these errors in your .env file or environment variables');
    console.error('');

    // In production, fail fast
    if (nodeEnv === 'production' || nodeEnv === 'staging') {
      throw new Error('Configuration validation failed. Cannot start server with invalid configuration.');
    } else {
      // In development, warn but continue (for easier setup)
      console.warn('⚠️  Continuing with invalid configuration (development mode)');
      console.warn('⚠️  Some features may not work correctly');
      console.warn('');
    }
  } else {
    console.log('✅ Configuration validated successfully');
    console.log(`📦 Environment: ${config.nodeEnv}`);
    console.log(`🔧 Config source: backend/config/${nodeEnv === 'test' ? 'dev' : nodeEnv}.js`);
    console.log('');
  }

  return config;
}

/**
 * Mask sensitive values for logging
 */
function maskSecrets(config) {
  const masked = JSON.parse(JSON.stringify(config)); // Deep clone

  // Mask known secret fields
  const secretPaths = [
    ['jwt', 'secret'],
    ['database', 'password'],
    ['database', 'url'],
    ['redis', 'password'],
    ['encryption', 'key']
  ];

  secretPaths.forEach(path => {
    let obj = masked;
    for (let i = 0; i < path.length - 1; i++) {
      if (obj[path[i]]) {
        obj = obj[path[i]];
      } else {
        return;
      }
    }
    const key = path[path.length - 1];
    if (obj[key]) {
      obj[key] = obj[key].substring(0, 4) + '****' + obj[key].substring(obj[key].length - 4);
    }
  });

  return masked;
}

/**
 * Get configuration summary for logging (with secrets masked)
 */
export function getConfigSummary() {
  return maskSecrets(config);
}

/**
 * Check if a required secret is missing
 */
export function checkRequiredSecrets() {
  const missing = [];

  const requiredInProduction = [
    { path: 'jwt.secret', env: 'JWT_SECRET' },
    { path: 'database.password', env: 'DB_PASSWORD' },
    { path: 'database.url', env: 'DATABASE_URL' },
    { path: 'encryption.key', env: 'ENCRYPTION_KEY' }
  ];

  if (nodeEnv === 'production' || nodeEnv === 'staging') {
    requiredInProduction.forEach(({ path, env }) => {
      const value = path.split('.').reduce((obj, key) => obj?.[key], config);
      if (!value || value.length < 32) {
        missing.push(`${env} (must be at least 32 characters)`);
      }
    });
  }

  return missing;
}

/**
 * Validate secrets on startup
 */
function validateSecrets() {
  const missing = checkRequiredSecrets();

  if (missing.length > 0) {
    console.error('');
    console.error('❌ Missing Required Secrets:');
    console.error('');
    missing.forEach(secret => {
      console.error(`   ✗ ${secret}`);
    });
    console.error('');
    console.error('💡 Set these environment variables before starting the server');
    console.error('');

    if (nodeEnv === 'production') {
      throw new Error('Required secrets missing. Cannot start production server.');
    } else if (nodeEnv === 'staging') {
      throw new Error('Required secrets missing. Cannot start staging server.');
    } else {
      console.warn('⚠️  Continuing without all secrets (development mode)');
      console.warn('⚠️  Some features requiring encryption/auth will not work');
      console.warn('');
    }
  }
}

// Load and validate configuration
const config = validateAndLoad();

// Validate secrets
validateSecrets();

// Log configuration summary (non-production only)
if (nodeEnv === 'development') {
  console.log('📋 Configuration Summary:');
  console.log(JSON.stringify(getConfigSummary(), null, 2));
  console.log('');
}

// Export configuration
export default config;

// Export utilities
export { maskSecrets, checkRequiredSecrets };
