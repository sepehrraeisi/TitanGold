# DataHub Normalization Contract (DH-NORMALIZATION-P0-CONTRACT-1)

Canonical `normalized_data` contract aligned across normalizer, validator, API schemas, and Pipeline read model.

**Normalization worker is still disabled.** `dataPipeline.processPendingData()` is not scheduled. No bulk processing of pending rows.

---

## Phase 0 audit summary

### Field mismatch table (pre-contract)

| Field / concern | Normalizer (legacy) | Validator (legacy) | Zod API schema | Snapshot read | Pipeline worker |
|-----------------|---------------------|--------------------|----------------|---------------|-----------------|
| `timestamp` | RSS/API only | **Required** | Legacy: datetime on `message_id` shape | Fallback `processed_at` | Required for pass |
| `publishedAt` | Telegram | Not accepted | N/A | Used as display fallback | — |
| `source_type` (snake) | RSS/API/webhook | **Required** | `metadata` only in legacy | `row.source_type` | Router used snake |
| `sourceType` (camel) | Missing | Missing | Missing | Missing | — |
| `category` | Implicit in tags | **Not validated** | Not on normalized blob | From `data_sources` | From join row |
| `version` | Missing | Missing | Missing | Ignored | — |
| `status` on failure | — | — | `pending/processed/error` | — | Used invalid `'failed'` |

### Output shape by source type (legacy → v1)

| Source | Legacy keys | v1 canonical |
|--------|-------------|--------------|
| **telegram** | `title`, `content`, `publishedAt`, `metadata.source_type`, `entities`, no `timestamp` | All required minimum + `metadata.telegram*` |
| **rss** | `timestamp`, `source_type`, `url` | `sourceType`, `category`, `version` |
| **api** | `timestamp`, `source_type` | Same |
| **webhook** | `timestamp`, `source_type` | Same |
| **crawler** | Ad-hoc in `datahubCrawlersService` | `sourceType: crawler` via normalizer |

### Downstream consumers

| Consumer | Fields used |
|----------|-------------|
| `dataPipeline.processItem` | Full v1 blob → validate → `UPDATE` → `data_queue` |
| `dataRouter` | `title`, `content`, `sourceType` / `source_type` |
| `buildDataPipelineView` | `coerceReadModel()` → preview title/content/tags/status |
| `datahubAutomationService` | Pipeline preview `qualityScore`, `status`, `normalized_data` payload |
| `GET /api/v1/collected-data` | Filters on `normalized_data` JSON paths |
| Zod create/update | `normalizedDataAcceptSchema` (v1 ∪ legacy ∪ envelope) |

### data_queue

- **Inserted by:** `dataPipeline.processItem()` only (when worker runs).
- **Consumed by:** No active consumer worker found in backend production paths; queue is schema-ready only.

---

## Canonical schema: `datahub.normalized.v1`

```json
{
  "version": "datahub.normalized.v1",
  "title": "string",
  "content": "string",
  "summary": "string | null",
  "sourceType": "telegram | rss | api | webhook | crawler | unknown",
  "sourceId": "uuid | null",
  "sourceName": "string | null",
  "category": "string",
  "language": "string | null",
  "timestamp": "ISO-8601 datetime",
  "publishedAt": "ISO-8601 datetime | null",
  "entities": {},
  "signals": [],
  "tags": [],
  "metadata": {
    "rawStatus": "string | null",
    "ingestionMode": "collector | fetch | manual | unknown",
    "telegramMessageId": "string | null",
    "telegramChannelId": "string | null",
    "telegramChannelUsername": "string | null",
    "normalizedAt": "ISO-8601",
    "normalizerVersion": "dh-norm-contract-1"
  }
}
```

### Required minimum (validator hard fail if missing)

| Field | Rule |
|-------|------|
| `title` | Non-empty after trim |
| `content` | Non-empty after trim |
| `sourceType` | One of allowed enum values (after coercion) |
| `timestamp` | Parseable datetime |
| `category` | Non-empty after trim |

`version` is recommended but missing legacy rows produce **warnings only**.

### Optional (warnings / quality hints only)

- `summary`, `language`, `publishedAt`, `entities`, `signals`, `tags`
- Telegram IDs in `metadata`
- `metadata.quality_score` (future quality engine — not written today)

---

## Source-type mapping

| Source | title | content | timestamp | publishedAt | category | metadata |
|--------|-------|---------|-----------|-------------|----------|----------|
| **telegram** | First line / truncated text | `message_text` | `telegram_created_at` | same | source / `channel_category` | `telegramMessageId`, `telegramChannelId`, `telegramChannelUsername` |
| **rss** | `title` | `description` | `pubDate` or collected | `pubDate` | source category | `guid`, `author` |
| **api** | title/name/subject | body/content/JSON | payload or collected | same | source category | payload metadata |
| **webhook** | payload title | payload content | `receivedAt` | same | source category | payload metadata |
| **crawler** | title or truncated text | content/text | `published_at` / `fetched_at` | same | source category | `crawler_ingest` |

Legacy alias `source_type` is still emitted for router compatibility.

---

## Validator rules

Implementation: `backend/services/validators/dataValidator.js`

```javascript
validateContract(data) → {
  valid: boolean,
  errors: string[],      // hard fail
  warnings: string[],  // legacy / optional metadata
  qualityHints: string[] // future scoring hints
}
```

- Never throws on optional metadata.
- Uses `coerceReadModel()` first so legacy rows validate when minimum fields are derivable.
- Pipeline failure status: **`error`** (not `failed`).

---

## Backward compatibility (read path)

`coerceReadModel(normalized_data)` in `normalizedDataContract.js`:

- Maps `source_type` → `sourceType`
- Maps `timestamp` ← `timestamp` | `publishedAt` | `metadata.normalizedAt`
- Preserves transfer envelopes from `telegramPipeline` without DB mutation
- Exported as `normalizeReadModel()` from `dataPipelineSnapshot.js` for tests

**No migration required** — contract is JSON shape only.

---

## Intentionally not enabled

| Item | Status |
|------|--------|
| `processPendingData()` scheduler | **Disabled** |
| Bulk pending row processing | **Not run** |
| `collected_data.status` changes | **None in this task** |
| Quality scoring engine | **Not implemented** |
| `data_queue` consumer | **Not implemented** |
| `autoNormalize` scheduler flag | Still unused (unchanged) |

---

## Code map

| File | Role |
|------|------|
| `backend/services/normalizers/normalizedDataContract.js` | Version constants, `buildNormalizedV1`, `coerceReadModel` |
| `backend/services/normalizers/dataNormalizer.js` | Per-source mapping → v1 |
| `backend/services/validators/dataValidator.js` | `validateContract()` |
| `backend/services/dataPipeline.js` | Orchestrator (dormant); uses `error` status |
| `backend/services/dataPipelineSnapshot.js` | Read adapter |
| `backend/schemas/dataHubSchemas.js` | `normalizedDataV1Schema`, `normalizedDataAcceptSchema` |
| `backend/__tests__/unit/normalizedDataContract.test.js` | Contract tests |

---

## Worker (implemented)

See [`DATAHUB_NORMALIZATION_WORKER.md`](./DATAHUB_NORMALIZATION_WORKER.md) — `processNormalizationBatch()` scheduled at 1 min / 100 rows. Agent queue wiring remains deferred.

---

## Verification (2026-06-05)

- Unit tests: `normalizedDataContract.test.js`, `dataPipeline.test.js`
- No production rows processed
- No scheduler changes
- Worker remains disabled
