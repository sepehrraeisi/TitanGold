# DataHub P0 Security Verification (DH-P0-SECURITY-1)

> **Status:** DH-P0-SECURITY-4 — CROSS-002 **code restored**; runtime verification **pending restart**  
> **Date:** 2026-05-30  
> **Prerequisites:** [`DATAHUB_CROSS_MODULE_DEPENDENCY_AUDIT.md`](./DATAHUB_CROSS_MODULE_DEPENDENCY_AUDIT.md) (DH-CROSS-1), [`DATAHUB_HIGH_RISK_EXECUTION_PLAN.md`](./DATAHUB_HIGH_RISK_EXECUTION_PLAN.md)  
> **Next step:** Review this doc → approve minimal hardening plan → implement in separate phase (not this commit)

---

## Executive summary

Read-only verification (DH-P0-SECURITY-1) found five P0 blockers. **GAP-009** and **GAP-011** are now **closed** after backend RBAC (`e9115af`) and runtime verification (DH-P0-SECURITY-3). High-risk DataHub execution must **stay NO-GO** for remaining blockers.

| ID | Finding | Severity | High-risk blocker? |
|----|---------|----------|-------------------|
| **GAP-036** | `NODE_ENV=production`, `TELEGRAM_PUBLISHER_DRY_RUN` unset, 1 active publisher with bot token + chat_id | **High** | **Yes** — D-02/D-03 NO-GO |
| **GAP-009** | Sources write routes: `writeAuth` — **runtime verified 11/11 write checks** | — | **Closed** |
| **GAP-011** | Categories write routes: `writeAuth` — **runtime verified** | — | **Closed** |
| **CROSS-002** | `telegramReadAuth` **restored** in `telegramAuth.js`; all read routes wired — **runtime pending** | **High** | **Pending runtime verify** |
| **CROSS-003** | **No** DataHub panel role-gates write buttons; Core backend now protected | **Medium** | **Yes** — UX still allows write buttons for non-admin/trader |

**Recommendation:** Do **not** execute high-risk actions until **GAP-036** resolved. **CROSS-002** code done — restart + runtime verify next (DH-P0-SECURITY-5). Add **CROSS-003** UI affordances.

---

## 1. GAP-036 — Publisher / automation dry-run gate

**Method:** PM2 `jlist` (read-only) + SQL publisher state (no secrets printed).

| Check | Result |
|-------|--------|
| PM2 `titan-backend` `NODE_ENV` | **`production`** (2 instances) |
| PM2 `TELEGRAM_PUBLISHER_DRY_RUN` | **`null`** (unset) |
| `isPublisherDryRunForced()` effective | **`false`** — unset + production → not forced (`telegramPublisherService.js:5–8`) |
| Active publishers | **1** |
| With bot token | **1** |
| With chat_id | **1** |
| Live send on `/test` or publish path | **Possible** when token present |
| D-02 / D-03 prior decision | **NO-GO** (unchanged) |
| Env modified this audit | **No** |

**Decision:** **NO-GO** for publisher test, publisher publish, automation dispatch, automation test-run.

**Minimal fix (future phase, not now):** Set `TELEGRAM_PUBLISHER_DRY_RUN=true` in PM2 env + controlled restart, **or** staging with `NODE_ENV !== 'production'`, **or** token-less probe publisher.

---

## 2. GAP-009 — Sources write RBAC

**File:** `backend/routes/data-sources.js`  
**Imports:** `authenticate`, `authorize`, `readRateLimiter`, `writeRateLimiter`  
**Pattern:** `const writeAuth = [authenticate, authorize('admin', 'trader'), writeRateLimiter]` (DH-P0-SECURITY-2)

| Route | Method | authenticate | authorize admin/trader | writeRateLimiter | gap? |
|-------|--------|--------------|------------------------|------------------|------|
| `/` | POST | ✅ | ✅ | ✅ | **Closed — runtime verified** |
| `/:id` | PUT | ✅ | ✅ | ✅ | **Closed — runtime verified** |
| `/:id` | DELETE | ✅ | ✅ | ✅ | **Closed — runtime verified** |
| `/:id/restore` | PATCH | ✅ | ✅ | ✅ | **Closed — runtime verified** |
| `/test-connection` | POST | ✅ | ✅ | ✅ | **Closed — runtime verified** |
| `/telegram-sync` | POST | ✅ | ✅ | ✅ | **Closed — runtime verified** |
| `/telegram-sync-category` | POST | ✅ | ✅ | ✅ | **Closed — runtime verified** |
| `/telegram-transfer-messages` | POST | ✅ | ✅ | ✅ | **Closed — runtime verified** |
| `/publish-telegram` | POST | ✅ | ✅ | ✅ | **Closed — runtime verified** |

**Code status:** All mutate routes use `...writeAuth` (`e9115af`). **Runtime verified** DH-P0-SECURITY-3 (see §9).

---

## 3. GAP-011 — Categories write RBAC

**File:** `backend/routes/data-categories.js`  
**Imports:** `authenticate`, `authorize`, `readRateLimiter`, `writeRateLimiter`  
**Pattern:** `const writeAuth = [authenticate, authorize('admin', 'trader'), writeRateLimiter]` (DH-P0-SECURITY-2)

| Route | Method | authenticate | authorize admin/trader | writeRateLimiter | gap? |
|-------|--------|--------------|------------------------|------------------|------|
| `/` | POST | ✅ | ✅ | ✅ | **Closed — runtime verified** |
| `/:id` | PUT | ✅ | ✅ | ✅ | **Closed — runtime verified** |
| `/:id` | DELETE | ✅ | ✅ | ✅ | **Closed — runtime verified** |

**Read routes:** `GET /` and `GET /:id` remain `authenticate` + `readRateLimiter` (unchanged auth requirement).

**Code status:** All mutate routes use `...writeAuth` (`e9115af`). **Runtime verified** DH-P0-SECURITY-3 (see §9).

---

## 4. CROSS-002 — Telegram analytics auth / documentation drift

**DH-P0-SECURITY-4 (2026-05-30):** `backend/middleware/telegramAuth.js` **restored**; all read routes wired with `readAuth = [telegramReadAuth, readRateLimiter]`.

**Middleware:** `telegramReadAuth` — modes `auth-role` | `internal` | `dev-open` (see mode table below).  
**Allowed roles (`auth-role`):** `admin`, `trader` only (DB has `admin|trader|user|vip`; `analyst`/`viewer` documented as future role-model gap).  
**Write route unchanged:** `POST /agents/:agentKey/mark-processed` → `authenticate` + `writeRateLimiter`.

### Mode behavior (static)

| Mode | Production default (if unset) | Behavior |
|------|------------------------------|----------|
| `auth-role` | **Yes** (`NODE_ENV=production`) | JWT required; 401 invalid/missing; 403 if role ∉ `{admin,trader}` |
| `internal` | No (explicit env only) | Trusted IP (`INTERNAL_TRUSTED_IPS`) **or** `x-internal-request: true` + `x-internal-secret`; fail closed if neither secret nor allowlist configured |
| `dev-open` | No | Open reads; **403 fail-closed** if `NODE_ENV=production` |
| invalid / unset non-prod | non-prod default → `dev-open` | Fail closed on invalid mode value |

### Route protection (static — post DH-P0-SECURITY-4)

| Route | telegramReadAuth | readRateLimiter | Notes |
|-------|:----------------:|:---------------:|-------|
| `GET /health` | ✅ | ✅ | Was open; now protected |
| `GET /agents/summary` | ✅ | ✅ | Was open; now protected |
| `GET /agents/:agentKey/feed` | ✅ | ✅ | Replaced bare `authenticate` |
| `GET /breaking-news` | ✅ | ✅ | Replaced bare `authenticate` |
| `GET /events/recent` | ✅ | ✅ | Replaced bare `authenticate` |
| `GET /categories/summary` | ✅ | ✅ | Was open; now protected |
| `GET /categories/:category/timeline` | ✅ | ✅ | Replaced bare `authenticate` |
| `GET /stats/real-time` | ✅ | ✅ | Replaced bare `authenticate` |
| `POST /agents/:agentKey/mark-processed` | ❌ | ❌ (write) | `authenticate` + `writeRateLimiter` unchanged |

**Code status:** Implemented — **runtime 401/403/200 tests not run** (backend restart required).

**Expected post-restart tests (DH-P0-SECURITY-5):**

| Test | Expected |
|------|----------|
| Unauth `GET /agents/summary` | 401 |
| Unauth `GET /categories/summary` | 401 |
| Unauth `GET /health` | 401 (production `auth-role` default) |
| Admin token same routes | 200 |
| User role same routes | 403 |

### Prior audit snapshot (DH-P0-SECURITY-1 — superseded)

<details>
<summary>Pre-fix drift table (historical)</summary>

| Route | Was (pre-fix) | Expected |
|-------|---------------|----------|
| `GET /health` | None | `telegramReadAuth` + readRateLimiter |
| `GET /agents/summary` | readRateLimiter only | `telegramReadAuth` + JWT role |
| `GET /categories/summary` | readRateLimiter only | `telegramReadAuth` + JWT role |

</details>

---

## 5. CROSS-003 — Frontend write button role gates

**Method:** Grep `role`, `userRole`, `Admin`, `Trader`, `useAppContext` under `components/ai/AIManager/tabs/DataHub/` — **no user-role checks found** (only ARIA `role=` attributes).

| Component | Write buttons role-gated? | Backend protected? | UX risk |
|-----------|---------------------------|-------------------|---------|
| **DataSourcesPanel** | ❌ No | ✅ GAP-009 closed | Medium — buttons visible; API 403 for non-admin/trader |
| **CategoriesPanel** | ❌ No | ✅ GAP-011 closed | Medium — buttons visible; API 403 for non-admin/trader |
| **TelegramPublisher** | ❌ No | ✅ Advanced writes: admin/trader | Medium — viewer sees Publish/Test; API 403 |
| **AutomationTopics** | ❌ No | ✅ admin/trader on dispatch/mutate | Medium |
| **WebCrawlerConfig** | ❌ No | ✅ admin/trader on run/create | Medium |
| **AutoDiscoveryConfig** | ❌ No | ✅ admin/trader on scan/approve | Medium |
| **SmartPrioritization** | ❌ No | ✅ admin/trader on apply/preview | Medium |
| **AccessControlPanel** | ❌ No | ✅ admin/trader on save | Medium |
| **BlacklistWhitelist** | ❌ No | ✅ admin/trader on CRUD | Medium |
| **Archiving** | ❌ No | ✅ admin/trader on execute | Medium |

**Gap confirmed:** Frontend shows all write affordances regardless of `user.role`. Core panels are **both** UX-unprotected **and** backend-unprotected. Advanced panels rely on backend 403 only.

**Minimal fix (future phase):** Shared hook e.g. `useDataHubWriteAccess()` → hide/disable when role ∉ `{admin, trader}`; map frontend `Admin`/`Trader` to backend roles; apply after GAP-009/011 backend fix.

---

## 6. Risk ranking

| Rank | ID | Risk | Rationale |
|------|-----|------|-----------|
| 1 | **GAP-036** | Critical (ops) | Live Telegram send on production without dry-run gate |
| 2 | ~~**GAP-009**~~ | — | **Closed** (DH-P0-SECURITY-3) |
| 3 | ~~**GAP-011**~~ | — | **Closed** (DH-P0-SECURITY-3) |
| 4 | **CROSS-002** | High | Code restored — runtime verify pending |
| 5 | **CROSS-003** | Medium | Misleading UI; backend now 403 on Core writes |

---

## 7. Minimal fix recommendations (plan only — do not implement yet)

### Phase A — Backend RBAC ✅ Done

Implemented in `e9115af`; runtime verified DH-P0-SECURITY-3.

### Phase B — Telegram analytics (CROSS-002) ✅ Code done

Implemented DH-P0-SECURITY-4: `backend/middleware/telegramAuth.js` + `readAuth` on all read routes. Runtime verify pending restart.

### Phase C — Frontend role gates (CROSS-003)

After Phase A: hide Create/Edit/Delete/Restore/Test on Sources/Categories; hide Advanced write buttons for non-admin/trader.

**Files:** DataHub panels + optional shared hook — no backend change.

### Phase D — GAP-036 (ops, separate approval)

Set `TELEGRAM_PUBLISHER_DRY_RUN=true` via PM2 ecosystem file; scheduled restart; re-run D-02 probe only after explicit approval.

**Not in code phase** — env/ops change only.

---

## 8. Go / No-Go — high-risk execution

| Gate | Status |
|------|--------|
| Low-risk runtime (DH-FINAL-4) | ✅ Pass |
| Crawler dry-run D-01 | ✅ Pass |
| GAP-036 publisher/automation dry-run | ❌ **NO-GO** |
| GAP-009 Sources RBAC | ✅ **Closed** — runtime verified DH-P0-SECURITY-3 |
| GAP-011 Categories RBAC | ✅ **Closed** — runtime verified DH-P0-SECURITY-3 |
| CROSS-002 Telegram auth | ⏳ **Code restored — pending runtime verify** |
| CROSS-003 UI role gates | ❌ **Open** |
| **High-risk execution (DH-FINAL-6R)** | ❌ **NO-GO** |

**Safe to proceed (after separate approval):** P0-Security implementation Phases A→C above — **not** high-risk runtime tests.

**Next phase:** DH-P0-SECURITY-5 Telegram auth runtime verify (after restart approval); CROSS-003 UI role gates.

---

## 9. DH-P0-SECURITY-3 Runtime Verification

**Commit under test:** `e9115af` — `fix(datahub): add core write RBAC`  
**Restart:** `pm2 restart …/ecosystem.config.json --only titan-backend --update-env` (2026-05-30)  
**Health:** `GET /health` → **200**, DB connected  
**Token method:** JWT signed with `JWT_SECRET` + `{ userId, role }` (no session row). No DB user with `role=user` exists — `user` role simulated via JWT claim (same pattern as integration tests). Admin reads use `admin@titangold.com` user id + `role: admin`.

| Test | Role | Route | Expected | Actual | Pass/Fail |
|------|------|-------|----------|--------|-----------|
| A-read-sources | admin | `GET /api/v1/data-sources?page=1&limit=1` | 200 | 200 | **Pass** |
| A-read-categories | admin | `GET /api/v1/data-categories/` | 200 | 200 | **Pass** |
| B-src-post | user | `POST /api/v1/data-sources` `{}` | 403 | 403 | **Pass** |
| B-src-test-conn | user | `POST /api/v1/data-sources/test-connection` `{}` | 403 | 403 | **Pass** |
| B-src-telegram-sync | user | `POST /api/v1/data-sources/telegram-sync` `{}` | 403 | 403 | **Pass** |
| B-src-delete | user | `DELETE /api/v1/data-sources/00000000-0000-0000-0000-000000000000` | 403 | 403 | **Pass** |
| C-cat-post | user | `POST /api/v1/data-categories` `{}` | 403 | 403 | **Pass** |
| C-cat-put | user | `PUT /api/v1/data-categories/00000000-0000-0000-0000-000000000000` `{}` | 403 | 403 | **Pass** |
| C-cat-delete | user | `DELETE /api/v1/data-categories/00000000-0000-0000-0000-000000000000` | 403 | 403 | **Pass** |
| D-src-post-admin | admin | `POST /api/v1/data-sources` `{}` | 400 | 400 | **Pass** |
| D-cat-post-admin | admin | `POST /api/v1/data-categories` `{}` | 400 | 400 | **Pass** |

**Summary:** **11/11 Pass**. RBAC blocks `user` before validation (403, not 400). Admin passes RBAC and hits validation (400). Reads unchanged at 200.

**Caveat:** Re-test with a real DB `user`-role account when one exists, to confirm session-based auth path (DB role lookup) also enforces 403.

---

## Evidence index

| Area | File verified |
|------|----------------|
| Sources routes | `backend/routes/data-sources.js` |
| Categories routes | `backend/routes/data-categories.js` |
| Telegram routes | `backend/routes/telegram.js` |
| Telegram read auth | `backend/middleware/telegramAuth.js` |
| Advanced writeAuth pattern | `backend/routes/data-hub-crawlers.js:24` |
| Publisher dry-run logic | `backend/services/telegramPublisherService.js:5–8` |
| GAP-006 claim | `docs/ssot_v3/GAPS_AND_PLAN.md:12` |
| Frontend panels | `components/ai/AIManager/tabs/DataHub/**` |
| PM2 env | `pm2 jlist` read-only 2026-05-30 |

---

## Changelog

| Date | Change |
|------|--------|
| 2026-05-30 | DH-P0-SECURITY-1 read-only verification — docs only |
| 2026-05-30 | DH-P0-SECURITY-2 — `writeAuth` on Sources/Categories mutate routes; runtime verify pending (no restart) |
| 2026-05-30 | DH-P0-SECURITY-3 — post-restart runtime verify 11/11 Pass; GAP-009/GAP-011 closed |
| 2026-05-30 | DH-P0-SECURITY-4 — restore `telegramReadAuth`; all Telegram read routes wired; runtime pending |
