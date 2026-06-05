# DataHub Pipeline Fix 1 — DH-PIPELINE-FIX-1-VERIFY

> **Date:** 2026-06-05  
> **Scope:** Collector-linked Telegram status alignment + normalized preview source names

---

## Status model (Pipeline Source Quality Board)

| Source type | Logic |
|-------------|-------|
| Telegram collector-linked | Reuse `resolveCollectorOperationalStatus` + `batchTelegramCollectorEnrichment` |
| operational `active` | `lastStatus: success`, label Active |
| operational `pending` | `lastStatus: cached`, label Pending ingestion |
| operational `linked` | `lastStatus: cached`, label Linked |
| operational `error` | `lastStatus: failed`, label Error |
| RSS/API / bot-pull | Unchanged fetch/collected_data semantics (incl. true Timeout) |

Optional `operationalStatus` on pipeline source DTO drives UI labels (same i18n as Data Sources).

---

## Before / after

| Source | Before | After |
|--------|--------|-------|
| BBCPersian | `lastStatus: timeout` | `lastStatus: cached`, `operationalStatus: pending` |
| DIRHAM_RATE(U.A.E) | `lastStatus: timeout` | `lastStatus: cached`, `operationalStatus: pending` |
| eghtesaad24 (RSS) | `lastStatus: timeout` | `lastStatus: timeout` (unchanged) |

### Normalized preview

| | Before | After |
|---|--------|-------|
| Source column | UUID only | `sourceName` (e.g. اقتصاد 24 دلار و ارز) + `sourceId` in tooltip |
| Uncategorized | Present (Phase 1) | Still present ✓ |

---

## API verification

`GET /api/v1/data-sources/pipeline` — 200

- `timeoutTelegramCollector` with active/pending/linked operational status: **0**
- `normalizedData[0].sourceName`: populated

---

## Build

`npm run build` — **Pass**

## Browser

`test-results/dh-pipeline-fix1/pipeline-fix1.png`

---

## Rollback

Revert commit; no migration. Pipeline reverts to fetch-only timeout semantics.
