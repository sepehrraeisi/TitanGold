# DH-DATASOURCES-P3 — Duplicate Management

## Context

Builds on P1 audit and P2 guardrails. Operators can now **discover, inspect, disable, and ignore** duplicate URL groups without deleting or merging data.

## UI

### Data Sources → Data Quality · Duplicate URLs

- Summary cards: duplicate groups, active/inactive duplicate sources, high-risk groups
- Expandable group cards with per-source detail
- Actions: View source, Disable source (`is_active=false`), Ignore duplicate
- Filter on All Sources: “Show duplicates only”

### Health Monitoring

- **Data quality** section: Duplicate URL groups count (non-ignored)

### Web Crawlers

- Warning lists sibling source **names** (not just count)

## Ignore duplicate

Stored in `data_sources.config`:

```json
{
  "ignore_duplicate_url": true,
  "ignore_duplicate_url_at": "ISO8601",
  "ignore_duplicate_url_by": "user-uuid"
}
```

- Group ignored when **all** sources in group have flag set
- Ignored groups: severity `info`, excluded from dashboard/health counts
- Reversible via “Stop ignoring” or `POST .../ignore` with `{ "ignore": false }`

## Severity

| Level | Rule |
|-------|------|
| HIGH | >1 active source, same normalized URL |
| MEDIUM | 1 active + inactive duplicates |
| LOW | All inactive |
| INFO | Group fully ignored |

## API

### `GET /api/v1/data-sources/duplicate-urls`

```json
{
  "summary": {
    "duplicateGroups": 1,
    "activeDuplicateSources": 2,
    "inactiveDuplicateSources": 0,
    "highRiskGroups": 1,
    "ignoredGroups": 0
  },
  "groups": [{
    "normalizedUrl": "https://eghtesaad24.ir/fa/rss/12",
    "severity": "high",
    "activeCount": 2,
    "totalCollectedCount": 419,
    "sources": [...]
  }]
}
```

### `POST /api/v1/data-sources/:id/duplicate-url/ignore`

Body: `{ "ignore": true | false }`

### `GET /api/v1/data-sources/health`

Adds `dataQuality.duplicateUrlGroups`.

## Production verification (2026-06-13)

| Check | Result |
|-------|--------|
| RSS group `/fa/rss/12` | severity **high**, 2 active sources |
| Summary highRiskGroups | 1 |
| No data/scheduler changes | confirmed |

## Rollback

```bash
git revert <commit>
pm2 reload titan-backend
npm run build
```

## Files

| Area | Files |
|------|-------|
| Service | `dataSourceUrlDuplicateService.js` |
| Routes | `data-sources.js` |
| UI | `DuplicateUrlsPanel.tsx`, `DataSourcesPanel.tsx`, `HealthPanel.tsx`, `WebCrawlerConfig.tsx` |
| Hooks | `useDataHubState.ts` |
| API | `dataSourcesApi.ts` |
