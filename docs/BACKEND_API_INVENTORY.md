# TitanGold Backend API Endpoints - Complete Inventory

**Generated**: 2025-12-27  
**Status**: Current Production Routes

---

## 🟢 Existing Endpoints

### Artemis Module (`/api/artemis`)
| Method | Endpoint | Auth | Description | Status |
|--------|----------|------|-------------|--------|
| GET | `/state` | ✅ | Get Artemis state | ✅ Working |
| PATCH | `/state` | ✅ | Update Artemis state | ✅ Working |
| GET | `/scenarios` | ✅ | Get trading scenarios | ✅ Working |
| POST | `/decision` | ✅ | Make AI decision | ✅ Working |
| PATCH | `/config/decision-engine` | ✅ Admin | Update decision engine config | ✅ Working |

**Missing**:
- ❌ GET `/logs` - Fetch decision logs
- ❌ DELETE `/logs` - Clear logs
- ❌ PUT `/config` - General config update (used by UI)
- ❌ GET `/health` - Artemis health check
- ❌ GET `/metrics` - Performance metrics

---

### AI Agents Module (`/api/ai-agents`)
| Method | Endpoint | Auth | Description | Status |
|--------|----------|------|-------------|--------|
| POST | `/chat` | ✅ | Chat with AI | ✅ Working |
| POST | `/:id/run` | ✅ | Run specific agent | ✅ Working |
| GET | `/manager-overview` | ✅ | Get manager overview | ✅ Working |
| GET | `/` | ✅ | List all agents | ✅ Working |
| GET | `/:id` | ✅ | Get agent details | ✅ Working |
| PATCH | `/:id` | ✅ | Update agent | ✅ Working |

**Missing**:
- ❌ POST `/` - Create new agent
- ❌ DELETE `/:id` - Delete agent
- ❌ GET `/:id/logs` - Agent-specific logs
- ❌ POST `/:id/train` - Trigger training

---

### Data Sources Module (`/api/data-sources`)
| Method | Endpoint | Auth | Description | Status |
|--------|----------|------|-------------|--------|
| POST | `/publish-telegram` | ✅ | Publish to Telegram | ✅ Working |
| GET | `/` | ✅ | List data sources | ✅ Working |
| POST | `/` | ✅ | Create data source | ✅ Working |

**Missing**:
- ❌ GET `/state` or `/status` - DataHub state (used by DataHubTab)
- ❌ GET `/health` - DataHub health check (used by DataHubTab)
- ❌ GET `/:id` - Get specific source
- ❌ PATCH `/:id` - Update source
- ❌ DELETE `/:id` - Delete source
- ❌ POST `/ingest` - Manual data ingestion
- ❌ GET `/stats` - Storage statistics

---

### Training Module (`/api/training`)
| Method | Endpoint | Auth | Description | Status |
|--------|----------|------|-------------|--------|
| GET | `/sessions` | ✅ | List training sessions | ✅ Working |
| POST | `/sessions` | ✅ | Create training session | ✅ Working |

**Missing**:
- ❌ GET `/sessions/:id` - Get session details
- ❌ DELETE `/sessions/:id` - Delete session
- ❌ POST `/sessions/:id/stop` - Stop training

---

### Scheduler Module (`/api/scheduler`)
| Method | Endpoint | Auth | Description | Status |
|--------|----------|------|-------------|--------|
| GET | `/status` | ✅ | Get scheduler status | ✅ Working |
| POST | `/start` | ✅ Admin | Start scheduler | ✅ Working |
| POST | `/stop` | ✅ Admin | Stop scheduler | ✅ Working |
| PUT | `/config/:section` | ✅ Admin | Update config section | ✅ Working |
| GET | `/config` | ✅ | Get configuration | ✅ Working |

---

## 🔴 Missing Modules

### Scenarios Module (`/api/scenarios`)
**Status**: ❌ Does NOT exist (used by ScenariosTab)

**Required Endpoints**:
- ❌ POST `/generate` - Generate AI scenario
- ❌ POST `/` - Create scenario
- ❌ POST `/:id/backtest` - Run backtest for scenario
- ❌ GET `/:id` - Get scenario details
- ❌ DELETE `/:id` - Delete scenario

**Note**: Currently scenarios are served via `/api/artemis/scenarios`

---

### Backtest Module (`/api/backtest`)
**Status**: ❌ Does NOT exist (used by BacktestingTab)

**Required Endpoints**:
- ❌ GET `/results` - Fetch backtest results
- ❌ POST `/run` - Run new backtest
- ❌ GET `/results/:id` - Get specific result
- ❌ DELETE `/results/:id` - Delete result

---

### DataHub Module (`/api/data-hub`)
**Status**: ❌ Does NOT exist (used by DataHubTab)

**Required Endpoints**:
- ❌ GET `/state` - Get DataHub state
- ❌ GET `/health` - Health check
- ❌ GET `/sources` - List sources
- ❌ POST `/ingest` - Manual ingestion
- ❌ GET `/stats` - Statistics

---

### Telegram Module (`/api/telegram`)
**Status**: ❌ Does NOT exist (used by DataHubTab)

**Required Endpoints**:
- ❌ GET `/channels` - List channels
- ❌ POST `/channels` - Add channel
- ❌ DELETE `/channels/:id` - Remove channel
- ❌ GET `/messages` - Recent messages
- ❌ GET `/stats` - Ingestion stats

---

### System Health Module (`/api/system`)
**Status**: ⚠️ Partial (only `/api/health` exists)

**Required Endpoints**:
- ✅ GET `/health` - Basic health (exists as `/api/health`)
- ❌ GET `/metrics` - System metrics
- ❌ GET `/logs` - System logs

---

## 📊 Summary Statistics

| Category | Existing | Missing | Total | Coverage |
|----------|----------|---------|-------|----------|
| **Artemis** | 5 | 5 | 10 | 50% |
| **AI Agents** | 6 | 4 | 10 | 60% |
| **Data Sources** | 3 | 6 | 9 | 33% |
| **Training** | 2 | 3 | 5 | 40% |
| **Scheduler** | 5 | 0 | 5 | 100% |
| **Scenarios** | 0 | 5 | 5 | 0% |
| **Backtest** | 0 | 4 | 4 | 0% |
| **DataHub** | 0 | 5 | 5 | 0% |
| **Telegram** | 0 | 4 | 4 | 0% |
| **System** | 1 | 2 | 3 | 33% |
| **TOTAL** | **22** | **38** | **60** | **37%** |

---

## 🎯 Priority Matrix

### 🔥 Critical (UI completely broken without these)
1. `GET /api/artemis/logs` - Used by OverviewTab & SystemLogsTab
2. `DELETE /api/artemis/logs` - Used by SystemLogsTab
3. `PUT /api/artemis/config` - Used by multiple tabs
4. `GET /api/data-hub/state` - Used by DataHubTab
5. `GET /api/data-hub/health` - Used by DataHubTab

### ⚠️ High (Features incomplete)
6. `POST /api/scenarios/generate` - ScenariosTab
7. `POST /api/scenarios` - ScenariosTab
8. `GET /api/backtest/results` - BacktestingTab
9. `POST /api/backtest/run` - BacktestingTab

### 📝 Medium (Nice to have)
10. Agent CRUD operations
11. Data source details
12. Training session management
13. Telegram integration

---

## 🔧 Implementation Plan

### Phase 1: Critical Fixes (Day 1-2)
1. Add `/api/artemis/logs` endpoints
2. Add `/api/artemis/config` PUT method
3. Create `/api/data-hub` module skeleton
4. Test all critical paths

### Phase 2: Feature Completion (Day 3-4)
5. Implement `/api/scenarios` module
6. Implement `/api/backtest` module
7. Complete DataHub endpoints
8. Add missing CRUD operations

### Phase 3: Enhancements (Day 5+)
9. Telegram integration endpoints
10. System metrics
11. Advanced logging
12. Performance optimization

---

**Next Action**: Start implementing Critical endpoints
