# DH-DATASOURCES-P2 — Duplicate URL Guard

## RCA reference

Builds on [DH-DATASOURCES-P1-DUPLICATE-URL-AUDIT](DH-DATASOURCES-P1-DUPLICATE-URL-AUDIT.md) (read-only). Production RSS duplicate: `eghtesaad24 دلار و ارز` + `اقتصاد 24 دلار و ارز` → `https://eghtesaad24.ir/fa/rss/12`.

## Design

- **Normalize** URL for `rss`, `web`, `api` only (not Telegram).
- **Detect** duplicates via shared service; enrich list + crawlers.
- **Block** new/updated **active** sources with duplicate URL (`409 DUPLICATE_ACTIVE_URL`).
- **Override** via `allow_duplicate_url: true` + audit log.
- **Warn** on inactive duplicates (save allowed).
- **No** source deletion, `collected_data` changes, or scheduler changes.

## API

### `GET /api/v1/data-sources/duplicate-urls`

```json
{
  "groups": [{
    "type": "rss",
    "normalizedUrl": "https://eghtesaad24.ir/fa/rss/12",
    "severity": "high",
    "activeCount": 2,
    "sources": [...]
  }]
}
```

### `GET /api/v1/data-sources/check-duplicate-url?type=rss&url=...`

```json
{
  "normalizedUrl": "https://eghtesaad24.ir/fa/rss/12",
  "duplicates": [...],
  "hasActiveDuplicate": true,
  "hasInactiveDuplicate": false
}
```

### `POST /api/v1/data-sources` (blocked)

```json
{
  "error": "This source URL already exists.",
  "code": "DUPLICATE_ACTIVE_URL",
  "duplicates": [...]
}
```

### Override

```json
{ "name": "...", "type": "rss", "url": "...", "allow_duplicate_url": true }
```

## Rollback

1. Revert commit.
2. `pm2 reload titan-backend`.
3. No DB migration to undo — enrichment fields are response-only.

## Files changed

| Area | Files |
|------|-------|
| Normalize | `backend/utils/urlDuplicateNormalization.js` |
| Service | `backend/services/dataSourceUrlDuplicateService.js` |
| Routes | `backend/routes/data-sources.js` |
| Schemas | `backend/schemas/dataHubSchemas.js` |
| Crawlers UI enrich | `backend/services/datahubCrawlersService.js` |
| API client | `services/dataSourcesApi.ts` |
| UI | `CreateSourceModal.tsx`, `DataSourcesPanel.tsx`, `WebCrawlerConfig.tsx` |
| i18n | `deploy/blue|green/locales/en.json`, `fa.json` |
| Tests | `backend/__tests__/unit/dataSourceUrlDuplicate.test.js`, `services/dataSourcesDuplicate.test.ts` |
