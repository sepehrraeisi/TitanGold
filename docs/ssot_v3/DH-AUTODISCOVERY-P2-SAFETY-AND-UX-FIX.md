# DH-AUTODISCOVERY-P2 — Safety & UX Fix

**Task:** DH-AUTODISCOVERY-P2-SAFETY-AND-UX-FIX  
**Depends on:** DH-AUTODISCOVERY-P1-RCA.md (verdict: BROKEN / UNSAFE)

## Summary

Fixed Auto Discovery dedupe false positives, integrated P2 duplicate URL guard on approval, added Telegram identity guard, improved scan/history/suggestions UX, and added `ignored` suggestion status.

## Before / After

| Scenario | Before (P1) | After (P2) |
|----------|-------------|------------|
| `t.me/@crypto_signals_test` vs `t.me/Rokna_news` | Duplicate (host `t.me`, conf 82) | **Not duplicate** — distinct Telegram identity |
| `eghtesaad24.ir/fa/news/...` vs RSS feed same domain | Duplicate (hostname) | **Not duplicate** — weak hostname hint only |
| Exact RSS URL `.../fa/rss/12` | Duplicate | **Still duplicate** (normalized URL exact match) |
| Approve suggestion | Direct `INSERT data_sources` | **P2 guard** — `409 DUPLICATE_ACTIVE_URL` / `DUPLICATE_ACTIVE_TELEGRAM` |
| History tab | API endpoint hint text | **Table** with scan metrics + View details |
| Scan banner | `+0 · duplicates 1 · blocked 0` | Candidates, new suggestions, duplicates, blocked + detail list |
| `pending_approval` label | Raw i18n key | Translated EN/FA |
| Suggestion ignore | N/A | `POST /suggestions/:id/ignore` → `status=ignored` |
| Scan when disabled | UI only | **Backend** rejects with `DISCOVERY_DISABLED` |

## Files Changed

### Backend
- `backend/utils/urlDuplicateNormalization.js` — `normalizeTelegramChannelIdentity()`
- `backend/utils/discoveryDedupe.js` — exact Telegram identity + normalized URL dedupe; hostname weak hint only
- `backend/services/dataSourceUrlDuplicateService.js` — `evaluateTelegramDuplicateGuard()`
- `backend/services/datahubDiscoveryService.js` — scan details, enabled gate, approve guards, ignore, `getScanById`
- `backend/routes/data-hub-discovery.js` — `GET /scans/:id`, `POST /suggestions/:id/ignore`
- `backend/schemas/datahubDiscoverySchemas.js` — `ignored` status, `allow_duplicate_url` on approve
- `backend/database/migrations/038_discovery_ignored_status.sql`
- `backend/__tests__/unit/datahubDiscovery.test.js`

### Frontend
- `services/dataHubDiscoveryApi.ts` — scan detail types, history, ignore, approve override
- `hooks/useDataHubDiscovery.ts` — history + scan detail hooks
- `components/.../AutoDiscoveryConfig.tsx` — full UX overhaul
- `components/.../DiscoveryRuleModal.tsx` — API i18n
- `deploy/blue/locales/en.json`, `fa.json` — P2 keys

## API Examples

### POST `/api/v1/data-hub/discovery/scan`

**Response (excerpt):**
```json
{
  "scan_id": "uuid",
  "candidates_scanned": 1,
  "added": 1,
  "duplicates": 0,
  "blocked": 0,
  "skipped": 0,
  "duplicate_details": [],
  "new_suggestions": [
    {
      "id": "uuid",
      "suggested_name": "Test Crypto Signals",
      "suggested_url": "https://t.me/@crypto_signals_test",
      "suggested_type": "telegram",
      "discovery_source": "telegram",
      "priority_score": 72.5
    }
  ]
}
```

### POST `/api/v1/data-hub/discovery/suggestions/:id/approve`

**Blocked (duplicate):**
```json
{
  "error": "This source URL already exists.",
  "code": "DUPLICATE_ACTIVE_URL",
  "duplicates": [{ "id": "...", "name": "...", "url": "..." }]
}
```

**Override (explicit):**
```json
{ "allow_duplicate_url": true }
```

### GET `/api/v1/data-hub/discovery/history?limit=20`

```json
{
  "scans": [
    {
      "id": "uuid",
      "status": "success",
      "candidates_scanned": 3,
      "added_count": 1,
      "duplicate_count": 2,
      "blocked_count": 0,
      "started_at": "...",
      "finished_at": "..."
    }
  ]
}
```

### GET `/api/v1/data-hub/discovery/scans/:id`

Returns `scan`, `duplicate_details`, `new_suggestions`, `suggestions` for that scan.

### POST `/api/v1/data-hub/discovery/suggestions/:id/ignore`

```json
{ "review_note": "optional" }
```

## Rules UX Behavior (documented)

- Scan allowed when **discovery enabled** (UI + backend).
- **0 rules:** warning banner shown; scan still runs on **built-in candidates** (crawler `collected_data` URLs + unlinked `telegram_channels`).
- Rules add HTTP seed URL candidates only.

## Tests

```bash
cd backend && npx jest __tests__/unit/datahubDiscovery.test.js
```

12 tests: Telegram/RSS dedupe, approve guard, history/detail, i18n, component wiring.

## Verification Script Output

```
TG_FALSE_POSITIVE_FIXED true true
ARTICLE_NOT_DUP true true
EXACT_RSS_DUP true true
```

## Rollback Plan

1. Revert commit (see hash below).
2. Optional DB: restore previous status check (remove `ignored` from constraint) — existing rows unaffected.
3. No discovery rows deleted; no scheduler/pipeline changes.

---

*Do not delete existing 214 `duplicate` suggestion rows — they remain as historical audit.*
