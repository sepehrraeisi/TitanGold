# Graceful Shutdown (INFRA-007)

**Status**: ✅ PRODUCTION-READY  
**Last Updated**: 2026-01-31  
**Owner**: Infrastructure Team

## Overview

TitanGold implements comprehensive graceful shutdown handling to ensure zero data loss and clean termination of all connections during server restarts, deployments, or scaling events.

## Features

### ✅ Signal Handling
- **SIGTERM**: Graceful shutdown (Docker, Kubernetes, systemd)
- **SIGINT**: Graceful shutdown (Ctrl+C in terminal)
- **uncaughtException**: Emergency shutdown with cleanup attempt
- **unhandledRejection**: Emergency shutdown with cleanup attempt

### ✅ Shutdown Sequence

The graceful shutdown follows this precise 5-step sequence:

#### Step 1: Stop Accepting New Requests
- Shutdown middleware rejects new requests with `503 Service Unavailable`
- Sets `Connection: close` header to inform clients
- Returns `retryAfter: 10` seconds for client retry logic

#### Step 2: Wait for In-Flight Requests (Max 30s)
- Monitors active HTTP connections
- Waits for all in-flight requests to complete
- Force closes after 30-second timeout if needed
- Logs connection count and elapsed time

#### Step 3: Close Background Services
Services are closed in this order:
1. **Engine Worker** (if enabled via `ENGINE_ENABLED=true`)
2. **Favorites Alert Monitor**
3. **Autopilot Worker**
4. **Favorites WebSocket Service**
5. **Message Queue**

#### Step 4: Close Redis Connections
- Checks if Redis is available
- Calls `closeRedis()` to gracefully disconnect
- Skips if Redis was never connected

#### Step 5: Close Database Connections
- Logs database pool statistics (total, idle, waiting)
- Calls `pool.end()` to close all PostgreSQL connections
- Waits for connections to drain

### ✅ Exit Codes
- **0**: Successful graceful shutdown
- **1**: Error during shutdown (logged with full stack trace)

## Architecture

### Files

```
backend/
├── utils/
│   └── shutdown.js         # Graceful shutdown utility
├── server.js               # Server with shutdown integration
└── __tests__/
    └── utils/
        └── shutdown.test.js # Unit tests (24 tests)
```

### Key Components

#### 1. Shutdown Utility (`backend/utils/shutdown.js`)

**Exports:**
- `gracefulShutdown(options)` - Main shutdown orchestration
- `registerShutdownHandlers(options)` - Register signal handlers
- `shutdownMiddleware` - Express middleware to reject requests during shutdown
- `isShutdownInProgress()` - Check if shutdown is active
- `getShutdownElapsedTime()` - Get shutdown duration in ms

**Options:**
```javascript
{
  server: httpServer,      // HTTP server instance
  services: {              // Background services to shut down
    messageQueue,
    engineWorker,
    favoritesWebSocketService,
    favoritesAlertMonitor,
    autopilotWorker
  },
  signal: 'SIGTERM'        // Signal that triggered shutdown
}
```

#### 2. Shutdown Middleware

Middleware that rejects requests during shutdown:

```javascript
app.use(shutdownMiddleware);
```

Response during shutdown:
```json
{
  "error": "Service Unavailable",
  "message": "Server is shutting down",
  "retryAfter": 10
}
```

#### 3. Signal Handler Registration

Register handlers in `server.js`:

```javascript
registerShutdownHandlers({ 
  server, 
  services: backgroundServices 
});
```

## Usage

### Server Integration

```javascript
import { 
  shutdownMiddleware, 
  registerShutdownHandlers 
} from './utils/shutdown.js';

const app = express();
const backgroundServices = {};

// Add shutdown middleware early in the stack
app.use(shutdownMiddleware);

// ... other middleware and routes ...

// Start server
const server = app.listen(PORT, () => {
  console.log('Server started');
  
  // Initialize services and track them
  backgroundServices.messageQueue = messageQueue;
  backgroundServices.engineWorker = engineWorker;
  // ... more services ...
  
  // Register shutdown handlers
  registerShutdownHandlers({ server, services: backgroundServices });
});
```

### Manual Shutdown

```javascript
import { gracefulShutdown } from './utils/shutdown.js';

// Trigger shutdown programmatically
await gracefulShutdown({
  server: httpServer,
  services: {
    messageQueue,
    engineWorker
  },
  signal: 'manual'
});
```

### Check Shutdown Status

```javascript
import { 
  isShutdownInProgress, 
  getShutdownElapsedTime 
} from './utils/shutdown.js';

if (isShutdownInProgress()) {
  console.log(`Shutdown in progress for ${getShutdownElapsedTime()}ms`);
}
```

## Configuration

### Environment Variables

```bash
# No specific env vars - uses existing service configurations
# Shutdown timeout is hardcoded to 30 seconds (can be made configurable)
```

### Timeout Settings

```javascript
// In shutdown.js
const SHUTDOWN_TIMEOUT = 30000; // 30 seconds
```

To customize, modify the constant or make it configurable via environment variable.

## Behavior Examples

### Normal Shutdown (No Active Requests)

```
🛑 ============================================
🛑 Graceful Shutdown Initiated (SIGTERM)
🛑 ============================================
📛 Step 1/5: Stopped accepting new requests
⏳ Step 2/5: Waiting for in-flight requests (max 30s)...
🔄 Waiting for 0 in-flight request(s) to complete...
✅ HTTP server closed gracefully (15ms)
🛠️ Step 3/5: Closing background services...
🛑 Stopping Engine Worker...
✅ Engine Worker stopped
🛑 Stopping Favorites Alert Monitor...
✅ Favorites Alert Monitor stopped
🛑 Closing Message Queue...
✅ Message Queue closed
🔴 Step 4/5: Closing Redis connections...
🔌 Closing Redis connections...
✅ Redis connections closed
🗄️ Step 5/5: Closing database connections...
🔌 Closing database connections...
📊 Database pool stats: total=5, idle=3, waiting=0
✅ Database connections closed

✅ ============================================
✅ Graceful Shutdown Complete (247ms)
✅ ============================================
```

### Shutdown with Active Requests

```
🛑 Graceful Shutdown Initiated (SIGTERM)
📛 Step 1/5: Stopped accepting new requests
⏳ Step 2/5: Waiting for in-flight requests (max 30s)...
🔄 Waiting for 3 in-flight request(s) to complete...
✅ HTTP server closed gracefully (1523ms)
...
✅ Graceful Shutdown Complete (1847ms)
```

### Shutdown Timeout (Force Close)

```
🛑 Graceful Shutdown Initiated (SIGTERM)
...
⏳ Step 2/5: Waiting for in-flight requests (max 30s)...
🔄 Waiting for 5 in-flight request(s) to complete...
⏱️ Shutdown timeout reached (30000ms), forcing close
⚠️ Forcing close with 2 active connections
...
✅ Graceful Shutdown Complete (30124ms)
```

### Error During Shutdown

```
🛑 Graceful Shutdown Initiated (SIGTERM)
...
❌ Error closing database connections: Connection lost
❌ ============================================
❌ Shutdown Error (342ms)
❌ ============================================
❌ Error during graceful shutdown: Connection lost
[Stack trace]
```

## Testing

### Running Tests

```bash
# Run all shutdown tests
npm test -- backend/__tests__/utils/shutdown.test.js

# Run with coverage
npm test -- --coverage backend/__tests__/utils/shutdown.test.js

# Run in watch mode
npm test -- --watch backend/__tests__/utils/shutdown.test.js
```

### Test Coverage

**24 Unit Tests** covering:
- ✅ Shutdown middleware behavior
- ✅ SIGTERM/SIGINT signal handling
- ✅ In-flight request waiting
- ✅ Timeout handling (30s)
- ✅ Service closure order
- ✅ Database connection closure
- ✅ Redis connection closure
- ✅ Error handling
- ✅ Duplicate shutdown prevention
- ✅ Exit code verification (0 or 1)
- ✅ Shutdown timing and elapsed time
- ✅ Integration with Express

### Manual Testing

#### Test Basic Shutdown

```bash
# Start server
npm start

# In another terminal, send SIGTERM
kill -TERM $(pgrep -f "node.*server.js")

# Verify graceful shutdown logs
```

#### Test Shutdown with Active Requests

```bash
# Start server
npm start

# Send requests in loop
while true; do curl http://localhost:5001/api/v1/health; sleep 0.1; done

# In another terminal, send SIGTERM
kill -TERM $(pgrep -f "node.*server.js")

# Observe requests completing before shutdown
```

#### Test Shutdown Timeout

```bash
# Modify code to have hanging request handler
app.get('/hang', async (req, res) => {
  await new Promise(resolve => setTimeout(resolve, 60000)); // 60s
  res.json({ ok: true });
});

# Start server and make request to /hang
curl http://localhost:5001/hang &

# Send SIGTERM
kill -TERM $(pgrep -f "node.*server.js")

# Observe 30s timeout and force close
```

## Deployment Considerations

### Docker

Docker sends SIGTERM by default on `docker stop`:

```dockerfile
# In Dockerfile, no special handling needed
# Ensure server.js uses the shutdown utility

CMD ["node", "server.js"]
```

**Stop with grace period:**
```bash
docker stop --time=35 container-name  # 35s > 30s timeout
```

### Kubernetes

Configure termination grace period:

```yaml
apiVersion: v1
kind: Pod
spec:
  terminationGracePeriodSeconds: 35  # 35s > 30s timeout
  containers:
  - name: titangold-backend
    image: titangold:latest
    lifecycle:
      preStop:
        exec:
          command: ["/bin/sh", "-c", "sleep 5"]  # Optional: delay before SIGTERM
```

### systemd

Configure in service file:

```ini
[Service]
Type=simple
ExecStart=/usr/bin/node /opt/titangold/backend/server.js
TimeoutStopSec=35s  # 35s > 30s timeout
KillMode=mixed
KillSignal=SIGTERM
```

### PM2

```json
{
  "apps": [{
    "name": "titangold-backend",
    "script": "server.js",
    "kill_timeout": 35000,
    "wait_ready": true,
    "listen_timeout": 10000
  }]
}
```

### Load Balancer Integration

For zero-downtime deployments with load balancers:

1. **Deregister from load balancer** (5-10s)
2. **Wait for existing connections to drain**
3. **Send SIGTERM** to application
4. **Application gracefully shuts down** (max 30s)

Example with AWS ALB:
```
Deregistration delay: 10s
Health check grace: 5s
Shutdown timeout: 30s
Total: ~45s per instance
```

## Monitoring

### Metrics to Track

1. **Shutdown Duration**: Time from SIGTERM to exit
2. **Active Connections on Shutdown**: Number of in-flight requests
3. **Forced Shutdowns**: Count of timeouts (should be zero)
4. **Shutdown Errors**: Errors during cleanup

### Logging

All shutdown events are logged with structured logging:

```javascript
logger.info('Shutdown event', {
  signal: 'SIGTERM',
  duration: 247,
  inFlightRequests: 0,
  forcedClose: false
});
```

### Alerting

Alert on:
- Shutdown duration > 25s (approaching timeout)
- Forced shutdowns (timeout reached)
- Shutdown errors
- Repeated shutdowns in short time (crash loop)

## Troubleshooting

### Issue: Server Takes Too Long to Shutdown

**Cause**: Long-running requests or hanging connections

**Solution**:
1. Check active connections: `server.getConnections()`
2. Review request logs for long-duration endpoints
3. Implement request timeouts on routes
4. Consider reducing shutdown timeout if acceptable

### Issue: Connections Not Closing

**Cause**: Keep-alive connections not draining

**Solution**:
1. Set `Connection: close` header during shutdown (already done)
2. Check if clients respect `Connection: close`
3. Review load balancer connection draining settings

### Issue: Database Pool Not Closing

**Cause**: Active transactions or queries

**Solution**:
1. Ensure queries have timeouts
2. Check for transactions without commit/rollback
3. Review long-running queries in pg logs

### Issue: Redis Connection Hangs

**Cause**: Redis commands in progress

**Solution**:
1. Use `quit()` instead of `disconnect()` (already done)
2. Ensure Redis commands have timeouts
3. Check Redis server connectivity

### Issue: Services Not Stopping

**Cause**: Service shutdown methods throwing errors

**Solution**:
1. Review service shutdown logs
2. Ensure all services have proper cleanup
3. Add error handling in service shutdown methods

## Best Practices

### ✅ Do's

1. **Always register shutdown handlers** in server startup
2. **Track all background services** for proper cleanup
3. **Set appropriate timeouts** for long-running operations
4. **Test shutdown behavior** in development
5. **Monitor shutdown metrics** in production
6. **Configure load balancer draining** before shutdown
7. **Use graceful shutdown in all environments**

### ❌ Don'ts

1. **Don't ignore shutdown signals** (process keeps running)
2. **Don't use `process.exit(0)` directly** without cleanup
3. **Don't start new work during shutdown**
4. **Don't let services hang indefinitely** (use timeouts)
5. **Don't skip testing shutdown** scenarios

## Performance Impact

- **Overhead**: Negligible (<1ms per request with middleware)
- **Shutdown Time**: 100-1000ms typical, max 30s
- **Memory**: ~50KB for shutdown utility
- **CPU**: Minimal during normal operation, brief spike during shutdown

## Security Considerations

1. **Signal Handling**: Only responds to standard signals (SIGTERM, SIGINT)
2. **Service Closure**: All services properly disconnected to prevent leaks
3. **Error Handling**: Errors logged but don't expose sensitive data
4. **Denial of Service**: Shutdown cannot be triggered by clients

## Future Enhancements

### Potential Improvements

- **INFRA-024**: Configurable shutdown timeout via environment variable
- **INFRA-025**: Health check endpoint that reports shutdown status
- **INFRA-026**: Metrics export during shutdown (Prometheus)
- **INFRA-027**: Graceful shutdown webhook notifications
- **INFRA-028**: Shutdown reason tracking (deployment, scale-down, error)
- **INFRA-029**: Connection draining status API
- **INFRA-030**: Automatic retry queue for interrupted requests

## References

- [Node.js Process Signals](https://nodejs.org/api/process.html#signal-events)
- [Express.js Best Practices - Graceful Shutdown](https://expressjs.com/en/advanced/best-practice-performance.html#ensure-your-app-automatically-restarts)
- [Kubernetes Pod Lifecycle](https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle/)
- [Docker Stop vs Kill](https://docs.docker.com/engine/reference/commandline/stop/)

## Support

For issues or questions:
- Check logs for shutdown errors
- Review test suite for expected behavior
- Consult troubleshooting section above
- Contact infrastructure team

---

**Task**: INFRA-007  
**Status**: ✅ PRODUCTION-READY  
**Date**: 2026-01-31
