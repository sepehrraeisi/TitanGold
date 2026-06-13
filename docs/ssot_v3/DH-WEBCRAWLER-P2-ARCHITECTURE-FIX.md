# DH-WEBCRAWLER-P2-ARCHITECTURE-FIX

**Task:** Phase 1 architecture cleanup — RSS duplicate ingestion guardrails  
**Date:** 2026-06-08  
**Audit:** [DH-WEBCRAWLER-P2-ARCHITECTURE-AUDIT](./DH-WEBCRAWLER-P2-ARCHITECTURE-AUDIT.md) (inline in chat)

---

## Architecture decision

| Principle | Decision |
|-----------|----------|
| **Authoritative layer** | **Data Sources** remain system of record (`collected_data.source_id`) |
| **Crawler role** | Linked **execution/profile** layer (website depth, robots, filters, manual test) |
| **RSS default owner** | **dataFetcher** scheduler when `source.is_active` and `config.crawler_mode !== 'crawler'` |
| **RSS crawler writes** | Blocked on non-dry-run unless `force_override` or `crawler_mode: 'crawler'` in source config |
| **Website crawlers** | Unchanged — crawler path remains primary for manual runs |
| **No migration** | Uses existing `data_sources.config` JSONB (`crawler_mode`) |
| **No data deletion** | Guardrails only; historical rows preserved |

### Investigation answers (A–E)

| Item | Finding |
|------|---------|
| **A** Config sufficient? | Yes — `data_sources.config.crawler_mode` can mark crawler-owned RSS without schema migration |
| **B** RSS crawler in UI? | Kept as **manual test tool** (dry-run) + optional override; not primary RSS path |
| **C** Duplicate risk? | `duplicate_risk: true` when RSS + active source + default dataFetcher ownership |
| **D** Safest option | **dataFetcher keeps RSS**; crawler non-dry-run blocked by default |
| **E** Phase 1 scope | Guards + metrics + UI clarity only |

---

## Before / after behavior

| Scenario | Before | After |
|----------|--------|-------|
| RSS + active source, Run now | Writes `collected_data` (duplicate with scheduler) | **Blocked** (409 `RSS_DATAFETCHER_OWNS`) |
| RSS + active source, Dry run | Simulated count only | Same — allowed, labeled "simulated ingest" |
| RSS + active source, Run with override | N/A | Writes after confirm (`force_override: true`) |
| RSS + `config.crawler_mode=crawler` | Duplicate possible | Non-dry-run **allowed** (crawler owns ingestion) |
| Source soft-disabled, Run now | Allowed | **Blocked** (403 `SOURCE_INACTIVE`) |
| Source soft-disabled, Dry run | Allowed | Allowed (no DB writes) |
| Website crawler Run now | Allowed | **Unchanged** |
| With Errors metric | Stale `last_error` on crawler row | Failed runs in **last 24h** from `datahub_crawler_runs` |
| Avg latency | N/A | `AVG(finished_at - started_at)` last 24h |
| Hard delete source | CASCADE deletes crawlers | **Unchanged** (DB FK) |
| Delete crawler | Source untouched | **Unchanged** |

---

## Files changed

| File | Change |
|------|--------|
| `backend/services/datahubCrawlersService.js` | Guards, enrichment, metrics, recent outputs |
| `backend/routes/data-hub-crawlers.js` | `recent-outputs` route, `force_override` |
| `backend/schemas/datahubCrawlersSchemas.js` | `force_override` on run body |
| `backend/__tests__/unit/datahubCrawlersArchitecture.test.js` | Guard unit tests |
| `services/dataHubCrawlersApi.ts` | Types, recent outputs, force_override |
| `hooks/useDataHubCrawlers.ts` | Recent outputs query, run mutation |
| `components/.../WebCrawlerConfig.tsx` | Warnings, metrics, labels, recent outputs |
| `deploy/blue|green/locales/en.json`, `fa.json` | New crawler i18n keys |

---

## API changes

### `POST /api/v1/data-hub/crawlers/:id/run`

```json
{ "dry_run": false, "force_override": false }
```

Errors:

| Code | Status | Meaning |
|------|--------|---------|
| `RSS_DATAFETCHER_OWNS` | 409 | Active RSS source owned by scheduler |
| `SOURCE_INACTIVE` | 403 | Linked source disabled |

### `GET /api/v1/data-hub/crawlers/:id/recent-outputs`

Returns last 5 `collected_data` rows with `metadata.crawler_ingest = true`.

### List crawlers enrichment

Each crawler includes: `source_is_active`, `ingestion_owner`, `duplicate_risk`, `real_run_blocked`.

Summary includes: `failed24h` (from runs), `avg_latency_ms`, `duplicate_risk_count`.

---

## Opt-in crawler-owned RSS

Set on data source (no migration):

```json
{ "crawler_mode": "crawler" }
```

---

## Verification checklist

- [x] Unit tests: `datahubCrawlersArchitecture.test.js`
- [x] Frontend build
- [x] `pm2 reload titan-backend`
- [x] API verify: `duplicate_risk_count: 1`, `avg_latency_ms: 509`, guard `RSS_DATAFETCHER_OWNS`
- [ ] Browser: dry-run works, RSS Run blocked, website unchanged (requires authenticated UI)

---

## Commits

_See git log — task ID: `DH-WEBCRAWLER-P2-ARCHITECTURE-FIX`._
