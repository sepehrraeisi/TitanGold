# Leak-Proof Verification (Pre-Merge)

Status: Guarded verification after minimal leakage neutralization  
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
| Data Sources tab | source list + per-tab metrics | `useDataSourcesQuery` primary; merged state now uses backend list or empty only | No | `useDataHub.ts` (`sourcesResult?.data ?? []`), `DataSourcesPanel.tsx` reads merged `dataHub.sources` | PASS (local fallback neutralized) |
| Categories tab | category list + telegram/category counters | `useDataCategoriesQuery` primary; merged state now uses backend categories or empty only | No | `useDataHub.ts` (`categoriesResult ?? []`), enrichment uses backend `sources` list only | PASS (local fallback neutralized) |
| Advanced panels (core data) | Crawlers/Discovery/Prioritization/Access/Safety/Publisher/Automation/Archiving data | Dedicated backend hooks/services per panel (`useDataHubCrawlers`, `useDataHubDiscovery`, `useDataHubPrioritization`, `useAccessControl`, `useDataHubFilterRules`, `useTelegramPublishers`, `useDatahubAutomation`) | Mostly No (for panel core data) | imports in `advanced/*.tsx` and hook wiring | PASS for core datasets |
| Advanced panels (aux props) | automation `availableDataTypes`, publisher `telegramSources`, some category-derived options | Derived from merged backend-only lists | No | `AdvancedFeatures.tsx` still consumes `dataHub.*`, but `useDataHub.ts` now neutralizes to backend-or-empty | PASS (aux options do not inherit local IndexedDB fallback) |
| Telegram panel block (`TelegramPanel`) | collector state, tracked channels, combined health | `dataHub.telegramCollector` + `dataHub.sources`, with collector guarded by backend readiness | No (for fallback leak) | `useDataHub.ts` sets `telegramCollector: backendSourcesReady ? ... : null` | PASS (falls to degraded/unknown instead of local-real claim when backend sources unavailable) |
| Telegram data analytics block (`TelegramDataPanel`) | health/agents summary and analytics cards | Direct backend HTTP calls (`/api/v1/telegram/*`) | No (for this component data) | `TelegramDataPanel.tsx` (`axios.get` to telegram endpoints) | PASS (backend-fed, not from `fetchDataHubState`) |
| Synthetic agent metrics | `latency/throughput/errorRate` now neutralized | `useAgentsQuery` map layer in `hooks/useDataHubState.ts` | No (as real telemetry) | `useDataHubState.ts` maps these fields to `null` with leak guard comment | PASS (no synthetic numeric telemetry shown as real) |
| Local pipeline snapshot helper | legacy snapshot builders in `services/api.ts` | Legacy functions in `services/api.ts` | No (for current implemented pipeline tab) | No active component wiring from Pipeline tab to legacy helpers | PASS (dead/legacy for implemented pipeline path) |
| Local access logs | legacy DataHub local logs state | Active logs panel uses access-logs query result | No | `useAccessLogsQuery` + `LogsPanel` wiring | PASS (no local log feed in implemented Logs tab) |

## Blockers (against strict Implemented claims)

No active leakage blocker remains for the previously flagged RISK rows after guards in:
- `components/ai/AIManager/tabs/DataHub/hooks/useDataHub.ts`
- `hooks/useDataHubState.ts`

## Non-blocking / Deferred Cleanup (v3.1)

- Legacy local functions in `services/api.ts` for crawler/discovery/prioritization/access/publisher/automation paths that are not wired to current active panel core data.
- Structural consistency migration of `TelegramDataPanel` to shared service/query pattern (currently backend-fed already).

## Pre-Merge Decision

- For implemented surfaces with `Can fallback leak = Yes`, one of these must happen:
  1. Add guard in current PR (backend-only source for implemented values, or explicit `N/A/degraded` when backend missing), or
  2. Downgrade SSOT status to `Partial` and open a GAP.

Recommended minimum before merge:
- Keep these guards in place and prevent regression to `dataHub.*` local fallback for implemented surfaces.
- Continue v3.1 cleanup for dead/legacy `services/api.ts` local paths (non-blocking for this gate).
