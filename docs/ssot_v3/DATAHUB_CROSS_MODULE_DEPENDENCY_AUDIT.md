# DataHub Cross-Module Dependency Audit (DH-CROSS-1)

> **Status:** Planning + audit only — **no implementation, no execution**  
> **Date:** 2026-05-30  
> **Context:** DataHub v3.0 stabilization largely complete — ready except controlled high-risk execution and RBAC hardening.  
> **Prerequisite docs:** [`DATAHUB_SETTINGS_DEPENDENCY_AUDIT.md`](./DATAHUB_SETTINGS_DEPENDENCY_AUDIT.md) (2026-05-27), [`DATAHUB_HIGH_RISK_EXECUTION_PLAN.md`](./DATAHUB_HIGH_RISK_EXECUTION_PLAN.md), [`GAPS_AND_PLAN.md`](./GAPS_AND_PLAN.md)  
> **Rule:** No screen is complete without Frontend + Backend + Design System + **Cross-module dependencies** documented.

---

## Executive summary

DataHub is **functionally self-contained** at the data-plane layer: core tabs and Advanced features persist to PostgreSQL via `/api/v1/data-sources`, `/api/v1/data-categories`, and `/api/v1/data-hub/*`. **Settings does not drive DataHub CRUD** today.

Cross-module coupling is **real but indirect**:

| Module | Coupling strength | Primary impact on DataHub |
|--------|-------------------|---------------------------|
| **User Management** | **High** | JWT roles gate Advanced writes (`admin`/`trader`); Core CRUD lacks `authorize()` (GAP-009/011) |
| **Notifications** | **Medium (missing wiring)** | Separate Telegram alert bot — not publisher/automation failures |
| **Connections** | **Low (by design)** | Exchange/wallet keys only — not Telegram ingest/publish |
| **Security (Settings)** | **Low** | Password/2FA/session — not DataHub ACL |
| **Email Configuration** | **None** | No DataHub event → email path |
| **Wallet** | **None** | Not used |
| **Clear Cache (Settings)** | **Medium** | Wipes IndexedDB legacy `data_hub_state` without DataHub warning |
| **Environment / PM2** | **High (operational)** | `TELEGRAM_PUBLISHER_DRY_RUN`, `NODE_ENV`, `MASTER_KEY`, `CRAWLER_RENDER_JS_ENABLED` — **GAP-036** blocks publisher/automation dry-run |

**Telegram triad** remains the largest operator confusion surface:

```
Ingest  → DataHub → Telegram tab + collector service
Publish → DataHub → Advanced → Telegram Publisher
Alerts  → Settings → Notifications (personal bot)
```

**Before any new high-risk execution:** close **GAP-036** (publisher dry-run gate), harden **GAP-009/011/014** (Core RBAC), and document operator paths (Settings cross-links).

**No v3.0 functional blocker** from this audit — items are consolidation, RBAC, notifications integration, and UX ownership clarity (v3.1).

---

## Critical evaluation rule (four perspectives)

| Perspective | DataHub status |
|-------------|----------------|
| **Frontend** | Backend-first UI; UX-2 error sanitize; design pass closed (GAP-021/023) |
| **Backend** | APIs implemented; runtime verified low-risk (DH-FINAL-4); D-01 dry-run pass |
| **Design System** | `DESIGN_SYSTEM_DATAHUB.md` applied; missing Settings cross-links / permission badges |
| **Cross-module** | **This audit** — dependencies documented; several integrations **missing** |

---

# Section 1 — Settings dependency matrix

| Feature | Required setting / module | Current implementation | Missing implementation | Risk if missing |
|---------|---------------------------|------------------------|----------------------|-----------------|
| **Sources CRUD** | User Management → role | JWT `authenticate` only on write | Role gate (`authorize admin/trader`) — GAP-009 | Any authenticated user can mutate sources |
| **Sources CRUD** | Profile / session | JWT + `created_by` audit | — | Low |
| **Categories CRUD** | User Management → role | JWT only | GAP-011 role gate | Same as sources |
| **Pipeline / Health / Logs read** | User Management → role | JWT only | GAP-014 on logs read | Viewer sees all access logs |
| **Logs read** | Security / RBAC policy | Not in Settings Security UI | Analyst/admin-only policy in backend | Compliance gap |
| **Telegram ingest** | DataHub → Telegram tab | Collector login (apiId/apiHash/phone) in wizard | Not in Settings → Connections | Operators hunt in DataHub only — OK if documented |
| **Telegram ingest** | Clear Cache | IndexedDB collector snapshot merge | No DataHub warning on clear — DEP-003 | Degraded collector UI until re-login |
| **Telegram ingest** | Notifications | Separate alert bot | No cross-link ingest vs alerts | Operator configures wrong bot |
| **Telegram Publisher** | DataHub Advanced (canonical) | `telegram_publishers` + encrypted token (`MASTER_KEY`) | Settings ownership N/A | Token encrypt fails if `MASTER_KEY` unset |
| **Telegram Publisher** | Env: `TELEGRAM_PUBLISHER_DRY_RUN` | PM2 production: **unset** | Explicit dry-run flag — GAP-036 | Live send on test/publish |
| **Telegram Publisher** | Notifications | Not wired | Failure → user alert bot | Silent publish failures |
| **Automation Routing** | Telegram Publisher | `publisherTargets` picklist in DataHub | Settings not involved | Correct in-DataHub dep |
| **Automation Routing** | Notifications | Not wired | Dispatch failure alerts | Ops blind to queue failures |
| **Automation schedule** | — (feature-local) | DB schedule + client interval | GAP-020 backend cron | Schedule stops if UI closed |
| **Crawlers** | Env: `CRAWLER_RENDER_JS_ENABLED` | Default false; Playwright off | Settings toggle | Website crawlers fail render_js |
| **Crawlers scheduling** | — | Manual run + `next_run_at` column | GAP-027 worker | No auto-run without cron |
| **Discovery** | Feature DB settings | `/discovery/settings` PATCH | Not app Settings | Naming collision only — DEP-007 |
| **Prioritization** | Feature DB settings | `/prioritization/settings` PUT | Not app Settings | Same |
| **Access Control** | User Management roles | Write: admin/trader; read: any auth | DataHub-specific roles — none | Viewer can read ACL matrix |
| **Access Control** | DataHub per-source ACL | `datahub_access_control` | Not in Settings Security | By design — data-plane ACL |
| **Safety Filtering** | — | `/filter-rules` in DataHub | GAP-025 publish path enforce | Ingest blocked; publish not |
| **Archiving** | — | DataHub Advanced only | GAP-033 cron in Settings N/A | Manual only — OK v3.0 |
| **Health metrics** | — | Backend `/stats`; N/A labels | GAP-035 cache/avg response API | Misleading N/A labels only |
| **All tabs** | Appearance | Theme/i18n global | — | None |
| **All tabs** | Email Configuration | **Not used** | DataHub alert emails | No email alerts |
| **All tabs** | Wallet / Connections | **Not used** | — | None |

**Canonical ownership (recommended, unchanged from DEP audit):**

| Concern | Owner module |
|---------|--------------|
| Data sources, pipeline, advanced rules | **DataHub** |
| Exchange API keys, wallets | **Settings → Connections / Wallet** |
| Personal trade/alert Telegram bot | **Settings → Notifications** |
| Ingest Telegram session | **DataHub → Telegram** + collector |
| Outbound publish bot/channel | **DataHub → Telegram Publisher** |
| Global API write roles | **User Management** + backend `authorize()` |
| Per-source agent ACL | **DataHub → Access Control** |

---

# Section 2 — Security dependency matrix

### Authentication

| Layer | Implementation | DataHub impact |
|-------|----------------|----------------|
| JWT `titan_token` | `authenticate` middleware | All protected DataHub routes |
| Session DB | `user_sessions` optional | Role from DB when available |
| Collector | Cookie `credentials: include` | Telegram tab only — separate auth |
| Telegram analytics `/health` | **Open** (no JWT in current `telegram.js`) | Public health probe — doc drift vs GAP-006 |

### RBAC — route enforcement (backend)

| Area | Read | Write / mutate | Delete | Admin-only | Trader | Viewer/user | Missing enforcement |
|------|------|----------------|--------|------------|--------|-------------|---------------------|
| **Sources** | auth | auth | auth (+ hard) | — | — | same as auth | **GAP-009** — no role gate on write/delete |
| **Categories** | auth | auth | auth | — | — | same | **GAP-011** |
| **Access logs** | auth | — | — | — | — | same | **GAP-014** — any auth user reads logs |
| **Advanced `/data-hub/*` writes** | auth | **admin, trader** | admin, trader | implicit | yes | **403** | Enforced |
| **Advanced reads** | auth | — | — | — | — | same | GAP-017 publisher read open |
| **Telegram analytics** | mixed | mark-processed: auth | — | — | — | partial routes unauthenticated | See CROSS-002 |
| **Access Control write** | auth | admin, trader | admin, trader | — | yes | 403 | OK |
| **Core UI** | no role hide | Buttons visible to all | — | — | — | — | **Frontend does not hide** write actions by role |

### Known RBAC gaps (existing)

| ID | Gap | Severity |
|----|-----|----------|
| GAP-009 | Sources CRUD without `authorize()` | Medium |
| GAP-011 | Categories CRUD without `authorize()` | Medium |
| GAP-014 | Access logs read without role limit | Low |
| GAP-017 | Publisher list read without role limit | Low |
| INV-005 | Core write no role gate (inventory) | Medium |

### Additional RBAC gaps (this audit)

| ID | Gap | Severity | Notes |
|----|-----|----------|------|
| **CROSS-002** | `telegramReadAuth` / `TELEGRAM_READ_MODE` documented in GAP-006 but **`backend/middleware/telegramAuth.js` absent**; `/agents/summary`, `/categories/summary`, `/health` lack `authenticate` in current `telegram.js` | **High** | Doc/code drift — re-verify security wiring |
| **CROSS-003** | Frontend DataHub shows write buttons without checking `user.role` | Medium | Backend may 403 on Advanced; Core writes succeed for any auth user |
| **CROSS-004** | Backend roles: `admin`, `trader`, `user`, `vip` — no `viewer`/`analyst`/`auditor` despite docs referencing them for telegram read | Medium | Role model mismatch Settings ↔ backend |

---

# Section 3 — Settings screen coverage

| DataHub capability | Configurable from Settings today? | Where (if yes) | Should it be in Settings? | Recommendation |
|--------------------|-----------------------------------|----------------|---------------------------|----------------|
| **Telegram Publisher** (bot, channel, template) | **No** | DataHub Advanced only | **No** — operational data-plane | Keep in DataHub; add cross-link to Notifications |
| **Telegram ingest** (collector login) | **No** | DataHub → Telegram | **Optional** v3.1: Connections subsection for apiId/apiHash | Document triad |
| **Automation routing** (topics, queue, schedule) | **No** | DataHub Advanced | **No** | Optional: failure → Notifications |
| **Email alerts for DataHub** | **No** | Email SMTP exists but unused | **Optional** v3.1 | CROSS-005 |
| **Crawler scheduling** | **No** | Manual + env `CRAWLER_RENDER_JS_ENABLED` | **Optional** env in Configuration (admin) | GAP-027 cron separate |
| **Archiving** | **No** | DataHub Advanced | **No** | Ops runbook + backup |
| **Discovery** | **No** | Feature toggle in DataHub | **No** | — |
| **Prioritization** | **No** | Feature toggle in DataHub | **No** | — |
| **Safety rules** | **No** | DataHub Advanced | **No** | — |
| **Access Control** | **No** | DataHub Advanced | **No** — not global Security settings | — |
| **User alert Telegram bot** | **Yes** | Settings → Notifications | **Yes** — correct owner | — |
| **Exchange connections** | **Yes** | Settings → Connections | N/A for DataHub | — |
| **Global roles** | **Yes** | Settings → User Management (admin) | **Yes** | Extend with DataHub permissions v3.1 |
| **Clear local cache** | **Yes** | Settings → Clear Cache | **Yes** — add DataHub warning | DEP-003 |
| **2FA / password** | **Yes** | Settings → Security | Indirect (session) | — |

---

# Section 4 — Notification dependencies

| DataHub event | Current implementation | Missing implementation | Recommended owner |
|---------------|------------------------|------------------------|-------------------|
| Crawler failure | Run row in `datahub_crawler_runs`; UI error banner | No push to Settings Notifications or email | **Notifications** (errors template) or ops webhook |
| Crawler success | Run history UI only | No alert | Optional digest — low priority |
| Discovery scan complete | API response + stats card | No user alert | **Notifications** optional |
| Discovery approve/reject | UI refresh | No alert | Low priority |
| Archive completed | `datahub_archiving_operations` row | No alert | **Notifications** + ops runbook |
| Archive failed | Operation row `failed` | No alert | **Notifications** errors template |
| Publisher failure | `publisher_delivery_history` + UI message | Not routed to Settings bot | **Notifications** — CROSS-006 |
| Publisher success | History row | No user alert | Optional |
| Automation queue failure | Execution row + PATCH fail | No Settings integration | **Notifications** |
| Automation dispatch success | Execution history | No alert | Optional |
| Safety filter block (ingestion) | Silent skip / 403 pre-crawl | No operator alert | **Notifications** or Logs dashboard |
| Permission violation (403) | UX-2 sanitized banner | No security alert | **Security Settings** alerts (login anomalies only today) |
| Access log error spike | Health/log panels | No proactive alert | **Notifications** / monitoring |
| Prioritization apply | Run row | No alert | Optional admin digest |
| Source hard delete | Access log warning entry | No alert | **Notifications** admin channel |
| Telegram collector offline | DataHub Telegram tab status | Partial UI | **Notifications** |
| High-risk action attempted | — | No audit notification | **User Management** activity log extension |

**Summary:** Settings → Notifications is **trade/alert centric** (`trades`, `alerts`, `news`, `predictions`, `errors` templates). **Zero DataHub-specific notification types** wired today.

---

# Section 5 — Email configuration dependencies

| Question | Finding |
|----------|---------|
| Can Email Configuration support DataHub alerts today? | **No wiring** — `EmailSettings.tsx` + `emailService.ts` manage SMTP presets; no subscriber to DataHub events |
| SMTP dependencies | User/device IndexedDB or settings storage; test via `testSMTPConnection()` |
| Alert dependencies | None to DataHub routes or services |
| Failure notifications | Not implemented for crawler/publisher/archiving |
| Missing wiring | Event bus or webhook from `datahub_*` services → notification service → email queue |

**Recommendation (v3.1, docs only):** Define optional `datahub_ops` email channel in Notifications/Email for admin-only operational events — **CROSS-005**.

---

# Section 6 — Connections dependencies

| Service | Credential storage | Settings > Connections? | DataHub surface | Notes |
|---------|-------------------|-------------------------|-----------------|-------|
| **MEXC / exchanges** | Encrypted exchange keys | **Yes** | Not used | By design |
| **WalletConnect / cold wallet** | Connections/Wallet | **Yes** | Not used | — |
| **Telegram Collector** (MTProto) | Collector service DB; apiId/apiHash in DataHub wizard | **No** | DataHub → Telegram | Not Connections |
| **Telegram Publisher** | `telegram_publishers.bot_token_encrypted` (`MASTER_KEY`) | **No** | Advanced → Publisher | Canonical DataHub |
| **RSS / web crawlers** | URLs in `data_sources` / `datahub_crawlers` | **No** | Sources + Crawlers | No API key |
| **External APIs** (source type `api`) | `data_sources.config` JSON | **No** | Sources modal | Per-source in DataHub |
| **Notifications alert bot** | User preferences (`botToken`, `chatId`) | **Notifications tab** | Not DataHub | Third Telegram surface |

**Is Settings → Connections the proper owner for Telegram?**

**No** for publish bots and collector sessions (data-plane). **Optional** for shared Telegram API application credentials (apiId/apiHash) only — v3.1 design decision.

**Env dependencies (not in Settings UI):**

| Variable | Affects |
|----------|---------|
| `MASTER_KEY` | Publisher token encryption |
| `TELEGRAM_PUBLISHER_DRY_RUN` | Live vs dry publish/test — **GAP-036** |
| `NODE_ENV` | Publisher dry-run default |
| `CRAWLER_RENDER_JS_ENABLED` | Website crawler Playwright |
| `TELEGRAM_READ_MODE` | Documented telegram analytics auth — verify CROSS-002 |
| `JWT_SECRET` | All authenticated DataHub routes |

---

# Section 7 — User Management dependencies

### Backend roles (actual)

`userSchemas.js`: `admin`, `trader`, `user`, `vip` — assigned via Settings → User Management (admin).

### DataHub role expectations vs reality

| Conceptual role | Supported today? | Mechanism | Gap |
|-----------------|------------------|-----------|-----|
| **DataHub Admin** | Partial | `admin` → Advanced writes OK | Core writes also open to `user` — GAP-009 |
| **DataHub Operator** | Partial | `trader` → Advanced writes OK | Same Core gap |
| **DataHub Viewer** | **No** | No `viewer` role in backend schema | Read-only not enforceable |
| **DataHub Analyst** | **No** | Referenced in GAP-006 docs only | GAP-014 not implemented |
| **DataHub Auditor** | **No** | Logs readable by any auth user | Need role + GAP-014 |

### Settings → Users UI

- Custom roles with permissions: `manage_users`, `manage_trading`, `view_analytics`, etc.
- **No DataHub-specific permissions** (`datahub_write`, `datahub_publish`, `datahub_audit`).
- Frontend `Admin` maps to backend `admin`; role checks on DataHub tabs **not implemented**.

**Gap:** **CROSS-007** — User Management lacks DataHub permission dimension; RBAC enforced inconsistently (Advanced yes, Core no).

---

# Section 8 — Design consistency impact

| Dependency gap | Design / UX impact | Redesign required? |
|----------------|-------------------|-------------------|
| Telegram triad (ingest/publish/alerts) | Generic hints in `AdvancedFeatures.tsx`; no links to Settings → Notifications | **Yes** — cross-link banners, ownership labels |
| SESSION_EXPIRED → "Settings" | Wrong navigation target (`errorHandler.ts`) — DEP-002 | **Yes** — copy fix → DataHub → Telegram |
| Clear Cache vs DataHub IndexedDB | No warning in `CacheSettings.tsx` — DEP-003 | **Yes** — checkbox label |
| No permission badges on write buttons | Viewer sees same UI as admin | **Yes** — role-gated button visibility (after GAP-009) |
| Discovery/Prioritization "Settings" toggle | Confused with app Settings — DEP-007 | **Minor** — rename to "Feature settings" in i18n |
| Missing breadcrumbs Settings ↔ DataHub | No deep links | **Yes** — v3.1 nav |
| Publisher vs Notifications bot | No visual distinction | **Yes** — iconography / "Outbound" vs "Personal alerts" |
| Orphan `AutomationSettings.tsx` | Dead duplicate UI — DEP-004 | **Cleanup** — remove/archive |
| Env-dependent dry-run (GAP-036) | No UI indicator for production live-send risk | **Yes** — banner on Publisher/Automation when dry-run not forced |
| Access Control vs Settings Security | Name collision | **Docs/tooltip** only |

---

# Section 9 — Prioritized execution backlog

### P0 — Security, RBAC, cross-module blockers

| ID | Item | Owner module |
|----|------|--------------|
| P0-1 | **GAP-036** — `TELEGRAM_PUBLISHER_DRY_RUN=true` or staging gate before any publisher/automation execution | Env / PM2 |
| P0-2 | **GAP-009/011** — `authorize('admin','trader')` on Sources/Categories writes | Backend |
| P0-3 | **CROSS-002** — Reconcile `telegramReadAuth` docs vs `telegram.js` implementation | Backend security |
| P0-4 | **CROSS-003** — Frontend hide Core write actions by role | DataHub UI + User Management |
| P0-5 | Block high-risk execution per [`DATAHUB_HIGH_RISK_EXECUTION_PLAN.md`](./DATAHUB_HIGH_RISK_EXECUTION_PLAN.md) until P0-1 + RBAC reviewed | Process |

### P1 — Settings & notifications integration

| ID | Item | Owner module |
|----|------|--------------|
| P1-1 | DEP-001 / DEP-006 — Telegram triad cross-links (DataHub ↔ Notifications) | UX + docs |
| P1-2 | DEP-002 — Fix SESSION_EXPIRED copy | DataHub i18n |
| P1-3 | DEP-003 — Clear Cache DataHub warning | Settings → Cache |
| P1-4 | **CROSS-006** — Publisher/automation failure → Notifications `errors` template | Notifications + backend hook |
| P1-5 | **GAP-014/017** — Read RBAC for logs + publisher list | Backend |
| P1-6 | **GAP-025** — Filter rules on publish/automation path | Backend |
| P1-7 | **CROSS-007** — DataHub permissions in User Management (or map roles) | Settings → Users |

### P2 — UX enhancements

| ID | Item |
|----|------|
| P2-1 | GAP-036 UI banner on Publisher/Automation when live send possible |
| P2-2 | Permission indicators on Advanced write buttons |
| P2-3 | Breadcrumbs / deep links Settings ↔ DataHub |
| P2-4 | Rename Discovery/Prioritization "Settings" labels (DEP-007) |
| P2-5 | GAP-035 Health tab real metrics or remove misleading N/A |

### P3 — Future improvements

| ID | Item |
|----|------|
| P3-1 | DEP-004/005 — Remove orphan AutomationSettings + legacy IndexedDB helpers |
| P3-2 | GAP-020/027/029/031/033 — Scheduler daemons (automation, crawler, discovery, prioritization, archiving) |
| P3-3 | CROSS-005 — Email channel for DataHub ops alerts |
| P3-4 | Optional Telegram apiId/apiHash in Connections |
| P3-5 | GAP-003 pipeline snapshot persistence |

---

## Dependency matrix (consolidated)

| DataHub area | Settings | Notifications | Email | Security | Users | Connections | Wallet | Env/PM2 |
|--------------|----------|---------------|-------|----------|-------|-------------|--------|---------|
| Sources | Profile, Cache | — | — | RBAC gap | Roles | — | — | — |
| Categories | Cache | — | — | RBAC gap | Roles | — | — | — |
| Pipeline | — | — | — | — | — | — | — | — |
| Health | Cache | — | — | — | — | — | — | — |
| Logs | — | — | — | RBAC gap | Roles | — | — | — |
| Telegram ingest | Cache, Notif* | Separate bot | — | Session | — | — | — | Collector URL |
| Telegram analytics | — | — | — | CROSS-002 | Roles | — | — | TELEGRAM_READ_MODE |
| Crawlers | — | Missing | — | — | Roles | — | — | CRAWLER_RENDER_JS |
| Discovery | — | Missing | — | — | Roles | — | — | — |
| Prioritization | — | Missing | — | — | Roles | — | — | — |
| Access Control | — | — | — | Indirect | **Roles** | — | — | — |
| Safety Filtering | — | Missing | — | — | Roles | — | — | — |
| Telegram Publisher | Notif* | Missing | — | — | **Roles** | — | — | **GAP-036** |
| Automation | Notif* | Missing | — | — | **Roles** | — | — | **GAP-036** |
| Archiving | — | Missing | — | — | Roles | — | — | — |

*Notif = related but separate Telegram bot configuration, not integrated.

---

## Rollback / documentation index

| Doc | Purpose |
|-----|---------|
| This file | Cross-module SSOT for DH-CROSS-1 |
| [`DATAHUB_SETTINGS_DEPENDENCY_AUDIT.md`](./DATAHUB_SETTINGS_DEPENDENCY_AUDIT.md) | Prior Settings-focused audit (DEP-001–008) |
| [`DATAHUB_HIGH_RISK_EXECUTION_PLAN.md`](./DATAHUB_HIGH_RISK_EXECUTION_PLAN.md) | Per-action execution gates |
| [`DATAHUB_DRY_RUN_RUNTIME_RESULTS.md`](./DATAHUB_DRY_RUN_RUNTIME_RESULTS.md) | D-01 pass; D-02/D-03 NO-GO |
| [`GAPS_AND_PLAN.md`](./GAPS_AND_PLAN.md) | GAP-009–036 tracker |

---

## Final recommendation

1. **Do not proceed with high-risk DataHub execution** until **GAP-036** and **GAP-009/011** are addressed or explicitly accepted with compensating controls.

2. **Treat DataHub as data-plane canonical** — do not move publisher/crawler/automation config into Settings without SSOT revision.

3. **Next safest engineering work (not runtime execution):**
   - P0 RBAC on Core writes (backend + UI hide)
   - P0 reconcile telegram analytics auth (CROSS-002)
   - P1 operator cross-links for Telegram triad

4. **Next safest runtime execution candidate** (after approvals, unchanged from DH-FINAL-6): **Prioritization Override** on single test source — does not depend on Settings integration.

5. **Do not start new feature implementation** until P0 cross-module blockers are triaged in sprint planning.

---

## Changelog

| Date | Change |
|------|--------|
| 2026-05-30 | DH-CROSS-1 initial cross-module dependency audit — docs only |
