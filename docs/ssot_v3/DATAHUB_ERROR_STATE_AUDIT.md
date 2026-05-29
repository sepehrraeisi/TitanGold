# DataHub Error / Empty / Loading State Audit (UX-2)

> **Status:** Audit + proposal only (no implementation)  
> **Date:** 2026-05-29  
> **Prerequisite:** UX-1 tab/header redesign complete (`DataHubTabStrip`, `DataHubSubTabBar`)  
> **Design reference:** [`DESIGN_SYSTEM_DATAHUB.md`](../../DESIGN_SYSTEM_DATAHUB.md)  
> **Dependency reference:** [`DATAHUB_SETTINGS_DEPENDENCY_AUDIT.md`](./DATAHUB_SETTINGS_DEPENDENCY_AUDIT.md)

---

## Executive summary

DataHub panels share **visual shell** (`DATAHUB_SHELL`, `DataHubAlert`, `DataHubEmpty`) but **not a unified error taxonomy**. Advanced panels mostly use `formatApiErrorForUi`; core panels and Telegram surfaces often show **raw `apiError.message`** or backend strings. `errorHandler.ts` defines rich 401/403/404/500 parsing but is **wired only to mutation `ErrorNotification`**, not fetch errors in panels.

**Highest-impact gaps:**

1. Core fetch errors (401/403/404) invisible or raw in Sources/Categories/Pipeline/Logs.
2. `formatApiErrorForUi` not applied consistently — Telegram Publisher, Automation, Telegram Panel/Data.
3. Query-load errors ignored in Discovery, Prioritization, Archiving (mutations only).
4. `ErrorNotification` prop mismatch (`onClose` vs `onDismiss`) — dismiss broken at tab level.
5. Loading UX split: Health uses skeletons; most panels use plain text `loading`.

---

## Standard target (UX-2)

| State | Target pattern |
|-------|----------------|
| **Loading** | `DataHubPanelLoading` — skeleton rows/metrics where data shape is known; else centered `text-xs text-muted-foreground` with i18n key |
| **Empty** | `DataHubEmpty` — title + optional hint + optional CTA (create/refresh) |
| **401** | i18n: auth required / session expired; link hint to login (app) or DataHub → Telegram (collector session) |
| **403** | i18n: permission denied; no retry unless role change |
| **404** | i18n: module unavailable in this environment |
| **500 / network** | `DataHubAlert` error variant + retry; message via `formatApiErrorForUi` or `parseDataHubError` |
| **Partial / degraded** | Explicit `N/A`, `—`, or status pill (`degraded`/`unhealthy`); never fake numbers |

**Proposed shared helper (implementation phase):**

```ts
// dataHubI18n.ts or dataHubUi.tsx
formatDataHubQueryError(t, error: DataHubApiError | Error | null): {
  message: string;
  variant: 'error' | 'warning';
  retryable: boolean;
  status?: number;
}
```

Wire `DataHubApiError.status` through all React Query hooks consistently.

---

## Shared infrastructure (current)

| Asset | File | Role | Gap |
|-------|------|------|-----|
| `DataHubAlert` | `dataHubUi.tsx` | Error/warning box + optional retry | No status-aware defaults |
| `DataHubEmpty` | `dataHubUi.tsx` | Single-line empty message | No title/hint/CTA slots |
| `formatApiErrorForUi` | `dataHubI18n.ts` | Maps raw HTTP strings to i18n | Not used in core/Telegram |
| `parseDataHubError` | `errorHandler.ts` | Full 401/403/404/500 taxonomy | Only mutation path via `useDataHub` |
| `ErrorNotification` | `components/ErrorNotification.tsx` | Parsed `DataHubError` banner | `DataHubTab` passes `onClose`; prop is `onDismiss` |
| `ApiWrapper` | `common/ApiWrapper.tsx` | Tab-level overlay + raw `ErrorAlert` | `setError` no-op in DataHubTab |
| `DataHubApiError` | `services/dataSourcesApi.ts` | `status` + `message` from API body | Status often unused in UI |

**i18n keys (exist):** `datahub_error_not_found`, `datahub_error_unauthorized`, `datahub_error_forbidden`, `datahub_error_generic`

---

## Surface matrix — Core panels

| Surface | File | Loading state | Empty state | Error state | Raw API error risk | Current issue | Proposed minimal fix |
|---------|------|---------------|-------------|-------------|-------------------|---------------|----------------------|
| **Sources** | `DataHub/DataSourcesPanel.tsx` | Text `sources_loading` when empty list | `DataHubEmpty` `no_data_sources` | `DataHubAlert`: 409 warning, ≥500 error+retry | **High** — `apiError.message` for 409/500; `source.lastError` raw in rows | 401/403/404 list fetch not surfaced; per-row errors leak | Route all `apiError` through `formatApiErrorForUi`; branch 401/403/404; sanitize `lastError` display |
| **Categories** | `DataHub/CategoriesPanel.tsx` | Text `categories_loading` | `DataHubEmpty` filtered vs empty variants | 409/400 warning, ≥500 error+retry | **High** — raw messages for 400/409/500/generic | Same as Sources | Same pattern as Sources |
| **Pipeline** | `DataHub/PipelinePanel.tsx` | Text `pipeline_loading` | `DataHubEmpty` top + inline sub-table empties | `DataHubAlert` + `pipelineError` retry | **High** — `pipelineApiError?.message` unsanitized | Error from hook without status branch | `formatApiErrorForUi(pipelineError)`; optional status branch |
| **Health** | `DataHub/HealthPanel.tsx` | Per-metric `SkeletonLoader` | None (always grid) | Generic `datahub_health_load_error` + retry | **Low** — no raw API text | Good degraded/N/A pattern; no empty when all queries fail silently | Keep generic message; add subtle banner if all queries error |
| **Logs** | `DataHub/LogsPanel.tsx` | Text `logs_loading` | `DataHubEmpty` `no_logs` | `DataHubAlert` + retry | **High** — `logsError` raw; row `log.error` raw (partial Telegram translate) | No 401/403 branch | `formatApiErrorForUi` on list error; extend `translateTelegramError` pattern |
| **Telegram Collector** | `DataHub/TelegramPanel.tsx` | Multiple `t('loading')` flags | Custom muted text (no `DataHubEmpty`) | Inline red/amber boxes | **Very high** — `error.message` throughout collector | Inconsistent with design system; SESSION_EXPIRED copy fixed in hints only | Gradual: red box → `DataHubAlert`; collector errors via `parseDataHubError` |
| **Telegram Analytics** | `DataHub/TelegramDataPanel.tsx` | Spinner on agents tab only | Agents emoji empty; overview needs `systemStats` | Inline red `error` | **High** — `err.response?.data?.message`, English fallback | Health fetch errors swallowed; overview no loading/empty | i18n errors; loading for overview; empty when stats null post-load |

---

## Surface matrix — Advanced panels

| Surface | File | Loading state | Empty state | Error state | Raw API error risk | Current issue | Proposed minimal fix |
|---------|------|---------------|-------------|-------------|-------------------|---------------|----------------------|
| **Crawlers** | `advanced/WebCrawlerConfig.tsx` | Text `loading` | Custom title/hint | `formatApiErrorForUi` + 400 RENDER_JS hint | **Medium** — `last_error`, run `error_message` raw | Query errors OK; per-row errors leak | Sanitize row-level error strings |
| **Discovery** | `advanced/AutoDiscoveryConfig.tsx` | Text `loading` | Custom empty title/hint | Mutations only via `formatApiErrorForUi` | **Low** for mutations | **Query errors not shown** | Add `DataHubAlert` for stats/suggestions query failure |
| **Prioritization** | `advanced/SmartPrioritization.tsx` | Text `loading` | Custom empty + `no_history` | Mutations via `formatApiErrorForUi` | **Low** for mutations | **Query errors not shown** | Surface settings/sources query errors |
| **Access Control** | `advanced/AccessControlPanel.tsx` | Text `loading` | Custom centered (not `DataHubEmpty`) | `formatApiErrorForUi` | **Low** | Empty not using `DataHubEmpty` | Swap to `DataHubEmpty`; already sanitized |
| **Safety Filtering** | `advanced/BlacklistWhitelist.tsx` | Text `loading` | Tab-specific empty + hint | List + evaluate via `formatApiErrorForUi` | **Low** | Evaluate shows API `reason` (OK) | Minor: unify empty to `DataHubEmpty` |
| **Telegram Publisher** | `advanced/TelegramPublisher.tsx` | Text `publisher_loading` / history loading | `DataHubEmpty` publishers/history | `DataHubAlert` list + actions | **High** — list `message` without `formatApiErrorForUi`; catch `e.message` | Settings dep: outbound vs Notifications (hints OK) | Apply `formatApiErrorForUi` to listError; sanitize action errors |
| **Automation Routing** | `advanced/AutomationTopics.tsx` | Text `automation_loading` | `DataHubEmpty` topics/history | `DataHubAlert` `combinedError` raw | **High** — joined `.message` strings | Depends on Publisher picklist | `formatApiErrorForUi` on combinedError |
| **Archiving** | `advanced/Archiving.tsx` | Text `loading` in table when busy | Partition/records/history empties | Mutations via `formatApiErrorForUi` | **Medium** — purge preview message raw | **Dashboard query errors not shown** | Surface stats query error; sanitize preview text |

---

## Cross-cutting issues

| ID | Issue | Severity | v3.0? |
|----|-------|----------|-------|
| ERR-001 | `ErrorNotification` `onClose` vs `onDismiss` in `DataHubTab.tsx` | High | **Yes** — one-line fix |
| ERR-002 | Core panels bypass `formatApiErrorForUi` | High | **Yes** — Sources, Categories, Pipeline, Logs |
| ERR-003 | Telegram Publisher + Automation raw list errors | High | **Yes** |
| ERR-004 | Query errors hidden (Discovery, Prioritization, Archiving) | Medium | **Yes** — small `DataHubAlert` additions |
| ERR-005 | Telegram Panel/Data raw error surfaces | High | **v3.1** — large file, collector coupling |
| ERR-006 | Loading inconsistency (text vs skeleton) | Low | **v3.1** — adopt skeleton pattern panel-by-panel |
| ERR-007 | `DataHubEmpty` missing title/CTA slots | Low | **v3.1** |
| ERR-008 | `errorHandler.ts` not used for fetch errors | Medium | **v3.0** — bridge via `formatDataHubQueryError` |
| ERR-009 | `ApiWrapper` raw `dataHubError` at tab root | Low | **v3.1** — bootstrap path shrinking |
| ERR-010 | TelegramDataPanel overview no loading/empty | Medium | **v3.0** — small UX gap |

---

## v3.0 vs v3.1 recommendation

### v3.0 (minimal, high ROI)

| Priority | Work item | Files | Est. |
|----------|-----------|-------|------|
| P0 | Fix `ErrorNotification` dismiss prop | `DataHubTab.tsx` | XS |
| P0 | Add `formatDataHubQueryError` helper using `DataHubApiError.status` + existing i18n keys | `dataHubI18n.ts` | S |
| P1 | Apply helper to core panels | `DataSourcesPanel`, `CategoriesPanel`, `PipelinePanel`, `LogsPanel` | S |
| P1 | Apply to Publisher + Automation | `TelegramPublisher.tsx`, `AutomationTopics.tsx` | S |
| P2 | Surface query errors | `AutoDiscoveryConfig`, `SmartPrioritization`, `Archiving` | S |
| P2 | TelegramDataPanel overview loading/empty + error i18n | `TelegramDataPanel.tsx` | S |

**No backend changes required** if `DataHubApiError.status` is already populated (confirmed in `dataSourcesApi.ts`).

### v3.1 (defer)

- Telegram Collector (`TelegramPanel.tsx`) full error pass — collector microservice messages, flood-wait UX
- Unified `DataHubPanelLoading` skeleton component
- Enhanced `DataHubEmpty` with title/description/action
- Health panel all-queries-failed banner
- Wire `parseDataHubError` fully to React Query global error boundary
- Crawlers per-row error sanitization

---

## 5-layer verification rule (for implementation)

Each panel touched in UX-2 must document:

| Layer | Check |
|-------|-------|
| **Frontend** | Loading/empty/error components render; dismiss/retry work |
| **Backend API** | Endpoint returns expected status; no new routes |
| **DB Data** | Empty = real zero rows; errors don't show fake metrics |
| **Design** | `DataHubAlert` / `DataHubEmpty` / slate palette |
| **Settings dependency** | 401 collector → DataHub Telegram hint; Publisher ≠ Notifications |

---

## Implementation sequence (proposal)

1. `fix(datahub): repair ErrorNotification dismiss prop` (ERR-001)
2. `refactor(datahub): add formatDataHubQueryError helper` (ERR-008)
3. `fix(datahub): sanitize core panel fetch errors` (ERR-002)
4. `fix(datahub): sanitize publisher and automation errors` (ERR-003)
5. `fix(datahub): surface advanced query load errors` (ERR-004, ERR-010)

One commit per step; `npm run build` after each.

---

## File index

| Path | Notes |
|------|-------|
| `components/ai/AIManager/tabs/DataHub/dataHubUi.tsx` | `DataHubAlert`, `DataHubEmpty` |
| `components/ai/AIManager/tabs/DataHub/dataHubI18n.ts` | `formatApiErrorForUi` |
| `components/ai/AIManager/tabs/DataHub/utils/errorHandler.ts` | `parseDataHubError` |
| `components/ai/AIManager/tabs/DataHub/components/ErrorNotification.tsx` | Tab-level mutations |
| `components/ai/AIManager/tabs/DataHubTab.tsx` | `ApiWrapper`, `ErrorNotification` |
| `components/ai/AIManager/tabs/DataHub/hooks/useDataHub.ts` | Error propagation to panels |
| `services/dataSourcesApi.ts` | `DataHubApiError` |

---

## Acceptance criteria (UX-2 implementation)

- [ ] All core panels use status-aware error messages (no raw `Not Found` / `Unauthorized` in UI)
- [ ] Publisher + Automation list errors sanitized
- [ ] Discovery/Prioritization/Archiving show query failure banner
- [ ] `ErrorNotification` dismiss works
- [ ] No new mock/fake data on error paths
- [ ] `npm run build` passes
- [ ] Mini 5-layer verification per touched panel in PR summary
