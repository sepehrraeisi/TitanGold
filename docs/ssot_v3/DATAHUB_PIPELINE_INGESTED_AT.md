# DataHub Ingestion Timestamps — DH-PIPELINE-P0-INGESTED-AT-1

> **Date:** 2026-06-07  
> **Context:** Throughput RCA found `collected_at` was set to Telegram message date, breaking metrics and retention.

---

## Timestamp semantics

| Field | Meaning | Set by |
|-------|---------|--------|
| `collected_data.collected_at` | **DataHub ingestion time** (insert/transfer/fetch) | `NOW()` / `getIngestionTimestampForInsert()` |
| `metadata.transferred_at` | Telegram transfer ingress time | `telegramPipeline.js` (unchanged) |
| `metadata.telegram_created_at` | Original Telegram message time | `telegramPipeline.js` (unchanged) |
| `raw_data.telegram_created_at` | Original Telegram message time | `telegramPipeline.js` (unchanged) |
| `normalized_data.publishedAt` | Source publication time | Transfer / normalizer / crawlers |
| `metadata.source_published_at` | RSS/crawler item publication time | `datahubCrawlersService.js` |

**Rule:** message published time ≠ DataHub ingestion time.

---

## Changes

| Area | Change |
|------|--------|
| **Telegram transfer** | `collected_at = getIngestionTimestampForInsert()` instead of `telegram_created_at` |
| **Pipeline snapshot** | 24h metrics use `COALESCE(transferred_at, collected_at)`; API adds `ingestedAt`, `publishedAt` |
| **Read model** | Legacy rows: prefer `transferred_at` when `collected_at` is older |
| **RSS/API** | Already used `NOW()` for `collected_at`; crawlers now set `source_published_at` + `publishedAt` |
| **Retention** | `prune_logs` uses `collected_at` — **safe for new rows**; see mitigation below |

---

## RSS/API audit

| Writer | `collected_at` | Source published time |
|--------|----------------|------------------------|
| `dataFetcher.js` | `NOW()` ✅ | Stored in `raw_data` (item fields) |
| `datahubCrawlersService.js` | `NOW()` ✅ | `metadata.source_published_at`, `normalized_data.publishedAt` |
| `routes/collected-data.js` | `NOW()` ✅ | Caller-provided in raw/normalized |
| `telegramPipeline.js` | **Fixed** → ingestion time | `metadata.telegram_created_at`, `normalized_data.publishedAt` |

---

## Retention safety

**Policy:** `DELETE FROM collected_data WHERE collected_at < NOW() - 60 days` (`018_log_retention_system.sql`).

| Row cohort | Risk |
|------------|------|
| **New transfers (post-fix)** | Safe — `collected_at` = ingestion time |
| **Legacy Telegram (~79k rows)** | `collected_at` = message date (Feb–May 2026) — **eligible for prune** even if recently transferred |

**Mitigation (no deletes in this task):**

1. New rows use correct semantics going forward.
2. Read/metrics use `COALESCE(transferred_at, collected_at)` for legacy accuracy.
3. Before enabling aggressive prune, either:
   - bounded backfill of `collected_at` from `metadata.transferred_at` (requires explicit approval), or
   - temporary retention rule using `GREATEST(collected_at, transferred_at)`.

---

## API fields (`normalizedData[]`)

```json
{
  "ingestedAt": "2026-06-07T12:00:00.000Z",
  "publishedAt": "2026-02-23T10:00:00.000Z",
  "receivedAt": "2026-06-07T12:00:00.000Z"
}
```

`receivedAt` mirrors `ingestedAt` for backward compatibility.

---

## Files changed

- `backend/services/collectedDataTimestamps.js` (new)
- `backend/services/telegramPipeline.js`
- `backend/services/dataPipelineSnapshot.js`
- `backend/services/telegramCollectorSourceStatus.js`
- `backend/services/datahubCrawlersService.js`
- `backend/schemas/dataHubSchemas.js`
- `types.ts`
- `backend/__tests__/unit/collectedDataTimestamps.test.js` (new)
- `backend/__tests__/unit/dataPipelineSnapshotTimestamps.test.js` (new)
