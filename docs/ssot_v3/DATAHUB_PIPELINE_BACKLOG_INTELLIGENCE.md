# DataHub Pipeline Backlog Intelligence — DH-PIPELINE-P0-BACKLOG-INTELLIGENCE-1

> **Date:** 2026-06-05  
> **Context:** FIX-3 made Source Quality statuses accurate; pending ingestion still lacked operational depth.

---

## RCA — why "Pending ingestion" was misleading

Both a channel with **368** unprocessed messages and one with **~1.69M** showed the same pill with no queue context.

### Global queue (audit SQL)

```sql
SELECT
  COUNT(*) FILTER (WHERE is_processed = false) AS unprocessed_total,
  MIN(telegram_created_at) FILTER (WHERE is_processed = false) AS oldest,
  MAX(telegram_created_at) FILTER (WHERE is_processed = false) AS newest
FROM telegram_messages;
```

| Metric | Value (2026-06-05) |
|--------|-------------------|
| Unprocessed total | ~3,978,998 |
| Oldest unprocessed | 2026-02-23 |
| Newest unprocessed | 2026-06-05 |

Transfer uses **global FIFO** on `telegram_created_at` — channel position in queue matters as much as local backlog.

### Source mapping

```
telegram_messages.channel_id  →  telegram_channels.id (UUID)
telegram_channels.channel_id  ↔  data_sources.config.channelId (Telegram numeric id)
telegram_channels.username    ↔  data_sources.config.channelUsername
```

Only **collector-linked** sources (`type=telegram`, no bot token, channel registered) receive backlog intel.

---

## Throughput calculation (observed, read-only)

```sql
SELECT COUNT(*)::int AS processed_24h
FROM telegram_messages
WHERE is_processed = true
  AND processed_at > NOW() - INTERVAL '24 hours';
```

| Field | Formula |
|-------|---------|
| `processed24h` | Count above |
| `messagesPerHour` | `max(1, processed24h / 24)` — floor avoids divide-by-zero; **not** a scheduler change |
| `messagesPerDay` | `processed24h` |

**Observed (verify run):** processed24h ≈ **12,453** → **~519 msg/hr**, **~12.5k msg/day**.

---

## Backlog formula (per channel)

| Field | Source |
|-------|--------|
| `backlogCount` | `COUNT(*)` where `channel_id = tc.id AND is_processed = false` |
| `oldestQueuedAt` / `newestQueuedAt` | MIN/MAX `telegram_created_at` of unprocessed rows |
| `messagesAheadInQueue` | Global unprocessed rows **older than** this channel's oldest unprocessed (FIFO position) |
| `queuePositionRank` | Rank among channels with backlog, sorted by oldest unprocessed ASC |
| `estimatedWaitHours` | `(messagesAheadInQueue + backlogCount) / messagesPerHour` |
| `estimatedWaitDays` | `estimatedWaitHours / 24` |

**ETA includes global queue wait**, not only channel-local backlog — critical for accurate ops view.

---

## API payload example

`GET /api/v1/data-sources/pipeline`

```json
{
  "snapshot": {
    "transferThroughput": {
      "processed24h": 12453,
      "messagesPerHour": 518.88,
      "messagesPerDay": 12453,
      "observedWindowHours": 24
    },
    "globalTelegramBacklog": {
      "unprocessedTotal": 3978998,
      "oldestUnprocessed": "2026-02-23T03:05:33.000Z",
      "newestUnprocessed": "2026-06-05T20:21:27.000Z"
    },
    "sources": [
      {
        "name": "DIRHAM_RATE(U.A.E)",
        "lastStatus": "collector_pending",
        "collectorBacklog": {
          "backlogCount": 368,
          "oldestQueuedAt": "2026-02-23T06:41:30.000Z",
          "messagesAheadInQueue": 8984,
          "estimatedWaitHours": 18.02,
          "estimatedWaitDays": 0.75,
          "queuePositionRank": 31
        }
      },
      {
        "name": "⚡️📊قیمت دهی انس 🔔",
        "lastStatus": "collector_active",
        "collectorBacklog": {
          "backlogCount": 1691459,
          "messagesAheadInQueue": 0,
          "estimatedWaitHours": 3259.86,
          "estimatedWaitDays": 135.8,
          "queuePositionRank": 1
        }
      }
    ]
  }
}
```

---

## UI

Pending ingestion pill unchanged. Secondary lines under status:

- Queue: X messages
- Oldest queued: …
- ETA: …
- Queue rank: #N (when ranked)

Sort dropdown: name | backlog | ETA | queue rank.

Screenshot: `test-results/dh-pipeline-backlog-intel-1/pipeline-backlog.png`

---

## Verified channels

| Source | Status | backlogCount | ETA (days) | Rank |
|--------|--------|--------------|------------|------|
| BBCPersian | collector_active | 6,832 | 0.9 | 13 |
| DIRHAM_RATE | collector_pending | 368 | 0.75 | 31 |
| 🥇Teamxry🥇 | collector_pending | 180 | 5.2 | 41 |
| ⚡️📊قیمت دهی انس 🔔 | collector_active | 1,691,459 | 135.8 | 1 |

---

## Files

| File | Role |
|------|------|
| `backend/services/telegramBacklogIntelligence.js` | Throughput + per-channel backlog batch |
| `backend/services/telegramCollectorSourceStatus.js` | `collector_channel_id` for mapping |
| `backend/services/dataPipelineSnapshot.js` | Pipeline wiring |
| `backend/schemas/dataHubSchemas.js` | Zod schemas |
| `components/.../PipelinePanel.tsx` | Details + sort |
| `types.ts` | TS types |

No scheduler/batch/transfer/normalization changes.

---

## Rollback

Revert commit; read-only intelligence layer only.
