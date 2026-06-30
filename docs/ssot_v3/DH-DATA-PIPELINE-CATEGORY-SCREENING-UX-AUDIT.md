# DH-DATA-PIPELINE — Category Screening Product/UX Audit

**Task:** `DH-DATA-PIPELINE-CATEGORY-SCREENING-UX-AUDIT`  
**Date:** 2026-06-30  
**Mode:** Read-only (no code changes)  
**Evidence:** `docs/ssot_v3/screenshots/category-screening-ux-audit-evidence.json`  
**Related:** `DH-DATA-PIPELINE-TELEGRAM-COUNT-RECONCILIATION.md`

---

## 1. Executive summary

| Question | Answer |
|----------|--------|
| Is Category Screening useful to operators today? | **No** — pass rates are ~100% everywhere; volume is 99.9% `signals`; no anomalies surfaced |
| Is it unique vs other DataHub surfaces? | **Mostly no** — duplicates Categories-tab metrics (when loaded) and overlaps normalization semantics; **not** the same as Telegram AI category analytics |
| Is performance cost justified? | **No** — **~152s** production query for **403 bytes** / **4 rows** |
| **Verdict** | **REPLACE** |

**Recommendation:** **OPTION B — Replace** the current Category Screening widget with an operational **Telegram Transfer Backlog / Pipeline Issues** panel that reuses existing fast or already-lazy-loaded backlog enrichment. Do **not** keep the current table (OPTION A is not justified). Pure removal without replacement (OPTION C) is acceptable if panel space is merged into Source Quality Board.

---

## 2. What `includeCategoryScreening=true` returns

### 2.1 API

```
GET /api/v1/data-sources/pipeline?includeBacklog=false&includeCategoryScreening=true
```

Returns full pipeline view; only `snapshot.categories[]` is populated by the flag (other sections unchanged vs fast pipeline).

### 2.2 Production response example (2026-06-30)

```json
{
  "snapshot": {
    "categories": [
      {
        "categoryId": "abdb8012-c5e4-4b58-859b-6289ea3a0d95",
        "name": "announcements",
        "inflow": 0,
        "passRate": 100
      },
      {
        "categoryId": "a7746fe9-98fd-4e2e-96f2-3962ce28109d",
        "name": "news",
        "inflow": 58,
        "passRate": 100
      },
      {
        "categoryId": "d9e1d5cf-40d7-48e7-8134-b6778cb1930b",
        "name": "signals",
        "inflow": 154208,
        "passRate": 99.8
      },
      {
        "categoryId": "48d28eb1-ef6a-4166-9c39-f9f541de4db5",
        "name": "uncategorized",
        "inflow": 5,
        "passRate": 100
      }
    ]
  }
}
```

### 2.3 Semantics (what operators think vs what code measures)

| UI label | Operator interpretation | Actual SQL meaning |
|----------|-------------------------|-------------------|
| **Category Screening** | Content/topic filter pass/fail (news vs noise) | **DataHub config category** rollup |
| **Inflow (24h)** | Messages ingested | Rows in `collected_data` joined to `data_sources.category` in 24h window |
| **Pass Rate** | Screening quality | `%` with `status='processed'` AND `normalized_data IS NOT NULL` |

**Pass rate formula** (`backend/services/dataPipelineSnapshot.js`):

```javascript
passRate = inflow === 0 ? 100 : ((passedCount / inflow) * 100).toFixed(1)
```

Where `passedCount` = rows with `cd.status = 'processed' AND cd.normalized_data IS NOT NULL`.

This is **normalization throughput**, not Telegram NLP screening (`telegram_news_events`, agent impacts, or `/api/v1/telegram/categories/summary`).

---

## 3. SQL evidence (production, read-only)

### 3.1 Category screening query (isolated)

Source: `loadCategoryScreening()` in `backend/services/dataPipelineSnapshot.js`

```sql
WITH category_counts AS (
  SELECT
    ds.category,
    COUNT(*)::int AS inflow,
    COUNT(*) FILTER (
      WHERE cd.status = 'processed'
        AND cd.normalized_data IS NOT NULL
    )::int AS passed_count
  FROM collected_data cd
  INNER JOIN data_sources ds ON ds.id = cd.source_id
  WHERE COALESCE(
          (cd.metadata->>'transferred_at')::timestamptz,
          cd.collected_at
        ) > NOW() - INTERVAL '24 hours'
  GROUP BY ds.category
)
SELECT
  dc.id AS category_id,
  dc.name,
  COALESCE(cc.inflow, 0)::int AS inflow,
  COALESCE(cc.passed_count, 0)::int AS passed_count
FROM data_categories dc
LEFT JOIN category_counts cc ON cc.category = dc.name
ORDER BY dc.name;
```

**Production timings (2026-06-30):**

| Run | Duration | Rows returned |
|-----|----------|---------------|
| Isolated SQL | **80.7s – 115.4s** | 4 |
| Inside `buildDataPipelineView` (`category_screening` section) | **145s – 152s** | 4 |
| EXPLAIN ANALYZE | **~82s** | — |

Root cause: full **24h scan of `collected_data`** (~150k+ rows/day) with join to `data_sources`; table ~4.3M rows estimated (`reltuples`).

### 3.2 Actionable errors hidden by pass-rate UI

Same 24h window, errors by category (production):

| category | errors | pending | processed |
|----------|--------|---------|-------------|
| signals | **253** | 0 | 154,245 |
| news | 0 | 0 | 58 |
| uncategorized | 0 | 0 | 5 |

Query time: **~95s** (same scan cost). The widget shows **99.8% pass** for signals but does not surface **253 errors** as a first-class metric.

### 3.3 Cross-check vs other production counts (24h)

| Metric | Count | Source |
|--------|-------|--------|
| Category inflow sum (`signals`+`news`+…) | **154,271** | Category screening |
| `collected_data` telegram ingested | **~149–154k** | Reconciliation SSOT |
| Raw `telegram_messages` created | **~67k** | Collector layer |
| `processed_telegram_messages` | **~154k** | AI layer |
| `telegram_news_events` (actual “screening”) | **~9k** | ~6% of processed |

Category screening **does not** expose the ~9k news-event filter rate that operators care about when they hear “screening”.

---

## 4. Performance measurement

| Dimension | Fast pipeline (`includeCategoryScreening=false`) | With screening |
|-----------|--------------------------------------------------|----------------|
| **End-to-end API build** | **~2.7s** | **~152s** |
| **Incremental payload** | 16,446 B baseline | **+403 B** (+4 category objects) |
| **Categories JSON size** | 0 B (empty array) | **405 B** |
| **DB rows returned** | 57 sources | +4 category rows |
| **Render cost (frontend)** | N/A | **Trivial** (4-row table) |
| **Refresh frequency** | Tab open + manual Refresh; React Query stale **30s** | On-demand button; stale **5 min** after first load |
| **Operator wait per click** | ~3s | **~2.5 min** (production) |

**Cost/benefit ratio:** ~**56× slower** for **0.002%** more JSON. Dominated by DB, not network or React.

Historical context (P2 baseline): category screening alone was **221s–538s** before opt-in flag; opt-in removed it from default path but the query itself remains a full-table aggregate.

---

## 5. Operator usefulness assessment

### 5.1 What an operator learns from the current widget

1. **~99.9% of pipeline volume is category `signals`** (154k of 154k) — one dominant row.
2. **Pass rates are ~100%** for all categories — no category needs intervention.
3. **`announcements` has zero inflow** — config exists but no traffic (already visible in Categories tab as empty config).
4. **No trend, no delta, no error drill-down, no source attribution.**

**Actionable decisions enabled:** essentially **none** in current production state.

### 5.2 Misleading factors

- Name **“Category Screening”** implies Telegram/NLP filter funnel; data is **normalization pass rate by DataHub category name**.
- **Pass Rate 100%** on zero-inflow categories (`announcements`) is mathematically correct but visually implies health.
- **`normalizedPercent` on pipeline snapshot is hardcoded `0`** in backend — top metric cards do not reflect category pass data anyway.

---

## 6. Duplication matrix

| Surface | Overlap with Category Screening | Unique value vs screening |
|---------|--------------------------------|---------------------------|
| **Categories tab** | **Same** `inflow` / `passRate` via `categoryMetricsById` when user loads screening from Pipeline | Config CRUD, tags, source counts, telegram source badges |
| **Source Quality Board** (same panel) | Per-source `category` subtitle + status/errors | **Per-source** operational status, backlog, response ms — **more actionable** |
| **Pipeline metric cards** | Same 24h window conceptually | **Fetch audit** (`data_hub_logs`) — orthogonal layer |
| **Normalization Summary** (opt-in, not default) | Same `collected_data` pass/fail semantics | Global totals, not by category |
| **Telegram Collector tab** | None | Raw ingest volume, channel health, force-sync |
| **Telegram Data → Category Breakdown** | Word “category” only | **Different taxonomy** (NLP categories), impact/breaking charts, timelines — **real screening analytics** |
| **AI Inbox / Agent feed** | None | Action-required impacts, agent-level decisions |

**Conclusion:** Category Screening is a **slow duplicate** of normalization rollup by config category. The only place that shows the same numbers is Categories tab (and only after Pipeline load populates `categoryMetricsById`). It is **not** a substitute for Telegram AI category analytics.

---

## 7. UI evidence (screenshots)

| Screenshot | Description |
|------------|-------------|
| Browser capture 2026-06-30 (dev, JWT 401) | Data Pipeline tab — empty snapshot + Unauthorized banner; Category Screening not reachable without auth |
| Production loaded state | **Not browser-captured** (152s server-side); use API JSON in §2.2 and evidence JSON |

**Current UX flow (after on-demand button, commit `15506bd`):**

1. Default: honest empty copy + **Load detailed screening** button.
2. Click: **~2.5 min wait** → 4-row table at ~100% pass.
3. **Poor ROI:** operator waits minutes to confirm “signals is big and everything passes.”

---

## 8. Options analysis

### OPTION A — Keep & redesign as operational dashboard

**Would require:** new metrics (errors, pending, trend, source drill-down), renamed semantics, pre-aggregates/materialized view, sub-second queries.

**Assessment:** This is effectively a **new feature**, not a polish of the current widget. Current data model at 99.8% pass does not justify investment unless paired with **query rewrite + different metrics**. **Not recommended** to keep the existing table while “redesigning” labels only.

### OPTION B — Replace with higher-value widget ✅ **RECOMMENDED**

Replace left column with **Telegram Transfer Backlog / Pipeline Issues** using data already partially available:

| Candidate widget | Operational value | Query cost |
|------------------|-------------------|------------|
| **Global Telegram backlog** (720k unprocessed) | **High** — capacity/incident decisions | Already in `/pipeline/backlog` lazy load |
| **Transfer throughput 24h** | **High** — drain vs ingest | Same backlog endpoint |
| **Top failing sources** (from Source Quality Board filter) | **Medium** — zero new queries | Client-side from loaded sources |
| **collected_data errors by category** | **Medium** — 253 errors today | **Still ~95s** unless pre-aggregated — do not ship raw scan |

**Best replacement:** Promote **backlog + transfer throughput** card into the Category Screening column (reuse existing backlog enrichment; no new heavy SQL).

### OPTION C — Remove completely

Valid if panel is collapsed to single column or Source Quality Board expanded. Avoids **152s trap** entirely. Downside: wasted grid space unless layout adjusted.

---

## 9. Recommendation

**OPTION B — REPLACE**

1. **Remove** current Category Screening table and `Load detailed screening` flow (and decouple Categories tab from `categoryMetricsById` pipeline dependency).
2. **Replace** with **“Telegram pipeline backlog”** mini-dashboard:
   - Unprocessed queue size + oldest age
   - Transfer throughput 24h
   - Link to Telegram Collector / filter Source Quality Board to issues
3. **Do not** reintroduce full `collected_data` category aggregates without a **pre-computed rollup table** or **incremental counter**.
4. If category-level normalization metrics are ever needed again, expose them on **Categories tab** via a **cheap cached endpoint** (<500ms SLA), not a 150s scan.

---

## 10. Verdict

# **REPLACE**

Current Category Screening should **not** be kept. It fails the operator usefulness test, duplicates other surfaces, mislabels normalization as “screening,” and costs **~152 seconds** for **403 bytes** of non-actionable data.

---

## 11. Reproduce (read-only)

```bash
# Full evidence bundle (timings + API shape)
cd backend && node --input-type=module -e "
import { writeFileSync } from 'fs';
import { buildDataPipelineView } from './services/dataPipelineSnapshot.js';
// ... see category-screening-ux-audit-evidence.json generation
"

# Evidence file (committed)
cat docs/ssot_v3/screenshots/category-screening-ux-audit-evidence.json

# Isolated category SQL timing (expect 80-150s on production volume)
# Use loadCategoryScreening query from dataPipelineSnapshot.js
```

**Evidence artifact:** `docs/ssot_v3/screenshots/category-screening-ux-audit-evidence.json`

---

## 12. Implementation applied — Telegram Transfer Health (OPTION B)

**Date:** 2026-06-27  
**Commit message:** `feat(datahub): replace category screening with telegram transfer health dashboard`

### Removed

- Category Screening widget, load button, and `fetchDataPipelineCategoryScreening` / `usePipelineCategoryScreeningQuery`
- On-demand `includeCategoryScreening=true` UI path (backend flag retained for API compat only)

### Added

**Telegram Transfer Health** widget in Pipeline tab left column — answers: *Is Telegram ingestion keeping up with processing?*

| Metric | Source |
|--------|--------|
| Incoming messages (24h) | `fetchTelegramIngestMetrics24h()` — indexed `telegram_messages.created_at` count |
| Transferred to collected_data (24h) | Same helper — telegram `collected_data` ingested-at window |
| Processed messages (24h) | Existing `fetchTransferThroughput24h()` |
| Current backlog | Existing `fetchGlobalTelegramBacklogSummary()` |
| Oldest unprocessed age | `globalTelegramBacklog.oldestUnprocessed` |
| Processing rate | `transferThroughput.messagesPerHour` |
| Drain ratio | Client: `processed24h ÷ incoming24h` |
| Estimated catch-up | Client: `backlog ÷ messagesPerHour` |
| Transfer health | Client: Healthy / Warning / Critical |

### API / performance

- Metrics ship via existing lazy **`GET /api/v1/data-sources/pipeline/backlog`** response field `ingestMetrics`
- Backlog route wrapped in **`getOrLoadCached('pipeline:backlog:enrichment')`** (45s TTL) — repeat loads target **<500ms**
- No new heavy SQL scans; ingest counts are time-range `COUNT(*)` only

### Files

- `components/ai/AIManager/tabs/DataHub/TelegramTransferHealth.tsx`
- `components/ai/AIManager/tabs/DataHub/telegramTransferHealthFormat.ts`
- `backend/services/telegramBacklogIntelligence.js` — `fetchTelegramIngestMetrics24h`
- `backend/services/pipelineBacklogEnrichment.js`, `backend/routes/data-sources.js`
- Locale keys `telegram_transfer_health_*` (en/fa × blue/green)
- `src/__tests__/telegramTransferHealth.test.ts`

### Verification

```bash
npm run test -- src/__tests__/telegramTransferHealth.test.ts src/__tests__/pipelineMetricsClarification.test.ts
npm run build
```
