# DH-TELEGRAM-COLLECTOR-P1 — Comprehensive RCA & Repair Plan

Date: 2026-06-28  
Task: `DH-TELEGRAM-COLLECTOR-P1-COMPREHENSIVE-RCA-AND-REPAIR-PLAN`  
Branch: `feat/gap-008-sources-backend-wiring` (read-only audit; no commits in P1)  
Human QA URL: `https://titan.zala.ir`  
Design reference: [`DESIGN_SYSTEM_DATAHUB.md`](../../DESIGN_SYSTEM_DATAHUB.md)

---

## 1. Executive Summary

Human QA reports **Telegram Collector UI is broken** with **Critical** status, failed accounts/channels loads, and a health banner showing **raw nginx HTML 404** bodies.

**Root cause (confirmed):** The Telegram Collector **microservice is healthy and ingesting on port 5003**, but **nginx proxies `/api/telegram-collector/*` to port 3002**, where **nothing is listening**. The UI receives nginx HTML 404 pages instead of JSON.

This is **not** a frontend route typo, **not** a stale production bundle, and **not** a missing backend route in the collector service itself. It is a **DevOps/nginx port mismatch** — structurally similar to the Data Archiving stale-`dist` issue, but here the failure mode is **wrong upstream port**, not stale JS.

**Secondary issues for P2:**
- UI renders raw HTML error snippets in the diagnose banner (`check.error` from `res.text()`).
- Collector GET endpoints are **unauthenticated** and may expose sensitive fields (e.g. `session_string` on accounts) when reached directly.
- High PM2 restart count (594) on `telegram-collector` — service currently stable but warrants monitoring.

**Ingestion is NOT broken:** messages and `collected_data` continue to flow (2,251 messages / 7,200 collected rows in the last hour).

---

## 2. Current Verdict

### **NGINX ROUTE BROKEN — BACKEND COLLECTOR HEALTHY / FRONTEND BROKEN**

| Layer | Status |
|-------|--------|
| Telegram Collector microservice (`:5003`) | **Healthy** — health/accounts/channels 200 |
| nginx → `:3002` proxy | **Broken** — connection refused → HTML 404 |
| Production UI (accounts/channels/health) | **Broken** — 404 HTML |
| Main backend `/api/v1/telegram/*` (overview feed) | **Healthy** — 200 via nginx |
| DB ingestion | **Healthy** — active polling, recent sync timestamps |
| Data Pipeline read path | **Healthy** — stats/breaking-news/categories 200 |

**Not REAL WORKING** for operator-facing Telegram Collector UI on production.

---

## 3. Exact Failing Endpoints

### Production (`https://titan.zala.ir`)

| Request | Method | Status | Content-Type | Body |
|---------|--------|--------|--------------|------|
| `/api/telegram-collector/health` | GET | **404** | `text/html` | nginx `<h1>404 Not Found</h1>` |
| `/api/telegram-collector/session/status` | GET | **404** | `text/html` | nginx HTML |
| `/api/telegram-collector/accounts` | GET | **404** | `text/html` | nginx HTML |
| `/api/telegram-collector/collector-channels` | GET | **404** | `text/html` | nginx HTML |

Browser network (DataHub → Telegram Collector tab): accounts + collector-channels → **404 text/html**.

### Direct microservice (`http://127.0.0.1:5003`)

| Request | Status | Notes |
|---------|--------|-------|
| `/api/telegram-collector/health` | **200** | `status: healthy`, MTProto enabled |
| `/api/telegram-collector/session/status` | **200** | JSON (session metadata only) |
| `/api/telegram-collector/accounts` | **200** | 2 accounts |
| `/api/telegram-collector/collector-channels` | **200** | 45 channels, recent `lastSyncedAt` today |

### Wrong port (`http://127.0.0.1:3002`)

| Request | Status |
|---------|--------|
| All collector paths | **Connection refused** (nothing listening) |

### Main backend feed (separate from collector UI)

| Request | nginx | `:5002` direct |
|---------|-------|----------------|
| `/api/v1/telegram/health` | 200 | 200 |
| `/api/v1/telegram/stats/real-time` | 200 | 200 |
| `/api/v1/telegram/breaking-news` | 200 | 200 |
| `/api/v1/telegram/categories/summary` | 200 | 200 |

---

## 4. Root Cause Analysis

### Primary: nginx upstream port mismatch (Category **D** + **E**)

```
Browser → https://titan.zala.ir/api/telegram-collector/*
       → nginx location proxy_pass http://127.0.0.1:3002
       → connection refused (no listener)
       → nginx returns HTML 404 page
```

Evidence:
- `ss -tlnp`: **no process on :3002**; `telegram-collector` PID listens on **:5003**
- `telegram-collector/.env`: `PORT=3002` (expected)
- `pm2 env telegram-collector`: **`PORT: 5003`** (runtime override)
- `/etc/nginx/sites-enabled/titan-zala`: `proxy_pass http://127.0.0.1:3002`
- `infrastructure/nginx.conf`: same `:3002` upstream

**Why UI shows HTML:** `diagnoseTelegramCollector()` uses `(await res.text()).slice(0, 80)` on failure — nginx HTML is surfaced verbatim in the banner.

### Ruled out

| Hypothesis | Result |
|------------|--------|
| A. Frontend old endpoint path | **No** — paths match collector service (`/api/telegram-collector/accounts`, `/collector-channels`) |
| B. Backend route renamed | **No** — routes exist in `telegram-collector/dist/index.legacy.js` |
| C. v1 router not mounting collector | **N/A** — collector is a **separate microservice**, not under `/api/v1` |
| F. Stale frontend bundle | **No** — production `DataHubTab-*.js` calls same relative paths; issue reproduces on live network |
| G. Auth misreported as 404 | **No** — 404 is nginx HTML, not 401/403 JSON |

---

## 5. Frontend / Backend Route Mismatch Table

| Frontend call | Expected handler | Backend exists? | Production result |
|---------------|------------------|-----------------|-------------------|
| `GET /api/telegram-collector/health` | collector `:5003` | Yes | **404** (nginx→3002) |
| `GET /api/telegram-collector/session/status` | collector | Yes | **404** |
| `GET /api/telegram-collector/accounts` | collector | Yes | **404** |
| `GET /api/telegram-collector/collector-channels` | collector | Yes | **404** |
| `GET /api/telegram-collector/channels` | collector (legacy list) | Yes | **404** via nginx |
| `POST /api/v1/data-sources/telegram-sync` | titan-backend `:5002` | Yes | Not tested (write — P1 skip) |
| `GET /api/v1/telegram/stats/real-time` | `backend/routes/telegram.js` | Yes | **200** |
| `GET /api/v1/telegram/breaking-news` | backend | Yes | **200** |

**Mismatch type:** infra port mapping, not API contract rename.

---

## 6. Phase 0 — Git Safety

- Branch: `feat/gap-008-sources-backend-wiring`
- Many unrelated dirty files in workspace (DataHub modules, locales, etc.) — **none modified for this RCA**
- **No code commits in P1**
- **No DB writes, no login, no import, no sync POST**

---

## 7. Frontend Audit

### Component / hook / API files

| File | Role |
|------|------|
| `components/ai/AIManager/tabs/DataHub/TelegramPanel.tsx` | Main Collector UI — accounts, channels, health, login wizard |
| `components/ai/AIManager/tabs/DataHub/TelegramDataPanel.tsx` | Overview / AI Inbox / Categories / Breaking / Map (uses `/api/v1/telegram`) |
| `components/ai/AIManager/tabs/DataHub/hooks/useDataHub.ts` | Health refresh, diagnose, collector state |
| `components/ai/AIManager/tabs/DataHubTab.tsx` | Tab wiring → `TelegramPanel` + `TelegramDataPanel` |
| `services/api.ts` | `buildCollectorUrl`, `getTelegramCollectorHealth`, `diagnoseTelegramCollector`, login helpers |
| `vite.config.ts` | Dev proxy `/api/telegram-collector` → `localhost:3002` |

### URL resolution

- `VITE_TELEGRAM_COLLECTOR_URL` empty on production → relative paths `/api/telegram-collector/*` (correct for nginx proxy **if upstream were correct**).
- UI displays: `Service URL: /api/telegram-collector (proxied)`

### Error handling gaps

1. **`diagnoseTelegramCollector`** — embeds first 80 chars of failed response body → **raw HTML 404** shown to users.
2. **`loadAccounts` / `loadCollectorChannels`** — generic `Failed to load … (404)` without distinguishing nginx vs API JSON errors.
3. **`combinedCollectorHealth`** — derived from local IndexedDB snapshot (`online`/`degraded`), decoupled from live health when collector unreachable → shows **Critical** when channels empty + errors.

### Action mapping (not executed in P1)

| UI action | Handler | Endpoint | Method | Read/Write | Safe in P1? | Mutates data? |
|-----------|---------|----------|--------|------------|-------------|---------------|
| Refresh health | `handleCollectorHealth` | `/api/telegram-collector/health` | GET | Read | Yes | No |
| Diagnose endpoints | `handleDiagnoseCollector` | health + session/status | GET | Read | Yes | No |
| Start Login Wizard | `handleStartCollectorLogin` | `/login/start` | POST | Write | **No** | Yes — session |
| Confirm login | `handleConfirmCollectorLogin` | `/login/confirm` | POST | Write | **No** | Yes |
| Sync Data Sources | `handleSyncTelegramDataSources` | `/api/v1/data-sources/telegram-sync` | POST | Write | **No** | Yes — data_sources |
| Add Account / Import | TelegramPanel modals | `/channels`, `/channels/register` | GET/POST | Mixed | **No** | Yes |
| Refresh channels | `handleRefreshCollectorChannels` | `/channels/refresh` | POST | Write | **No** | Yes |
| Force sync channel | per-channel | `/channels/:id/force-sync` | POST | Write | **No** | Yes |
| Overview refresh | TelegramDataPanel | `/api/v1/telegram/stats/real-time` | GET | Read | Yes | No |
| Time range tabs | CategoryBreakdown etc. | `/api/v1/telegram/*` | GET | Read | Yes | No |

### Shared APIs with other modules

- **Telegram Publisher:** separate routes (`/api/v1/telegram-publishers/*`) — no collision found.
- **Data Pipeline:** reads processed/collected data via main backend — **still working**.
- **Data Sources:** sync bridge via `POST /api/v1/data-sources/telegram-sync` (main backend).

---

## 8. Backend Route Audit (Collector Microservice)

Source: `telegram-collector/dist/index.legacy.js` (runtime bundle).

| Method | Path | Auth | Side effects |
|--------|------|------|--------------|
| GET | `/api/telegram-collector/health` | Rate limit only | None |
| GET | `/api/telegram-collector/session/status` | Rate limit | None |
| GET | `/api/telegram-collector/accounts` | Rate limit | None (returns account list) |
| GET | `/api/telegram-collector/collector-channels` | Rate limit | None |
| POST | `/api/telegram-collector/login/start` | auth rate limit | Starts MTProto login |
| POST | `/api/telegram-collector/channels/register` | moderate | Registers channels |
| POST | `/api/telegram-collector/channels/:id/force-sync` | moderate | Triggers sync |
| GET | `/api/telegram-collector/polling/status` | lenient | Read |

**Not mounted on titan-backend** — by design (standalone service on `:5003`).

Main backend telegram feed: `backend/routes/telegram.js` under `/api/v1/telegram/*` — **separate concern** (AI inbox / analytics).

---

## 9. Service / Worker Audit

| Process | pm2 status | Port | Notes |
|---------|------------|------|-------|
| `telegram-collector` | online (594 restarts) | **5003** | HTTP API + MTProto polling |
| `telegram-collector-monitor` | online | — | Polls `:3002` in script config (**also wrong port**) |
| `telegram-processor` | online | — | Downstream processing |
| `titan-backend` | online | 5002 | `/api/v1/telegram` feed |

**Is ingestion working?** **Yes.**
- Channel `lastSyncedAt` timestamps within minutes (2026-06-28)
- `telegram_messages`: 2,251 rows last 1h; 30,543 last 24h
- `collected_data`: 7,200 rows last 1h (telegram-linked sources)

**Did Publisher redesign break Collector?** **No direct evidence.** Publisher uses different API surface; collector routes unchanged; ingestion active.

**Did Access Control block Collector?** **No** — collector bypasses DataHub RBAC (separate service). Security concern for P2 hardening.

---

## 10. Database Audit (Read-Only)

| Table | Row count | Notes |
|-------|-----------|-------|
| `telegram_accounts` | 2 | DB-backed accounts |
| `telegram_channels` | 45 (43 active) | Last sync today |
| `telegram_messages` | 5,416,528 | 2,251 / 1h |
| `collected_data` | 4,078,496 | 7,200 / 1h |
| `data_sources` | 55 | Includes telegram-linked |
| `data_hub_logs` | 28,397 | — |

**Conclusion:** Data layer healthy; failure is **UI/API reachability**, not ingestion stall.

---

## 11. DevOps / nginx / PM2

| Item | Value |
|------|-------|
| nginx root (frontend) | `/home/ubuntu/webapp/TitanGold/dist` |
| Collector proxy | `location ^~ /api/telegram-collector/` → `127.0.0.1:3002` |
| Actual collector listen | `*:5003` |
| `.env PORT` | 3002 |
| pm2 runtime `PORT` | **5003** |
| `:3002` listener | **None** |

**Stale bundle check:** Production bundle uses relative `/api/telegram-collector/*` — same as source. **Not a stale JS issue.**

**Version mismatch:** nginx config expects `:3002`; runtime service on `:5003` (likely pm2 env drift or port conflict workaround).

---

## 12. Security Audit (Read-Only)

| Topic | Finding |
|-------|---------|
| Session/credentials in UI | Login wizard collects phone/code — not tested |
| Collector GET auth | **No JWT** on `/accounts`, `/collector-channels` when reached directly |
| Sensitive fields | Accounts API can include **`session_string`** — must not expose via public nginx; mask in P2 |
| Error leakage | **Raw nginx HTML** shown in UI diagnose banner |
| RBAC | Main backend telegram feed requires auth; collector microservice largely open on local network |
| ACL / Filter Rules | Do not gate collector HTTP API |
| Publisher credential sharing | No evidence of shared bot tokens in collector routes |

No secrets reproduced in this document.

---

## 13. Browser Evidence

| Artifact | Path |
|----------|------|
| JSON evidence | [`screenshots/telegram-collector-p1-browser-evidence.json`](./screenshots/telegram-collector-p1-browser-evidence.json) |
| Screenshot | [`screenshots/telegram-collector-p1-current.png`](./screenshots/telegram-collector-p1-current.png) |

Observed in browser:
- Collector Status: **Critical**
- **Failed to load accounts (404)**
- **Failed to load channels (404)**
- Health banner with **Endpoint issue (status=404, `<html>...`)**
- Network: `/api/telegram-collector/accounts` → 404 text/html

Audit script (read-only, uncommitted): `backend/scripts/telegram-collector-p1-browser-audit.mjs`

---

## 14. Cross-Module Dependency Audit

| Dependency | Status | Recent change risk |
|------------|--------|-------------------|
| Data Sources | Sync POST on main backend | Low for 404 issue |
| Data Pipeline | **Working** — stats 200 | Performance P2/P3 may affect latency, not 404 |
| Telegram Publisher | Separate API | No route collision |
| Access Control | Main backend only | Does not block collector proxy |
| Filter Rules | Main backend | No impact on collector 404 |
| Automation / Notifications | Unrelated paths | No evidence of collision |
| Redis/cache | Collector uses rate limit redis | Service healthy on :5003 |
| nginx/pm2 deploy | **High risk — port drift** | **Primary root cause** |

**Answers:**
1. Publisher redesign broke Collector? **No** (ingestion + routes intact).
2. Pipeline changes broke Collector? **No** (feed endpoints 200).
3. ACL/Filter blocked Collector? **No**.
4. Route name collision? **No**.
5. Collector still writes `collected_data`? **Yes** (7,200/hour).
6. Pipeline still reads Collector data? **Yes** (`/api/v1/telegram/*` 200).

---

## 15. Design System Audit

Reference: `DESIGN_SYSTEM_DATAHUB.md` (Telegram Collector is the design reference tab).

| Criterion | Compliance | Notes |
|-----------|------------|-------|
| Layout / cards / spacing | **PASS** | Structure matches design system |
| Semantic badges | **PARTIAL** | Critical badge correct for failure, but misleading (service actually healthy) |
| Error states | **FAIL** | Raw HTML in banner |
| Loading states | **PASS** | Present |
| Empty states | **N/A** | Blocked by 404 before empty |
| Accessibility | **PARTIAL** | Error text unreadable (HTML) |
| Dark theme | **PASS** | — |

**P2 redesign requirements:** Keep existing layout; fix error normalization, endpoint health card (no raw HTML), clear Collector vs Publisher distinction, recovery CTA (“Service unreachable — check proxy/port”).

---

## 16. P2 Repair Plan

### A. Route / infra repair (P0 fix)

1. **Align ports** — pick single source of truth (`3002` per `.env` and nginx **OR** update nginx + vite proxy + monitor script to `5003`).
2. Recommended: set `pm2` `PORT=3002` for `telegram-collector` **or** change nginx `proxy_pass` to `127.0.0.1:5003`.
3. Verify: `curl https://titan.zala.ir/api/telegram-collector/health` → JSON 200.
4. Update `telegram-collector-monitor` `collectorBaseUrl` if port changes.

### B. Frontend error handling

1. Detect `content-type: text/html` → show “Collector proxy unreachable” instead of HTML snippet.
2. Map 404/502 to structured i18n keys.
3. Optional: health poll against relative path with retry/backoff.

### C. Security hardening

1. Add auth or network restriction on collector admin routes via nginx or middleware.
2. **Never return `session_string`** in accounts list API responses to browsers.
3. Mask phone/session metadata in UI.

### D. Endpoint health normalization

1. Diagnose panel: show per-endpoint JSON status, latency, upstream hint.
2. Separate **Collector microservice** vs **Telegram feed API** health in UI.

### E. Design-system polish (after infra fix)

1. Human-readable error recovery panel.
2. Distinguish ingestion healthy vs UI/API path broken.

### F. Verification checklist

- [ ] nginx + direct + browser: health, accounts, channels 200 JSON
- [ ] No raw HTML in UI
- [ ] Accounts/channels render (2 accounts, 45 channels expected)
- [ ] `/api/v1/telegram/stats/real-time` still 200 (no regression)
- [ ] Data Pipeline / Publisher smoke test

### G. Scoped commit plan (P2)

- `infrastructure/nginx.conf` and/or pm2 ecosystem PORT
- Optional: `TelegramPanel.tsx` / `useDataHub.ts` error handling
- Optional: collector accounts response sanitization
- SSOT P2 verify doc + screenshots
- **Do not** bundle unrelated dirty files

---

## 17. Performance Notes (GET only)

| Endpoint | nginx latency (sample) |
|----------|------------------------|
| `/api/v1/telegram/health` | ~3.6s |
| `/api/v1/telegram/stats/real-time` | ~8.5s |
| `/api/v1/telegram/breaking-news` | ~0.5s |
| Collector paths via nginx | N/A (404 immediate) |
| Collector `:5003` health | <100ms |

Pipeline stats slowness is a separate concern; not the cause of Collector 404.

---

Telegram Collector remains **NGINX ROUTE BROKEN — BACKEND COLLECTOR HEALTHY / FRONTEND BROKEN**. No code or DB changes were made in P1.
