# Configuration Management (INFRA-008)

**Status**: ✅ PRODUCTION-READY  
**Last Updated**: 2026-01-31  
**Owner**: Infrastructure Team

## Overview

TitanGold implements environment-specific configuration management with automatic validation, secret protection, and clear separation between development, staging, and production environments.

## Key Features

✅ **Environment-Specific Configs** - Separate configuration files for dev/staging/production  
✅ **Automatic Loading** - Loads correct config based on NODE_ENV  
✅ **Secret Protection** - All secrets MUST be in environment variables, never hardcoded  
✅ **Startup Validation** - Validates configuration before server starts  
✅ **Type Safety** - Enforces types, ranges, and required fields  
✅ **Clear Defaults** - Sensible defaults for development, strict requirements for production  

## Architecture

### File Structure

```
backend/
├── config/
│   ├── index.js           # Main config loader with validation
│   ├── schema.js          # Configuration schema and validation rules
│   ├── dev.js             # Development environment config
│   ├── staging.js         # Staging environment config
│   └── production.js      # Production environment config
└── __tests__/
    └── config/
        └── schema.test.js # Unit tests (17 tests)
```

### Configuration Flow

```
1. Load .env file (dotenv)
2. Determine NODE_ENV (development/staging/production/test)
3. Load environment-specific config file
4. Validate config against schema
5. Check required secrets
6. Start server (or fail with clear error messages)
```

## Usage

### Basic Usage

```javascript
// Import configuration
import config from './config/index.js';

// Access configuration values
console.log(config.database.host);
console.log(config.jwt.secret);
console.log(config.cors.allowedOrigins);
```

### Configuration Summary

```javascript
import { getConfigSummary } from './config/index.js';

// Get configuration with secrets masked
const summary = getConfigSummary();
console.log(summary);
// Output: { jwt: { secret: "abcd****wxyz" }, ... }
```

### Check Required Secrets

```javascript
import { checkRequiredSecrets } from './config/index.js';

const missing = checkRequiredSecrets();
if (missing.length > 0) {
  console.error('Missing secrets:', missing);
}
```

## Environment-Specific Configurations

### Development (`NODE_ENV=development`)

**Purpose**: Local development with relaxed security for developer productivity

**Characteristics**:
- ✅ Default values for most settings
- ✅ Permissive CORS (localhost origins)
- ✅ High rate limits (1000 req/15min)
- ✅ Verbose logging (debug level)
- ✅ API docs enabled (Swagger UI)
- ✅ Debug endpoints enabled
- ⚠️ SSL verification disabled for external APIs
- ⚠️ Weak default secrets (must override for real usage)

**Configuration File**: `backend/config/dev.js`

**Example .env**:
```bash
NODE_ENV=development
PORT=5001
DB_HOST=localhost
DB_PORT=5433
DB_NAME=titangold_db
DB_USER=postgres
# No password needed for local trust auth
JWT_SECRET=your_dev_jwt_secret_min_32_chars
ENCRYPTION_KEY=your_dev_encryption_key_32_chars
```

### Staging (`NODE_ENV=staging`)

**Purpose**: Production-like environment for QA and testing

**Characteristics**:
- ✅ Production-like settings
- ✅ SSL enforced for database
- ✅ Strict CORS with staging domains
- ✅ Moderate rate limits (200 req/15min)
- ✅ Info-level logging
- ✅ API docs enabled (for testing)
- ✅ Debug endpoints enabled
- ⚠️ Requires all secrets from environment
- ⚠️ No default secrets

**Configuration File**: `backend/config/staging.js`

**Example .env**:
```bash
NODE_ENV=staging
PORT=5001
DB_HOST=staging-db.example.com
DB_PORT=5432
DB_NAME=titangold_staging
DB_USER=titangold_app
DB_PASSWORD=<from-secrets-manager>
DATABASE_URL=postgresql://user:pass@host:5432/db
JWT_SECRET=<from-secrets-manager>
ENCRYPTION_KEY=<from-secrets-manager>
REDIS_URL=redis://staging-redis.example.com:6379
REDIS_PASSWORD=<from-secrets-manager>
CORS_ALLOWED_ORIGINS=https://staging.titangold.com,https://staging-app.titangold.com
```

### Production (`NODE_ENV=production`)

**Purpose**: Live production environment with maximum security

**Characteristics**:
- ✅ Maximum security settings
- ✅ SSL enforced everywhere
- ✅ Strict CORS whitelisting
- ✅ Conservative rate limits (100 req/15min)
- ✅ Warn-level logging only
- ✅ API docs disabled
- ✅ Debug endpoints disabled
- ⚠️ ALL secrets required from environment
- ⚠️ NO defaults for sensitive values
- ⚠️ Fails startup if secrets missing

**Configuration File**: `backend/config/production.js`

**Example .env**:
```bash
NODE_ENV=production
PORT=5001
DB_HOST=prod-db.example.com
DB_PORT=5432
DB_NAME=titangold_production
DB_USER=titangold_app
DB_PASSWORD=<from-secrets-manager>
DATABASE_URL=postgresql://user:pass@host:5432/db
JWT_SECRET=<from-secrets-manager>
ENCRYPTION_KEY=<from-secrets-manager>
REDIS_URL=redis://prod-redis.example.com:6379
REDIS_PASSWORD=<from-secrets-manager>
CORS_ALLOWED_ORIGINS=https://titangold.com,https://www.titangold.com,https://app.titangold.com
GIT_SHA=<from-ci-cd>
```

## Configuration Schema

### Complete Schema Reference

```javascript
{
  // Environment (required)
  nodeEnv: string, // 'development' | 'staging' | 'production' | 'test'
  
  // Server (required)
  port: number, // 1-65535
  
  // Database (required)
  database: {
    host: string,
    port: number, // 1-65535
    name: string,
    user: string,
    password: string, // SECRET - optional in dev, required in staging/prod
    url: string, // SECRET - optional in dev, required in staging/prod
    ssl: boolean,
    sslRejectUnauthorized: boolean
  },
  
  // Database Pool (optional, has defaults)
  dbPool: {
    max: number, // 1-100, default: 20
    min: number, // 0-50, default: 2
    idleTimeout: number, // milliseconds, default: 30000
    connectionTimeout: number, // milliseconds, default: 2000
    maxLifetime: number, // seconds, default: 3600
    leakThreshold: number // milliseconds, default: 30000
  },
  
  // JWT (required)
  jwt: {
    secret: string, // SECRET - min 32 chars
    expiresIn: string, // default: '7d'
    refreshExpiresIn: string // default: '30d'
  },
  
  // Redis (optional)
  redis: {
    url: string,
    password: string // SECRET
  },
  
  // CORS (optional, has defaults)
  cors: {
    allowedOrigins: string[] // array of origin URLs
  },
  
  // Rate Limiting (optional, has defaults)
  rateLimit: {
    windowMs: number, // milliseconds, default: 900000
    maxRequests: number // default: 100
  },
  
  // Encryption (required)
  encryption: {
    key: string // SECRET - min 32 chars
  },
  
  // Engine (optional)
  engine: {
    enabled: boolean // default: false
  },
  
  // Git (optional)
  git: {
    sha: string // commit SHA for versioning
  },
  
  // External API (optional)
  externalApi: {
    sslVerify: boolean // default: true
  }
}
```

### Secret Fields

These fields MUST come from environment variables in production:

- `jwt.secret` → `JWT_SECRET`
- `database.password` → `DB_PASSWORD`
- `database.url` → `DATABASE_URL`
- `redis.password` → `REDIS_PASSWORD`
- `encryption.key` → `ENCRYPTION_KEY`

**⚠️ Never commit secrets to version control!**

## Validation

### Startup Validation

Configuration is validated automatically on server startup:

```
✅ Configuration validated successfully
📦 Environment: production
🔧 Config source: backend/config/production.js
```

### Validation Failures

If validation fails, the server will display clear error messages:

```
❌ Configuration Validation Failed:

   ✗ jwt.secret is required
   ✗ database.password is required
   ✗ encryption.key must be at least 32 characters long

💡 Fix these errors in your .env file or environment variables
```

**Behavior by Environment**:
- **Production/Staging**: Server fails to start (exit with error)
- **Development**: Server warns but continues (for easier setup)

### Secret Validation

Required secrets are checked separately:

```
❌ Missing Required Secrets:

   ✗ JWT_SECRET (must be at least 32 characters)
   ✗ ENCRYPTION_KEY (must be at least 32 characters)

💡 Set these environment variables before starting the server
```

## Testing

### Running Tests

```bash
# Run configuration tests
npm test -- backend/__tests__/config/schema.test.js

# Run with coverage
npm test -- --coverage backend/__tests__/config/schema.test.js

# Watch mode
npm test -- --watch backend/__tests__/config/schema.test.js
```

### Test Coverage

**17 Unit Tests** covering:
- ✅ Environment variable parsing (string, number, boolean, array)
- ✅ Configuration validation (valid configs pass)
- ✅ Required field validation
- ✅ Type constraint validation
- ✅ Enum constraint validation
- ✅ Length constraint validation (min length for secrets)
- ✅ Numeric range validation (min/max)
- ✅ Boolean type validation
- ✅ Array type validation
- ✅ Optional field handling
- ✅ Nested object validation
- ✅ Schema structure verification
- ✅ Secret field marking
- ✅ Environment variable mapping

**Test Results**:
```bash
✓ backend/__tests__/config/schema.test.js (17 tests)
  Test Files  1 passed (1)
       Tests  17 passed (17)
```

## Deployment

### Docker

```dockerfile
# In Dockerfile
ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}

# Secrets via environment at runtime
CMD ["node", "backend/server.js"]
```

```bash
# Build
docker build --build-arg NODE_ENV=production -t titangold:latest .

# Run with secrets from environment
docker run \
  -e NODE_ENV=production \
  -e DB_HOST=db.example.com \
  -e DB_PASSWORD=$DB_PASSWORD \
  -e JWT_SECRET=$JWT_SECRET \
  -e ENCRYPTION_KEY=$ENCRYPTION_KEY \
  titangold:latest
```

### Docker Compose

```yaml
version: '3.8'
services:
  backend:
    image: titangold:latest
    environment:
      NODE_ENV: production
      DB_HOST: postgres
      DB_NAME: titangold
      DB_USER: titangold_app
      # Secrets from .env file (not committed)
      DB_PASSWORD: ${DB_PASSWORD}
      JWT_SECRET: ${JWT_SECRET}
      ENCRYPTION_KEY: ${ENCRYPTION_KEY}
    env_file:
      - .env.production.local # Never commit this file
```

### Kubernetes

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: titangold-config
data:
  NODE_ENV: "production"
  DB_HOST: "postgres.default.svc.cluster.local"
  DB_NAME: "titangold"
  CORS_ALLOWED_ORIGINS: "https://titangold.com,https://app.titangold.com"

---
apiVersion: v1
kind: Secret
metadata:
  name: titangold-secrets
type: Opaque
data:
  DB_PASSWORD: <base64-encoded>
  JWT_SECRET: <base64-encoded>
  ENCRYPTION_KEY: <base64-encoded>
  REDIS_PASSWORD: <base64-encoded>

---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: titangold-backend
spec:
  template:
    spec:
      containers:
      - name: backend
        image: titangold:latest
        envFrom:
        - configMapRef:
            name: titangold-config
        - secretRef:
            name: titangold-secrets
```

### AWS ECS/Fargate

```json
{
  "containerDefinitions": [{
    "name": "titangold-backend",
    "image": "titangold:latest",
    "environment": [
      { "name": "NODE_ENV", "value": "production" },
      { "name": "DB_HOST", "value": "db.example.com" },
      { "name": "DB_NAME", "value": "titangold" }
    ],
    "secrets": [
      {
        "name": "DB_PASSWORD",
        "valueFrom": "arn:aws:secretsmanager:region:account:secret:db-password"
      },
      {
        "name": "JWT_SECRET",
        "valueFrom": "arn:aws:secretsmanager:region:account:secret:jwt-secret"
      },
      {
        "name": "ENCRYPTION_KEY",
        "valueFrom": "arn:aws:secretsmanager:region:account:secret:encryption-key"
      }
    ]
  }]
}
```

## Best Practices

### ✅ Do's

1. **Always use environment variables for secrets**
   ```bash
   # Good
   JWT_SECRET=<from-secrets-manager>
   
   # Bad - Never hardcode
   jwt: { secret: 'my-secret-123' }
   ```

2. **Use different secrets per environment**
   ```bash
   # Development
   JWT_SECRET=dev_secret_32_chars_minimum_length
   
   # Production
   JWT_SECRET=<strong-random-secret-from-secrets-manager>
   ```

3. **Validate configuration in CI/CD**
   ```bash
   # In CI pipeline
   NODE_ENV=production npm run validate-config
   ```

4. **Use secrets managers in production**
   - AWS Secrets Manager
   - HashiCorp Vault
   - Google Secret Manager
   - Azure Key Vault

5. **Set NODE_ENV explicitly**
   ```bash
   export NODE_ENV=production
   ```

6. **Review configuration on deployment**
   ```bash
   # Check config summary (secrets masked)
   node -e "import('./backend/config/index.js').then(c => console.log(c.getConfigSummary()))"
   ```

### ❌ Don'ts

1. **Don't commit .env files with secrets**
   ```bash
   # In .gitignore
   .env
   .env.local
   .env.production
   .env.*.local
   ```

2. **Don't use weak secrets in production**
   ```bash
   # Bad - too short, too simple
   JWT_SECRET=secret123
   
   # Good - long, random, from secrets manager
   JWT_SECRET=<64-char-random-string>
   ```

3. **Don't share secrets between environments**
   ```bash
   # Bad - same secret for dev and prod
   # Good - different secrets per environment
   ```

4. **Don't ignore validation errors in production**
   ```bash
   # Bad - continuing with invalid config
   # Good - server fails to start with clear error
   ```

5. **Don't hardcode environment-specific values**
   ```javascript
   // Bad
   const dbHost = nodeEnv === 'production' ? 'prod-db' : 'localhost';
   
   // Good
   const dbHost = config.database.host;
   ```

## Troubleshooting

### Issue: Configuration validation fails

**Cause**: Missing or invalid environment variables

**Solution**:
1. Check error message for specific field
2. Verify environment variable is set
3. Check .env file syntax (no spaces around =)
4. Ensure secrets meet minimum length requirements

### Issue: Server fails to start in production

**Cause**: Missing required secrets

**Solution**:
1. Review error message for missing secrets
2. Verify secrets are available in secrets manager
3. Check IAM permissions for accessing secrets
4. Ensure environment variables are passed to container

### Issue: Wrong configuration loaded

**Cause**: NODE_ENV not set correctly

**Solution**:
```bash
# Check current NODE_ENV
echo $NODE_ENV

# Set explicitly
export NODE_ENV=production

# Or in .env file
NODE_ENV=production
```

### Issue: Secrets visible in logs

**Cause**: Logging raw configuration object

**Solution**:
```javascript
// Bad
console.log(config);

// Good
import { getConfigSummary } from './config/index.js';
console.log(getConfigSummary());
```

### Issue: Configuration changes not applied

**Cause**: Environment variables cached or not reloaded

**Solution**:
1. Restart server after changing .env
2. Check if process manager (PM2, systemd) needs reload
3. In Docker, rebuild image if ENV set at build time
4. In Kubernetes, restart pods after ConfigMap/Secret changes

## Security Considerations

### Secret Management

1. **Never commit secrets to git**
   - Use `.gitignore` for .env files
   - Use git-secrets or similar tools to prevent leaks

2. **Use strong secrets in production**
   - Minimum 32 characters
   - Random, cryptographically secure
   - Rotate regularly

3. **Limit secret access**
   - Only authorized systems can read secrets
   - Use IAM roles/policies
   - Audit secret access

4. **Encrypt secrets at rest**
   - Use KMS for encryption
   - Store in secrets manager
   - Never in plain text files

### Configuration Security

1. **Validate all inputs** - Schema validation catches errors early
2. **Fail fast in production** - Don't start with invalid config
3. **Mask secrets in logs** - Use `getConfigSummary()` for logging
4. **Audit configuration changes** - Track who changed what in secrets manager

## Migration Guide

### Migrating from Direct process.env Usage

**Before**:
```javascript
const port = parseInt(process.env.PORT) || 5001;
const dbHost = process.env.DB_HOST || 'localhost';
const jwtSecret = process.env.JWT_SECRET;
```

**After**:
```javascript
import config from './config/index.js';

const port = config.port;
const dbHost = config.database.host;
const jwtSecret = config.jwt.secret;
```

### Migrating Existing .env Files

1. Review your current .env file
2. Map values to new schema
3. Add missing required fields
4. Ensure secrets meet minimum length
5. Test with `NODE_ENV=development npm start`

## Follow-up Tasks

### High Priority (P1)
- **INFRA-024**: Add runtime config reload without restart
- **INFRA-025**: Implement config versioning and rollback

### Medium Priority (P2)
- **INFRA-026**: Add config validation CLI tool
- **INFRA-027**: Implement feature flags system
- **INFRA-028**: Add config change auditing

### Low Priority (P3)
- **INFRA-029**: Create config management dashboard
- **INFRA-030**: Add automated config migration tool

## References

- [The Twelve-Factor App - Config](https://12factor.net/config)
- [Node.js Environment Variables Best Practices](https://nodejs.org/en/learn/command-line/how-to-read-environment-variables-from-nodejs)
- [OWASP Secrets Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html)

---

**Task**: INFRA-008  
**Status**: ✅ PRODUCTION-READY  
**Date**: 2026-01-31
