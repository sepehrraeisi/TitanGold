# DataHub Browser Smoke — DH-SMOKE-1

> **Phase:** DH-SMOKE-1 (read-only browser smoke after GAP-037 closure)  
> **Date:** 2026-06-01  
> **Target:** `https://titan.zala.ir` (production UI + API via Nginx → `titan-backend`)  
> **Code under test:** `559c0e5` (GAP-037 query fix), `39e6622` (runtime verification docs)  
> **Method:** Playwright headless (`tmp-dh-smoke-1.mjs`, not committed); JWT session inject (same pattern as DH-P0-SECURITY-5 API tests — no secrets logged)

---

## Executive summary

| Result | Detail |
|--------|--------|
| **DataHub load** | **Pass** — AI Center → AI Manager → Data Hub opens without crash |
| **Main + advanced tabs** | **16/16 Pass** |
| **Telegram analytics panel** | **Pass** — metrics render; `/api/v1/telegram/health` and `/agents/summary` → **200** |
| **GAP-037 UI path** | UI does **not** call `GET /api/v1/telegram/stats/real-time`; panel uses `/health` + `/agents/summary` (both **200**, no schema error) |
| **Network (DataHub APIs)** | **0** failures (4xx/5xx) on captured `/api/v1/data-sources|data-categories|data-hub|telegram` calls |
| **Mock leakage** | **Pass** — no `75.0%` cache-hit mock; no `column "telegram_created_at"` in UI |
| **Role gates (this run)** | **Not re-verified** — harness timed out locating `Add Source` after role inject; prior **DH-P0-SECURITY-7** remains authoritative |
| **Merge readiness** | **Ready for Merge Readiness Review** with notes below |

---

## Smoke matrix

### Core DataHub tabs

| Tab | Pass/Fail | Notes |
|-----|-----------|-------|
| Sources | **Pass** | `GET /api/v1/data-sources` 200 |
| Categories | **Pass** | `GET /api/v1/data-categories/` 200 |
| Pipeline | **Pass** | `GET /api/v1/data-sources/pipeline` 200 |
| Health | **Pass** | `GET /api/v1/data-sources/health`, `/stats`, `/state` 200 |
| Access Logs | **Pass** | `GET /api/v1/data-sources/access-logs` 200 |
| Advanced | **Pass** | Subtabs reachable |
| Telegram Collector | **Pass** | Analytics metrics + API 200 |

### Advanced subtabs

| Subtab | Pass/Fail | Backend call (sample) |
|--------|-----------|------------------------|
| Web Crawlers | **Pass** | `GET /api/v1/data-hub/crawlers` 200 |
| Auto Discovery | **Pass** | `GET …/discovery/suggestions`, `/stats`, `/rules` 200 |
| Smart Prioritization | **Pass** | `GET …/prioritization/sources`, `/runs`, `/settings` 200 |
| Access Control | **Pass** | `GET /api/v1/data-hub/access-control/` 200 |
| Blacklist/Whitelist | **Pass** | `GET /api/v1/data-hub/filter-rules` 200 |
| Telegram Publisher | **Pass** | `GET /api/v1/data-hub/telegram-publishers/` 200 |
| Automation | **Pass** | `GET /api/v1/data-hub/automation/overview` 200 |
| Data Archiving | **Pass** | `GET …/archiving/records`, `/stats` 200 |
| Pipeline Health Overview | **Pass** | Uses `/data-sources/health` + `/stats` (embedded in Advanced) |

### Telegram analytics subtabs

| Subtab | Pass/Fail | Notes |
|--------|-----------|-------|
| Overview | **Pass** | Default view; health metrics visible |
| Agents | **Pass** | `GET /api/v1/telegram/agents/summary?timeRange=24` 200 |
| Categories | **Pass** (DH-MERGE-READINESS-1) | Was inconclusive in DH-SMOKE-1; fixed via scoped `Telegram analytics` tablist |
| Breaking News | **Pass** (DH-MERGE-READINESS-1) | `GET /api/v1/telegram/breaking-news` 200 |
| Geographic Map | **Pass** (DH-MERGE-READINESS-1) | Panel renders; map uses `events/recent` (lazy) |

Superseded inconclusive items: `DATAHUB_MERGE_READINESS_REVIEW.md`.

---

## GAP-037 / Telegram stats

| Check | Result |
|-------|--------|
| `GET /api/v1/telegram/stats/real-time` from UI | **Not called** (no frontend reference) |
| `GET /api/v1/telegram/health` | **200** (×2 during smoke) |
| `GET /api/v1/telegram/agents/summary` | **200** |
| Missing-column error in UI | **None** |
| DH-BUGFIX-2 backend fix | **Closed** — endpoint verified separately |

---

## Network & console (DataHub-relevant)

- **Failures:** none on DataHub API paths during smoke.
- **Console (DataHub-filtered):** no DataHub/Telegram-specific errors captured during successful run.
- **Unrelated noise (ignored):** trading-engine 401, WebSocket errors on global header (outside DataHub scope).

### Sample successful API paths

- `/api/v1/data-sources`, `/data-categories`, `/data-sources/pipeline`, `/health`, `/stats`, `/state`, `/access-logs`
- `/api/v1/data-hub/crawlers`, `/discovery/*`, `/prioritization/*`, `/access-control/`, `/filter-rules`, `/telegram-publishers/`, `/automation/overview`, `/archiving/*`
- `/api/v1/telegram/health`, `/telegram/agents/summary`

---

## Backend-first / no mock production data

| Check | Result |
|-------|--------|
| Primary CRUD/lists via React Query + `/api/v1/*` | **Pass** (network capture) |
| IndexedDB fallback presented as live data | **Not observed** |
| Fake cache hit `75.0%` | **Not present** |
| `NaN` / raw `undefined` in tab bodies | **Not present** |

---

## Role gates

DH-SMOKE-1: role inject timed out on `Add Source` locator. **DH-MERGE-READINESS-1:** 5/5 Pass (admin, trader, user, vip, viewer). **CROSS-003** remains closed.

---

## Dependencies & cross-module

| Dependency | Impact on smoke |
|------------|-----------------|
| **Auth / JWT** | Required; inject used for read-only navigation |
| **PostgreSQL** | All list endpoints returned 200 |
| **PM2 `titan-backend`** | Serving API (post GAP-037 restart) |
| **Nginx / TLS** | `titan.zala.ir` → backend proxy OK |
| **Redis** | Not directly exercised; no failure signal |
| **Settings** | Not in scope; no blocker |
| **`TELEGRAM_PUBLISHER_DRY_RUN`** | Unchanged; no publish/dispatch clicked |
| **telegram-collector** | Not restarted; collector tab read-only |

---

## Constraints honored

- No new features, redesign, env change, migration, live publish/dispatch, or dry-run flag change.
- Read-only navigation only (no write clicks).

---

## Recommendation

**Merge readiness completed** — see `DATAHUB_MERGE_READINESS_REVIEW.md` (**Ready to merge** with non-blocking notes).

**Non-blocking follow-ups:**

1. Optional UI wiring for `GET /stats/real-time` if product wants that aggregate (currently unused).
2. Monitor rare transient 404 on `agents/summary` during fast tab switches (curl re-test: 200).
