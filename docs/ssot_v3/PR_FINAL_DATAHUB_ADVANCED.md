# PR Final — DataHub Advanced v3.0 (Release Checkpoint)

> **Branch:** `feat/gap-008-sources-backend-wiring`  
> **Target:** merge to `main` when approved  
> **Scope:** DataHub core tabs + all Advanced subtabs backend-first · Design Done  
> **Out of scope (stash):** Telegram/Agents changes — see [Stash note](#stash-note-out-of-scope)

**Pre-merge blocker (resolved):**

- Blocker UI — **Pipeline Health Overview** (Advanced) رفع شد (`f42d8f2`).
- **Undefined** / **NaN ms** دیگر در UI نمایش داده نمی‌شود.
- Avg latency فعلاً **N/A** + tooltip تا API تجمیعی آماده شود.
- **GAP-034** (aggregate pipeline latency API) برای **v3.1** باز است.

**Pre-merge blocker (resolved) — Health Monitoring tab:**

- تب **Health Monitoring** (`dataHub.health`) backend-first شد: `/health`, `/stats`, `/state`, access-log error counts.
- دیگر `0ms` ساختگی، `NaN`، یا `health.averageResponseTime.toFixed` از IndexedDB نمایش داده نمی‌شود.
- Avg response time و cache hit rate = **N/A** (GAP-035 → v3.1).

**Pre-merge blocker (resolved) — Header summary KPIs:**

- کارت‌های بالای DataHub (`DataHubSummaryCards`) فقط از `GET /stats` + `GET /health`.
- حذف mock: `cache.hitRate: 75`, `totalSources` از IndexedDB/pagination, `t(health.overall)` محلی.
- خطاهای خام HTTP مثل «Not Found» در advanced panels → i18n (`formatApiErrorForUi`).

**Pre-merge blocker (resolved) — Leak-proof guard:**

- Leak-proof guard completed to neutralize local/mock fallback exposure on implemented surfaces.
- Commit: `a1ac041` (`fix(datahub): neutralize local fallback leakage`).
- `Sources/Categories` implemented paths no longer present IndexedDB fallback as real backend data.
- Advanced auxiliary props no longer inherit hidden local fallback.
- Telegram shell falls back to degraded/unknown semantics when backend sources are unavailable.
- Synthetic agent telemetry (`latency/throughput/errorRate`) is neutralized (no fake numeric display).
- No active mock leakage blocker remains.

---

## 1) Git clean proof

```bash
$ git status --short
# (empty — working tree clean)

$ git log --oneline -8
c7f38de docs(datahub): note Pipeline Health Overview blocker fix in final PR summary
f42d8f2 fix(datahub): guard pipeline health overview metrics
1eda662 docs(datahub): final release checkpoint for advanced v3.0 PR
43b6368 feat(datahub): GAP-032 archiving backend-first (manual archive/restore)
df64454 feat(datahub): GAP-030 smart prioritization backend-first (preview + manual apply)
b055378 feat(datahub): GAP-028 auto discovery suggestion-only backend
453c24d docs(datahub): lock GAP-026 cleanup and GAP-028 discovery contract
794eb10 feat(datahub): GAP-026 crawlers backend-first (website + RSS)
7e8af67 docs(datahub): close GAP-024 proof and crawlers contract draft
092a191 feat(datahub): GAP-024 blacklist/whitelist backend-first
8494629 docs(datahub): checkpoint PR summary, GAP-023/024, blacklist contract

$ git stash list
stash@{0}: On gap-008-sources-backend-wiring: out-of-scope telegram/agents changes before GAP-024
```

---

## 2) Final advanced matrix (`SSOT_v3.0.md`)

| Subtab (module ID) | Status |
|--------------------|--------|
| `dataHub.advanced.telegramPublisher` | **Implemented · Design: Done** |
| `dataHub.advanced.automation` | **Implemented · Design: Done** |
| `dataHub.advanced.access` | **Implemented · Design: Done** |
| `dataHub.advanced.blacklist` | **Implemented · Design: Done** |
| `dataHub.advanced.crawlers` | **Implemented · Design: Done** |
| `dataHub.advanced.discovery` | **Implemented · Design: Done** |
| `dataHub.advanced.prioritization` | **Implemented · Design: Done** |
| `dataHub.advanced.archiving` | **Implemented · Design: Done** |
| `dataHub.advanced` (parent) | **Implemented · Design: Done** |

No advanced subtab row remains **Partial** for v3.0 delivery.

---

## 3) GAPs closed (v3.0 DataHub wave)

| GAP | Title |
|-----|--------|
| GAP-006 | Telegram read security (`telegramReadAuth`) |
| GAP-008 | Sources backend-first |
| GAP-010 | Categories backend-first |
| GAP-012 | Pipeline backend-first |
| GAP-013 | Access logs backend-first |
| GAP-016 | Telegram Publisher |
| GAP-018 | Automation topics |
| GAP-019 | Automation queue/dispatch |
| GAP-022 | Access Control + design |
| GAP-023 | Advanced subtabs design pass |
| GAP-024 | Blacklist/Whitelist + ingestion enforce |
| GAP-026 | Web/RSS crawlers |
| GAP-028 | Auto Discovery (suggestion-only) |
| GAP-030 | Smart Prioritization (preview + manual apply) |
| GAP-032 | Archiving (manual archive/restore) |
| GAP-004 | (Closed — covered by GAP-022/024) |
| GAP-021 | (Closed — core design pass Done) |

### Open v3.1 (deferred — not blockers)

| GAP | Scope |
|-----|--------|
| **GAP-007** | Frontend chunk optimization (`DataHubTab` >500KB) |
| **GAP-009** | RBAC hardening — `data-sources` write |
| **GAP-011** | RBAC hardening — `data-categories` write |
| **GAP-014** | RBAC hardening — access-logs read |
| **GAP-017** | RBAC read — telegram publishers |
| **GAP-020** | Automation cron scheduler |
| **GAP-025** | Publishing filter hook (evaluate on dispatch/publish) |
| **GAP-027** | Crawler scheduler + Playwright production |
| **GAP-029** | Discovery scheduler daemon |
| **GAP-031** | Prioritization scheduler / auto-apply |
| **GAP-033** | Archiving scheduler cron |
| **GAP-034** | Aggregate pipeline avg latency API (`data_hub_logs.execution_time_ms` or pipeline `/stats`) |
| GAP-001/002/003/005/015 | Analytics, orchestration, pipeline snapshots, backtesting, logs scale |

### Pre-merge blocker fix — Pipeline Health Overview

| Item | Status |
|------|--------|
| Blocker UI (Advanced → Pipeline Health Overview) | **Fixed** — commit `f42d8f2` |
| `Undefined` / `NaN ms` in UI | **Removed** — safe formatters + `/health` + `/stats` |
| Avg latency display | **N/A** + tooltip (`pipeline_latency_not_available`) until GAP-034 |
| GAP-034 (aggregate latency API) | **Open** — v3.1 |

Component: `PipelineHealthOverview.tsx` · APIs: `GET /api/v1/data-sources/health`, `GET /api/v1/data-sources/stats` · Demos: `DataHub_DEMOS.md` § `dataHub.advanced.pipelineHealth`.

---

## 4) Migrations added (025–033)

| Migration | Purpose |
|-----------|---------|
| `025_create_telegram_publishers.sql` | Telegram Publisher |
| `026_create_datahub_automation_topics.sql` | Automation topics |
| `027_create_datahub_automation_queue.sql` | Queue + schedule + executions |
| `028_create_datahub_filter_rules.sql` | Blacklist/Whitelist |
| `029_create_datahub_crawlers.sql` | Crawlers + runs |
| `030_create_datahub_discovery.sql` | Discovery settings/rules/scans/suggestions |
| `031_create_datahub_prioritization.sql` | Prioritization settings/sources/runs |
| `032_add_prioritization_audit_columns.sql` | Prioritization run audit hardening |
| `033_create_datahub_archiving_operations.sql` | API archiving operation audit |

**Legacy (pre-wave):** `008_create_archive_tables.sql` + SQL functions for `ai_decisions` cold storage (used by GAP-032 API).

---

## 5) API endpoints added

| Mount | Routes file |
|-------|-------------|
| `/api/v1/data-hub/telegram-publishers` | `data-hub-telegram-publishers.js` |
| `/api/v1/data-hub/automation` | `data-hub-automation.js` |
| `/api/v1/data-hub/access-control` | `data-hub-access-control.js` |
| `/api/v1/data-hub/filter-rules` | `data-hub-filter-rules.js` |
| `/api/v1/data-hub/crawlers` | `data-hub-crawlers.js` |
| `/api/v1/data-hub/discovery` | `data-hub-discovery.js` |
| `/api/v1/data-hub/prioritization` | `data-hub-prioritization.js` |
| `/api/v1/data-hub/archiving` | `data-hub-archiving.js` |

Core DataHub (same PR branch): `/api/v1/data-sources`, `/data-categories`, `/data-sources/pipeline`, `/data-sources/access-logs`.

---

## 6) UI backend-first (no IndexedDB for primary data)

| Component | API client / hooks |
|-----------|-------------------|
| `DataSourcesPanel.tsx` | `dataSourcesApi` · `useDataHubState` |
| `CategoriesPanel.tsx` | `dataCategoriesApi` |
| `PipelinePanel.tsx` | `dataPipelineApi` |
| `LogsPanel.tsx` | `dataAccessLogsApi` |
| `TelegramPublisher.tsx` | `telegramPublishersApi` · `useTelegramPublishers` |
| `AutomationTopics.tsx` | `datahubAutomationApi` · `useDatahubAutomation` |
| `AccessControlPanel.tsx` | `dataHubAccessControlApi` |
| `BlacklistWhitelist.tsx` | `dataHubFilterRulesApi` |
| `WebCrawlerConfig.tsx` | `dataHubCrawlersApi` |
| `AutoDiscoveryConfig.tsx` | `dataHubDiscoveryApi` |
| `SmartPrioritization.tsx` | `dataHubPrioritizationApi` · `useDataHubPrioritization` |
| `Archiving.tsx` | `dataHubArchivingApi` · `useDataHubArchiving` |
| `PipelineHealthOverview.tsx` (Advanced footer) | `dataSourcesApi` · `useDataHubSourcesHealthQuery` / `useDataHubSourcesStatsQuery` |

**Design:** all above per `DESIGN_SYSTEM_DATAHUB.md` (slate shell, tables, modals, badges). See `DATAHUB_DESIGN_BACKLOG.md`.

---

## 7) Build + migrate proof

| Step | Command | Result |
|------|---------|--------|
| Migrate | `cd backend && npm run migrate` | **PASS** — `No migrations to run!` / `Migrations complete!` |
| Build | `npm run build` (repo root) | **PASS** — `✓ built` (~24–35s) |
| DB | dev `titangold_db` @ `127.0.0.1:5433` | `postgres` |
| Host | `ubuntu` · `/home/ubuntu/webapp/TitanGold` | real dev server |

**Latest applied migrations (pgmigrations):**

| name | run_on (UTC) |
|------|----------------|
| `031_create_datahub_prioritization` | 2026-05-26 18:33:18 |
| `032_add_prioritization_audit_columns` | 2026-05-26 18:49:57 |
| `033_create_datahub_archiving_operations` | 2026-05-26 19:40:23 |

**Migrate warnings:** `Can't determine timestamp for 030/031/032/033…` — **harmless** (mixed migration filenames + `--no-check-order`). Documented in `docs/ssot_v3/audit/ENVIRONMENT.md`.

---

## 8) Demo index

Full scenarios: `docs/ssot_v3/DataHub_DEMOS.md` — **Demo index** table at top covers:

Sources · Categories · Pipeline · Logs · Telegram · Access Control · Telegram Publisher · Automation · Blacklist/Whitelist · Crawlers · Discovery · Prioritization · Archiving · **Pipeline Health Overview**

Evidence (grep / no-mock): `docs/ssot_v3/EVIDENCE.md` §§ 8–18.

---

## 9) Stash note (out of scope)

```text
stash@{0}: out-of-scope telegram/agents changes before GAP-024
```

**Do not** `git stash pop` onto this PR unless intentionally resuming that work. DataHub GAP-006/016/018/019 telegram paths in this branch are scoped to DataHub routes only.

---

## 10) Suggested PR title & test plan

**Title:** `feat(datahub): v3.0 advanced features backend-first (GAP-016–032)`

**Test plan (smoke):**

- [ ] `cd backend && npm run migrate` on dev DB
- [ ] `npm run build`
- [ ] Login as admin/trader → DataHub → each Advanced subtab loads without `fetchDataHubState` for list CRUD
- [ ] Prioritization: preview → apply with confirm
- [ ] Archiving: archive dry-run → apply with confirm
- [ ] Discovery: scan → approve suggestion (no auto-create on scan)
- [ ] Crawler: run once → run history
- [ ] Filter rule: POST collected-data blocked when rule matches
- [ ] Advanced → Pipeline Health Overview: status from `/health`, sources `N/M` from `/stats`, latency **N/A** (no Undefined/NaN)
- [ ] Health tab: overall from `/health`, active/total from `/stats`, errors from access-logs `statusCounts`, last check from `timestamp`, avg response/cache **N/A**
- [ ] Header KPI row: total/active from `/stats`, status from `/health`, cache **N/A** (not 75% mock)

---

## 11) Browser smoke (attempted · not complete)

| Item | Result |
|------|--------|
| Browser smoke attempted | **Yes** (Playwright on dev server `http://localhost:5173`) |
| Outcome | **Blocked** — route/selector to **AI Center → DataHub** not reachable from Dashboard in this runtime (timeout waiting for `Data Hub` tab; screenshot stayed on Trading Overview) |
| Full browser smoke pass | **No claim** — header KPI / main tabs / Advanced subtabs not validated end-to-end in browser |
| Next smoke approach | **Direct URL only** (no click guessing): `/?view=ai` per `utils/urlSync.ts` (`ViewKey: 'ai'`). Then **AI Manager** + **Data Hub** are **internal React state** (`AICenter` tab `manager`, `AIManager` tab `data_hub`) — **not** in `urlSync` today. Confirm exact deep-link with owner before re-run. |
| Production impact | Smoke-only Vite on `:5173` stopped; **no** production PM2/backend restart |

**PR status:** **Ready except final browser smoke** — not **Ready to merge**.

---

## 11.1) Final Browser Smoke Blocker (environment, not DataHub UI)

- `500 POST /api/v1/auth/login` observed in smoke was caused by **CORS reject** before login handler logic.
- Backend logs show: `CORS blocked request from origin: http://localhost:5173` → `Not allowed by CORS` on `/api/v1/auth/login`.
- `CORS_ALLOWED_ORIGINS` key exists in backend `.env`, but current value set does **not** include `localhost:5173`.
- Smoke credential `dev/password` is not valid in this DB environment (`dev` user record missing), so even after CORS approval this test credential would not authenticate.
- No production environment variables were changed.
- No DB seed/write was performed for smoke.
- Required next step for full browser smoke: **approved smoke origin** + **approved valid test user/token**.

**Operational status:** **Ready except final browser smoke — blocked by approved test environment**.

---

## 12) Final status

| Check | Result |
|-------|--------|
| Pipeline Health Overview blocker | **Resolved** (`f42d8f2`) |
| Health Monitoring tab blocker | **Resolved** (backend-first `HealthPanel`) |
| Header summary KPI blocker | **Resolved** (`DataHubSummaryCards` + `/stats` `/health`) |
| Tab/subtab navigation redesign | **Done** (`39c474c`, Safety Filtering pills `c0f89b2`) |
| Undefined / NaN ms in health UI | **None** (code-level) |
| Latency metric (Advanced overview) | **N/A** (GAP-034 → v3.1) |
| Avg response / cache (Health tab) | **N/A** (GAP-035 → v3.1) |
| Browser smoke (E2E) | **Attempted · blocked by environment** (CORS origin + test credential), not DataHub UI |
| Branch pushed to `origin` | **Yes** — `feat/gap-008-sources-backend-wiring` |
| Leak-proof fallback blocker | **Resolved** (`a1ac041`) |

*Checkpoint updated 2026-05-27 · **Ready except final browser smoke — blocked by approved test environment**.*
