# Leak-Proof Verification (Pre-Merge)

Status: Read-only verification only  
Method: `rg` + import/hook/component tracing (no smoke, no runtime actions)

## Goal

Verify that active mock/local paths (`useDataHubQuery -> fetchDataHubState`, synthetic `useAgentsQuery` metrics) do not leak into user-visible DataHub values that are claimed as real/Implemented.

## Verification Matrix

| UI Surface | Value shown | Source hook/API | Can fallback leak? | Evidence | Result |
| ---------- | ----------- | --------------- | ------------------ | -------- | ------ |
| DataHub header KPI cards | `Total Sources`, `Active Sources`, `Health Status`, `Cache Hit Rate` (`N/A`) | `DataHubSummaryCards` -> `useDataHubSummaryMetrics` -> `useDataHubSourcesStatsQuery` + `useDataHubSourcesHealthQuery` | No | `DataHubSummaryCards.tsx`, `hooks/useDataHubSummary.ts` (no `fetchDataHubState` use) | PASS (backend-fed, no `75%` mock path here) |
| Pipeline tab | Snapshot metrics + history in panel | `usePipelineQuery` -> `api.fetchDataPipelineView` | No (for active tab path) | `useDataHub.ts` (`pipelineView?.snapshot`), `PipelinePanel.tsx` | PASS (local pipeline helper in `services/api.ts` is not wired to active Pipeline tab) |
| Health Monitoring tab | health status, active/total, recent errors, last check, avg/cache as `N/A` | `useDataHubSourcesHealthQuery`, `useDataHubSourcesStatsQuery`, `useDataHubSourcesStateQuery`, `useDataHubHealthLogCountsQuery` | No | `HealthPanel.tsx` query usage and `N/A` guards | PASS (backend-fed + safe fallbacks) |
| Logs tab | log rows + status counts | `useAccessLogsQuery` -> `api.fetchDataAccessLogs` | No | `useDataHub.ts` (`accessLogsResult?.data`), `LogsPanel.tsx` props | PASS (no local `dataHub.accessLogs` primary path) |
| Data Sources tab | source list + per-tab metrics | `useDataSourcesQuery` primary, but merged with `dataHub.sources` fallback | **Yes** (on API miss, can fall back to local IndexedDB state) | `useDataHub.ts` (`sourcesResult?.data ?? dataHub.sources`), `DataSourcesPanel.tsx` uses `dataHub.sources` | RISK (implemented surface has conditional local fallback) |
| Categories tab | category list + telegram/category counters | `useDataCategoriesQuery` primary, but merged with `dataHub.categories` fallback and `dataHub.sources` for telegram counts | **Yes** (conditional fallback path) | `useDataHub.ts` (`categoriesResult ?? dataHub.categories`), `CategoriesPanel.tsx` | RISK (implemented surface has conditional local fallback) |
| Advanced panels (core data) | Crawlers/Discovery/Prioritization/Access/Safety/Publisher/Automation/Archiving data | Dedicated backend hooks/services per panel (`useDataHubCrawlers`, `useDataHubDiscovery`, `useDataHubPrioritization`, `useAccessControl`, `useDataHubFilterRules`, `useTelegramPublishers`, `useDatahubAutomation`) | Mostly No (for panel core data) | imports in `advanced/*.tsx` and hook wiring | PASS for core datasets |
| Advanced panels (aux props) | automation `availableDataTypes`, publisher `telegramSources`, some category-derived options | From `dataHub.sources/categories` passed through `AdvancedFeatures` | **Yes** (auxiliary UI options can reflect local fallback) | `AdvancedFeatures.tsx` passes `dataHub.sources/categories` | RISK (non-core but user-visible auxiliary values) |
| Telegram panel block (`TelegramPanel`) | collector state, tracked channels, combined health | `dataHub.telegramCollector` + `dataHub.sources` (from merged DataHub state) | **Yes** (local shell state is active source for this block) | `DataHubTab.tsx` passes `dataHub.telegramCollector` and `dataHub.sources` | RISK (collector shell path still local-state-backed) |
| Telegram data analytics block (`TelegramDataPanel`) | health/agents summary and analytics cards | Direct backend HTTP calls (`/api/v1/telegram/*`) | No (for this component data) | `TelegramDataPanel.tsx` (`axios.get` to telegram endpoints) | PASS (backend-fed, not from `fetchDataHubState`) |
| Synthetic agent metrics | synthetic `latency/throughput/errorRate` in `useAgentsQuery` result | `useAgentsQuery` map layer in `hooks/useDataHubState.ts` | **Yes** (synthetic values are active and propagated to advanced/automation agent props) | `useDataHubState.ts` static metrics + `useDataHub.ts` wires `agents` into Advanced | RISK (active synthetic metrics path) |
| Local pipeline snapshot helper | legacy snapshot builders in `services/api.ts` | Legacy functions in `services/api.ts` | No (for current implemented pipeline tab) | No active component wiring from Pipeline tab to legacy helpers | PASS (dead/legacy for implemented pipeline path) |
| Local access logs | legacy DataHub local logs state | Active logs panel uses access-logs query result | No | `useAccessLogsQuery` + `LogsPanel` wiring | PASS (no local log feed in implemented Logs tab) |

## Blockers (against strict Implemented claims)

1. `useDataHubQuery -> fetchDataHubState` is still active in DataHub shell and is used as fallback source for:
   - Sources tab data path
   - Categories tab data path
   - Telegram panel collector/sources block
   - Some auxiliary Advanced props (derived from `dataHub.sources/categories`)

2. Synthetic metrics in `useAgentsQuery` (`latency`, `throughput`, `errorRate`) are active and can be interpreted as real telemetry.

## Non-blocking / Deferred Cleanup (v3.1)

- Legacy local functions in `services/api.ts` for crawler/discovery/prioritization/access/publisher/automation paths that are not wired to current active panel core data.
- Structural consistency migration of `TelegramDataPanel` to shared service/query pattern (currently backend-fed already).

## Pre-Merge Decision

- For implemented surfaces with `Can fallback leak = Yes`, one of these must happen:
  1. Add guard in current PR (backend-only source for implemented values, or explicit `N/A/degraded` when backend missing), or
  2. Downgrade SSOT status to `Partial` and open a GAP.

Recommended minimum before merge:
- Guard/neutralize fallback leakage for Sources/Categories/Telegram shell auxiliary values.
- Neutralize synthetic agent metrics (`N/A/deferred` unless backed by real endpoint).
