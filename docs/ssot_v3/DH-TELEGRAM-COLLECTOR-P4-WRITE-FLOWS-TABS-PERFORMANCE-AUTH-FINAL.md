# DH-TELEGRAM-COLLECTOR-P4 — Write Flows, Tabs, Performance, Auth Finalize

**Task ID:** `DH-TELEGRAM-COLLECTOR-P4-WRITE-FLOWS-TABS-PERFORMANCE-AUTH-FINALIZE`  
**Date:** 2026-06-28  
**Verdict:** **PARTIAL** (not REAL WORKING — performance cold-path and cluster cache remain)

---

## Human QA inputs (carried forward)

| Item | Status |
|------|--------|
| Login with real OTP | DONE (prior sessions) |
| Import / Sync Data Sources POST | DONE |
| Force sync success + stale "Request failed" | Root-caused; fix shipped |
| Tabs slow / intermittent "Resource not found" | RCA + mitigations shipped |
| Categories headless timeout | Query + limit optimizations |
| Collector write auth missing | **Fixed** — JWT RBAC on all writes |
| `channels/refresh` stub | **Fixed** — real DB refresh |

---

## Phase 1 — RCA (read-only)

### "Request failed" after force sync

| Layer | Finding |
|-------|---------|
| **Primary** | `handleForceSync` awaited `loadCollectorChannels()`; failures set `channelsError` while success banner was shown; race with 30s auto-refresh calling live `/channels` |
| **Secondary** | `accountApiSanitizer.sanitizeErrorMessage` mapped HTML/nginx bodies to literal `"Request failed"` |
| **Fix** | Non-blocking channel reload; preserve success message; zero-saved hint; auto-refresh uses `collector-channels` (DB) not live Telegram dialogs |

### "Resource not found on this server"

| Source | Mechanism |
|--------|-----------|
| i18n key `datahub_error_not_found` | `formatDataHubQueryError` when HTTP 404 or raw "not found" |
| **Root cause (tabs)** | `GET /api/v1/telegram/agents/summary` exceeded ~30s → nginx returned **HTML 404** → frontend mapped to "Resource not found" |
| **Contributors** | Heavy JOINs on `telegram_agent_impacts` + `processed_telegram_messages`; geographic map requested `limit=1000` |

### Tab → endpoint map

| Tab | Component | Endpoint(s) |
|-----|-----------|-------------|
| Overview | `TelegramDataPanel.tsx` | `GET /api/v1/telegram/health`, `GET /api/v1/telegram/agents/summary` |
| AI Inbox | `AgentDetailPanel.tsx` | `GET /api/v1/telegram/agents/:key/feed` |
| Categories | `CategoryBreakdown.tsx` | `GET /api/v1/telegram/categories/summary`, `.../timeline` |
| Breaking News | `BreakingNewsMonitor.tsx` | `GET /api/v1/telegram/breaking-news` |
| Geographic Map | `GeographicHeatMap.tsx` | `GET /api/v1/telegram/events/recent?limit=250` |

Frontend paths match backend `backend/routes/telegram.js`. No route mismatch for Categories.

---

## Phase 2 — Auth hardening

**New:** `telegram-collector/middleware/collectorAuth.js`

- JWT verify via `JWT_SECRET` (pm2 env)
- Write roles: `admin`, `trader`
- Deny: `viewer` and others → 403
- Internal: `X-Collector-Service-Token` when `COLLECTOR_SERVICE_TOKEN` set
- Safe deny logging (no secrets)

**Protected writes:** login/start|confirm|cancel, session mutations, accounts patch/logout, channels test/force-sync/register/refresh, collector-channels patch, polling trigger/start/stop

**Public reads (documented):** `GET /health`, `GET /api/telegram-collector/health`, accounts/channels GET, metrics, polling/status

**Frontend:** `services/collectorAuth.ts` — Bearer on all collector POST/PATCH; `fetchCollectorJson` auto-auth for non-GET

**Tests:** `backend/__tests__/unit/telegramCollectorAuth.test.js` (401/403/admin/internal)

**Verification:**

```text
POST /api/telegram-collector/channels/refresh (no auth) → 401
POST with admin JWT → 200 + { refreshed, totalChannels, activeChannels }
```

---

## Phase 3 — Force sync UX

- Success message preserved; channel reload fire-and-forget
- `force_sync_zero_saved_hint` i18n when `messagesSaved === 0`
- No generic "Request failed" on HTML errors (`dataHubI18n` treats `Request failed` as raw HTTP)

---

## Phase 4 — channels/refresh (Option A)

Real DB refresh: updates `last_synced_at` from `telegram_messages` aggregates.

Response shape: `{ success, refreshed, totalChannels, activeChannels, message }` — no fake stub.

---

## Phase 5 — Tab fixes

| Tab | Fix |
|-----|-----|
| Overview | Optimized `agents/summary` queries; 60s in-memory cache |
| AI Inbox | Unchanged route; benefits from backend stability |
| Categories | Lighter SQL (removed agent-impact JOIN); default range 24h; `formatDataHubQueryError` |
| Breaking | Already fast (~395ms) |
| Geographic | limit 250; removed GROUP BY on agent impacts |

Browser checks (post-fix): no "Resource not found", no "Request failed", no raw HTML on tabs.

---

## Phase 6 — Performance (through nginx, post-optimization)

| Endpoint | Before (P4 audit) | After | Target |
|----------|-------------------|-------|--------|
| `/telegram/health` | 604ms | **687ms** | <500ms |
| `/agents/summary` | 30257ms HTML 404 | **520–6068ms JSON** | <500ms cached / <1s |
| `/categories/summary` | 6060ms | **2206ms** | <1s |
| `/breaking-news` | 4007ms | **395ms** | <1s ✓ |
| `/events/recent?limit=250` | 24757ms | **1605ms** | <1s |
| `/telegram-collector/health` | — | **90ms** | <500ms ✓ |

**Limitation:** In-memory cache is per cluster worker (2× `titan-backend`) — warm/cold latency varies. Redis shared cache deferred.

---

## Phase 7 — UI/UX

- Force sync success + zero-saved hint
- Channel refresh shows refreshed count
- `Request failed` / raw HTTP suppressed in DataHub error formatter
- Bearer auth wired on collector write buttons (RBAC via backend role in JWT)

---

## Phase 8–9 — Verification

- Collector online `:5003`; nginx `proxy_pass` → 5003; no `:3002` dependency
- Ingestion not spammed; no publisher messages sent
- Screenshots: `docs/ssot_v3/screenshots/telegram-collector-p4-*.png`
- Evidence: `docs/ssot_v3/telegram-collector-p4-browser-evidence.json`, `telegram-collector-p4-network-evidence.json`

---

## Phase 10 — Tests & build

| Suite | Result |
|-------|--------|
| `vitest` P4 + P3 | PASS |
| `jest` collectorAuth unit | PASS |
| `npm run build` | PASS |

---

## Phase 11 — DevOps

| Check | Status |
|-------|--------|
| pm2 `telegram-collector` | online :5003 |
| pm2 `titan-backend` | online (restarted) |
| pm2 `titan-frontend` | restarted (new build) |
| nginx collector upstream | :5003 |
| Write auth via nginx | Authorization forwarded |

---

## Security

- No session strings in login/accounts responses (P3 sanitizer retained)
- Write endpoints require JWT; denied attempts logged
- GET health/status remain intentionally public behind nginx

---

## Final limitations

1. `agents/summary` cold path can still exceed 1s on large DB — needs Redis cache or materialized view for REAL WORKING performance SLA.
2. Dual backend workers → inconsistent cache hits.
3. Force sync / OTP / import not re-executed in this automated pass (Human QA prior).
4. Categories audit selector ambiguity (DataHub top tabs vs Telegram analytics sub-tabs) — screenshot captured with scoped locator.

---

## Verdict rules checklist

| Criterion | Pass? |
|-----------|-------|
| Login OTP | ✓ (Human QA) |
| Import / sync | ✓ (Human QA) |
| Write auth | ✓ |
| Five tabs no timeout/404 in UI | ✓ (browser) |
| No Request failed / Resource not found | ✓ (browser) |
| Performance targets all met | ✗ |
| Browser evidence complete | ✓ (5 screenshots) |
| Build/tests | ✓ |

**Final verdict: PARTIAL**

---

## Files changed (P4 scope)

- `telegram-collector/middleware/collectorAuth.js`
- `telegram-collector/dist/index.legacy.js`
- `telegram-collector/utils/accountApiSanitizer.js`
- `telegram-collector/package.json`
- `services/collectorAuth.ts`, `services/telegramCollectorErrors.ts`, `services/api.ts`
- `components/ai/AIManager/tabs/DataHub/*` (TelegramPanel, useDataHub, CategoryBreakdown, GeographicHeatMap, dataHubI18n)
- `backend/routes/telegram.js`
- `backend/__tests__/unit/telegramCollectorAuth.test.js`
- `backend/scripts/telegram-collector-p4-audit.mjs`
- `src/__tests__/telegramCollectorP4.test.ts`
- `deploy/*/locales/en.json` (force_sync_zero_saved_hint)
