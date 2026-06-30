# DH-DATA-PIPELINE — Telegram Count Reconciliation

**Task:** `DH-DATA-PIPELINE-PX-TELEGRAM-COUNT-RECONCILIATION`  
**Date:** 2026-06-30  
**Mode:** Read-only (no DB mutations)  
**Evidence:** `docs/ssot_v3/screenshots/telegram-pipeline-count-reconciliation-evidence.json`

---

## 1. Human QA question

Telegram Collector ingests ~**60k messages / 24h**, but Data Pipeline shows **Requests (24h) ≈ 3,800**.

Is this expected filtering or a pipeline drop/bug?

---

## 2. Executive verdict

**EXPECTED — not a pipeline drop bug.**

`Requests (24h)` counts **DataHub source fetch log events** (`data_hub_logs`), **not** raw Telegram messages. The two numbers measure different layers of the stack and are not comparable without reconciliation context.

| Metric | What Human QA compared | What it actually measures |
|--------|------------------------|---------------------------|
| ~60k | Collector ingestion volume | Rows inserted into `telegram_messages` (ingestion) |
| ~3,800 | Pipeline Requests (24h) | Rows in `data_hub_logs` (scheduled fetch / policy events) |

**Separate concern (not the 3.8k gap):** ~**720k** unprocessed messages remain in `telegram_messages` backlog — transfer throughput (~150k/day) is draining backlog but not keeping pace with total historical queue.

---

## 3. Exact formula — Data Pipeline Requests (24h)

**Source of truth:** `backend/services/dataPipelineSnapshot.js` → `loadHealthCards()`

```sql
SELECT COUNT(*)::int AS total_requests_24h
FROM data_hub_logs
WHERE created_at > NOW() - INTERVAL '24 hours'
```

**UI binding:** `PipelinePanel` → `activeSnapshot.totalRequests24h`  
**API:** `GET /api/v1/data-sources/pipeline` → `snapshot.totalRequests24h`

**Passed / Failed / Pending (24h):**

| Card | SQL filter on `data_hub_logs.status` |
|------|--------------------------------------|
| Passed | `success`, `cached` |
| Failed | `failed`, `timeout` |
| Pending | hardcoded `0` |

**Timestamp basis:** `data_hub_logs.created_at` (log write time — **not** message date).

**What creates a row:** `dataFetcher.js` logs **one row per scheduled source fetch attempt** (`action='fetch'` or `fetch_error'`). For collector-linked Telegram sources, bot-pull is skipped but a log is still written:

```javascript
// dataFetcher.js — collector-linked telegram
await this.logFetchSuccess(source.id, {
  skipped: true,
  reason: 'collector_ingestion',
  newItems: 0,
});
```

Telegram message transfer (`telegramPipeline.js` → `collected_data`) does **not** insert one `data_hub_logs` row per message.

---

## 4. Reconciliation table (live production, 2026-06-30)

| Stage | Table / metric | 24h count | Timestamp column | Notes |
|-------|----------------|-----------|------------------|-------|
| **Raw Telegram ingestion** | `telegram_messages` | **67,356** | `created_at` | New rows collector wrote (~60k QA figure ✓) |
| Same window (message date) | `telegram_messages` | **67,221** | `telegram_created_at` | Telegram-side message time |
| **Transfer to pipeline** | `telegram_messages` marked processed | **150,400** | `processed_at` | Includes backlog drain, not just today's ingest |
| **AI processed layer** | `processed_telegram_messages` | **154,048** | `created_at` | Downstream NLP/agent pipeline |
| **Screened news events** | `telegram_news_events` | **8,978** | `created_at` | Heavy filter (~6% of processed layer) |
| **Agent impacts** | `telegram_agent_impacts` | **372,081** | `created_at` | Multiple agents per message |
| **Pipeline storage** | `collected_data` (telegram sources) | **149,454** | `collected_at` | 149,105 processed / 249 error / 100 pending |
| **Pipeline requests (UI)** | `data_hub_logs` | **3,806** | `created_at` | **This is the ~3,800 UI number** |
| ↳ passed | status success/cached | 3,287 | | |
| ↳ failed | status failed/timeout | 519 | | |
| **Backlog (not 24h)** | `telegram_messages` unprocessed | **720,163** | — | `is_processed = false` |

### Flow diagram

```text
Telegram Collector poll
  → telegram_messages (+67k / 24h by created_at)
      → transfer scheduler (telegramPipeline.js)
          → collected_data (+149k / 24h transferred rows)
              → normalization / quality
                  → processed_telegram_messages (+154k)
                      → telegram_news_events (+9k screened)
                      → telegram_agent_impacts (+372k)

Parallel / orthogonal path:
  Scheduler fetch (all source types)
    → data_hub_logs (+3.8k / 24h)  ← "Requests (24h)" in UI
```

---

## 5. Why 3,806 ≠ 67,356 (detailed)

### 5.1 `data_hub_logs` breakdown (24h)

| Source type | Action | Count | Meaning |
|-------------|--------|-------|---------|
| rss | fetch | 1,574 | RSS source poll cycles |
| telegram | fetch | 1,474 | Collector-linked source heartbeat (`reason: collector_ingestion`, 0 new items) |
| telegram | fetch_error | 480 | Failed bot-pull / fetch errors on telegram sources |
| api | fetch | 240 | API source poll cycles |
| rss | fetch_error | 40 | RSS failures |
| **Total** | | **~3,808** | Matches UI ~3,800 |

47 active telegram data sources × ~31 scheduler ticks/day ≈ **1,474** telegram fetch logs — consistent with hourly (or similar) refresh intervals.

### 5.2 Telegram messages do not map 1:1 to requests

| Path | Writes `data_hub_logs`? | Volume |
|------|-------------------------|--------|
| Collector MTProto poll → `telegram_messages` | No | ~67k/day new |
| Transfer → `collected_data` | No (per message) | ~149k/day transferred |
| Filter block (`filterRulesGateway`) | Yes (policy event) | Sparse |
| Scheduler fetch / skip (`dataFetcher`) | Yes (per source tick) | ~3.8k/day all types |

---

## 6. Skipped / duplicate / filtered counts

| Mechanism | Where tracked | 24h observation |
|-----------|---------------|-----------------|
| Transfer duplicate | `telegramPipeline` summary (`duplicates`) | Not aggregated in UI; dedupe via `collected_data` content hash |
| No linked source | `skipped_no_source` in transfer | Messages marked processed even without source |
| Filter rules | `filterRulesGateway` → `data_hub_logs` | Subset of fetch/filter events |
| News screening | `telegram_news_events` vs `processed_telegram_messages` | ~9k / ~154k ≈ **5.8%** pass to news events |
| collected_data errors | status=`error` | **249** rows / 24h |

---

## 7. Linked vs unlinked channels

| Entity | Count |
|--------|-------|
| Active collector channels (`telegram_channels`) | 43 |
| Active telegram data sources | 47 |
| Sources with `config.channelId` | 47 |

Linkage is healthy; gap is not caused by missing channel→source mapping for active sources.

---

## 8. Category Screening — “No category samples yet”

**Expected with current default API — UX gap, not missing data.**

| API call | `includeCategoryScreening` | `categories[]` length |
|----------|---------------------------|----------------------|
| Default (`fetchDataPipelineView`) | `false` | **0** → UI shows empty state |
| With flag `true` | `true` | **4** categories with data |

When enabled, live 24h screening:

| Category | Inflow | Passed |
|----------|--------|--------|
| signals | 149,414 | 149,065 |
| news | 41 | 41 |
| announcements | 0 | 0 |
| uncategorized | 2 | 2 |

**Root cause:** `services/dataPipelineApi.ts` never passes `includeCategoryScreening=true` (performance opt-in from P2). UI treats empty `categories` as “No category samples yet” even though `collected_data` has ~149k telegram rows.

---

## 9. Timestamp basis reference

| Metric | Column used | Semantics |
|--------|-------------|-----------|
| Collector ingest (QA ~60k) | `telegram_messages.created_at` | Server insert time |
| Message age | `telegram_messages.telegram_created_at` | Telegram message timestamp |
| Transfer complete | `telegram_messages.processed_at` | Transfer scheduler mark |
| collected_data ingestion | `collected_at` or `metadata.transferred_at` | Pipeline insert |
| Pipeline requests | `data_hub_logs.created_at` | Fetch log time |
| Category screening | `ingestedAtSql(collected_data)` | Coalesce transferred_at / collected_at |
| Agent impacts | `telegram_agent_impacts.created_at` | Impact record time |

---

## 10. Recommendations

### A. Requests (24h) label — **recommended (expected behavior)**

Update UI help text (no DB change):

> **Requests (24h)** counts scheduled DataHub source fetch events logged in the pipeline audit trail — not raw Telegram messages ingested by the collector.

Suggested i18n keys: `pipeline_metric_requests_hint`, `total_requests_24h_hint`.

### B. Category Screening empty state — **recommended (UX bug)**

Either:
1. Pass `includeCategoryScreening=true` on pipeline load (adds ~7–16s query cost per P2 notes), or
2. Change empty copy to: “Category screening loads on demand — enable in pipeline refresh options” / lazy-load section.

### C. Backlog — **operational follow-up (separate task)**

720k unprocessed `telegram_messages` is real throughput debt. Transfer runs ~150k/day; not related to the 3.8k vs 60k confusion but worth a dedicated capacity task.

---

## 11. Final verdict

| Question | Answer |
|----------|--------|
| Is ~3,800 vs ~60k a bug? | **No** — different metrics |
| Is filtering expected? | **Yes** — multiple downstream filters (news events ~9k from ~154k processed) |
| Is pipeline dropping messages? | **No evidence** at collected_data layer (149k transferred/24h) |
| Is Category Screening empty expected? | **Partially** — data exists; default API omits category section |

**Telegram count reconciliation: CLOSED as expected metric mismatch.**

---

## 12. Reproduce (read-only)

```bash
cd backend && node scripts/telegram-pipeline-count-reconciliation.mjs
```

Or spot-check:

```bash
# Pipeline requests (UI number)
psql -c "SELECT COUNT(*) FROM data_hub_logs WHERE created_at > NOW() - INTERVAL '24 hours'"

# Raw telegram ingest
psql -c "SELECT COUNT(*) FROM telegram_messages WHERE created_at > NOW() - INTERVAL '24 hours'"
```

---

## 13. UI clarification applied

**Date:** 2026-06-30  
**Commit scope:** Frontend/i18n/tests/docs only — no DB or pipeline logic changes.

### Changes

| Area | Before | After |
|------|--------|-------|
| **Requests (24h)** | Label only | Visible helper via `pipeline_metric_requests_hint`: scheduled DataHub source fetch events — not raw Telegram volume |
| **Telegram comparison** | No guidance | `pipeline_telegram_comparison_hint` below metrics grid (also `title` tooltip): Collector raw messages vs pipeline fetch/audit events |
| **Category Screening empty** | "No category samples yet" (misleading when `includeCategoryScreening=false`) | `pipeline_category_screening_not_loaded`: explains fast pipeline view omits screening; no fake UI toggle added |

### Files touched

- `components/ai/AIManager/tabs/DataHub/PipelinePanel.tsx`
- `deploy/blue/locales/en.json`, `fa.json`
- `deploy/green/locales/en.json`, `fa.json`
- `src/__tests__/pipelineMetricsClarification.test.ts`

### i18n keys added

- `pipeline_metric_requests_hint`
- `pipeline_telegram_comparison_hint`
- `pipeline_category_screening_not_loaded`

### Verification

```bash
npm run test -- src/__tests__/pipelineMetricsClarification.test.ts
npm run build
```
