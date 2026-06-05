# DataHub Telegram → Pipeline Transfer (DH-PIPELINE-P0-ARCH-1)

High-throughput bridge from `telegram_messages` (Telegram Collector) into `collected_data` (Data Pipeline UI source of truth).

## Architecture

```
Telegram Collector → telegram_messages (is_processed=false)
                              ↓
              transferTelegramMessagesToPipeline()  [scheduler / manual API]
                              ↓
         channel→data_source map + dedupe + filter rules
                              ↓
                    collected_data (status=pending)
                              ↓
              telegram_messages.is_processed=true (on success/skip/dedupe)
```

**Components**

| Piece | Location |
|-------|----------|
| Transfer worker | `backend/services/telegramPipeline.js` |
| Scheduler (5 min, batch 500) | `backend/engine/scheduler.js` → `titan-engine-worker` (PM2) |
| Manual trigger | `POST /api/v1/data-sources/telegram-transfer-messages` |
| Cached ingestion filters | `createIngestionFilterEvaluator()` in `datahubFilterRulesService.js` |
| DB indexes | `backend/database/migrations/035_telegram_transfer_indexes.sql` |

**Concurrency**

- In-memory single-flight flag (per process)
- PostgreSQL advisory lock `8392741` (cross-worker)
- Sub-batches of 100 rows per transaction; per-row `SAVEPOINT` so one bad row does not abort the batch

## Phase 0 audit (pre-implementation)

### Table / volume snapshot (2026-05-29)

| Metric | Count |
|--------|------:|
| `telegram_messages` total | ~4.2M |
| `telegram_messages` unprocessed backlog | ~3.98M |
| `processed_telegram_messages` | ~4.2M (separate legacy path; not Pipeline UI) |
| `collected_data` total (before fix) | ~379 |
| Daily Telegram intake | ~55k/day |

### Root cause of ~1 message / 5 minutes

1. **Tiny batch** — old code moved ~50 messages per 5-minute scheduler tick with N+1 queries per row.
2. **Head-of-line blocking** — skipped rows (no source, filter, duplicate) were not always marked `is_processed`, so the same rows were re-selected forever.
3. **Separate tables** — `processed_telegram_messages` was populated by another worker; Pipeline UI reads only `collected_data`.
4. **No batch dedupe / filter cache** — per-row duplicate lookups and rule loads.

### Bottleneck verdict

Primary: **batch size + per-row processing + unmarked skips**. Not source mapping (all backlog rows had channel→source matches in audit). Dedupe and filters were secondary once throughput was fixed.

### Migration / indexes

**Applied:** `035_telegram_transfer_indexes.sql`

- Partial index on unprocessed messages for FIFO selection
- Unique expression index on `(source_id, raw_data->>'telegram_message_id')` for dedupe safety

No column migrations required.

## Transfer policy

1. Select up to **500** unprocessed rows (`TELEGRAM_TRANSFER_DEFAULT_BATCH`), oldest `telegram_created_at` first.
2. Resolve `data_sources` by `config.channelId` or `config.channelUsername`.
3. Evaluate ingestion filter rules once per run (cached).
4. Insert into `collected_data`:
   - `status`: `pending`
   - `raw_data` / `normalized_data`: Telegram envelope (basic normalization only)
   - `metadata`: `telegram_message_id`, `telegram_channel_id`, `transferred_at`, `pipeline_version`
   - Category comes from the mapped **source**, not created ad hoc
5. Mark `telegram_messages.is_processed=true` only after:
   - successful insert, **or**
   - confirmed duplicate, **or**
   - skip (no source / filtered)
6. **Do not** mark processed on insert errors (logged, retried next run).

## Dedupe policy

- **Primary:** `content_hash = SHA256(sourceId:telegramChannelId:messageId)`
- **Secondary:** unique index `idx_collected_data_telegram_msg_dedupe` on `(source_id, raw_data->>'telegram_message_id')`
- Duplicate → count as `duplicates`, mark source message processed

## Data sanitization

- Strip `\u0000` from text fields
- **Title truncation** uses code-point-safe `truncateText()` (avoids splitting UTF-16 surrogate pairs — PostgreSQL jsonb rejects lone surrogates)

## Scheduler behavior

| Setting | Value |
|---------|-------|
| PM2 process | `titan-engine-worker` |
| Interval | 5 minutes (`TELEGRAM_PIPELINE_INTERVAL_MS` optional override) |
| Batch size | 500 (`TELEGRAM_TRANSFER_DEFAULT_BATCH`) |
| Expected throughput | ~500 inserts/run ≈ **6k/hour** at steady state (when backlog exists) |
| Overlap guard | in-memory + advisory lock |

At 6k/hour, ~3.98M backlog clears in ~27 days while ~55k/day new intake continues — backlog shrinks once transfer exceeds net intake.

## Observability

Structured log per run:

`batchSize`, `selected`, `inserted`, `duplicates`, `skipped_no_source`, `skipped_filtered`, `errors`, `durationMs`, `backlogRemaining`, `pipelineVersion`

Programmatic: `getTelegramTransferBacklogStats()`

## Verification evidence (2026-06-05)

### Counts

| Metric | Before (task start) | After (local verify) |
|--------|--------------------:|---------------------:|
| `telegram_messages` unprocessed | ~3,984,506 | ~3,984,146 |
| `collected_data` total | ~379 | ~2,099 |
| `collected_data` telegram-linked | ~248 | ~1,716 |
| BBCPersian `collected_data` | 1 | 5 |

### Transfer runs (post-fix)

| Run | selected | inserted | duplicates | errors | duration |
|-----|---------:|---------:|-----------:|-------:|---------:|
| 500 batch (surrogate fix) | 500 | 499 | 1 | 0 | ~1.0s |
| 500 batch (follow-up) | 500 | 500 | 0 | 0 | ~1.0s |

Prior run before surrogate fix: 451 inserted / 49 errors (title truncation splitting emoji pairs).

### Pipeline UI / API

- `buildDataPipelineView().snapshot.totalRecords` = **2,099** (was ~379)
- BBCPersian appears in Pipeline sources (`lastDataType: telegram`, `lastStatus: success`)
- Build: `npm run build` ✓

### Safety

- No env changes
- No destructive deletes
- `TELEGRAM_PUBLISHER_DRY_RUN` untouched
- Failed rows remain unprocessed for retry

## Known limits

- Normalization worker not in scope — rows stay `status=pending`; Pipeline "Passed" stays 0 until normalization exists
- Backlog count query is expensive on 4M rows (~400–500ms)
- `DIRHAM_RATE(U.A.E)` may still show 0 `collected_data` if unprocessed messages for that channel are deeper in FIFO queue
- Single scheduler batch does not drain 55k/day alone; increase batch or interval only with DB capacity review

## Rollback plan

1. **Code:** revert the DH-PIPELINE-P0-ARCH-1 commit; `pm2 reload titan-backend titan-engine-worker`
2. **Data:** do **not** delete inserted `collected_data` unless explicitly approved
3. **Duplicates (if any):**
   ```sql
   SELECT source_id, raw_data->>'telegram_message_id' AS msg_id, COUNT(*)
   FROM collected_data
   WHERE raw_data ? 'telegram_message_id'
   GROUP BY 1, 2
   HAVING COUNT(*) > 1;
   ```
4. **Processed flags:** do **not** reset `telegram_messages.is_processed` without approval
5. **Indexes:** `035` indexes are safe to leave; drop only if needed:
   ```sql
   DROP INDEX IF EXISTS idx_telegram_messages_unprocessed_created;
   DROP INDEX IF EXISTS idx_collected_data_telegram_msg_dedupe;
   ```
