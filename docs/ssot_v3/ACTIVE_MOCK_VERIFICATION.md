# S3 Gate — Active Mock Verification

Status: Read-only verification (no implementation, no smoke, no server actions)

Method used:
- `rg` search
- import graph tracing
- component/hook usage tracing
- SSOT cross-check from `docs/ssot_v3/SSOT_v3.0.md` and `docs/ssot_v3/DataHub_DEMOS.md`

Decision rule:
- If `Active = Yes` and SSOT says `Implemented`, required action is either:
  1) backend-first fix, or
  2) SSOT downgrade to `Partial` + new GAP.
- If `Active = No`, not a merge blocker; track as v3.1 cleanup.

## Verification Table

| Item | File / Function | Active? | How verified | Current SSOT status | Required action |
| ---- | --------------- | ------- | ------------ | ------------------- | --------------- |
| DataHub shell local state entry | `hooks/useDataHubState.ts` / `useDataHubQuery` -> `services/api.ts` / `fetchDataHubState` | Yes | `DataHubTab.tsx` -> `hooks/useDataHub.ts` -> `useDataHubQuery` -> `api.fetchDataHubState` | `aiManager.dataHub = Implemented`; panel-level DataHub rows mostly Implemented | Reduce scope to shell compatibility only; prevent user-visible KPI/data from reading local fallback. If still used for implemented data claims, mark Partial+GAP |
| `fetchDataHubState` fallback static KPI seeds (`cacheHitRate:75`, `hitRate:75`) | `services/api.ts` / `fetchDataHubState` | Yes (conditional path) | Fallback seed defined in active function called by `useDataHubQuery` | `dataHub.summary` documented backend-first (`/stats` + `/health`) | Keep summary cards backend-first and ensure these seeded values never surface in implemented UI; otherwise downgrade SSOT |
| DataHub header KPIs | `components/ai/AIManager/tabs/DataHub/DataHubSummaryCards.tsx`, `hooks/useDataHubSummary.ts` | Yes | `DataHubTab.tsx` renders `DataHubSummaryCards`; hook uses health/stats queries | `dataHub.summary` backend-first in demos/evidence | No blocker from mock path; keep guard tests and evidence |
| Pipeline snapshot (main Pipeline tab path) | `components/ai/AIManager/tabs/DataHub/hooks/useDataHub.ts` / `usePipelineQuery` | Yes | `DataHubTab.tsx` -> `useDataHub` -> `usePipelineQuery`; panel not wired to local snapshot | `dataHub.pipeline = Implemented · Design Done` | No blocker for main path; keep legacy snapshot helpers out of active UI |
| Legacy pipeline snapshot helpers | `services/api.ts` / `buildPipelineSnapshot`, `refreshDataPipelineSnapshot` | No (for current Pipeline tab) | No active `components/ai/AIManager/tabs/DataHub` usage chain to these helpers for pipeline view | Covered under broader DataHub implemented narrative, not explicit row | v3.1 cleanup: deprecate/remove legacy helper path |
| Health Monitoring | `components/ai/AIManager/tabs/DataHub/HealthPanel.tsx` | Yes | `DataHubTab.tsx` -> `HealthPanel` -> health/stats/state/access-logs queries | `dataHub.health = Implemented · Design Done` | No mock blocker identified in active health panel path |
| Logs | `components/ai/AIManager/tabs/DataHub/hooks/useDataHub.ts` + `LogsPanel.tsx` | Yes | `useAccessLogsQuery` feeds `LogsPanel`; not `dataHub.accessLogs` local path | `dataHub.logs = Implemented · Design Done` | No mock blocker in active logs path |
| Advanced panels (current active implementations) | `WebCrawlerConfig.tsx`, `AutoDiscoveryConfig.tsx`, `SmartPrioritization.tsx`, `AccessControlPanel.tsx`, `BlacklistWhitelist.tsx`, `TelegramPublisher.tsx`, `AutomationTopics.tsx`, `Archiving.tsx` | Yes | Each advanced panel imports dedicated backend hooks/APIs, not legacy `services/api.ts` functions | `dataHub.advanced.*` rows mostly `Implemented · Design Done` | No immediate mock blocker in active advanced paths; keep consistency checks |
| TelegramDataPanel data fetch style | `components/ai/AIManager/tabs/DataHub/TelegramDataPanel.tsx` | Yes | Direct `axios` calls to telegram endpoints in panel (`/health`, `/agents/summary`) | `dataHub.telegram = Implemented` | Non-mock but architectural consistency item: migrate to shared service/hook later (v3.1 cleanup unless merge policy requires standardization now) |
| TelegramPublisher (active path) | `advanced/TelegramPublisher.tsx` + `hooks/useTelegramPublishers.ts` + `services/telegramPublishersApi.ts` | Yes | Panel wired to dedicated query/mutation hooks | `dataHub.advanced.telegramPublisher = Implemented · Design Done` | No mock blocker in active path |
| Automation (active path) | `advanced/AutomationTopics.tsx` + `hooks/useDatahubAutomation.ts` + `services/datahubAutomationApi.ts` | Yes | Panel uses automation API hook set | `dataHub.advanced.automation = Implemented · Design Done` | No mock blocker in active path |
| Access Control (active path) | `advanced/AccessControlPanel.tsx` + `hooks/useAccessControl.ts` + `services/accessControlApi.ts` | Yes | Panel uses access-control API hooks | `dataHub.advanced.access = Implemented · Design Done` | No mock blocker in active path |
| Safety Filtering (active path) | `advanced/BlacklistWhitelist.tsx` + `hooks/useDataHubFilterRules.ts` + `services/dataHubFilterRulesApi.ts` | Yes | Panel uses filter-rules API hooks | `dataHub.advanced.blacklist = Implemented · Design Done` | No mock blocker in active path |
| Legacy crawler functions | `services/api.ts` / `createWebCrawler`, `updateWebCrawler`, `deleteWebCrawler` | No | No usage matches in current `components` tree; active UI uses `useDataHubCrawlers` | `dataHub.advanced.crawlers = Implemented · Design Done` | v3.1 cleanup: deprecate/remove legacy functions |
| Legacy discovery function | `services/api.ts` / `runAutoDiscovery` | No | No active component usage; active UI uses `useDataHubDiscovery` | `dataHub.advanced.discovery = Implemented · Design Done` | v3.1 cleanup |
| Legacy prioritization function | `services/api.ts` / `calculateSourcePriorities` | No | No active component usage; active UI uses `useDataHubPrioritization` | `dataHub.advanced.prioritization = Implemented · Design Done` | v3.1 cleanup |
| Legacy access-control update function | `services/api.ts` / `updateSourceAccessControl` | No | No active component usage; active UI uses `useAccessControl` | `dataHub.advanced.access = Implemented · Design Done` | v3.1 cleanup |
| Legacy telegram-publisher local functions | `services/api.ts` / `createTelegramPublisher` and related local simulate/dispatch helpers | No | No active component usage; active UI uses `useTelegramPublishers` + `telegramPublishersApi` | `dataHub.advanced.telegramPublisher = Implemented · Design Done` | v3.1 cleanup |
| Legacy automation queue functions | `services/api.ts` / `refreshAutomationQueue`, `dispatchAutomationQueue` (legacy local path) | No (for current UI path) | Active automation panel wired to `datahubAutomationApi` hooks, not legacy local mutation path | `dataHub.advanced.automation = Implemented · Design Done` | v3.1 cleanup |
| Synthetic agent metrics in DataHub state hook | `hooks/useDataHubState.ts` / `useAgentsQuery` | Yes | Hook is still called via `useDataHub`; synthetic constants defined in mapping | Not explicitly singled-out in SSOT row; falls under `aiManager.dataHub` implemented umbrella | Replace synthetic metrics with N/A or real endpoint; if currently user-visible in implemented flow, downgrade claim to Partial+GAP |

## Blockers (S3 Gate)

1. `useDataHubQuery -> fetchDataHubState` remains active in DataHub shell and includes conditional mock/default seeds.  
   - Gate condition: must not feed implemented user-visible claims (especially KPIs/health/pipeline/logs primary values).
2. Synthetic metrics in `useAgentsQuery` are active and can misrepresent live state if surfaced as real telemetry.  
   - Gate condition: either backend source or explicit `N/A/deferred` semantics.

## Non-blocking Cleanup (v3.1)

- Legacy local functions in `services/api.ts` for:
  - crawler CRUD
  - discovery run
  - prioritization calculation
  - access-control local update
  - telegram publisher local helpers
  - automation local queue helpers
- Legacy pipeline snapshot helper path in `services/api.ts` (outside active pipeline tab path).
- TelegramDataPanel consistency migration from direct `axios` to shared service/hook pattern (not mock blocker, but architecture debt).

## Pre-merge Recommendation (what must be true before merge)

Minimum required to keep `Implemented` claims valid:

1. Confirm and keep DataHub implemented surfaces backend-first:
   - Header KPIs (`/stats` + `/health`)
   - Pipeline tab (`/data-sources/pipeline`)
   - Health Monitoring (`/health`, `/stats`, `/state`, `/access-logs`)
   - Logs (`/access-logs`)
   - Advanced panels via dedicated `/api/v1/data-hub/*` services/hooks
2. Ensure local/mock fallback from `fetchDataHubState` cannot leak into those implemented surfaces.
3. For any remaining active synthetic/local metric shown as real data:
   - either fix now to backend-first or explicit `N/A/degraded`,
   - else downgrade SSOT status to `Partial` and open a GAP.

If these conditions hold, legacy dead paths can be safely deferred to v3.1 cleanup PR(s).
