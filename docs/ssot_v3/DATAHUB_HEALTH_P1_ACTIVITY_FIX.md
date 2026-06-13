# DH-HEALTH-P1-ACTIVITY-FIX-1

**Task:** Remap Health Monitoring activity metrics; fix `data_hub_logs` writers  
**Date:** 2026-06-07  
**Verdict:** **PASS** — pipeline metrics non-zero; access logs separate; writers use valid schema.

---

## Problem (from P1 audit)

`Activity (1h)` counted `data_hub_logs` only → showed **0** while pipeline processed **~8k rows/hour**.

---

## API before / after

### Before (`GET /api/v1/data-sources/health`)

```json
{
  "status": "healthy",
  "activeSources": 44,
  "recentActivity": 0,
  "timestamp": "2026-06-07T15:53:44Z"
}
```

`recentActivity` = `COUNT(data_hub_logs)` last 1h.

### After (verified 2026-06-07T17:03:12Z)

```json
{
  "accessLogEvents1h": 0,
  "pipelineIngested1h": 8400,
  "pipelineNormalized1h": 8369,
  "telegramCreated1h": 1162,
  "recentActivity": 8400,
  "healthLastCheckedAt": "2026-06-07T17:03:12.114Z"
}
```

`recentActivity` deprecated alias → `pipelineIngested1h` (backward compatible).

---

## Final metric mapping

| API field | SQL source | UI label |
|-----------|------------|----------|
| `pipelineIngested1h` | `COUNT(collected_data)` where `collected_at > NOW() - 1h` | Pipeline ingested (1h) |
| `pipelineNormalized1h` | `COUNT(collected_data)` where `processed_at > NOW() - 1h` AND `status='processed'` | Pipeline normalized (1h) |
| `telegramCreated1h` | `COUNT(telegram_messages)` where `created_at > NOW() - 1h` | Telegram intake (1h) |
| `accessLogEvents1h` | `COUNT(data_hub_logs)` where `created_at > NOW() - 1h` | Access log events (1h) |
| `healthLastCheckedAt` | server `new Date().toISOString()` | Last check |
| `recentActivity` (deprecated) | same as `pipelineIngested1h` | — |

---

## Files changed

| File | Change |
|------|--------|
| `backend/routes/data-sources.js` | Health metrics SQL; source CRUD logs via `tryInsertDataHubAccessLog` |
| `backend/services/dataHubAccessLogWriter.js` | **New** — valid `action`/`status` inserts |
| `backend/services/dataFetcher.js` | `fetch_error` via access log writer |
| `telegram-collector/.../healthMonitoringService.ts` | `collector_health` insert with valid schema |
| `components/.../HealthPanel.tsx` | Pipeline activity section (4 cards) |
| `services/dataSourcesApi.ts` | Extended `DataHubSourcesHealth` type |
| `deploy/blue|green/locales/en.json`, `fa.json` | New i18n keys |
| `backend/__tests__/unit/dataHubHealth.test.js` | **New** — writer + i18n + metric shape tests |

**Not changed:** transfer/normalization batch, scheduler intervals, pipeline logic.

---

## `data_hub_logs` writer mappings

| Action | Status | Trigger |
|--------|--------|---------|
| `source_update` | success | PUT source |
| `source_delete` | success / warning | soft/hard DELETE |
| `source_restore` | success | PATCH restore |
| `fetch_error` | failure | `dataFetcher.logError` |
| `collector_health` | success/warning/failure | collector monitor alerts |
| `filter_blocked` | failure | filter rules (existing) |

Legacy `level` → `status`: info→success, warn→warning, error→failure.

---

## Tests & build

| Check | Result |
|-------|--------|
| `jest __tests__/unit/dataHubHealth.test.js` | **4/4 pass** (writer + i18n + metric shape) |
| `npm run build` | ✓ |
| `pm2 reload titan-backend` | ✓ |

---

## Verification

| Criterion | Result |
|-----------|--------|
| Pipeline ingested (1h) non-zero | ✓ 8404 (2026-06-08) |
| Pipeline normalized (1h) non-zero | ✓ 8474 |
| Telegram intake (1h) non-zero | ✓ 3606 |
| Access log events may be 0 | ✓ 0 (expected until admin/fetch events) |
| No batch/scheduler changes | ✓ |

---

## Rollback

Revert commit → `pm2 reload titan-backend`. UI falls back to `recentActivity` if new fields absent.

**Commit:** `06dd7b8249b5a24fcea618da9dbfc69fadb68e6e`

---

## Related

- Audit: `docs/ssot_v3/DATAHUB_HEALTH_P1_ACTIVITY_AUDIT.md`
