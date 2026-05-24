# DataHub Pipeline — API Contract (GAP-012)

> نوشته شده **قبل از** پیاده‌سازی v3.0. مرجع: `PipelinePanel.tsx`, `types.ts` (`DataPipelineSnapshot`, …), `backend/routes/data-sources.js`, `backend/routes/collected-data.js`.

## ۱. UI دقیقاً چه چیزی لازم دارد؟

تب **Pipeline** (`PipelinePanel.tsx`) برای دادهٔ اصلی به این شکل‌ها وابسته است (نه IndexedDB / `fetchDataHubState`):

| نیاز UI | نوع TypeScript | مصرف در UI |
|--------|----------------|------------|
| Snapshot فعلی | `DataPipelineSnapshot` | `totalRecords`, `normalizedPercent`؛ فیلتر/نمایش `sources[]`, `categories[]`؛ `lastRefreshed` |
| تاریخچه snapshot | `DataPipelineHistoryEntry[]` | `<select>` Snapshot History؛ `id`, `generatedAt`, `snapshot` |
| خلاصه نرمال‌سازی | `DataNormalizationSummary` | `totalProcessed`, `passed`, `warnings`, `rejected`, `lastProcessedAt` |
| نمونه رکوردهای نرمال | `NormalizedDataRecord[]` (تا ~۶) | لیست preview (آماده برای فاز بعدی UI) |
| Refresh | `GET` مجدد | دکمه «Refresh Pipeline» → refetch query |

فیلدهای `DataPipelineSnapshot` (از `types.ts`):

- متریک ۲۴ساعته: `totalRequests24h`, `passed24h`, `failed24h`, `pending24h`
- کیفیت تجمیعی: `totalRecords`, `normalizedPercent`
- `lastRefreshed` (ISO)
- `sources[]`: `sourceId`, `name`, `category`, `lastDataType`, `lastStatus` (`success` \| `cached` \| `failed` \| `timeout`), `lastResponseTime?`, `lastChecked?`, `issues?`
- `categories[]`: `categoryId`, `name`, `inflow`, `passRate`

**خارج از scope GAP-012:** Design/i18n. **GAP-003 (Open):** فقط جدول پایدار `data_pipeline_snapshots` + history/automation ذخیره‌شده در DB.

---

## ۲. Backend موجود (مرتبط)

| Method | Path | نقش برای Pipeline | کافی برای UI؟ |
|--------|------|-------------------|----------------|
| `GET` | `/api/v1/data-sources` | لیست منابع (Sources tab) | خیر — snapshot تجمیعی نمی‌دهد |
| `GET` | `/api/v1/data-sources/state` | آمار کلی Hub (`totalSources`, `recentLogs`, …) | خیر — شکل `DataPipelineSnapshot` نیست |
| `GET` | `/api/v1/data-sources/stats` | `total_sources`, `logs_24h`, … | خیر — فقط شمارش خام |
| `GET` | `/api/v1/data-sources/health` | سلامت DB/منابع | Health tab |
| `GET` | `/api/v1/data-sources/collected` | صفحه‌بندی `collected_data` | جزئی — نیاز به چند round-trip و join سمت کلاینت |
| `GET` | `/api/v1/data-sources/collected/:id` | یک رکورد | جزئی |
| `GET` | `/api/v1/collected-data` | فیلتر/صفحه‌بندی `collected_data` + `normalized_data` | جزئی — همان مشکل تجمیع |
| `GET` | `/api/v1/collected-data/deduplication/stats` | dedup | خیر |
| `GET` | `/api/v1/data-categories` | دسته‌ها | جزئی — بدون inflow/passRate ۲۴h |

**وضعیت قبلی فرانت:** `buildPipelineSnapshot` + `fetchDataHubState` (IndexedDB)؛ `useDataHub` به `fetchDataPipelineSnapshot` اشاره می‌کرد در حالی که در `api.ts` export نبود.

---

## ۳. Endpoint پیشنهادی (پیاده‌سازی این فاز)

### `GET /api/v1/data-sources/pipeline`

**Auth:** `authenticate` + `readRateLimiter`  
**منبع داده:** `collected_data`, `data_sources`, `data_categories` (بدون migration جدید)

**Response `200`:**

```json
{
  "snapshot": {
    "lastRefreshed": "2026-05-24T12:00:00.000Z",
    "totalRequests24h": 120,
    "passed24h": 100,
    "failed24h": 5,
    "pending24h": 15,
    "totalRecords": 5000,
    "normalizedPercent": 87.5,
    "sources": [ { "sourceId": "…", "name": "…", "category": "…", "lastDataType": "rss", "lastStatus": "success", "lastChecked": "…", "issues": [] } ],
    "categories": [ { "categoryId": "…", "name": "…", "inflow": 40, "passRate": 92.5 } ]
  },
  "history": [
    { "id": "pipeline-hour-2026-05-24T11:00:00.000Z", "generatedAt": "…", "snapshot": { "…": "ساده‌شده از تجمیع ساعتی collected_data" } }
  ],
  "normalizationSummary": {
    "totalProcessed": 5000,
    "passed": 4375,
    "warnings": 100,
    "rejected": 525,
    "lastProcessedAt": "…"
  },
  "normalizedData": [ { "id": "…", "sourceId": "…", "category": "…", "dataType": "…", "tags": [], "payload": {}, "qualityScore": 90, "issues": [], "status": "ready", "receivedAt": "…", "normalizedAt": "…" } ]
}
```

**قوانین نگاشت (backend):**

- `totalRequests24h` = تعداد `collected_data` در ۲۴h
- `passed24h` = `status = 'processed'` و `normalized_data IS NOT NULL`
- `failed24h` = `status = 'error'`
- `pending24h` = `status = 'pending'`
- `lastStatus` per source: `processed`→`success`, `pending`→`timeout`, `error`→`failed`
- `history`: حداکثر ۱۲ سطل ساعتی از `collected_data` در ۲۴h (تا جدول snapshot پایدار اضافه شود — GAP-003)

**خطاها:** `500` + `{ "error": "…" }` — UI `ApiWrapper` + Retry

**خالی:** snapshot با `totalRecords: 0` و آرایه‌های خالی؛ UI empty state

---

## ۴. Done (Pipeline — GAP-012)

- [x] هیچ `buildPipelineSnapshot` / `fetchDataHubState` برای **دادهٔ اصلی** تب Pipeline
- [x] `usePipelineQuery` → `GET /api/v1/data-sources/pipeline`
- [x] Demo در `DataHub_DEMOS.md` (success + failure)
- [x] SSOT: `dataHub.pipeline` → **Implemented** (history پایدار جدول → GAP-003)
