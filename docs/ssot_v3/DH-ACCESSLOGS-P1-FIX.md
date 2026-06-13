# DH-ACCESSLOGS-P1-FIX

**Task:** DH-ACCESSLOGS-P1-FIX-AND-VERIFY  
**Date:** 2026-06-08  
**RCA:** [DH-ACCESSLOGS-P1-RCA.md](./DH-ACCESSLOGS-P1-RCA.md)

---

## Root cause summary

| Issue | Root cause | Fix |
|-------|------------|-----|
| Only 1 row in UI | **Outcome A** — table had 1 row (manual probe); writers sparse, no fetch-success logging | Added `logFetchSuccess` in `dataFetcher.js`; verified writers insert correctly |
| Status badges partial mismatch | **Outcome E** — API returned `{success, error, warning}` | Remapped to `{success, cached, failed, timeout}` |
| Source column UUID | **Outcome E** — no JOIN to `data_sources.name`; UI rendered `sourceId` | API returns `sourceName`; UI shows name with `Unknown Source` fallback |
| Broken filter layout | `SELECT_CLASS` uses `w-full` in cramped flex row | Responsive 3-row grid layout in `LogsPanel.tsx` |
| Rows not inspectable | No click handler / modal | `AccessLogDetailModal` with metadata JSON viewer + Open Source |

---

## Phase B — Changes

### B1 — Filter layout (`LogsPanel.tsx`)

- Row 1: Telegram-only toggle
- Row 2: responsive grid `[Source] [Agent] [Status]` (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`)
- Row 3: `[Reset] [Export CSV]` right-aligned
- Status select uses `FILTER_SELECT_CLASS` (no full-width stretch)

### B2 — Source name resolution (`dataHubAccessLogs.js`)

- `LEFT JOIN data_sources ds ON ds.id = l.source_id`
- Response includes `sourceId` + `sourceName`
- UI displays `sourceName` → fallback `Unknown Source` (never raw UUID when name missing)

### B3/B4 — Log details modal (`AccessLogDetailModal.tsx`)

- Click row opens modal: Source, Action, Status, Message, Execution Time, Created At, Metadata
- Metadata pretty-printed in scrollable `<pre>`

### B5 — Open Source (`DataHubTab.tsx`)

- Modal footer **Open Source** → `setActiveView('sources')` + `setEditingSource(source)` when found

### Fetch success logging (`dataFetcher.js`)

- One row per fetch on success (`action: fetch`, `status: success`)
- Collector skip path also logged
- Fetch errors include `executionTimeMs`

### Schema / types

- `types.ts` — `DataAccessLog` extended
- `dataHubSchemas.js` — validation updated
- `dataAccessLogsApi.ts` — `AccessLogsStatusCounts` keys aligned

---

## API samples

### Before (production, 2026-06-08 RCA)

```json
{
  "data": [{
    "id": "58edbc8c-6808-4c38-afe4-2d0b48457f42",
    "timestamp": "2026-06-05T16:48:11.748Z",
    "agentId": "system",
    "sourceId": "ed0fb136-d20f-46f6-97aa-e70d2605cfef",
    "dataType": "fetch",
    "status": "success",
    "responseTime": 842
  }],
  "pagination": { "total": 1, "limit": 100, "offset": 0, "hasMore": false },
  "statusCounts": { "success": 1, "error": 0, "warning": 0 }
}
```

Note: no `sourceName`, `action`, `message`, or `metadata`.

### After (post-fix, `listDataHubAccessLogs` 2026-06-08)

```json
{
  "statusCounts": {
    "success": 4,
    "cached": 0,
    "failed": 1,
    "timeout": 1
  },
  "data": [{
    "sourceId": "8175957c-26a8-4544-b501-1a25a6e31afa",
    "sourceName": "آژانس خبری رکنا | Rokna NEWS Agency",
    "action": "fetch",
    "status": "success",
    "message": "DH-ACCESSLOGS-P1 verify: fetch success",
    "metadata": { "new_items": 3, "duration_ms": 504 },
    "responseTime": 504
  }]
}
```

---

## Phase C — Logging verification

| Event | Writer | Evidence |
|-------|--------|----------|
| Source update | `data-sources.js` → `source_update` | Row inserted via verify script |
| Source restore | `data-sources.js` → `source_restore` | Row inserted via verify script |
| Fetch success | `dataFetcher.js` → `fetch` | Row inserted; `new_items` in metadata |
| Fetch failure | `dataFetcher.js` → `fetch_error` | Row inserted; UI status `failed` |
| Collector health | `healthMonitoringService.ts` / verify | Row inserted; `warning` → UI `timeout` |

### DB counts (post-verify)

| Metric | Value |
|--------|-------|
| Total | **6** (was 1) |
| Last 24h | **5** |

---

## Tests

```bash
cd backend && npm test -- --testPathPattern=dataHubAccessLogs
```

- JOIN + `sourceName` mapping
- `statusCounts` UI keys
- i18n labels for modal

---

## Screenshots

| | Path |
|---|------|
| Before | UI showed 1 row, UUID in Source column, stretched Status filter (see RCA) |
| After | Rebuild + `pm2 reload titan-backend`; open DataHub → Access Logs tab |

> Capture after deploy: filter grid layout, named sources, row detail modal with metadata JSON.

---

## Files changed

- `backend/services/dataHubAccessLogs.js`
- `backend/services/dataFetcher.js`
- `backend/schemas/dataHubSchemas.js`
- `backend/__tests__/unit/dataHubAccessLogs.test.js`
- `components/ai/AIManager/tabs/DataHub/LogsPanel.tsx`
- `components/ai/AIManager/tabs/DataHub/modals/AccessLogDetailModal.tsx`
- `components/ai/AIManager/tabs/DataHubTab.tsx`
- `components/ai/AIManager/tabs/DataHub/hooks/useDataHub.ts`
- `services/dataAccessLogsApi.ts`
- `types.ts`
- `deploy/blue|green/locales/en.json`, `fa.json`

---

## Commits

| Commit | Description |
|--------|-------------|
| `4f7f7da` | DH-ACCESSLOGS-P1 — API sourceName JOIN, statusCounts, UI layout, detail modal, fetch-success logging, tests, docs |
