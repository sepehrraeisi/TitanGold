# DataHub Pipeline Fix 2 — DH-PIPELINE-FIX-2-VERIFY

> **Date:** 2026-06-05  
> **Scope:** Response(ms) wiring + normalized preview status semantics

---

## Timing source

**Primary:** `data_hub_logs.execution_time_ms` (latest log per source via LATERAL join)  
**Fallback:** `collected_data.metadata` / log `metadata` keys: `response_time_ms`, `execution_time_ms`, `duration_ms`  
**If none:** `lastResponseTime` omitted → UI shows `—` (no fake values)

---

## Normalized preview status model

| Condition | Status | Quality display |
|-----------|--------|-----------------|
| `error` or `error_message` | `rejected` | score if present, else `—` |
| `normalized_data` present, no quality issue | `ready` | explicit score or `—` |
| explicit quality/validation flags | `warning` | score if present |
| `pending` or raw without normalization | `pending_normalization` | **Pending** |
| raw ingested only | `ingested` | **Pending** |

Removed: blanket `warning` for `status=pending` when data is not actually bad.

---

## API / service evidence

Direct `buildDataPipelineView()` probe (with temporary log row):

| Check | Result |
|-------|--------|
| RSS source `lastResponseTime` after log insert | **842** ms |
| BBCPersian | `cached` + `operationalStatus: pending` (FIX-1 preserved) |
| DIRHAM_RATE | `cached` + `operationalStatus: pending` |
| Preview all-warning | **false** |
| Preview statuses (top 8 recent) | `pending_normalization` × 8 |
| `qualityPending` for pending rows | **true** |

Report: `test-results/dh-pipeline-fix2/service-report.json`

---

## Build

`npm run build` — **Pass**

---

## Rollback

Revert commit; no migration. Pipeline reverts to metadata-only timing and legacy warning mapping.
