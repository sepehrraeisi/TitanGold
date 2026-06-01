# DataHub High-Risk Writes Execution Plan (DH-FINAL-6)

> **Status:** Plan / docs only — **no execution**  
> **Date:** 2026-05-30  
> **Prerequisites:** [`DATAHUB_RUNTIME_ACTION_INVENTORY.md`](./DATAHUB_RUNTIME_ACTION_INVENTORY.md) (DH-FINAL-1), low-risk pass (DH-FINAL-4), D-01 dry-run pass, D-02/D-03 **NO-GO** (DH-FINAL-5G, GAP-036)  
> **Next phase:** DH-FINAL-6R — per-action execution only with explicit approval + rollback owner

---

## Goal

Define a **test strategy, approval gate, rollback, and go/no-go** for every high-risk DataHub write so future runtime QA runs **one action at a time** with evidence — never as an uncontrolled batch.

---

## Global rules (all high-risk actions)

| Rule | Detail |
|------|--------|
| **Execution model** | One action per approval ticket; preview/dry-run first when available |
| **Role** | `admin` or `trader` unless noted (Core sources hard delete: `authenticate` only — GAP-009) |
| **Evidence** | Timestamp UTC, request body, HTTP status, response JSON, before/after row counts or IDs, screenshot/HAR on fail |
| **Stop entire batch** | Any unexpected 500 on first attempt; live Telegram send when not approved; wrong row count vs preview; missing confirm flag |
| **Production default** | **NO-GO** for outbound Telegram (P0 publish/dispatch, P2 test) until **GAP-036** closed |
| **Backup** | Required for archiving execute/restore; recommended before prioritization apply on production |

---

## High-risk matrix

| Priority | Action | Endpoint | Side effects | Preconditions | Required approvals | Safe test strategy | Rollback / cleanup | Go/No-Go now |
|----------|--------|----------|--------------|---------------|-------------------|--------------------|--------------------|--------------|
| **P0** | Prioritization **Apply** | `POST /api/v1/data-hub/prioritization/apply` `{ confirm_apply: true }` | Updates `data_sources.priority`, `priority_score`, `priority_updated_at` for scoped sources; inserts `datahub_prioritization_runs` (`run_type=apply`) | Prioritization enabled; **Preview POST 200** immediately before apply; operator confirms source count in UI modal; admin/trader JWT | Product owner + ops lead; written confirm with expected N sources | **Staging first.** Production: export `SELECT id, priority, priority_score FROM data_sources WHERE …` before apply; apply on **subset** if API supports or full set after preview match; verify run row + spot-check 3 sources | Manual SQL restore from pre-apply export; or re-apply previous snapshot if saved; clear overrides only if intentional | **Conditional GO** on staging after preview; **production GO** only with backup + preview count match |
| **P0** | Publisher **Publish (live)** | `POST /api/v1/data-hub/telegram-publishers/:id/publish` `{ message, confirm_publish: true, content_type }` | Live Telegram message; `publisher_delivery_history` (`status=sent`); `telegram_publishers.sent_count++`, `last_sent_at` | Active publisher; bot token present; **GAP-036 gate** if testing dry-run path | **Blocked** until GAP-036; then exec approval + channel owner | **NO-GO on current production.** Staging: token-less channel or `TELEGRAM_PUBLISHER_DRY_RUN=true`; single short test message; verify `dry_run` vs `sent` in response | Delete message in Telegram manually if mistaken live send; history row remains (audit) | **NO-GO** (GAP-036) |
| **P0** | Automation **Dispatch queue** | `POST /api/v1/data-hub/automation/queue/dispatch` `{ limit, dry_run }` | Processes pending queue items; updates `datahub_automation_queue.status`; inserts `datahub_automation_executions`; may invoke **live publish** when `dry_run: false` | Non-empty queue; topic + publisher targets configured; **dry_run verified in payload** | **Blocked** for live dispatch until GAP-036; dry-run dispatch needs separate approval | **NO-GO live.** If ever approved: `dry_run: true` only first; limit=1; verify no `telegram_message_id` | Re-queue failed items manually; execution rows are audit-only | **NO-GO** live; dry-run dispatch **NO-GO** until GAP-036 (publisher chain) |
| **P0** | Automation **Dispatch item** | `POST /api/v1/data-hub/automation/queue/:id/dispatch` `{ dry_run }` | Same as queue dispatch for one item | Pending queue item id; same publisher gate | Same as dispatch queue | Single item; **dry_run: true** first; never click Dispatch live in UI without toggle | Mark item failed via PATCH if stuck; manual re-queue | **NO-GO** (GAP-036) |
| **P0** | Archiving **Archive execute** | `POST /api/v1/data-hub/archiving/archive` `{ days_old, confirm_archive: true }` | Moves rows `ai_decisions` → `ai_decisions_archive` via SQL function; `datahub_archiving_operations` audit row | **Archive preview** POST with same `days_old`; small `pending_count`; **DB backup/snapshot** taken | Ops + DBA sign-off; backup ticket id recorded | **Staging or production small window only.** Preview count e.g. 4 (DH-FINAL-4); execute same `days_old`; verify active count drops, archive count rises, operation `success` | **Restore execute** (separate approved action) for same date window; restore preview first | **Conditional GO** — preview verified; **requires backup** before execute |
| **P0** | Archiving **Restore execute** | `POST /api/v1/data-hub/archiving/restore` `{ start_date, end_date, confirm_restore: true }` | Moves rows archive → active via `restore_from_archive` | Restore preview 200 for exact range; backup before restore | Ops approval; confirm row count matches preview | Only after archive execute test or on known archive partition; narrow ISO date range | Re-archive same window if mistaken | **Conditional GO** — only with backup + preview; never first action in batch |
| **P0** | Discovery **Approve** | `POST /api/v1/data-hub/discovery/suggestions/:id/approve` | Creates new `data_sources` row; suggestion → approved; may trigger filter/SSRF guards | **Dummy/test suggestion only** — inject or pick isolated pending suggestion; not production-critical URL | Admin approval; suggestion URL reviewed | Staging: create pending suggestion fixture; approve one; verify single new source id; **409/403** = stop | Soft-delete source if test row; reject flow not needed if orphan | **Conditional GO** — **test/dummy suggestion only** |
| **P1** | Crawler **Run (live)** | `POST /api/v1/data-hub/crawlers/:id/run` `{ dry_run: false }` | **INSERT `collected_data`**; crawler run row `dry_run=false`; source `last_fetch_at`; external fetch | D-01 dry-run pass on same crawler; count baseline; RSS preferred over website | Ops approval; single crawler | Staging first; one RSS crawler; `{ dry_run: false }` explicit; before/after `collected_data` count **must increase**; cap `max_pages_per_run` low if configurable | Delete test `collected_data` rows by source_id + collected_at window; run row retained | **Conditional GO** on staging; production **defer** until ingest impact accepted |
| **P1** | Sources **Hard delete** | `DELETE /api/v1/data-sources/:id?hard=true` | Permanent row delete; access log entry; **409** if FK references | **Dedicated test source** with no crawlers, collected_data, ACL, or automation refs | Admin approval; source id whitelisted | Create disposable source in staging → hard delete; expect 204 or 409 documented | **Irreversible** if 204 — only use throwaway id | **Conditional GO** — **test source only, no FK** |
| **P1** | Telegram **Force sync** | `POST /api/telegram-collector/channels/:id/force-sync` (collector service, cookie session) | Fetches messages from Telegram; collector DB writes; may pipeline to backend | Collector online; test channel only; not production broadcast channel | Collector owner approval | Staging collector + test channel; single channel; monitor message count delta | Disable channel active flag; purge test messages in collector if tool exists | **NO-GO** on production primary channels — staging/test channel only |
| **P1** | Telegram **Register channels** | `POST /api/telegram-collector/channels/register` | Registers collector channels; may create/link sources | Collector session; dialog list loaded | Collector owner approval | Register **one** test dialog in staging; verify in collector-channels GET only | Unregister/disable via collector PATCH; avoid link-to-source POST in same test | **NO-GO** on production — staging collector only |
| **P1** | Safety filter **Create (ingestion)** | `POST /api/v1/data-hub/filter-rules` `{ apply_target: 'ingestion', … }` | New rule affects **live ingestion** immediately (crawler ingest, collected-data path) | Staging or rule scoped to test `source_id`; benign pattern (e.g. block `zzz-dh-final-6-probe`) | Admin approval | Create rule blocking impossible URL; run crawler dry-run on test item; verify block; delete rule after | `DELETE /filter-rules/:id` soft-delete | **Conditional GO** — staging first; production only with narrow test pattern + immediate delete |
| **P2** | Prioritization **Override** | `PUT /api/v1/data-hub/prioritization/sources/:sourceId/override` `{ override_score, override_note }` | Sets override fields on one source; audit `overridden_by/at` | Test source id; preview shows override | Admin approval | Override one test source score; verify in GET `/sources`; reset with `override_score: null` | PUT override null to clear | **Conditional GO** — single test source |
| **P2** | Publisher **Test** (live possible) | `POST /api/v1/data-hub/telegram-publishers/:id/test` | Telegram API or dry_run history row | **GAP-036** | Blocked until gate fixed | Same as D-02 plan | History audit row only | **NO-GO** (GAP-036) |
| **P2** | Automation **Test run** (live possible) | `POST /api/v1/data-hub/automation/test-run` `{ dry_run: true }` | Queue refresh + dispatch one item; execution row; may live publish | **GAP-036**; D-02 pass required | Blocked until gate fixed | Same as D-03 plan | Queue/execution audit | **NO-GO** (GAP-036) |

---

## Per-action detail (environment, fixtures, backup, stop, evidence)

### P0 — Prioritization Apply

| Dimension | Detail |
|-----------|--------|
| **Staging vs production** | Staging **first**; production only with SQL export backup |
| **Test fixture** | Optional: 2–3 test sources with known priority; or full 48-source apply after preview |
| **Backup / snapshot** | `COPY (SELECT id, priority, priority_score, priority_updated_at FROM data_sources) TO …` or pg_dump table slice |
| **Rows that may change** | `data_sources` (priority fields); `datahub_prioritization_runs` |
| **Rollback SQL** | `UPDATE data_sources SET priority=…, priority_score=… FROM backup_table WHERE …` |
| **Immediate stop** | Preview count ≠ apply modal count; 400/500; unexpected tier distribution |
| **Evidence** | Preview response source_count; apply response; 3 source ids before/after |

### P0 — Publisher Publish / Automation Dispatch (Telegram outbound)

| Dimension | Detail |
|-----------|--------|
| **Staging vs production** | **NO-GO production** until GAP-036 |
| **Test fixture** | Disabled publisher or `TELEGRAM_PUBLISHER_DRY_RUN=true` |
| **Backup** | N/A (outbound); screenshot channel before test |
| **Rows that may change** | `publisher_delivery_history`, `telegram_publishers.sent_count`, `datahub_automation_queue`, `datahub_automation_executions` |
| **Rollback** | Manual Telegram delete; cannot unsend |
| **Immediate stop** | `telegram_message_id` non-null when dry-run expected; `dry_run: false` in response |
| **Evidence** | Full response JSON; channel screenshot |

### P0 — Archiving Archive / Restore Execute

| Dimension | Detail |
|-----------|--------|
| **Staging vs production** | Production allowed **only** with **full DB backup** + small preview window (DH-FINAL-4: 4 rows) |
| **Test fixture** | Use preview `days_old: 90` matching execute |
| **Backup** | **Required** — pg_dump or snapshot before archive; restore backup path documented |
| **Rows that may change** | `ai_decisions`, `ai_decisions_archive`, `datahub_archiving_operations` |
| **Rollback SQL** | `POST /restore` with same date range (approved separately) or restore from pg_dump |
| **Immediate stop** | Execute count ≫ preview `pending_count`; 500 from SQL function |
| **Evidence** | Preview + execute payloads; `check_archive_health()` before/after |

### P0 — Discovery Approve

| Dimension | Detail |
|-----------|--------|
| **Staging vs production** | **Staging preferred**; production only with **dummy suggestion** (test URL, disposable) |
| **Test fixture** | Pending suggestion row created for probe (not real feed) |
| **Backup** | Optional export of `data_sources` count |
| **Rows that may change** | `datahub_discovery_suggestions`, new `data_sources` row |
| **Rollback** | Soft-delete test source; mark suggestion rejected if API allows |
| **Immediate stop** | 403 FILTER_BLOCKED; 409 duplicate; approve non-pending id |
| **Evidence** | Suggestion id; new source id; URL field |

### P1 — Crawler Live Run

| Dimension | Detail |
|-----------|--------|
| **Staging vs production** | Staging first; production single RSS crawler with ingest review |
| **Test fixture** | Same crawler as D-01 (`b1f6ab9b-…`) |
| **Backup** | Count baseline only |
| **Rows that may change** | `collected_data`, `datahub_crawler_runs`, `data_sources.last_fetch_at` |
| **Rollback SQL** | `DELETE FROM collected_data WHERE source_id=$1 AND collected_at > $test_start` |
| **Immediate stop** | Payload `dry_run: true` by mistake; count unchanged when ingest expected; 403 pre-crawl |
| **Evidence** | Before/after count; run id; sample row id |

### P1 — Sources Hard Delete

| Dimension | Detail |
|-----------|--------|
| **Staging vs production** | **Staging only** for first execution |
| **Test fixture** | Source created via POST with unique name `dh-final-6-delete-me` |
| **Backup** | Export row before delete |
| **Rows that may change** | `data_sources` (removed); `data_hub_logs` |
| **Rollback** | **None** if 204 — must use throwaway source |
| **Immediate stop** | 409 FK conflict (expected safety); wrong source id |
| **Evidence** | Source id; 204 vs 409 status |

### P1 — Telegram Force Sync / Register

| Dimension | Detail |
|-----------|--------|
| **Staging vs production** | **Collector staging / test channel only** |
| **Test fixture** | Dedicated low-traffic test channel id |
| **Backup** | Collector DB snapshot if available |
| **Rows that may change** | Collector messages table; optional pipeline transfer |
| **Rollback** | Disable channel; manual cleanup |
| **Immediate stop** | Production primary channel selected; FLOOD_WAIT; collector offline |
| **Evidence** | Channel id; message count; latency |

### P1 — Safety Filter Create (ingestion)

| Dimension | Detail |
|-----------|--------|
| **Staging vs production** | Staging first |
| **Test fixture** | Rule blocking `dh-final-6-probe.invalid` URL pattern |
| **Backup** | Export existing rules count |
| **Rows that may change** | `datahub_filter_rules` |
| **Rollback** | DELETE rule by id |
| **Immediate stop** | Broad regex affecting all sources; 409 duplicate |
| **Evidence** | Rule id; evaluate POST proof |

---

## Required approvals (summary)

| Tier | Approver | When |
|------|----------|------|
| **A** | Executing engineer | All actions — records evidence |
| **B** | Product / DataHub owner | P0 writes affecting all sources or outbound Telegram |
| **C** | Ops / DBA | Archiving execute/restore; production prioritization apply |
| **D** | Collector owner | Telegram force sync / register |
| **Block** | GAP-036 closure | Publisher live publish, automation live dispatch, P2 test paths |

---

## Rollback table (quick reference)

| Action | Reversible? | Rollback method |
|--------|-------------|-----------------|
| Prioritization apply | Partial | SQL restore from pre-apply export |
| Publisher publish | No | Manual Telegram delete |
| Automation dispatch | Partial | Queue item status manual fix; executions audit-only |
| Archive execute | Partial | Restore execute (approved) or pg_dump restore |
| Restore execute | Partial | Re-archive window or pg_dump |
| Discovery approve | Partial | Soft-delete test source |
| Crawler live run | Partial | Delete ingested rows in time window |
| Hard delete | **No** | Prevention only — throwaway source |
| Force sync / register | Partial | Disable channel / collector cleanup |
| Filter create | Yes | DELETE rule |
| Prioritization override | Yes | PUT `override_score: null` |

---

## Staging vs production recommendation

| Category | Staging | Production |
|----------|---------|------------|
| Prioritization apply | **First** | After staging pass + backup |
| Publisher / automation outbound | **Only** with GAP-036 fix | **NO-GO** until GAP-036 |
| Archiving execute/restore | Preferred first | Small window + **mandatory backup** |
| Discovery approve | **Required** dummy suggestion | Disposable suggestion only |
| Crawler live | **First** | Single crawler, monitored |
| Hard delete | **Only** | NO-GO until staging 204 proven |
| Telegram collector | **Test channel** | NO-GO on primary channels |
| Filter create | **First** | Narrow rule + immediate delete |

---

## Current go/no-go summary (2026-05-30)

| Priority | Action | Go/No-Go | Reason |
|----------|--------|----------|--------|
| P0 | Prioritization apply | **Conditional** | Preview verified (`ca6226e`); needs backup + subset/full confirm |
| P0 | Publisher publish live | **NO-GO** | GAP-036 |
| P0 | Automation dispatch (live) | **NO-GO** | GAP-036 |
| P0 | Archiving archive execute | **Conditional** | Preview OK (4 rows); **backup required** |
| P0 | Archiving restore execute | **Conditional** | After archive test only; backup required |
| P0 | Discovery approve | **Conditional** | Dummy suggestion only |
| P1 | Crawler live run | **Conditional** | D-01 pass; staging first |
| P1 | Hard delete | **Conditional** | Throwaway source only |
| P1 | Force sync / register | **NO-GO** prod | Test channel / staging collector |
| P1 | Filter create (ingestion) | **Conditional** | Staging + delete after |
| P2 | Prioritization override | **Conditional** | Single test source |
| P2 | Publisher test | **NO-GO** | GAP-036 |
| P2 | Automation test run | **NO-GO** | GAP-036 |

**Verified safe (already executed):** D-01 crawler dry-run — Pass.

**Blocked until GAP-036:** All Telegram outbound test paths (P0 publish, P0 dispatch live, P2 test/test-run).

---

## Next safest execution candidate

Recommended **first** high-risk execution after explicit approval (**DH-FINAL-6R-1**):

1. **Prioritization Override (P2)** on a **single test source** — smallest blast radius; fully reversible via `override_score: null`.

Then, in order:

2. **Discovery approve (P0)** — dummy/staging suggestion only.  
3. **Archiving archive execute (P0)** — after pg_dump; `days_old: 90`; preview count matched (4 rows).  
4. **Crawler live run (P1)** — staging RSS crawler; `{ dry_run: false }`; count gate.  
5. **Prioritization apply (P0)** — after preview + backup.

**Do not schedule** until GAP-036 closed: Publisher publish, Automation dispatch (live), Publisher test, Automation test-run.

---

## Related docs

| Doc | Purpose |
|-----|---------|
| [`DATAHUB_RUNTIME_ACTION_INVENTORY.md`](./DATAHUB_RUNTIME_ACTION_INVENTORY.md) | Full action matrix |
| [`DATAHUB_DRY_RUN_TEST_PLAN.md`](./DATAHUB_DRY_RUN_TEST_PLAN.md) | D-01–D-03 dry-run gates |
| [`DATAHUB_DRY_RUN_RUNTIME_RESULTS.md`](./DATAHUB_DRY_RUN_RUNTIME_RESULTS.md) | D-01 pass; D-02/D-03 NO-GO |
| [`GAPS_AND_PLAN.md`](./GAPS_AND_PLAN.md) | GAP-036 publisher dry-run gate |

---

## Changelog

| Date | Change |
|------|--------|
| 2026-05-30 | DH-FINAL-6 initial high-risk execution plan — docs only |
