# Telegram Collector – Architecture Analysis & Task Backlog

Analysis of the **Telegram Collector** section of the TitanGold project: architecture map, issues/risks, and a structured task backlog.

---

## 1. Architecture Overview

### 1.1 Components

| Layer | Component | Location | Role |
|-------|-----------|----------|------|
| **Frontend** | TelegramPanel | `components/ai/AIManager/tabs/DataHub/TelegramPanel.tsx` | UI: accounts, channels, sync, view messages, link to source |
| **Frontend** | TelegramLoginWizard | `components/ai/AIManager/tabs/DataHub/TelegramLoginWizard.tsx` | Login flow (phone, code, 2FA) |
| **Frontend** | useDataHub (telegram) | `components/ai/AIManager/tabs/DataHub/hooks/useDataHub.ts` | Handlers: login, refresh channels, link channel to source, test channel |
| **Frontend** | telegramIntegration | `components/ai/AIManager/tabs/DataHub/utils/telegramIntegration.ts` | createTelegramDataSource, isChannelLinked |
| **Collector service** | Telegram Collector (Node) | `telegram-collector/dist/index.js` (port 3002) | MTProto client, accounts, channels, polling, health |
| **Backend** | data-sources routes | `backend/routes/data-sources.js` | telegram-sync, telegram-sync-category, telegram-transfer-messages (mounted at `/api/v1/data-sources`) |
| **Backend** | telegramSync | `backend/services/telegramSync.js` | Sync `telegram_channels` → `data_sources` |
| **Backend** | telegramPipeline | `backend/services/telegramPipeline.js` | Transfer `telegram_messages` → `collected_data` |
| **Backend** | dataNormalizer | `backend/services/normalizers/dataNormalizer.js` | normalizeTelegram() for pipeline |
| **Proxy** | Nginx | `infrastructure/nginx.conf`, `deploy/*/infrastructure/nginx.conf` | `/api/telegram-collector` → localhost:3002 |
| **DB** | telegram_* tables | Migrations | telegram_accounts, telegram_channels, telegram_messages, telegram_sessions (optional) |

### 1.2 Data Flow

```
[User] → TelegramPanel / LoginWizard
    → Nginx (/api/telegram-collector/*) → Telegram Collector (3002)
    → Nginx (/api/v1/data-sources/*)    → Backend (5002)

Telegram Collector:
  - GET  /api/telegram-collector/health
  - GET  /api/telegram-collector/accounts
  - GET  /api/telegram-collector/collector-channels
  - POST /api/telegram-collector/login/start | /confirm | /cancel
  - POST /api/telegram-collector/channels/register
  - POST /api/telegram-collector/channels/refresh
  - GET  /api/telegram-collector/channels/:channelId/messages
  - PATCH/DELETE /api/telegram-collector/collector-channels/:id
  - POST /api/telegram-collector/accounts/:id/logout, PATCH /accounts/:id

Backend (main app):
  - POST /api/v1/data-sources/telegram-sync          (sync channels → data_sources)
  - POST /api/v1/data-sources/telegram-sync-category  (sync category for one channel)
  - POST /api/v1/data-sources/telegram-transfer-messages (telegram_messages → collected_data)
```

**Message pipeline:**  
Telegram Collector (channelPollingService) → `telegram_messages` → (manual or job) `transferTelegramMessagesToPipeline()` → `collected_data` → normalization / pipeline UI.

**Auth policy (TASK-TC-011):**  
The Telegram Collector HTTP API (port 3002) has **no authentication** on its endpoints. It is intended to be **internal-only**: reachable only via Nginx proxy from the same host (e.g. `location ^~ /api/telegram-collector` → localhost:3002). The main app (backend) is authenticated; the collector is not exposed as a public API. If the collector is ever exposed beyond the proxy (e.g. direct port or another domain), add authentication (e.g. API key header or JWT) or an IP allowlist.

### 1.3 Source vs Deploy Split

- **Root `telegram-collector/`**: Only **dist/** is present; **src/** has been removed (per git). The dist is the full multi-account service (sessionManager, accountManager, sessionRotationService, channelPollingService, rate limiting, circuit breaker).
- **Deploy `deploy/blue/telegram-collector/` and `deploy/green/telegram-collector/`**: Have **src/index.ts** but it is a **simplified single-session** implementation. It does **not** implement:
  - `GET /api/telegram-collector/collector-channels`
  - `POST /api/telegram-collector/channels/refresh`
  - `GET /api/telegram-collector/channels/:channelId/messages`
  - PATCH/DELETE `collector-channels/:id`
  - Full multi-account session handling

Production therefore **must** run the **root** `telegram-collector/dist/index.js`. The deploy copies provide a thinner alternate implementation that depends on root dist (e.g. `accountManager` required from `../../../../telegram-collector/dist/utils/accountManager.js`).

---

## 2. Issues and Risks

### 2.1 Critical

- **TASK-TC-001 (Source code missing):** ✅ Done. Restored entry point: `telegram-collector/src/index.ts` compiles to `dist/index.js` and loads `dist/index.legacy.js` (full app). Multi-account logic remains in dist; `npm run build` and `npm run start` work.
- **TASK-TC-002 (Dual session persistence in deploy):** In `deploy/blue/telegram-collector/src/index.ts`, login/confirm writes the session to `telegram_accounts` (via root accountManager) **and** to the `.env` file. Writing secrets to disk and mixing DB + env is a security and consistency risk. Prefer a single source of truth (DB) and remove .env session write.
- **TASK-TC-003 (Pipeline transfer not scheduled):** `transferTelegramMessagesToPipeline()` is only invoked via manual `POST /api/v1/data-sources/telegram-transfer-messages`. There is no cron/scheduler to run it periodically, so `telegram_messages` can grow without being moved to `collected_data` unless the UI/API is called.

### 2.2 High

- **TASK-TC-004 (Nginx location priority):** In `infrastructure/nginx.conf`, `location /api/telegram-collector` is used. If a broader `location /api/` exists, order/prefix (e.g. `^~`) must ensure telegram-collector is matched first. Document and verify order in all deploy environments (see TELEGRAM_COLLECTOR_REVIEW.md).
- **TASK-TC-005 (Refresh channels no-op):** In root dist, `POST /api/telegram-collector/channels/refresh` returns `{ success: true }` but does not refresh dialogs from Telegram or sync DB. UI suggests a real refresh; either implement refresh-from-Telegram + optional DB sync or rename/ document as “ack only.”
- **TASK-TC-006 (Inconsistent API base in useDataHub):** `handleRefreshCollectorChannels` builds URL as `base ? `${base}/api/telegram-collector/channels/refresh` : '/api/telegram-collector/channels/refresh'`. When `telegramCollectorUrl` is empty, relative path is correct behind Nginx; when it is a full URL (e.g. dev), base must not double the path. Confirm behavior and align with `TelegramPanel.buildCollectorUrl()`.
- **TASK-TC-007 (Sync endpoint path):** Frontend correctly uses `/api/v1/data-sources/telegram-sync`. Ensure all docs and any other callers (e.g. scripts) use `/api/v1/`, not `/api/`, to avoid 404.

### 2.3 Medium

- **TASK-TC-008 (FloodWait handling incomplete):** Multi-Account doc marks TASK-MA-030 (FloodWait per-account: set `last_flood_until`, block auth/polling until then) as not done. Implement so flooded accounts are skipped and UI shows clear state.
- **TASK-TC-009 (Per-account metrics):** Account Summary in UI (e.g. messages in 24h per account) may need backend support. Health and Account Summary currently rely on collector health and account list; add/use a clear metric (e.g. messages_24h per account) if product requires it.
- **TASK-TC-010 (Deploy blue/green collector):** Deploy `telegram-collector` source is out of sync with root dist (missing routes, single-session). Decide: either remove deploy collector src and always run root dist, or fully align deploy with root (same routes, multi-account). Then update BUILD_AND_DEPLOY.md.
- **TASK-TC-011 (Auth on collector endpoints):** Collector endpoints (e.g. accounts, collector-channels, channels/register) may be unauthenticated. If the service is only reachable via Nginx from the same app, risk is limited but should be explicit; if ever exposed, add auth or IP allowlist.

### 2.4 Low / Maintenance

- **TASK-TC-012 (Telegram Collector URL env):** `VITE_TELEGRAM_COLLECTOR_URL` must be set at build time for production. Document in BUILD_AND_DEPLOY.md and ensure CI/deploy sets it when building frontend.
- **TASK-TC-013 (Scheduler path inconsistency):** In deploy backend, scheduler uses `/api/data-sources/...` (no `v1`). Confirm whether deploy backend mounts data-sources under `/api/` or `/api/v1/` and align URLs.
- **TASK-TC-014 (Locales):** New strings for Telegram Collector and Login Wizard should exist in both deploy/blue and deploy/green locales (fa.json, en.json) to avoid missing keys.

---

## 3. Task Backlog

Format: **TASK-TC-XXX: Title**. Order mixes critical path and dependency order.

### Critical path

| ID | Title | Notes |
|----|--------|------|
| **TASK-TC-001** | Restore or recreate Telegram Collector TypeScript source | ✅ Done. `src/index.ts` entry; `dist/index.legacy.js` + dist/utils, dist/services; `npm run build` / `npm run start` work. |
| **TASK-TC-002** | Remove .env session write from deploy collector login/confirm | ✅ Done. deploy/blue + deploy/green: session only in telegram_accounts. |
| **TASK-TC-003** | Add scheduled job for telegram message transfer to pipeline | ✅ Done. backend/engine/scheduler.js: startTelegramPipelineScheduler(), default 5 min; TELEGRAM_PIPELINE_INTERVAL_MS. |

### API & routing

| ID | Title | Notes |
|----|--------|------|
| **TASK-TC-004** | Document and verify Nginx location order for /api/telegram-collector | ✅ Done. `location ^~ /api/telegram-collector` in infrastructure + deploy/blue + deploy/green. |
| **TASK-TC-005** | Implement or document channels/refresh behavior | ✅ Done. Documented as ack-only; list reload is via GET collector-channels. Use "Import from Telegram" for new channels. |
| **TASK-TC-006** | Unify collector base URL handling in useDataHub and TelegramPanel | ✅ Done. api.buildCollectorUrl() in services/api.ts; used in useDataHub + TelegramPanel. |
| **TASK-TC-007** | Audit all callers of data-sources telegram endpoints for /api/v1/ prefix | ✅ Done. DATAHUB_TELEGRAM_TASKS.md + TELEGRAM_E2E_TEST_PLAN.md updated to `/api/v1/data-sources/...`. |

### Robustness & product

| ID | Title | Notes |
|----|--------|------|
| **TASK-TC-008** | Complete FloodWait handling per account (TASK-MA-030) | ✅ Done. login/start blocks if account flooded; login/start+confirm persist FloodWait via authSession.phoneNumber on confirm; 429 + retry_after_seconds; dist updated. |
| **TASK-TC-009** | Add or expose per-account messages_24h metric for Account Summary | ✅ Done. GET /api/v1/data-sources/telegram-account-metrics; TelegramPanel fetches and merges into Account Summary cards. |
| **TASK-TC-010** | Align deploy telegram-collector with root or remove deploy src | ✅ Done. BUILD_AND_DEPLOY.md §2.2: production runs root telegram-collector/dist; deploy/blue|green are thin copies. |
| **TASK-TC-011** | Define and apply auth policy for Telegram Collector HTTP API | ✅ Done. Documented in §1.2: internal-only via Nginx proxy; no auth on collector; if exposed, add auth or IP allowlist. |

### Operations & i18n

| ID | Title | Notes |
|----|--------|------|
| **TASK-TC-012** | Document VITE_TELEGRAM_COLLECTOR_URL in build and deploy | ✅ Done. BUILD_AND_DEPLOY.md §3.1. |
| **TASK-TC-013** | Align deploy scheduler URLs with data-sources mount path | ✅ Done. deploy/blue + deploy/green scheduler use `/api/v1/data-sources/...`. |
| **TASK-TC-014** | Sync Telegram Collector and Login Wizard locale keys in blue/green | ✅ Verified. deploy/blue and deploy/green locales already have the same Telegram/Collector keys (fa/en). |

### Optional / follow-up

| ID | Title | Notes |
|----|--------|------|
| **TASK-TC-015** | Add E2E test for full flow: login → add channel → sync → view messages → transfer | ✅ Done. backend/__tests__/integration/telegramCollector.test.js for telegram-sync, telegram-transfer-messages, telegram-account-metrics; full UI E2E in TELEGRAM_E2E_TEST_PLAN.md. |
| **TASK-TC-016** | Consider TASK-DHT-012 (multi-channel per DataSource) in roadmap | Already deferred; keep as optional backlog item. |

---

## 4. Summary

- **Architecture:** Telegram Collector is a separate Node service (port 3002) with multi-account support in root dist; backend handles sync (channels → data_sources) and message transfer (telegram_messages → collected_data). Frontend uses both collector and backend APIs; Nginx proxies collector under `/api/telegram-collector`.
- **Main risks (mitigated):** TASK-TC-001–007 and TASK-TC-003 done (source restored, single session store, scheduler, Nginx, URLs). TASK-TC-008–011 improve robustness and clarity.

---

**Document version:** 1.0  
**Last updated:** 2026-02-14
