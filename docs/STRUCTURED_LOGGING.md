# Structured Logging Standards - INFRA-005

## Overview

TitanGold backend uses **Winston** for structured, production-grade logging. All `console.log/error/warn` calls have been replaced with the structured logger.

## Quick Start

```javascript
import { logger } from './services/logger.js';

// Basic logging
logger.info('User logged in', { userId: user.id, method: 'email' });
logger.error('Payment failed', { error: error.message, orderId: order.id });
logger.warn('API rate limit approaching', { current: 450, limit: 500 });
logger.debug('Cache hit', { key: 'user:123', ttl: 3600 });

// Request-scoped logging (via middleware)
req.log.info('Processing request');  // Includes requestId automatically
req.log.error('Request failed', { status: 500 });
```

## Log Levels

| Level | Usage | Example |
|-------|-------|---------|
| `error` | Errors, exceptions, failures | Payment processing errors, database connection failures |
| `warn` | Warnings, potential issues | Rate limits approaching, deprecated API usage |
| `info` | General informational messages | User login, API requests, service startup |
| `http` | HTTP request/response logging | Automatic via `performanceMiddleware` |
| `debug` | Detailed debugging information | Cache operations, query details |

**Production**: Defaults to `info` level (errors, warnings, and info messages)  
**Development**: Set `LOG_LEVEL=debug` for verbose logging

## Configuration

Environment variables in `.env`:

```bash
# Log Level
LOG_LEVEL=info                          # error | warn | info | http | debug

# Environment
NODE_ENV=production                     # Controls format (JSON in production)

# File Logging (enabled by default)
FILE_LOGGING_ENABLED=true
LOG_DIRECTORY=./logs                    # Log file directory
LOG_MAX_SIZE=20m                        # Max file size before rotation
LOG_MAX_FILES=14d                       # Keep logs for 14 days
LOG_DATE_PATTERN=YYYY-MM-DD             # Daily rotation

# Centralized Logging (optional)
LOGTAIL_ENABLED=false                   # Enable Logtail integration
LOGTAIL_SOURCE_TOKEN=your_token_here    # Logtail source token
```

## Log Formats

### Development Format (Human-Readable)
```
2026-01-07 14:32:15.423 [info] [a3f2b8c1]: User logged in {"userId": 123, "method": "email"}
2026-01-07 14:32:16.128 [error] [a3f2b8c1]: Database query failed {"query": "SELECT ...", "duration": 1250}
```

### Production Format (JSON)
```json
{
  "timestamp": "2026-01-07T14:32:15.423Z",
  "level": "info",
  "message": "User logged in",
  "requestId": "a3f2b8c1-5e2f-4a3b-9c1d-7e8f9a0b1c2d",
  "userId": 123,
  "method": "email",
  "service": "titangold-backend",
  "hostname": "api-server-01",
  "pid": 12345
}
```

## Best Practices

### ✅ DO

```javascript
// Include structured metadata
logger.info('Trade executed', {
  userId: user.id,
  symbol: 'BTC/USDT',
  amount: 0.5,
  price: 42000,
  exchange: 'binance'
});

// Use request-scoped logger (includes requestId)
req.log.info('Fetching user portfolio', { userId: req.user.id });

// Log exceptions with context
try {
  await processPayment(order);
} catch (error) {
  logger.error('Payment processing failed', {
    error: error.message,
    stack: error.stack,
    orderId: order.id,
    userId: user.id
  });
}

// Use helper functions
import { logException, logSecurityEvent } from './services/logger.js';

logException(error, { userId, action: 'trade_execution' });
logSecurityEvent('invalid_token', { userId, ip: req.ip });
```

### ❌ DON'T

```javascript
// Don't use console.* directly
console.log('User logged in');  // ❌ Not structured, no metadata

// Don't log sensitive data
logger.info('User auth', { password: '123456' });  // ❌ Security risk

// Don't log entire objects without filtering
logger.info('Request data', req);  // ❌ Too verbose, circular refs

// Don't use string concatenation
logger.info('User ' + user.id + ' logged in');  // ❌ Not structured
```

## Correlation IDs

Every HTTP request automatically receives a **correlation ID** (requestId) for tracing:

```javascript
// Middleware automatically adds requestId
app.use(requestContextMiddleware);

// Use request-scoped logger
router.get('/api/v1/users/:id', async (req, res) => {
  req.log.info('Fetching user');  // Includes requestId
  
  const user = await getUser(req.params.id);
  
  req.log.info('User fetched', { username: user.username });
});

// Correlation ID in response headers
// x-request-id: a3f2b8c1-5e2f-4a3b-9c1d-7e8f9a0b1c2d
// x-correlation-id: a3f2b8c1-5e2f-4a3b-9c1d-7e8f9a0b1c2d
```

## Performance Logging

The `performanceMiddleware` automatically logs all HTTP requests:

```javascript
app.use(performanceMiddleware);

// Logs every request with:
// - HTTP method and path
// - Status code
// - Response time
// - User ID (if authenticated)
// - IP address and user agent
```

Example log output:
```json
{
  "level": "info",
  "message": "request_completed",
  "requestId": "a3f2b8c1-5e2f-4a3b-9c1d-7e8f9a0b1c2d",
  "method": "GET",
  "path": "/api/v1/portfolios",
  "status": 200,
  "durationMs": 45.32,
  "userId": 123,
  "ip": "192.168.1.100",
  "userAgent": "Mozilla/5.0...",
  "contentLength": 2548
}
```

## Log Files

Logs are automatically rotated daily:

```
logs/
├── combined-2026-01-07.log      # All log levels
├── combined-2026-01-06.log
├── error-2026-01-07.log         # Error logs only
├── error-2026-01-06.log
└── ...
```

- **Retention**: 14 days (configurable via `LOG_MAX_FILES`)
- **Max Size**: 20MB per file (configurable via `LOG_MAX_SIZE`)
- **Format**: JSON (always, for easy parsing)

## Centralized Logging

### Logtail Integration

Enable centralized logging to ship logs to Logtail:

```bash
LOGTAIL_ENABLED=true
LOGTAIL_SOURCE_TOKEN=your_token_here
```

Logs are automatically sent via HTTPS to Logtail for:
- Real-time log aggregation
- Advanced searching and filtering
- Alerting and monitoring
- Long-term retention

### Other Services

For other log aggregation services (Datadog, Papertrail, Splunk), configure Winston HTTP transport:

```javascript
import winston from 'winston';

transports.push(
  new winston.transports.Http({
    host: 'logs.example.com',
    path: '/logs',
    ssl: true,
    headers: { 'Authorization': 'Bearer YOUR_TOKEN' },
  })
);
```

## Helper Functions

### logException
Log exceptions with full context:
```javascript
import { logException } from './services/logger.js';

try {
  await riskyOperation();
} catch (error) {
  logException(error, {
    userId: user.id,
    action: 'trade_execution',
    tradeId: trade.id
  });
}
```

### logDatabaseQuery
Debug database performance:
```javascript
import { logDatabaseQuery } from './services/logger.js';

const start = Date.now();
const result = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
logDatabaseQuery(query, [userId], Date.now() - start);
```

### logSecurityEvent
Track security-related events:
```javascript
import { logSecurityEvent } from './services/logger.js';

logSecurityEvent('failed_login_attempt', {
  username: req.body.username,
  ip: req.ip,
  userAgent: req.headers['user-agent']
});
```

### logMetric
Business metrics logging:
```javascript
import { logMetric } from './services/logger.js';

logMetric('trade_volume', 10000, {
  exchange: 'binance',
  symbol: 'BTC/USDT',
  userId: user.id
});
```

## Migration from console.*

All `console.log/error/warn/info/debug` calls have been replaced with `logger.*`:

| Before | After |
|--------|-------|
| `console.log('message')` | `logger.info('message')` |
| `console.error('error:', err)` | `logger.error('error', { error: err.message })` |
| `console.warn('warning')` | `logger.warn('warning')` |
| `console.info('info')` | `logger.info('info')` |
| `console.debug('debug')` | `logger.debug('debug')` |

## Graceful Shutdown

The logger automatically handles graceful shutdown:

```javascript
// On SIGTERM/SIGINT
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received');
  await closeLogger();  // Flush all logs
  process.exit(0);
});
```

## Testing

In test environments (`NODE_ENV=test`):

```javascript
// Logger still works but server doesn't listen
if (process.env.NODE_ENV === 'test') {
  logger.info('Running in test mode');
}
```

## Troubleshooting

### Logs not appearing

1. Check `LOG_LEVEL` environment variable
2. Verify file permissions for log directory
3. Check `FILE_LOGGING_ENABLED` is not `false`

### Logs too verbose

```bash
# Reduce log level
LOG_LEVEL=warn  # Only warnings and errors
```

### Performance impact

- Logging is asynchronous (non-blocking)
- File rotation is handled by `winston-daily-rotate-file`
- Minimal performance overhead (~0.1ms per log entry)

## Examples

### Route Handler
```javascript
import { logger } from '../services/logger.js';

router.post('/api/v1/trades', auth, async (req, res) => {
  const { symbol, amount, side } = req.body;
  
  req.log.info('Trade request received', { symbol, amount, side });
  
  try {
    const trade = await executeTrade({ symbol, amount, side, userId: req.user.id });
    
    req.log.info('Trade executed successfully', {
      tradeId: trade.id,
      executionPrice: trade.price,
      fee: trade.fee
    });
    
    res.json({ success: true, trade });
  } catch (error) {
    req.log.error('Trade execution failed', {
      error: error.message,
      stack: error.stack,
      symbol,
      amount,
      side
    });
    
    res.status(500).json({ error: 'Trade execution failed' });
  }
});
```

### Service/Worker
```javascript
import { logger } from './services/logger.js';

class AutopilotWorker {
  async start() {
    logger.info('Autopilot worker starting', { interval: '5min' });
    
    setInterval(async () => {
      try {
        logger.debug('Running autopilot cycle');
        await this.runCycle();
        logger.info('Autopilot cycle completed');
      } catch (error) {
        logger.error('Autopilot cycle failed', {
          error: error.message,
          stack: error.stack
        });
      }
    }, 5 * 60 * 1000);
  }
}
```

## References

- [Winston Documentation](https://github.com/winstonjs/winston)
- [winston-daily-rotate-file](https://github.com/winstonjs/winston-daily-rotate-file)
- [Logtail](https://betterstack.com/logs)

## Change Log

- **2026-01-07**: Initial implementation (INFRA-005)
  - Migrated from console.* to Winston
  - Added structured logging with correlation IDs
  - Configured log rotation (14 days retention)
  - Added Logtail integration support
  - Created logging helper functions
  - Replaced 2083 console calls across 174 files
