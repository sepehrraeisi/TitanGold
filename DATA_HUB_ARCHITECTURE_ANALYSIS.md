# 🏗️ Data Hub Feature - Architecture & Planning Analysis

**Analysis Date:** 2026-02-01  
**Analyzer:** AI Assistant (Architecture & Planning Mode)  
**Scope:** Data Hub tab in AI → Manager menu (Artemis Central AI Controller)  
**Purpose:** Data collection and aggregation system for AI agents

---

## 📋 EXECUTIVE SUMMARY

### What is Data Hub?
**Data Hub** is a comprehensive data collection, normalization, and distribution system within the TitanGold platform. It serves as the **central data aggregation layer** that:
- Collects data from multiple sources (API, RSS, Telegram, Web Crawlers)
- Normalizes and validates data quality
- Provides data to AI agents through a unified interface
- Monitors data pipeline health and performance
- Manages data access control and prioritization

### Current Status
- ✅ **Frontend UI:** Fully implemented with 7 tabs (Sources, Categories, Pipeline, Health, Logs, Advanced, Telegram)
- ⚠️ **Backend API:** Partially implemented (basic endpoints exist, advanced features incomplete)
- ⚠️ **Database:** Basic schema exists, missing advanced features tables
- ⚠️ **Integration:** Frontend calls non-existent backend endpoints
- ❌ **Testing:** No test coverage found
- ❌ **Documentation:** Missing API docs and developer guides

---

## 🗺️ STEP 1: CURRENT STATE MAPPING

### 1.1 FRONTEND LAYER

#### Main Component
**File:** `components/ai/AIManager/tabs/DataHubTab.tsx` (1,738 lines)

**Purpose:** 
- Main Data Hub UI component with 7 navigation tabs
- Manages state for sources, categories, pipeline, health, logs, advanced features, and Telegram collector
- Provides CRUD operations for data sources and categories
- Displays real-time metrics and monitoring data

**Dependencies:**
- `services/api.ts` - API service layer
- `types.ts` - TypeScript type definitions
- Multiple modal components for specific features
- `AdvancedFeatures.tsx` sub-component

**Key Features Implemented:**
1. **Data Sources Tab:** List, create, edit, delete, test data sources
2. **Categories Tab:** Organize sources into categories with tags
3. **Pipeline Tab:** Data preparation & screening metrics, quality monitoring
4. **Health Tab:** System health monitoring (connections, response times, cache)
5. **Logs Tab:** Access logs with filtering (source, agent, status)
6. **Advanced Tab:** Web crawlers, auto-discovery, access control, Telegram publishers
7. **Telegram Tab:** Telegram collector login, channel management, channel-to-source linking

**State Management:**
- Local component state (useState hooks)
- No global state management (Redux/Context)
- Direct API calls from component
- Manual state synchronization

**Issues Identified:**
- ❌ Massive component (1,738 lines) - violates Single Responsibility Principle
- ❌ No error boundaries for failure isolation
- ❌ Missing loading states for async operations
- ❌ No pagination for large datasets (logs, sources)
- ❌ Directly mutating state objects in places
- ❌ No memoization for expensive computations
- ⚠️ Excessive prop drilling to child components
- ⚠️ Mixed concerns (UI, business logic, API calls)

#### Modal Components
**Location:** `components/ai/AIManager/tabs/DataHub/modals/`

| Modal | Purpose | Lines | Dependencies | Issues |
|-------|---------|-------|--------------|--------|
| `CreateSourceModal.tsx` | Create/edit data sources | ~300 | api.ts, types.ts | Missing validation, no form library |
| `CreateCategoryModal.tsx` | Create data categories | ~200 | api.ts, types.ts | Basic implementation |
| `ViewSourceDataModal.tsx` | Preview source data | ~250 | api.ts, types.ts | Limited data type support |
| `WebCrawlerModal.tsx` | Configure web crawlers | ~400 | api.ts, types.ts | Complex validation logic |
| `TelegramPublisherModal.tsx` | Setup Telegram publishers | ~350 | api.ts, types.ts | Authentication flow issues |
| `AccessControlModal.tsx` | Manage access control | ~300 | api.ts, types.ts | Complex permission logic |
| `AutomationTopicModal.tsx` | Configure automation topics | ~400 | api.ts, types.ts | Agent-topic mapping |
| `QueuePreviewModal.tsx` | Preview publisher queue | ~200 | api.ts, types.ts | Read-only view |

**Common Issues:**
- ❌ No form validation library (manual validation)
- ❌ No consistent error handling pattern
- ❌ Duplicated validation logic across modals
- ❌ No accessibility (a11y) considerations
- ⚠️ Inconsistent modal state management

#### Advanced Features Component
**File:** `components/ai/AIManager/tabs/DataHub/AdvancedFeatures.tsx`

**Purpose:**
- Manage advanced Data Hub features
- Web crawlers management
- Auto-discovery rules
- Smart prioritization
- Access control (blacklist/whitelist)
- Telegram publishers
- Automation topics (agent-to-data routing)

**Dependencies:**
- All modal components
- `services/api.ts`
- `types.ts`

**Issues:**
- ❌ Another large component (~800+ lines)
- ❌ Complex nested state management
- ❌ Mixed UI and business logic
- ⚠️ Feature flags not implemented
- ⚠️ No progressive loading for heavy features

### 1.2 BACKEND LAYER

#### Routes
**File:** `backend/routes/data-sources.js` (156 lines)

**Purpose:**
- REST API endpoints for Data Hub
- Source management CRUD
- Health checks
- Statistics aggregation

**Implemented Endpoints:**

| Method | Path | Purpose | Auth | Status |
|--------|------|---------|------|--------|
| GET | `/data-sources` | List all sources | ✅ | ✅ Working |
| POST | `/data-sources` | Create source | ✅ | ✅ Working |
| GET | `/data-sources/state` | Get Data Hub state | ✅ | ⚠️ Incomplete |
| GET | `/data-sources/health` | Health check | ✅ | ✅ Working |
| GET | `/data-sources/stats` | Statistics | ✅ | ✅ Working |
| POST | `/data-sources/publish-telegram` | Telegram publish | ✅ | ⚠️ Basic |

**Missing Endpoints:**
- ❌ `PUT /data-sources/:id` - Update source
- ❌ `DELETE /data-sources/:id` - Delete source
- ❌ `POST /data-sources/:id/test` - Test connection
- ❌ `GET /data-sources/:id/data` - Fetch source data
- ❌ `GET /data-categories` - List categories
- ❌ `POST /data-categories` - Create category
- ❌ `GET /data-pipeline/snapshot` - Pipeline snapshot
- ❌ `POST /data-pipeline/refresh` - Refresh pipeline
- ❌ `GET /data-access-logs` - Access logs
- ❌ ALL Advanced features endpoints (crawlers, automation, publishers, etc.)

**Issues:**
- ❌ Frontend calls non-existent endpoints → **CRITICAL BUG**
- ❌ No input validation middleware
- ❌ No rate limiting
- ❌ Generic error messages (security risk)
- ❌ No request/response logging
- ❌ Missing authorization checks (user owns resource?)
- ⚠️ Direct database queries (no service layer)
- ⚠️ No transaction handling for multi-step operations
- ⚠️ SQL injection risk (using string interpolation in places)

#### Services
**Status:** ❌ **MISSING**

**Expected Services (Not Found):**
- `services/dataHub.js` - Core Data Hub logic
- `services/dataSource.js` - Data source management
- `services/dataPipeline.js` - Data pipeline processing
- `services/dataCollector.js` - Data collection orchestration
- `services/dataValidator.js` - Data validation & normalization
- `services/webCrawler.js` - Web crawling functionality
- `services/telegramPublisher.js` - Telegram publishing

**Partial Implementation:**
- ⚠️ `services/telegram.js` - Basic Telegram integration (referenced but not examined)
- ✅ `services/logger.js` - Logging service (exists)

**Impact:**
- ❌ Business logic mixed in routes (violation of separation of concerns)
- ❌ No reusable logic across endpoints
- ❌ Difficult to test (routes are tightly coupled to Express)
- ❌ No background job processing for data collection

#### Background Workers
**Status:** ❌ **MISSING**

**Expected Workers (Not Found):**
- Data collection scheduler (periodic fetch from sources)
- Data normalization worker (clean & standardize data)
- Pipeline refresh worker (recalculate metrics)
- Telegram collector sync worker
- Web crawler execution worker
- Auto-discovery worker
- Health check worker

**Impact:**
- ❌ Data sources are never automatically refreshed
- ❌ Pipeline metrics are stale unless manually refreshed
- ❌ Telegram channels are not monitored
- ❌ Web crawlers never run
- ❌ Health status is only checked on user request

### 1.3 DATABASE LAYER

#### Tables

**Implemented:**

1. **`data_sources`** (✅ Exists)
   ```sql
   - id (UUID, PK)
   - name (VARCHAR)
   - type (VARCHAR) -- api, webhook, rss, telegram, web_crawler
   - url (TEXT)
   - category (VARCHAR)
   - priority (INTEGER)
   - status (VARCHAR) -- active, inactive, error
   - health_status (VARCHAR)
   - last_fetch_at (TIMESTAMP)
   - fetch_count (INTEGER)
   - error_count (INTEGER)
   - config (JSONB)
   - credentials (JSONB)
   - is_enabled (BOOLEAN)
   - created_at, updated_at (TIMESTAMP)
   - metadata (JSONB)
   ```

2. **`data_hub_logs`** (✅ Exists)
   ```sql
   - id (UUID, PK)
   - source_id (UUID, FK → data_sources)
   - action (VARCHAR)
   - status (VARCHAR)
   - message (TEXT)
   - data_size (INTEGER)
   - execution_time_ms (INTEGER)
   - created_at (TIMESTAMP)
   - metadata (JSONB)
   ```

**Missing Tables:**

3. **`data_categories`** (❌ Missing)
   - Should store category definitions
   - Should link to sources (many-to-many)

4. **`data_cache`** (❌ Missing)
   - Should store cached data from sources
   - Should track cache expiry

5. **`data_pipeline_snapshots`** (❌ Missing)
   - Should store pipeline metrics snapshots
   - Should enable historical comparison

6. **`data_access_logs`** (❌ Missing)
   - Should track which agents accessed which sources
   - Should store access patterns for optimization

7. **`web_crawlers`** (❌ Missing)
   - Should store crawler configurations
   - Should track crawler execution history

8. **`telegram_publishers`** (❌ Missing)
   - Should store Telegram channel configs
   - Should manage publisher queues

9. **`automation_topics`** (❌ Missing)
   - Should map data types to AI agents
   - Should store routing rules

10. **`data_blacklist` / `data_whitelist`** (❌ Missing)
    - Should enforce access control
    - Should store blocked/allowed patterns

**Issues:**
- ❌ **CRITICAL:** Frontend expects data that doesn't exist in DB
- ❌ No foreign key constraints for data integrity
- ❌ Missing indexes on frequently queried columns
- ❌ No partitioning strategy for large log tables
- ❌ No archival strategy for old data
- ⚠️ JSONB columns used for complex structured data (hard to query)
- ⚠️ No database migrations for schema evolution

#### Indexes
**Existing:**
```sql
CREATE INDEX idx_data_sources_type ON data_sources(type);
CREATE INDEX idx_data_sources_status ON data_sources(status);
CREATE INDEX idx_data_hub_logs_source_id ON data_hub_logs(source_id);
CREATE INDEX idx_data_hub_logs_created_at ON data_hub_logs(created_at DESC);
```

**Missing (Recommended):**
- `idx_data_sources_category` (for category filtering)
- `idx_data_sources_priority` (for prioritization queries)
- `idx_data_sources_last_fetch_at` (for staleness checks)
- `idx_data_hub_logs_status` (for status filtering)
- `idx_data_hub_logs_action` (for action-based queries)

### 1.4 API / INTEGRATION LAYER

#### Frontend API Service
**File:** `services/api.ts`

**Purpose:**
- Centralized API client for frontend
- Type-safe API calls with TypeScript
- Error handling and response transformation

**Data Hub Methods Declared:**

| Method | Purpose | Backend Endpoint | Status |
|--------|---------|------------------|--------|
| `fetchDataHubState()` | Get full Data Hub state | ❌ Not implemented | ⚠️ Mock data |
| `checkDataHubHealth()` | Check health | `/data-sources/health` | ✅ Works |
| `fetchAIAgents()` | Get AI agents list | `/api/v1/ai-agents` | ✅ Works |
| `createDataSource()` | Create source | `/data-sources` | ✅ Works |
| `updateDataHubSource()` | Update source | ❌ Not implemented | ❌ Fails |
| `deleteDataSource()` | Delete source | ❌ Not implemented | ❌ Fails |
| `testDataSourceConnection()` | Test source | ❌ Not implemented | ❌ Fails |
| `requestData()` | Fetch source data | ❌ Not implemented | ⚠️ Mock data |
| `createDataCategory()` | Create category | ❌ Not implemented | ❌ Fails |
| `refreshDataPipelineSnapshot()` | Refresh pipeline | ❌ Not implemented | ❌ Fails |
| `getTelegramCollectorHealth()` | Telegram health | `/api/telegram-collector/health` | ⚠️ Proxied |
| `startTelegramCollectorLogin()` | Start login | `/api/telegram-collector/login/start` | ⚠️ Proxied |
| `confirmTelegramCollectorLogin()` | Confirm login | `/api/telegram-collector/login/confirm` | ⚠️ Proxied |
| `cancelTelegramCollectorLogin()` | Cancel login | `/api/telegram-collector/login/cancel` | ⚠️ Proxied |
| `refreshTelegramCollectorChannels()` | Refresh channels | `/api/telegram-collector/channels/refresh` | ⚠️ Proxied |
| `linkTelegramChannelToSource()` | Link channel | `/api/telegram-collector/channels/:id/link` | ⚠️ Proxied |
| `testTelegramCollectorChannel()` | Test channel | `/api/telegram-collector/channels/:id/test` | ⚠️ Proxied |

**Implementation Details:**
- ⚠️ Many methods use **mock data** instead of real backend calls
- ⚠️ `fetchDataHubState()` generates fake data using `database.get('settings', 'data_hub_state')`
- ⚠️ IndexedDB used as fallback storage (browser-side only)
- ❌ No proper error handling (generic try/catch)
- ❌ No retry logic for failed requests
- ❌ No request cancellation support
- ❌ No request/response caching beyond browser cache

**Mock Data Generation:**
The `fetchDataHubState()` method generates **completely fake data** including:
- Random source counts
- Fake health metrics
- Empty categories list
- Empty access logs
- Mock pipeline snapshots

**Impact:**
- ❌ **CRITICAL:** Users see fake data instead of real system state
- ❌ User actions (create/update/delete) may not persist
- ❌ Metrics and monitoring are unreliable
- ❌ Integration with AI agents is broken (no real data flow)

#### Telegram Collector Integration
**Status:** ⚠️ **PARTIALLY IMPLEMENTED**

**Components:**
- Separate microservice: `telegram-collector/` (separate codebase)
- Backend proxy: API routes proxy to collector service
- Frontend: Direct integration via proxy

**Issues:**
- ⚠️ Tight coupling between frontend and microservice
- ⚠️ No fallback if collector service is down
- ⚠️ Authentication flow complex (multi-step)
- ❌ No health monitoring integration
- ❌ No automatic channel syncing

---

## 🚨 STEP 2: ISSUES & RISKS

### 2.1 FRONTEND ISSUES

#### Critical (P0)
1. **Mock Data in Production**
   - **Problem:** `fetchDataHubState()` returns completely fake data
   - **Impact:** Users cannot see real system state, decisions based on false information
   - **Risk:** High - Data integrity, user trust, system reliability

2. **Missing Error Boundaries**
   - **Problem:** No error isolation between components
   - **Impact:** One component crash brings down entire Data Hub UI
   - **Risk:** High - Poor UX, data loss on crash

3. **Component Too Large (1,738 lines)**
   - **Problem:** DataHubTab.tsx violates Single Responsibility Principle
   - **Impact:** Hard to maintain, test, debug; performance issues
   - **Risk:** High - Technical debt, maintainability

4. **No Pagination**
   - **Problem:** All data loaded at once (logs, sources, etc.)
   - **Impact:** Performance degradation with large datasets; browser crashes
   - **Risk:** High - Performance, scalability

#### High (P1)
5. **No Global State Management**
   - **Problem:** State scattered across components, manual synchronization
   - **Impact:** State inconsistencies, prop drilling, unnecessary re-renders
   - **Risk:** Medium - Maintainability, bugs

6. **Manual Form Validation**
   - **Problem:** No form library (React Hook Form, Formik)
   - **Impact:** Inconsistent validation, duplicated code, bugs
   - **Risk:** Medium - Data quality, UX

7. **Missing Loading States**
   - **Problem:** Some async operations don't show loading indicators
   - **Impact:** Poor UX, users unsure if action succeeded
   - **Risk:** Medium - UX, user frustration

8. **No Accessibility (a11y)**
   - **Problem:** No ARIA labels, keyboard navigation, screen reader support
   - **Impact:** Inaccessible to disabled users, legal risk
   - **Risk:** Medium - Legal compliance, inclusivity

#### Medium (P2)
9. **No Request Caching**
   - **Problem:** Repeated API calls for same data
   - **Impact:** Unnecessary network traffic, slower UX
   - **Risk:** Low - Performance, cost

10. **Mixed Concerns**
    - **Problem:** UI, business logic, API calls in same component
    - **Impact:** Hard to test, reuse, maintain
    - **Risk:** Low - Code quality, testability

### 2.2 BACKEND ISSUES

#### Critical (P0)
11. **Missing CRUD Endpoints**
    - **Problem:** Frontend calls `/data-sources/:id` (update/delete) that don't exist
    - **Impact:** User actions fail silently or with generic errors
    - **Risk:** **CRITICAL** - Core functionality broken

12. **No Service Layer**
    - **Problem:** Business logic in route handlers
    - **Impact:** Code duplication, hard to test, tight coupling
    - **Risk:** **CRITICAL** - Architecture, maintainability

13. **No Background Workers**
    - **Problem:** Data collection, normalization, health checks are manual
    - **Impact:** Data is stale, system state unreliable, manual intervention required
    - **Risk:** **CRITICAL** - Core functionality, automation

14. **Missing Database Tables**
    - **Problem:** Frontend expects `data_categories`, `data_cache`, etc. that don't exist
    - **Impact:** Features completely non-functional
    - **Risk:** **CRITICAL** - Data integrity, functionality

#### High (P1)
15. **No Input Validation**
    - **Problem:** User input not validated before database insert
    - **Impact:** SQL injection risk, data corruption, crashes
    - **Risk:** High - Security, data integrity

16. **No Authorization**
    - **Problem:** Users can modify any resource (no owner checks)
    - **Impact:** Security vulnerability, data privacy risk
    - **Risk:** High - Security, compliance

17. **No Rate Limiting**
    - **Problem:** Endpoints can be spammed
    - **Impact:** DoS attacks, server overload
    - **Risk:** High - Security, availability

18. **Generic Error Messages**
    - **Problem:** `{ error: 'Failed to fetch data sources' }`
    - **Impact:** Users can't diagnose issues, information leakage risk
    - **Risk:** High - Security (info leak), UX

#### Medium (P2)
19. **No Request Logging**
    - **Problem:** Can't trace user actions or debug issues
    - **Impact:** Difficult troubleshooting, no audit trail
    - **Risk:** Medium - Debugging, compliance

20. **No Transaction Handling**
    - **Problem:** Multi-step operations not atomic
    - **Impact:** Partial updates, data inconsistency
    - **Risk:** Medium - Data integrity

### 2.3 DATABASE ISSUES

#### Critical (P0)
21. **Missing Tables**
    - **Problem:** 8+ expected tables don't exist
    - **Impact:** Features completely broken
    - **Risk:** **CRITICAL** - Data integrity, functionality

22. **No Migration Strategy**
    - **Problem:** No versioned schema evolution
    - **Impact:** Can't safely update database schema
    - **Risk:** **CRITICAL** - Deployment, downtime risk

#### High (P1)
23. **Missing Indexes**
    - **Problem:** Slow queries on `category`, `priority`, `fetch_at`
    - **Impact:** Performance degradation as data grows
    - **Risk:** High - Performance, scalability

24. **No Partitioning**
    - **Problem:** `data_hub_logs` will grow unbounded
    - **Impact:** Slow queries, storage bloat
    - **Risk:** High - Performance, cost

25. **No Foreign Key Constraints**
    - **Problem:** Orphaned records possible (deleted source, logs remain)
    - **Impact:** Data integrity issues, query errors
    - **Risk:** High - Data integrity

#### Medium (P2)
26. **JSONB Overuse**
    - **Problem:** `config`, `credentials`, `metadata` as JSONB
    - **Impact:** Hard to query, no schema validation
    - **Risk:** Medium - Queryability, maintainability

27. **No Archival Strategy**
    - **Problem:** Old logs never deleted
    - **Impact:** Database bloat, slow backups
    - **Risk:** Medium - Cost, performance

### 2.4 API / INTEGRATION ISSUES

#### Critical (P0)
28. **Frontend-Backend Mismatch**
    - **Problem:** Frontend expects endpoints/data structures that don't exist
    - **Impact:** Features completely broken in production
    - **Risk:** **CRITICAL** - Functionality, user trust

29. **Mock Data in API Client**
    - **Problem:** `fetchDataHubState()` generates fake data
    - **Impact:** Users see false information
    - **Risk:** **CRITICAL** - Data integrity, trust

#### High (P1)
30. **No API Versioning**
    - **Problem:** Breaking changes will break all clients
    - **Impact:** Can't safely evolve API
    - **Risk:** High - Maintainability, backwards compatibility

31. **No API Documentation**
    - **Problem:** No OpenAPI/Swagger spec
    - **Impact:** Frontend devs don't know contract, integration errors
    - **Risk:** High - Developer experience, integration

32. **Telegram Collector Tight Coupling**
    - **Problem:** Frontend directly depends on microservice
    - **Impact:** Fragile integration, no service boundary
    - **Risk:** High - Maintainability, reliability

#### Medium (P2)
33. **No Request Retry Logic**
    - **Problem:** Transient failures immediately fail
    - **Impact:** Poor UX on unreliable networks
    - **Risk:** Medium - UX, reliability

34. **No Request Cancellation**
    - **Problem:** Pending requests not cancelled on unmount
    - **Impact:** Memory leaks, unnecessary network traffic
    - **Risk:** Medium - Performance, memory

### 2.5 TESTING ISSUES

#### Critical (P0)
35. **Zero Test Coverage**
    - **Problem:** No unit, integration, or E2E tests found
    - **Impact:** Can't safely refactor, high regression risk
    - **Risk:** **CRITICAL** - Quality, stability

36. **No Contract Testing**
    - **Problem:** Frontend-backend contract not validated
    - **Impact:** Integration breaks go undetected
    - **Risk:** **CRITICAL** - Integration, reliability

#### High (P1)
37. **No Load Testing**
    - **Problem:** Don't know system capacity
    - **Impact:** Production crashes under load
    - **Risk:** High - Reliability, scalability

38. **No Security Testing**
    - **Problem:** SQL injection, XSS, auth bypass not tested
    - **Impact:** Vulnerabilities in production
    - **Risk:** High - Security, compliance

### 2.6 DOCUMENTATION ISSUES

#### High (P1)
39. **No API Documentation**
    - **Problem:** Endpoints, request/response schemas undocumented
    - **Impact:** Slow development, integration errors
    - **Risk:** High - Developer experience

40. **No Architecture Documentation**
    - **Problem:** Data flow, component relationships unclear
    - **Impact:** Onboarding slow, wrong assumptions
    - **Risk:** High - Maintainability, onboarding

41. **No Deployment Guide**
    - **Problem:** How to set up Data Hub in production unclear
    - **Impact:** Deployment errors, misconfiguration
    - **Risk:** High - Deployment, reliability

---

## 📝 STEP 3: TASK BACKLOG

### Task Priority Legend
- **P0 (Critical):** Blocks core functionality, security risk, data loss risk
- **P1 (High):** Major usability issue, performance problem, compliance risk
- **P2 (Medium):** Quality-of-life improvement, technical debt, optimization
- **P3 (Low):** Nice-to-have, future enhancement

### Task Estimation
- **XS:** 1-2 hours
- **S:** 3-4 hours
- **M:** 1-2 days
- **L:** 3-5 days
- **XL:** 1-2 weeks

---

### DATABASE LAYER TASKS

#### TASK-DB-001: Create Missing Database Tables
- **ID:** DB-001
- **Title:** Create data_categories table and migration
- **Layer:** database
- **Priority:** P0
- **Estimation:** M (1 day)
- **Description:**
  - Create `data_categories` table with proper schema
  - Add foreign key relationships to `data_sources`
  - Create junction table `source_categories` for many-to-many
  - Add indexes on `name`, `created_at`
  - Write up/down migrations
  
- **Files:**
  - `backend/database/migrations/XXX_create_data_categories.sql`
  - `backend/database/schema.sql` (update)
  
- **Dependencies:** None

- **Definition of Done:**
  - [ ] Table created with proper columns (id, name, description, tags, data_types, created_at, updated_at)
  - [ ] Foreign key constraints added
  - [ ] Indexes created
  - [ ] Migration scripts (up/down) tested
  - [ ] Schema.sql updated
  - [ ] Can insert/query/update/delete categories
  - [ ] Junction table `source_categories` created

---

#### TASK-DB-002: Create data_cache table
- **ID:** DB-002
- **Title:** Create data cache table for source data
- **Layer:** database
- **Priority:** P0
- **Estimation:** M (1 day)
- **Description:**
  - Create `data_cache` table to store fetched data from sources
  - Include TTL/expiry mechanism
  - Add indexes for fast lookups by source_id, data_type
  - Partition by date for performance
  
- **Files:**
  - `backend/database/migrations/XXX_create_data_cache.sql`
  
- **Dependencies:** None

- **Definition of Done:**
  - [ ] Table created with columns (id, source_id, data_type, data, fetched_at, expires_at, size_bytes, created_at)
  - [ ] Foreign key to `data_sources`
  - [ ] Indexes on `source_id`, `data_type`, `expires_at`
  - [ ] Partitioning strategy implemented (monthly)
  - [ ] Cleanup job configuration added (delete expired rows)
  - [ ] Migration tested

---

#### TASK-DB-003: Create data_pipeline_snapshots table
- **ID:** DB-003
- **Title:** Create pipeline metrics snapshot table
- **Layer:** database
- **Priority:** P0
- **Estimation:** M (1 day)
- **Description:**
  - Create table to store periodic snapshots of pipeline metrics
  - Enable historical comparison and trending
  - Store aggregated stats (requests, pass rate, failures)
  
- **Files:**
  - `backend/database/migrations/XXX_create_pipeline_snapshots.sql`
  
- **Dependencies:** DB-001 (categories table)

- **Definition of Done:**
  - [ ] Table created with columns (id, generated_at, total_requests_24h, passed_24h, failed_24h, pending_24h, metrics_json, created_at)
  - [ ] JSONB column for flexible metrics storage
  - [ ] Index on `generated_at` for time-based queries
  - [ ] Retention policy configured (keep 90 days)
  - [ ] Migration tested

---

#### TASK-DB-004: Create data_access_logs table
- **ID:** DB-004
- **Title:** Create access logs for agent-source tracking
- **Layer:** database
- **Priority:** P0
- **Estimation:** S (4 hours)
- **Description:**
  - Create table to log AI agent access to data sources
  - Track status (success, cached, failed, timeout)
  - Enable access pattern analysis
  
- **Files:**
  - `backend/database/migrations/XXX_create_data_access_logs.sql`
  
- **Dependencies:** None

- **Definition of Done:**
  - [ ] Table created with columns (id, agent_id, source_id, data_type, status, response_time_ms, error, created_at)
  - [ ] Indexes on `agent_id`, `source_id`, `status`, `created_at`
  - [ ] Partitioning by month (for performance)
  - [ ] Retention policy configured (keep 30 days)
  - [ ] Migration tested

---

#### TASK-DB-005: Create advanced features tables
- **ID:** DB-005
- **Title:** Create web_crawlers, telegram_publishers, automation_topics tables
- **Layer:** database
- **Priority:** P1
- **Estimation:** L (3 days)
- **Description:**
  - Create `web_crawlers` table for crawler configs
  - Create `telegram_publishers` table for Telegram channel publishers
  - Create `automation_topics` table for agent-data routing
  - Create `publisher_queue` table for pending publish tasks
  
- **Files:**
  - `backend/database/migrations/XXX_create_advanced_features.sql`
  
- **Dependencies:** DB-001

- **Definition of Done:**
  - [ ] `web_crawlers` table created (id, name, url_pattern, schedule, config, last_run_at, status)
  - [ ] `telegram_publishers` table created (id, name, channel_id, bot_token, config, is_enabled)
  - [ ] `automation_topics` table created (id, name, data_types, agent_ids, publisher_ids, filters, enabled)
  - [ ] `publisher_queue` table created (id, publisher_id, topic_id, payload, status, scheduled_at, published_at)
  - [ ] All foreign keys and indexes added
  - [ ] Migrations tested

---

#### TASK-DB-006: Create access control tables
- **ID:** DB-006
- **Title:** Create blacklist and whitelist tables
- **Layer:** database
- **Priority:** P1
- **Estimation:** S (4 hours)
- **Description:**
  - Create `data_blacklist` table for blocked sources/patterns
  - Create `data_whitelist` table for explicitly allowed sources
  - Enable access control enforcement
  
- **Files:**
  - `backend/database/migrations/XXX_create_access_control.sql`
  
- **Dependencies:** None

- **Definition of Done:**
  - [ ] `data_blacklist` table created (id, type, pattern, reason, created_by, created_at)
  - [ ] `data_whitelist` table created (id, type, pattern, priority, created_by, created_at)
  - [ ] Indexes on `type`, `pattern`
  - [ ] Unique constraints to prevent duplicates
  - [ ] Migration tested

---

#### TASK-DB-007: Add missing indexes
- **ID:** DB-007
- **Title:** Add performance indexes to data_sources
- **Layer:** database
- **Priority:** P1
- **Estimation:** XS (1 hour)
- **Description:**
  - Add indexes on frequently queried columns
  - Improve query performance for filtering and sorting
  
- **Files:**
  - `backend/database/migrations/XXX_add_data_sources_indexes.sql`
  
- **Dependencies:** None

- **Definition of Done:**
  - [ ] Index on `category` column
  - [ ] Index on `priority` column
  - [ ] Index on `last_fetch_at` column
  - [ ] Index on `is_enabled` column
  - [ ] Composite index on `(status, is_enabled)` for active source queries
  - [ ] EXPLAIN ANALYZE shows improved query plans
  - [ ] Migration tested

---

#### TASK-DB-008: Add missing indexes to data_hub_logs
- **ID:** DB-008
- **Title:** Add performance indexes to logs table
- **Layer:** database
- **Priority:** P1
- **Estimation:** XS (1 hour)
- **Description:**
  - Add indexes for log filtering queries
  - Improve performance of status and action filters
  
- **Files:**
  - `backend/database/migrations/XXX_add_logs_indexes.sql`
  
- **Dependencies:** None

- **Definition of Done:**
  - [ ] Index on `status` column
  - [ ] Index on `action` column
  - [ ] Composite index on `(source_id, created_at DESC)`
  - [ ] Composite index on `(status, created_at DESC)`
  - [ ] EXPLAIN ANALYZE shows improved query plans
  - [ ] Migration tested

---

#### TASK-DB-009: Implement log table partitioning
- **ID:** DB-009
- **Title:** Partition data_hub_logs by month
- **Layer:** database
- **Priority:** P2
- **Estimation:** M (2 days)
- **Description:**
  - Convert `data_hub_logs` to partitioned table
  - Create monthly partitions
  - Automate partition creation
  - Configure retention policy
  
- **Files:**
  - `backend/database/migrations/XXX_partition_logs.sql`
  - `backend/scripts/create-log-partition.js` (automation script)
  
- **Dependencies:** None

- **Definition of Done:**
  - [ ] Logs table partitioned by month (on `created_at`)
  - [ ] Script to create new partitions automatically
  - [ ] Scheduled job to drop old partitions (>90 days)
  - [ ] Existing data migrated to partitioned table
  - [ ] Query performance tested (EXPLAIN ANALYZE)
  - [ ] Documentation updated

---

#### TASK-DB-010: Add foreign key constraints
- **ID:** DB-010
- **Title:** Add foreign key constraints for data integrity
- **Layer:** database
- **Priority:** P1
- **Estimation:** S (4 hours)
- **Description:**
  - Add ON DELETE CASCADE/SET NULL to orphaned relationships
  - Ensure referential integrity
  - Clean up existing orphaned records
  
- **Files:**
  - `backend/database/migrations/XXX_add_foreign_keys.sql`
  
- **Dependencies:** DB-001, DB-002, DB-003, DB-004

- **Definition of Done:**
  - [ ] Existing orphaned records cleaned up
  - [ ] Foreign keys added with appropriate ON DELETE actions
  - [ ] Constraint violations tested and handled
  - [ ] Documentation of referential integrity rules
  - [ ] Migration tested

---

### BACKEND LAYER TASKS

#### TASK-BE-001: Implement data sources CRUD endpoints
- **ID:** BE-001
- **Title:** Complete data sources REST API (update, delete)
- **Layer:** backend
- **Priority:** P0
- **Estimation:** M (1 day)
- **Description:**
  - Implement `PUT /api/data-sources/:id` (update source)
  - Implement `DELETE /api/data-sources/:id` (delete source)
  - Add input validation middleware
  - Add authorization checks (user owns resource)
  - Return proper error codes and messages
  
- **Files:**
  - `backend/routes/data-sources.js`
  - `backend/middleware/validation.js` (new)
  
- **Dependencies:** None

- **Definition of Done:**
  - [ ] PUT endpoint updates source in database
  - [ ] DELETE endpoint removes source (cascade delete logs)
  - [ ] Input validation using Joi/Yup
  - [ ] Authorization: only owner can modify
  - [ ] Error handling with descriptive messages
  - [ ] Response follows consistent API schema
  - [ ] Manual testing with Postman/curl
  - [ ] Frontend integration tested

---

#### TASK-BE-002: Implement test source connection endpoint
- **ID:** BE-002
- **Title:** Test data source connectivity
- **Layer:** backend
- **Priority:** P0
- **Estimation:** M (2 days)
- **Description:**
  - Implement `POST /api/data-sources/:id/test`
  - Support testing different source types (API, RSS, Telegram, web)
  - Return connection status, response time, sample data
  - Handle timeouts gracefully
  
- **Files:**
  - `backend/routes/data-sources.js`
  - `backend/services/sourceConnector.js` (new)
  
- **Dependencies:** BE-001

- **Definition of Done:**
  - [ ] Endpoint tests source connectivity
  - [ ] Supports all source types (API, RSS, Telegram, web)
  - [ ] Returns status, response time, sample data
  - [ ] Timeout configured (10s max)
  - [ ] Logs test result to `data_hub_logs`
  - [ ] Updates source `last_fetch_at` and `health_status`
  - [ ] Error handling for network failures
  - [ ] Frontend integration tested

---

#### TASK-BE-003: Implement fetch source data endpoint
- **ID:** BE-003
- **Title:** Fetch data from source and cache it
- **Layer:** backend
- **Priority:** P0
- **Estimation:** L (3 days)
- **Description:**
  - Implement `GET /api/data-sources/:id/data`
  - Fetch data from source (API, RSS, Telegram, etc.)
  - Cache result in `data_cache` table
  - Return cached data if fresh (within TTL)
  - Support query params: `?cache=false` to force refresh
  
- **Files:**
  - `backend/routes/data-sources.js`
  - `backend/services/dataFetcher.js` (new)
  - `backend/services/cacheManager.js` (new)
  
- **Dependencies:** BE-002, DB-002

- **Definition of Done:**
  - [ ] Endpoint fetches data from source
  - [ ] Data stored in `data_cache` table
  - [ ] Cached data returned if within TTL (default 5 min)
  - [ ] `?cache=false` forces fresh fetch
  - [ ] Supports all source types
  - [ ] Logs fetch attempt to `data_hub_logs`
  - [ ] Error handling for fetch failures
  - [ ] Response includes metadata (cached, fetch_time, expires_at)
  - [ ] Frontend integration tested

---

#### TASK-BE-004: Implement categories CRUD endpoints
- **ID:** BE-004
- **Title:** Create categories management API
- **Layer:** backend
- **Priority:** P0
- **Estimation:** M (1 day)
- **Description:**
  - Implement `GET /api/data-categories` (list)
  - Implement `POST /api/data-categories` (create)
  - Implement `PUT /api/data-categories/:id` (update)
  - Implement `DELETE /api/data-categories/:id` (delete)
  - Validate category data (name, tags, data_types)
  
- **Files:**
  - `backend/routes/data-categories.js` (new)
  
- **Dependencies:** DB-001

- **Definition of Done:**
  - [ ] All CRUD endpoints implemented
  - [ ] Input validation with Joi/Yup
  - [ ] Authorization checks (only admins can manage categories)
  - [ ] Cannot delete category with linked sources (or cascade delete)
  - [ ] Returns category with source count
  - [ ] Consistent error handling
  - [ ] Frontend integration tested

---

#### TASK-BE-005: Implement pipeline snapshot endpoint
- **ID:** BE-005
- **Title:** Generate and return pipeline metrics snapshot
- **Layer:** backend
- **Priority:** P0
- **Estimation:** L (3 days)
- **Description:**
  - Implement `GET /api/data-pipeline/snapshot`
  - Calculate aggregate metrics from logs and sources
  - Store snapshot in `data_pipeline_snapshots` table
  - Return latest snapshot or generate new one
  
- **Files:**
  - `backend/routes/data-pipeline.js` (new)
  - `backend/services/pipelineAnalyzer.js` (new)
  
- **Dependencies:** DB-003, DB-004

- **Definition of Done:**
  - [ ] Endpoint returns pipeline snapshot
  - [ ] Calculates: total_requests_24h, passed_24h, failed_24h, pending_24h
  - [ ] Aggregates by category and source
  - [ ] Stores snapshot in database
  - [ ] Cached for 5 minutes (don't recalculate on every request)
  - [ ] Supports `?refresh=true` to force recalculation
  - [ ] Returns historical snapshots via `?history=true`
  - [ ] Frontend integration tested

---

#### TASK-BE-006: Implement access logs endpoint
- **ID:** BE-006
- **Title:** Query access logs with filtering
- **Layer:** backend
- **Priority:** P1
- **Estimation:** M (1 day)
- **Description:**
  - Implement `GET /api/data-access-logs`
  - Support filtering by source, agent, status, date range
  - Support pagination (limit, offset)
  - Support sorting
  
- **Files:**
  - `backend/routes/data-access-logs.js` (new)
  
- **Dependencies:** DB-004

- **Definition of Done:**
  - [ ] Endpoint returns paginated logs
  - [ ] Query params: `source_id`, `agent_id`, `status`, `from_date`, `to_date`, `limit`, `offset`, `sort`
  - [ ] Default limit: 50, max limit: 500
  - [ ] Returns total count for pagination UI
  - [ ] Indexes used for fast queries
  - [ ] Frontend integration tested

---

#### TASK-BE-007: Create DataHub service layer
- **ID:** BE-007
- **Title:** Extract business logic from routes to services
- **Layer:** backend
- **Priority:** P0
- **Estimation:** L (4 days)
- **Description:**
  - Create `services/dataHub.js` with core logic
  - Create `services/dataSource.js` for source management
  - Create `services/dataPipeline.js` for pipeline logic
  - Move business logic from routes to services
  - Make services testable (dependency injection)
  
- **Files:**
  - `backend/services/dataHub.js` (new)
  - `backend/services/dataSource.js` (new)
  - `backend/services/dataPipeline.js` (new)
  - `backend/routes/data-sources.js` (refactor)
  - `backend/routes/data-categories.js` (refactor)
  - `backend/routes/data-pipeline.js` (refactor)
  
- **Dependencies:** BE-001, BE-002, BE-003, BE-004, BE-005

- **Definition of Done:**
  - [ ] Routes are thin (just validation + service call + response)
  - [ ] Business logic in services
  - [ ] Services don't depend on Express (req, res)
  - [ ] Services are testable (mocked database)
  - [ ] Consistent error handling (throw custom errors)
  - [ ] All existing tests still pass
  - [ ] New unit tests for services (>80% coverage)

---

#### TASK-BE-008: Implement input validation middleware
- **ID:** BE-008
- **Title:** Centralized request validation with Joi
- **Layer:** backend
- **Priority:** P1
- **Estimation:** M (2 days)
- **Description:**
  - Create validation middleware using Joi
  - Define schemas for all request bodies
  - Validate input before reaching route handler
  - Return 400 with detailed error messages
  
- **Files:**
  - `backend/middleware/validation.js` (new)
  - `backend/schemas/dataSource.js` (new)
  - `backend/schemas/dataCategory.js` (new)
  
- **Dependencies:** None

- **Definition of Done:**
  - [ ] Validation middleware created
  - [ ] Schemas for all data types (source, category, etc.)
  - [ ] Applied to all POST/PUT endpoints
  - [ ] Returns 400 with field-level errors
  - [ ] SQL injection prevented (no raw strings)
  - [ ] XSS prevented (sanitize HTML)
  - [ ] Unit tests for validation logic

---

#### TASK-BE-009: Implement authorization middleware
- **ID:** BE-009
- **Title:** Add resource ownership checks
- **Layer:** backend
- **Priority:** P1
- **Estimation:** M (1 day)
- **Description:**
  - Add `created_by` column to `data_sources` and `data_categories`
  - Verify user owns resource before update/delete
  - Admin role can modify any resource
  - Return 403 Forbidden if not authorized
  
- **Files:**
  - `backend/middleware/authorize.js` (new)
  - `backend/database/migrations/XXX_add_ownership.sql`
  
- **Dependencies:** TASK-BE-008

- **Definition of Done:**
  - [ ] `created_by` column added to tables
  - [ ] Authorization middleware created
  - [ ] Applied to PUT/DELETE endpoints
  - [ ] Returns 403 if user doesn't own resource
  - [ ] Admin role bypasses checks
  - [ ] Unit tests for authorization logic

---

#### TASK-BE-010: Implement rate limiting
- **ID:** BE-010
- **Title:** Add rate limiting to API endpoints
- **Layer:** backend
- **Priority:** P1
- **Estimation:** S (4 hours)
- **Description:**
  - Use `express-rate-limit` middleware
  - Configure limits per endpoint
  - Return 429 Too Many Requests
  
- **Files:**
  - `backend/middleware/rateLimiter.js` (enhance existing)
  - `backend/routes/data-sources.js` (apply middleware)
  
- **Dependencies:** None

- **Definition of Done:**
  - [ ] Rate limiting applied to all Data Hub endpoints
  - [ ] Limits: 100 req/15min per user for reads, 20 req/15min for writes
  - [ ] Returns 429 with Retry-After header
  - [ ] Redis-backed (shared across instances)
  - [ ] Unit tests for rate limiter

---

#### TASK-BE-011: Implement request/response logging
- **ID:** BE-011
- **Title:** Log all Data Hub API requests
- **Layer:** backend
- **Priority:** P2
- **Estimation:** S (3 hours)
- **Description:**
  - Log request (method, path, user, IP, timestamp)
  - Log response (status, duration)
  - Log errors (stack trace)
  - Use structured logging (JSON)
  
- **Files:**
  - `backend/middleware/requestLogger.js` (enhance existing)
  
- **Dependencies:** None

- **Definition of Done:**
  - [ ] All Data Hub requests logged
  - [ ] Includes correlation ID for tracing
  - [ ] Sensitive data (credentials, tokens) redacted
  - [ ] Logs searchable by user, endpoint, status
  - [ ] Integration with logging service (e.g., Winston, Datadog)

---

#### TASK-BE-012: Create data collection background worker
- **ID:** BE-012
- **Title:** Periodic data fetching from sources
- **Layer:** backend
- **Priority:** P0
- **Estimation:** L (3 days)
- **Description:**
  - Create worker process to fetch data from active sources
  - Schedule based on source `update_interval` config
  - Update cache and logs
  - Handle failures gracefully (retry with backoff)
  
- **Files:**
  - `backend/workers/dataCollector.js` (new)
  - `backend/services/scheduler.js` (enhance)
  
- **Dependencies:** BE-003, BE-007

- **Definition of Done:**
  - [ ] Worker process runs independently
  - [ ] Fetches data from all active sources on schedule
  - [ ] Respects `update_interval` config (default 5 min)
  - [ ] Updates `last_fetch_at` timestamp
  - [ ] Logs success/failure to `data_hub_logs`
  - [ ] Retry failed fetches (3 attempts with exponential backoff)
  - [ ] Marks source as `error` status after max retries
  - [ ] Can be started/stopped via PM2
  - [ ] Logs worker activity
  - [ ] Integration tested

---

#### TASK-BE-013: Create pipeline refresh background worker
- **ID:** BE-013
- **Title:** Periodic pipeline snapshot generation
- **Layer:** backend
- **Priority:** P1
- **Estimation:** M (2 days)
- **Description:**
  - Create worker to generate pipeline snapshots periodically
  - Run every 15 minutes
  - Store snapshot in database
  - Prune old snapshots (keep 90 days)
  
- **Files:**
  - `backend/workers/pipelineRefresh.js` (new)
  
- **Dependencies:** BE-005, BE-007

- **Definition of Done:**
  - [ ] Worker runs every 15 minutes
  - [ ] Generates pipeline snapshot
  - [ ] Stores in `data_pipeline_snapshots`
  - [ ] Deletes snapshots older than 90 days
  - [ ] Logs worker activity
  - [ ] Can be started/stopped via PM2
  - [ ] Integration tested

---

#### TASK-BE-014: Create health check background worker
- **ID:** BE-014
- **Title:** Periodic health checks for all sources
- **Layer:** backend
- **Priority:** P1
- **Estimation:** M (1 day)
- **Description:**
  - Create worker to test all source connections
  - Run every hour
  - Update `health_status` in database
  - Alert on health degradation
  
- **Files:**
  - `backend/workers/healthMonitor.js` (new)
  
- **Dependencies:** BE-002, BE-007

- **Definition of Done:**
  - [ ] Worker runs every hour
  - [ ] Tests all enabled sources
  - [ ] Updates `health_status` column
  - [ ] Logs health check results
  - [ ] Sends alert (webhook/email) if critical source fails
  - [ ] Can be started/stopped via PM2
  - [ ] Integration tested

---

#### TASK-BE-015: Implement web crawler service
- **ID:** BE-015
- **Title:** Web scraping functionality for web sources
- **Layer:** backend
- **Priority:** P2
- **Estimation:** XL (2 weeks)
- **Description:**
  - Implement web crawler using Puppeteer/Playwright
  - Support JavaScript-rendered pages
  - Extract data based on CSS selectors/XPath
  - Handle authentication, cookies, rate limiting
  - Store crawler configs in `web_crawlers` table
  
- **Files:**
  - `backend/services/webCrawler.js` (new)
  - `backend/routes/web-crawlers.js` (new)
  
- **Dependencies:** DB-005, BE-007

- **Definition of Done:**
  - [ ] Crawler service implemented
  - [ ] Supports CSS selectors and XPath
  - [ ] Handles dynamic (JS-rendered) content
  - [ ] Respects robots.txt
  - [ ] Rate limiting per domain
  - [ ] Stores extracted data in `data_cache`
  - [ ] CRUD endpoints for crawler configs
  - [ ] Manual trigger and scheduled execution
  - [ ] Logs crawler runs
  - [ ] Unit and integration tests

---

#### TASK-BE-016: Implement Telegram publisher service
- **ID:** BE-016
- **Title:** Publish data to Telegram channels
- **Layer:** backend
- **Priority:** P2
- **Estimation:** L (4 days)
- **Description:**
  - Implement Telegram bot integration
  - Queue messages in `publisher_queue`
  - Publish to channels on schedule
  - Support text, images, formatting
  
- **Files:**
  - `backend/services/telegramPublisher.js` (new)
  - `backend/routes/telegram-publishers.js` (new)
  - `backend/workers/publisherWorker.js` (new)
  
- **Dependencies:** DB-005, BE-007

- **Definition of Done:**
  - [ ] Publisher service implemented
  - [ ] CRUD endpoints for publisher configs
  - [ ] Queue table managed
  - [ ] Worker processes queue
  - [ ] Supports text, images, formatting (Markdown, HTML)
  - [ ] Handles Telegram API errors (rate limits, bans)
  - [ ] Retry logic with exponential backoff
  - [ ] Logs publish attempts
  - [ ] Integration tested with test Telegram channel

---

#### TASK-BE-017: Implement automation routing service
- **ID:** BE-017
- **Title:** Route data to agents based on topics
- **Layer:** backend
- **Priority:** P2
- **Estimation:** L (3 days)
- **Description:**
  - Implement automation logic (agent-topic-publisher routing)
  - When data arrives, match to topics
  - Route to agents and publishers
  - Store routing rules in `automation_topics`
  
- **Files:**
  - `backend/services/automationRouter.js` (new)
  - `backend/routes/automation-topics.js` (new)
  
- **Dependencies:** DB-005, BE-007, BE-016

- **Definition of Done:**
  - [ ] Routing service implemented
  - [ ] CRUD endpoints for automation topics
  - [ ] When data fetched, matches to topics
  - [ ] Notifies agents via webhook/message queue
  - [ ] Enqueues publisher tasks
  - [ ] Supports filters (data type, source category, etc.)
  - [ ] Logs routing decisions
  - [ ] Unit and integration tests

---

#### TASK-BE-018: Implement access control service
- **ID:** BE-018
- **Title:** Enforce blacklist/whitelist rules
- **Layer:** backend
- **Priority:** P2
- **Estimation:** M (2 days)
- **Description:**
  - Implement access control logic
  - Check blacklist/whitelist before data fetch
  - Block or allow based on rules
  - CRUD endpoints for rules
  
- **Files:**
  - `backend/services/accessControl.js` (new)
  - `backend/routes/access-control.js` (new)
  
- **Dependencies:** DB-006, BE-007

- **Definition of Done:**
  - [ ] Access control service implemented
  - [ ] Checks blacklist before fetch
  - [ ] Checks whitelist for allowed overrides
  - [ ] CRUD endpoints for rules
  - [ ] Logs blocked attempts
  - [ ] Returns 403 Forbidden for blocked sources
  - [ ] Unit tests for rule matching logic

---

### FRONTEND LAYER TASKS

#### TASK-FE-001: Remove mock data from API client
- **ID:** FE-001
- **Title:** Connect fetchDataHubState to real backend endpoint
- **Layer:** frontend
- **Priority:** P0
- **Estimation:** M (1 day)
- **Description:**
  - Remove mock data generation from `services/api.ts`
  - Call real backend endpoint `/api/data-sources/state`
  - Handle errors gracefully
  - Show loading state
  
- **Files:**
  - `services/api.ts`
  
- **Dependencies:** BE-001, BE-004, BE-005

- **Definition of Done:**
  - [ ] `fetchDataHubState()` calls real endpoint
  - [ ] No mock data returned
  - [ ] Error handling (network failure, 500 error)
  - [ ] Loading state displayed in UI
  - [ ] Data matches backend response schema
  - [ ] Integration tested with real backend

---

#### TASK-FE-002: Implement error boundaries
- **ID:** FE-002
- **Title:** Add error boundaries for failure isolation
- **Layer:** frontend
- **Priority:** P0
- **Estimation:** S (4 hours)
- **Description:**
  - Create `<ErrorBoundary>` component
  - Wrap Data Hub tab and each sub-tab
  - Show user-friendly error message
  - Log error to monitoring service
  
- **Files:**
  - `components/common/ErrorBoundary.tsx` (new)
  - `components/ai/AIManager/tabs/DataHubTab.tsx` (wrap)
  
- **Dependencies:** None

- **Definition of Done:**
  - [ ] Error boundary component created
  - [ ] Applied to Data Hub tab
  - [ ] Applied to each sub-tab (sources, categories, etc.)
  - [ ] Shows fallback UI on error
  - [ ] Errors logged to Sentry/Datadog
  - [ ] "Try again" button to recover
  - [ ] Unit tests for error boundary

---

#### TASK-FE-003: Split DataHubTab into smaller components
- **ID:** FE-003
- **Title:** Refactor 1,738-line component into manageable pieces
- **Layer:** frontend
- **Priority:** P0
- **Estimation:** L (4 days)
- **Description:**
  - Extract each tab view into separate component
  - Extract modals into separate files (already done)
  - Extract common logic into custom hooks
  - Reduce component to <300 lines
  
- **Files:**
  - `components/ai/AIManager/tabs/DataHubTab.tsx` (refactor)
  - `components/ai/AIManager/tabs/DataHub/SourcesTab.tsx` (new)
  - `components/ai/AIManager/tabs/DataHub/CategoriesTab.tsx` (new)
  - `components/ai/AIManager/tabs/DataHub/PipelineTab.tsx` (new)
  - `components/ai/AIManager/tabs/DataHub/HealthTab.tsx` (new)
  - `components/ai/AIManager/tabs/DataHub/LogsTab.tsx` (new)
  - `components/ai/AIManager/tabs/DataHub/TelegramTab.tsx` (new)
  - `hooks/useDataHub.ts` (new - custom hook)
  
- **Dependencies:** FE-002

- **Definition of Done:**
  - [ ] Each tab is a separate component
  - [ ] Main component orchestrates tabs (routing)
  - [ ] Shared state in custom hook `useDataHub()`
  - [ ] Each component <300 lines
  - [ ] All functionality still works
  - [ ] No regressions
  - [ ] Unit tests for each component

---

#### TASK-FE-004: Implement pagination for logs
- **ID:** FE-004
- **Title:** Add pagination to access logs view
- **Layer:** frontend
- **Priority:** P0
- **Estimation:** M (1 day)
- **Description:**
  - Replace "Load more" button with proper pagination
  - Show page numbers, prev/next buttons
  - Sync with backend pagination
  - Display total count and current range
  
- **Files:**
  - `components/ai/AIManager/tabs/DataHub/LogsTab.tsx`
  - `components/common/Pagination.tsx` (new - reusable component)
  
- **Dependencies:** FE-003, BE-006

- **Definition of Done:**
  - [ ] Pagination UI component created
  - [ ] Applied to logs tab
  - [ ] Shows: Page 1 of 10 (50-100 of 500 results)
  - [ ] Prev/Next buttons work
  - [ ] Jump to specific page
  - [ ] URL query param reflects current page (shareable links)
  - [ ] No performance issues with large datasets
  - [ ] Unit tests for pagination logic

---

#### TASK-FE-005: Implement pagination for sources
- **ID:** FE-005
- **Title:** Add pagination to data sources list
- **Layer:** frontend
- **Priority:** P1
- **Estimation:** S (4 hours)
- **Description:**
  - Add pagination to sources tab
  - Reuse `<Pagination>` component from FE-004
  
- **Files:**
  - `components/ai/AIManager/tabs/DataHub/SourcesTab.tsx`
  
- **Dependencies:** FE-004

- **Definition of Done:**
  - [ ] Pagination applied to sources list
  - [ ] Default 20 sources per page
  - [ ] URL param reflects page
  - [ ] Unit tests

---

#### TASK-FE-006: Add form validation library
- **ID:** FE-006
- **Title:** Integrate React Hook Form + Yup
- **Layer:** frontend
- **Priority:** P1
- **Estimation:** M (2 days)
- **Description:**
  - Install React Hook Form and Yup
  - Refactor all modals to use form library
  - Define validation schemas
  - Show field-level errors
  
- **Files:**
  - All modal components
  - `schemas/dataSource.ts` (new - validation schemas)
  - `schemas/dataCategory.ts` (new)
  
- **Dependencies:** FE-003

- **Definition of Done:**
  - [ ] React Hook Form integrated
  - [ ] All forms use `useForm()` hook
  - [ ] Validation schemas defined with Yup
  - [ ] Field errors shown inline
  - [ ] Form can't submit if invalid
  - [ ] Duplicate validation logic removed
  - [ ] Unit tests for validation

---

#### TASK-FE-007: Implement global state management
- **ID:** FE-007
- **Title:** Use Zustand/Redux for Data Hub state
- **Layer:** frontend
- **Priority:** P1
- **Estimation:** L (3 days)
- **Description:**
  - Choose state management library (Zustand recommended for simplicity)
  - Create Data Hub store
  - Move state from component to store
  - Eliminate prop drilling
  
- **Files:**
  - `stores/dataHubStore.ts` (new)
  - `components/ai/AIManager/tabs/DataHubTab.tsx` (refactor)
  - All sub-components (refactor)
  
- **Dependencies:** FE-003

- **Definition of Done:**
  - [ ] State management library integrated
  - [ ] Data Hub store created (sources, categories, logs, etc.)
  - [ ] All components read from store
  - [ ] Actions for CRUD operations
  - [ ] No more prop drilling
  - [ ] Optimistic updates for better UX
  - [ ] Devtools enabled for debugging
  - [ ] Unit tests for store logic

---

#### TASK-FE-008: Add loading skeletons
- **ID:** FE-008
- **Title:** Show skeleton loaders during data fetch
- **Layer:** frontend
- **Priority:** P2
- **Estimation:** M (1 day)
- **Description:**
  - Create skeleton components for sources, logs, etc.
  - Show during initial load
  - Replace spinners with skeletons
  
- **Files:**
  - `components/common/Skeleton.tsx` (new)
  - All Data Hub sub-components (apply skeletons)
  
- **Dependencies:** None

- **Definition of Done:**
  - [ ] Skeleton components created
  - [ ] Applied to all loading states
  - [ ] Matches final UI layout
  - [ ] Smooth transition from skeleton to content
  - [ ] Accessible (ARIA labels)

---

#### TASK-FE-009: Implement accessibility (a11y)
- **ID:** FE-009
- **Title:** Add ARIA labels, keyboard navigation, screen reader support
- **Layer:** frontend
- **Priority:** P1
- **Estimation:** L (3 days)
- **Description:**
  - Add ARIA labels to all interactive elements
  - Implement keyboard navigation (Tab, Enter, Escape)
  - Test with screen reader (NVDA, JAWS, VoiceOver)
  - Fix focus management in modals
  
- **Files:**
  - All Data Hub components
  
- **Dependencies:** FE-003

- **Definition of Done:**
  - [ ] All buttons have accessible labels
  - [ ] All forms are keyboard navigable
  - [ ] Modals trap focus (can't Tab outside)
  - [ ] Escape closes modals
  - [ ] Screen reader announces state changes
  - [ ] Color contrast meets WCAG AA
  - [ ] Tested with axe DevTools (0 violations)
  - [ ] Tested with screen reader

---

#### TASK-FE-010: Add request caching
- **ID:** FE-010
- **Title:** Cache API responses to reduce network calls
- **Layer:** frontend
- **Priority:** P2
- **Estimation:** M (2 days)
- **Description:**
  - Integrate React Query (TanStack Query)
  - Cache API responses with TTL
  - Implement background refetch
  - Show stale-while-revalidate
  
- **Files:**
  - `services/api.ts` (refactor to use React Query)
  - All Data Hub components (use query hooks)
  
- **Dependencies:** FE-007

- **Definition of Done:**
  - [ ] React Query integrated
  - [ ] All API calls use query hooks
  - [ ] Caching with 5-minute TTL
  - [ ] Background refetch on window focus
  - [ ] Optimistic updates for mutations
  - [ ] Loading/error states managed by library
  - [ ] Reduced network traffic (verify in DevTools)

---

#### TASK-FE-011: Implement request cancellation
- **ID:** FE-011
- **Title:** Cancel pending requests on component unmount
- **Layer:** frontend
- **Priority:** P2
- **Estimation:** S (4 hours)
- **Description:**
  - Use AbortController for fetch requests
  - Cancel on unmount or when new request starts
  - Prevent memory leaks
  
- **Files:**
  - `services/api.ts` (add abort support)
  - Data Hub components (cleanup on unmount)
  
- **Dependencies:** FE-010

- **Definition of Done:**
  - [ ] All API calls support cancellation
  - [ ] Requests cancelled on unmount
  - [ ] No memory leaks (tested with React DevTools Profiler)
  - [ ] No "Can't perform state update on unmounted component" warnings

---

#### TASK-FE-012: Add empty states
- **ID:** FE-012
- **Title:** Show helpful messages when no data exists
- **Layer:** frontend
- **Priority:** P2
- **Estimation:** S (3 hours)
- **Description:**
  - Create empty state components
  - Show when no sources, logs, categories exist
  - Provide call-to-action (e.g., "Add your first source")
  
- **Files:**
  - `components/common/EmptyState.tsx` (new)
  - All Data Hub tabs (apply empty states)
  
- **Dependencies:** None

- **Definition of Done:**
  - [ ] Empty state component created
  - [ ] Applied to all tabs
  - [ ] Shows helpful message and CTA
  - [ ] Illustration/icon included
  - [ ] Accessible

---

#### TASK-FE-013: Implement advanced filters
- **ID:** FE-013
- **Title:** Add advanced filtering UI for sources and logs
- **Layer:** frontend
- **Priority:** P2
- **Estimation:** M (2 days)
- **Description:**
  - Add filter panel with multiple criteria
  - Support AND/OR logic
  - Save filter presets
  - Apply filters to API queries
  
- **Files:**
  - `components/ai/AIManager/tabs/DataHub/FilterPanel.tsx` (new)
  - Sources and Logs tabs
  
- **Dependencies:** FE-004, FE-005

- **Definition of Done:**
  - [ ] Filter panel UI created
  - [ ] Supports multiple filter criteria (status, type, category, date, etc.)
  - [ ] AND/OR toggle
  - [ ] "Save filter" feature
  - [ ] Filters passed to backend as query params
  - [ ] URL reflects active filters
  - [ ] Clear all filters button
  - [ ] Unit tests

---

### API / INTEGRATION LAYER TASKS

#### TASK-API-001: Create OpenAPI/Swagger documentation
- **ID:** API-001
- **Title:** Document all Data Hub API endpoints
- **Layer:** api
- **Priority:** P1
- **Estimation:** M (2 days)
- **Description:**
  - Write OpenAPI 3.0 spec for all endpoints
  - Include request/response schemas
  - Add examples for each endpoint
  - Generate interactive docs with Swagger UI
  
- **Files:**
  - `backend/docs/openapi.yaml` (new)
  - `backend/server.js` (serve Swagger UI at `/api/docs`)
  
- **Dependencies:** BE-001, BE-002, BE-003, BE-004, BE-005, BE-006

- **Definition of Done:**
  - [ ] OpenAPI spec written
  - [ ] All Data Hub endpoints documented
  - [ ] Request/response schemas defined
  - [ ] Examples included
  - [ ] Swagger UI accessible at `/api/docs`
  - [ ] Spec validated (no errors)

---

#### TASK-API-002: Implement API versioning
- **ID:** API-002
- **Title:** Add /api/v1 prefix to all endpoints
- **Layer:** api
- **Priority:** P1
- **Estimation:** M (1 day)
- **Description:**
  - Move all Data Hub endpoints under `/api/v1`
  - Support multiple versions in future
  - Update frontend to use versioned endpoints
  
- **Files:**
  - `backend/server.js` (route prefix)
  - `services/api.ts` (update base URL)
  
- **Dependencies:** All backend tasks

- **Definition of Done:**
  - [ ] All endpoints under `/api/v1`
  - [ ] Frontend updated
  - [ ] Old endpoints deprecated (return 410 Gone)
  - [ ] Version documented in API docs

---

#### TASK-API-003: Implement API response standardization
- **ID:** API-003
- **Title:** Consistent response format for all endpoints
- **Layer:** api
- **Priority:** P1
- **Estimation:** M (1 day)
- **Description:**
  - Define standard response format: `{ success, data, error, meta }`
  - Apply to all Data Hub endpoints
  - Include pagination meta in list responses
  
- **Files:**
  - `backend/utils/apiResponse.js` (new - helper functions)
  - All route files (use helper)
  
- **Dependencies:** All backend tasks

- **Definition of Done:**
  - [ ] Response helper created
  - [ ] All endpoints return consistent format
  - [ ] Success: `{ success: true, data: {...}, meta: {...} }`
  - [ ] Error: `{ success: false, error: { code, message, details } }`
  - [ ] Pagination meta: `{ total, page, limit, totalPages }`
  - [ ] Frontend updated to parse new format

---

#### TASK-API-004: Implement request retry logic
- **ID:** API-004
- **Title:** Add automatic retry for transient failures
- **Layer:** api (frontend)
- **Priority:** P2
- **Estimation:** S (4 hours)
- **Description:**
  - Retry failed requests (500, 502, 503, 504 errors)
  - Use exponential backoff (1s, 2s, 4s)
  - Max 3 retries
  - Don't retry on 4xx errors (client errors)
  
- **Files:**
  - `services/api.ts` (add retry logic)
  
- **Dependencies:** FE-010 (React Query has built-in retry)

- **Definition of Done:**
  - [ ] Retry logic implemented
  - [ ] Retries on 5xx errors
  - [ ] Exponential backoff
  - [ ] Max 3 attempts
  - [ ] User sees loading state during retries
  - [ ] Unit tests

---

#### TASK-API-005: Decouple Telegram collector integration
- **ID:** API-005
- **Title:** Add abstraction layer for Telegram collector
- **Layer:** api
- **Priority:** P2
- **Estimation:** M (2 days)
- **Description:**
  - Create service abstraction for Telegram collector
  - Handle collector unavailability gracefully
  - Add fallback mode (use HTTP API instead of collector)
  
- **Files:**
  - `backend/services/telegramCollectorClient.js` (new)
  - `backend/routes/telegram-collector.js` (refactor to use client)
  
- **Dependencies:** None

- **Definition of Done:**
  - [ ] Client abstraction created
  - [ ] All collector calls go through client
  - [ ] Handles collector downtime (returns cached data or 503)
  - [ ] Fallback to Telegram HTTP API if collector unavailable
  - [ ] Health check endpoint for collector
  - [ ] Unit tests with mocked collector

---

### TESTING LAYER TASKS

#### TASK-TEST-001: Write unit tests for services
- **ID:** TEST-001
- **Title:** Unit test all Data Hub services
- **Layer:** backend (testing)
- **Priority:** P0
- **Estimation:** L (4 days)
- **Description:**
  - Write unit tests for all service layer functions
  - Mock database calls
  - Achieve >80% code coverage
  - Use Jest framework
  
- **Files:**
  - `backend/services/__tests__/dataHub.test.js` (new)
  - `backend/services/__tests__/dataSource.test.js` (new)
  - `backend/services/__tests__/dataPipeline.test.js` (new)
  
- **Dependencies:** BE-007

- **Definition of Done:**
  - [ ] All service functions tested
  - [ ] Database mocked (no real DB calls)
  - [ ] Edge cases covered (null, empty, errors)
  - [ ] >80% code coverage
  - [ ] Tests pass in CI

---

#### TASK-TEST-002: Write integration tests for API endpoints
- **ID:** TEST-002
- **Title:** Integration test all Data Hub REST endpoints
- **Layer:** backend (testing)
- **Priority:** P0
- **Estimation:** L (4 days)
- **Description:**
  - Write integration tests for all endpoints
  - Use test database
  - Test CRUD flows
  - Test error scenarios (404, 403, 400, 500)
  
- **Files:**
  - `backend/routes/__tests__/data-sources.test.js` (new)
  - `backend/routes/__tests__/data-categories.test.js` (new)
  - `backend/routes/__tests__/data-pipeline.test.js` (new)
  - `backend/tests/helpers/testDb.js` (new - test DB setup)
  
- **Dependencies:** All backend tasks

- **Definition of Done:**
  - [ ] All endpoints tested
  - [ ] Test database seeded with fixtures
  - [ ] Success and error paths tested
  - [ ] Authorization tested (user can't modify others' resources)
  - [ ] Tests isolated (clean DB between tests)
  - [ ] Tests pass in CI

---

#### TASK-TEST-003: Write frontend component tests
- **ID:** TEST-003
- **Title:** Unit test React components
- **Layer:** frontend (testing)
- **Priority:** P1
- **Estimation:** L (4 days)
- **Description:**
  - Write tests for all Data Hub components
  - Use React Testing Library
  - Mock API calls
  - Test user interactions (click, type, submit)
  
- **Files:**
  - `components/ai/AIManager/tabs/DataHub/__tests__/SourcesTab.test.tsx` (new)
  - `components/ai/AIManager/tabs/DataHub/__tests__/LogsTab.test.tsx` (new)
  - etc. (one test file per component)
  
- **Dependencies:** FE-003

- **Definition of Done:**
  - [ ] All components tested
  - [ ] API calls mocked (MSW or manual mocks)
  - [ ] User interactions tested
  - [ ] Accessibility assertions (accessible name, role, etc.)
  - [ ] >70% code coverage
  - [ ] Tests pass in CI

---

#### TASK-TEST-004: Write E2E tests for critical flows
- **ID:** TEST-004
- **Title:** End-to-end test Data Hub user journeys
- **Layer:** e2e (testing)
- **Priority:** P1
- **Estimation:** L (3 days)
- **Description:**
  - Write E2E tests using Playwright/Cypress
  - Test critical user flows:
    - Create data source
    - Fetch data from source
    - View pipeline metrics
    - Filter logs
  - Run against staging environment
  
- **Files:**
  - `e2e/data-hub/create-source.spec.ts` (new)
  - `e2e/data-hub/fetch-data.spec.ts` (new)
  - `e2e/data-hub/view-pipeline.spec.ts` (new)
  
- **Dependencies:** All frontend and backend tasks

- **Definition of Done:**
  - [ ] Critical flows tested end-to-end
  - [ ] Tests run against staging environment
  - [ ] Visual regression testing (screenshots)
  - [ ] Tests pass in CI (on PR and before deploy)

---

#### TASK-TEST-005: Implement contract testing
- **ID:** TEST-005
- **Title:** Validate frontend-backend contract
- **Layer:** testing
- **Priority:** P0
- **Estimation:** M (2 days)
- **Description:**
  - Use Pact or similar for contract testing
  - Define API contract (request/response schemas)
  - Generate tests from OpenAPI spec
  - Ensure frontend and backend are in sync
  
- **Files:**
  - `tests/contract/data-hub.pact.test.js` (new)
  
- **Dependencies:** API-001

- **Definition of Done:**
  - [ ] Contract tests written
  - [ ] Based on OpenAPI spec
  - [ ] Frontend consumer tests pass
  - [ ] Backend provider tests pass
  - [ ] Contract violations caught in CI

---

#### TASK-TEST-006: Implement load testing
- **ID:** TEST-006
- **Title:** Load test Data Hub API endpoints
- **Layer:** testing
- **Priority:** P1
- **Estimation:** M (2 days)
- **Description:**
  - Use k6 or Artillery for load testing
  - Test with 100, 500, 1000 concurrent users
  - Measure response times, error rates
  - Identify bottlenecks
  
- **Files:**
  - `tests/load/data-hub.k6.js` (new)
  
- **Dependencies:** All backend tasks

- **Definition of Done:**
  - [ ] Load test scripts written
  - [ ] Tested at 100, 500, 1000 RPS
  - [ ] Response times <500ms at p95 (under 500 RPS)
  - [ ] Error rate <1%
  - [ ] Bottlenecks identified and documented
  - [ ] Results in performance baseline doc

---

#### TASK-TEST-007: Implement security testing
- **ID:** TEST-007
- **Title:** Security scan for common vulnerabilities
- **Layer:** testing
- **Priority:** P1
- **Estimation:** M (1 day)
- **Description:**
  - Use OWASP ZAP or Burp Suite for security scanning
  - Test for:
    - SQL injection
    - XSS
    - CSRF
    - Auth bypass
    - Sensitive data exposure
  
- **Files:**
  - `tests/security/data-hub-scan.sh` (new - automation script)
  
- **Dependencies:** All backend tasks

- **Definition of Done:**
  - [ ] Security scan performed
  - [ ] No critical vulnerabilities found
  - [ ] SQL injection tests pass (parameterized queries work)
  - [ ] XSS tests pass (input sanitized)
  - [ ] Auth bypass tests fail (protected endpoints require auth)
  - [ ] Report generated with findings

---

### DOCUMENTATION TASKS

#### TASK-DOC-001: Write API documentation
- **ID:** DOC-001
- **Title:** Comprehensive API reference docs
- **Layer:** documentation
- **Priority:** P1
- **Estimation:** M (2 days)
- **Description:**
  - Write Markdown docs for all Data Hub endpoints
  - Include authentication, request/response examples
  - Document error codes
  - Publish on GitHub Pages or Docusaurus
  
- **Files:**
  - `docs/api/data-hub.md` (new)
  - `docs/api/authentication.md` (enhance)
  
- **Dependencies:** API-001

- **Definition of Done:**
  - [ ] All endpoints documented
  - [ ] Examples for each endpoint (curl, JavaScript)
  - [ ] Error codes explained
  - [ ] Authentication flow documented
  - [ ] Published on docs site
  - [ ] Linked from main README

---

#### TASK-DOC-002: Write architecture documentation
- **ID:** DOC-002
- **Title:** Document Data Hub architecture and design
- **Layer:** documentation
- **Priority:** P1
- **Estimation:** M (2 days)
- **Description:**
  - Create architecture diagrams (data flow, component diagram)
  - Document design decisions (why not X, why Y)
  - Explain data pipeline flow
  - Document integration points (Telegram, AI agents)
  
- **Files:**
  - `docs/architecture/data-hub.md` (new)
  - `docs/architecture/diagrams/` (Mermaid diagrams)
  
- **Dependencies:** All architecture tasks complete

- **Definition of Done:**
  - [ ] Architecture document written
  - [ ] Data flow diagram included
  - [ ] Component diagram included
  - [ ] Design decisions explained
  - [ ] Integration points documented
  - [ ] Reviewed by team

---

#### TASK-DOC-003: Write deployment guide
- **ID:** DOC-003
- **Title:** Comprehensive deployment and setup guide
- **Layer:** documentation
- **Priority:** P1
- **Estimation:** M (1 day)
- **Description:**
  - Document deployment steps
  - Environment variables
  - Database setup
  - Worker configuration (PM2)
  - Health checks and monitoring
  
- **Files:**
  - `docs/deployment/data-hub.md` (new)
  
- **Dependencies:** All infra tasks

- **Definition of Done:**
  - [ ] Deployment steps documented
  - [ ] Environment variables listed and explained
  - [ ] Database migration steps
  - [ ] Worker setup (PM2 config)
  - [ ] Monitoring setup (Grafana, Sentry)
  - [ ] Troubleshooting section
  - [ ] Tested by following guide from scratch

---

#### TASK-DOC-004: Write developer onboarding guide
- **ID:** DOC-004
- **Title:** Onboarding guide for new developers
- **Layer:** documentation
- **Priority:** P2
- **Estimation:** M (1 day)
- **Description:**
  - Write getting started guide
  - How to run locally
  - How to run tests
  - Code structure explanation
  - Common tasks (add new endpoint, add new worker, etc.)
  
- **Files:**
  - `docs/developers/data-hub-getting-started.md` (new)
  
- **Dependencies:** None

- **Definition of Done:**
  - [ ] Getting started guide written
  - [ ] Local setup steps (prerequisites, install, run)
  - [ ] Code structure explained
  - [ ] Common tasks documented
  - [ ] Tips and best practices
  - [ ] Tested by new team member

---

#### TASK-DOC-005: Write user guide
- **ID:** DOC-005
- **Title:** End-user documentation for Data Hub features
- **Layer:** documentation
- **Priority:** P2
- **Estimation:** M (2 days)
- **Description:**
  - Write user guide for each Data Hub feature
  - Include screenshots and video demos
  - Explain use cases
  - Troubleshooting for common issues
  
- **Files:**
  - `docs/user-guide/data-hub.md` (new)
  
- **Dependencies:** All frontend tasks

- **Definition of Done:**
  - [ ] User guide written
  - [ ] Covers all Data Hub tabs
  - [ ] Screenshots included
  - [ ] Video demos recorded (optional)
  - [ ] Use cases explained
  - [ ] Troubleshooting section
  - [ ] Reviewed by non-technical user

---

### INFRASTRUCTURE TASKS

#### TASK-INFRA-001: Set up worker process management
- **ID:** INFRA-001
- **Title:** Configure PM2 for background workers
- **Layer:** infra
- **Priority:** P0
- **Estimation:** M (1 day)
- **Description:**
  - Create PM2 ecosystem file for workers
  - Configure auto-restart, logging, monitoring
  - Set up worker logs rotation
  - Document worker management
  
- **Files:**
  - `ecosystem.config.js` (enhance - add workers)
  - `docs/deployment/workers.md` (new)
  
- **Dependencies:** BE-012, BE-013, BE-014

- **Definition of Done:**
  - [ ] PM2 ecosystem config updated
  - [ ] Workers start on server boot
  - [ ] Auto-restart on crash
  - [ ] Logs rotated daily
  - [ ] PM2 monitoring enabled
  - [ ] Worker management documented

---

#### TASK-INFRA-002: Set up monitoring and alerting
- **ID:** INFRA-002
- **Title:** Configure Grafana dashboards and alerts
- **Layer:** infra
- **Priority:** P1
- **Estimation:** M (2 days)
- **Description:**
  - Create Grafana dashboard for Data Hub metrics
  - Alert on critical source failures
  - Alert on worker crashes
  - Alert on high error rates
  
- **Files:**
  - `monitoring/grafana/data-hub-dashboard.json` (new)
  - `monitoring/alerts/data-hub.yaml` (new)
  
- **Dependencies:** All backend tasks

- **Definition of Done:**
  - [ ] Grafana dashboard created
  - [ ] Metrics: source health, fetch success rate, response times, cache hit rate
  - [ ] Alerts configured (PagerDuty/Slack)
  - [ ] Alert on: critical source down >1 hour, worker crash, error rate >10%
  - [ ] Runbook for each alert
  - [ ] Tested with simulated failures

---

#### TASK-INFRA-003: Set up database backup automation
- **ID:** INFRA-003
- **Title:** Automate database backups for Data Hub tables
- **Layer:** infra
- **Priority:** P1
- **Estimation:** M (1 day)
- **Description:**
  - Configure daily database backups
  - Include Data Hub tables in backup
  - Store backups in S3/Cloud Storage
  - Test restore procedure
  
- **Files:**
  - `scripts/backup-data-hub.sh` (new)
  - `docs/deployment/backup-restore.md` (new)
  
- **Dependencies:** All database tasks

- **Definition of Done:**
  - [ ] Backup script created
  - [ ] Scheduled via cron (daily at 2 AM)
  - [ ] Backups uploaded to S3
  - [ ] Retention: keep 30 daily, 12 monthly
  - [ ] Restore tested successfully
  - [ ] Documented

---

#### TASK-INFRA-004: Set up log aggregation
- **ID:** INFRA-004
- **Title:** Aggregate logs from workers and API
- **Layer:** infra
- **Priority:** P2
- **Estimation:** M (1 day)
- **Description:**
  - Configure log shipping to Datadog/ELK
  - Enable log search and filtering
  - Set up log-based alerts
  
- **Files:**
  - `backend/services/logger.js` (configure shipping)
  
- **Dependencies:** None

- **Definition of Done:**
  - [ ] Logs shipped to aggregation service
  - [ ] Logs searchable by worker, endpoint, user, error
  - [ ] Retention: 30 days
  - [ ] Alerts on critical errors
  - [ ] Documented

---

#### TASK-INFRA-005: Set up CI/CD pipeline
- **ID:** INFRA-005
- **Title:** Automate testing and deployment for Data Hub
- **Layer:** infra
- **Priority:** P1
- **Estimation:** M (2 days)
- **Description:**
  - Add Data Hub tests to CI pipeline
  - Run linting, unit, integration, E2E tests
  - Deploy to staging on PR merge
  - Deploy to production on release tag
  
- **Files:**
  - `.github/workflows/data-hub-ci.yml` (new)
  
- **Dependencies:** All testing tasks

- **Definition of Done:**
  - [ ] CI pipeline configured
  - [ ] Runs on every PR
  - [ ] Linting, unit, integration, E2E tests pass
  - [ ] Auto-deploy to staging on merge to `main`
  - [ ] Manual approval for production deploy
  - [ ] Rollback capability
  - [ ] Documented

---

### SUMMARY STATISTICS

| Layer | Total Tasks | P0 (Critical) | P1 (High) | P2 (Medium) | P3 (Low) |
|-------|-------------|---------------|-----------|-------------|----------|
| **Database** | 10 | 4 | 4 | 2 | 0 |
| **Backend** | 18 | 6 | 8 | 4 | 0 |
| **Frontend** | 13 | 4 | 5 | 4 | 0 |
| **API** | 5 | 1 | 3 | 1 | 0 |
| **Testing** | 7 | 3 | 3 | 1 | 0 |
| **Documentation** | 5 | 0 | 3 | 2 | 0 |
| **Infrastructure** | 5 | 1 | 3 | 1 | 0 |
| **TOTAL** | **63** | **19** | **29** | **15** | **0** |

### ESTIMATED TIMELINE

**Assumptions:**
- 1 full-time developer
- 8-hour workdays
- No major blockers

**By Priority:**
- **P0 Tasks (Critical):** 19 tasks ≈ 40 days (~8 weeks)
- **P1 Tasks (High):** 29 tasks ≈ 55 days (~11 weeks)
- **P2 Tasks (Medium):** 15 tasks ≈ 25 days (~5 weeks)

**Total:** ~120 days (~24 weeks / ~6 months) for 1 developer

**With 2 developers:** ~12-14 weeks (~3-3.5 months)
**With 3 developers:** ~8-10 weeks (~2-2.5 months)

---

## 🎯 RECOMMENDED EXECUTION PHASES

### Phase 1: Foundation (Weeks 1-4)
**Goal:** Fix critical backend issues, establish data integrity

**Tasks:**
- DB-001, DB-002, DB-003, DB-004 (database tables)
- BE-001, BE-002, BE-003, BE-004, BE-005, BE-006 (CRUD endpoints)
- BE-007 (service layer)
- FE-001 (remove mock data)
- TEST-005 (contract testing)

**Outcome:** Data Hub functional with real data, no more mocks

---

### Phase 2: Stability & Quality (Weeks 5-8)
**Goal:** Add testing, improve reliability

**Tasks:**
- BE-008, BE-009, BE-010, BE-011 (validation, auth, rate limiting, logging)
- FE-002, FE-003, FE-004, FE-005 (error boundaries, refactor, pagination)
- TEST-001, TEST-002, TEST-003 (unit & integration tests)
- DOC-001, DOC-002, DOC-003 (API & architecture docs)
- INFRA-001 (PM2 workers)

**Outcome:** Robust, tested, documented system

---

### Phase 3: Automation (Weeks 9-12)
**Goal:** Enable background processing, advanced features

**Tasks:**
- BE-012, BE-013, BE-014 (background workers)
- DB-005, DB-006 (advanced features tables)
- BE-015, BE-016, BE-017, BE-018 (web crawler, Telegram publisher, automation, access control)
- FE-006, FE-007, FE-008, FE-009 (forms, state mgmt, loading, a11y)
- INFRA-002, INFRA-003 (monitoring, backups)

**Outcome:** Fully automated data collection and routing

---

### Phase 4: Polish & Optimization (Weeks 13-16)
**Goal:** Improve UX, performance, complete remaining features

**Tasks:**
- FE-010, FE-011, FE-012, FE-013 (caching, cancellation, empty states, filters)
- DB-007, DB-008, DB-009, DB-010 (indexes, partitioning, foreign keys)
- API-001, API-002, API-003, API-004, API-005 (API docs, versioning, standardization, retry, decoupling)
- TEST-004, TEST-006, TEST-007 (E2E, load, security testing)
- DOC-004, DOC-005 (developer onboarding, user guide)
- INFRA-004, INFRA-005 (log aggregation, CI/CD)

**Outcome:** Production-ready, optimized, well-documented system

---

## 📌 CRITICAL PATH

These tasks **MUST** be completed in order (dependencies):

1. **DB-001** (categories table) → **BE-004** (categories API) → **FE-001** (remove mocks)
2. **DB-002** (cache table) → **BE-003** (fetch data) → **BE-012** (data collector worker)
3. **DB-003** (pipeline snapshots) → **BE-005** (pipeline API) → **BE-013** (pipeline refresh worker)
4. **DB-004** (access logs) → **BE-006** (logs API) → **FE-004** (pagination)
5. **BE-007** (service layer) → **TEST-001** (unit tests) → **CI/CD**

**Blocking Issues:**
- Frontend cannot work without real backend endpoints (FE-001 blocked by BE-001 to BE-006)
- Workers cannot run without service layer (BE-012, BE-013, BE-014 blocked by BE-007)
- Testing cannot proceed without stable APIs (TEST tasks blocked by BE tasks)

---

## 🚨 HIGHEST PRIORITY (START HERE)

**Week 1 Sprint:**
1. **DB-001** - Create data_categories table (1 day)
2. **DB-002** - Create data_cache table (1 day)
3. **BE-001** - Implement CRUD endpoints for sources (1 day)
4. **BE-004** - Implement CRUD endpoints for categories (1 day)
5. **FE-001** - Remove mock data, connect to real backend (1 day)

**Outcome after Week 1:** Users see real data, can create/edit sources and categories

---

**This concludes the Architecture & Planning Analysis for the Data Hub feature.**

**Next Steps:**
1. Review and approve this backlog
2. Prioritize tasks based on business needs
3. Assign tasks to developers
4. Begin Phase 1 execution
5. Track progress and adjust plan as needed

**Questions or clarifications needed before starting implementation?**
