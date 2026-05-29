# DataHub ↔ Settings Dependency Audit

> **Scope:** Read-only audit of DataHub tab/subtab dependencies on main Settings areas.  
> **Date:** 2026-05-27  
> **Context:** Backend recovery confirmed; prior DataHub warnings resolved. User tested UI successfully.  
> **Rules followed:** docs only — no code, migration, restart, deploy, or smoke.

---

## Executive summary

DataHub is **mostly self-contained** at the API/UI layer: core tabs and Advanced features read/write PostgreSQL via `/api/v1/data-sources`, `/api/v1/data-categories`, and `/api/v1/data-hub/*`. There is **no programmatic navigation** from DataHub panels into Settings today.

The **main Settings overlap** is **Telegram** — three parallel configuration surfaces exist:

| Surface | Purpose | Canonical today |
|--------|---------|-----------------|
| **DataHub → Telegram** | Ingest: collector login, channel sync, message fetch | Collector microservice + DataHub tab |
| **DataHub → Advanced → Telegram Publisher** | Outbound publish: bot token, channel, template | PostgreSQL `telegram_publishers` |
| **Settings → Notifications** | User alert bot: trades/alerts/news to personal chat | `user_preferences` / NotificationsSettings |

**Connections** (exchange API keys) and **Wallet** are **not** used by DataHub. **Security / User Management** affect DataHub only via **global JWT + role** (`authenticate`, `authorize('admin','trader')` on write routes) — not via Settings UI coupling.

**Risk:** Settings → **Clear Cache** wipes IndexedDB (including legacy `data_hub_state`) with **no DataHub-specific warning**. Legacy IndexedDB paths and orphan `AutomationSettings.tsx` create **duplicate Telegram publisher config** that is not wired to the active UI.

---

## Settings menu reference

Defined in `components/Settings.tsx`:

| Settings tab | ID | Component | Admin-only | Relevant to DataHub? |
|--------------|-----|-----------|------------|-------------------|
| Profile | `profile` | `ProfileSettings` | No | Indirect (user identity for audit `created_by`) |
| Configuration | `configuration` | `ConfigurationSettings` | Yes | Name collision only — not DataHub feature settings |
| Connections | `connections` | `ConnectionsSettings` | No | **No** — exchange keys only (MEXC etc.), not Telegram collector |
| Wallet | `wallet` | `WalletSettings` | No | **No** |
| Notifications | `notifications` | `NotificationsSettings` | No | **Partial** — separate Telegram alert bot |
| Email Configuration | `email` | `EmailSettings` | No | **No** |
| Appearance | `appearance` | `AppearanceSettings` | No | **Indirect** — theme/i18n only |
| Security | `security` | `SecuritySettings` | No | **Indirect** — session/password, not DataHub ACL |
| Clear Cache | `cache` | `CacheSettings` | No | **Yes** — clears IndexedDB including `data_hub_state` |
| User Management | `users` | `UsersSettings` | Yes | **Indirect** — roles gate backend write APIs |

**Orphan (not in Settings menu):** `components/settings/AutomationSettings.tsx` — legacy Telegram publisher config in IndexedDB; **not imported** anywhere.

---

## DataHub architecture (dependency context)

| Layer | Storage / service | Used by |
|-------|-------------------|---------|
| Backend REST | PostgreSQL | Sources, Categories, Pipeline, Logs, Health, all Advanced features |
| IndexedDB legacy | `settings` key `data_hub_state` via `fetchDataHubState()` | Collector snapshot merge, legacy advanced blobs |
| Telegram Collector | Separate service (`/api/telegram-collector/*`) | DataHub → Telegram tab |
| Auth | `titan_token` + role from JWT | All authenticated routes |

Active UI paths are **backend-first** (see `LEAK_PROOF_VERIFICATION.md`). Settings dependency is about **operational config ownership**, not primary data CRUD.

---

## Per-tab dependency assessment

### Core tabs

| DataHub tab | Depends on Settings? | Summary |
|-------------|---------------------|---------|
| **Sources** | **Minimal** | Backend CRUD; Telegram sources link to DataHub Telegram tab, not Settings Connections |
| **Categories** | **No** | Fully backend `/api/v1/data-categories` |
| **Pipeline** | **No** | Backend `/api/v1/data-sources/pipeline` |
| **Health** | **Minimal** | Backend health/stats; `cache_hit_rate` label is N/A (not Settings cache) |
| **Logs** | **No** | Backend `/api/v1/data-sources/access-logs` |
| **Telegram** | **Yes (Telegram + cache)** | Collector credentials in DataHub; error copy mentions "Settings" incorrectly; IndexedDB collector snapshot affected by Clear Cache |

### Advanced subtabs

| Advanced subtab | Depends on Settings? | Summary |
|-----------------|---------------------|---------|
| **Crawlers** | **No** | `/api/v1/data-hub/crawlers`; links to Sources for `source_id` |
| **Discovery** | **No** | `/api/v1/data-hub/discovery`; local "settings" = feature DB settings, not app Settings |
| **Prioritization** | **No** | `/api/v1/data-hub/prioritization`; same naming collision as Discovery |
| **Access Control** | **Indirect (RBAC)** | DataHub ACL per source; global roles from User Management; not Settings Security UI |
| **Safety Filtering** | **No** | `/api/v1/data-hub/filter-rules` |
| **Telegram Publisher** | **Yes (Telegram triad)** | Own bot/channel config; overlaps Notifications bot; see deep dive below |
| **Automation Routing** | **Yes (Publisher + agents)** | Uses Telegram Publisher picklist; agents from AI layer, not Settings |
| **Archiving** | **No** | `/api/v1/data-hub/archiving` |

---

## Dependency matrix

| DataHub area | Depends on Settings area | Dependency type | Current status | Required action |
|--------------|--------------------------|-----------------|----------------|-----------------|
| **Sources** | Profile | user management / audit | JWT user on mutations | None — works via auth |
| **Sources** | Clear Cache | cache / local storage | IndexedDB `data_hub_state` wiped on clear; active CRUD is backend | v3.1: warn in CacheSettings or stop using IndexedDB for merge |
| **Sources** | Connections | API key / provider config | **Not coupled** — exchange keys unrelated | None; do not route Telegram apiId/apiHash to Connections without design decision |
| **Categories** | — | — | Independent | None |
| **Pipeline** | — | — | Independent | None |
| **Health** | Clear Cache | cache / local storage | UI shows `cache_hit_rate: N/A`; not wired to Settings or IndexedDB cache | v3.1: GAP-035 real metrics or remove label |
| **Logs** | Security / User Management | security / RBAC | `authenticate` only on read (GAP-014) | v3.1: optional `authorize` for analyst/admin |
| **Telegram (ingest)** | Notifications | Telegram account/channel config | **Duplicate concern** — separate bots: collector vs alert bot | Document; v3.1: cross-link UI |
| **Telegram (ingest)** | Connections | API key / provider config | apiId/apiHash entered in DataHub `TelegramLoginWizard`, not Connections | v3.1: optional centralize Telegram API credentials |
| **Telegram (ingest)** | Security | security / session | `SESSION_EXPIRED` message says "Settings" but login is DataHub → Telegram | **v3.0 polish:** fix error copy |
| **Telegram (ingest)** | Clear Cache | cache / local storage | Collector snapshot in IndexedDB | v3.1: warn on clear or drop legacy merge |
| **Crawlers** | Sources (DataHub) | data dependency | `source_id` from data-sources | None — in-DataHub |
| **Discovery** | — | — | Feature-local settings in DB | None |
| **Prioritization** | — | — | Feature-local settings in DB | None |
| **Access Control** | User Management | security / RBAC | Write: `admin`/`trader`; read: any authenticated | v3.1: align read roles (GAP-009 pattern) |
| **Access Control** | Configuration → Security | security / RBAC | **Name collision only** — AI Manager redirects to app Security config, not DataHub ACL | Document; no merge without design |
| **Safety Filtering** | — | — | Independent | v3.1: GAP-025 enforce on publish path |
| **Telegram Publisher** | Notifications | notification delivery config | **Separate bots** — publisher `bot_token` per channel vs alert `botToken`/`chatId` | See § Telegram Publisher; v3.1: delivery failure routing |
| **Telegram Publisher** | User Management | security / RBAC | Create/publish: `admin`/`trader` | v3.1: GAP-017 read role limits |
| **Telegram Publisher** | Telegram (ingest) | Telegram channel config | Ingest sources shown for mapping; **not** same as publish channel | Document ingest vs publish |
| **Automation Routing** | Telegram Publisher | publisher targets | `useTelegramPublishersQuery` for topic → publisher | None — correct in-DataHub dep |
| **Automation Routing** | Notifications | notification delivery | No integration with alert defaults | v3.1: optional notify on dispatch failure |
| **Archiving** | — | — | Independent | None |
| **All tabs** | Appearance | appearance / theme | Shared app theme + i18n | None |
| **All tabs** | Profile | user management | Display name / role in session | None |
| **All tabs** | Email Configuration | email config | **Not used** | None |
| **All tabs** | Wallet | wallet / trading account | **Not used** | None |

---

## Telegram Publisher — deep dive

### Where should channel/account config come from?

| Config item | Current source | Should it be Settings? |
|-------------|----------------|----------------------|
| **Publish channel** (`channel_id`, `channel_username`, `channel_title`) | DataHub Advanced → create modal → `POST /api/v1/data-hub/telegram-publishers` | **Canonical: DataHub** — operational publishing target |
| **Publish bot token** (`bot_token` → `bot_token_encrypted`) | Same modal / per-publisher row | **Canonical: DataHub** — one bot per publisher channel |
| **Message template** | Per publisher in DataHub | **Canonical: DataHub** |
| **Ingest Telegram sources** | `data_sources` type `telegram`; shown in publisher UI for reference | **Canonical: DataHub Sources + Telegram tab** |
| **Collector account** (user session, apiId/apiHash) | DataHub → Telegram tab + collector service | **Not Connections** today |
| **User alert bot** (trades, alerts, news) | Settings → Notifications (`botToken`, `chatId`, templates) | **Canonical: Settings → Notifications** |

### Should it be Settings → Connections?

**No, not with current design.** `ConnectionsSettings` manages **exchange API keys** (e.g. MEXC), not Telegram MTProto/apiId/apiHash or publish bots. Routing publisher config to Connections would **blur trading vs data-plane** concerns unless explicitly redesigned.

**Optional v3.1:** a **Telegram credentials** subsection under Connections (apiId/apiHash for collector only), with DataHub Telegram tab consuming it read-only.

### Should publish permissions come from Settings → Security / User Management?

**Partially, already at API layer:**

- Writes: `authenticate` + `authorize('admin', 'trader')` on `telegram-publishers` routes.
- Reads: `authenticate` only (GAP-017).

**Not** from Settings Security UI (password, 2FA, etc.). **User Management** defines roles that backend `authorize()` checks — indirect, correct.

DataHub **Access Control** is **per-source agent ACL**, not publisher permissions — separate concern.

### Should notification defaults come from Settings → Notifications?

**Not today.** Publisher sends via its own `bot_token`. Automation dispatch calls publisher publish API — does not use Notifications templates, rate limits, or quiet hours.

**v3.1 opportunity:** on publish failure, optionally fan-out to Settings Notifications bot using `errors` template.

### Duplicate config today?

| # | Location | Storage | Active UI? |
|---|----------|---------|------------|
| 1 | DataHub Advanced → Telegram Publisher | PostgreSQL `telegram_publishers` | **Yes** |
| 2 | IndexedDB `data_hub_state.advanced.telegramPublishers` | Legacy `api.createTelegramPublisher` in `services/api.ts` | **No** |
| 3 | `AutomationSettings.tsx` | IndexedDB `settings.automation.telegramConfigs` | **No** (orphan component) |
| 4 | Settings → Notifications | User preferences telegram alert config | **Yes** (different purpose) |
| 5 | DataHub → Telegram collector | Collector service DB | **Yes** (ingest) |

### Canonical source recommendation

| Concern | Canonical owner |
|---------|-----------------|
| Outbound publish (bot, channel, template, history) | **DataHub → Advanced → Telegram Publisher** |
| Inbound collect (login, channels, messages) | **DataHub → Telegram** + collector service |
| User personal alerts | **Settings → Notifications** |
| Exchange trading keys | **Settings → Connections** |
| Global roles for API write | **User Management** + backend `authorize()` |
| Per-source agent access | **DataHub → Advanced → Access Control** |

---

## Gaps

| ID | Gap | Severity | Version |
|----|-----|----------|---------|
| DEP-001 | Three Telegram config surfaces without cross-links (ingest / publish / alerts) | Medium | v3.1 |
| DEP-002 | `SESSION_EXPIRED` error points to Settings; collector re-login is DataHub → Telegram | Low | **v3.0 polish** |
| DEP-003 | Clear Cache wipes IndexedDB `data_hub_state` with no DataHub warning | Medium | v3.1 |
| DEP-004 | Orphan `AutomationSettings.tsx` duplicates Telegram publisher model | Low | v3.1 cleanup |
| DEP-005 | Legacy IndexedDB publisher/crawler/automation helpers in `services/api.ts` | Low | v3.1 cleanup (see LEAK_PROOF_VERIFICATION) |
| DEP-006 | No deep-link from DataHub Advanced hints to related Settings (Notifications) or Telegram tab | Low | v3.1 UX |
| DEP-007 | Discovery/Prioritization "settings" API naming collides mentally with app Settings | Low | docs/i18n only |
| DEP-008 | RBAC inconsistency: Advanced write routes use `authorize`; Sources/Categories/Logs read do not (GAP-009, GAP-011, GAP-014) | Low | v3.1 |

**Not gaps for this audit:** Backend-first wiring for core tabs and Advanced features (closed in GAPS_AND_PLAN.md).

---

## Architecture recommendations

### 1. Keep DataHub as data-plane control surface

Sources, pipeline, advanced rules, publishers, and automation should remain **configured in DataHub**. Settings should supply **identity, roles, personal notifications, trading connections, and global cache**.

### 2. Telegram: document the triad, don't merge blindly

```
Ingest (collector)  →  DataHub Telegram tab
Publish (outbound)  →  DataHub Telegram Publisher
Alerts (user)       →  Settings Notifications
```

Add UI cross-links in v3.1 (hint banners already exist but copy is generic).

### 3. Dependency-aware polish (next sprint order)

1. Fix `errorHandler.ts` SESSION_EXPIRED copy → point to DataHub → Telegram.
2. Enrich `telegram_publisher_hint` / `telegram_automation_hint` i18n with explicit Settings/Notifications distinction.
3. CacheSettings: optional checkbox label "Includes legacy DataHub local state".
4. Remove or archive `AutomationSettings.tsx` after confirming zero imports.

### 4. Do not move publisher config to Settings without SSOT change

Publisher is operational data-hub infrastructure tied to automation dispatch and filter rules (GAP-025). Settings Notifications is user-centric alert delivery.

---

## v3.0 blockers vs v3.1

### v3.0 blockers (from this audit)

| Item | Blocker? | Notes |
|------|----------|-------|
| Settings dependency confusion in production | **No** | User confirmed warnings gone after backend recovery |
| Duplicate publisher UI in Settings | **No** | Orphan component unwired |
| Missing Connections integration | **No** | By design |
| Clear Cache destroying IndexedDB | **No** | Active paths backend-first; degraded collector merge only |

**No new v3.0 blocker** identified by this audit. Remaining items are polish and consolidation.

### v3.1 (dependency-aware backlog)

| Priority | Item |
|----------|------|
| P1 | DEP-001 cross-link Telegram triad in UI + docs |
| P1 | DEP-002 fix SESSION_EXPIRED copy |
| P2 | DEP-003 CacheSettings DataHub warning |
| P2 | GAP-025 filter rules on publish/automation path |
| P2 | GAP-017 publisher read RBAC |
| P3 | DEP-004/005 legacy cleanup (AutomationSettings, IndexedDB helpers) |
| P3 | Optional: centralize Telegram apiId/apiHash under Connections |
| P3 | Optional: dispatch failure → Notifications bot |

---

## Evidence index (code)

| Area | Primary files |
|------|----------------|
| Settings shell | `components/Settings.tsx` |
| Notifications Telegram | `components/settings/NotificationsSettings.tsx` |
| Connections (exchange only) | `components/settings/ConnectionsSettings.tsx` |
| Clear cache | `components/settings/CacheSettings.tsx` |
| Orphan automation | `components/settings/AutomationSettings.tsx` |
| DataHub entry | `components/ai/AIManager/tabs/DataHubTab.tsx` |
| State merge | `components/ai/AIManager/tabs/DataHub/hooks/useDataHub.ts`, `hooks/useDataHubState.ts` |
| Telegram Publisher | `components/ai/AIManager/tabs/DataHub/advanced/TelegramPublisher.tsx` |
| Automation → publishers | `components/ai/AIManager/tabs/DataHub/advanced/AutomationTopics.tsx` |
| Advanced hints | `components/ai/AIManager/tabs/DataHub/AdvancedFeatures.tsx` |
| Collector login | `components/ai/AIManager/tabs/DataHub/TelegramLoginWizard.tsx` |
| Error copy | `components/ai/AIManager/tabs/DataHub/utils/errorHandler.ts` |
| Backend publishers | `backend/routes/telegram-publishers.js` |
| Backend v1 mount | `backend/routes/v1/index.js` |

---

## Next steps (agreed rhythm)

1. **Dependency-aware polish** — DEP-002, hint copy, optional cache warning (no schema/backend blocker).
2. **Remaining UX consistency** — tab/header redesign per stabilization plan.
3. **Final smoke** — on confirmed environment (backend `:5002` healthy).
