# DH-TELEGRAM-COLLECTOR-P7.4 — Latency & Last Processed Metric Polish

**Phase:** P7.4  
**Date:** 2026-06-30  
**Prior:** [P7.3 Proxy Route Fix](./DH-TELEGRAM-COLLECTOR-P7.3-PROXY-ROUTE-REGRESSION-FIX.md)

---

## Human QA report

After P7.3 route repair, collector UI was **Healthy** but two toolbar metrics showed raw placeholders:

| Metric | Before |
|--------|--------|
| Average latency | `—` |
| Last Processed | `-` |

---

## RCA

| Metric | Root cause | Class |
|--------|------------|-------|
| **Average latency** | UI read `telegramCollectorState.healthSummary.avgLatencyMs` from IndexedDB mock (`channel.fetchLatencyMs`), not live collector data. In-memory sync metrics empty after PM2 restart. | **C** field mismatch + **A** no in-memory data |
| **Last Processed (analytics overview)** | `loadSystemStatsForRange(24)` hardcoded `last_processed_at: null` despite DB having rows | **B** API bug |
| **Last Processed (collector toolbar)** | Not wired; no field on `/health` | **B** missing API field |

DB proof (live):

```text
telegram_pipeline_stats.avg_processing_time_ms ≈ 1310
MAX(processed_telegram_messages.created_at)    ≈ 2026-06-30T10:36:14Z
```

---

## Fix summary

### Backend — collector `/api/telegram-collector/health`

Added fast runtime snapshot via `telegram-collector/dist/utils/runtimeMetrics.js`:

| Field | Source priority |
|-------|-----------------|
| `averageLatencyMs` | in-memory channel sync metrics → `telegram_pipeline_stats.avg_processing_time_ms` |
| `lastProcessedAt` | `processed_telegram_messages` → `telegram_messages.processed_at` → polling `lastCycle` |
| `lastProcessedSource` | table/source label |
| `averageLatencySource` | `collector_sync_metrics` or `telegram_pipeline_stats` |

### Backend — `/api/v1/telegram/agents/summary`

Extracted `backend/services/telegramSystemStats.js`; 24h path now queries `MAX(created_at)` instead of returning `null`.

### Frontend

- `formatCollectorAvgLatency` / `formatCollectorLastProcessed` — friendly empty states, no bare dash
- `TelegramCollectorMetrics` — StatusPill + hint text; added Last Processed card
- `TelegramPanel` — `useCollectorHealthQuery()` for live metrics
- `TelegramDataPanel` — friendly Last Processed on overview
- i18n keys in blue/green `en.json` / `fa.json`

---

## Live endpoint proof

```bash
GET /api/telegram-collector/health
```

```json
{
  "averageLatencyMs": 1317,
  "averageLatencySource": "telegram_pipeline_stats",
  "lastProcessedAt": "2026-06-30T10:36:14.068Z",
  "lastProcessedSource": "processed_telegram_messages"
}
```

---

## Tests & build

| Check | Result |
|-------|--------|
| `src/__tests__/telegramCollectorMetricPolish.test.ts` | 3 passed |
| `backend/__tests__/unit/telegramSystemStats.test.js` | 1 passed |
| `npm run build` | success |

---

## UI rules applied

- No bare `—` or `-` for empty metrics
- `StatusPill` (neutral) for intentional empty states
- Helper copy under metric cards (`hint` prop on `MetricCard`)
- Empty latency: **"No recent sync latency"**
- Empty last processed: **"No recent processed message"**

---

## Final verdict

**REAL WORKING — Telegram Collector remains CLOSED**

Metrics are populated from live DB/pipeline when data exists, or show intentional explanatory empty states. Collector Status stays Healthy; routes and write auth from P7.2/P7.3 unchanged.
