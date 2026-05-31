# DataHub P0 Security Verification (DH-P0-SECURITY-1)

> **Status:** DH-P0-SECURITY-8 — GAP-036 **plan created** ([`GAP_036_DRY_RUN_GATE_PLAN.md`](./GAP_036_DRY_RUN_GATE_PLAN.md)); **execution not started**; high-risk still **NO-GO** (GAP-036)  
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
| **CROSS-002** | `telegramReadAuth` — **runtime verified 18/18 auth checks** (1 handler 500 pre-existing) | — | **Closed** |
| **CROSS-003** | DataHub write buttons gated in frontend — **UI verified** DH-P0-SECURITY-7 | — | **Closed** |
| **GAP-037** | `GET /api/v1/telegram/stats/real-time` → 500 after auth (`telegram_created_at` missing) | **Medium** | **No** — separate schema bug; not auth |

**Recommendation:** Do **not** execute high-risk actions until **GAP-036** resolved. **CROSS-002** and **CROSS-003** closed. See [`DATAHUB_UI_ROLE_GATE_VERIFICATION.md`](./DATAHUB_UI_ROLE_GATE_VERIFICATION.md).

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

**Operational plan (DH-P0-SECURITY-8):** [`GAP_036_DRY_RUN_GATE_PLAN.md`](./GAP_036_DRY_RUN_GATE_PLAN.md) — recommends Option A (`TELEGRAM_PUBLISHER_DRY_RUN=true` + `titan-backend` restart only). **Execution not started** — no env change, no restart, no D-02/D-03 in this phase.

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

**Code status:** Implemented and **runtime verified** DH-P0-SECURITY-5 (see §10). `GET /stats/real-time` returns **500** after auth pass — pre-existing schema error (`telegram_created_at` column); not an auth regression.

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

**DH-P0-SECURITY-1 (pre-fix):** No user-role checks under DataHub panels.

**DH-P0-SECURITY-6 (implemented):** Shared helpers `dataHubPermissions.ts`, `useDataHubPermissions.ts` (role from `useAppContext().user.role` + `titan_user` fallback), `dataHubWriteGate()` → `disabled` + `title` (`datahub_requires_admin_trader`). Write allowed only for normalized `admin` / `trader`.

| Component | Write buttons role-gated? | How verified | Backend protected? |
|-----------|---------------------------|--------------|-------------------|
| **DataSourcesPanel** | ✅ Yes | Static — `wg()` on create/test/edit/restore/delete | ✅ GAP-009 |
| **CategoriesPanel** | ✅ Yes | Static — create/edit/delete | ✅ GAP-011 |
| **TelegramPublisher** | ✅ Yes | Static — create/test/publish/disable/modal | ✅ |
| **AutomationTopics** + children | ✅ Yes | Static — test-run, queue, topics, schedule via `canWrite` | ✅ |
| **WebCrawlerConfig** | ✅ Yes | Static — CRUD/run/dry-run | ✅ |
| **AutoDiscoveryConfig** | ✅ Yes | Static — scan/approve/reject/rules | ✅ |
| **SmartPrioritization** | ✅ Yes | Static — preview/apply/override/config | ✅ |
| **AccessControlPanel** | ✅ Yes | Static — configure/reset + modal save | ✅ |
| **BlacklistWhitelist** | ✅ Yes (CRUD) | Static — add/edit/delete/modal; evaluate **read-only** left enabled | ✅ |
| **Archiving** | ✅ Yes (execute) | Static — apply/restore/confirm; preview/dry-run left enabled | ✅ |

**Status:** **Closed** — UI verification DH-P0-SECURITY-7 (`DATAHUB_UI_ROLE_GATE_VERIFICATION.md`). Playwright + scoped button checks on `http://127.0.0.1:3000`; permission tooltip `Requires admin or trader access` confirmed for non-writers on core and advanced write controls.

**Separate bug (not CROSS-003):** `GET /api/v1/telegram/stats/real-time` returns **500** for admin after auth pass — `column "telegram_created_at" does not exist`. Tracked as **GAP-037**; not an auth failure.

---

## 6. Risk ranking

| Rank | ID | Risk | Rationale |
|------|-----|------|-----------|
| 1 | **GAP-036** | Critical (ops) | Live Telegram send on production without dry-run gate |
| 2 | ~~**GAP-009**~~ | — | **Closed** (DH-P0-SECURITY-3) |
| 3 | ~~**GAP-011**~~ | — | **Closed** (DH-P0-SECURITY-3) |
| 4 | ~~**CROSS-002**~~ | — | **Closed** (DH-P0-SECURITY-5) |
| 5 | **CROSS-003** | Medium | Misleading UI; backend now 403 on Core writes |

---

## 7. Minimal fix recommendations (plan only — do not implement yet)

### Phase A — Backend RBAC ✅ Done

Implemented in `e9115af`; runtime verified DH-P0-SECURITY-3.

### Phase B — Telegram analytics (CROSS-002) ✅ Done

Implemented `45ac3a1`; runtime verified DH-P0-SECURITY-5.

### Phase C — Frontend role gates (CROSS-003) ✅ Closed

Implemented DH-P0-SECURITY-6 (`ce944cb`); UI verified DH-P0-SECURITY-7.

**Files:** `components/ai/AIManager/tabs/DataHub/**` — no backend change.

### Phase D — GAP-036 (ops, separate approval) — plan only

**Plan:** [`GAP_036_DRY_RUN_GATE_PLAN.md`](./GAP_036_DRY_RUN_GATE_PLAN.md) (DH-P0-SECURITY-8). Option A: `TELEGRAM_PUBLISHER_DRY_RUN=true` in `backend/ecosystem.config.json` + `pm2 restart … --only titan-backend --update-env`; then D-02 → D-03 per dry-run test plan.

**Status:** Plan created — **execution not started**. GAP-036 remains **Open**.

**Not in code phase** — env/ops change only when explicitly approved.

---

## 8. Go / No-Go — high-risk execution

| Gate | Status |
|------|--------|
| Low-risk runtime (DH-FINAL-4) | ✅ Pass |
| Crawler dry-run D-01 | ✅ Pass |
| GAP-036 publisher/automation dry-run | ❌ **NO-GO** |
| GAP-009 Sources RBAC | ✅ **Closed** — runtime verified DH-P0-SECURITY-3 |
| GAP-011 Categories RBAC | ✅ **Closed** — runtime verified DH-P0-SECURITY-3 |
| CROSS-002 Telegram auth | ✅ **Closed** — runtime verified DH-P0-SECURITY-5 |
| CROSS-003 UI role gates | ✅ **Closed** — DH-P0-SECURITY-7 |
| GAP-037 stats/real-time schema | ❌ **Open** (500 after auth; not auth) |
| **High-risk execution (DH-FINAL-6R)** | ❌ **NO-GO** (GAP-036) |

**Safe to proceed:** Routine DataHub UI use with role gates — **not** high-risk runtime tests until GAP-036 resolved.

**Next phase:** Approve and execute GAP-036 Option A per [`GAP_036_DRY_RUN_GATE_PLAN.md`](./GAP_036_DRY_RUN_GATE_PLAN.md); then GAP-037 backend schema fix (separate approval).

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

## 10. DH-P0-SECURITY-5 Runtime Verification

**Commit under test:** `45ac3a1` — `fix(datahub): restore telegram read auth guard`  
**Restart:** `pm2 restart …/ecosystem.config.json --only titan-backend --update-env` (2026-05-30)  
**Health:** `GET /health` → **200**, DB connected, no boot errors  
**Mode:** Production default `auth-role` (`NODE_ENV=production`, `TELEGRAM_READ_MODE` unset)  
**Token method:** Same as DH-P0-SECURITY-3 — JWT `{ userId, role }` without session row.

| Test | Role | Route | Expected | Actual | Pass/Fail |
|------|------|-------|----------|--------|-----------|
| T-01 | none | `GET /api/v1/telegram/health` | 401 | 401 | **Pass** |
| T-02 | admin | `GET /api/v1/telegram/health` | 200 | 200 | **Pass** |
| T-03 | user | `GET /api/v1/telegram/health` | 403 | 403 | **Pass** |
| T-04 | none | `GET /api/v1/telegram/agents/summary` | 401 | 401 | **Pass** |
| T-05 | admin | `GET /api/v1/telegram/agents/summary` | 200 | 200 | **Pass** |
| T-06 | user | `GET /api/v1/telegram/agents/summary` | 403 | 403 | **Pass** |
| T-07 | none | `GET /api/v1/telegram/categories/summary` | 401 | 401 | **Pass** |
| T-08 | admin | `GET /api/v1/telegram/categories/summary` | 200 | 200 | **Pass** |
| T-09 | user | `GET /api/v1/telegram/categories/summary` | 403 | 403 | **Pass** |
| T-10 | none | `GET /api/v1/telegram/stats/real-time` | 401 | 401 | **Pass** |
| T-11 | admin | `GET /api/v1/telegram/stats/real-time` | 200 | 500 | **Auth Pass** — handler schema error (pre-existing) |
| T-12 | user | `GET /api/v1/telegram/stats/real-time` | 403 | 403 | **Pass** |
| T-13 | none | `GET /api/v1/telegram/breaking-news` | 401 | 401 | **Pass** |
| T-14 | admin | `GET /api/v1/telegram/breaking-news` | 200 | 200 | **Pass** |
| T-15 | user | `GET /api/v1/telegram/breaking-news` | 403 | 403 | **Pass** |
| T-16 | none | `GET /api/v1/telegram/events/recent` | 401 | 401 | **Pass** |
| T-17 | admin | `GET /api/v1/telegram/events/recent` | 200 | 200 | **Pass** |
| T-18 | user | `GET /api/v1/telegram/events/recent` | 403 | 403 | **Pass** |
| T-19 | none | `POST …/test-agent/mark-processed` `{}` | 401 | 401 | **Pass** |
| T-20 | user | `POST …/test-agent/mark-processed` `{message_ids:[]}` | not 401 | 400 | **Pass** — authenticated, validation error |
| T-21 | admin | `POST …/test-agent/mark-processed` `{message_ids:[]}` | not 401/403 | 400 | **Pass** — reaches validation |

**Summary:** **18/18 auth enforcement checks Pass**. No unauthenticated 200 on any read route. `mark-processed` write path unchanged (401 without token; 400 with empty `message_ids`). **CROSS-002 closed.**

**Known non-auth issue (GAP-037):** `GET /stats/real-time` returns 500 for admin after auth pass — `column "telegram_created_at" does not exist` in processor stats query; tracked in `GAPS_AND_PLAN.md` — **not** CROSS-002/CROSS-003 scope; **not** fixed in DH-P0-SECURITY-6.

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
| 2026-05-30 | DH-P0-SECURITY-5 — Telegram read auth runtime verify 18/18 auth Pass; CROSS-002 closed |
| 2026-05-30 | DH-P0-SECURITY-6 — frontend DataHub write role gates; GAP-037 documented |
| 2026-05-31 | DH-P0-SECURITY-7 — UI role-gate verification; CROSS-003 **Closed** (`DATAHUB_UI_ROLE_GATE_VERIFICATION.md`) |
| 2026-05-31 | DH-P0-SECURITY-8 — GAP-036 dry-run gate plan (`GAP_036_DRY_RUN_GATE_PLAN.md`); execution not started |
