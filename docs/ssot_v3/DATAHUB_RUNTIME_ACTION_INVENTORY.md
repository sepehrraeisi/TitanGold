# DataHub Runtime Action Inventory (DH-FINAL-1)

> **Status:** Audit / docs only (no implementation)  
> **Date:** 2026-05-29  
> **Purpose:** Enumerate every important DataHub button/action so hidden 500s (like Discovery Scan / Prioritization Preview pre-`ca6226e`) are caught before new features.  
> **Related:** [`DATAHUB_ERROR_STATE_AUDIT.md`](./DATAHUB_ERROR_STATE_AUDIT.md) · [`DataHub_DEMOS.md`](./DataHub_DEMOS.md) · [`GAPS_AND_PLAN.md`](./GAPS_AND_PLAN.md)

---

## Auth patterns (reference)

| Layer | Pattern | Applies to |
|-------|---------|------------|
| **Core read** | `authenticate` + `readRateLimiter` | `/api/v1/data-sources/*`, `/api/v1/data-categories/*` |
| **Core write** | `authenticate` + `writeRateLimiter` (no role gate) | Sources/Categories CRUD, test-connection, telegram-sync |
| **Advanced read** | `authenticate` + `readRateLimiter` | `/api/v1/data-hub/*` GET |
| **Advanced write** | `authenticate` + `authorize('admin','trader')` + `writeRateLimiter` | Discovery scan, prioritization preview/apply, crawlers run, automation dispatch, archiving mutate, filter-rules CRUD, publishers mutate |
| **Access Control write** | `authenticate` + `authorize('admin','trader')` | POST/DELETE `/api/v1/data-hub/access-control/:sourceId` |
| **Telegram analytics** | Mixed: `/health` open; feed/breaking/events need `authenticate`; `mark-processed` needs `authenticate` + write limiter | `/api/v1/telegram/*` |
| **Telegram collector** | Separate service `/api/telegram-collector/*`; UI uses `credentials: 'include'` | Collector login, channels, test fetch |

**UI error sanitization (UX-2):** Core + Advanced panels use `formatDataHubQueryError` / `DataHubAlert` for list/query errors. Mutation errors may still surface generic `datahub_error_generic` on HTTP 500.

---

## Action matrix — Core

### Sources (`DataSourcesPanel`, modals, `useDataHub`)

| Area | Action/Button | Frontend handler | Endpoint | Method | Auth/Role | Expected success | Known failure modes | Current status |
|------|---------------|------------------|----------|--------|-----------|------------------|---------------------|----------------|
| Sources | Refresh list | `refetchSources()` | `/api/v1/data-sources?page&limit` | GET | authenticate | List + pagination refresh | 401; 500; network → `DataHubAlert` + retry | Unverified |
| Sources | Export CSV | `handleExport` → `downloadCSV` | *(client only)* | — | — | CSV download | **Bug:** args reversed (`filename`, `data`) vs `downloadCSV(data, filename)` → broken export | Known bug |
| Sources | Add source (open modal) | `setShowCreateSourceModal(true)` | — | — | — | Modal open | — | N/A |
| Sources | Create source | `handleCreateSource` → `createDataSource` | `/api/v1/data-sources/` | POST | authenticate | 201; list invalidate | 409 duplicate; 400 validation; 500 | Unverified |
| Sources | Update source | `handleUpdateSource` → `updateDataSource` | `/api/v1/data-sources/:id` | PUT | authenticate | 200; modal close | 404; 409; 400 | Unverified |
| Sources | Test connection (row) | `handleTestSource` → `testDataSourceConnection` | `/api/v1/data-sources/test-connection` | POST | authenticate | Alert success | 422 test fail; network | Unverified |
| Sources | Test connection (modal) | `CreateSourceModal` → `testDataSourceConfiguration` | same | POST | authenticate | Inline result | same | Unverified |
| Sources | Soft delete | `handleDeleteSource(id, false)` | `/api/v1/data-sources/:id` | DELETE | authenticate | 204; `is_active=false` | 404; user cancel confirm | Unverified |
| Sources | Hard delete | `handleDeleteSource(id, true)` | `/api/v1/data-sources/:id?hard=true` | DELETE | authenticate | Row removed | **409** FK / related data | Unverified (high-risk) |
| Sources | Restore | `handleRestoreSource` | `/api/v1/data-sources/:id/restore` | PATCH | authenticate | Source active again | 400 already active; 404 | Unverified |
| Sources | View collected data | `ViewSourceDataModal` → `api.fetchCollectedData` | `/api/v1/data-sources/collected?source_id=…` | GET | authenticate | History table | 401/500; **client export path risk** if `fetchCollectedData` missing from active `api.ts` | Unverified |
| Sources | Pagination | `onPageChange` → `setSourcesPage` | GET with new page | GET | authenticate | Page changes | empty page | Unverified |
| Sources | Open Telegram tab | `setActiveView('telegram')` | — | — | — | Tab switch | — | N/A |

### Categories (`CategoriesPanel`, `CreateCategoryModal`)

| Area | Action/Button | Frontend handler | Endpoint | Method | Auth/Role | Expected success | Known failure modes | Current status |
|------|---------------|------------------|----------|--------|-----------|------------------|---------------------|----------------|
| Categories | Refresh | `refetchCategories()` | `/api/v1/data-categories/` | GET | authenticate | List refresh | 500; 401 | Unverified |
| Categories | Create | `handleCreateCategory` | `/api/v1/data-categories/` | POST | authenticate | 201 | 409 duplicate name; 400 | Unverified |
| Categories | Update | `handleUpdateCategory` | `/api/v1/data-categories/:id` | PUT | authenticate | 200 | 404; 409 | Unverified |
| Categories | Delete | `handleDeleteCategory` + confirm | `/api/v1/data-categories/:id` | DELETE | authenticate | Deleted message | **400** if N sources reference category name | Unverified |
| Categories | Export CSV | `downloadCSV(filteredCategoriesList, 'data-categories')` | client | — | — | CSV | disabled if empty | Unverified |
| Categories | Filter / reset | local state | — | — | — | UI filter only | — | N/A |

### Pipeline (`PipelinePanel`)

| Area | Action/Button | Frontend handler | Endpoint | Method | Auth/Role | Expected success | Known failure modes | Current status |
|------|---------------|------------------|----------|--------|-----------|------------------|---------------------|----------------|
| Pipeline | Refresh pipeline | `handleRefreshPipelineSnapshot` → `refetchPipeline` | `/api/v1/data-sources/pipeline` | GET | authenticate | Snapshot + history + normalization | 500 → sanitized `DataHubAlert` + retry | Unverified |
| Pipeline | Select snapshot | `setSelectedSnapshotId` | — (cached query) | — | — | History entry shown | — | N/A |
| Pipeline | Category/source filters | local state | — | — | — | Table filter | — | N/A |

### Health (`HealthPanel`)

| Area | Action/Button | Frontend handler | Endpoint | Method | Auth/Role | Expected success | Known failure modes | Current status |
|------|---------------|------------------|----------|--------|-----------|------------------|---------------------|----------------|
| Health | Refresh all | `refetchAll` (4 queries) | `/health`, `/stats`, `/state`, `/access-logs?limit=1` | GET | authenticate | Metrics populated | Partial fail → `datahub_health_load_error` + retry | Unverified |
| Health | Avg response / cache | hardcoded N/A | — | — | — | N/A + tooltip | GAP-035 | N/A (by design) |

### Logs (`LogsPanel`)

| Area | Action/Button | Frontend handler | Endpoint | Method | Auth/Role | Expected success | Known failure modes | Current status |
|------|---------------|------------------|----------|--------|-----------|------------------|---------------------|----------------|
| Logs | Load (tab open) | `useAccessLogsQuery` | `/api/v1/data-sources/access-logs?limit=100` | GET | authenticate | Logs + statusCounts | 500 → sanitized alert | Unverified |
| Logs | Retry | `onRetry` → refetch | same | GET | authenticate | List reload | — | Unverified |
| Logs | Export CSV | `downloadCSV(filteredLogs, 'access-logs')` | client | — | — | CSV file | disabled if empty | Unverified |
| Logs | Filters / load more | local state | — | — | — | Client-side | — | N/A |

### Header summary (`DataHubSummaryCards`)

| Area | Action/Button | Frontend handler | Endpoint | Method | Auth/Role | Expected success | Known failure modes | Current status |
|------|---------------|------------------|----------|--------|-----------|------------------|---------------------|----------------|
| Summary | Retry KPI load | `summary.refetch` | `/stats` + `/health` | GET | authenticate | KPI cards | 500 banner | Unverified |

### Telegram — Collector (`TelegramPanel`, `useDataHub`)

| Area | Action/Button | Frontend handler | Endpoint | Method | Auth/Role | Expected success | Known failure modes | Current status |
|------|---------------|------------------|----------|--------|-----------|------------------|---------------------|----------------|
| Telegram | Health check | `handleCollectorHealth` | `/api/telegram-collector/health` | GET | collector (cookie) | Status message | Collector offline | Unverified |
| Telegram | Diagnose | `handleDiagnoseCollector` | `/health`, `/session/status` | GET | collector | Diagnostic OK/fail | Network | Unverified |
| Telegram | Sync data sources | `handleSyncTelegramDataSources` | `/api/v1/data-sources/telegram-sync` | POST | authenticate | Created/updated counts | 500 | Unverified |
| Telegram | Login start | `handleStartCollectorLogin` | `/api/telegram-collector/login/start` | POST | collector | authId | FLOOD_WAIT; invalid phone | Unverified |
| Telegram | Login confirm | `handleConfirmCollectorLogin` | `…/login/confirm` | POST | collector | Session online | CODE_INVALID/EXPIRED | Unverified |
| Telegram | Login cancel | `handleCancelCollectorLogin` | `…/login/cancel` | POST | collector | Cancelled | — | Unverified |
| Telegram | Load accounts | `loadAccounts` | `/api/telegram-collector/accounts` | GET | include | Account list | HTTP error | Unverified |
| Telegram | Set primary / enable / logout | `updateAccount`, `handleLogoutAccount` | PATCH/POST accounts | PATCH/POST | include | Account updated | API error | Unverified |
| Telegram | Load channels | `loadCollectorChannels` | `/api/telegram-collector/collector-channels` | GET | include | Channel table | Load fail | Unverified |
| Telegram | Toggle active / assign / priority | PATCH handlers | `/collector-channels/:id` | PATCH | include | Channel updated | — | Unverified |
| Telegram | Test fetch (row) | `handleTestCollectorChannel` | `POST …/channels/:id/test` | POST | include | Preview latency | connection_error | Unverified |
| Telegram | Force sync | `handleForceSync` | `POST …/channels/:id/force-sync` | POST | include | Messages fetched | force_sync_failed | Unverified (high-risk) |
| Telegram | Link channel → source | `handleLinkChannelToSource` | `POST /api/v1/data-sources/` | POST | authenticate | Telegram source created | 409 duplicate | Unverified |
| Telegram | Import dialogs / register | `loadTelegramDialogs`, `registerSelectedChannels` | GET `/channels`, POST `/channels/register` | GET/POST | include | Channels registered | Partial register fail | Unverified (high-risk) |
| Telegram | View channel messages | `loadChannelMessages` | `GET …/channels/:id/messages` | GET | include | Modal messages | No usable account | Unverified |
| Telegram | Refresh channels (hook) | `handleRefreshCollectorChannels` | `POST …/channels/refresh` | POST | include | Channels refreshed | **No UI button wired** in panel | Unverified / UI gap |
| Telegram | Account metrics (auto) | `useEffect` | `/api/v1/data-sources/telegram-account-metrics` | GET | authenticate | 24h counts | Silent fail | Unverified |

### Telegram — Analytics (`TelegramDataPanel` + children)

| Area | Action/Button | Frontend handler | Endpoint | Method | Auth/Role | Expected success | Known failure modes | Current status |
|------|---------------|------------------|----------|--------|-----------|------------------|---------------------|----------------|
| Telegram Data | Refresh | `fetchHealth` + `fetchAgents` | `/api/v1/telegram/health`, `/agents/summary?timeRange` | GET | health open; summary rate-limited | Metrics + overview | Agents fail → sanitized alert; health fail silent | Partial (UX-2 error i18n) |
| Telegram Data | Time range | `setTimeRange` | summary with new range | GET | — | Refetch | — | Unverified |
| Telegram Data | Overview load | mount + refresh | same | GET | — | `systemStats` or empty state | Empty after load → `DataHubEmpty` | Partial (UX-2) |
| Telegram Data | Agent feed | `AgentDetailPanel` fetch | `/api/v1/telegram/agents/:key/feed` | GET | authenticate | Message list | 400/404 | Unverified |
| Telegram Data | Mark processed | `handleMarkProcessed` | `/api/v1/telegram/agents/:key/mark-processed` | POST | authenticate | Message removed from list | **Bug:** POST without `Authorization` header → likely 401; error only in console | Known bug |
| Telegram Data | Categories tab | `CategoryBreakdown` | `/categories/summary`, `/categories/:cat/timeline` | GET | mixed | Charts | axios error inline | Unverified |
| Telegram Data | Breaking news | `BreakingNewsMonitor` | `/api/v1/telegram/breaking-news` | GET | authenticate | News cards | 401 | Unverified |
| Telegram Data | Geographic map | `GeographicHeatMap` | `/api/v1/telegram/events/recent` | GET | authenticate | Heat map | 401/500 | Unverified |

---

## Action matrix — Advanced

### Crawlers (`WebCrawlerConfig`)

| Area | Action/Button | Frontend handler | Endpoint | Method | Auth/Role | Expected success | Known failure modes | Current status |
|------|---------------|------------------|----------|--------|-----------|------------------|---------------------|----------------|
| Crawlers | Refresh list | `refetch()` | `/api/v1/data-hub/crawlers` | GET | authenticate | List + summary | 500 | Unverified |
| Crawlers | Create | `handleSave` (create) | `/api/v1/data-hub/crawlers` | POST | admin, trader | 201 crawler | 400; `RENDER_JS_DISABLED` | Unverified |
| Crawlers | Update | `handleSave` (edit) | `/api/v1/data-hub/crawlers/:id` | PUT | admin, trader | Updated | 404 | Unverified |
| Crawlers | Delete | `handleDelete` | `/api/v1/data-hub/crawlers/:id` | DELETE | admin, trader | Soft delete | 404 | Unverified |
| Crawlers | Dry run | `handleRun(id, true)` | `/api/v1/data-hub/crawlers/:id/run` `{dry_run:true}` | POST | admin, trader | Run success; no ingest | **403** `FILTER_BLOCKED_PRE_CRAWL`; timeout | Unverified (high-risk) |
| Crawlers | Run (live) | `handleRun(id, false)` | same `{dry_run:false}` | POST | admin, trader | Items ingested/blocked counts | Filter block; fetch fail | Unverified (high-risk) |
| Crawlers | View run history | `useCrawlerRunsQuery` | `/api/v1/data-hub/crawlers/:id/runs` | GET | authenticate | Runs list | 404 | Unverified |

### Discovery (`AutoDiscoveryConfig`)

| Area | Action/Button | Frontend handler | Endpoint | Method | Auth/Role | Expected success | Known failure modes | Current status |
|------|---------------|------------------|----------|--------|-----------|------------------|---------------------|----------------|
| Discovery | Enable toggle | `settingsMut.mutate` | `/api/v1/data-hub/discovery/settings` | PATCH | admin, trader | Settings updated | 500 | Unverified |
| Discovery | **Scan for sources** | `scanMut.mutate()` | `/api/v1/data-hub/discovery/scan` | POST | admin, trader | `{ status: success, added, duplicates, blocked }` | Was 500 schema drift; disabled when off | **Verified** (`ca6226e`) |
| Discovery | Refresh stats | `refetch()` | `/discovery/stats`, `/suggestions` | GET | authenticate | Dashboard cards | Query fail → banner (UX-2) | Partial |
| Discovery | Approve suggestion | `handleApprove` | `/discovery/suggestions/:id/approve` | POST | admin, trader | New `data_sources` row | 404; **403** FILTER_BLOCKED; 409 | Unverified (high-risk) |
| Discovery | Reject suggestion | `handleReject` | `/discovery/suggestions/:id/reject` | POST | admin, trader | `status=rejected` | 404 not pending | Unverified |
| Discovery | Add rule | `createRuleMut` | `/discovery/rules` | POST | admin, trader | 201 rule | 400 | Unverified |
| Discovery | Delete rule | `deleteRuleMut` | `/discovery/rules/:id` | DELETE | admin, trader | Soft delete | 404 | Unverified |
| Discovery | History tab | UI only | — | — | — | Placeholder hint | No API wired | N/A |

### Prioritization (`SmartPrioritization`)

| Area | Action/Button | Frontend handler | Endpoint | Method | Auth/Role | Expected success | Known failure modes | Current status |
|------|---------------|------------------|----------|--------|-----------|------------------|---------------------|----------------|
| Prioritization | Enable toggle | `settingsMut.mutate` | `/prioritization/settings` | PUT | admin, trader | Settings saved | **400** `INVALID_WEIGHTS` | Unverified |
| Prioritization | Configure weights | modal save | same | PUT | admin, trader | Weights persisted | sum ≠ 100 blocked in UI | Unverified |
| Prioritization | **Preview** | `previewMut.mutate()` | `/api/v1/data-hub/prioritization/preview` | POST | admin, trader | Run + 48 sources + tier summary | Was 500 schema drift; **400** if disabled | **Verified** (`ca6226e`) |
| Prioritization | Apply | `applyMut.mutateAsync` + confirm | `/prioritization/apply` `{confirm_apply:true}` | POST | admin, trader | Writes `data_sources.priority*` | **400** confirm required; disabled if no sources | Unverified (high-risk) |
| Prioritization | Override score | `overrideMut.mutateAsync` | `/prioritization/sources/:id/override` | PUT | admin, trader | Override saved | 404 source | Unverified |
| Prioritization | Reset override | `override_score: null` | same | PUT | admin, trader | Override cleared | 404 | Unverified |
| Prioritization | Refresh | `refetch()` | `/settings`, `/sources`, `/runs` | GET | authenticate | Fresh data | 500 | Unverified |

### Access Control (`AccessControlPanel`)

| Area | Action/Button | Frontend handler | Endpoint | Method | Auth/Role | Expected success | Known failure modes | Current status |
|------|---------------|------------------|----------|--------|-----------|------------------|---------------------|----------------|
| Access | Refresh | `refetch()` | `/api/v1/data-hub/access-control/` | GET | authenticate | Rules per source | 500 | Unverified |
| Access | Configure → Save | `handleSave` | `/access-control/:sourceId` | POST | admin, trader | ACL upsert | 400 validation | Unverified |
| Access | Reset rules | `handleReset` | `/access-control/:sourceId` | DELETE | admin, trader | Defaults restored | **404** no custom rules | Unverified |

### Safety Filtering (`BlacklistWhitelist`)

| Area | Action/Button | Frontend handler | Endpoint | Method | Auth/Role | Expected success | Known failure modes | Current status |
|------|---------------|------------------|----------|--------|-----------|------------------|---------------------|----------------|
| Safety | Refresh | `refetch()` | `/api/v1/data-hub/filter-rules` | GET | authenticate | Rules list | 500 | Unverified |
| Safety | Create rule | `handleSave` (create) | `/filter-rules` | POST | admin, trader | 201 | **409** duplicate; 400 regex | Unverified |
| Safety | Update rule | `handleSave` (edit) | `/filter-rules/:id` | PUT | admin, trader | Updated | 404 | Unverified |
| Safety | Delete rule | `handleDelete` | `/filter-rules/:id` | DELETE | admin, trader | Soft delete | 404 | Unverified |
| Safety | Evaluate | `evaluateMut.mutate` | `/filter-rules/evaluate` | POST | authenticate (read) | `{ allowed, reason }` | 500 | Unverified |

### Telegram Publisher (`TelegramPublisher`)

| Area | Action/Button | Frontend handler | Endpoint | Method | Auth/Role | Expected success | Known failure modes | Current status |
|------|---------------|------------------|----------|--------|-----------|------------------|---------------------|----------------|
| Publisher | Refresh list | `refetch()` | `/api/v1/data-hub/telegram-publishers` | GET | authenticate | Publishers + metrics | 500 → sanitized (UX-2) | Partial |
| Publisher | Create channel | `handleCreate` | `/telegram-publishers/` | POST | admin, trader | 201 | 400 | Unverified |
| Publisher | Test | `handleTest` | `/telegram-publishers/:id/test` | POST | admin, trader | dry_run or sent test | 404; Telegram API fail | Unverified (high-risk) |
| Publisher | Publish (live) | `handlePublish` + confirm | `/telegram-publishers/:id/publish` | POST | admin, trader | Message sent or dry_run | **400** no confirm; no token → dry_run | Unverified (high-risk) |
| Publisher | Disable | `handleDisable` | `/telegram-publishers/:id` | DELETE | admin, trader | Channel disabled | 404 | Unverified |
| Publisher | History tab | `usePublisherHistoryQuery` | `/telegram-publishers/:id/history` | GET | authenticate | Delivery rows | 404 | Unverified |

### Automation Routing (`AutomationTopics`)

| Area | Action/Button | Frontend handler | Endpoint | Method | Auth/Role | Expected success | Known failure modes | Current status |
|------|---------------|------------------|----------|--------|-----------|------------------|---------------------|----------------|
| Automation | Load overview | `useAutomationOverviewQuery` | `/api/v1/data-hub/automation/overview` | GET | authenticate | Topics, queue, schedule | 500 → sanitized (UX-2) | Partial |
| Automation | Create topic | `handleSaveTopic` (create) | `/automation/topics` | POST | admin, trader | Topic created | 400 | Unverified |
| Automation | Update topic | `handleSaveTopic` (edit) | `/automation/topics/:id` | PUT | admin, trader | Updated | 404 | Unverified |
| Automation | Delete topic | `handleDeleteTopic` | `/automation/topics/:id` | DELETE | admin, trader | Removed | 404 | Unverified |
| Automation | Refresh queue | `handleRefreshAutomation` | `/automation/queue/refresh` | POST | admin, trader | `{ added, queue }` | 500 | Unverified |
| Automation | Dispatch queue | `handleDispatchAutomation` | `/automation/queue/dispatch` | POST | admin, trader | Processed + executions | Empty queue; publisher fail | Unverified (high-risk) |
| Automation | Dispatch single item | `handleProcessQueueItem('sent')` | `/automation/queue/:id/dispatch` | POST | admin, trader | Item dispatched | 404; not pending | Unverified (high-risk) |
| Automation | Fail queue item | `handleProcessQueueItem('failed')` | `/automation/queue/:id` | PATCH | admin, trader | Marked failed | 404 | Unverified |
| Automation | Test run (dry) | `handleTestRun` | `/automation/test-run` | POST | admin, trader | Dry dispatch | No active topic | Unverified |
| Automation | Toggle schedule | `handleToggleSchedule` | `/automation/schedule` | PUT | admin, trader | Schedule on/off | 500 | Unverified |
| Automation | Change interval | `handleUpdateScheduleInterval` | same | PUT | admin, trader | Interval updated | 500 | Unverified |
| Automation | Retry execution | `handleRetry` | `/automation/executions/:id/retry` | POST | admin, trader | Re-queued | 404 | Unverified |

### Archiving (`Archiving`)

| Area | Action/Button | Frontend handler | Endpoint | Method | Auth/Role | Expected success | Known failure modes | Current status |
|------|---------------|------------------|----------|--------|-----------|------------------|---------------------|----------------|
| Archiving | Load dashboard | `useArchiveStatsQuery` | `/api/v1/data-hub/archiving/stats` | GET | authenticate | Health + partitions | 500 → banner (UX-2) | Partial |
| Archiving | Archive preview | `previewArchiveMut` | `/archiving/archive/preview` | POST | admin, trader | `pending_count` | 400 invalid days | Unverified |
| Archiving | Archive execute | `executeArchiveMut` + confirm | `/archiving/archive` `{confirm_archive:true}` | POST | admin, trader | Rows archived | **400** confirm required | Unverified (high-risk) |
| Archiving | Restore preview | `previewRestoreMut` | `/archiving/restore/preview` | POST | admin, trader | Preview count | Bad date range | Unverified |
| Archiving | Restore execute | `executeRestoreMut` + confirm | `/archiving/restore` `{confirm_restore:true}` | POST | admin, trader | Records restored | **400** confirm required | Unverified (high-risk) |
| Archiving | Purge preview | `previewPurgeMut` | `/archiving/purge/preview` | POST | admin, trader | `would_purge_count` only | v3: no purge apply in UI | Unverified |

---

## High-risk actions

Actions that **mutate production data**, **send external messages**, or **require explicit confirm** — prioritize in runtime QA.

| Priority | Action | Why high-risk |
|----------|--------|----------------|
| P0 | Prioritization **Apply** | Writes `data_sources.priority`, `priority_score` for all/all-selected sources |
| P0 | Publisher **Publish** (live) | Outbound Telegram message; needs bot token + confirm |
| P0 | Automation **Dispatch queue** / **Dispatch item** | Triggers publisher path; dry-run toggle easy to miss |
| P0 | Archiving **Archive execute** / **Restore execute** | Moves/restores `ai_decisions` partitions |
| P0 | Discovery **Approve** | Creates real `data_sources` row from suggestion |
| P1 | Crawler **Run (live)** | Ingests into `collected_data`; pre-crawl + per-item filter |
| P1 | Sources **Hard delete** | Irreversible if no FK block |
| P1 | Telegram **Force sync** / **Register channels** | Collector + DB side effects |
| P1 | Filter rule **Create** with ingestion target | Affects live ingestion paths immediately |
| P2 | Prioritization **Override** | Manual score override with audit |
| P2 | Publisher **Test** | May hit Telegram API (dry_run depending on env) |
| P2 | Automation **Test run** | Dispatches first queue item (dry_run default) |

---

## Runtime verified (2026-05-29)

| Action | Evidence | Result |
|--------|----------|--------|
| Discovery **Scan** | `ca6226e`, `DataHub_DEMOS.md`, authenticated POST | **200** `status: success`; duplicates counted; no 500 |
| Prioritization **Preview** | `ca6226e`, `EVIDENCE.md` | **200**; 48 sources; tier summary `{low:45, high:2, critical:1}` |
| Backend health post-fix | pm2 restart + `GET /health` | **200** |
| Core/Advanced **query error sanitize** | UX-2 commits `4f09e00`–`6b2dc0f` | List/load errors show i18n not raw HTTP (not full action matrix) |

**Not verified:** Every other write action in tables above.

---

## Still unverified (summary)

| Bucket | Count (approx.) | Notes |
|--------|-----------------|-------|
| Core CRUD + test | 15+ | Sources/Categories mutations |
| Core read refresh | 6 | Pipeline, Health, Logs, Summary |
| Telegram collector | 15+ | Separate service; session/cookie dependent |
| Telegram analytics | 6 | Mark processed has **known auth header bug** |
| Advanced writes | 25+ | All except Discovery scan + Prioritization preview |
| Client-only | 5 | CSV exports, filters, tab switches |

---

## Known code risks (audit flags, not fixed in DH-FINAL-1)

| ID | Area | Issue | Impact |
|----|------|-------|--------|
| INV-001 | Sources Export CSV | `downloadCSV('data-sources', sources)` — filename/data args reversed vs `useDataHub.downloadCSV(data, filename)` | Export produces invalid/empty CSV |
| INV-002 | AgentDetailPanel | `mark-processed` POST without `Authorization` header | 401 in prod; silent console error |
| INV-003 | TelegramPanel | `handleRefreshCollectorChannels` in hook but no UI button | Users cannot manually refresh channels from panel |
| INV-004 | ViewSourceDataModal | Depends on `api.fetchCollectedData` — verify active export in `services/api.ts` | View data may fail at runtime |
| INV-005 | Core write routes | No `authorize('admin','trader')` on Sources/Categories (GAP-009/011) | Any authenticated user can mutate |

---

## Recommended test priority (next phase)

| Order | Focus | Actions to exercise |
|-------|-------|---------------------|
| 1 | **High-risk writes (dry-run first)** | Crawler dry-run → Publisher test (dry_run) → Automation test-run → Archiving archive **preview** |
| 2 | **High-risk writes (confirm paths)** | Discovery approve (one pending) → Prioritization apply (confirm modal) → Archiving archive execute on small window |
| 3 | **Core CRUD smoke** | Source create/update/soft-delete/restore; Category create/delete (empty category) |
| 4 | **Telegram collector** | Health → login flow (if session expired) → test fetch one channel → sync sources |
| 5 | **Telegram analytics fixes** | Mark processed **after INV-002 fix**; agent feed pagination |
| 6 | **Safety + access** | Filter evaluate blocked/allowed; Access Control upsert + reset |
| 7 | **Regression** | Re-run Discovery scan + Prioritization preview after any schema/service change |
| 8 | **Client bugs** | Sources CSV export (INV-001); View source collected data (INV-004) |

**Environment needs:** Valid admin/trader JWT; discovery/prioritization enabled in settings; at least one pending discovery suggestion for approve test; publisher with dry_run or test token for publish path.

---

## Changelog

| Date | Change |
|------|--------|
| 2026-05-29 | DH-FINAL-1 initial inventory — audit/docs only |
