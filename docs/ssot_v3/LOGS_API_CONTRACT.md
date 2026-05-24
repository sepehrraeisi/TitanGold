# DataHub Access Logs — API Contract (GAP-013)

> قبل از wiring تب Logs. مرجع UI: `LogsPanel.tsx`, `types.ts` (`DataAccessLog`).

## ۱. UI دقیقاً چه چیزی لازم دارد؟

| نیاز UI | نوع | مصرف |
|--------|-----|------|
| لیست لاگ | `DataAccessLog[]` | جدول + فیلتر client-side (source, agent, status, telegram-only) |
| شمارش وضعیت | `{ success, error, warning }` | badgeهای بالای پنل (`logStatusCounts`) |
| بارگذاری / خطا | loading + error + retry | `ApiWrapper` |

`DataAccessLog`: `id`, `timestamp`, `agentId`, `sourceId`, `dataType`, `status` (`success` \| `cached` \| `failed` \| `timeout`), `responseTime?`, `error?`, `dataSize?`

**خارج از scope:** Design/i18n؛ لاگ‌های agent-level از `collected-data` (تب Logs ≠ ingestion audit کامل).

---

## ۲. Backend موجود

| Method | Path | کافی برای Logs tab؟ |
|--------|------|----------------------|
| `GET` | `/api/v1/data-sources/state` | خیر — فقط `recentLogs` count |
| `GET` | `/api/v1/data-sources/stats` | خیر — aggregate |
| `GET` | `/api/v1/collected-data` | خیر — دادهٔ جمع‌آوری‌شده، نه access log |
| `GET` | `/api/v1/artemis/logs` | خیر — system logs Artemis |
| INSERT | `data_hub_logs` در CRUD sources | بله — منبع داده (ستون‌های `action`, `status`, …) |

**وضعیت قبلی فرانت:** `dataHub.accessLogs` از IndexedDB / `fetchDataHubState`؛ `logsAsync` همان state را refresh می‌کرد.

---

## ۳. Endpoint پیشنهادی

### `GET /api/v1/data-sources/access-logs`

**Query:** `limit` (default 100), `offset` (default 0), `source_id?` (uuid), `status?` (`success` \| `failed` \| `timeout` \| `cached` — فیلتر UI)

**Response `200`:**

```json
{
  "data": [ { "id": "…", "timestamp": "…", "agentId": "system", "sourceId": "…", "dataType": "fetch", "status": "success", "responseTime": 120 } ],
  "pagination": { "total": 0, "limit": 100, "offset": 0, "hasMore": false },
  "statusCounts": { "success": 0, "error": 0, "warning": 0 }
}
```

**نگاشت DB → UI:** `data_hub_logs.status` (`success`/`failure`/…) → `DataAccessLog.status`؛ `action` → `dataType`؛ `execution_time_ms` → `responseTime`؛ `metadata.agent_id` → `agentId`.

---

## ۴. Done (GAP-013)

- [x] تب Logs: `useAccessLogsQuery` → `GET /access-logs` (نه `dataHub.accessLogs` از IndexedDB)
- [x] Demo در `DataHub_DEMOS.md`
- [x] SSOT: `dataHub.logs` → **Implemented**
