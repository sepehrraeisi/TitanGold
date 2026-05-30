# DataHub P0 Security Verification (DH-P0-SECURITY-1)

> **Status:** DH-P0-SECURITY-2 — backend RBAC **implemented in code**; **runtime verification pending** (restart not performed)  
> **Date:** 2026-05-30  
> **Prerequisites:** [`DATAHUB_CROSS_MODULE_DEPENDENCY_AUDIT.md`](./DATAHUB_CROSS_MODULE_DEPENDENCY_AUDIT.md) (DH-CROSS-1), [`DATAHUB_HIGH_RISK_EXECUTION_PLAN.md`](./DATAHUB_HIGH_RISK_EXECUTION_PLAN.md)  
> **Next step:** Review this doc → approve minimal hardening plan → implement in separate phase (not this commit)

---

## Executive summary

Read-only verification confirms **all five P0 blockers remain open**. High-risk DataHub execution must **stay NO-GO**.

| ID | Finding | Severity | High-risk blocker? |
|----|---------|----------|-------------------|
| **GAP-036** | `NODE_ENV=production`, `TELEGRAM_PUBLISHER_DRY_RUN` unset, 1 active publisher with bot token + chat_id | **High** | **Yes** — D-02/D-03 NO-GO |
| **GAP-009** | Sources write routes: **`writeAuth` implemented** — pending runtime verify after restart | **High** | **Yes** — blocked until runtime 403/200 verified |
| **GAP-011** | Categories write routes: **`writeAuth` implemented** — pending runtime verify after restart | **High** | **Yes** — blocked until runtime 403/200 verified |
| **CROSS-002** | `telegramAuth.js` / `telegramReadAuth` **missing**; 3 analytics routes unauthenticated vs GAP-006 docs | **High** | **Yes** — production data exposure |
| **CROSS-003** | **No** DataHub panel role-gates write buttons; Core backend unprotected | **Medium** | **Yes** — UX allows actions that should 403 on Advanced only |

**Recommendation:** Do **not** execute high-risk actions. Fix **GAP-009** and **GAP-011** backend RBAC first (minimal: mirror Advanced `writeAuth` pattern). Reconcile **CROSS-002** (implement or re-open GAP-006). Add **CROSS-003** UI affordances after backend RBAC. Keep **GAP-036** NO-GO until env gate fixed with explicit approval + restart plan.

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
| `/` | POST | ✅ | ✅ | ✅ | **Pending runtime verify** |
| `/:id` | PUT | ✅ | ✅ | ✅ | **Pending runtime verify** |
| `/:id` | DELETE | ✅ | ✅ | ✅ | **Pending runtime verify** |
| `/:id/restore` | PATCH | ✅ | ✅ | ✅ | **Pending runtime verify** |
| `/test-connection` | POST | ✅ | ✅ | ✅ | **Pending runtime verify** |
| `/telegram-sync` | POST | ✅ | ✅ | ✅ | **Pending runtime verify** |
| `/telegram-sync-category` | POST | ✅ | ✅ | ✅ | **Pending runtime verify** |
| `/telegram-transfer-messages` | POST | ✅ | ✅ | ✅ | **Pending runtime verify** |
| `/publish-telegram` | POST | ✅ | ✅ | ✅ | **Pending runtime verify** |

**Code status (2026-05-30):** All mutate routes use `...writeAuth`. **Runtime 403/200 tests not run** — backend restart required.

---

## 3. GAP-011 — Categories write RBAC

**File:** `backend/routes/data-categories.js`  
**Imports:** `authenticate`, `authorize`, `readRateLimiter`, `writeRateLimiter`  
**Pattern:** `const writeAuth = [authenticate, authorize('admin', 'trader'), writeRateLimiter]` (DH-P0-SECURITY-2)

| Route | Method | authenticate | authorize admin/trader | writeRateLimiter | gap? |
|-------|--------|--------------|------------------------|------------------|------|
| `/` | POST | ✅ | ✅ | ✅ | **Pending runtime verify** |
| `/:id` | PUT | ✅ | ✅ | ✅ | **Pending runtime verify** |
| `/:id` | DELETE | ✅ | ✅ | ✅ | **Pending runtime verify** |

**Read routes:** `GET /` and `GET /:id` remain `authenticate` + `readRateLimiter` (unchanged auth requirement).

**Code status (2026-05-30):** All mutate routes use `...writeAuth`. **Runtime 403/200 tests not run** — backend restart required.

---

## 4. CROSS-002 — Telegram analytics auth / documentation drift

**Code search:** `backend/middleware/telegramAuth.js` — **not found** (0 files).  
**`telegramReadAuth`:** **not referenced** in codebase.  
**`TELEGRAM_READ_MODE`:** documented in GAP-006 / EVIDENCE.md — **not wired** in current `telegram.js`.

**GAP-006 status in `GAPS_AND_PLAN.md`:** **Closed** — claims all read-only routes pass `telegramReadAuth` before `readRateLimiter`.

| Route | Current auth | Expected auth (GAP-006 / docs) | Drift? | Risk |
|-------|--------------|--------------------------------|--------|------|
| `GET /health` | **None** | `telegramReadAuth` + readRateLimiter | **Yes** | Medium — DB counts exposed |
| `GET /agents/summary` | readRateLimiter only | `telegramReadAuth` + JWT role | **Yes** | **High** — agent metrics public |
| `GET /agents/:agentKey/feed` | authenticate + readRateLimiter | `telegramReadAuth` + JWT role | Partial | Medium — auth present but not role-scoped per docs |
| `POST /agents/:agentKey/mark-processed` | authenticate + writeRateLimiter | authenticate + writeRateLimiter | **No** | Low — write protected |
| `GET /breaking-news` | authenticate + readRateLimiter | `telegramReadAuth` + JWT role | Partial | Medium |
| `GET /events/recent` | authenticate + readRateLimiter | `telegramReadAuth` + JWT role | Partial | Medium |
| `GET /categories/summary` | readRateLimiter only | `telegramReadAuth` + JWT role | **Yes** | **High** — category aggregates public |
| `GET /categories/:category/timeline` | authenticate + readRateLimiter | `telegramReadAuth` + JWT role | Partial | Medium |
| `GET /stats/real-time` | authenticate + readRateLimiter | `telegramReadAuth` + JWT role | Partial | Medium |

**Drift summary:**

| Item | Docs say | Code has |
|------|----------|----------|
| Middleware file | `telegramAuth.js` with `telegramReadAuth` | **Missing** |
| GAP-006 | Closed | **Should be re-opened or code restored** |
| Fully open routes | 0 in production auth-role mode | **3** (`/health`, `/agents/summary`, `/categories/summary`) |

**Minimal fix (future phase):** Either implement `telegramReadAuth` per EVIDENCE.md **or** update GAP-006 to Open and add `authenticate` + role check on open routes; align docs with code.

---

## 5. CROSS-003 — Frontend write button role gates

**Method:** Grep `role`, `userRole`, `Admin`, `Trader`, `useAppContext` under `components/ai/AIManager/tabs/DataHub/` — **no user-role checks found** (only ARIA `role=` attributes).

| Component | Write buttons role-gated? | Backend protected? | UX risk |
|-----------|---------------------------|-------------------|---------|
| **DataSourcesPanel** | ❌ No | ⏳ GAP-009 — code fixed; runtime pending | **High** — Create/Edit/Delete/Restore/Test visible to all |
| **CategoriesPanel** | ❌ No | ⏳ GAP-011 — code fixed; runtime pending | **High** |
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
| 2 | **GAP-009** | High | Unrestricted source mutation for any logged-in user |
| 3 | **GAP-011** | High | Unrestricted category mutation; no rate limit |
| 4 | **CROSS-002** | High | Doc/code drift; public analytics endpoints |
| 5 | **CROSS-003** | Medium | Misleading UI; Core worse than Advanced |

---

## 7. Minimal fix recommendations (plan only — do not implement yet)

### Phase A — Backend RBAC (smallest correct diff)

1. **GAP-009:** Add `writeAuth = [authenticate, authorize('admin', 'trader'), writeRateLimiter]` to all Sources mutate routes listed in §2; add rate limit to `/publish-telegram`.
2. **GAP-011:** Same `writeAuth` on Categories POST/PUT/DELETE; add `readRateLimiter` on GETs for consistency.

**Files:** `backend/routes/data-sources.js`, `backend/routes/data-categories.js` only.

**Tests:** Integration tests with `user` role → expect 403 on writes; `trader`/`admin` → 200/201.

### Phase B — Telegram analytics (CROSS-002)

**Option 1 (preferred per GAP-006):** Restore/implement `backend/middleware/telegramAuth.js`; wire `telegramReadAuth` on all read routes; default `TELEGRAM_READ_MODE=auth-role` in production.

**Option 2 (minimal):** Add `authenticate` to `/health`, `/agents/summary`, `/categories/summary`; re-open GAP-006 in `GAPS_AND_PLAN.md`.

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
| GAP-009 Sources RBAC | ⏳ **Backend implemented — pending runtime verify** |
| GAP-011 Categories RBAC | ⏳ **Backend implemented — pending runtime verify** |
| CROSS-002 Telegram auth | ❌ **Drift — treat as open** |
| CROSS-003 UI role gates | ❌ **Open** |
| **High-risk execution (DH-FINAL-6R)** | ❌ **NO-GO** |

**Safe to proceed (after separate approval):** P0-Security implementation Phases A→C above — **not** high-risk runtime tests.

**Next safest runtime candidate after P0 hardening:** Prioritization Override (P2, single test source) — still requires GAP-009 not blocking if source selected via Core UI.

---

## Evidence index

| Area | File verified |
|------|----------------|
| Sources routes | `backend/routes/data-sources.js` |
| Categories routes | `backend/routes/data-categories.js` |
| Telegram routes | `backend/routes/telegram.js` |
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
