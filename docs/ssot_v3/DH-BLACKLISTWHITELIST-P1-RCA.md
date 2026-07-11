# DH-BLACKLISTWHITELIST-P1-RCA

**Mode:** Read-only audit  
**Date:** 2026-06-18  
**Verdict:** PARTIAL

## Executive Summary

Blacklist/Whitelist is not UI-only: there is a real backend table, CRUD API, evaluator, and some ingestion enforcement.

It is also not globally enforced. Enforcement exists in selected ingestion paths (`collected-data` API, DataHub crawler ingestion, Telegram transfer pipeline, discovery scan/approval), but the legacy scheduled fetcher inserts into `collected_data` without filter checks, and publishing/automation do not call the blacklist/whitelist engine. Current production data has zero rules, so there is no live production blocking evidence.

## 1. UI Wiring

All four visible tabs are implemented in one component:

| UI item | Component | API client | Backend route | Service | DB table |
| --- | --- | --- | --- | --- | --- |
| Blacklist tab | `components/ai/AIManager/tabs/DataHub/advanced/BlacklistWhitelist.tsx` | `fetchFilterRules({ active_only: true })` | `GET /api/v1/data-hub/filter-rules` | `listFilterRules` | `datahub_filter_rules` |
| Whitelist tab | `BlacklistWhitelist.tsx` | same | same | same | same |
| All Rules tab | `BlacklistWhitelist.tsx` | same | same | same | same |
| Evaluate tab | `BlacklistWhitelist.tsx` | `evaluateFilterRules` | `POST /api/v1/data-hub/filter-rules/evaluate` | `evaluateFilterRules` | `datahub_filter_rules` |
| Refresh button | `BlacklistWhitelist.tsx` | React Query `refetch()` | `GET /api/v1/data-hub/filter-rules?active_only=true` | `listFilterRules` | `datahub_filter_rules` |
| Add Rule button | `BlacklistWhitelist.tsx` + `FilterRuleModal.tsx` | `createFilterRule` | `POST /api/v1/data-hub/filter-rules` | `createFilterRule` | `datahub_filter_rules` |

Evidence:

- `BlacklistWhitelist.tsx` imports `useDataHubFilterRulesQuery`, CRUD mutations, and `useEvaluateFilterRulesMutation`.
- Tabs are local IDs: `blacklist`, `whitelist`, `rules`, `evaluate`.
- `FilterRuleModal.tsx` exposes `rule_type`, `scope`, `pattern`, `match_type`, `apply_target`, `priority`, `reason`, and `is_active`.
- `services/dataHubFilterRulesApi.ts` uses base path `/api/v1/data-hub/filter-rules`.
- `backend/routes/v1/index.js` mounts `router.use('/data-hub/filter-rules', dataHubFilterRulesRoutes)`.

Read-only API presence check:

```text
GET /api/v1/data-hub/filter-rules -> 401 {"error":"No token provided"}
POST /api/v1/data-hub/filter-rules/evaluate -> 401 {"error":"No token provided"}
```

This confirms the routes are live and auth-protected.

## 2. Database

Only one related table exists in production:

```text
datahub_filter_rules
```

No tables named `blacklist_rules`, `whitelist_rules`, `filtering_rules`, or `keyword_rules` were found.

Schema:

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid | default `uuid_generate_v4()` |
| `rule_type` | varchar | `blacklist` or `whitelist` |
| `scope` | varchar | `domain`, `source`, or `keyword` |
| `pattern` | text | host/source UUID/keyword |
| `match_type` | varchar | `exact`, `contains`, or `regex`; default `contains` |
| `apply_target` | varchar | `ingestion`, `publishing`, or `both`; default `ingestion` |
| `action` | varchar | `block` for blacklist, `allow` for whitelist |
| `is_active` | boolean | default true |
| `priority` | integer | default 100 |
| `metadata` | jsonb | default `{}` |
| `reason` | text | nullable |
| `created_by` | uuid | nullable user reference |
| `deleted_at` | timestamptz | soft delete |
| `last_matched_at` | timestamptz | updated by evaluator |
| `created_at` | timestamptz | default now |
| `updated_at` | timestamptz | trigger-maintained |

Production counts:

```text
total: 0
not_deleted: 0
active: 0
soft_deleted: 0
filter_blocked logs: 0
```

## 3. Enforcement Audit

### A) Blacklist

| Flow | Enforcement | Evidence |
| --- | --- | --- |
| DataHub crawler ingestion | REAL ENFORCEMENT | `datahubCrawlersService.ingestItem` calls `enforceIngestionFilter` before inserting into `collected_data`; blocked items are skipped. |
| Telegram collector transfer to pipeline | REAL ENFORCEMENT | `telegramPipeline.transferTelegramMessagesToPipeline` creates a cached ingestion evaluator and `processSubBatch` skips blocked messages before insert. |
| Manual/API `collected_data` insertion | REAL ENFORCEMENT | `routes/collected-data.js` calls `enforceIngestionFilter` before single and batch inserts. |
| Auto discovery scan | REAL ENFORCEMENT for suggestions | `datahubDiscoveryService.runDiscoveryScan` calls `evaluateFilterRules` before inserting pending suggestions. |
| Auto discovery approval | REAL ENFORCEMENT | `approveSuggestion` re-evaluates filter rules before creating/approving source. |
| Legacy scheduled fetcher | BYPASS | `dataFetcher.saveFetchedData` inserts into `collected_data` without importing or calling filter rules. |
| Data pipeline normalization/routing | NOT ENFORCED | `dataPipeline` applies source ACL, not blacklist/whitelist filtering. |
| Automation queue routing | NOT ENFORCED | `datahubAutomationService` checks source ACL only; no filter-rule call. |
| Telegram publisher | NOT ENFORCED | `telegramPublisherService.runPublisherPublish` asserts ACL gateway only; no publishing-target filter evaluation. |

### B) Whitelist

Whitelist exists in the engine, but it is not strict allow-list behavior.

Actual precedence:

- Rules are sorted by `priority DESC, created_at ASC`.
- Only rules at the top matching priority are considered.
- If a whitelist exists among top-priority matches, allow wins.
- Else if a blacklist exists among top-priority matches, block wins.
- If no rule matches, allow.

This means whitelist overrides blacklist only when it is in the highest matching priority group. It does not make non-whitelisted content blocked when whitelist rules exist. That differs from older contract language that described strict per-scope allow-list behavior.

### C) Keyword Rules

Keyword rules are evaluated by the same `ruleMatches` engine:

- `scope='keyword'`
- input haystack is `text + url`
- supports `exact`, `contains`, and `regex`

Where keyword rules are actually enforced:

- `collected-data` API ingestion
- DataHub crawler ingestion
- Telegram transfer pipeline
- discovery candidate filtering/approval

Where keyword rules are not enforced:

- legacy scheduled fetcher inserts
- automation queue creation/dispatch
- telegram publisher
- alerts/notifications
- agent routing except indirectly if data was blocked before insert

## 4. Evaluate Tab Code Path

The Evaluate tab calls the real backend evaluator, not a mock:

```text
BlacklistWhitelist.tsx
  -> useEvaluateFilterRulesMutation
  -> services/dataHubFilterRulesApi.ts evaluateFilterRules()
  -> POST /api/v1/data-hub/filter-rules/evaluate
  -> backend/routes/data-hub-filter-rules.js
  -> datahubFilterRulesService.evaluateFilterRules()
  -> SELECT active rows from datahub_filter_rules
```

However, Evaluate is still a simulation endpoint: it returns a decision and updates `last_matched_at`, but does not itself enforce outside the request. Production enforcement depends on each runtime path explicitly calling `evaluateFilterRules`, `enforceIngestionFilter`, or `createIngestionFilterEvaluator`.

## 5. Runtime Flow Map

### Crawler

```text
DataHub crawler run
-> datahubCrawlersService.runCrawler
-> executeWebsiteCrawl / executeRssCrawl
-> ingestItem
-> enforceIngestionFilter
-> INSERT collected_data only if allowed
```

Verdict: REAL ENFORCEMENT.

### Telegram Collector

```text
telegram_messages backlog
-> telegramPipeline.transferTelegramMessagesToPipeline
-> createIngestionFilterEvaluator loads active ingestion rules once
-> processSubBatch evaluates source/url/text
-> blocked messages marked processed/skipped_filtered
-> allowed messages INSERT collected_data
```

Verdict: REAL ENFORCEMENT at transfer-to-pipeline layer. The external collector capture into `telegram_messages` is not blocked here; filtering happens before `collected_data`.

### Legacy Fetcher

```text
DataFetcherService.fetchSource
-> fetchRawData
-> saveFetchedData
-> INSERT collected_data
```

Verdict: BYPASS. No blacklist/whitelist check before insert.

### Publisher

```text
POST /data-hub/telegram-publishers/:id/publish
-> Access Control Gateway
-> runPublisherPublish
-> send/dry-run/history
```

Verdict: NOT ENFORCED for blacklist/whitelist. Source ACL is enforced, but filter rules are not evaluated for `apply_target='publishing'`.

### Automation

```text
refreshAutomationQueue
-> buildDataPipelineView
-> recordMatchesTopic
-> source ACL checks
-> INSERT datahub_automation_queue
```

Verdict: NOT ENFORCED for blacklist/whitelist. If blocked content was already inserted/normalized by a bypass path, automation can route it unless source ACL blocks it.

### Discovery

```text
runDiscoveryScan
-> gatherCandidates
-> safe URL check
-> evaluateFilterRules(apply_target='ingestion')
-> skip blocked candidates
-> INSERT datahub_discovery_suggestions
```

Approval repeats the same filter evaluation before source creation.

Verdict: REAL ENFORCEMENT for discovery suggestion creation and approval.

## 6. Production Code Call Sites

| Call site | Function called | Classification |
| --- | --- | --- |
| `backend/routes/data-hub-filter-rules.js` | `evaluateFilterRules` | EVALUATE/API ONLY |
| `backend/routes/collected-data.js` | `enforceIngestionFilter` | REAL ENFORCEMENT |
| `backend/services/datahubCrawlersService.js` | `evaluateFilterRules`, `enforceIngestionFilter` | REAL ENFORCEMENT |
| `backend/services/telegramPipeline.js` | `createIngestionFilterEvaluator` | REAL ENFORCEMENT |
| `backend/services/datahubDiscoveryService.js` | `evaluateFilterRules` | REAL ENFORCEMENT for suggestions |
| `backend/services/dataFetcher.js` | none | BYPASS |
| `backend/services/datahubAutomationService.js` | none | UI/PIPELINE DATA ONLY for blacklist/whitelist; no enforcement |
| `backend/services/telegramPublisherService.js` | none | UI/API ONLY for blacklist/whitelist publishing target |
| `backend/services/dataPipeline.js` | none | NOT ENFORCED; only ACL is applied |

## 7. Security Findings

### Finding 1: Legacy scheduled fetcher bypasses blacklist/whitelist

`DataFetcherService.saveFetchedData` writes directly to `collected_data`. This bypasses domain/source/keyword blacklist checks for sources handled by the legacy fetcher.

Impact: blocked content can enter `collected_data`, then be normalized, routed, and used downstream.

### Finding 2: Publishing-target rules are stored/evaluable but not enforced

The schema supports `apply_target='publishing'` and `both`, but `telegramPublisherService` and `datahubAutomationService` do not call the filter engine for publishing decisions.

Impact: rules configured for publishing can pass the Evaluate tab but have no runtime effect on Telegram publish.

### Finding 3: Automation does not check blacklist/whitelist before queue insert

Automation routing uses topic matching and source ACL, not filter rules.

Impact: if blocked content reaches normalized data through an unenforced ingestion path, automation can enqueue it.

### Finding 4: Whitelist semantics are weaker than strict allow-list wording

Actual engine allows by default when no rule matches, even if whitelist rules exist. Whitelist is an override for matching top-priority rules, not a strict allow-only mode.

Impact: users may believe whitelist restricts inputs more than it does.

### Finding 5: Current production rules and block logs are empty

Production currently has:

```text
datahub_filter_rules total = 0
filter_blocked logs = 0
```

Impact: there is no active production evidence that blacklist/whitelist is blocking anything today.

### Finding 6: Prior contract/documentation is stale

`docs/ssot_v3/advanced/BLACKLIST_WHITELIST_API_CONTRACT.md` says publishing is "read + evaluate API only" and GAP-025 remains for worker hooks. It also describes strict whitelist behavior that the current implementation does not fully match.

## 8. Final Verdict

PARTIAL.

Blacklist/Whitelist has real backend implementation and real ingestion enforcement in selected paths, especially DataHub crawler, Telegram transfer pipeline, collected-data API, and discovery. It is not a central, universal gate. Legacy fetcher ingestion, automation routing, and Telegram publishing remain bypass or evaluate-only paths for blacklist/whitelist rules.

It is therefore not safe to claim REAL ENFORCED across ingestion, publishing, automation, crawler, collector, and discovery flows.
# DH-BLACKLISTWHITELIST-P1-RCA

**Mode:** Read-only audit  
**Date:** 2026-06-18  
**Verdict:** PARTIAL

## Executive Summary

Blacklist/Whitelist is not UI-only: there is a real backend table, CRUD API, evaluator, and some ingestion enforcement.

It is also not globally enforced. Enforcement exists in selected ingestion paths (`collected-data` API, DataHub crawler ingestion, Telegram transfer pipeline, discovery scan/approval), but the legacy scheduled fetcher inserts into `collected_data` without filter checks, and publishing/automation do not call the blacklist/whitelist engine. Current production data has zero rules, so there is no live production blocking evidence.

## 1. UI Wiring

All four visible tabs are implemented in one component:

| UI item | Component | API client | Backend route | Service | DB table |
| --- | --- | --- | --- | --- | --- |
| Blacklist tab | `components/ai/AIManager/tabs/DataHub/advanced/BlacklistWhitelist.tsx` | `fetchFilterRules({ active_only: true })` | `GET /api/v1/data-hub/filter-rules` | `listFilterRules` | `datahub_filter_rules` |
| Whitelist tab | `BlacklistWhitelist.tsx` | same | same | same | same |
| All Rules tab | `BlacklistWhitelist.tsx` | same | same | same | same |
| Evaluate tab | `BlacklistWhitelist.tsx` | `evaluateFilterRules` | `POST /api/v1/data-hub/filter-rules/evaluate` | `evaluateFilterRules` | `datahub_filter_rules` |
| Refresh button | `BlacklistWhitelist.tsx` | React Query `refetch()` | `GET /api/v1/data-hub/filter-rules?active_only=true` | `listFilterRules` | `datahub_filter_rules` |
| Add Rule button | `BlacklistWhitelist.tsx` + `FilterRuleModal.tsx` | `createFilterRule` | `POST /api/v1/data-hub/filter-rules` | `createFilterRule` | `datahub_filter_rules` |

Evidence:

- `BlacklistWhitelist.tsx` imports `useDataHubFilterRulesQuery`, CRUD mutations, and `useEvaluateFilterRulesMutation`.
- Tabs are local IDs: `blacklist`, `whitelist`, `rules`, `evaluate`.
- `FilterRuleModal.tsx` exposes `rule_type`, `scope`, `pattern`, `match_type`, `apply_target`, `priority`, `reason`, and `is_active`.
- `services/dataHubFilterRulesApi.ts` uses base path `/api/v1/data-hub/filter-rules`.
- `backend/routes/v1/index.js` mounts `router.use('/data-hub/filter-rules', dataHubFilterRulesRoutes)`.

Read-only API presence check:

```text
GET /api/v1/data-hub/filter-rules -> 401 {"error":"No token provided"}
POST /api/v1/data-hub/filter-rules/evaluate -> 401 {"error":"No token provided"}
```

This confirms the routes are live and auth-protected.

## 2. Database

Only one related table exists in production:

```text
datahub_filter_rules
```

No tables named `blacklist_rules`, `whitelist_rules`, `filtering_rules`, or `keyword_rules` were found.

Schema:

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid | default `uuid_generate_v4()` |
| `rule_type` | varchar | `blacklist` or `whitelist` |
| `scope` | varchar | `domain`, `source`, or `keyword` |
| `pattern` | text | host/source UUID/keyword |
| `match_type` | varchar | `exact`, `contains`, or `regex`; default `contains` |
| `apply_target` | varchar | `ingestion`, `publishing`, or `both`; default `ingestion` |
| `action` | varchar | `block` for blacklist, `allow` for whitelist |
| `is_active` | boolean | default true |
| `priority` | integer | default 100 |
| `metadata` | jsonb | default `{}` |
| `reason` | text | nullable |
| `created_by` | uuid | nullable user reference |
| `deleted_at` | timestamptz | soft delete |
| `last_matched_at` | timestamptz | updated by evaluator |
| `created_at` | timestamptz | default now |
| `updated_at` | timestamptz | trigger-maintained |

Production counts:

```text
total: 0
not_deleted: 0
active: 0
soft_deleted: 0
filter_blocked logs: 0
```

## 3. Enforcement Audit

### A) Blacklist

| Flow | Enforcement | Evidence |
| --- | --- | --- |
| DataHub crawler ingestion | REAL ENFORCEMENT | `datahubCrawlersService.ingestItem` calls `enforceIngestionFilter` before inserting into `collected_data`; blocked items are skipped. |
| Telegram collector transfer to pipeline | REAL ENFORCEMENT | `telegramPipeline.transferTelegramMessagesToPipeline` creates a cached ingestion evaluator and `processSubBatch` skips blocked messages before insert. |
| Manual/API `collected_data` insertion | REAL ENFORCEMENT | `routes/collected-data.js` calls `enforceIngestionFilter` before single and batch inserts. |
| Auto discovery scan | REAL ENFORCEMENT for suggestions | `datahubDiscoveryService.runDiscoveryScan` calls `evaluateFilterRules` before inserting pending suggestions. |
| Auto discovery approval | REAL ENFORCEMENT | `approveSuggestion` re-evaluates filter rules before creating/approving source. |
| Legacy scheduled fetcher | BYPASS | `dataFetcher.saveFetchedData` inserts into `collected_data` without importing or calling filter rules. |
| Data pipeline normalization/routing | NOT ENFORCED | `dataPipeline` applies source ACL, not blacklist/whitelist filtering. |
| Automation queue routing | NOT ENFORCED | `datahubAutomationService` checks source ACL only; no filter-rule call. |
| Telegram publisher | NOT ENFORCED | `telegramPublisherService.runPublisherPublish` asserts ACL gateway only; no publishing-target filter evaluation. |

### B) Whitelist

Whitelist exists in the engine, but it is not strict allow-list behavior.

Actual precedence:

- Rules are sorted by `priority DESC, created_at ASC`.
- Only rules at the top matching priority are considered.
- If a whitelist exists among top-priority matches, allow wins.
- Else if a blacklist exists among top-priority matches, block wins.
- If no rule matches, allow.

This means whitelist overrides blacklist only when it is in the highest matching priority group. It does not make non-whitelisted content blocked when whitelist rules exist. That differs from older contract language that described strict per-scope allow-list behavior.

### C) Keyword Rules

Keyword rules are evaluated by the same `ruleMatches` engine:

- `scope='keyword'`
- input haystack is `text + url`
- supports `exact`, `contains`, and `regex`

Where keyword rules are actually enforced:

- `collected-data` API ingestion
- DataHub crawler ingestion
- Telegram transfer pipeline
- discovery candidate filtering/approval

Where keyword rules are not enforced:

- legacy scheduled fetcher inserts
- automation queue creation/dispatch
- telegram publisher
- alerts/notifications
- agent routing except indirectly if data was blocked before insert

## 4. Evaluate Tab Code Path

The Evaluate tab calls the real backend evaluator, not a mock:

```text
BlacklistWhitelist.tsx
  -> useEvaluateFilterRulesMutation
  -> services/dataHubFilterRulesApi.ts evaluateFilterRules()
  -> POST /api/v1/data-hub/filter-rules/evaluate
  -> backend/routes/data-hub-filter-rules.js
  -> datahubFilterRulesService.evaluateFilterRules()
  -> SELECT active rows from datahub_filter_rules
```

However, Evaluate is still a simulation endpoint: it returns a decision and updates `last_matched_at`, but does not itself enforce outside the request. Production enforcement depends on each runtime path explicitly calling `evaluateFilterRules`, `enforceIngestionFilter`, or `createIngestionFilterEvaluator`.

## 5. Runtime Flow Map

### Crawler

```text
DataHub crawler run
-> datahubCrawlersService.runCrawler
-> executeWebsiteCrawl / executeRssCrawl
-> ingestItem
-> enforceIngestionFilter
-> INSERT collected_data only if allowed
```

Verdict: REAL ENFORCEMENT.

### Telegram Collector

```text
telegram_messages backlog
-> telegramPipeline.transferTelegramMessagesToPipeline
-> createIngestionFilterEvaluator loads active ingestion rules once
-> processSubBatch evaluates source/url/text
-> blocked messages marked processed/skipped_filtered
-> allowed messages INSERT collected_data
```

Verdict: REAL ENFORCEMENT at transfer-to-pipeline layer. The external collector capture into `telegram_messages` is not blocked here; filtering happens before `collected_data`.

### Legacy Fetcher

```text
DataFetcherService.fetchSource
-> fetchRawData
-> saveFetchedData
-> INSERT collected_data
```

Verdict: BYPASS. No blacklist/whitelist check before insert.

### Publisher

```text
POST /data-hub/telegram-publishers/:id/publish
-> Access Control Gateway
-> runPublisherPublish
-> send/dry-run/history
```

Verdict: NOT ENFORCED for blacklist/whitelist. Source ACL is enforced, but filter rules are not evaluated for `apply_target='publishing'`.

### Automation

```text
refreshAutomationQueue
-> buildDataPipelineView
-> recordMatchesTopic
-> source ACL checks
-> INSERT datahub_automation_queue
```

Verdict: NOT ENFORCED for blacklist/whitelist. If blocked content was already inserted/normalized by a bypass path, automation can route it unless source ACL blocks it.

### Discovery

```text
runDiscoveryScan
-> gatherCandidates
-> safe URL check
-> evaluateFilterRules(apply_target='ingestion')
-> skip blocked candidates
-> INSERT datahub_discovery_suggestions
```

Approval repeats the same filter evaluation before source creation.

Verdict: REAL ENFORCEMENT for discovery suggestion creation and approval.

## 6. Production Code Call Sites

| Call site | Function called | Classification |
| --- | --- | --- |
| `backend/routes/data-hub-filter-rules.js` | `evaluateFilterRules` | EVALUATE/API ONLY |
| `backend/routes/collected-data.js` | `enforceIngestionFilter` | REAL ENFORCEMENT |
| `backend/services/datahubCrawlersService.js` | `evaluateFilterRules`, `enforceIngestionFilter` | REAL ENFORCEMENT |
| `backend/services/telegramPipeline.js` | `createIngestionFilterEvaluator` | REAL ENFORCEMENT |
| `backend/services/datahubDiscoveryService.js` | `evaluateFilterRules` | REAL ENFORCEMENT for suggestions |
| `backend/services/dataFetcher.js` | none | BYPASS |
| `backend/services/datahubAutomationService.js` | none | UI/PIPELINE DATA ONLY for blacklist/whitelist; no enforcement |
| `backend/services/telegramPublisherService.js` | none | UI/API ONLY for blacklist/whitelist publishing target |
| `backend/services/dataPipeline.js` | none | NOT ENFORCED; only ACL is applied |

## 7. Security Findings

### Finding 1: Legacy scheduled fetcher bypasses blacklist/whitelist

`DataFetcherService.saveFetchedData` writes directly to `collected_data`. This bypasses domain/source/keyword blacklist checks for sources handled by the legacy fetcher.

Impact: blocked content can enter `collected_data`, then be normalized, routed, and used downstream.

### Finding 2: Publishing-target rules are stored/evaluable but not enforced

The schema supports `apply_target='publishing'` and `both`, but `telegramPublisherService` and `datahubAutomationService` do not call the filter engine for publishing decisions.

Impact: rules configured for publishing can pass the Evaluate tab but have no runtime effect on Telegram publish.

### Finding 3: Automation does not check blacklist/whitelist before queue insert

Automation routing uses topic matching and source ACL, not filter rules.

Impact: if blocked content reaches normalized data through an unenforced ingestion path, automation can enqueue it.

### Finding 4: Whitelist semantics are weaker than strict allow-list wording

Actual engine allows by default when no rule matches, even if whitelist rules exist. Whitelist is an override for matching top-priority rules, not a strict allow-only mode.

Impact: users may believe whitelist restricts inputs more than it does.

### Finding 5: Current production rules and block logs are empty

Production currently has:

```text
datahub_filter_rules total = 0
filter_blocked logs = 0
```

Impact: there is no active production evidence that blacklist/whitelist is blocking anything today.

### Finding 6: Prior contract/documentation is stale

`docs/ssot_v3/advanced/BLACKLIST_WHITELIST_API_CONTRACT.md` says publishing is "read + evaluate API only" and GAP-025 remains for worker hooks. It also describes strict whitelist behavior that the current implementation does not fully match.

## 8. Final Verdict

PARTIAL.

Blacklist/Whitelist has real backend implementation and real ingestion enforcement in selected paths, especially DataHub crawler, Telegram transfer pipeline, collected-data API, and discovery. It is not a central, universal gate. Legacy fetcher ingestion, automation routing, and Telegram publishing remain bypass or evaluate-only paths for blacklist/whitelist rules.

It is therefore not safe to claim REAL ENFORCED across ingestion, publishing, automation, crawler, collector, and discovery flows.
