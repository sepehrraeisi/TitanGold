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

**وضعیت قبلی (قبل از GAP-013):** `dataHub.accessLogs` از IndexedDB / `fetchDataHubState` + `logsAsync`. **اکنون:** فقط `useAccessLogsQuery` → این endpoint.

---

## ۳. Endpoint — `GET /api/v1/data-sources/access-logs`

### Pagination / volume

| پارامتر | مقدار |
|---------|--------|
| `limit` | پیش‌فرض **100**؛ حداکثر **500** (cap در `accessLogsQuerySchema`) |
| `offset` | پیش‌فرض **0** |
| `source_id` | اختیاری — UUID |
| `status` | اختیاری — `success` \| `cached` \| `failed` \| `timeout` |

**حجم (~50k ردیف):** لیست با `ORDER BY created_at DESC LIMIT/OFFSET` + ایندکس `idx_data_hub_logs_created_at` سالم می‌ماند. `COUNT(*)` و `statusCounts` روی کل جدول (یا فیلتر `source_id`) برای 50k معمولاً قابل‌قبول است؛ برای میلیون‌ها → GAP-015 (pagination cursor / aggregate cache).

**ایندکس‌های موجود (`database/schema.sql`):**

- `idx_data_hub_logs_created_at` ON `created_at DESC`
- `idx_data_hub_logs_source_id` ON `source_id`

فیلتر ترکیبی `source_id` + `created_at` در scale بالا می‌تواند به composite index نیاز داشته باشد (همان GAP-015 اختیاری).

### Security

| لایه | وضعیت |
|------|--------|
| Auth | `authenticate` + `readRateLimiter` روی روت (`data-sources.js`) |
| RBAC نقش | **ندارد** — هر کاربر authenticated می‌تواند بخواند |
| GAP | **GAP-014** — RBAC read روی `GET /access-logs` (جدا از wiring GAP-013) |

**Query (پیاده‌سازی):** `limit`, `offset`, `source_id?`, `status?`

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

## ۴. Done (GAP-013) / Open (GAP-014)


- [x] تب Logs: `useAccessLogsQuery` → `GET /access-logs` (نه `dataHub.accessLogs` از IndexedDB)
- [x] Demo در `DataHub_DEMOS.md`
- [x] SSOT: `dataHub.logs` → **Implemented**
