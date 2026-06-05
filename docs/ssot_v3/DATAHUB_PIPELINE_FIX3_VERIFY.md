# DataHub Pipeline Fix 3 — DH-PIPELINE-FIX-3-VERIFY

> **Date:** 2026-06-05  
> **Scope:** Replace misleading Source Quality Board `Timeout` with accurate pipeline source statuses (DH-PIPELINE-QA-2 follow-up)

---

## Status model

| Internal `lastStatus` | UI label |
|----------------------|----------|
| `success` | Success |
| `pending_normalization` | Pending normalization |
| `no_data` | No data yet |
| `fetch_error` | Fetch error |
| `fetch_timeout` | Fetch timeout |
| `inactive` | Inactive |
| `collector_active` | Active |
| `collector_pending` | Pending ingestion |
| `collector_linked` | Linked |
| `collector_error` | Collector error |

Legacy API values (`failed`, `cached`, `timeout`) remain in schema for backward compatibility but are no longer emitted by the snapshot builder.

Optional `statusHint` i18n key provides tooltip text on status pills.

---

## Before / after (verified sources)

| Source | Before (QA-2) | After |
|--------|---------------|-------|
| eghtesaad24 | Timeout | **No data yet** (`no_data`) |
| eghtesaad24 دلار و ارز | Success | **Success** (`success`) |
| BBCPersian | Success (cached/active) | **Active** (`collector_active`) |
| DIRHAM_RATE(U.A.E) | Pending ingestion (cached) | **Pending ingestion** (`collector_pending`) |
| taxonomy-test-signals-* | Timeout | **Inactive** (`inactive`) |
| جمع آوری داده | Error (failed) | **Collector error** (`collector_error`) |

Global: **`timeout` count in pipeline snapshot = 0** (was 7 incl. eghtesaad24 + 6 taxonomy fixtures).

---

## Files changed

| File | Change |
|------|--------|
| `backend/services/pipelineSourceQualityStatus.js` | New status resolution module |
| `backend/services/dataPipelineSnapshot.js` | SQL + snapshot wiring, `statusHint` |
| `backend/services/telegramCollectorSourceStatus.js` | Collector → `collector_*` statuses |
| `backend/schemas/dataHubSchemas.js` | Extended `lastStatus` enum + `statusHint` |
| `backend/__tests__/unit/pipelineSourceQualityStatus.test.js` | Unit tests |
| `types.ts` | `PipelineSourceQualityStatus` type |
| `components/.../PipelinePanel.tsx` | Labels, filter, tooltips |
| `components/.../dataHubUi.tsx` | `StatusPill` title prop |
| `deploy/green/locales/en.json`, `fa.json` | i18n |
| `deploy/blue/locales/en.json`, `fa.json` | i18n |

---

## Build

`npm run build` — **Pass**

## Unit tests

`npm test -- __tests__/unit/pipelineSourceQualityStatus.test.js` — **10/10 Pass**

## API verification

`GET /api/v1/data-sources/pipeline` — **200**

All five targeted checks pass (see `test-results/dh-pipeline-fix3/report.json`).

## Browser

Screenshot: `test-results/dh-pipeline-fix3/pipeline-fix3.png`

- "No data yet" visible for eghtesaad24
- "Pending ingestion" visible
- No generic "Timeout" misuse on board

---

## Rollback

Revert commit; no migration. Pipeline reverts to legacy timeout/cached/failed mapping.
