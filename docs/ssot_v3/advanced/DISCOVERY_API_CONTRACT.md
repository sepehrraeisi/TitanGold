# DataHub Advanced — Auto Discovery API Contract (v3.0)

> Subtab: `dataHub.advanced.discovery` · UI: `AutoDiscoveryConfig.tsx`  
> Replaces: IndexedDB `data_hub_state.advanced.autoDiscovery` + `services/api.ts` `runAutoDiscovery` (mock auto-create removed).

**Status:** **Approved & implemented (GAP-028 Closed · 2026-05-25).** Scheduler → **GAP-029** v3.1.

**v3.0 locked:** **Suggestion-only** — scan never mutates `data_sources` directly. **Approve/reject** by `admin`/`trader` only.

---

## 1) Discovery inputs (read-only sources)

| Source | Extract |
|--------|---------|
| **Known `data_sources`** | Dedupe baseline (host/path/title fingerprints) |
| **Crawler `collected_data`** (7d) | URLs + titles from ingestion |
| **`telegram_channels`** | Channels without linked telegram source |
| **`datahub_discovery_rules`** | Seed URL patterns |

`POST /api/v1/data-hub/discovery/scan` — manual only in v3.0.

---

## 2) Database (migration `030`)

**`datahub_discovery_settings`** · **`datahub_discovery_rules`** · **`datahub_discovery_scans`** · **`datahub_discovery_suggestions`**

Suggestion fields (audit):

| Field | Purpose |
|-------|---------|
| `approved_by` / `rejected_by` | Human reviewer UUID |
| `reviewed_at` / `review_note` | Analytics audit trail |
| `duplicate_of_source_id` / `duplicate_of_suggestion_id` | Reference when duplicate |
| `duplicate_reason` / `duplicate_confidence` | Why skipped as new pending |
| `created_source_id` | Set **only** on approve |

`status`: `pending` | `approved` | `rejected` | `duplicate`

---

## 3) Duplicate detection (3 layers)

Implemented in `backend/utils/discoveryDedupe.js`:

| Layer | Check | High confidence |
|-------|--------|-----------------|
| **1. Hostname** | `host_key` match vs sources/suggestions | ≥80–95% |
| **2. URL/path** | `host_key` + `path_key` exact match | ≥98% |
| **3. Title similarity** | Jaccard on `title_key` vs source name / suggestion title | ≥85% |

If `confidence ≥ 75`: **do not** create new `pending` — insert `status=duplicate` with `duplicate_of_*` + `duplicate_reason`.

---

## 4) Scoring (`priority_score` 0–100)

`backend/utils/discoveryScoring.js` — weighted, normalized:

| Factor | Weight |
|--------|--------|
| Source reputation | 18% |
| Category match | 14% |
| Freshness / activity | 14% |
| Uniqueness | 14% |
| Crawl frequency | 10% |
| Telegram mention frequency | 10% |
| Rule priority | 12% |
| Provenance (crawler/telegram/rule) | 8% |
| Blacklist penalty | subtract |

Not random — deterministic from scan context.

---

## 5) SSRF / unsafe URL (`discoverySafety.js`)

**Explicit block** before suggest / approve:

- Schemes: only `http`/`https` — block `file://`, `ftp://`, `data:`, etc.
- `localhost`, `*.local`, `*.internal`, `metadata.*`
- Private IPv4 ranges (10/8, 172.16/12, 192.168/16, 127/8, link-local, …)
- Private IPv6 (`::1`, ULA)

Errors: `SSRF_BLOCKED` **400**, `INVALID_URL` **400**.

---

## 6) API — `/api/v1/data-hub/discovery`

| Method | Path |
|--------|------|
| `GET` | `/settings` |
| `PATCH` | `/settings` |
| `GET` | `/stats` |
| `GET` | `/history` |
| `GET` | `/suggestions` |
| `GET` | `/rules` |
| `POST` | `/rules` |
| `PUT` | `/rules/:id` |
| `DELETE` | `/rules/:id` |
| `POST` | `/scan` |
| `POST` | `/suggestions/:id/approve` |
| `POST` | `/suggestions/:id/reject` |

Auth: read `authenticate`; write + approve/reject `admin`/`trader`.

**Approve** calls `evaluateFilterRules` then `INSERT data_sources` — only path that creates sources.

---

## 7) Demos / failures

| Scenario | Expected |
|----------|----------|
| Duplicate scan | `status=duplicate`, `duplicate_of_*` set |
| Blacklist URL | skipped/blocked in scan counts |
| SSRF URL | `SSRF_BLOCKED` / skipped |
| Invalid URL | `400` |
| Unauthorized approve | `403` |
| Rejected suggestion | `rejected_by`, `reviewed_at` |
| DB down | `500` |

---

## 8) GAP tracking

| GAP | Status |
|-----|--------|
| **GAP-028** | **Closed** |
| **GAP-029** | Open v3.1 — discovery scheduler daemon |
| SSOT `dataHub.advanced.discovery` | **Implemented · Design: Done** |

---

*Contract version: v3.0 · 2026-05-25 · **Implemented**.*
