# DH-HEALTH-P1-ACTIVITY-AUDIT-1

**Task:** Read-only RCA — is Health Monitoring **Activity (1h)** correct?  
**Date:** 2026-06-07T15:53:44Z  
**Verdict:** **Activity (1h) = 0 is arithmetically correct for the current query, but the metric is misleading.** It counts `data_hub_logs` rows (audit/fetch access logs), not pipeline ingestion activity. The log table is effectively empty because most writers use a non-existent `level` column and fail silently.

---

## Executive summary

| Question | Answer |
|----------|--------|
| What does Activity (1h) measure? | `COUNT(*)` from `data_hub_logs` where `created_at > NOW() - 1 hour` |
| Current value | **0** (matches API query) |
| Is pipeline active? | **Yes** — 8,400 ingests / 8,242 normalizations in last hour |
| Why the disconnect? | **Wrong mapping + broken log writers + stale/empty table** |
| User-visible problem | Label implies live DataHub activity; shows **0** during heavy pipeline load |

**Classification:** Primarily **wrong label/mapping** + **broken writers** (not a broken COUNT query).

---

## 1. Frontend trace

| Layer | Location |
|-------|----------|
| Tab | Data Hub → **Health Monitoring** (`DataHubTab.tsx` sub-tab `health`) |
| Component | `components/ai/AIManager/tabs/DataHub/HealthPanel.tsx` |
| i18n label | `datahub_health_recent_activity` → **"Activity (1h)"** |
| React Query hook | `useDataHubSourcesHealthQuery()` in `hooks/useDataHubState.ts` |
| API client | `fetchDataHubSourcesHealth()` → `GET /api/v1/data-sources/health` in `services/dataSourcesApi.ts` |
| Field bound | `healthQuery.data?.recentActivity` |
| Formatter | `formatNaDisplay()` in `pipelineHealthFormat.ts` — `0` renders as **"0"**, missing/invalid as **"N/A"** |

```99:101:components/ai/AIManager/tabs/DataHub/HealthPanel.tsx
    const recentActivity = useMemo(() => {
        return formatNaDisplay(healthQuery.data?.recentActivity);
    }, [healthQuery.data?.recentActivity]);
```

**StaleTime:** 30s on health query (not a caching bug — API returns 0 live).

---

## 2. API trace

**Endpoint:** `GET /api/v1/data-sources/health`  
**Route:** `backend/routes/data-sources.js` (authenticated)

```506:520:backend/routes/data-sources.js
    const activityResult = await query(
      `SELECT COUNT(*) as count FROM data_hub_logs 
       WHERE created_at > NOW() - INTERVAL '1 hour'`
    );
    const recentActivity = parseInt(activityResult.rows[0]?.count) || 0;
    // ...
    res.json({
      status: isHealthy ? 'healthy' : 'degraded',
      database: 'connected',
      activeSources: activeCount,
      recentActivity,
      timestamp: new Date().toISOString(),
    });
```

**Source table:** `data_hub_logs`  
**Source field:** `created_at` (row insert timestamp)  
**Window:** rolling 1 hour (`NOW() - INTERVAL '1 hour'`)

No join to `collected_data`, `telegram_messages`, or `request_logs`.

---

## 3. `data_hub_logs` schema (production)

| Column | Type |
|--------|------|
| `id` | uuid |
| `source_id` | uuid |
| `action` | varchar (NOT NULL) — e.g. `fetch`, `filter_blocked` |
| `status` | varchar (NOT NULL) — e.g. `success`, `failure` |
| `message` | text |
| `data_size` | integer |
| `execution_time_ms` | integer |
| `created_at` | timestamptz |
| `metadata` | jsonb |

**There is no `level` column.**

---

## 4. Production comparison (2026-06-07T15:53:44Z)

| Signal | Last 1 hour | Notes |
|--------|-------------|-------|
| **`data_hub_logs` (Activity metric)** | **0** | What `/health` returns |
| `data_hub_logs` total (all time) | **1** | Single manual probe row |
| `data_hub_logs` latest row | **2026-06-05T16:48:11Z** | `action=fetch`, `message=pipeline-fix2 timing probe` |
| `data_hub_logs` last 24h | **0** | |
| `telegram_messages` created | **1,814** | Active collector ingest |
| `collected_data` ingested (`collected_at`) | **8,400** | Pipeline transfer path |
| `collected_data` processed (`processed_at`, status=processed) | **8,242** | Normalization worker |
| `request_logs` | **2,023** | General API traffic |

**Health API replay:** `recentActivity = 0` ✓ (matches SQL)

---

## 5. Why `data_hub_logs` is empty

### Writers using **invalid** `level` column (inserts fail silently)

| File | Trigger | INSERT pattern |
|------|---------|----------------|
| `backend/routes/data-sources.js` | Source update / soft delete / hard delete / restore | `(source_id, level, message, metadata)` |
| `backend/services/dataFetcher.js` | `logError()` on fetch/webhook errors | `(source_id, level, message, metadata)` |

Errors are caught in try/catch; request succeeds but **no row is written**. Test logs document: `column "level" of relation "data_hub_logs" does not exist`.

### Writers using **wrong** schema (telegram-collector)

`telegram-collector/src/services/healthMonitoringService.ts` inserts `(level, source, category, message, metadata)` — columns that do not exist on `data_hub_logs`.

### Writers using **correct** schema (rarely triggered)

`backend/services/datahubFilterRulesService.js` — `(source_id, action, message, metadata, status)` ✓  
No filter-block events observed in last hour → 0 rows.

### Pipeline paths **do not write** `data_hub_logs`

| Path | Writes `data_hub_logs`? |
|------|-------------------------|
| Telegram collector → `telegram_messages` | No |
| Transfer → `collected_data` | No |
| Normalization worker → `normalized_data` | No |
| RSS/API fetch success | No (only broken `logError` on failure) |
| Source POST create | No log at all |

---

## 6. Root-cause classification

| Hypothesis | Verdict | Evidence |
|------------|---------|----------|
| **Correct** (no activity) | **Rejected** | 8,400+ pipeline rows/hour |
| **Stale metric** | **Partial** | Table stale since 2026-06-05; query is live |
| **Broken query** | **Rejected** | `COUNT(*)` on `created_at` is valid; returns true count |
| **Wrong mapping** | **Confirmed** | Metric = access/audit log count, not ingestion/normalization |
| **Wrong label** | **Confirmed** | "Activity (1h)" reads as pipeline activity to operators |

**Combined verdict:** Activity (1h)=0 is **technically correct for `data_hub_logs`**, but **operationally wrong** as a health signal for DataHub pipeline activity.

---

## 7. Example: sole `data_hub_logs` row

```json
{
  "id": "58edbc8c-6808-4c38-afe4-2d0b48457f42",
  "source_id": "ed0fb136-d20f-46f6-97aa-e70d2605cfef",
  "action": "fetch",
  "status": "success",
  "message": "pipeline-fix2 timing probe",
  "created_at": "2026-06-05T16:48:11.748Z"
}
```

Manual verification insert from pipeline-fix2 work — not production fetch scheduler output.

---

## 8. Related SSOT / GAP context

| Doc | Note |
|-----|------|
| `SSOT_v3.0.md` | Health tab lists `data_hub_logs` as data source for Activity |
| `GAP-035` | Avg response + cache on `/health` marked N/A — Activity not flagged |
| `DATAHUB_PIPELINE_QA2.md` | QA2-09: `dataFetcher.logError` invalid `level` column |
| `LOGS_API_CONTRACT.md` | Access Logs tab correctly maps `action`/`status` columns |

---

## 9. Recommended actions (no fixes applied in this audit)

### P1 — Relabel or remap (product)

**Option A (minimal):** Rename UI/API field to **"Access log events (1h)"** so 0 is interpretable.  
**Option B (better):** Add separate KPIs on `/health` or `/stats`:

- `pipelineIngested1h` → `COUNT(collected_data WHERE collected_at > …)`
- `pipelineNormalized1h` → `COUNT(collected_data WHERE processed_at > … AND status='processed')`
- Keep `recentActivity` for access logs or deprecate

### P1 — Fix log writers (engineering)

Align all `INSERT INTO data_hub_logs` to schema: `(source_id, action, status, message, metadata, execution_time_ms)`.

Files to fix:

- `backend/routes/data-sources.js` (4 inserts)
- `backend/services/dataFetcher.js` (`logError`)
- `telegram-collector/.../healthMonitoringService.ts`

### P2 — Wire fetch scheduler success logs

On RSS/API fetch completion, insert `action='fetch', status='success'|'failure'` with `execution_time_ms` so Access Logs tab and Activity reflect real fetch traffic.

### P2 — Do not use `request_logs` for Activity

`request_logs` (2,023/h) includes all API routes — too broad for DataHub pipeline health.

---

## 10. Evidence commands (read-only, reproducible)

```sql
-- Activity metric (exact health endpoint query)
SELECT COUNT(*) FROM data_hub_logs
WHERE created_at > NOW() - INTERVAL '1 hour';

-- Pipeline reality check
SELECT COUNT(*) FROM collected_data WHERE collected_at > NOW() - INTERVAL '1 hour';
SELECT COUNT(*) FROM collected_data
WHERE processed_at > NOW() - INTERVAL '1 hour' AND status = 'processed';
SELECT COUNT(*) FROM telegram_messages WHERE created_at > NOW() - INTERVAL '1 hour';
```

---

## Final verdict

| Item | Result |
|------|--------|
| Activity (1h) SQL | Works as written |
| Activity (1h) = 0 | **Correct for `data_hub_logs`** |
| Activity (1h) as pipeline health | **Incorrect / misleading** |
| Primary cause | **Wrong mapping + empty log table (broken INSERT writers)** |
| Secondary cause | Pipeline paths never log to `data_hub_logs` |

**Operator takeaway:** A healthy, high-throughput pipeline (~8k rows/hr) will show **Activity (1h) = 0** until log writers are fixed and/or the metric is remapped to pipeline counters.
