# DataHub Advanced — Auto Discovery API Contract (v3.0 draft)

> Subtab: `dataHub.advanced.discovery` · UI: `AutoDiscoveryConfig.tsx`  
> Replaces: IndexedDB `data_hub_state.advanced.autoDiscovery` + `services/api.ts` `runAutoDiscovery` / `setAutoDiscoveryEnabled` (today **auto-creates** sources via mock — **removed in v3.0**).

**Status:** Draft — **awaiting product approval before implementation (GAP-028).**

**v3.0 locked decision:** **Suggestion-only + admin/trader approval** — **no direct `data_sources` insert** from discovery scan.

---

## 1) Where discovery runs (input sources)

Discovery scan **reads** from existing platform data; it does not crawl the public internet blindly in v3.0.

| Source | v3.0 | What we extract | Notes |
|--------|------|-----------------|-------|
| **Known `data_sources`** | Yes | `url`, `type`, `category`, host fingerprint | Baseline for duplicate detection — never re-suggest exact match |
| **Crawler output** | Yes | Domains/URLs from `collected_data` linked to web/rss crawlers (`metadata.url`, `normalized_data`) | Primary net-new signal after GAP-026 |
| **Telegram channels** | Yes (read-only) | `telegram_channels` username/title + linked `data_sources` where `type=telegram` | Suggest telegram/rss/web **only as candidates** — no channel auto-registration |
| **Rule patterns** | Yes | Admin-defined patterns (RSS feed URL template, API base URL regex, domain suffix) | Matched against collected URLs + optional HEAD probe |
| **External search / DNS** | No | — | v3.1+ |

**Scan entrypoint:** `POST /api/v1/data-hub/discovery/scan` (manual) · optional `enabled` flag stores “auto-scan on schedule” metadata only (actual cron → **GAP-029** v3.1, separate from GAP-027 crawlers).

---

## 2) Where suggestions are stored

Dedicated tables (not IndexedDB, not embedded in `data_hub_state`).

### Migration `030_create_datahub_discovery.sql` (proposed)

**`datahub_discovery_rules`**

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID PK | |
| `name` | VARCHAR | |
| `pattern` | TEXT | URL regex, domain suffix, or feed template |
| `source_kind` | `api` \| `rss` \| `website` \| `telegram` | suggested type |
| `category` | VARCHAR | default category label |
| `priority` | `low` \| `medium` \| `high` \| `critical` | rule weight |
| `is_enabled` | BOOLEAN | |
| `metadata` | JSONB | tags, notes |
| `deleted_at` | TIMESTAMPTZ | soft delete |
| timestamps | | |

**`datahub_discovery_suggestions`**

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID PK | |
| `status` | `pending` \| `approved` \| `rejected` \| `duplicate` | |
| `suggested_name` | VARCHAR | |
| `suggested_type` | `api` \| `rss` \| `web` \| `telegram` | maps to `data_sources.type` on approve |
| `suggested_url` | TEXT | canonical URL |
| `host_key` | VARCHAR | normalized host for dedupe index |
| `category` | VARCHAR | |
| `priority_score` | NUMERIC(5,2) | 0–100 computed |
| `discovery_source` | `crawler` \| `telegram` \| `known_sources` \| `rule` | provenance |
| `rule_id` | UUID FK nullable | |
| `evidence` | JSONB | sample URLs, message ids, collected_data ids |
| `duplicate_of_source_id` | UUID FK nullable | if matches existing source |
| `duplicate_of_suggestion_id` | UUID FK nullable | |
| `reviewed_by` | UUID nullable | |
| `reviewed_at` | TIMESTAMPTZ | |
| `created_source_id` | UUID FK nullable | set **only after approve** |
| timestamps | | |

Unique partial index: `(host_key, suggested_type)` WHERE `status IN ('pending','approved')` AND `deleted_at IS NULL`.

---

## 3) Auto-create vs suggestion + approval

| Action | v3.0 | v3.1 (optional) |
|--------|------|------------------|
| Scan finds candidate | Insert row `status=pending` | same |
| **Auto-create `data_sources`** | **Forbidden** | behind `DISCOVERY_AUTO_CREATE=true` + service account |
| **Approve** | `POST .../suggestions/:id/approve` → calls existing `POST /api/v1/data-sources` → sets `created_source_id` | same |
| **Reject** | `POST .../reject` | same |
| Toggle “enabled” | Persists `datahub_discovery_settings.enabled` only; scan still manual in v3.0 | cron worker |

Legacy `runAutoDiscovery` mock that called `createDataSource` in a loop → **removed** from UI and deprecated in `services/api.ts`.

---

## 4) Duplicate detection

**Normalization (`host_key`):**

- Lowercase host from URL; strip `www.`; ignore path/query for domain-level dedupe.
- Telegram: `@username` or numeric channel id string.

**Match order (first hit wins):**

1. Active `data_sources` where normalized URL/host equals `host_key`
2. Existing suggestion `pending` or `approved` with same `host_key` + compatible type
3. Filter rules: if domain blacklist matches → mark `duplicate` or skip insert with reason in `evidence`

**Outcomes:**

| Case | `status` | UI |
|------|----------|-----|
| New candidate | `pending` | Show in Discovered tab |
| Matches existing source | `duplicate` | Show link to source; hide Approve |
| Near-duplicate (same host, different path) | `pending` with lower score | Admin decides |

---

## 5) Scoring / priority

**`priority_score` (0–100)** — computed at scan time, stored on suggestion:

| Factor | Weight (v3.0) | Source |
|--------|----------------|--------|
| Rule `priority` | 30% | `critical=100 … low=25` mapped |
| Provenance | 25% | crawler-collected URL > telegram > rule-only |
| Category alignment | 15% | matches pipeline category inflow |
| Freshness | 15% | seen in `collected_data` last 24h |
| Uniqueness confidence | 15% | no near-duplicates in DB |

Sort UI list: `priority_score DESC`, then `created_at DESC`.

**Not in v3.0:** ML classifier, PageRank, or auto-apply to `source_priority` table (that stays **Prioritization** subtab / separate GAP).

---

## 6) Security / roles

| Route | Auth |
|-------|------|
| `GET` rules, suggestions, settings | `authenticate` + read rate limit |
| `POST` scan, CRUD rules | `authenticate` + `authorize('admin','trader')` + write rate limit |
| `POST` approve / reject | **`admin` + `trader` only** |
| Approve side-effect | Creates source with `created_by` = reviewer |

Audit: `data_hub_logs` entry on approve/reject/scan (counts, not full PII dump).

Pre-approve filter check: run `evaluateFilterRules` on `suggested_url` — blacklist → reject with reason (no source create).

---

## 7) API — `/api/v1/data-hub/discovery`

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/settings` | `{ enabled, last_scan_at }` |
| `PATCH` | `/settings` | `{ enabled: boolean }` |
| `GET` | `/rules` | List rules |
| `POST` | `/rules` | Create rule |
| `PUT` | `/rules/:id` | Update |
| `DELETE` | `/rules/:id` | Soft delete |
| `GET` | `/suggestions` | Query: `status?`, `discovery_source?`, pagination |
| `POST` | `/scan` | Run scan → `{ added, duplicates, skipped, scan_id }` |
| `POST` | `/suggestions/:id/approve` | Create `data_sources` row + link |
| `POST` | `/suggestions/:id/reject` | `{ reason? }` |

---

## 8) Frontend (after approval)

| Piece | Action |
|-------|--------|
| `services/dataHubDiscoveryApi.ts` | API client |
| `hooks/useDataHubDiscovery.ts` | React Query |
| `AutoDiscoveryConfig.tsx` | Backend-first; tabs: Discovered / Rules / (patterns → rules list) |
| Remove | `fetchDataHubState`, `runAutoDiscovery` auto-create path |
| Design | `DESIGN_SYSTEM_DATAHUB.md` slate shell, pills for status/score |
| i18n | strict keys in 4 locale files |

---

## 9) Demos (`DataHub_DEMOS.md`)

**Success**

- Enable discovery → `PATCH /settings`
- Create rule (rss domain pattern) → `POST /rules`
- `POST /scan` → new `pending` suggestions from crawler URLs
- Approve suggestion → `201` source + suggestion `approved` + `created_source_id`
- Duplicate scan → suggestion `duplicate`, no second source

**Failure**

- Approve blacklisted domain → **400/403** filter blocked
- Approve without role → **403**
- Scan with no rules and empty collected_data → **200** `{ added: 0 }`
- Duplicate approve → **409**

---

## 10) GAP / SSOT targets

| GAP | Title | Status |
|-----|-------|--------|
| **GAP-028** | Auto Discovery backend-first | Open until approved |
| **GAP-029** (v3.1) | Discovery scheduler daemon | Open v3.1 |
| GAP-023 | Design pass | Move `discovery` Pending → Done after impl |
| SSOT | `dataHub.advanced.discovery` | **Implemented · Design: Done** (post GAP-028) |

---

## 11) Out of scope (v3.0)

- Auto-create sources without approval
- Bulk approve CSV
- Discovery from arbitrary external Google/search APIs
- Auto-link telegram channel → data_source without approval
- Pattern learning / ML

---

## 12) Approval checklist

- [ ] Confirm input sources (crawler + telegram + known + rules)
- [ ] Confirm suggestion-only v3.0
- [ ] Confirm scoring weights
- [ ] Approve table names / migration `030`

---

*Contract version: v3.0-draft · 2026-05-25 · **Awaiting approval** — do not implement until confirmed.*
