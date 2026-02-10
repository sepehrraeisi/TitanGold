# DataHub/Telegram Collector - Architecture Analysis & Task Backlog

**Analysis Date**: 2026-02-10 (۱۴۰۴/۱۱/۲۱)  
**Section**: Datahub/Telegram Collector  
**Status**: ⚠️ Operational with Critical Issues

---

## 🏗️ Architecture Overview

### System Components

```
┌─────────────────────────────────────────────────────────────────────┐
│                         TitanGold System                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────────┐         ┌──────────────────┐                │
│  │   Frontend UI    │◄────────┤  Titan Backend   │                │
│  │  (DataHubTab)    │  API    │   (Port 5001)    │                │
│  └──────────────────┘         └────────┬─────────┘                │
│                                         │                           │
│                                         │ HTTP/REST                 │
│                                         ▼                           │
│                              ┌─────────────────────┐               │
│                              │ Telegram Collector  │               │
│                              │   Service           │               │
│                              │   (Port 3002)       │               │
│                              └──────────┬──────────┘               │
│                                         │                           │
│                                         │ MTProto/GramJS            │
│                                         ▼                           │
│                              ┌─────────────────────┐               │
│                              │  Telegram API       │               │
│                              │  (t.me)             │               │
│                              └─────────────────────┘               │
│                                                                     │
│  ┌──────────────────────────────────────────────────────┐         │
│  │          PostgreSQL Database                         │         │
│  │  • data_sources        • data_categories             │         │
│  │  • collected_data      • data_hub_logs               │         │
│  │  • data_queue          • source_access_controls      │         │
│  └──────────────────────────────────────────────────────┘         │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 1. **Telegram Collector Service**
   - **Location**: `/telegram-collector/`
   - **Technology**: Node.js + Express + GramJS (MTProto)
   - **Port**: 3002
   - **PM2 Process**: `telegram-collector` (id: 3)
   - **Status**: ✅ Online (37 days uptime, 2 restarts)

#### Key Features:
- MTProto-based authentication (no Bot API limits)
- Session-based authentication with `TELEGRAM_SESSION_STRING`
- REST API for channel message retrieval
- Real-time login flow (start → confirm → session save)
- Channel listing and testing

#### API Endpoints:
```
GET  /health
GET  /api/telegram-collector/health
POST /api/telegram-collector/login/start
POST /api/telegram-collector/login/confirm
POST /api/telegram-collector/login/cancel
GET  /telegram/:channel/recent?limit=50
GET  /api/telegram-collector/channels
POST /api/telegram-collector/channels/:channelId/test
```

### 2. **Backend Integration**
   - **Service**: `services/telegram.js` (Bot notifications only)
   - **Purpose**: Send alerts/notifications via Telegram Bot
   - **NOT USED** for data collection

### 3. **Frontend UI**
   - **Component**: `components/ai/AIManager/tabs/DataHubTab.tsx`
   - **Panels**:
     - TelegramPanel: Collector login & channel management
     - DataSourcesPanel: Source CRUD operations
     - CategoriesPanel: Category management
     - HealthPanel: System health monitoring
     - LogsPanel: Collection logs
     - PipelinePanel: Data processing pipeline
     - AdvancedFeatures: Automation, publishing, etc.

### 4. **Database Schema**

#### `data_sources` Table:
```sql
- id: UUID (PK)
- name: VARCHAR(255)
- type: VARCHAR(100)          -- 'telegram', 'rss', 'api', etc.
- url: TEXT
- category: VARCHAR(100)
- priority: INTEGER (default 5)
- status: VARCHAR(50) (default 'active')
- health_status: VARCHAR(50) (default 'healthy')
- last_fetch_at: TIMESTAMP
- fetch_count: INTEGER (default 0)
- error_count: INTEGER (default 0)
- config: JSONB (default '{}')
- credentials: JSONB (default '{}')
- is_enabled: BOOLEAN (default true)
- refresh_interval: INTEGER (default 60)
- next_fetch_at: TIMESTAMP
- last_status: VARCHAR(50)
- last_content_hash: TEXT
```

#### Related Tables:
- `data_categories`: Category definitions
- `collected_data`: Fetched messages/articles
- `data_hub_logs`: Collection logs
- `data_queue`: Processing queue
- `source_access_controls`: Access permissions

---

## 🐛 Issues and Risks

### 🔴 **CRITICAL Issues**

#### CRIT-001: No Persistent Caching
- **Severity**: HIGH
- **Impact**: Performance degradation, repeated API calls
- **Description**: In-memory caching only, no Redis/Postgres persistence
- **Evidence**: 
  ```typescript
  // index.ts line 260
  cached: false,  // Always false!
  ```
- **Risk**: Rate limiting, unnecessary Telegram API load

#### CRIT-002: Session Management Insecurity
- **Severity**: HIGH
- **Impact**: Security vulnerability
- **Description**: Session string stored in plain text in `.env` file
- **Evidence**:
  ```typescript
  // index.ts line 172-174
  fs.writeFileSync(envPath, envContent);
  process.env.TELEGRAM_SESSION_STRING = sessionString;
  ```
- **Risk**: Session hijacking if `.env` is exposed

#### CRIT-003: No Connection Pooling
- **Severity**: MEDIUM-HIGH
- **Impact**: Resource exhaustion
- **Description**: New Telegram client created for every request
- **Evidence**:
  ```typescript
  // index.ts line 239, 283, 326
  const client = await getTelegramClient(sessionString);
  await client.connect();
  // ... 
  await client.disconnect();  // Create/destroy every time
  ```
- **Risk**: Connection exhaustion under load

#### CRIT-004: No Error Recovery
- **Severity**: MEDIUM
- **Impact**: Service degradation
- **Description**: No retry logic, no circuit breaker pattern
- **Evidence**: Simple try-catch with 500 error
- **Risk**: Single API failure cascades to total failure

### 🟡 **HIGH Priority Issues**

#### HIGH-001: No Rate Limiting
- **Description**: No rate limit protection on collector endpoints
- **Impact**: Potential abuse, Telegram API ban
- **Missing**: Express rate limiting middleware

#### HIGH-002: No Request Validation
- **Description**: Minimal input validation
- **Evidence**:
  ```typescript
  // Line 227: limit = parseInt(req.query.limit as string) || 20
  // No max check, could request 999999 messages
  ```
- **Risk**: DoS attack, memory exhaustion

#### HIGH-003: No Monitoring/Metrics
- **Description**: No Prometheus/StatsD metrics
- **Missing**: Request latency, error rates, cache hit ratio
- **Impact**: Cannot diagnose performance issues

#### HIGH-004: Authentication State Leak
- **Description**: `authSessions` Map never cleaned up automatically
- **Evidence**: `authSessions.set(authId, ...)` with no TTL
- **Risk**: Memory leak over time

#### HIGH-005: No Database Integration
- **Description**: Collector doesn't write to `collected_data` table
- **Impact**: Data not persisted, pipeline cannot process
- **Gap**: Manual backend integration required

### 🟠 **MEDIUM Priority Issues**

#### MED-001: Hardcoded Configuration
- **Description**: Port, limits, timeouts all hardcoded
- **Missing**: Config file or environment variables
- **Impact**: Difficult to tune for production

#### MED-002: No Health Check Depth
- **Description**: Health endpoint only checks env vars
- **Missing**: Telegram API connectivity check, session validity
- **Impact**: False "healthy" status when Telegram is down

#### MED-003: No Structured Logging
- **Description**: console.log statements instead of structured logs
- **Missing**: Winston/Pino with log levels, correlation IDs
- **Impact**: Difficult to debug in production

#### MED-004: No Multi-Account Support
- **Description**: Single session only
- **Note**: README mentions "multi-account rotation" as future work
- **Impact**: Cannot scale to many channels

#### MED-005: No WebSocket Support
- **Description**: Polling only, no real-time updates
- **Note**: README mentions "WebSocket for push updates" as future
- **Impact**: Higher latency for real-time data

### 🟢 **LOW Priority Issues**

#### LOW-001: TypeScript not fully utilized
- **Description**: Many `any` types
- **Evidence**: `(msg: any)`, `(dialog: any)`, `(error: any)`
- **Impact**: Type safety compromised

#### LOW-002: No API Versioning
- **Description**: Endpoints not versioned
- **Impact**: Breaking changes affect all clients

#### LOW-003: No API Documentation
- **Description**: No Swagger/OpenAPI spec
- **Impact**: Hard for frontend to integrate

#### LOW-004: No Tests
- **Description**: No unit tests, integration tests, or E2E tests
- **Missing**: Jest/Mocha test suite
- **Impact**: Regressions undetected

#### LOW-005: No Graceful Shutdown
- **Description**: No SIGTERM/SIGINT handler
- **Risk**: Connections not closed cleanly on restart

---

## 📋 Task Backlog

### 🔴 **Phase 1: Critical Fixes** (Week 1)

#### TASK-TG-001: Implement Persistent Caching
- **Priority**: P0 (Critical)
- **Effort**: 3-5 days
- **Description**: Add Redis caching layer for channel messages
- **Acceptance Criteria**:
  - [ ] Install and configure Redis
  - [ ] Implement cache get/set with TTL
  - [ ] Add cache key strategy (channel:limit:hash)
  - [ ] Return `cached: true` when serving from cache
  - [ ] Add cache eviction on error/timeout
- **Dependencies**: None
- **Files**:
  - `telegram-collector/src/index.ts`
  - `telegram-collector/src/cache.ts` (NEW)

#### TASK-TG-002: Secure Session Storage
- **Priority**: P0 (Critical)
- **Effort**: 2-3 days
- **Description**: Encrypt session strings and move to database
- **Acceptance Criteria**:
  - [ ] Add encryption utility (crypto/AES-256)
  - [ ] Store encrypted session in PostgreSQL `telegram_sessions` table
  - [ ] Remove session from `.env` file
  - [ ] Add session rotation mechanism
  - [ ] Add session expiry checks
- **Dependencies**: None
- **Files**:
  - `telegram-collector/src/sessionManager.ts` (NEW)
  - `backend/database/migrations/XXX_telegram_sessions.sql` (NEW)

#### TASK-TG-003: Implement Connection Pooling
- **Priority**: P0 (Critical)
- **Effort**: 2-3 days
- **Description**: Reuse Telegram client instances
- **Acceptance Criteria**:
  - [ ] Create TelegramClientPool class
  - [ ] Implement pool with max size (default 5)
  - [ ] Add health check for idle connections
  - [ ] Implement graceful drain on shutdown
  - [ ] Add pool metrics (active, idle, waiting)
- **Dependencies**: None
- **Files**:
  - `telegram-collector/src/clientPool.ts` (NEW)

#### TASK-TG-004: Add Error Recovery & Retry Logic
- **Priority**: P0 (Critical)
- **Effort**: 2-3 days
- **Description**: Implement exponential backoff and circuit breaker
- **Acceptance Criteria**:
  - [ ] Add retry middleware (3 attempts, exponential backoff)
  - [ ] Implement circuit breaker pattern (open after 5 failures)
  - [ ] Add fallback responses when circuit is open
  - [ ] Log retry attempts and circuit state changes
  - [ ] Add health endpoint status based on circuit state
- **Dependencies**: None
- **Libraries**: `opossum` (circuit breaker), `axios-retry`
- **Files**:
  - `telegram-collector/src/middleware/errorHandler.ts` (NEW)
  - `telegram-collector/src/circuitBreaker.ts` (NEW)

---

### 🟡 **Phase 2: High Priority Improvements** (Week 2-3)

#### TASK-TG-005: Implement Rate Limiting
- **Priority**: P1 (High)
- **Effort**: 1-2 days
- **Description**: Add rate limiting to all endpoints
- **Acceptance Criteria**:
  - [ ] Install `express-rate-limit`
  - [ ] Add per-IP rate limit (100 req/15min)
  - [ ] Add per-endpoint rate limit (channels: 10 req/min)
  - [ ] Return 429 with Retry-After header
  - [ ] Add rate limit bypass for admin IPs
- **Dependencies**: None
- **Files**:
  - `telegram-collector/src/middleware/rateLimiter.ts` (NEW)

#### TASK-TG-006: Add Request Validation
- **Priority**: P1 (High)
- **Effort**: 2 days
- **Description**: Validate all incoming requests
- **Acceptance Criteria**:
  - [ ] Install `joi` or `zod`
  - [ ] Add schema validation for all endpoints
  - [ ] Limit `limit` param to 1-100 range
  - [ ] Validate phone number format
  - [ ] Sanitize channel names (no injection)
- **Dependencies**: None
- **Files**:
  - `telegram-collector/src/validators.ts` (NEW)

#### TASK-TG-007: Add Monitoring & Metrics
- **Priority**: P1 (High)
- **Effort**: 3-4 days
- **Description**: Implement Prometheus metrics
- **Acceptance Criteria**:
  - [ ] Install `prom-client`
  - [ ] Add metrics: request_duration, error_count, cache_hit_ratio
  - [ ] Expose `/metrics` endpoint
  - [ ] Add custom labels (endpoint, channel, status)
  - [ ] Create Grafana dashboard
- **Dependencies**: None
- **Files**:
  - `telegram-collector/src/metrics.ts` (NEW)
  - `grafana/telegram-collector-dashboard.json` (NEW)

#### TASK-TG-008: Cleanup Auth Sessions
- **Priority**: P1 (High)
- **Effort**: 1 day
- **Description**: Auto-expire auth sessions
- **Acceptance Criteria**:
  - [ ] Add TTL to authSessions (5 minutes)
  - [ ] Implement cleanup interval (every 1 minute)
  - [ ] Disconnect clients on expiry
  - [ ] Log cleanup events
- **Dependencies**: None
- **Files**:
  - `telegram-collector/src/index.ts`

#### TASK-TG-009: Integrate with Database Pipeline
- **Priority**: P1 (High)
- **Effort**: 4-5 days
- **Description**: Write collected data to PostgreSQL
- **Acceptance Criteria**:
  - [ ] On message fetch, insert into `collected_data` table
  - [ ] Update `data_sources.last_fetch_at` and `fetch_count`
  - [ ] Create `data_hub_logs` entry (success/error)
  - [ ] Trigger pipeline processing (emit event or queue)
  - [ ] Handle duplicate messages (hash-based deduplication)
- **Dependencies**: TASK-TG-001 (caching)
- **Files**:
  - `telegram-collector/src/database.ts` (NEW)
  - `telegram-collector/src/pipeline.ts` (NEW)

---

### 🟠 **Phase 3: Medium Priority Enhancements** (Week 4-5)

#### TASK-TG-010: Externalize Configuration
- **Priority**: P2 (Medium)
- **Effort**: 1-2 days
- **Description**: Move all config to `.env` and config file
- **Acceptance Criteria**:
  - [ ] Create `config.ts` with typed config
  - [ ] Move port, limits, timeouts to env vars
  - [ ] Add config validation on startup
  - [ ] Support config reload without restart
- **Dependencies**: None
- **Files**:
  - `telegram-collector/src/config.ts` (NEW)
  - `telegram-collector/.env.example` (UPDATE)

#### TASK-TG-011: Enhanced Health Checks
- **Priority**: P2 (Medium)
- **Effort**: 2-3 days
- **Description**: Deep health checks with real Telegram connectivity
- **Acceptance Criteria**:
  - [ ] Check Telegram API reachability (ping test channel)
  - [ ] Validate session is active
  - [ ] Check Redis connectivity
  - [ ] Check PostgreSQL connectivity
  - [ ] Return detailed status (UP/DEGRADED/DOWN)
- **Dependencies**: TASK-TG-001, TASK-TG-002
- **Files**:
  - `telegram-collector/src/health.ts` (NEW)

#### TASK-TG-012: Structured Logging
- **Priority**: P2 (Medium)
- **Effort**: 2 days
- **Description**: Replace console.log with Winston/Pino
- **Acceptance Criteria**:
  - [ ] Install `winston` or `pino`
  - [ ] Add log levels (debug, info, warn, error)
  - [ ] Add correlation IDs (x-request-id)
  - [ ] Log to file and stdout
  - [ ] Configure log rotation
- **Dependencies**: None
- **Files**:
  - `telegram-collector/src/logger.ts` (NEW)

#### TASK-TG-013: Multi-Account Support
- **Priority**: P2 (Medium)
- **Effort**: 5-7 days
- **Description**: Support multiple Telegram accounts
- **Acceptance Criteria**:
  - [ ] Store multiple sessions in database
  - [ ] Implement account selection strategy (round-robin, least-used)
  - [ ] Handle per-account rate limits
  - [ ] Add account health tracking
  - [ ] Admin UI for account management
- **Dependencies**: TASK-TG-002, TASK-TG-003
- **Files**:
  - `telegram-collector/src/accountManager.ts` (NEW)
  - `components/ai/AIManager/tabs/DataHub/AccountsPanel.tsx` (NEW)

#### TASK-TG-014: WebSocket Support
- **Priority**: P2 (Medium)
- **Effort**: 4-5 days
- **Description**: Real-time push updates via WebSocket
- **Acceptance Criteria**:
  - [ ] Install `socket.io`
  - [ ] Implement WebSocket server
  - [ ] Push new messages to connected clients
  - [ ] Add channel subscription mechanism
  - [ ] Handle connection lifecycle (connect, disconnect, reconnect)
- **Dependencies**: None
- **Files**:
  - `telegram-collector/src/websocket.ts` (NEW)

---

### 🟢 **Phase 4: Low Priority & Polish** (Week 6+)

#### TASK-TG-015: TypeScript Type Safety
- **Priority**: P3 (Low)
- **Effort**: 2-3 days
- **Description**: Replace `any` types with proper types
- **Acceptance Criteria**:
  - [ ] Define interfaces for Telegram API responses
  - [ ] Type all function parameters and return values
  - [ ] Enable `strict` mode in tsconfig.json
  - [ ] Fix all type errors
- **Dependencies**: None
- **Files**:
  - `telegram-collector/src/types.ts` (NEW)
  - `telegram-collector/tsconfig.json` (UPDATE)

#### TASK-TG-016: API Versioning
- **Priority**: P3 (Low)
- **Effort**: 1-2 days
- **Description**: Add versioned API routes
- **Acceptance Criteria**:
  - [ ] Create `/api/v1/` prefix
  - [ ] Maintain backward compatibility with `/telegram/` routes
  - [ ] Add deprecation headers
  - [ ] Document migration guide
- **Dependencies**: None
- **Files**:
  - `telegram-collector/src/routes/v1.ts` (NEW)

#### TASK-TG-017: API Documentation
- **Priority**: P3 (Low)
- **Effort**: 2-3 days
- **Description**: Generate OpenAPI/Swagger docs
- **Acceptance Criteria**:
  - [ ] Install `swagger-jsdoc` and `swagger-ui-express`
  - [ ] Annotate all endpoints with JSDoc comments
  - [ ] Serve docs at `/api-docs`
  - [ ] Include request/response examples
- **Dependencies**: None
- **Files**:
  - `telegram-collector/src/swagger.ts` (NEW)

#### TASK-TG-018: Test Suite
- **Priority**: P3 (Low)
- **Effort**: 5-7 days
- **Description**: Add comprehensive tests
- **Acceptance Criteria**:
  - [ ] Install Jest/Mocha
  - [ ] Unit tests for all services (80% coverage)
  - [ ] Integration tests for API endpoints
  - [ ] Mock Telegram API for tests
  - [ ] Add CI/CD pipeline (GitHub Actions)
- **Dependencies**: All previous tasks
- **Files**:
  - `telegram-collector/tests/` (NEW directory)
  - `.github/workflows/test.yml` (NEW)

#### TASK-TG-019: Graceful Shutdown
- **Priority**: P3 (Low)
- **Effort**: 1 day
- **Description**: Handle shutdown signals properly
- **Acceptance Criteria**:
  - [ ] Listen for SIGTERM, SIGINT signals
  - [ ] Stop accepting new requests
  - [ ] Wait for pending requests to complete (30s timeout)
  - [ ] Disconnect all Telegram clients
  - [ ] Close database connections
  - [ ] Log shutdown events
- **Dependencies**: TASK-TG-003
- **Files**:
  - `telegram-collector/src/shutdown.ts` (NEW)

#### TASK-TG-020: Performance Benchmarking
- **Priority**: P3 (Low)
- **Effort**: 2-3 days
- **Description**: Benchmark and optimize
- **Acceptance Criteria**:
  - [ ] Use `autocannon` or `k6` for load testing
  - [ ] Measure baseline performance (RPS, latency)
  - [ ] Identify bottlenecks (profiling)
  - [ ] Optimize hot paths
  - [ ] Document performance characteristics
- **Dependencies**: All previous tasks
- **Files**:
  - `telegram-collector/benchmarks/` (NEW directory)

---

## 📊 Summary Statistics

### Current State:
- **Lines of Code**: ~373 lines (single file)
- **Uptime**: 37 days (stable)
- **Restarts**: 2 (low restart count)
- **Memory Usage**: 0B (PM2 reporting issue)
- **CPU Usage**: 0% (idle most of time)

### Issues Breakdown:
- 🔴 **CRITICAL**: 4 issues
- 🟡 **HIGH**: 5 issues
- 🟠 **MEDIUM**: 5 issues
- 🟢 **LOW**: 5 issues
- **TOTAL**: 19 issues

### Task Backlog:
- **Phase 1 (Week 1)**: 4 tasks (Critical)
- **Phase 2 (Week 2-3)**: 5 tasks (High Priority)
- **Phase 3 (Week 4-5)**: 5 tasks (Medium Priority)
- **Phase 4 (Week 6+)**: 6 tasks (Low Priority)
- **TOTAL**: 20 tasks

### Estimated Timeline:
- **Phase 1**: 1 week (2 developers)
- **Phase 2**: 2 weeks (2 developers)
- **Phase 3**: 2 weeks (1-2 developers)
- **Phase 4**: 2-3 weeks (1 developer)
- **TOTAL**: 7-8 weeks (~2 months)

---

## 🎯 Recommended Priorities

### Immediate (This Week):
1. TASK-TG-001: Persistent caching (performance)
2. TASK-TG-002: Secure session storage (security)
3. TASK-TG-003: Connection pooling (scalability)

### Short-term (Next 2 Weeks):
4. TASK-TG-004: Error recovery (reliability)
5. TASK-TG-005: Rate limiting (protection)
6. TASK-TG-009: Database integration (feature completion)

### Medium-term (Next Month):
7. TASK-TG-007: Monitoring (observability)
8. TASK-TG-011: Enhanced health checks (ops)
9. TASK-TG-013: Multi-account support (scale)

### Long-term (2+ Months):
10. TASK-TG-014: WebSocket support (real-time)
11. TASK-TG-018: Test suite (quality)
12. TASK-TG-020: Performance benchmarking (optimization)

---

## 📝 Notes

### Strengths:
- ✅ Clean separation of concerns (dedicated service)
- ✅ MTProto integration (no Bot API limits)
- ✅ Simple REST API design
- ✅ Stable uptime (37 days)

### Weaknesses:
- ❌ No persistent caching
- ❌ No connection pooling
- ❌ Limited error handling
- ❌ No monitoring/metrics

### Opportunities:
- 💡 Redis integration for caching
- 💡 Multi-account scaling
- 💡 WebSocket real-time updates
- 💡 Advanced analytics on collected data

### Threats:
- ⚠️ Telegram API rate limiting
- ⚠️ Session expiry/invalidation
- ⚠️ Memory leaks from auth sessions
- ⚠️ Security risks from plain-text sessions

---

**Report Generated By**: TitanGold DevOps  
**Date**: ۱۴۰۴/۱۱/۲۱ (2026-02-10)  
**Confidence**: HIGH (based on code review + PM2 status)

