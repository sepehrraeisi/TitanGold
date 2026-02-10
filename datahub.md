📊 ARCHITECTURE & PLANNING ANALYSIS: Data Hub Feature
🎯 Executive Summary
Feature: Data Hub Tab (AI Manager → Data Hub)
Purpose: Centralized data collection, aggregation, and distribution layer for AI Agents
Current Status: ⚠️ Partially Implemented - Core infrastructure exists but has significant gaps

📐 STEP 1: ARCHITECTURE MAPPING
🗺️ High-Level Architecture Overview
┌─────────────────────────────────────────────────────────────┐
│                     DATA HUB ARCHITECTURE                    │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │  Frontend UI │───▶│ REST API     │───▶│  Database    │  │
│  │  Components  │◀───│ (Backend)    │◀───│  (Postgres)  │  │
│  └──────────────┘    └──────────────┘    └──────────────┘  │
│         │                    │                    │          │
│         │                    ▼                    │          │
│         │            ┌──────────────┐             │          │
│         └───────────▶│  Data Sources│◀────────────┘          │
│                      │  - Telegram   │                       │
│                      │  - RSS        │                       │
│                      │  - API        │                       │
│                      │  - Webhook    │                       │
│                      │  - Web Crawler│                       │
│                      └──────────────┘                        │
│                             │                                │
│                             ▼                                │
│                      ┌──────────────┐                        │
│                      │ Data Pipeline│                        │
│                      │ & Processing │                        │
│                      └──────────────┘                        │
│                             │                                │
│                             ▼                                │
│                      ┌──────────────┐                        │
│                      │  AI Agents   │                        │
│                      │  (15 agents) │                        │
│                      └──────────────┘                        │
└─────────────────────────────────────────────────────────────┘
📂 LAYER 1: FRONTEND COMPONENTS
File: components/ai/AIManager/tabs/DataHubTab.tsx (1050+ lines)
Purpose: Main orchestration component for Data Hub UI
What it does:

Displays overview stats (total sources, active sources, data points, health status)
Manages 7 different views/panels:
Data Sources panel
Categories panel
Health monitoring panel
Access Logs panel
Data Pipeline panel
Advanced Features panel
Telegram Collector panel
Handles modal workflows (create source, create category, view data)
Orchestrates Telegram collector login flow
Dependencies:

Frontend: types.ts, api.ts, child modals/components
Backend: /api/data-sources/* endpoints (GET /, POST /, GET /state, GET /health, GET /stats)
State: Local React state (no global state management)
Issues:

⚠️ No error boundaries - crashes propagate up
⚠️ No loading skeletons - poor UX during data fetch
⚠️ Direct API calls - no caching, no optimistic updates
⚠️ Massive component (1050+ lines) - should be split into sub-components
⚠️ No pagination - will break with 100+ sources
⚠️ No real-time updates - requires manual refresh
File: components/ai/AIManager/tabs/DataHub/modals/CreateSourceModal.tsx
Purpose: Modal for creating new data sources
What it does:

Form for adding new data sources (name, type, URL, category, credentials)
Supports 5 source types: telegram, rss, api, webhook, web_crawler
Client-side validation
Dependencies:

Frontend: types.ts, api.ts
Backend: POST /api/data-sources/
Issues:

⚠️ No credential encryption on frontend (sensitive data in plain text)
⚠️ No validation for URL format (can submit invalid URLs)
⚠️ No duplicate detection (can create duplicate sources)
⚠️ No test connection feature before saving
File: components/ai/AIManager/tabs/DataHub/modals/CreateCategoryModal.tsx
Purpose: Modal for creating data categories
What it does:

Simple form for category name + description
Dependencies:

Frontend: types.ts, api.ts
Backend: No specific endpoint found ⚠️
Issues:

🚨 No backend endpoint - categories appear to be stored only in frontend state
🚨 No persistence - categories lost on page refresh
File: components/ai/AIManager/tabs/DataHub/modals/ViewSourceDataModal.tsx
Purpose: Modal for viewing collected data from a source
What it does:

Displays data collected from a specific source
Shows metadata (timestamps, status, etc.)
Dependencies:

Frontend: types.ts, api.ts
Backend: Endpoint not clearly defined ⚠️
Issues:

⚠️ No pagination - will crash with large datasets
⚠️ No data export functionality
⚠️ No filtering/searching within data
File: components/ai/AIManager/tabs/DataHub/modals/WebCrawlerModal.tsx
Purpose: Configure web crawler settings
What it does:

Settings for web crawling (URL patterns, depth, frequency, selectors)
Dependencies:

Frontend: types.ts, api.ts
Backend: No crawler implementation found ⚠️
Issues:

🚨 No backend crawler - feature appears to be UI-only stub
🚨 No crawler service in backend
File: components/ai/AIManager/tabs/DataHub/modals/QueuePreviewModal.tsx
Purpose: Preview data pipeline queue
What it does:

Shows pending/processing data in pipeline queue
Dependencies:

Frontend: types.ts, api.ts
Backend: No queue endpoint found ⚠️
Issues:

🚨 No backend queue system visible in codebase
⚠️ No real-time updates - queue state can be stale
File: components/ai/AIManager/tabs/DataHub/modals/TelegramPublisherModal.tsx
Purpose: Configure Telegram publishing
What it does:

Settings for publishing data to Telegram channels
Dependencies:

Frontend: types.ts, api.ts
Backend: POST /api/data-sources/publish-telegram
Issues:

⚠️ No publish history - can't track what was published
⚠️ No scheduling - immediate publish only
⚠️ No templates - manual message composition each time
File: components/ai/AIManager/tabs/DataHub/modals/AutomationTopicModal.tsx
Purpose: Configure topic-based automation routing
What it does:

Maps topics to AI agents for automated processing
Dependencies:

Frontend: types.ts, api.ts
Backend: No automation endpoint found ⚠️
Issues:

🚨 No automation engine in backend
🚨 No topic routing implementation
File: components/ai/AIManager/tabs/DataHub/modals/AccessControlModal.tsx
Purpose: Manage access control for data sources
What it does:

Configure which users/agents can access which data sources
Dependencies:

Frontend: types.ts, api.ts
Backend: No ACL endpoint found ⚠️
Issues:

🚨 No access control enforcement in backend
🚨 No RBAC system visible
File: components/ai/AIManager/tabs/DataHub/AdvancedFeatures.tsx (800+ lines)
Purpose: Advanced Data Hub features (web crawler, auto-discovery, smart prioritization, etc.)
What it does:

Web crawler config
Auto-discovery settings
Smart prioritization
Access control UI
Blacklist/Whitelist management
Telegram publisher UI
Automation topic routing UI
Dependencies:

Frontend: types.ts, api.ts, DataHubState, AIAgent[]
Backend: Multiple endpoints (most missing ⚠️)
Issues:

⚠️ 800+ lines - should be split into smaller components
🚨 Most features are UI-only - no backend implementation
⚠️ No validation on many inputs
📂 LAYER 2: BACKEND SERVICES
File: backend/routes/data-sources.js (200+ lines)
Purpose: REST API for Data Hub
Endpoints:

POST /api/data-sources/publish-telegram - Publish to Telegram
GET /api/data-sources/ - List all data sources
POST /api/data-sources/ - Create new data source
GET /api/data-sources/state - Get aggregated Data Hub state
GET /api/data-sources/health - Health check
GET /api/data-sources/stats - Get statistics
Dependencies:

Database: data_sources, data_hub_logs tables
Services: telegramService (for publishing)
Middleware: Authentication (requireAuth)
Issues:

⚠️ No rate limiting on create/publish endpoints
⚠️ No input validation (can insert invalid data)
⚠️ No pagination on GET / endpoint
🚨 No UPDATE or DELETE endpoints (can't modify/delete sources)
⚠️ No error handling for Telegram API failures
⚠️ No logging for audit trail
🚨 No data fetching logic (how does data get collected from sources?)
File: backend/services/telegramService.js (assumed, not fully visible)
Purpose: Handle Telegram integration
What it does:

Send messages to Telegram channels
Handle Telegram bot authentication
Dependencies:

External: Telegram Bot API
Database: Store bot credentials
Issues:

⚠️ No retry logic for failed sends
⚠️ No queue system for batching messages
⚠️ Credentials storage security unclear
File: backend/services/api.ts (Frontend API client)
Purpose: Frontend service layer for API calls
Functions:

fetchDataHubState() - Fetch Data Hub state
persistDataHubState() - Save Data Hub state
updateDataHubSource() - Update a data source
checkDataHubHealth() - Check health
Many others...
Dependencies:

Backend: REST API endpoints
Frontend: React components
Issues:

⚠️ No caching - every call hits backend
⚠️ No request deduplication - parallel calls duplicate requests
⚠️ No optimistic updates - UI waits for backend
⚠️ Error handling is minimal - just throws errors up
File: backend/services/scheduler.js (assumed from routes/scheduler.js reference)
Purpose: Schedule data collection tasks
What it does: (assumed)

Periodic data fetching from sources
Job scheduling
Dependencies: (assumed)

Database: Job queue tables
Cron: Scheduling library
Issues:

🚨 Not confirmed to exist or work with Data Hub
🚨 No visible integration with data_sources table
📂 LAYER 3: DATABASE SCHEMA
Table: data_sources
CopyCREATE TABLE data_sources (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  type VARCHAR(100) NOT NULL, -- 'api', 'webhook', 'rss', 'telegram', 'web_crawler'
  url TEXT,
  category VARCHAR(100),
  priority INTEGER DEFAULT 5,
  status VARCHAR(50) DEFAULT 'active', -- 'active', 'inactive', 'error'
  health_status VARCHAR(50) DEFAULT 'healthy',
  last_fetch_at TIMESTAMP WITH TIME ZONE,
  fetch_count INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  config JSONB DEFAULT '{}'::jsonb,
  credentials JSONB DEFAULT '{}'::jsonb,
  is_enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);
Indexes:

idx_data_sources_type on type
idx_data_sources_status on status
Issues:

⚠️ No encryption on credentials (stored as plain JSONB)
⚠️ No foreign key to users (who owns this source?)
⚠️ No unique constraint on name+type (allows duplicates)
⚠️ No index on is_enabled (used in queries)
⚠️ No audit columns (who created/modified this?)
Table: data_hub_logs
CopyCREATE TABLE data_hub_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_id UUID REFERENCES data_sources(id) ON DELETE CASCADE,
  action VARCHAR(100) NOT NULL, -- 'fetch', 'publish', 'error', etc.
  status VARCHAR(50) NOT NULL, -- 'success', 'failure', 'pending'
  message TEXT,
  data_size INTEGER,
  execution_time_ms INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);
Indexes:

idx_data_hub_logs_source_id on source_id
idx_data_hub_logs_created_at on created_at DESC
Issues:

⚠️ No retention policy (logs grow forever)
⚠️ No partitioning (will slow down over time)
⚠️ No index on action (used in queries)
⚠️ No index on status (used in queries)
Trigger: update_data_sources_updated_at
CopyCREATE TRIGGER update_data_sources_updated_at
BEFORE UPDATE ON data_sources
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
Purpose: Auto-update updated_at timestamp
Issues: None (this is good)

Missing Tables:
🚨 No data_categories table - categories not persisted
🚨 No data_queue table - no queue system visible
🚨 No data_pipeline_config table - pipeline config not persisted
🚨 No data_access_control table - ACL not implemented
🚨 No collected_data table - where is actual collected data stored?
📂 LAYER 4: API INTEGRATION
REST API Endpoints (from backend/routes/data-sources.js):
Method	Endpoint	Purpose	Status
GET	/api/data-sources/	List sources	✅ Works
POST	/api/data-sources/	Create source	✅ Works
GET	/api/data-sources/state	Get state	✅ Works
GET	/api/data-sources/health	Health check	✅ Works
GET	/api/data-sources/stats	Get stats	✅ Works
POST	/api/data-sources/publish-telegram	Publish to Telegram	✅ Works
PUT	/api/data-sources/:id	Update source	🚨 Missing
DELETE	/api/data-sources/:id	Delete source	🚨 Missing
GET	/api/data-sources/:id/data	Get collected data	🚨 Missing
POST	/api/data-sources/:id/test	Test connection	🚨 Missing
GET	/api/data-categories/	List categories	🚨 Missing
POST	/api/data-categories/	Create category	🚨 Missing
GET	/api/data-pipeline/queue	Get queue	🚨 Missing
POST	/api/data-pipeline/process	Trigger processing	🚨 Missing
Issues:

🚨 50% of needed endpoints are missing
⚠️ No versioning (e.g., /api/v1/data-sources)
⚠️ No OpenAPI/Swagger docs
⚠️ No rate limiting
⚠️ No request validation middleware
🚨 STEP 2: ISSUES & RISKS BY LAYER
🖼️ FRONTEND ISSUES
ID	Issue	Impact	Severity
FE-001	DataHubTab.tsx is 1050+ lines (monolithic component)	Maintainability, testability	⚠️ Medium
FE-002	No error boundaries	App crashes propagate to user	🔴 High
FE-003	No loading skeletons/states	Poor UX, perceived slowness	⚠️ Medium
FE-004	No pagination on lists	UI breaks with 100+ sources	🔴 High
FE-005	No real-time updates	Data staleness, manual refresh needed	⚠️ Medium
FE-006	Direct API calls (no caching)	Excessive network traffic, slow UI	⚠️ Medium
FE-007	No optimistic updates	UI feels sluggish	🟡 Low
FE-008	Credentials shown in plain text	Security risk	🔴 High
FE-009	No input validation (URLs, etc.)	Invalid data submitted	⚠️ Medium
FE-010	No duplicate detection	Users can create duplicate sources	🟡 Low
FE-011	No test connection feature	Users submit bad sources	⚠️ Medium
FE-012	Categories not persisted	Lost on refresh	🔴 High
FE-013	AdvancedFeatures.tsx is 800+ lines	Maintainability	⚠️ Medium
FE-014	Most advanced features are UI-only stubs	Misleading users	🔴 High
⚙️ BACKEND ISSUES
ID	Issue	Impact	Severity
BE-001	No UPDATE or DELETE endpoints for sources	Can't modify/delete sources	🔴 High
BE-002	No input validation on POST /data-sources	Can insert invalid/malicious data	🔴 High
BE-003	No rate limiting	API abuse, DoS risk	🔴 High
BE-004	No pagination on GET /data-sources	Performance degrades with scale	🔴 High
BE-005	No audit logging	Can't track who did what	⚠️ Medium
BE-006	No error handling for Telegram API	Silent failures	⚠️ Medium
BE-007	No data collection implementation	Data sources are defined but not fetched	🔴 CRITICAL
BE-008	No retry logic for failed fetches	Data gaps	⚠️ Medium
BE-009	No queue system for data processing	Can't scale	🔴 High
BE-010	No scheduler for periodic fetching	Data not updated	🔴 CRITICAL
BE-011	No web crawler implementation	Feature advertised but missing	🔴 High
BE-012	No automation/topic routing	Feature advertised but missing	🔴 High
BE-013	No access control enforcement	Security risk	🔴 High
BE-014	No API versioning	Breaking changes will break clients	⚠️ Medium
BE-015	No OpenAPI/Swagger docs	Hard to integrate	🟡 Low
🗄️ DATABASE ISSUES
ID	Issue	Impact	Severity
DB-001	Credentials stored as plain JSONB	Security risk, compliance issue	🔴 CRITICAL
DB-002	No foreign key to users on data_sources	Can't track ownership	⚠️ Medium
DB-003	No unique constraint on name+type	Duplicate sources allowed	⚠️ Medium
DB-004	No index on is_enabled	Slow queries	🟡 Low
DB-005	No audit columns (created_by, updated_by)	Can't track changes	⚠️ Medium
DB-006	No retention policy on data_hub_logs	Logs grow forever	⚠️ Medium
DB-007	No partitioning on data_hub_logs	Performance degrades over time	⚠️ Medium
DB-008	No index on action, status in logs	Slow queries	🟡 Low
DB-009	No data_categories table	Categories lost on refresh	🔴 High
DB-010	No collected_data table	Where is collected data stored?	🔴 CRITICAL
DB-011	No data_queue table	No queue for processing	🔴 High
DB-012	No data_access_control table	ACL not enforced	🔴 High
🔌 API / INTEGRATION ISSUES
ID	Issue	Impact	Severity
API-001	50% of endpoints missing	Features don't work	🔴 CRITICAL
API-002	No versioning (e.g., /api/v1/)	Breaking changes risk	⚠️ Medium
API-003	No rate limiting	API abuse risk	🔴 High
API-004	No request validation middleware	Invalid data accepted	🔴 High
API-005	No response schema validation	Inconsistent responses	⚠️ Medium
API-006	No caching headers	Excessive traffic	🟡 Low
API-007	No CORS config review	Potential security issue	⚠️ Medium
API-008	No OpenAPI/Swagger docs	Hard to integrate	🟡 Low
📋 STEP 3: TASK BACKLOG
🏗️ Architecture & Foundation Tasks
TASK-DF-001: Create collected_data table
Layer: database
Priority: P0 (Critical)
Description: Create a new table collected_data to store actual data collected from sources
Files:
backend/database/migrations/012_create_collected_data.sql
Schema:
CopyCREATE TABLE collected_data (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_id UUID NOT NULL REFERENCES data_sources(id) ON DELETE CASCADE,
  raw_data JSONB NOT NULL,
  normalized_data JSONB,
  collected_at TIMESTAMP WITH TIME ZONE NOT NULL,
  processed_at TIMESTAMP WITH TIME ZONE,
  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'processed', 'error'
  error_message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX idx_collected_data_source_id ON collected_data(source_id);
CREATE INDEX idx_collected_data_status ON collected_data(status);
CREATE INDEX idx_collected_data_collected_at ON collected_data(collected_at DESC);
Dependencies: None
Definition of Done:
Migration file created and tested
Table exists in database
Indexes created
Can insert/query sample data
TASK-DF-002: Create data_categories table
Layer: database
Priority: P0 (Critical)
Description: Create table to persist data categories (currently only in frontend state)
Files:
backend/database/migrations/013_create_data_categories.sql
Schema:
CopyCREATE TABLE data_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  color VARCHAR(50),
  icon VARCHAR(100),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX idx_data_categories_name ON data_categories(name);
Dependencies: None
Definition of Done:
Migration created
Table exists
Unique constraint on name works
Can insert/query categories
TASK-DF-003: Create data_queue table
Layer: database
Priority: P0 (Critical)
Description: Create queue table for data processing pipeline
Files:
backend/database/migrations/014_create_data_queue.sql
Schema:
CopyCREATE TABLE data_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_id UUID NOT NULL REFERENCES data_sources(id) ON DELETE CASCADE,
  data_id UUID NOT NULL REFERENCES collected_data(id) ON DELETE CASCADE,
  priority INTEGER DEFAULT 5,
  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  scheduled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX idx_data_queue_status ON data_queue(status);
CREATE INDEX idx_data_queue_scheduled_at ON data_queue(scheduled_at);
CREATE INDEX idx_data_queue_source_id ON data_queue(source_id);
Dependencies: TASK-DF-001
Definition of Done:
Migration created
Table exists
Foreign keys work
Indexes created
TASK-DF-004: Add audit columns to data_sources
Layer: database
Priority: P1 (High)
Description: Add created_by, updated_by columns to track ownership
Files:
backend/database/migrations/015_add_audit_to_data_sources.sql
SQL:
CopyALTER TABLE data_sources
ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL,
ADD COLUMN updated_by UUID REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX idx_data_sources_created_by ON data_sources(created_by);
Dependencies: None
Definition of Done:
Migration applied
Columns exist
Foreign keys work
Index created
TASK-DF-005: Encrypt credentials in data_sources
Layer: database + backend
Priority: P0 (Critical - Security)
Description: Encrypt credentials column using AES-256 or similar
Files:
backend/utils/encryption.js (new)
backend/routes/data-sources.js (update)
backend/database/migrations/016_encrypt_credentials.sql
Dependencies: None
Definition of Done:
Encryption utility created
Existing credentials migrated to encrypted format
Create/update routes encrypt credentials
Read routes decrypt credentials
No plain-text credentials in database
TASK-DF-006: Add unique constraint to data_sources
Layer: database
Priority: P2 (Medium)
Description: Add unique constraint on (name, type) to prevent duplicates
Files:
backend/database/migrations/017_add_unique_constraint_data_sources.sql
SQL:
CopyCREATE UNIQUE INDEX idx_data_sources_name_type ON data_sources(name, type) WHERE is_enabled = TRUE;
Dependencies: None
Definition of Done:
Constraint added
Duplicate insert fails with clear error
Update route handles constraint violation gracefully
TASK-DF-007: Add retention policy to data_hub_logs
Layer: database + backend
Priority: P2 (Medium)
Description: Implement 90-day retention for logs (archive old logs)
Files:
backend/jobs/cleanup-old-logs.js (new)
backend/database/migrations/018_add_log_partitioning.sql (optional)
Dependencies: None
Definition of Done:
Cleanup job created
Job runs daily via cron
Logs older than 90 days are archived or deleted
Job logs execution in data_hub_logs
🔧 Backend Core Tasks
TASK-BE-001: Implement data fetcher service
Layer: backend
Priority: P0 (Critical)
Description: Create service to fetch data from sources (RSS, API, Telegram, Webhook)
Files:
backend/services/dataFetcher.js (new)
backend/services/fetchers/rssFetcher.js (new)
backend/services/fetchers/apiFetcher.js (new)
backend/services/fetchers/telegramFetcher.js (new)
backend/services/fetchers/webhookFetcher.js (new)
Dependencies: TASK-DF-001
Definition of Done:
Service can fetch from RSS feeds
Service can fetch from REST APIs
Service can fetch from Telegram
Service can receive webhook data
Fetched data is stored in collected_data table
Errors are logged in data_hub_logs
TASK-BE-002: Implement scheduler for data fetching
Layer: backend
Priority: P0 (Critical)
Description: Create cron-based scheduler to fetch data from sources periodically
Files:
backend/jobs/dataFetchScheduler.js (new)
backend/services/scheduler.js (update)
Dependencies: TASK-BE-001, TASK-DF-001
Definition of Done:
Scheduler runs every N minutes (configurable)
Fetches from all enabled sources
Respects source priority
Updates last_fetch_at, fetch_count
Logs errors
TASK-BE-003: Implement data processing pipeline
Layer: backend
Priority: P0 (Critical)
Description: Create pipeline to normalize, validate, and route collected data to AI agents
Files:
backend/services/dataPipeline.js (new)
backend/services/normalizers/dataNormalizer.js (new)
backend/services/validators/dataValidator.js (new)
backend/services/routers/dataRouter.js (new)
Dependencies: TASK-BE-001, TASK-DF-001, TASK-DF-003
Definition of Done:
Pipeline can normalize raw_data to standard format
Pipeline validates data against schema
Pipeline routes data to appropriate AI agents
Pipeline updates data_queue status
Pipeline handles errors gracefully
TASK-BE-004: Add UPDATE endpoint for data sources
Layer: backend
Priority: P1 (High)
Description: Add PUT /api/data-sources/:id endpoint
Files:
backend/routes/data-sources.js (update)
Dependencies: TASK-DF-005 (encryption)
Definition of Done:
Endpoint exists
Can update name, type, URL, category, credentials, config
Updates updated_at, updated_by
Returns updated source
Validates input
Logs update in data_hub_logs
TASK-BE-005: Add DELETE endpoint for data sources
Layer: backend
Priority: P1 (High)
Description: Add DELETE /api/data-sources/:id endpoint
Files:
backend/routes/data-sources.js (update)
Dependencies: None
Definition of Done:
Endpoint exists
Soft-delete (sets is_enabled=false) or hard-delete (cascades to collected_data, logs)
Logs deletion in data_hub_logs
Returns 204 No Content
Handles foreign key constraints
TASK-BE-006: Add GET collected data endpoint
Layer: backend
Priority: P1 (High)
Description: Add GET /api/data-sources/:id/data to fetch collected data for a source
Files:
backend/routes/data-sources.js (update)
Dependencies: TASK-DF-001
Definition of Done:
Endpoint returns paginated collected_data
Supports filters (status, date range)
Returns raw_data and normalized_data
Returns metadata (collected_at, processed_at, status)
TASK-BE-007: Add test connection endpoint
Layer: backend
Priority: P2 (Medium)
Description: Add POST /api/data-sources/:id/test to test source connection before saving
Files:
backend/routes/data-sources.js (update)
backend/services/dataFetcher.js (update)
Dependencies: TASK-BE-001
Definition of Done:
Endpoint attempts to fetch from source
Returns success/failure status
Returns sample data (first 3 items)
Does not save data to database
Timeout after 10 seconds
TASK-BE-008: Add input validation middleware
Layer: backend
Priority: P1 (High)
Description: Add request validation using Joi or express-validator
Files:
backend/middleware/validation.js (new)
backend/routes/data-sources.js (update)
Dependencies: None
Definition of Done:
All POST/PUT endpoints have validation
Validates: name (required, max 255 chars), type (enum), URL (valid URL format), etc.
Returns 400 with clear error messages
No invalid data reaches database
TASK-BE-009: Add rate limiting
Layer: backend
Priority: P1 (High)
Description: Add rate limiting to prevent API abuse
Files:
backend/middleware/rateLimiter.js (new)
backend/routes/data-sources.js (update)
Dependencies: None
Definition of Done:
POST/PUT endpoints limited to 10 req/min per user
GET endpoints limited to 100 req/min per user
Returns 429 Too Many Requests when exceeded
Rate limit info in response headers
TASK-BE-010: Add pagination to GET endpoints
Layer: backend
Priority: P1 (High)
Description: Add pagination support to list endpoints
Files:
backend/routes/data-sources.js (update)
backend/utils/pagination.js (new)
Dependencies: None
Definition of Done:
GET /data-sources supports ?page=1&limit=20
Returns total count, current page, total pages
Default limit is 20, max is 100
Consistent pagination format across all endpoints
TASK-BE-011: Implement categories CRUD endpoints
Layer: backend + api
Priority: P0 (Critical)
Description: Create full CRUD for data categories
Files:
backend/routes/data-categories.js (new)
Endpoints:
GET /api/data-categories/ - List categories
POST /api/data-categories/ - Create category
PUT /api/data-categories/:id - Update category
DELETE /api/data-categories/:id - Delete category
Dependencies: TASK-DF-002
Definition of Done:
All endpoints work
Input validation
Categories persisted in database
Frontend can use these endpoints
TASK-BE-012: Implement web crawler service
Layer: backend
Priority: P2 (Medium)
Description: Create web crawler to scrape data from websites
Files:
backend/services/webCrawler.js (new)
backend/services/fetchers/webCrawlerFetcher.js (new)
Dependencies: TASK-BE-001
Definition of Done:
Can crawl URLs with configurable depth
Can extract data using CSS selectors
Respects robots.txt
Rate-limited (1 req/sec per domain)
Stores crawled data in collected_data
TASK-BE-013: Implement automation/topic routing
Layer: backend
Priority: P2 (Medium)
Description: Create service to route data to AI agents based on topics/keywords
Files:
backend/services/topicRouter.js (new)
backend/database/migrations/019_create_topic_routing.sql (new table)
Dependencies: TASK-BE-003
Definition of Done:
Can define topic → agent mappings
Automatically routes data based on keywords/topics
Logs routing decisions
Frontend can configure routing rules
TASK-BE-014: Implement access control (ACL)
Layer: backend + database
Priority: P1 (High - Security)
Description: Enforce access control on data sources
Files:
backend/database/migrations/020_create_data_acl.sql (new)
backend/middleware/dataSourceACL.js (new)
backend/routes/data-sources.js (update)
Dependencies: None
Definition of Done:
data_access_control table created
Users can only access sources they own or have permission for
Admin role can access all sources
403 Forbidden for unauthorized access
TASK-BE-015: Add audit logging
Layer: backend
Priority: P2 (Medium)
Description: Log all create/update/delete actions for audit trail
Files:
backend/middleware/auditLogger.js (new)
backend/routes/data-sources.js (update)
Dependencies: None
Definition of Done:
All CUD operations logged to data_hub_logs
Logs include: user_id, action, old_value, new_value, timestamp, IP address
Logs queryable via admin panel
🖼️ Frontend Tasks
TASK-FE-001: Split DataHubTab into sub-components
Layer: frontend
Priority: P2 (Medium)
Description: Refactor DataHubTab.tsx (1050 lines) into smaller components
Files:
components/ai/AIManager/tabs/DataHubTab.tsx (update)
components/ai/AIManager/tabs/DataHub/DataSourcesPanel.tsx (new)
components/ai/AIManager/tabs/DataHub/CategoriesPanel.tsx (new)
components/ai/AIManager/tabs/DataHub/HealthPanel.tsx (new)
components/ai/AIManager/tabs/DataHub/LogsPanel.tsx (new)
components/ai/AIManager/tabs/DataHub/PipelinePanel.tsx (new)
components/ai/AIManager/tabs/DataHub/TelegramPanel.tsx (new)
Dependencies: None
Definition of Done:
DataHubTab.tsx is < 300 lines
Each panel is separate component
No duplicate code
Tests pass
TASK-FE-002: Add error boundaries
Layer: frontend
Priority: P1 (High)
Description: Add error boundaries to prevent crashes from propagating
Files:
components/common/ErrorBoundary.tsx (new)
components/ai/AIManager/tabs/DataHubTab.tsx (update)
Dependencies: None
Definition of Done:
ErrorBoundary wraps DataHubTab
Shows friendly error message on crash
Logs error to backend
Provides "Retry" button
TASK-FE-003: Add loading skeletons
Layer: frontend
Priority: P2 (Medium)
Description: Add skeleton loaders for better perceived performance
Files:
components/common/SkeletonLoader.tsx (new)
components/ai/AIManager/tabs/DataHubTab.tsx (update)
Dependencies: None
Definition of Done:
Skeleton shows while data is loading
Smooth transition to actual data
Consistent with design system
TASK-FE-004: Add pagination to lists
Layer: frontend
Priority: P1 (High)
Description: Add pagination to data sources list and other lists
Files:
components/ai/AIManager/tabs/DataHub/DataSourcesPanel.tsx (update)
components/common/Pagination.tsx (new)
Dependencies: TASK-BE-010
Definition of Done:
Shows 20 items per page
Prev/Next buttons work
Shows page numbers
Shows total count
Handles empty state
TASK-FE-005: Add real-time updates via WebSocket
Layer: frontend + backend
Priority: P2 (Medium)
Description: Use WebSocket to push real-time updates to Data Hub UI
Files:
backend/websocket/dataHubChannel.js (new)
components/ai/AIManager/tabs/DataHubTab.tsx (update)
hooks/useDataHubWebSocket.ts (new)
Dependencies: None (WebSocket server already exists)
Definition of Done:
UI auto-updates when new data arrives
UI shows live health status
UI shows live fetch progress
Reconnects on disconnect
TASK-FE-006: Implement API caching with React Query
Layer: frontend
Priority: P2 (Medium)
Description: Use React Query (or similar) for caching, deduplication, optimistic updates
Files:
services/api.ts (update)
hooks/useDataHubState.ts (new)
package.json (add @tanstack/react-query)
Dependencies: None
Definition of Done:
API responses cached for 5 minutes
Duplicate requests deduplicated
Stale data refetched in background
Optimistic updates for create/update/delete
TASK-FE-007: Add input validation to forms
Layer: frontend
Priority: P1 (High)
Description: Add client-side validation to all forms
Files:
components/ai/AIManager/tabs/DataHub/modals/CreateSourceModal.tsx (update)
components/ai/AIManager/tabs/DataHub/modals/CreateCategoryModal.tsx (update)
utils/validation.ts (new)
Dependencies: None
Definition of Done:
Validates URL format
Validates required fields
Shows error messages
Disables submit if invalid
Uses library like Zod or Yup
TASK-FE-008: Add test connection button
Layer: frontend
Priority: P2 (Medium)
Description: Add "Test Connection" button in CreateSourceModal
Files:
components/ai/AIManager/tabs/DataHub/modals/CreateSourceModal.tsx (update)
services/api.ts (update)
Dependencies: TASK-BE-007
Definition of Done:
Button triggers test connection
Shows loading state
Shows success/error message
Shows sample data on success
TASK-FE-009: Hide credentials in forms
Layer: frontend
Priority: P0 (Critical - Security)
Description: Show credentials as ••••••• (password field)
Files:
components/ai/AIManager/tabs/DataHub/modals/CreateSourceModal.tsx (update)
Dependencies: None
Definition of Done:
Credentials input is type="password"
Shows "Reveal" button
Never logs credentials to console
TASK-FE-010: Implement duplicate detection
Layer: frontend
Priority: P2 (Medium)
Description: Warn user if creating duplicate source (same name+type)
Files:
components/ai/AIManager/tabs/DataHub/modals/CreateSourceModal.tsx (update)
Dependencies: TASK-DF-006 (backend constraint)
Definition of Done:
Checks for duplicates before submit
Shows warning message
User can cancel or proceed
TASK-FE-011: Implement categories persistence
Layer: frontend
Priority: P0 (Critical)
Description: Use backend categories endpoints instead of local state
Files:
components/ai/AIManager/tabs/DataHub/modals/CreateCategoryModal.tsx (update)
services/api.ts (update)
Dependencies: TASK-BE-011
Definition of Done:
Categories fetched from backend
Categories persist across page refresh
Can create/update/delete categories
TASK-FE-012: Split AdvancedFeatures into sub-components
Layer: frontend
Priority: P2 (Medium)
Description: Refactor AdvancedFeatures.tsx (800 lines) into smaller components
Files:
components/ai/AIManager/tabs/DataHub/AdvancedFeatures.tsx (update)
components/ai/AIManager/tabs/DataHub/advanced/WebCrawlerConfig.tsx (new)
components/ai/AIManager/tabs/DataHub/advanced/AutoDiscoveryConfig.tsx (new)
components/ai/AIManager/tabs/DataHub/advanced/SmartPrioritization.tsx (new)
components/ai/AIManager/tabs/DataHub/advanced/AccessControlPanel.tsx (new)
components/ai/AIManager/tabs/DataHub/advanced/BlacklistWhitelist.tsx (new)
components/ai/AIManager/tabs/DataHub/advanced/TelegramPublisher.tsx (new)
components/ai/AIManager/tabs/DataHub/advanced/AutomationTopics.tsx (new)
Dependencies: None
Definition of Done:
AdvancedFeatures.tsx is < 200 lines
Each feature is separate component
No duplicate code
TASK-FE-013: Add export data functionality
Layer: frontend + backend
Priority: P3 (Low)
Description: Add "Export to CSV/JSON" button to ViewSourceDataModal
Files:
components/ai/AIManager/tabs/DataHub/modals/ViewSourceDataModal.tsx (update)
backend/routes/data-sources.js (add export endpoint)
Dependencies: TASK-BE-006
Definition of Done:
Can export collected_data as CSV
Can export collected_data as JSON
Download initiates on button click
TASK-FE-014: Add filtering/searching in ViewSourceDataModal
Layer: frontend
Priority: P2 (Medium)
Description: Add search box and filters to ViewSourceDataModal
Files:
components/ai/AIManager/tabs/DataHub/modals/ViewSourceDataModal.tsx (update)
Dependencies: TASK-BE-006
Definition of Done:
Can search by keyword
Can filter by status (pending, processed, error)
Can filter by date range
Search is debounced (500ms)
🚀 API & Integration Tasks
TASK-API-001: Add API versioning
Layer: api
Priority: P2 (Medium)
Description: Version API as /api/v1/data-sources, /api/v2/...
Files:
backend/routes/index.js (update)
backend/routes/v1/data-sources.js (move existing routes here)
Dependencies: None
Definition of Done:
Existing routes moved to /api/v1/
/api/data-sources redirects to /api/v1/data-sources with deprecation warning
Versioning strategy documented
TASK-API-002: Generate OpenAPI/Swagger docs
Layer: api + documentation
Priority: P3 (Low)
Description: Add Swagger UI for Data Hub API
Files:
backend/docs/swagger.yaml (new)
backend/routes/docs.js (new)
package.json (add swagger-ui-express)
Dependencies: None
Definition of Done:
Swagger UI accessible at /api/docs
All endpoints documented
Request/response schemas defined
Try-it-out works
TASK-API-003: Add response schema validation
Layer: api
Priority: P2 (Medium)
Description: Validate responses match expected schema (prevent bugs)
Files:
backend/middleware/responseValidation.js (new)
backend/routes/data-sources.js (update)
Dependencies: None
Definition of Done:
All responses validated in development mode
Errors logged if schema mismatch
No impact on production performance
TASK-API-004: Add caching headers
Layer: api
Priority: P3 (Low)
Description: Add Cache-Control, ETag headers to GET endpoints
Files:
backend/middleware/caching.js (new)
backend/routes/data-sources.js (update)
Dependencies: None
Definition of Done:
GET /data-sources returns Cache-Control: max-age=300
GET /data-sources/state returns Cache-Control: max-age=60
ETag support for conditional requests
TASK-API-005: Review CORS configuration
Layer: api + infra
Priority: P2 (Medium)
Description: Audit and tighten CORS config for security
Files:
backend/server.js (or wherever CORS is configured)
Dependencies: None
Definition of Done:
CORS allows only whitelisted origins
CORS does not allow credentials from * origin
CORS config documented
🔍 Testing & Quality Tasks
TASK-QA-001: Write integration tests for Data Hub API
Layer: backend + testing
Priority: P2 (Medium)
Description: Test all Data Hub endpoints end-to-end
Files:
backend/tests/integration/data-sources.test.js (new)
Dependencies: All backend tasks
Definition of Done:
Tests for all CRUD endpoints
Tests for edge cases (404, 400, 500)
Tests for authentication/authorization
Tests pass in CI/CD
TASK-QA-002: Write unit tests for data fetcher
Layer: backend + testing
Priority: P2 (Medium)
Description: Test data fetching logic
Files:
backend/tests/unit/dataFetcher.test.js (new)
Dependencies: TASK-BE-001
Definition of Done:
Tests for RSS fetcher
Tests for API fetcher
Tests for Telegram fetcher
Tests for error handling
80%+ code coverage
TASK-QA-003: Write E2E tests for Data Hub UI
Layer: frontend + testing
Priority: P2 (Medium)
Description: E2E tests for Data Hub workflows
Files:
tests/e2e/dataHub.spec.ts (new)
Dependencies: All frontend tasks
Definition of Done:
Test: Create new source
Test: Edit existing source
Test: Delete source
Test: Test connection
Test: View collected data
Tests pass in CI/CD
📚 Documentation Tasks
TASK-DOC-001: Write Data Hub architecture docs
Layer: documentation
Priority: P1 (High)
Description: Document Data Hub architecture, data flow, components
Files:
docs/DATA_HUB_ARCHITECTURE.md (new)
Dependencies: None (can be done now)
Definition of Done:
Architecture diagram
Component descriptions
Data flow diagram
Database schema docs
API endpoints list
TASK-DOC-002: Write Data Hub user guide
Layer: documentation
Priority: P2 (Medium)
Description: End-user documentation for Data Hub features
Files:
docs/DATA_HUB_USER_GUIDE.md (new)
Dependencies: All feature tasks
Definition of Done:
How to create a data source
How to configure Telegram collector
How to view collected data
How to troubleshoot issues
Screenshots included
TASK-DOC-003: Write Data Hub API reference
Layer: documentation
Priority: P2 (Medium)
Description: API reference for developers integrating with Data Hub
Files:
docs/DATA_HUB_API_REFERENCE.md (new)
Dependencies: TASK-API-002
Definition of Done:
All endpoints documented
Request/response examples
Authentication docs
Error codes list
Rate limiting docs
📊 PRIORITY MATRIX
P0 (Critical - Must Fix Immediately)
TASK-DF-001: Create collected_data table
TASK-DF-002: Create data_categories table
TASK-DF-003: Create data_queue table
TASK-DF-005: Encrypt credentials
TASK-BE-001: Implement data fetcher service
TASK-BE-002: Implement scheduler
TASK-BE-003: Implement data pipeline
TASK-BE-011: Implement categories CRUD
TASK-FE-009: Hide credentials
TASK-FE-011: Implement categories persistence
P1 (High - Fix Soon)
TASK-DF-004: Add audit columns
TASK-BE-004: Add UPDATE endpoint
TASK-BE-005: Add DELETE endpoint
TASK-BE-006: Add GET collected data endpoint
TASK-BE-008: Add input validation
TASK-BE-009: Add rate limiting
TASK-BE-010: Add pagination
TASK-BE-014: Implement ACL
TASK-FE-002: Add error boundaries
TASK-FE-004: Add pagination
TASK-FE-007: Add input validation
TASK-DOC-001: Write architecture docs
P2 (Medium - Nice to Have)
TASK-DF-006: Add unique constraint
TASK-DF-007: Add log retention
TASK-BE-007: Add test connection endpoint
TASK-BE-012: Implement web crawler
TASK-BE-013: Implement topic routing
TASK-BE-015: Add audit logging
TASK-FE-001: Split DataHubTab
TASK-FE-003: Add loading skeletons
TASK-FE-005: Add WebSocket updates
TASK-FE-006: Implement caching
TASK-FE-008: Add test connection button
TASK-FE-010: Implement duplicate detection
TASK-FE-012: Split AdvancedFeatures
TASK-FE-014: Add filtering/searching
TASK-API-001: Add API versioning
TASK-API-003: Add response validation
TASK-API-005: Review CORS
TASK-QA-001: Write integration tests
TASK-QA-002: Write unit tests
TASK-QA-003: Write E2E tests
TASK-DOC-002: Write user guide
TASK-DOC-003: Write API reference
P3 (Low - Future)
TASK-FE-013: Add export data
TASK-API-002: Generate Swagger docs
TASK-API-004: Add caching headers
🎯 RECOMMENDED IMPLEMENTATION SEQUENCE
Phase 1: Foundation (Week 1)
TASK-DF-001 → TASK-DF-002 → TASK-DF-003 → TASK-DF-005
TASK-BE-001 → TASK-BE-002 → TASK-BE-003
TASK-DOC-001
Goal: Get core data collection working

Phase 2: Backend Completion (Week 2)
TASK-BE-004 → TASK-BE-005 → TASK-BE-006
TASK-BE-008 → TASK-BE-009 → TASK-BE-010
TASK-BE-011
TASK-DF-004
Goal: Full CRUD + API hardening

Phase 3: Frontend Fixes (Week 3)
TASK-FE-011 → TASK-FE-009
TASK-FE-002 → TASK-FE-004 → TASK-FE-007
TASK-FE-001 → TASK-FE-012
Goal: Fix critical UX and security issues

Phase 4: Advanced Features (Week 4)
TASK-BE-012 → TASK-BE-013 → TASK-BE-014
TASK-FE-005 → TASK-FE-006
TASK-API-001 → TASK-API-005
Goal: Implement advanced features

Phase 5: Quality & Docs (Week 5)
TASK-QA-001 → TASK-QA-002 → TASK-QA-003
TASK-DOC-002 → TASK-DOC-003
TASK-DF-006 → TASK-DF-007
TASK-API-002 → TASK-API-003 → TASK-API-004
Goal: Polish, test, document

🏁 CONCLUSION
Current State Summary
Frontend: 50% complete (UI exists but lacks functionality)
Backend: 30% complete (endpoints exist but core logic missing)
Database: 40% complete (schema partial, missing key tables)
Integration: 20% complete (many endpoints missing)
Biggest Risks
🔴 No data collection implementation → Data Hub doesn't collect data!
🔴 No data persistence → Collected data has nowhere to go
🔴 Security issues → Credentials in plain text
🔴 Misleading UI → Features advertised but not implemented
Estimated Effort
Total: ~50 tasks
P0 (Critical): 10 tasks → ~2 weeks (2 devs)
P1 (High): 13 tasks → ~2 weeks (2 devs)
P2 (Medium): 23 tasks → ~3 weeks (2 devs)
P3 (Low): 4 tasks → ~1 week (1 dev)
Total: ~8 weeks with 2 full-time developers

📋 NEXT ACTIONS
Review this analysis with the team
Prioritize tasks based on business needs
Assign owners to each task
Start with Phase 1 (Foundation)
Set up project board (e.g., GitHub Projects, Jira)
Questions? Please clarify:

Should we prioritize web crawler over Telegram? Or vice versa?
What is the expected data volume (rows/day)?
Do we need real-time processing or batch is OK?
Are there compliance requirements for data retention/encryption?
End of Analysis Report