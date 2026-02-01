# Engine Inventory - Current State Analysis

تاریخ: 2025-12-24  
هدف: شناسایی کدهای موجود مرتبط با engine runtime و شناسایی gaps

---

## 1. Entry Points موجود

### 1.1 DataHub Ingest/Refresh

**فایل**: `backend/engine/scheduler.js`
- **تابع**: `startDataHubScheduler()` (خط 198-244)
- **مسئولیت**: Auto-refresh تمام data sources با interval قابل تنظیم
- **API Calls**: 
  - `GET /api/artemis/data-hub` برای fetch state
  - `POST /api/data-sources/:id/refresh` برای refresh هر source
  - `POST /api/data-sources/:id/normalize` برای normalize
- **Config**: `config.dataHub.enabled`, `config.dataHub.interval`, `config.dataHub.autoRefresh`
- **Status**: ✅ موجود و فعال

---

### 1.2 Internal 15 AI Agents Execution

**فایل**: `backend/engine/scheduler.js`
- **تابع**: `startAgentScheduler()` (خط 111-176)
- **مسئولیت**: Auto-execute تمام 15 agents با interval قابل تنظیم
- **Agent IDs**: `agent-1` تا `agent-15`
- **Agent Functions**: `runTechnicalAnalysis`, `runRiskAssessment`, ... (15 function)
- **API Call**: `POST /api/ai-agents/:id/run` (خط 182)
- **Alternative**: `backend/services/artemisOrchestrator.js` → `coordinateAgents()` (خط 440)
  - این تابع agents را با dependency graph اجرا می‌کند (sequential + parallel)
  - اما نیاز به `userId` و `context` دارد
- **Config**: `config.agents.enabled`, `config.agents.interval`
- **Status**: ✅ موجود اما نیاز به integration با engine cycle

---

### 1.3 Artemis Decision (External Providers)

**فایل**: `backend/services/artemisOrchestrator.js`
- **تابع**: `getMixtureDecision(input, decisionConfig)` (خط 303)
- **مسئولیت**: تصمیم‌گیری با استفاده از چند LLM provider (Gemini, Claude, OpenAI, DeepSeek, OpenRouter)
- **API Endpoint**: `POST /api/artemis/decision` (خط 175 در `backend/routes/artemis.js`)
- **Input**: `{ opportunity, signals, context }`
- **Output**: `{ action, confidence, reason, providers }`
- **Current Scheduler**: `startArtemisScheduler()` در `scheduler.js` (خط 373-395)
  - ⚠️ **مشکل**: فقط یک placeholder است - واقعاً `getMixtureDecision` را فراخوانی نمی‌کند
- **Status**: ⚠️ موجود اما scheduler آن کامل نیست

---

### 1.4 Telegram Publishing

**فایل**: `backend/services/telegram.js`
- **کلاس**: `TelegramService`
- **توابع**: 
  - `sendMessage(message, parseMode)` (خط 18)
  - `sendPhoto(photoUrl, caption)` (خط 30)
- **Env Vars**: 
  - `TELEGRAM_BOT_TOKEN` (خط 6)
  - `TELEGRAM_CHAT_ID` (خط 7)
- **API Endpoint**: `POST /api/data-sources/publish-telegram` (در `backend/routes/data-sources.js`)
- **Status**: ✅ موجود و آماده استفاده

---

## 2. متغیرهای محیطی مورد نیاز

### 2.1 Database
- `DB_HOST` (از `backend/database/db.js`)
- `DB_PORT`
- `DB_NAME`
- `DB_USER`
- `DB_PASSWORD`

### 2.2 Redis (اگر استفاده شود)
- `REDIS_HOST` (از `backend/services/messageQueue.js` - اگر موجود باشد)
- `REDIS_PORT`
- `REDIS_PASSWORD` (اختیاری)

### 2.3 Telegram
- `TELEGRAM_BOT_TOKEN` ✅ (موجود در `backend/services/telegram.js`)
- `TELEGRAM_CHAT_ID` ✅ (موجود)

### 2.4 External AI Providers

**Gemini**:
- `GEMINI_API_KEY` (از `backend/services/ai.js` - internal)

**Claude/Anthropic**:
- `ANTHROPIC_API_KEY` یا `CLAUDE_API_KEY` ✅
- `ANTHROPIC_API_KEYS` (multi-key) ✅

**OpenAI**:
- `OPENAI_API_KEY` یا `CHATGPT_API_KEY` ✅
- `OPENAI_API_KEYS` (multi-key) ✅

**DeepSeek**:
- `DEEPSEEK_API_KEY` یا `API_KEY` ✅
- `DEEPSEEK_API_KEYS` (multi-key) ✅

**OpenRouter**:
- `OPENROUTER_API_KEY` ✅
- `OPENROUTER_API_KEYS` (multi-key) ✅
- `OPENROUTER_MODEL` (اختیاری)
- `OPENROUTER_HTTP_REFERER` (اختیاری)
- `OPENROUTER_X_TITLE` (اختیاری)

---

## 3. Gaps شناسایی شده

### 3.1 Unified Engine Cycle
**مشکل**: Schedulerهای موجود جداگانه کار می‌کنند:
- DataHub scheduler: فقط data sources را refresh می‌کند
- Agent scheduler: فقط agents را اجرا می‌کند
- Artemis scheduler: فقط placeholder است (هیچ کاری نمی‌کند)

**نیاز**: یک engine worker که چرخه کامل را orchestrate کند:
1. DataHub refresh
2. Agent coordination (15 agents)
3. Artemis decision (با signals از agents)
4. Telegram publishing

---

### 3.2 Engine Control (Env Vars)
**مشکل**: هیچ env var برای کنترل engine وجود ندارد:
- `ENGINE_ENABLED` وجود ندارد
- `ENGINE_TICK_INTERVAL_MS` وجود ندارد
- `ENGINE_MAX_BACKOFF_MS` وجود ندارد

**نیاز**: اضافه کردن env var controls

---

### 3.3 Heartbeat Mechanism
**مشکل**: هیچ heartbeat mechanism وجود ندارد:
- نمی‌توان فهمید engine آخرین بار چه زمانی کار کرده
- نمی‌توان فهمید engine در حال اجرا است یا متوقف شده

**نیاز**: Heartbeat record (file-based یا DB-based)

---

### 3.4 Error Handling & Backoff
**مشکل**: Schedulerهای موجود backoff ندارند:
- اگر یک cycle fail شود، بلافاصله cycle بعدی شروع می‌شود
- هیچ exponential backoff وجود ندارد

**نیاز**: Exponential backoff با cap (`ENGINE_MAX_BACKOFF_MS`)

---

### 3.5 Artemis Scheduler Integration
**مشکل**: `startArtemisScheduler()` در `scheduler.js` فقط placeholder است:
- واقعاً `getMixtureDecision` را فراخوانی نمی‌کند
- نیاز به `opportunity`, `signals`, `context` دارد که باید از agents و DataHub آماده شود

**نیاز**: Integration کامل با agent results و DataHub data

---

## 4. فایل‌های مرتبط

### Backend Core
- `backend/server.js` - Entry point، scheduler.start() در خط 220
- `backend/engine/scheduler.js` - Scheduler service موجود
- `backend/services/artemisOrchestrator.js` - Artemis decision logic
- `backend/services/telegram.js` - Telegram publishing
- `backend/routes/artemis.js` - Artemis API endpoints
- `backend/routes/ai-agents.js` - Agent execution endpoints

### Database
- `backend/database/db.js` - Database connection
- `database/schema.sql` - Schema (برای heartbeat table اگر نیاز باشد)

---

## 5. خلاصه

### موجود:
- ✅ DataHub refresh logic
- ✅ Agent execution logic (15 agents)
- ✅ Artemis decision logic (getMixtureDecision)
- ✅ Telegram publishing
- ✅ Scheduler infrastructure

### Missing:
- ❌ Unified engine worker (orchestrating full cycle)
- ❌ Engine control env vars (ENGINE_ENABLED, etc.)
- ❌ Heartbeat mechanism
- ❌ Exponential backoff
- ❌ Artemis scheduler integration (real implementation)
- ❌ Integration بین DataHub → Agents → Artemis → Telegram

---

**پایان Inventory**

