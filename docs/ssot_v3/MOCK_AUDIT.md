# DataHub Mock/Local-State Audit

Status: Read-only audit for stabilization phase.  
Scope: DataHub + adjacent AI surfaces.  
Rule: No env/CORS/DB/process changes performed.

## Findings

| File | Function/Symbol | Current Behavior | Replacement API/Hook | Risk |
|---|---|---|---|---|
| `hooks/useDataHubState.ts` | `useDataHubQuery` | Reads `api.fetchDataHubState` (IndexedDB-backed shell state) as primary source | Use backend-first hooks per panel: `useDataSourcesQuery`, `useDataCategoriesQuery`, `usePipelineQuery`, `useAccessLogsQuery`, `useDataHubSourcesHealthQuery`, `useDataHubSourcesStatsQuery` | High |
| `services/api.ts` | `fetchDataHubState` | Reads/writes `settings:data_hub_state`; seeds defaults on miss | Keep only compatibility fallback (if needed) and remove as primary for UI surfaces | High |
| `services/api.ts` | `fetchDataHubState` default payload (`cacheHitRate: 75`, `hitRate: 75`) | Static/fake KPI defaults in fallback state | `GET /api/v1/data-sources/stats` + `GET /api/v1/data-sources/health` (already wired in summary cards) | High |
| `services/api.ts` | `createWebCrawler`, `updateWebCrawler`, `deleteWebCrawler` | Legacy local CRUD + random IDs in local state | `services/dataHubCrawlersApi.ts` + `hooks/useDataHubCrawlers.ts` (`/api/v1/data-hub/crawlers`) | High |
| `services/api.ts` | `runAutoDiscovery` | Legacy/mock discovery path (`Math.random` behavior + local persistence) | `services/dataHubDiscoveryApi.ts` + `hooks/useDataHubDiscovery.ts` (`/api/v1/data-hub/discovery/*`) | High |
| `services/api.ts` | `calculateSourcePriorities` | Local scoring path with fixed/mock factors in code | `services/dataHubPrioritizationApi.ts` + `hooks/useDataHubPrioritization.ts` (`/api/v1/data-hub/prioritization/*`) | Med-High |
| `services/api.ts` | `updateSourceAccessControl` (and related) | Access policy updates applied via local DataHub state path | `services/accessControlApi.ts` + `hooks/useAccessControl.ts` (`/api/v1/data-hub/access-control`) | High |
| `services/api.ts` | Telegram publisher legacy funcs (`create/update/delete/simulate/dispatch`) | Publisher/history local-state path with synthetic behavior | `services/telegramPublishersApi.ts` + `hooks/useTelegramPublishers.ts`; automation via `datahubAutomationApi.ts` | High |
| `services/api.ts` | Automation legacy queue/scheduler funcs | Queue/topic dispatch path still available via local state mutation | `services/datahubAutomationApi.ts` + `hooks/useDatahubAutomation.ts` (`/api/v1/data-hub/automation/*`) | High |
| `hooks/useDataHubState.ts` | `useAgentsQuery` | Uses fixed synthetic metrics (`latency/throughput/errorRate` constants) | Replace with backend metrics endpoint when available; until then mark as N/A/deferred | Medium |
| `services/api.ts` | `fetchAIAgents` | Backend call + IndexedDB fallback + default/seeded agents path | Keep backend as source of truth; fallback should be explicit degraded mode only | High |
| `services/api.ts` | `fetchTrainingData`, `fetchAnalyticsData` | Backend-first but broad local fallback masks backend/auth issues | Keep backend contract; fallback only in controlled offline mode with explicit banner | Med-High |
| `components/ai/hooks/useArtemisState.ts` + `components/ai/defaults.ts` | Artemis fallback state | Local default demo fallback may mask upstream auth/backend issues | Keep for resilience but surface degraded/auth-required state explicitly | Medium |

## Evidence Patterns (grep-oriented)

- `fetchDataHubState`, `data_hub_state`, `database.get/save` in `services/api.ts` and `hooks/useDataHubState.ts`
- Static KPI defaults (`cacheHitRate`, `hitRate`) in DataHub fallback payload in `services/api.ts`
- Legacy local implementations in `services/api.ts` for crawler/discovery/prioritization/access/publisher/automation
- Backend-first replacements present under:
  - `services/dataHubCrawlersApi.ts`
  - `services/dataHubDiscoveryApi.ts`
  - `services/dataHubPrioritizationApi.ts`
  - `services/accessControlApi.ts`
  - `services/telegramPublishersApi.ts`
  - `services/datahubAutomationApi.ts`

## Recommendation

For stabilization, keep legacy local paths non-primary and explicitly classify them as compatibility fallbacks. All user-facing DataHub panels should continue converging on backend-first hooks/endpoints with normalized degraded/error states.
