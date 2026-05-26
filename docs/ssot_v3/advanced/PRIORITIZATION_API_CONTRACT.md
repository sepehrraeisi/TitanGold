# DataHub Advanced — Smart Prioritization API Contract (v3.0)

> Subtab: `dataHub.advanced.prioritization` · UI: `SmartPrioritization.tsx`  
> Replaces: IndexedDB `data_hub_state.advanced.smartPrioritization` + `services/api.ts` `calculateSourcePriorities` / `setSmartPrioritizationEnabled` (client-side mock apply).

**Status:** **Approved & implemented (GAP-030 Closed · 2026-05-26).** No background auto-apply daemon in v3.0.

**v3.0 locked (product):** **Preview + manual apply only** — **no auto-apply**, no cron recalculation, no silent writes to `data_sources`.

---

## 1) What gets prioritized? (scope matrix)

| Entity | v3.0 | v3.1+ | Notes |
|--------|------|-------|--------|
| **`data_sources`** (active) | **Yes — primary** | — | Rank score 0–100 + tier `low` \| `medium` \| `high` \| `critical`; **apply** updates `data_sources.priority` |
| **Discovery suggestions** | **No** | Optional read-only hint | Already scored in discovery (`priority_score` 0–100, GAP-028). Not merged into prioritization apply in v3.0. |
| **Crawlers** (`datahub_crawlers`) | **No** | Indirect | Crawler run order may read linked `data_sources.priority` when **GAP-027** scheduler exists — no crawler row mutation here. |
| **Automation topics / queue** | **No** | Optional | `datahub_automation_topics.priority` (SMALLINT) stays separate; unified cross-module ranking → future GAP. |

**Out of scope v3.0:** changing discovery suggestion order, crawler schedules, automation dispatch, or filter-rule `priority` integers.

---

## 2) Scoring model

### 2.1 Signals (read-only inputs)

Per **active** `data_sources` row (+ optional pipeline enrichment):

| Signal | Source | Weight key (default %) |
|--------|--------|-------------------------|
| Reliability | `data_sources.reliability_score` (0–100) | `reliability` **30** |
| Freshness | `last_fetch_at` staleness vs `refresh_interval` | `freshness` **25** |
| Success / health | `success_rate`, `error_count`, `last_status` | `reliability_health` **25** |
| Category importance | `data_categories` / source `category` + admin weight map | `category_importance` **20** |

Optional enrichments (same preview run, no extra apply):

- `GET /api/v1/data-sources/pipeline` → per-source `issues[]`, `lastResponseTime`, `lastStatus` (adjust freshness/health sub-scores).
- Last 24h access-log pass rate (if cheap query) — bonus/penalty capped ±10 on final score.

**Output per source:**

- `calculated_score` **NUMERIC 0–100** (clamped, rounded 1 decimal).
- `suggested_tier` (deterministic, auditable): based on `calculated_score` final value:
  - `low` = `0–24`
  - `medium` = `25–49`
  - `high` = `50–74`
  - `critical` = `75–100`
- `factor_breakdown` JSONB: `{ reliability: 28.5, freshness: 20, … }` for UI bars.

### 2.2 Manual override

| Field | Behavior |
|-------|----------|
| `override_score` | Optional **0–100**; when set, preview/apply use **override** as final score (tier derived from override). |
| `override_note` | Optional text (audit). |
| `overridden_by` / `overridden_at` | Set on `PUT /sources/:sourceId/override`; clear by sending `override_score=null`. |

Override **does not** auto-apply to `data_sources` until user runs **Apply** (or apply-single).

### 2.3 Factor weights (admin config)

- Stored in `datahub_prioritization_settings.factor_weights` (JSON).
- Weights must sum to **100** (integer percent) — else **400** `INVALID_WEIGHTS`.
- Defaults match current UI: quality/reliability 30, freshness 25, reliability_health 25, category 20.

### 2.4 No auto-apply (v3.0)

| Action | Writes `data_sources`? | Writes priority tables? |
|--------|-------------------------|-------------------------|
| `POST /preview` | **No** | Yes — `datahub_prioritization_runs` + upsert `datahub_source_priorities` **preview snapshot** |
| `POST /apply` | **Yes** — batch `priority` tier on selected/all previewed | Yes — `datahub_source_priorities.last_applied_at/last_applied_by` + runs audit (`applied_by`) |
| `PUT /sources/:sourceId/override` | **No** (`data_sources` untouched) | Save audit override fields |
| Enable toggle `PUT /settings` | **No** | `is_enabled` + weights/thresholds |

Background recalculation cron → **v3.1** (optional GAP, not part of GAP-030 MVP).

---

## 3) Storage (migration `031` proposed)

### `datahub_prioritization_settings` (singleton)

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID PK | single row |
| `is_enabled` | BOOLEAN | default **false** |
| `factor_weights` | JSONB | percent map, sum 100 |
| `tier_thresholds` | JSONB | optional `{ low: 40, high: 60, critical: 80 }` |
| `updated_by` | UUID → users | |
| `updated_at` | TIMESTAMPTZ | |

### `datahub_source_priorities`

| Column | Type | Description |
|--------|------|-------------|
| `source_id` | UUID PK FK → `data_sources` | |
| `calculated_score` | NUMERIC(5,2) CHECK 0–100 | last preview |
| `suggested_tier` | VARCHAR CHECK tier enum | |
| `factor_breakdown` | JSONB | |
| `override_score` | NUMERIC(5,2) nullable | |
| `override_note` | TEXT | |
| `overridden_by` | UUID nullable | |
| `overridden_at` | TIMESTAMPTZ | |
| `last_preview_at` | TIMESTAMPTZ | |
| `last_applied_at` | TIMESTAMPTZ nullable | |
| `last_applied_by` | UUID nullable | |

### `datahub_prioritization_runs`

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID PK | |
| `run_type` | `preview` \| `apply` | |
| `source_count` | INT | |
| `summary` | JSONB | tier histogram (success-only) |
| `created_by` | UUID | |
| `created_at` | TIMESTAMPTZ | |
| `started_at` | TIMESTAMPTZ | set at run start |
| `completed_at` | TIMESTAMPTZ | set at run end (success/failure) |
| `applied_by` | UUID | `admin/trader` who applied (apply runs) |
| `settings_snapshot` | JSONB | scoring settings snapshot |
| `preview_only` | BOOLEAN | `true` for preview; `false` for apply |
| `status` | VARCHAR(20) | `success` \| `failed` |
| `error_summary` | JSONB | populated on failure |

### `data_sources.priority`

- If column missing: add `priority VARCHAR(20) DEFAULT 'medium' CHECK (IN low, medium, high, critical)` in `031`.
- **Apply** sets this column; Sources panel badge reads API (already mapped in `dataSourcesApi.ts`).

**Removes:** reliance on `settings.data_hub_state.advanced.smartPrioritization` for rules/history.

---

## 4) API — `/api/v1/data-hub/prioritization`

| Method | Path | Auth | Effect |
|--------|------|------|--------|
| `GET` | `/settings` | `authenticate` | Read enabled + weights |
| `PUT` | `/settings` | `admin` \| `trader` | Toggle enabled, update weights |
| `GET` | `/sources` | `authenticate` | List per-source priority rows + joined source name |
| `POST` | `/preview` | `admin` \| `trader` | Recalculate all active sources → preview snapshot (**no** `data_sources` update) |
| `POST` | `/apply` | `admin` \| `trader` | Apply from current preview/override → update `data_sources.priority` (requires `{ confirm_apply: true }`) |
| `PUT` | `/sources/:sourceId/override` | `admin` \| `trader` | Set override score + note; clear by sending `override_score=null` |
| `GET` | `/runs` | `authenticate` | Paginated preview/apply history |

**Errors:** `PRIORITIZATION_DISABLED` **400** when `is_enabled=false` and preview/apply called; `INVALID_WEIGHTS` **400**; `FORBIDDEN` **403**; `SOURCE_NOT_FOUND` **404**.

---

## 5) Authorization

| Operation | Roles |
|-----------|--------|
| Read settings / sources / runs | Any authenticated user with DataHub access |
| Preview, apply, overrides, PATCH settings | **`admin`** or **`trader`** only |

Unauthorized apply → **403** (demo required).

---

## 6) UI / Design / i18n (post-approval)

- Redesign `SmartPrioritization.tsx`: slate shell per `DESIGN_SYSTEM_DATAHUB.md` § Advanced.
- React Query: `dataHubPrioritizationApi.ts`, `useDataHubPrioritization.ts`.
- Remove `ApiWrapper` dependency on missing `updatePrioritizationFactors` / `setPriorityOverride` from `services/api.ts`.
- **Strict i18n:** `en`, `fa`, `ar`, `tr` keys for preview, apply, override, tier badges, factor labels.
- Flow: **Configure weights** → **Preview** (table + breakdown) → **Apply selected / Apply all** (confirm modal).
- **DB/API error:** shared error banner + **Retry** on preview/apply/list (same pattern as discovery/crawlers).

---

## 7) Demos / failures (`DataHub_DEMOS.md`)

| Scenario | Expected |
|----------|----------|
| Preview only | Scores returned; `data_sources.priority` unchanged |
| Apply batch | Tiers written; `last_applied_by` set |
| Single apply | One source updated |
| Manual override | Preview shows override score; apply respects override |
| Clear override | Reverts to calculated on next preview |
| Disabled + preview | **400** `PRIORITIZATION_DISABLED` |
| Invalid weights (≠100) | **400** |
| Unauthorized apply | **403** |
| Unknown source | **404** |
| DB down | **500** + UI error banner + retry |

---

## 8) GAP tracking

| GAP | Status |
|-----|--------|
| **GAP-030** | **Closed** |
| **GAP-023** | Partial (only archiving pending) |
| SSOT `dataHub.advanced.prioritization` | **Implemented · Design: Done** |

**Not in GAP-030:** automation topic priority, crawler scheduler ordering, discovery suggestion reorder.

---

## 9) Approval checklist

- [ ] Scope: **data_sources only** for v3.0 apply
- [ ] **Preview + manual apply**; no auto-apply
- [ ] Scoring signals + weights + override behavior
- [ ] Storage model (`031`) + API paths
- [ ] RBAC: apply = admin/trader
- [ ] Demos + design/i18n pass

---

*Contract version: v3.0 · 2026-05-26 · **Implemented**.*
