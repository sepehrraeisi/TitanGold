# DH-AUTOMATION-ROUTING-P3 — End-to-End RCA (Read-Only)

Date: 2026-06-27  
Mode: **READ-ONLY AUDIT** — no code changes in this phase  
Prior work: `DH-AUTOMATION-ROUTING-P1-FULL-RCA.md`, `DH-AUTOMATION-ROUTING-P2-SAFETY-FIX.md`  
Engineering rules: Titan/DataHub Engineering Rules v2.1

## Final Verdict (Phase 1)

**PARTIAL — FUNCTIONAL BUT CONFUSING**

Automation Routing is **not UI-only**. Backend routes, DB tables, queue refresh, ACL/filter/mapping gates, and Telegram Publisher integration all exist. P2 safety fixes (dry-run default, `confirm_live`, mapping before enqueue, audit executions) are present in code.

However, the **production configuration currently blocks the entire chain**:

- All 3 active topics target **disabled** Telegram Publishers.
- Source→publisher mappings point to a **disabled** publisher; the one **active** publisher has **zero** mappings.
- Queue pending count is **0** because refresh correctly skips disabled publishers (audit `PUBLISHER_DISABLED` rows written today).
- No background automation worker runs; schedule is manual/config-only by design.
- UI metrics (Queue size 0, Avg pass rate 0%) are **technically correct but misleading** without explanation.
- Delivery History mixes **current** skipped audits with **stale** test-run orphan failures.

**Telegram Collector is healthy and unrelated to Automation breakage.**  
**End-to-end dry-run routing cannot succeed until topics/mappings target an active publisher.**

Do **not** claim REAL WORKING until Phase 7–8 browser + runtime dry-run proof with valid fixture.

---

## Phase 0 — Scope

This document covers **Part A only** (functional RCA). UX redesign (Part B) is deferred until after fixes are confirmed.

Safety constraints observed:

- No live Telegram sends during this audit.
- All DB queries were read-only SELECT.
- No temporary test rows created in this phase.

---

## 1. What Automation Routing Is Supposed To Do

**Plain explanation:**

Automation Routing takes **processed DataHub records** (`collected_data` with status `processed`) and routes them to **Telegram Publisher** output channels based on **topic rules** (agent, categories, data types, quality/status filters).

It does **not**:

- Collect Telegram messages (Telegram Collector does that).
- Store bot credentials (Telegram Publisher is the delivery layer and credential owner).

**Source of truth for delivery:** `telegram_publishers` + `runPublisherPublish()` in `telegramPublisherService.js`.

**Expected flow:**

```
Processed Data → Topic Rule → ACL / Filter Rules → Publisher Mapping → Telegram Publisher → Dry-run / Live Delivery
```

---

## 2. Actual Current Flow (Code Trace)

| Step | Component | File | Table(s) |
|------|-----------|------|----------|
| 1. Collect | Telegram Collector / external crawlers | `telegramPipeline.js`, `dataFetchScheduler.js` | `telegram_channels`, `telegram_messages`, `data_sources` |
| 2. Transfer | Scheduler ~5 min | `backend/engine/scheduler.js` → `transferTelegramMessagesToPipeline` | `collected_data` (status `pending`) |
| 3. Normalize | Scheduler ~1 min | `normalizationWorker.js` | `collected_data` (status `processed`) |
| 4. Match topics | Manual `POST /queue/refresh` | `datahubAutomationService.js:560–757` | reads `collected_data`, `datahub_automation_topics` |
| 5. Gate | ACL + filters + mapping | same + `sourceAccessControl`, `datahub_filter_rules` | `source_access_controls`, `datahub_filter_rules`, `datahub_publisher_source_mappings` |
| 6. Enqueue | INSERT queue | `refreshAutomationQueue` | `datahub_automation_queue` |
| 7. Dispatch | Manual `POST /queue/dispatch` | `dispatchQueueItem` → `runPublisherPublish` | queue UPDATE + `datahub_automation_executions` + `publisher_delivery_history` |
| 8. History | GET overview/executions | `getAutomationOverview` | executions + publisher history |

**UI entry:** `AdvancedFeatures.tsx` → `AutomationTopics.tsx`  
**API base:** `/api/v1/data-hub/automation/*` → `backend/routes/data-hub-automation.js`

**No backend cron worker** dispatches automation. `datahub_automation_schedule.enabled = false`. UI text in `AutomationSchedulePanel.tsx:35` states manual/config-only.

---

## 3. Tables Involved (Actual Names from Migrations)

| Table | Migration | Role |
|-------|-----------|------|
| `data_sources` | various | Source registry (type=`telegram`, `api`, etc.) |
| `telegram_channels` | collector schema | Linked Telegram channels |
| `telegram_messages` | collector schema | Raw fetched messages |
| `collected_data` | `012_create_collected_data.sql` | Pipeline records (`pending` → `processed`) |
| `datahub_automation_topics` | `026_create_datahub_automation_topics.sql` | Topic rules (`is_active`, `trigger_conditions`, `publish_targets`) |
| `datahub_automation_schedule` | `027_create_datahub_automation_queue.sql` | Schedule config (no worker wired) |
| `datahub_automation_queue` | `027` + `042` | Pending/failed/sent jobs |
| `datahub_automation_executions` | `027` + `042` | Audit/dispatch history (`blocked`, `skipped`, `dry_run`, etc.) |
| `telegram_publishers` | `025_create_telegram_publishers.sql` | Output publishers |
| `publisher_delivery_history` | `025` + `041` | Publisher-side delivery/test history |
| `datahub_publisher_source_mappings` | `041_datahub_publisher_source_mappings.sql` | Allowed source→publisher pairs (`is_enabled`) |
| `source_access_controls` | `021_create_source_access_control.sql` | Per-source ACL (no `is_active` column) |
| `datahub_filter_rules` | filter migrations | Publish filter rules (`is_active`) |
| `data_hub_logs` | logging | Operational logs |

**Note:** `datahub_automation_rules` is documented elsewhere but **has no migration/table**. Global `topic_routing_rules` is a separate feature.

---

## 4. Read-Only DB Evidence (2026-06-27)

### 4.1 Pipeline / Collector counts

| Metric | Value | Evidence |
|--------|------:|----------|
| Active telegram channels | 43 / 45 | `telegram_channels` |
| Active telegram data sources | 45 / 55 | `data_sources` WHERE `type='telegram'` |
| Telegram messages last 1h | 2,474 | `telegram_messages` |
| Telegram messages last 24h | 38,285 | `telegram_messages` |
| Latest telegram message | 2026-06-27T12:44:11Z | `MAX(created_at)` |
| collected_data processed last 1h | 8,135 | `collected_data` |
| collected_data processed last 24h | 185,574 | `collected_data` |
| collected_data pending total | 250 | `collected_data` |
| collected_data telegram processed 24h | 185,710 | join `data_sources.type='telegram'` |

**Conclusion:** Ingestion + normalization pipeline is **active**. Lack of queue items is **not** due to missing processed data.

### 4.2 Automation counts

| Metric | Value |
|--------|------:|
| Topics total | 3 |
| Topics active (`is_active`) | 3 |
| Queue pending | **0** |
| Queue failed | 23 |
| Queue sent | 12 |
| Executions skipped | 48 |
| Executions failed | 22 |
| Executions dry_run | 12 |
| Executions blocked | 1 |
| Publishers total | 4 |
| Publishers active | **1** |
| Publishers disabled | 3 |
| Mappings total | 2 |
| Mappings enabled (`is_enabled`) | 2 |
| Filter rules active | 0 / 1 |
| ACL rows | 1 |
| Schedule enabled | **false** |
| Schedule last_run_at | 2026-06-20T15:20:14Z |

### 4.3 Executions by error code (from `metadata->>'error_code'`)

| Status | Error code | Count |
|--------|------------|------:|
| skipped | PUBLISHER_DISABLED | 48 |
| failed | (null) | 15 |
| dry_run | (null) | 12 |
| failed | AUTOMATION_ERROR | 5 |
| failed | SOURCE_RECORD_NOT_FOUND | 2 |
| blocked | PUBLISHER_DISABLED | 1 |

### 4.4 API performance baseline (authenticated GET, local backend)

| Endpoint | HTTP | Latency |
|----------|------|--------:|
| `/overview` | 200 | 49ms |
| `/topics` | 200 | 18ms |
| `/queue` | 200 | 17ms |
| `/executions?limit=20` | 200 | 17ms |
| `/schedule` | 200 | 13ms |

All under 500ms target. No full pipeline snapshot on overview load (parallel queries in `getAutomationOverview`).

---

## 5. Per-Topic Analysis

| Topic | Active | Agent / filters | Publisher target | Publisher active? | Enabled mappings | Last execution | Last status | Last error | Can enqueue? | Can dispatch? |
|-------|--------|-----------------|------------------|-------------------|------------------|----------------|-------------|------------|--------------|---------------|
| Demo Topic 1779636651973 | yes | demo-agent, statuses ready | Automation Demo Publisher (`bc5ce007…`) | **no** | 0 | 2026-06-27T12:16:48Z | skipped | PUBLISHER_DISABLED | **no** | **no** |
| Demo Topic 1779636779020 | yes | demo-agent, ready/warning | Automation Demo Publisher (`bc5ce007…`) | **no** | 0 | 2026-06-27T12:16:48Z | skipped | PUBLISHER_DISABLED | **no** | **no** |
| سیگنال | yes | agent `e0516b87…`, categories×3, types api/telegram/rss | تایتان تست (`5ab9a6bc…`) | **no** | 2 (both point to disabled publisher) | 2026-06-27T12:16:48Z | skipped | PUBLISHER_DISABLED | **no** | **no** |

**Active publisher not used by any topic:**

| Publisher | ID | Active | Mappings |
|-----------|-----|--------|----------|
| تایتان تست | `887495e6-0b47-4450-88ef-35dd43477f9a` | **yes** | **0** |

**Root configuration gap:** Topics and mappings reference **old/disabled** publisher rows. The **current active** publisher has no topic targets and no source mappings.

### Pass rate / queue size UI explanation

From `getAutomationOverview()` (`datahubAutomationService.js:1273–1282`):

- `queueSize` = pending queue rows only → **0** (correct).
- `avgPassRate` = average of `topic.stats.last24h.passRate`.

`computeTopicStats()` (`216–239`) derives pass rate from **queue failed + published24h + queued**, not from skipped audit events. Historical **failed queue rows** (23 total) drive `inflow` and `rejected`, yielding **0% pass rate** even when the real blocker today is publisher-disabled skips at refresh.

Example from live `/overview` API:

- Demo Topic 1779636779020: `inflow: 17, approved: 0, rejected: 17, passRate: 0`
- All topics show `passRate: 0` while `totalPublished` history exists (11, 11, 1) from older dry-runs.

---

## 6. Delivery History Error Root Causes

### 6.1 PUBLISHER_DISABLED

| Field | Value |
|-------|-------|
| **Current or stale?** | **Current** — audit rows created **2026-06-27T12:16:48Z** during queue refresh |
| **Mechanism** | `refreshAutomationQueue` lines 594–605: inactive publisher → `recordAutomationAuditEvent` with `status: skipped`, `errorCode: PUBLISHER_DISABLED` |
| **Affected topics** | All 3 |
| **Affected publishers** | `bc5ce007…` (Automation Demo Publisher), `5ab9a6bc…` (تایتان تست disabled duplicate) |
| **Why** | `telegram_publishers.is_active = false` for all topic targets |
| **Queue items** | Failed queue rows from 2026-06-20 also show `last_error_code: PUBLISHER_DISABLED` |

### 6.2 SOURCE_RECORD_NOT_FOUND

| Field | Value |
|-------|-------|
| **Current or stale?** | **Stale historical** — executions from **2026-06-20T15:20:36Z** only |
| **Mechanism** | `markTestRunOrphanQueueItem` (`1155–1181`) during **test-run** when queue `record_id` no longer exists in `collected_data` |
| **Record IDs** | `1727d395…`, `1215b863…` — **`record_exists: false`** in DB today |
| **Queue items** | `be2fc9d8…`, `34ca4ea1…` — failed, orphan records |
| **Why** | Old queue items referenced deleted/collected_data rows; test-run correctly marked orphan |
| **Retry safety** | Retrying these would fail again; UI should disable retry for missing source |

### 6.3 AUTOMATION_ERROR (failed, 5 executions)

Failed queue items from 2026-06-20 with missing `collected_data` records and disabled publishers — historical, not current refresh path.

---

## 7. Telegram Collector Health

| Check | Result |
|-------|--------|
| Messages ingested 1h / 24h | 2,474 / 38,285 — **healthy** |
| Latest message timestamp | ~minutes ago |
| Processed telegram collected_data 24h | 185,710 — **healthy** |
| PM2 `telegram-collector` | online (observed in environment) |
| PM2 `telegram-processor` | online |

**Verdict: Telegram Collector is WORKING.** Automation queue emptiness is **not** caused by collector failure.

Collector status enrichment: `telegramCollectorSourceStatus.js` (used by data-sources list UI).  
Pipeline transfer: `telegramPipeline.js` via `scheduler.js`.

**Separate from Automation Routing** — no evidence that recent Automation/Publisher safety changes broke the collector ingestion path.

---

## 8. Telegram Publisher Health

| Check | Result |
|-------|--------|
| Active publishers | 1 of 4 (`887495e6…` تایتان تست) |
| Bot token configured | yes (`has_bot_token` via API; never logged) |
| Channel ID | `104595348` |
| Last publisher dry_run test (active) | 2026-06-20T12:37:33Z, status `dry_run` |
| Publisher delivery history 7d | 1 dry_run row |
| Topics using active publisher | **0** |
| Mappings to active publisher | **0** |

**Verdict:**

- Telegram Publisher **can dry-run** when called with active publisher + valid mapping + ACL/filter pass.
- Live publish requires `confirm_live` (P2 enforced).
- Automation topics **do not call** the active publisher today → Automation path **blocked by configuration**, not by missing Publisher service.
- Disabled publisher `5ab9a6bc…` still referenced by topic **سیگنال** and both mappings — likely duplicate row after publisher re-create (active sibling `887495e6…`).

### Notifications / test message regression (related, not Automation)

Personal Notifications (Settings) use `runPublisherPublish` / notification service with Telegram Publisher backend. User report that Telegram test messages no longer arrive likely relates to:

- Using **disabled** publisher in notification channel config, or
- Dry-run default (no live send without confirm), or
- Missing mapping / ACL on notification test path

**Requires separate verification in Notifications/Publisher task** — not proven broken in this Automation RCA, but **same publisher misconfiguration** is a plausible shared root cause.

---

## 9. Recent Safety Changes Assessment

| Control | Assessment |
|---------|------------|
| `dry_run` default true | **Working as designed** — `enforceAutomationLiveConfirmation`, dispatch defaults |
| `confirm_live` for live | **Working as designed** — 400 without confirm |
| Publisher mapping before enqueue | **Working as designed** — `hasEnabledPublisherMapping` in refresh (after publisher active check) |
| ACL gateway | **Working as designed** — 1 ACL row; not blocking current path (publisher fails first) |
| Filter rules gateway | **Working as designed** — 0 active rules |
| `source_id` requirement | **Working as designed** in `runPublisherPublish` |
| Disabled publisher guard | **Working as designed** — causes current PUBLISHER_DISABLED skips |
| Manual queue / no worker | **Working as designed** — documented; schedule `enabled=false` |
| Topic create/update active publisher check | **Working as designed** — `assertPublisherTargetsActive` (lines 85–103) blocks **new** disabled targets; **existing** topics grandfathered until edited |
| Pass rate / queue UI metrics | **Unclear / misleading** — stats formula does not reflect skipped audits |
| Error display in UI | **Unclear** — raw codes visible; orphan history not labeled stale |
| Topic validity indicator | **Missing** — no invalid/repair UI despite all topics invalid |

**No safety bypass identified** in read-only audit. System is **safe but effectively non-functional** for routing until publisher/mapping config is repaired.

---

## 10. Code References (Key Paths)

| Concern | File:lines |
|---------|------------|
| Queue refresh skip disabled publisher | `backend/services/datahubAutomationService.js:594–605` |
| Mapping check before enqueue | `backend/services/datahubAutomationService.js:705–725` |
| Dispatch → Publisher | `backend/services/datahubAutomationService.js:829–847` |
| Test-run orphan handling | `backend/services/datahubAutomationService.js:1155–1196` |
| Overview metrics | `backend/services/datahubAutomationService.js:1261–1284` |
| Pass rate computation | `backend/services/datahubAutomationService.js:216–239` |
| Publisher disabled throw | `backend/services/telegramPublisherService.js:~423–427` |
| UI main component | `components/ai/AIManager/tabs/DataHub/advanced/AutomationTopics.tsx` |
| Manual schedule warning | `components/.../AutomationSchedulePanel.tsx:35` |

---

## 11. Dependency Audit Summary

| Dependency | Status | Notes |
|------------|--------|-------|
| Telegram Collector | **PASS** | High message + processed_data volume |
| collected_data / normalization | **PASS** | 185k+ processed/24h |
| Automation API routes | **PASS** | All GET 200, <50ms |
| Automation topics (config) | **FAIL** | All target disabled publishers |
| Publisher mappings | **FAIL** | Point to disabled publisher; active publisher unmapped |
| Queue refresh | **PASS** (behavior) | Correctly skips + audits |
| Queue dispatch | **BLOCKED** | No pending items to dispatch |
| Telegram Publisher service | **PASS** (capability) | Active publisher exists; dry-run history present |
| Scheduler worker | **N/A by design** | Manual only |
| ACL / filters | **PASS** | Not current blocker |
| UI clarity | **FAIL** | Confusing metrics, no validity/repair UX |

---

## Phase 2 — Safe End-to-End Dry-Run Test Plan (Design Only)

**Goal:** Prove chain without live Telegram send. Execute in Phase 7 after functional fixes.

### Fixture (all rows prefixed / named for cleanup)

| Artifact | Specification |
|----------|---------------|
| Temporary source | `data_sources` row: `P3-E2E-AUTOMATION-SOURCE`, type `api`, active |
| Processed record | `collected_data` status `processed`, linked to temp source, metadata matches topic filters |
| Active publisher | Use existing `887495e6…` (تایتان تست active) — **do not create new bot** |
| Mapping | `datahub_publisher_source_mappings`: temp source → active publisher, `is_enabled=true` |
| Automation topic | Temp topic `P3-E2E-AUTOMATION-TOPIC`, enabled, targets active publisher only |
| ACL | Ensure source allows topic agent + publisher agent (or no ACL block) |

### Steps

1. **Validate** existing topics → expect 3 invalid (disabled publisher).
2. **Create** temporary mapping + topic + processed record (transaction or tagged IDs).
3. **POST** `/queue/refresh` → expect `added >= 1`, summary includes queued count.
4. **POST** `/queue/dispatch` `{ limit: 1, dry_run: true, confirm_live: false }`.
5. **Assert** execution row: `status = dry_run` (or success-like blocked path with clear reason).
6. **Assert** `publisher_delivery_history`: `status = dry_run`, no `telegram_message_id`.
7. **Assert** no live Telegram API call (check history + logs).
8. **GET** `/executions` → human-readable success.
9. **Cleanup** DELETE temp topic, queue rows, executions, mapping, source, collected_data.

### If blocked

Document exact gate: PUBLISHER_DISABLED | MAPPING_REQUIRED | SOURCE_ACCESS_DENIED | FILTER_RULE_BLOCKED | NO_CANDIDATES.

### Cannot proceed today without

- Repointing topic to active publisher **or** creating temp topic.
- Creating mapping to active publisher `887495e6…`.
- Manual queue refresh + dispatch (no worker).

---

## Phase 1 Exit Criteria

| Criterion | Status |
|-----------|--------|
| Plain-language explanation | Done |
| Full flow traced with file/table refs | Done |
| DB counts with actual table/column names | Done |
| Per-topic enqueue/dispatch analysis | Done |
| Error code root causes (current vs stale) | Done |
| Collector health | Done — **working** |
| Publisher health | Done — **capable but misconfigured for Automation** |
| Safety change assessment | Done |
| Verdict without claiming REAL WORKING | Done — **PARTIAL** |
| E2E test plan documented | Done (Phase 2 section) |

---

## Recommended Fix Order (Phase 3+ — Not Implemented Yet)

1. **Configuration repair:** Point topics (or new temp topic) to active publisher `887495e6…`; migrate mappings from disabled `5ab9a6bc…`.
2. **Topic validity API/UI:** Expose `invalidReason` (disabled publisher, missing mapping) per topic.
3. **Queue refresh summary:** Return `{ candidates, queued, skipped, blocked, reasons[] }`.
4. **History UX:** Label stale `SOURCE_RECORD_NOT_FOUND`; disable retry when record missing.
5. **Metrics fix:** Include skipped/blocked audits in health banner; contextual empty queue state.
6. **Redesign** per `DESIGN_SYSTEM_DATAHUB.md` (Phase 4).
7. **Runtime dry-run proof** + browser verification (Phases 7–8).
8. **Final doc:** `DH-AUTOMATION-ROUTING-P3-END-TO-END-FIX-AND-REDESIGN.md`.

---

## Related Documents

- `docs/ssot_v3/DH-AUTOMATION-ROUTING-P1-FULL-RCA.md` — pre-P2 audit (BROKEN/UNSAFE)
- `docs/ssot_v3/DH-AUTOMATION-ROUTING-P2-SAFETY-FIX.md` — safety implementation (claimed REAL WORKING for safety semantics)
- `docs/ssot_v3/advanced/AUTOMATION_API_CONTRACT.md` — API contract, manual dispatch
- `backend/scripts/verify_automation_demo.js` — demo verification script
