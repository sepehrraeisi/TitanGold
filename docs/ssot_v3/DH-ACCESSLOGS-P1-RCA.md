# DH-ACCESSLOGS-P1-RCA

**Task:** Read-only RCA — DataHub Access Logs issues  
**Date:** 2026-06-08  
**Verdict:** **A + E** — only 1 row exists in DB; UI shows UUID because API omits `sourceName`; status badge mismatch maps `error` key to UI expecting `failed`.

---

## A1 — `data_hub_logs` row counts (production)

| Metric | Value |
|--------|-------|
| **Total** | **1** |
| **Last 24h** | **0** |
| **Last 7d** | **1** |
| **Latest row** | `2026-06-05T16:48:11.748Z` |

### Latest row (only row in table)

| Field | Value |
|-------|-------|
| `id` | `58edbc8c-6808-4c38-afe4-2d0b48457f42` |
| `source_id` | `ed0fb136-d20f-46f6-97aa-e70d2605cfef` |
| `action` | `fetch` |
| `status` | `success` |
| `message` | `pipeline-fix2 timing probe` |
| `execution_time_ms` | `842` |

**Conclusion:** Table is effectively empty except one manual probe from pipeline-fix2 verification.

---

## A2 — Writers audit

| Writer | File | Action(s) | Writes in prod? |
|--------|------|-----------|-----------------|
| Source update | `data-sources.js` | `source_update` | Only on PUT — rare |
| Source delete | `data-sources.js` | `source_delete` | Only on DELETE |
| Source restore | `data-sources.js` | `source_restore` | Only on PATCH restore |
| Fetch error | `dataFetcher.js` | `fetch_error` | On RSS/API fetch failure only |
| Fetch success | — | — | **Not implemented** |
| Filter block | `datahubFilterRulesService.js` | `filter_blocked` | Only when rule blocks ingest |
| Collector health | `healthMonitoringService.ts` | `collector_health` | On alert only (wrong schema fixed in P1 health) |
| Telegram messages | collector pipeline | — | **No** |
| Transfer / normalization | workers | — | **No** |

Writers were fixed to valid `action`/`status` schema in DH-HEALTH-P1-ACTIVITY-FIX-1 (`dataHubAccessLogWriter.js`), but **almost no events fire** because:

1. Telegram ingestion bypasses `dataFetcher` (collector path).
2. Fetch **success** is not logged.
3. Admin CRUD events are infrequent.
4. No historical backfill.

---

## A3 — Why UI shows only 1 row

| Hypothesis | Verdict | Evidence |
|------------|---------|----------|
| **A** Only 1 row exists | **CONFIRMED** | `SELECT COUNT(*) FROM data_hub_logs` → 1 |
| B API filtering bug | Rejected | No default `source_id` filter; `limit=100` |
| C Pagination bug | Rejected | `total=1`, offset 0 |
| D Query bug | Rejected | API returns the 1 row |
| **E** Mapping bug (status badges) | **Partial** | API `statusCounts: { success, error, warning }` vs UI keys `{ success, cached, failed, timeout }` — success=1 displays correctly; failed/cached/timeout show 0 |

**Primary:** Outcome **A** (sparse logging). Secondary: **E** (status count key mismatch).

---

## A4 — Source column UUID trace

| Layer | Field | Value |
|-------|-------|-------|
| DB | `source_id` | UUID |
| API `mapRowToAccessLog` | `sourceId: row.source_id` | UUID passed through |
| API | `sourceName` | **Not returned** |
| UI `LogsPanel.tsx` L265 | `{log.sourceId}` | Renders raw UUID in `font-mono` |

```265:265:components/ai/AIManager/tabs/DataHub/LogsPanel.tsx
<td className="py-2 pr-3 font-mono text-[10px]">{log.sourceId}</td>
```

No JOIN to `data_sources.name` in `listDataHubAccessLogs()`.

---

## Issue 1 — Filter layout

Filters use `flex flex-wrap` in header row with `SELECT_CLASS` = `w-full`, causing status dropdown to stretch. Controls share row with title on large screens — poor grid structure.

---

## Recommended fixes (Phase B)

1. Remap API `statusCounts` to UI keys; add `sourceName` via JOIN.
2. Redesign filter grid; add row detail modal.
3. Log `fetch` success (not per-message) from `dataFetcher`.
4. Do not log transfer/normalization per row.
