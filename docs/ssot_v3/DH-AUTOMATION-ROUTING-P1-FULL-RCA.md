# DH-AUTOMATION-ROUTING-P1-FULL-RCA

Date: 2026-06-20

Mode: READ-ONLY AUDIT

Scope: Automation Routing tab and backend flow between DataHub pipeline data, Access Control, Blacklist/Whitelist, Telegram Publisher, queue, and history.

Hard constraints followed:

- No code changes.
- No database writes.
- No routing rules/topics/queue items created.
- No real Telegram dispatch.
- No performance optimization.

## Final Verdict

**D) BROKEN / UNSAFE**

Automation Routing is not UI-only. It has real UI, routes, database tables, queue refresh, queue dispatch, ACL checks, filter checks, and Telegram Publisher integration. However, it is not production-safe yet.

Main blockers:

- `dry_run` in Automation dispatch is not passed into `runPublisherPublish`; live safety depends on `TELEGRAM_PUBLISHER_DRY_RUN=true`, not on the Automation UI toggle.
- Retry always calls `dispatchQueueItem(..., { dryRun: false })`, so a failed automation execution can retry live without a dry-run option.
- Current production topics all target disabled publishers, so current routes cannot successfully publish.
- Queue refresh does not validate source-to-publisher mappings before enqueue; mapping is only enforced later by Telegram Publisher during dispatch.
- Disabled publisher errors happen before `publisher_delivery_history` is written, so Automation execution history exists but Publisher history can be missing.
- No production scheduler/worker caller was found for automatic queue refresh/dispatch; schedule config exists but does not appear wired into a running automation dispatcher.
- Several UI i18n keys used by the current component are missing in active locale files.
- Queue dispatch lacks row-level locking or `SKIP LOCKED`, so concurrent dispatch can double-process pending rows.

## Evidence Summary

Runtime GET measurements through local backend with admin JWT:

| Endpoint | Status | Latency | Response size |
|---|---:|---:|---:|
| `/api/v1/data-hub/automation/overview` | 200 | 0.023474s | 23519B |
| `/api/v1/data-hub/automation/topics` | 200 | 0.008360s | 1919B |
| `/api/v1/data-hub/automation/queue` | 200 | 0.007899s | 3560B |
| `/api/v1/data-hub/automation/executions?limit=20` | 200 | 0.006675s | 13305B |
| `/api/v1/data-hub/automation/schedule` | 200 | 0.005217s | 144B |
| `/api/v1/data-hub/automation/runs/history` | 404 | 0.002228s | 85B |

Runtime DB counts:

| Metric | Count |
|---|---:|
| Topics | 3 |
| Enabled topics | 3 |
| Disabled topics | 0 |
| Queue total | 35 |
| Queue pending | 8 |
| Queue processing | 0 |
| Queue sent | 12 |
| Queue failed | 15 |
| Executions total | 27 |
| Executions dry-run | 12 |
| Executions failed | 15 |
| Executions sent | 0 |
| Publisher-linked topics | 3 |
| Topics with missing publisher | 0 |
| Topics with disabled publisher | 3 |
| Topics with invalid category filters | 0 |

Current scheduler row:

| id | enabled | interval | max items | last run | next run |
|---|---:|---:|---:|---|---|
| `default` | false | 15m | 5 | 2026-06-01 15:49:18 UTC | 2026-06-20 11:42:32 UTC |

Current publisher target validity:

| Topic | Publisher | Publisher state |
|---|---|---|
| `Demo Topic 1779636651973` | `Automation Demo Publisher` | disabled |
| `Demo Topic 1779636779020` | `Automation Demo Publisher` | disabled |
| `سیگنال` | `تایتان تست` | disabled |

Mapping coverage for active topics against recent processed sources:

| Topic | Recent sources sampled | Enabled source mappings |
|---|---:|---:|
| `Demo Topic 1779636651973` | 41 | 0 |
| `Demo Topic 1779636779020` | 41 | 0 |
| `سیگنال` | 41 | 2 |

## Phase 1: UI Wiring Audit

Main UI file:

- `components/ai/AIManager/tabs/DataHub/advanced/AutomationTopics.tsx`

Supporting UI files:

- `components/ai/AIManager/tabs/DataHub/advanced/automation/AutomationTopicList.tsx`
- `components/ai/AIManager/tabs/DataHub/advanced/automation/AutomationQueueManager.tsx`
- `components/ai/AIManager/tabs/DataHub/advanced/automation/AutomationSchedulePanel.tsx`
- `components/ai/AIManager/tabs/DataHub/modals/AutomationTopicModal.tsx`
- `components/ai/AIManager/tabs/DataHub/modals/QueuePreviewModal.tsx`

Hook/API:

- `hooks/useDatahubAutomation.ts`
- `services/datahubAutomationApi.ts`

| UI item/action | Component | Hook/API | Backend route | Service | DB tables | Status |
|---|---|---|---|---|---|---|
| Overview cards | `AutomationTopics.tsx` | `useAutomationOverviewQuery` | `GET /overview` | `getAutomationOverview` | topics, queue, executions, schedule | working |
| Topics/routing rules list | `AutomationTopicList.tsx` | overview | `GET /overview`, `GET /topics` | `listAutomationTopics` | `datahub_automation_topics` | partial |
| Create topic | `AutomationTopicModal.tsx` | `useCreateAutomationTopicMutation` | `POST /topics` | `createAutomationTopic` | topics | working, but allows disabled publishers |
| Edit topic | `AutomationTopicModal.tsx` | `useUpdateAutomationTopicMutation` | `PUT /topics/:id` | `updateAutomationTopic` | topics | working, but no publisher/mapping validation |
| Enable/disable topic | `AutomationTopicModal.tsx` | update topic | `PUT /topics/:id` | `updateAutomationTopic` | topics | partial; hidden inside modal |
| Delete topic | `AutomationTopicList.tsx` | `useDeleteAutomationTopicMutation` | `DELETE /topics/:id` | `deleteAutomationTopic` | topics, cascade queue | working, confirmed by prompt only |
| Publisher target selection | `AutomationTopicModal.tsx` | publisher query + create/update topic | publisher list + topic write | `createAutomationTopic` | topics, telegram_publishers | partial; does not filter disabled/unmapped publishers |
| Source/category/data type filters | `AutomationTopicModal.tsx` | create/update topic | `POST/PUT /topics` | `recordMatchesTopic` | topics JSONB, categories, collected_data | partial; source filter missing |
| Status/quality filters | `AutomationTopicModal.tsx` | create/update topic | `POST/PUT /topics` | `recordMatchesTopic` | topics JSONB, collected_data metadata | partial |
| Manual refresh | `AutomationTopics.tsx` | `useRefreshAutomationQueueMutation` | `POST /queue/refresh` | `refreshAutomationQueue` | queue, collected_data, ACL/filter tables | working, side-effecting |
| Manual dispatch queue | `AutomationQueueManager.tsx` | `useDispatchAutomationQueueMutation` | `POST /queue/dispatch` | `dispatchAutomationQueue` | queue, executions, publisher history | unsafe |
| Dispatch single queue item / approve | `AutomationQueueManager.tsx`, `QueuePreviewModal.tsx` | `useDispatchQueueItemMutation` | `POST /queue/:id/dispatch` | `dispatchSingleQueueItem` | queue, executions, publisher history | unsafe |
| Reject queue item | `AutomationQueueManager.tsx` | `useFailQueueItemMutation` | `PATCH /queue/:id` | `failQueueItem` | queue, executions | working |
| Runs/history | `AutomationTopics.tsx` | overview/executions | `GET /executions` | `listAutomationExecutions` | executions | partial |
| Retry failed execution | `AutomationTopics.tsx` | `useRetryAutomationExecutionMutation` | `POST /executions/:id/retry` | `retryAutomationExecution` | queue, executions, publisher history | unsafe |
| Test run | `AutomationTopics.tsx` | `useAutomationTestRunMutation` | `POST /test-run` | `runAutomationTest` | queue, executions, publisher history | unsafe/side-effecting |
| Schedule toggle/interval | `AutomationSchedulePanel.tsx` | `useUpdateAutomationScheduleMutation` | `PUT /schedule` | `updateAutomationSchedule` | schedule | UI/config works; no worker wiring found |

### UI Label Clarity

The UI uses terms like `Topic`, `Route`, `Queue`, `Dispatch`, `Publisher`, and `Agent`, but the copy is not enough for a normal operator to know:

- Whether dispatch is live or dry-run.
- Whether a publisher target is mapped to the source.
- Whether a target publisher is disabled.
- Why a queue item was blocked or failed.
- Whether `Retry` can send a live Telegram message.
- Whether `Approve` means "publish now" or merely mark approved.

### Missing i18n Keys

Checked against `deploy/green/locales/en.json` and `deploy/green/locales/fa.json`.

Missing in EN:

`dry_run`, `test_run`, `add_topic`, `active_routing`, `queue_size`, `avg_pass_rate`, `dispatch_interval`, `last_dispatch`, `next_dispatch`, `active_routing_rules`, `target_agent`, `publish_to`, `processed`, `rejected`, `automation_queue`, `automation_queue_desc`, `dispatch_queue`, `time`, `topic`, `actions`, `view`, `approve`, `reject`, `queue_empty`.

Missing in FA:

`dry_run`, `test_run`, `add_topic`, `active_routing`, `queue_size`, `avg_pass_rate`, `dispatch_interval`, `last_dispatch`, `next_dispatch`, `active_routing_rules`, `target_agent`, `publish_to`, `processed`, `rejected`, `automation_queue`, `automation_queue_desc`, `dispatch_queue`, `time`, `topic`, `view`, `approve`, `reject`, `queue_empty`.

## Phase 2: Backend Route Audit

Mounted under:

- `backend/routes/v1/index.js`
- Base path: `/api/v1/data-hub/automation`

Route file:

- `backend/routes/data-hub-automation.js`

Schemas:

- `backend/schemas/datahubAutomationSchemas.js`

Service:

- `backend/services/datahubAutomationService.js`

| Route | Method | Auth | Schema/body | Reads | Writes | Side effects | Can enqueue | Can dispatch/publish | Safety |
|---|---|---|---|---|---|---|---:|---:|---|
| `/overview` | GET | `authenticate`, read limiter | none | topics, schedule, queue, executions, publishers | none | none | no | no | read-only safe |
| `/topics` | GET | `authenticate`, read limiter | none | topics + stats | none | none | no | no | read-only safe |
| `/topics` | POST | admin/trader + write limiter | `createAutomationTopicSchema` | none | topics | creates routing config | no | no | write |
| `/topics/:id` | PUT | admin/trader + write limiter | `updateAutomationTopicSchema` | topic | topics | updates routing config | no | no | write |
| `/topics/:id` | DELETE | admin/trader + write limiter | UUID param | topic | topics, queue cascade | deletes topic | no | no | write/destructive |
| `/schedule` | GET | `authenticate`, read limiter | none | schedule | none | none | no | no | read-only safe |
| `/schedule` | PUT | admin/trader + write limiter | `updateScheduleSchema` | schedule | schedule | changes automation schedule config | no | no | write |
| `/queue` | GET | `authenticate`, read limiter | query `status`, `limit` | queue | none | none | no | no | read-only safe |
| `/queue/refresh` | POST | admin/trader + write limiter | none | topics, collected_data, categories, ACL/filter tables, executions, queue | queue | scans and enqueues candidates | yes | no | side-effecting |
| `/queue/dispatch` | POST | admin/trader + write limiter | `dispatchQueueSchema` | queue, collected_data, publisher, ACL/filter/mapping | queue, executions, publisher history if publisher service reaches history path | may send Telegram | no | yes | unsafe |
| `/queue/:id/dispatch` | POST | admin/trader + write limiter | UUID + `dispatchItemSchema` | queue, collected_data, publisher, ACL/filter/mapping | queue, executions, publisher history if reached | may send Telegram | no | yes | unsafe |
| `/queue/:id` | PATCH | admin/trader + write limiter | UUID + `failQueueItemSchema` | queue | queue, executions | marks failed | no | no | write |
| `/executions/:id/retry` | POST | admin/trader + write limiter | UUID param | execution, queue, collected_data, publisher | queue, executions, publisher history if reached | may send Telegram | possible queue insert | yes | unsafe |
| `/test-run` | POST | admin/trader + write limiter | `testRunSchema` | topics, queue, collected_data, publisher | queue, executions, publisher history if reached | refreshes queue then dispatches one item | yes | yes | unsafe despite default dry-run |
| `/executions` | GET | `authenticate`, read limiter | query `limit`, `offset` | executions + topic/publisher joins | none | none | no | no | read-only safe |

Nonexistent expected route:

- `/api/v1/data-hub/automation/runs/history` returns 404.
- Actual history route is `/api/v1/data-hub/automation/executions`.

## Phase 3: Database Audit

Automation migrations:

- `backend/database/migrations/026_create_datahub_automation_topics.sql`
- `backend/database/migrations/027_create_datahub_automation_queue.sql`

Related Publisher P2 migration:

- `backend/database/migrations/041_datahub_publisher_source_mappings.sql`

### Tables

`datahub_automation_topics`

- Columns: `id`, `name`, `topic_key`, `source_type`, `trigger_conditions`, `publish_targets`, `is_active`, `priority`, `created_by`, `created_at`, `updated_at`.
- Unique: `topic_key`.
- Indexes: active partial index, priority/updated index.
- Count: 3 rows, all active.
- Retention: none.

`datahub_automation_schedule`

- Columns: `id`, `enabled`, `interval_minutes`, `max_items_per_run`, `last_run_at`, `next_run_at`, `updated_at`.
- Single `default` row.
- Current status: disabled.
- Retention: not applicable.

`datahub_automation_queue`

- Columns include `topic_id`, `publisher_id`, `record_id`, `agent_id`, `status`, `priority`, `payload_preview`, `category`, `data_type`, `quality_score`, `normalized_status`, timestamps, metadata.
- FK: topic and publisher.
- Status check: `pending`, `processing`, `sent`, `failed`, `cancelled`.
- Unique partial index: `(record_id, publisher_id)` while status is `pending` or `processing`.
- Count: 35 rows: 8 pending, 12 sent, 15 failed.
- Retention: none found.

`datahub_automation_executions`

- Columns include `queue_item_id`, `topic_id`, `publisher_id`, `record_id`, `agent_id`, `status`, `dry_run`, `error_message`, `payload_preview`, `latency_ms`, `publisher_history_id`, metadata, `created_at`.
- FK: queue/topic/publisher set-null.
- Status check: `sent`, `failed`, `dry_run`.
- Index: `created_at DESC`.
- Count: 27 rows: 12 dry_run, 15 failed, 0 sent.
- Latest rows show repeated `Publisher is disabled`.
- Retention: none found.

`datahub_automation_rules`

- Not found.
- There is older/global topic-routing infrastructure (`topic_routing_rules`) separate from DataHub Automation Routing.

`telegram_publishers`

- 3 rows.
- 1 active publisher, but no current Automation topic targets that active publisher.
- The 3 Automation topics target disabled publishers.

`datahub_publisher_source_mappings`

- Exists from Telegram Publisher P2.
- Used by `runPublisherPublish` through `assertPublisherMapping`.
- Not checked directly by Automation queue refresh.

`publisher_delivery_history`

- Exists and includes P2 fields: `source_id`, `data_type`, `created_by`, `error_code`.
- Automation links to this via `datahub_automation_executions.publisher_history_id` when `runPublisherPublish` returns a history id.
- Disabled publisher throws before Publisher history is recorded.

## Phase 4: End-to-End Routing Flow

Actual flow:

```text
UI manual refresh/test-run
  -> POST /api/v1/data-hub/automation/queue/refresh or /test-run
  -> refreshAutomationQueue()
  -> listAutomationTopics()
  -> loadAutomationCandidateRecords()
       reads collected_data where status='processed'
       requires normalized_data
       restricts processed_at/collected_at to last 7 days
       LIMIT 75
  -> recordMatchesTopic()
       checks includeStatuses, minQualityScore, categoryIds, dataTypes
  -> enforceSourceAccess() for topic agent if agent key resolves
  -> enforceSourceAccess() for publisher runtime agent
  -> enforcePublishingPolicy() for automation_enqueue
  -> INSERT datahub_automation_queue pending

UI dispatch/test/retry
  -> dispatchAutomationQueue() / dispatchSingleQueueItem() / retryAutomationExecution()
  -> loadRecordPayload()
  -> enforceSourceAccess() for publisher runtime agent
  -> enforceSourceAccess() for topic agent if agent key resolves
  -> runPublisherPublish()
       checks publisher active
       checks source -> publisher mapping
       checks access control gateway payload
       checks publishing filters again
       sends/dry-runs according to Telegram Publisher environment
       records publisher_delivery_history only after publisher active check
  -> UPDATE datahub_automation_queue sent/failed
  -> INSERT datahub_automation_executions
```

Important behavior:

- Queue refresh dedupes pending/processing `(record_id, publisher_id)`.
- Delivered dedupe only checks `datahub_automation_executions` with status `sent` or `dry_run` over the last 7 days.
- Failed executions do not dedupe future queue refreshes.
- `retryAutomationExecution` can insert a new queue item and dispatch immediately.

## Phase 5: Access Control Compatibility

Verdict: **Partial**

Implemented:

- Before enqueue, Automation calls `resolveAgentKey(topic.agentId)` then `enforceSourceAccess` for the route agent if an agent key exists.
- Before enqueue, it calls `enforceSourceAccess` for `RUNTIME_AGENT_KEYS.PUBLISHER`.
- Before dispatch, it re-checks publisher runtime ACL.
- Before dispatch, it re-checks topic agent ACL if the route agent resolves.
- `runPublisherPublish` is called with `accessControl: buildAllowedAccessControl(...)`, then Telegram Publisher performs its own gateway assertion.
- Unit test exists: `backend/__tests__/unit/datahubAutomationAccessGateway.test.js`.

Gaps:

- If `resolveAgentKey(topic.agentId)` returns null, the route agent check is skipped.
- Queue refresh silently skips ACL-denied candidates; UI has no blocked reason.
- Dispatch marks failures but does not create a dedicated blocked status.
- Manual retry can dispatch live and still relies on runtime checks.
- No evidence of publisher-target validation at topic create/update time.

Required P2 outcome:

- Keep enqueue-time ACL check.
- Keep dispatch-time ACL recheck.
- Add visible blocked/skipped audit records.
- Add topic target validation.
- Make retry dry-run-safe and explicit.

## Phase 6: Blacklist/Whitelist Compatibility

Verdict: **Partial**

Implemented:

- Before enqueue, `refreshAutomationQueue` calls `enforcePublishingPolicy` with:
  - `sourceId`
  - URL from metadata
  - title/content/preview text
  - `dataType`
  - `enforcementPath: automation_enqueue`
- If `FILTER_RULE_BLOCKED`, candidate is skipped.
- During dispatch, `runPublisherPublish` calls Telegram Publisher policy enforcement again with `enforcementPath: telegram_publisher`.
- Unit test exists: `backend/__tests__/unit/datahubAutomationFilterRules.test.js`.

Gaps:

- Queue refresh only skips blocked items; UI does not show why.
- No queue item is created with blocked status.
- No direct Automation history row is written for enqueue-time filter blocks.
- Filter changes after enqueue are re-checked during dispatch by Telegram Publisher, but disabled publisher errors can happen before that path.

Required P2 outcome:

- Record blocked enqueue attempts in an auditable Automation log/history.
- Surface `FILTER_RULE_BLOCKED` in queue/runs UI.
- Keep dispatch-time recheck.

## Phase 7: Telegram Publisher P2 Compatibility

Verdict: **Partial / unsafe**

Implemented:

- Dispatch uses `runPublisherPublish`, so Publisher P2 mapping, ACL, filter, and history behavior can apply.
- It passes `source_id`, `data_type`, `content_type: automation`, `confirm_publish: true`, and access-control context.
- It does not pass `allow_temporary_publish`, so missing mapping should block in `assertPublisherMapping`.

Gaps:

- Queue refresh does not check `datahub_publisher_source_mappings`; unmapped source/publisher pairs can be queued and fail later.
- Topics can target disabled publishers; all 3 current topics do.
- Disabled publisher throws before `publisher_delivery_history`, so Automation history can show a dispatch attempt without Publisher history.
- `dry_run` from Automation is not passed to Telegram Publisher. Publisher dry-run is controlled by environment/token state.
- Retry forces `dryRun: false`.
- Current topics have weak mapping coverage: two demo topics have zero enabled mappings for recent sources.

Required compatibility rule:

```text
mapping allowed + ACL allowed + filter allowed + publisher active + dry-run honored
```

Current implementation only reliably enforces all of these during the Publisher service path, not before queue creation, and dry-run is not honored as a request-level guarantee.

## Phase 8: Topic and Rule Logic

Topic config is stored in `datahub_automation_topics.trigger_conditions` and `publish_targets`.

Supported:

- `agentId`
- `agentName`
- `description`
- `categoryIds`
- `dataTypes`
- `tags`
- `minPassRate`
- `minQualityScore`
- `includeStatuses`
- `publisherTargets`
- `enabled`
- `priority`

Selection source:

- `collected_data`, not pipeline snapshot.
- Requires `cd.status = 'processed'`.
- Requires `cd.normalized_data IS NOT NULL`.
- Uses records from the last 7 days based on `processed_at` or `collected_at`.
- Joins `data_sources` and `data_categories`.
- Uses metadata quality fields: `quality_score_v2`, `quality_score`, quality warning flags/bands.

Observed gaps:

- No source-id/source-name filter in UI or matching logic.
- `tags` and `minPassRate` are stored but not used by `recordMatchesTopic`.
- Source `is_active` is not checked in candidate query.
- Publisher mapping is ignored at topic selection/enqueue time.
- Candidate query has fixed `LIMIT 75`.
- Failed executions do not prevent future requeue.
- Category matching depends on category IDs mapping to names; invalid current count is 0.
- Topic publisher targets are not validated against active publishers.

## Phase 9: Queue Behavior

Statuses:

- DB queue: `pending`, `processing`, `sent`, `failed`, `cancelled`.
- UI queue type only models `pending`/`processing`.
- Execution: `sent`, `failed`, `dry_run`.

Queue creation:

- Created by `refreshAutomationQueue`.
- Inserts one pending row per topic/publisher/record candidate.
- Caps per refresh: `MAX_QUEUE = 25`.
- Caps per topic/publisher pair: `MAX_PER_PAIR = 3`.

Dedup:

- DB unique partial index prevents duplicate pending/processing `(record_id, publisher_id)`.
- Delivered dedupe prevents `sent`/`dry_run` duplicate over last 7 days.
- Failed items can be retried/requeued.

Retry/failure:

- `failQueueItem` marks queue failed and inserts execution failed.
- `retryAutomationExecution` reuses pending item if present, otherwise inserts a new pending queue item and immediately dispatches live (`dryRun: false`).

Locking/concurrency:

- `dispatchAutomationQueue` selects pending rows, then updates each to processing.
- No transaction, `FOR UPDATE`, `SKIP LOCKED`, advisory lock, or compare-and-swap update was found.
- Two concurrent dispatchers can select the same pending rows before either update lands.

Retention:

- No cleanup/retention behavior found for queue or executions.
- Queue can grow over time, especially with failed/sent retained forever.

Classification: **risky**

## Phase 10: Scheduler/Worker Audit

Findings:

- Schedule table and UI exist.
- `updateAutomationSchedule` writes `enabled`, `interval_minutes`, `max_items_per_run`, `next_run_at`.
- `touchScheduleAfterRun` updates `last_run_at` and `next_run_at` after manual dispatch.
- Current schedule is disabled.
- Search found no production caller outside route handlers/tests/demo script for `refreshAutomationQueue` or `dispatchAutomationQueue`.
- PM2 shows `titan-engine-worker` online with `SCHEDULER_ENABLED=true`, but no evidence that it calls Automation Routing.
- No advisory lock or single-flight lock found.
- No dry-run guarantee in a scheduler path was found.

Current production status:

- Automatic schedule config exists.
- Automatic Automation Routing worker appears not wired.
- Manual UI/API actions are the real execution path.

## Phase 11: Performance Audit

GET endpoints are currently fast:

- Overview: 23ms
- Topics: 8ms
- Queue: 8ms
- Executions: 7ms
- Schedule: 5ms

Heavy path check:

- No `buildDataPipelineView` call found in `datahubAutomationService.js`.
- No pipeline backlog call found.
- No duplicate-analysis heavy path found.
- Automation candidate scan reads `collected_data` directly with a 7-day window and `LIMIT 75`.

Performance verdict: **currently acceptable for read endpoints**, but refresh/dispatch write endpoints were not invoked because this audit is read-only.

## Phase 12: Runtime Safety Verification

No temporary runtime data was created because this task explicitly prohibited database modification:

- No temporary source.
- No temporary publisher.
- No temporary mapping.
- No temporary topic.
- No temporary queue candidate.
- No ACL deny rule.
- No filter block rule.
- No dispatch.

Read-only verification performed instead:

- Verified GET endpoints.
- Verified current queue/execution/topic/publisher/mapping state.
- Verified code-level enqueue ACL/filter checks.
- Verified code-level dispatch ACL/filter/mapping path through Telegram Publisher.
- Verified current topics target disabled publishers.
- Verified no `/runs/history` endpoint.

Safety conclusion:

- Runtime live dispatch was not safe to test under the constraints.
- Code evidence is sufficient to mark the current implementation unsafe for production use without fixes.

## Phase 13: UX Audit

Answers:

1. Can a user understand what Automation Routing does? **Partially.** The top description is short; it does not explain source-to-publisher requirements.
2. Can a user see which source routes to which publisher? **No.** Topics show publishers but not source mappings.
3. Can a user see why an item was blocked? **No.** Enqueue-time ACL/filter blocks are skipped silently.
4. Can a user see queue status? **Partially.** Pending queue shown; failed/sent queue retention not exposed clearly.
5. Can a user manually retry failed items? **Yes, but unsafe.** Retry can dispatch live.
6. Can a user see last run time? **Partially.** Schedule panel shows it, but schedule is not actually wired to a worker.
7. Can a user see dry-run vs real publish? **Partially/misleading.** Execution history shows dry-run, but UI dry-run does not force Publisher dry-run.
8. Are dangerous actions confirmed? **No.** Dispatch/approve/retry are not strongly confirmed.
9. Are errors surfaced? **Partially.** Some mutation errors show; per-item blocked/skipped reasons are not visible.

UX problems:

- Missing i18n keys can show raw keys.
- `Approve` should be renamed to `Publish now` or `Dry-run publish`.
- `Retry` needs a dry-run/live confirmation.
- Publisher target selector should show active/disabled/missing mapping status.
- Queue rows should show source name, source id, publisher, mapping state, ACL/filter state, dry-run/live mode.
- History should show `publisher_history_id`, `error_code`, source id, delivery mode, and whether Publisher history was missing.

## Recommended P2 Implementation Plan

1. Make dry-run authoritative:
   - Add explicit dry-run support to Telegram Publisher publish payload/service.
   - Pass Automation `dry_run` into `runPublisherPublish`.
   - Make retry default to dry-run or require explicit live confirmation.

2. Validate publisher targets:
   - At topic create/update, reject disabled/missing publishers or show warning.
   - In refresh, skip disabled publishers before queue insert.

3. Enforce mapping before enqueue:
   - Check `datahub_publisher_source_mappings` for each candidate source/publisher.
   - Record skipped mapping failures with code `PUBLISHER_MAPPING_REQUIRED`.

4. Improve auditability:
   - Add blocked/skipped automation history for ACL/filter/mapping blocks.
   - Preserve `publisher_history_id` when available.
   - Add explicit `blocked` or `skipped` statuses if needed.

5. Fix queue safety:
   - Use transaction + `FOR UPDATE SKIP LOCKED` or atomic `UPDATE ... WHERE status='pending' RETURNING`.
   - Add retry_count and max retry policy.
   - Add cleanup/retention for sent/failed rows.

6. Wire or remove schedule:
   - If automatic routing is desired, add a real worker with single-flight/advisory lock.
   - If not, label schedule as not active or remove the automatic wording.

7. Fix UI/i18n:
   - Add missing EN/FA keys.
   - Explain Topic, Route, Queue, Dispatch, Publisher Target, Agent Target.
   - Show source-to-publisher mapping status in topic and queue UI.

8. Add tests:
   - Dry-run cannot send live when env is live.
   - Retry defaults safe.
   - Disabled/unmapped publisher cannot enqueue or dispatch silently.
   - Concurrent dispatch cannot process same row twice.
   - Enqueue ACL/filter/mapping blocks are logged.

## Conclusion

Automation Routing has a real backend and real side-effecting routes, but it is not ready to be trusted as the bridge between DataHub and Telegram Publisher. The strongest parts are the existing ACL/filter checks before enqueue and during dispatch. The weakest parts are dry-run semantics, retry/live safety, publisher/mapping validation, scheduler wiring, concurrency, and UX visibility.

Final verdict: **D) BROKEN / UNSAFE**.
# DH-AUTOMATION-ROUTING-P1-FULL-RCA

Date: 2026-06-20

Mode: READ-ONLY AUDIT

Scope: Automation Routing tab and backend flow between DataHub pipeline data, Access Control, Blacklist/Whitelist, Telegram Publisher, queue, and history.

Hard constraints followed:

- No code changes.
- No database writes.
- No routing rules/topics/queue items created.
- No real Telegram dispatch.
- No performance optimization.

## Final Verdict

**D) BROKEN / UNSAFE**

Automation Routing is not UI-only. It has real UI, routes, database tables, queue refresh, queue dispatch, ACL checks, filter checks, and Telegram Publisher integration. However, it is not production-safe yet.

Main blockers:

- `dry_run` in Automation dispatch is not passed into `runPublisherPublish`; live safety depends on `TELEGRAM_PUBLISHER_DRY_RUN=true`, not on the Automation UI toggle.
- Retry always calls `dispatchQueueItem(..., { dryRun: false })`, so a failed automation execution can retry live without a dry-run option.
- Current production topics all target disabled publishers, so current routes cannot successfully publish.
- Queue refresh does not validate source-to-publisher mappings before enqueue; mapping is only enforced later by Telegram Publisher during dispatch.
- Disabled publisher errors happen before `publisher_delivery_history` is written, so Automation execution history exists but Publisher history can be missing.
- No production scheduler/worker caller was found for automatic queue refresh/dispatch; schedule config exists but does not appear wired into a running automation dispatcher.
- Several UI i18n keys used by the current component are missing in active locale files.
- Queue dispatch lacks row-level locking or `SKIP LOCKED`, so concurrent dispatch can double-process pending rows.

## Evidence Summary

Runtime GET measurements through local backend with admin JWT:

| Endpoint | Status | Latency | Response size |
|---|---:|---:|---:|
| `/api/v1/data-hub/automation/overview` | 200 | 0.023474s | 23519B |
| `/api/v1/data-hub/automation/topics` | 200 | 0.008360s | 1919B |
| `/api/v1/data-hub/automation/queue` | 200 | 0.007899s | 3560B |
| `/api/v1/data-hub/automation/executions?limit=20` | 200 | 0.006675s | 13305B |
| `/api/v1/data-hub/automation/schedule` | 200 | 0.005217s | 144B |
| `/api/v1/data-hub/automation/runs/history` | 404 | 0.002228s | 85B |

Runtime DB counts:

| Metric | Count |
|---|---:|
| Topics | 3 |
| Enabled topics | 3 |
| Disabled topics | 0 |
| Queue total | 35 |
| Queue pending | 8 |
| Queue processing | 0 |
| Queue sent | 12 |
| Queue failed | 15 |
| Executions total | 27 |
| Executions dry-run | 12 |
| Executions failed | 15 |
| Executions sent | 0 |
| Publisher-linked topics | 3 |
| Topics with missing publisher | 0 |
| Topics with disabled publisher | 3 |
| Topics with invalid category filters | 0 |

Current scheduler row:

| id | enabled | interval | max items | last run | next run |
|---|---:|---:|---:|---|---|
| `default` | false | 15m | 5 | 2026-06-01 15:49:18 UTC | 2026-06-20 11:42:32 UTC |

Current publisher target validity:

| Topic | Publisher | Publisher state |
|---|---|---|
| `Demo Topic 1779636651973` | `Automation Demo Publisher` | disabled |
| `Demo Topic 1779636779020` | `Automation Demo Publisher` | disabled |
| `سیگنال` | `تایتان تست` | disabled |

Mapping coverage for active topics against recent processed sources:

| Topic | Recent sources sampled | Enabled source mappings |
|---|---:|---:|
| `Demo Topic 1779636651973` | 41 | 0 |
| `Demo Topic 1779636779020` | 41 | 0 |
| `سیگنال` | 41 | 2 |

## Phase 1: UI Wiring Audit

Main UI file:

- `components/ai/AIManager/tabs/DataHub/advanced/AutomationTopics.tsx`

Supporting UI files:

- `components/ai/AIManager/tabs/DataHub/advanced/automation/AutomationTopicList.tsx`
- `components/ai/AIManager/tabs/DataHub/advanced/automation/AutomationQueueManager.tsx`
- `components/ai/AIManager/tabs/DataHub/advanced/automation/AutomationSchedulePanel.tsx`
- `components/ai/AIManager/tabs/DataHub/modals/AutomationTopicModal.tsx`
- `components/ai/AIManager/tabs/DataHub/modals/QueuePreviewModal.tsx`

Hook/API:

- `hooks/useDatahubAutomation.ts`
- `services/datahubAutomationApi.ts`

| UI item/action | Component | Hook/API | Backend route | Service | DB tables | Status |
|---|---|---|---|---|---|---|
| Overview cards | `AutomationTopics.tsx` | `useAutomationOverviewQuery` | `GET /overview` | `getAutomationOverview` | topics, queue, executions, schedule | working |
| Topics/routing rules list | `AutomationTopicList.tsx` | overview | `GET /overview`, `GET /topics` | `listAutomationTopics` | `datahub_automation_topics` | partial |
| Create topic | `AutomationTopicModal.tsx` | `useCreateAutomationTopicMutation` | `POST /topics` | `createAutomationTopic` | topics | working, but allows disabled publishers |
| Edit topic | `AutomationTopicModal.tsx` | `useUpdateAutomationTopicMutation` | `PUT /topics/:id` | `updateAutomationTopic` | topics | working, but no publisher/mapping validation |
| Enable/disable topic | `AutomationTopicModal.tsx` | update topic | `PUT /topics/:id` | `updateAutomationTopic` | topics | partial; hidden inside modal |
| Delete topic | `AutomationTopicList.tsx` | `useDeleteAutomationTopicMutation` | `DELETE /topics/:id` | `deleteAutomationTopic` | topics, cascade queue | working, confirmed by prompt only |
| Publisher target selection | `AutomationTopicModal.tsx` | publisher query + create/update topic | publisher list + topic write | `createAutomationTopic` | topics, telegram_publishers | partial; does not filter disabled/unmapped publishers |
| Source/category/data type filters | `AutomationTopicModal.tsx` | create/update topic | `POST/PUT /topics` | `recordMatchesTopic` | topics JSONB, categories, collected_data | partial; source filter missing |
| Status/quality filters | `AutomationTopicModal.tsx` | create/update topic | `POST/PUT /topics` | `recordMatchesTopic` | topics JSONB, collected_data metadata | partial |
| Manual refresh | `AutomationTopics.tsx` | `useRefreshAutomationQueueMutation` | `POST /queue/refresh` | `refreshAutomationQueue` | queue, collected_data, ACL/filter tables | working, side-effecting |
| Manual dispatch queue | `AutomationQueueManager.tsx` | `useDispatchAutomationQueueMutation` | `POST /queue/dispatch` | `dispatchAutomationQueue` | queue, executions, publisher history | unsafe |
| Dispatch single queue item / approve | `AutomationQueueManager.tsx`, `QueuePreviewModal.tsx` | `useDispatchQueueItemMutation` | `POST /queue/:id/dispatch` | `dispatchSingleQueueItem` | queue, executions, publisher history | unsafe |
| Reject queue item | `AutomationQueueManager.tsx` | `useFailQueueItemMutation` | `PATCH /queue/:id` | `failQueueItem` | queue, executions | working |
| Runs/history | `AutomationTopics.tsx` | overview/executions | `GET /executions` | `listAutomationExecutions` | executions | partial |
| Retry failed execution | `AutomationTopics.tsx` | `useRetryAutomationExecutionMutation` | `POST /executions/:id/retry` | `retryAutomationExecution` | queue, executions, publisher history | unsafe |
| Test run | `AutomationTopics.tsx` | `useAutomationTestRunMutation` | `POST /test-run` | `runAutomationTest` | queue, executions, publisher history | unsafe/side-effecting |
| Schedule toggle/interval | `AutomationSchedulePanel.tsx` | `useUpdateAutomationScheduleMutation` | `PUT /schedule` | `updateAutomationSchedule` | schedule | UI/config works; no worker wiring found |

### UI Label Clarity

The UI uses terms like `Topic`, `Route`, `Queue`, `Dispatch`, `Publisher`, and `Agent`, but the copy is not enough for a normal operator to know:

- Whether dispatch is live or dry-run.
- Whether a publisher target is mapped to the source.
- Whether a target publisher is disabled.
- Why a queue item was blocked or failed.
- Whether `Retry` can send a live Telegram message.
- Whether `Approve` means "publish now" or merely mark approved.

### Missing i18n Keys

Checked against `deploy/green/locales/en.json` and `deploy/green/locales/fa.json`.

Missing in EN:

`dry_run`, `test_run`, `add_topic`, `active_routing`, `queue_size`, `avg_pass_rate`, `dispatch_interval`, `last_dispatch`, `next_dispatch`, `active_routing_rules`, `target_agent`, `publish_to`, `processed`, `rejected`, `automation_queue`, `automation_queue_desc`, `dispatch_queue`, `time`, `topic`, `actions`, `view`, `approve`, `reject`, `queue_empty`.

Missing in FA:

`dry_run`, `test_run`, `add_topic`, `active_routing`, `queue_size`, `avg_pass_rate`, `dispatch_interval`, `last_dispatch`, `next_dispatch`, `active_routing_rules`, `target_agent`, `publish_to`, `processed`, `rejected`, `automation_queue`, `automation_queue_desc`, `dispatch_queue`, `time`, `topic`, `view`, `approve`, `reject`, `queue_empty`.

## Phase 2: Backend Route Audit

Mounted under:

- `backend/routes/v1/index.js`
- Base path: `/api/v1/data-hub/automation`

Route file:

- `backend/routes/data-hub-automation.js`

Schemas:

- `backend/schemas/datahubAutomationSchemas.js`

Service:

- `backend/services/datahubAutomationService.js`

| Route | Method | Auth | Schema/body | Reads | Writes | Side effects | Can enqueue | Can dispatch/publish | Safety |
|---|---|---|---|---|---|---|---:|---:|---|
| `/overview` | GET | `authenticate`, read limiter | none | topics, schedule, queue, executions, publishers | none | none | no | no | read-only safe |
| `/topics` | GET | `authenticate`, read limiter | none | topics + stats | none | none | no | no | read-only safe |
| `/topics` | POST | admin/trader + write limiter | `createAutomationTopicSchema` | none | topics | creates routing config | no | no | write |
| `/topics/:id` | PUT | admin/trader + write limiter | `updateAutomationTopicSchema` | topic | topics | updates routing config | no | no | write |
| `/topics/:id` | DELETE | admin/trader + write limiter | UUID param | topic | topics, queue cascade | deletes topic | no | no | write/destructive |
| `/schedule` | GET | `authenticate`, read limiter | none | schedule | none | none | no | no | read-only safe |
| `/schedule` | PUT | admin/trader + write limiter | `updateScheduleSchema` | schedule | schedule | changes automation schedule config | no | no | write |
| `/queue` | GET | `authenticate`, read limiter | query `status`, `limit` | queue | none | none | no | no | read-only safe |
| `/queue/refresh` | POST | admin/trader + write limiter | none | topics, collected_data, categories, ACL/filter tables, executions, queue | queue | scans and enqueues candidates | yes | no | side-effecting |
| `/queue/dispatch` | POST | admin/trader + write limiter | `dispatchQueueSchema` | queue, collected_data, publisher, ACL/filter/mapping | queue, executions, publisher history if publisher service reaches history path | may send Telegram | no | yes | unsafe |
| `/queue/:id/dispatch` | POST | admin/trader + write limiter | UUID + `dispatchItemSchema` | queue, collected_data, publisher, ACL/filter/mapping | queue, executions, publisher history if reached | may send Telegram | no | yes | unsafe |
| `/queue/:id` | PATCH | admin/trader + write limiter | UUID + `failQueueItemSchema` | queue | queue, executions | marks failed | no | no | write |
| `/executions/:id/retry` | POST | admin/trader + write limiter | UUID param | execution, queue, collected_data, publisher | queue, executions, publisher history if reached | may send Telegram | possible queue insert | yes | unsafe |
| `/test-run` | POST | admin/trader + write limiter | `testRunSchema` | topics, queue, collected_data, publisher | queue, executions, publisher history if reached | refreshes queue then dispatches one item | yes | yes | unsafe despite default dry-run |
| `/executions` | GET | `authenticate`, read limiter | query `limit`, `offset` | executions + topic/publisher joins | none | none | no | no | read-only safe |

Nonexistent expected route:

- `/api/v1/data-hub/automation/runs/history` returns 404.
- Actual history route is `/api/v1/data-hub/automation/executions`.

## Phase 3: Database Audit

Automation migrations:

- `backend/database/migrations/026_create_datahub_automation_topics.sql`
- `backend/database/migrations/027_create_datahub_automation_queue.sql`

Related Publisher P2 migration:

- `backend/database/migrations/041_datahub_publisher_source_mappings.sql`

### Tables

`datahub_automation_topics`

- Columns: `id`, `name`, `topic_key`, `source_type`, `trigger_conditions`, `publish_targets`, `is_active`, `priority`, `created_by`, `created_at`, `updated_at`.
- Unique: `topic_key`.
- Indexes: active partial index, priority/updated index.
- Count: 3 rows, all active.
- Retention: none.

`datahub_automation_schedule`

- Columns: `id`, `enabled`, `interval_minutes`, `max_items_per_run`, `last_run_at`, `next_run_at`, `updated_at`.
- Single `default` row.
- Current status: disabled.
- Retention: not applicable.

`datahub_automation_queue`

- Columns include `topic_id`, `publisher_id`, `record_id`, `agent_id`, `status`, `priority`, `payload_preview`, `category`, `data_type`, `quality_score`, `normalized_status`, timestamps, metadata.
- FK: topic and publisher.
- Status check: `pending`, `processing`, `sent`, `failed`, `cancelled`.
- Unique partial index: `(record_id, publisher_id)` while status is `pending` or `processing`.
- Count: 35 rows: 8 pending, 12 sent, 15 failed.
- Retention: none found.

`datahub_automation_executions`

- Columns include `queue_item_id`, `topic_id`, `publisher_id`, `record_id`, `agent_id`, `status`, `dry_run`, `error_message`, `payload_preview`, `latency_ms`, `publisher_history_id`, metadata, `created_at`.
- FK: queue/topic/publisher set-null.
- Status check: `sent`, `failed`, `dry_run`.
- Index: `created_at DESC`.
- Count: 27 rows: 12 dry_run, 15 failed, 0 sent.
- Latest rows show repeated `Publisher is disabled`.
- Retention: none found.

`datahub_automation_rules`

- Not found.
- There is older/global topic-routing infrastructure (`topic_routing_rules`) separate from DataHub Automation Routing.

`telegram_publishers`

- 3 rows.
- 1 active publisher, but no current Automation topic targets that active publisher.
- The 3 Automation topics target disabled publishers.

`datahub_publisher_source_mappings`

- Exists from Telegram Publisher P2.
- Used by `runPublisherPublish` through `assertPublisherMapping`.
- Not checked directly by Automation queue refresh.

`publisher_delivery_history`

- Exists and includes P2 fields: `source_id`, `data_type`, `created_by`, `error_code`.
- Automation links to this via `datahub_automation_executions.publisher_history_id` when `runPublisherPublish` returns a history id.
- Disabled publisher throws before Publisher history is recorded.

## Phase 4: End-to-End Routing Flow

Actual flow:

```text
UI manual refresh/test-run
  -> POST /api/v1/data-hub/automation/queue/refresh or /test-run
  -> refreshAutomationQueue()
  -> listAutomationTopics()
  -> loadAutomationCandidateRecords()
       reads collected_data where status='processed'
       requires normalized_data
       restricts processed_at/collected_at to last 7 days
       LIMIT 75
  -> recordMatchesTopic()
       checks includeStatuses, minQualityScore, categoryIds, dataTypes
  -> enforceSourceAccess() for topic agent if agent key resolves
  -> enforceSourceAccess() for publisher runtime agent
  -> enforcePublishingPolicy() for automation_enqueue
  -> INSERT datahub_automation_queue pending

UI dispatch/test/retry
  -> dispatchAutomationQueue() / dispatchSingleQueueItem() / retryAutomationExecution()
  -> loadRecordPayload()
  -> enforceSourceAccess() for publisher runtime agent
  -> enforceSourceAccess() for topic agent if agent key resolves
  -> runPublisherPublish()
       checks publisher active
       checks source -> publisher mapping
       checks access control gateway payload
       checks publishing filters again
       sends/dry-runs according to Telegram Publisher environment
       records publisher_delivery_history only after publisher active check
  -> UPDATE datahub_automation_queue sent/failed
  -> INSERT datahub_automation_executions
```

Important behavior:

- Queue refresh dedupes pending/processing `(record_id, publisher_id)`.
- Delivered dedupe only checks `datahub_automation_executions` with status `sent` or `dry_run` over the last 7 days.
- Failed executions do not dedupe future queue refreshes.
- `retryAutomationExecution` can insert a new queue item and dispatch immediately.

## Phase 5: Access Control Compatibility

Verdict: **Partial**

Implemented:

- Before enqueue, Automation calls `resolveAgentKey(topic.agentId)` then `enforceSourceAccess` for the route agent if an agent key exists.
- Before enqueue, it calls `enforceSourceAccess` for `RUNTIME_AGENT_KEYS.PUBLISHER`.
- Before dispatch, it re-checks publisher runtime ACL.
- Before dispatch, it re-checks topic agent ACL if the route agent resolves.
- `runPublisherPublish` is called with `accessControl: buildAllowedAccessControl(...)`, then Telegram Publisher performs its own gateway assertion.
- Unit test exists: `backend/__tests__/unit/datahubAutomationAccessGateway.test.js`.

Gaps:

- If `resolveAgentKey(topic.agentId)` returns null, the route agent check is skipped.
- Queue refresh silently skips ACL-denied candidates; UI has no blocked reason.
- Dispatch marks failures but does not create a dedicated blocked status.
- Manual retry can dispatch live and still relies on runtime checks.
- No evidence of publisher-target validation at topic create/update time.

Required P2 outcome:

- Keep enqueue-time ACL check.
- Keep dispatch-time ACL recheck.
- Add visible blocked/skipped audit records.
- Add topic target validation.
- Make retry dry-run-safe and explicit.

## Phase 6: Blacklist/Whitelist Compatibility

Verdict: **Partial**

Implemented:

- Before enqueue, `refreshAutomationQueue` calls `enforcePublishingPolicy` with:
  - `sourceId`
  - URL from metadata
  - title/content/preview text
  - `dataType`
  - `enforcementPath: automation_enqueue`
- If `FILTER_RULE_BLOCKED`, candidate is skipped.
- During dispatch, `runPublisherPublish` calls Telegram Publisher policy enforcement again with `enforcementPath: telegram_publisher`.
- Unit test exists: `backend/__tests__/unit/datahubAutomationFilterRules.test.js`.

Gaps:

- Queue refresh only skips blocked items; UI does not show why.
- No queue item is created with blocked status.
- No direct Automation history row is written for enqueue-time filter blocks.
- Filter changes after enqueue are re-checked during dispatch by Telegram Publisher, but disabled publisher errors can happen before that path.

Required P2 outcome:

- Record blocked enqueue attempts in an auditable Automation log/history.
- Surface `FILTER_RULE_BLOCKED` in queue/runs UI.
- Keep dispatch-time recheck.

## Phase 7: Telegram Publisher P2 Compatibility

Verdict: **Partial / unsafe**

Implemented:

- Dispatch uses `runPublisherPublish`, so Publisher P2 mapping, ACL, filter, and history behavior can apply.
- It passes `source_id`, `data_type`, `content_type: automation`, `confirm_publish: true`, and access-control context.
- It does not pass `allow_temporary_publish`, so missing mapping should block in `assertPublisherMapping`.

Gaps:

- Queue refresh does not check `datahub_publisher_source_mappings`; unmapped source/publisher pairs can be queued and fail later.
- Topics can target disabled publishers; all 3 current topics do.
- Disabled publisher throws before `publisher_delivery_history`, so Automation history can show a dispatch attempt without Publisher history.
- `dry_run` from Automation is not passed to Telegram Publisher. Publisher dry-run is controlled by environment/token state.
- Retry forces `dryRun: false`.
- Current topics have weak mapping coverage: two demo topics have zero enabled mappings for recent sources.

Required compatibility rule:

```text
mapping allowed + ACL allowed + filter allowed + publisher active + dry-run honored
```

Current implementation only reliably enforces all of these during the Publisher service path, not before queue creation, and dry-run is not honored as a request-level guarantee.

## Phase 8: Topic and Rule Logic

Topic config is stored in `datahub_automation_topics.trigger_conditions` and `publish_targets`.

Supported:

- `agentId`
- `agentName`
- `description`
- `categoryIds`
- `dataTypes`
- `tags`
- `minPassRate`
- `minQualityScore`
- `includeStatuses`
- `publisherTargets`
- `enabled`
- `priority`

Selection source:

- `collected_data`, not pipeline snapshot.
- Requires `cd.status = 'processed'`.
- Requires `cd.normalized_data IS NOT NULL`.
- Uses records from the last 7 days based on `processed_at` or `collected_at`.
- Joins `data_sources` and `data_categories`.
- Uses metadata quality fields: `quality_score_v2`, `quality_score`, quality warning flags/bands.

Observed gaps:

- No source-id/source-name filter in UI or matching logic.
- `tags` and `minPassRate` are stored but not used by `recordMatchesTopic`.
- Source `is_active` is not checked in candidate query.
- Publisher mapping is ignored at topic selection/enqueue time.
- Candidate query has fixed `LIMIT 75`.
- Failed executions do not prevent future requeue.
- Category matching depends on category IDs mapping to names; invalid current count is 0.
- Topic publisher targets are not validated against active publishers.

## Phase 9: Queue Behavior

Statuses:

- DB queue: `pending`, `processing`, `sent`, `failed`, `cancelled`.
- UI queue type only models `pending`/`processing`.
- Execution: `sent`, `failed`, `dry_run`.

Queue creation:

- Created by `refreshAutomationQueue`.
- Inserts one pending row per topic/publisher/record candidate.
- Caps per refresh: `MAX_QUEUE = 25`.
- Caps per topic/publisher pair: `MAX_PER_PAIR = 3`.

Dedup:

- DB unique partial index prevents duplicate pending/processing `(record_id, publisher_id)`.
- Delivered dedupe prevents `sent`/`dry_run` duplicate over last 7 days.
- Failed items can be retried/requeued.

Retry/failure:

- `failQueueItem` marks queue failed and inserts execution failed.
- `retryAutomationExecution` reuses pending item if present, otherwise inserts a new pending queue item and immediately dispatches live (`dryRun: false`).

Locking/concurrency:

- `dispatchAutomationQueue` selects pending rows, then updates each to processing.
- No transaction, `FOR UPDATE`, `SKIP LOCKED`, advisory lock, or compare-and-swap update was found.
- Two concurrent dispatchers can select the same pending rows before either update lands.

Retention:

- No cleanup/retention behavior found for queue or executions.
- Queue can grow over time, especially with failed/sent retained forever.

Classification: **risky**

## Phase 10: Scheduler/Worker Audit

Findings:

- Schedule table and UI exist.
- `updateAutomationSchedule` writes `enabled`, `interval_minutes`, `max_items_per_run`, `next_run_at`.
- `touchScheduleAfterRun` updates `last_run_at` and `next_run_at` after manual dispatch.
- Current schedule is disabled.
- Search found no production caller outside route handlers/tests/demo script for `refreshAutomationQueue` or `dispatchAutomationQueue`.
- PM2 shows `titan-engine-worker` online with `SCHEDULER_ENABLED=true`, but no evidence that it calls Automation Routing.
- No advisory lock or single-flight lock found.
- No dry-run guarantee in a scheduler path was found.

Current production status:

- Automatic schedule config exists.
- Automatic Automation Routing worker appears not wired.
- Manual UI/API actions are the real execution path.

## Phase 11: Performance Audit

GET endpoints are currently fast:

- Overview: 23ms
- Topics: 8ms
- Queue: 8ms
- Executions: 7ms
- Schedule: 5ms

Heavy path check:

- No `buildDataPipelineView` call found in `datahubAutomationService.js`.
- No pipeline backlog call found.
- No duplicate-analysis heavy path found.
- Automation candidate scan reads `collected_data` directly with a 7-day window and `LIMIT 75`.

Performance verdict: **currently acceptable for read endpoints**, but refresh/dispatch write endpoints were not invoked because this audit is read-only.

## Phase 12: Runtime Safety Verification

No temporary runtime data was created because this task explicitly prohibited database modification:

- No temporary source.
- No temporary publisher.
- No temporary mapping.
- No temporary topic.
- No temporary queue candidate.
- No ACL deny rule.
- No filter block rule.
- No dispatch.

Read-only verification performed instead:

- Verified GET endpoints.
- Verified current queue/execution/topic/publisher/mapping state.
- Verified code-level enqueue ACL/filter checks.
- Verified code-level dispatch ACL/filter/mapping path through Telegram Publisher.
- Verified current topics target disabled publishers.
- Verified no `/runs/history` endpoint.

Safety conclusion:

- Runtime live dispatch was not safe to test under the constraints.
- Code evidence is sufficient to mark the current implementation unsafe for production use without fixes.

## Phase 13: UX Audit

Answers:

1. Can a user understand what Automation Routing does? **Partially.** The top description is short; it does not explain source-to-publisher requirements.
2. Can a user see which source routes to which publisher? **No.** Topics show publishers but not source mappings.
3. Can a user see why an item was blocked? **No.** Enqueue-time ACL/filter blocks are skipped silently.
4. Can a user see queue status? **Partially.** Pending queue shown; failed/sent queue retention not exposed clearly.
5. Can a user manually retry failed items? **Yes, but unsafe.** Retry can dispatch live.
6. Can a user see last run time? **Partially.** Schedule panel shows it, but schedule is not actually wired to a worker.
7. Can a user see dry-run vs real publish? **Partially/misleading.** Execution history shows dry-run, but UI dry-run does not force Publisher dry-run.
8. Are dangerous actions confirmed? **No.** Dispatch/approve/retry are not strongly confirmed.
9. Are errors surfaced? **Partially.** Some mutation errors show; per-item blocked/skipped reasons are not visible.

UX problems:

- Missing i18n keys can show raw keys.
- `Approve` should be renamed to `Publish now` or `Dry-run publish`.
- `Retry` needs a dry-run/live confirmation.
- Publisher target selector should show active/disabled/missing mapping status.
- Queue rows should show source name, source id, publisher, mapping state, ACL/filter state, dry-run/live mode.
- History should show `publisher_history_id`, `error_code`, source id, delivery mode, and whether Publisher history was missing.

## Recommended P2 Implementation Plan

1. Make dry-run authoritative:
   - Add explicit dry-run support to Telegram Publisher publish payload/service.
   - Pass Automation `dry_run` into `runPublisherPublish`.
   - Make retry default to dry-run or require explicit live confirmation.

2. Validate publisher targets:
   - At topic create/update, reject disabled/missing publishers or show warning.
   - In refresh, skip disabled publishers before queue insert.

3. Enforce mapping before enqueue:
   - Check `datahub_publisher_source_mappings` for each candidate source/publisher.
   - Record skipped mapping failures with code `PUBLISHER_MAPPING_REQUIRED`.

4. Improve auditability:
   - Add blocked/skipped automation history for ACL/filter/mapping blocks.
   - Preserve `publisher_history_id` when available.
   - Add explicit `blocked` or `skipped` statuses if needed.

5. Fix queue safety:
   - Use transaction + `FOR UPDATE SKIP LOCKED` or atomic `UPDATE ... WHERE status='pending' RETURNING`.
   - Add retry_count and max retry policy.
   - Add cleanup/retention for sent/failed rows.

6. Wire or remove schedule:
   - If automatic routing is desired, add a real worker with single-flight/advisory lock.
   - If not, label schedule as not active or remove the automatic wording.

7. Fix UI/i18n:
   - Add missing EN/FA keys.
   - Explain Topic, Route, Queue, Dispatch, Publisher Target, Agent Target.
   - Show source-to-publisher mapping status in topic and queue UI.

8. Add tests:
   - Dry-run cannot send live when env is live.
   - Retry defaults safe.
   - Disabled/unmapped publisher cannot enqueue or dispatch silently.
   - Concurrent dispatch cannot process same row twice.
   - Enqueue ACL/filter/mapping blocks are logged.

## Conclusion

Automation Routing has a real backend and real side-effecting routes, but it is not ready to be trusted as the bridge between DataHub and Telegram Publisher. The strongest parts are the existing ACL/filter checks before enqueue and during dispatch. The weakest parts are dry-run semantics, retry/live safety, publisher/mapping validation, scheduler wiring, concurrency, and UX visibility.

Final verdict: **D) BROKEN / UNSAFE**.
