# DataHub D-03 Valid Queue Fixture Plan

> **Phase:** DH-P0-SECURITY-15 (plan only — **no execution**)  
> **Date:** 2026-06-01  
> **Branch:** `feat/gap-008-sources-backend-wiring`  
> **Goal:** Enable one **full-chain** D-03 pass for topic `bc6c5f1b-4df1-4e11-a324-3f94efc55e0e` (سیگنال) → publisher `5ab9a6bc-5f17-4aae-bb06-4a34e827af24` under forced dry-run  
> **Related:** [`DATAHUB_DRY_RUN_RUNTIME_RESULTS.md`](./DATAHUB_DRY_RUN_RUNTIME_RESULTS.md) § SECURITY-14, [`DATAHUB_AUTOMATION_TEST_RUN_RCA.md`](./DATAHUB_AUTOMATION_TEST_RUN_RCA.md)

---

## 1. Executive summary

SECURITY-14 proved the test-run fix is **safe** (HTTP 200, no Telegram send) but returned **`no_valid_queue_item`** because **no record in the automation refresh window matched topic سیگنال**.

Root cause is **not** missing `collected_data` in general — signals/telegram rows exist — but **`refreshAutomationQueue()` only considers the latest 6 normalized pipeline records**, and those six are currently **uncategorized RSS `pending` rows** that fail the topic’s **category** filter.

**Recommended fixture path:** **Option B** — create a tagged test row via **`POST /api/v1/collected-data`** on an existing **signals + telegram** source, then **`PUT`** `status=processed` and `processed_at=NOW()` so the row enters the pipeline top-6 window. Re-run D-03 once (separate approval). **Do not** use manual SQL (Option D) unless API path is blocked.

**GAP-036** remains **Open (partial)** until a full-chain D-03 pass shows `publishResult.dry_run: true` and `telegram_message_id: null`.

---

## 2. Why SECURITY-14 was a no-op safe pass

| Observation | Detail |
|-------------|--------|
| HTTP | **200** (not 500) |
| Response | `dryRun: true`, `status: no_valid_queue_item`, `processed: 0` |
| Topic queue | **0** pending rows for `bc6c5f1b-…` before/after |
| Publisher | **Not invoked** — no `publishResult`, no history delta |
| Safety | ✅ No live Telegram; fix `be32243` behaved correctly |

The test-run reached topic-scoped refresh + candidate scan but found **zero** queueable items for the selected topic.

---

## 3. Queue generation requirements (code)

| Check | Result |
|-------|--------|
| Entry | `runAutomationTest()` → `refreshAutomationQueue({ topicId })` when `topic_id` set (`datahubAutomationService.js`) |
| Pipeline source | `buildDataPipelineView()` → `normalizedData` = **at most 6 rows** (`dataPipelineSnapshot.js` L126–137) |
| Pipeline ordering | `ORDER BY processed_at DESC NULLS LAST, collected_at DESC` — rows **with** `processed_at` rank **above** rows with NULL |
| Topic filter (refresh) | Enabled topic + `publisherTargets.length > 0`; scoped to `topicId` when provided |
| Record match | `recordMatchesTopic()` — status, category name, dataType, optional minQualityScore |
| Status mapping | `collected_data.status`: `processed`→`ready`, `pending`/no norm→`warning`, `error`→`rejected` (`mapToNormalizedRecord`) |
| Category match | Topic `categoryIds` → category **names** (lowercase) must equal `record.category` |
| DataType match | `metadata.data_type` **or** `source_type` must be in topic `dataTypes` |
| Dedupe (7d) | Skip if `datahub_automation_executions` has `status IN ('sent','dry_run')` for same `record_id:publisher_id` |
| Pending dup | Skip if same `record_id:publisher_id` already `pending`/`processing` in queue |
| Caps | `MAX_QUEUE=25` global adds per refresh; `MAX_PER_PAIR=3` pending per topic+publisher |
| Payload load | `loadRecordPayload()` reads `collected_data.normalized_data` (title/content for message) |
| Publisher gate | Unchanged — `TELEGRAM_PUBLISHER_DRY_RUN=true` forces dry-run in `runPublisherPublish()` |

### Critical bottleneck

**Refresh does not scan all `collected_data`.** Only **`pipeline.normalizedData` (LIMIT 6)** is eligible. A matching signals record that is row #7+ in pipeline order **will never be queued** until it enters that window (typically by setting **`processed_at`** to a recent timestamp).

---

## 4. Current topic configuration (read-only)

**Topic:** `bc6c5f1b-4df1-4e11-a324-3f94efc55e0e` — **سیگنال**

| Field | Value |
|-------|-------|
| `is_active` | `true` |
| `priority` | `2` (medium) |
| `publish_targets.publisherIds` | `["5ab9a6bc-5f17-4aae-bb06-4a34e827af24"]` |
| `trigger_conditions.agentId` | `e0516b87-45a4-4a56-b63e-c7623459660b` |
| `trigger_conditions.categoryIds` | `abdb8012-…` (announcements), `a7746fe9-…` (news), `d9e1d5cf-…` (**signals**) |
| `trigger_conditions.dataTypes` | `["telegram", "rss"]` |
| `trigger_conditions.includeStatuses` | `["ready", "warning", "rejected"]` |
| `trigger_conditions.minQualityScore` | *(unset)* |

**Publisher (D-02 verified):** `5ab9a6bc-5f17-4aae-bb06-4a34e827af24` — تایتان تست

---

## 5. Existing candidate search results (read-only)

### 5.1 Pipeline window (what refresh actually sees)

Current **top 6** normalized records (2026-06-01):

| id (prefix) | status | category | effective dataType | processed_at |
|-------------|--------|----------|-------------------|--------------|
| 6058338e… | pending | **uncategorized** | rss | NULL |
| 9414166a… | pending | **uncategorized** | rss | NULL |
| c5bc58e0… | pending | **uncategorized** | rss | NULL |
| d6915b15… | pending | **uncategorized** | rss | NULL |
| 74b99e4e… | pending | **uncategorized** | rss | NULL |
| e89c491f… | pending | **uncategorized** | rss | NULL |

**None match** topic categories (`signals`, `news`, `announcements`). Topic `dataTypes` include `rss`, but **category filter fails first**.

### 5.2 Signals inventory (exists but not in window)

| Metric | Value |
|--------|-------|
| `collected_data` total | Large corpus (100s+) |
| Recent **signals** rows | Many with `normalized_data` present, `source_type=telegram`, category **signals** |
| `status` on signals rows | Predominantly **`pending`** |
| `processed_at` on signals rows | **`0`** rows with non-null `processed_at` (as of investigation) |
| Pending queue for topic | **0** |
| Executions for publisher `5ab9a6bc-…` | **0** (no 7-day dedupe block) |

**Example existing candidates** (would match triggers **if** in pipeline top-6):

| record_id | source | category | type | has normalized title |
|-----------|--------|----------|------|----------------------|
| `fd102e31-f5d1-44dc-98d0-772d0940007b` | آبشده telegram source | signals | telegram | yes |
| `4e96483a-5757-416a-8bd1-4239705ce516` | ontime crypto telegram | signals | telegram | yes |

### 5.3 Why refresh did not queue them

1. **Not in pipeline LIMIT 6** — uncategorized RSS rows dominate ordering; signals rows have `processed_at IS NULL` (sorted last among contenders).
2. Even `warning` status would pass `includeStatuses`, but **category ≠ signals/news/announcements** for the current top-6.
3. Topic-scoped refresh (SECURITY-13) runs correctly but has **nothing eligible** in the candidate pool.

---

## 6. Fixture option comparison

| Option | Description | Pros | Cons | Full-chain evidence? |
|--------|-------------|------|------|----------------------|
| **A — Existing record only** | Pick signals row; run D-03 | No new row | **Fails today** — not in pipeline top-6 without mutation | ❌ unless paired with PUT |
| **A+ — PUT bump existing signals row** | `PUT /collected-data/:id` → `status=processed`, `processed_at=now`, `metadata.data_type=telegram` | Real source path; no new row; enters top-6 | Mutates live ingest row; harder cleanup | ✅ Strong |
| **B — POST tagged test row** | `POST /collected-data` on signals telegram source + PUT processed | Clear tag `DH-P0-SECURITY-15`; easy DELETE cleanup | Filter rules may block; creates row | ✅ Strong |
| **C — Temp test topic** | New automation topic | Isolated | Not same production topic/publisher chain | ⚠️ Weaker for GAP-036 |
| **D — Manual SQL** | INSERT into `collected_data` / queue | Fast | Bypasses API filters/audit; ops risk | ✅ if correct, but **not preferred** |

**Weaker (do not use for GAP-036 closure):** synthetic payload bypassing queue/record load (not implemented; would not satisfy closure criteria).

---

## 7. Recommended option

### Primary: **Option B — POST + PUT tagged fixture**

Use existing **signals / telegram** `data_sources` row (example: `774acc11-9643-4a5c-bca9-36a9aca4c775` — category `signals`, type `telegram`).

**Why:**

- Enters pipeline top-6 when `processed_at` is set (processed rows sort first).
- Matches all topic triggers: category **signals**, dataType **telegram**, status **ready**.
- Tagged content and metadata for audit/cleanup.
- Exercises real path: `collected_data` → refresh → queue → `loadRecordPayload` → `runPublisherPublish` (forced dry-run).
- No manual SQL.

### Fallback: **Option A+ — PUT bump one existing signals record**

Use e.g. `fd102e31-f5d1-44dc-98d0-772d0940007b` if POST is blocked by `enforceIngestionFilter`.

Add metadata tag only; revert `status`/`processed_at` after test if policy requires minimal footprint.

### Not recommended

- **Option C** — wrong topic chain for GAP-036.
- **Option D** — only with explicit separate ops approval if API blocked.

---

## 8. Exact future execution steps (separate approval — NOT this phase)

### 8.1 Pre-flight gates

| Step | Action | Stop if |
|------|--------|---------|
| G1 | `GET /health` → 200 | not 200 |
| G2 | PM2 `TELEGRAM_PUBLISHER_DRY_RUN=true` | not true |
| G3 | Confirm fix `be32243` loaded | N/A |
| G4 | Capture counts: `datahub_automation_executions`, `publisher_delivery_history`, topic queue | — |

### 8.2 Create fixture (Option B)

| Step | Action |
|------|--------|
| F1 | `POST /api/v1/collected-data` (admin JWT) |
| F2 | Body (adapt UUID/timestamps): |

```json
{
  "source_id": "774acc11-9643-4a5c-bca9-36a9aca4c775",
  "status": "pending",
  "raw_data": { "text": "DH-P0-SECURITY-15 fixture probe" },
  "normalized_data": {
    "title": "DH-P0-SECURITY-15 automation dry-run fixture",
    "content": "Harmless test content for GAP-036 full-chain D-03. Not for live publish."
  },
  "metadata": {
    "data_type": "telegram",
    "quality_score": 90,
    "tags": ["DH-P0-SECURITY-15", "gap-036-fixture"]
  },
  "content_hash": "dh-p0-security-15-fixture-<unique-suffix>"
}
```

| F3 | If 403 `FILTER_BLOCKED` → switch to **Option A+** on existing signals row |
| F4 | `PUT /api/v1/collected-data/{id}` → `{ "status": "processed", "processed_at": "<ISO8601 now>" }` |
| F5 | Read-only verify: record appears in pipeline top-6 query (§5.1 pattern) and matches category/type |

**Do not** call `/automation/queue/dispatch` or publisher `/test`/`/publish`.

### 8.3 D-03 (once)

```http
POST /api/v1/data-hub/automation/test-run
{
  "dry_run": true,
  "topic_id": "bc6c5f1b-4df1-4e11-a324-3f94efc55e0e"
}
```

**Pass (full chain):**

- HTTP **200**
- `processed: 1`
- `publishResult.dry_run: true` (or equivalent)
- `telegram_message_id: null`
- Optional: execution `status=dry_run`, `dry_run=true`; publisher history `status=dry_run`
- Logs: no Bot API `sendMessage`

### 8.4 Post-verify read-only

- Count deltas (+1 execution, +1 publisher history acceptable if dry_run)
- Last execution + history rows
- Log scan

---

## 9. Cleanup plan

| Artifact | Cleanup action |
|----------|----------------|
| Fixture row (Option B) | `DELETE /api/v1/collected-data/{fixture_id}` after verification |
| Bumped row (Option A+) | `PUT` restore prior `status`/`processed_at` if changed; remove test tags from metadata |
| Queue row (if `sent` after dry-run test) | Leave for audit **or** document as test artifact; do not re-dispatch live |
| `datahub_automation_executions` dry_run row | **Keep** — audit evidence for GAP-036 |
| `publisher_delivery_history` dry_run row | **Keep** — audit evidence |
| Orphan global Demo Topic pending rows | **Out of scope** — do not mass-delete in fixture phase |

**Rule:** Cleanup runs **after** full-chain pass is documented; never delete audit rows before SSOT docs updated.

---

## 10. Stop conditions

Stop immediately if:

| Condition | Action |
|-----------|--------|
| `TELEGRAM_PUBLISHER_DRY_RUN` ≠ `true` | Do not run D-03 |
| Health ≠ 200 | Do not run D-03 |
| Response `telegram_message_id` non-null | Stop; incident review |
| Logs show Bot API live send | Stop |
| `dryRun: false` on test-run | Stop |
| Accidental call to `/publish`, `/queue/dispatch`, live dispatch | Stop |
| POST fixture returns unexpected 500 | Stop; diagnose filter/schema |

---

## 11. GAP-036 status

| Criterion | Status |
|-----------|--------|
| Env gate | ✅ Applied |
| D-02 | ✅ Pass |
| Test-run safety fix (`be32243`) | ✅ Verified SECURITY-14 |
| Full-chain D-03 | ❌ **Not proven** — fixture required |
| **GAP-036** | **Open (partial)** |

Close GAP-036 only after **full-chain** D-03 pass per [`GAP_036_DRY_RUN_GATE_PLAN.md`](./GAP_036_DRY_RUN_GATE_PLAN.md).

---

## Changelog

| Date | Change |
|------|--------|
| 2026-06-01 | DH-P0-SECURITY-15 — fixture plan (read-only investigation; no execution) |
