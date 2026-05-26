# DataHub Advanced — Archiving & Cold Storage API Contract (v3.0)

> Subtab: `dataHub.advanced.archiving` · UI: `Archiving.tsx`  
> Replaces: IndexedDB `data_hub_state.advanced.archives` + `services/api.ts` archive helpers (mock).

**Status:** **Approved & implemented (GAP-032 Closed · 2026-05-26).** No archiving cron in v3.0.

**v3.0 locked (product):** **Manual-only** — no cron, no auto-delete, no silent writes. **admin/trader** for all mutating operations. **Dry-run** for archive (and purge preview only; no purge apply).

---

## 1) Scope matrix

| Entity | v3.0 | v3.1+ | Notes |
|--------|------|-------|--------|
| **`ai_decisions` → `ai_decisions_archive`** | **Yes — primary** | — | Via SQL `archive_old_decisions(days_old)` (move, not copy) |
| **`ai_decisions_archive` → `ai_decisions`** | **Manual restore** | — | `restore_from_archive(start, end)` with confirm |
| **Read archived rows** | **Yes** | — | Paginated `GET /records` on `ai_decisions_archive` |
| **Health / partitions / SQL stats** | **Yes** | — | `check_archive_health()`, `list_archive_partitions()`, `ai_decisions_archive_stats` |
| **`collected_data` / logs / other tables** | **No** | Separate GAP + contract update | Out of GAP-032 |
| **Purge (delete from archive)** | **No apply** | Optional | v3.0: `POST /purge/preview` counts only — **never deletes** |
| **Cron / scheduler** | **No** | GAP-033 | Shell script exists for ops; not wired to UI |

---

## 2) Database

### Existing (migration `008` + maintenance SQL)

- `ai_decisions_archive` (partitioned cold storage)
- `ai_decisions_archive_stats` (SQL function job history)
- `ai_decisions_all` (union view)
- Functions: `archive_old_decisions`, `restore_from_archive`, `check_archive_health`, `list_archive_partitions`, `create_archive_partition`

### New (migration `033` — API audit)

**`datahub_archiving_operations`**

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID PK | |
| `operation_type` | VARCHAR | `preview_archive`, `archive`, `preview_restore`, `restore`, `preview_purge`, `create_partition` |
| `dry_run` | BOOLEAN | `true` = no data mutation |
| `request_payload` | JSONB | e.g. `{ days_old }`, date range |
| `result_payload` | JSONB | counts, timing, function output |
| `status` | `success` \| `failed` | |
| `error_summary` | JSONB | on failure |
| `triggered_by` | UUID → users | |
| `started_at` / `completed_at` | TIMESTAMPTZ | |

---

## 3) API — `/api/v1/data-hub/archiving`

| Method | Path | Auth | Effect |
|--------|------|------|--------|
| `GET` | `/health` | `authenticate` | `check_archive_health()` |
| `GET` | `/partitions` | `authenticate` | `list_archive_partitions()` |
| `GET` | `/stats` | `authenticate` | `ai_decisions_archive_stats` + recent `datahub_archiving_operations` |
| `GET` | `/operations` | `authenticate` | Paginated API operation history |
| `GET` | `/records` | `authenticate` | Paginated read `ai_decisions_archive` |
| `POST` | `/archive/preview` | `admin` \| `trader` | Dry-run: count rows that would move |
| `POST` | `/archive` | `admin` \| `trader` | Run `archive_old_decisions` — requires `confirm_archive: true` OR `dry_run: true` |
| `POST` | `/restore/preview` | `admin` \| `trader` | Dry-run: count rows in archive in range |
| `POST` | `/restore` | `admin` \| `trader` | Run `restore_from_archive` — requires `confirm_restore: true` OR `dry_run: true` |
| `POST` | `/purge/preview` | `admin` \| `trader` | **Count only** — no delete in v3.0 |
| `POST` | `/partitions` | `admin` \| `trader` | `create_archive_partition(year)` — requires `confirm_create: true` |

**Strict confirms** (must be literal `true`, not truthy):

- `confirm_archive` for `POST /archive` when `dry_run !== true`
- `confirm_restore` for `POST /restore` when `dry_run !== true`
- `confirm_create` for `POST /partitions` when creating partition

Errors: `CONFIRM_ARCHIVE_REQUIRED`, `CONFIRM_RESTORE_REQUIRED`, `CONFIRM_CREATE_REQUIRED` → **400**; unauthorized → **403**.

---

## 4) Demos (`DataHub_DEMOS.md`)

| Scenario | Expected |
|----------|----------|
| Health read | JSON from `check_archive_health` |
| Archive preview | `pending_count` > 0; **no** change to `ai_decisions` count until apply |
| Archive without confirm | **400** |
| Archive with confirm | records moved; stats row in `ai_decisions_archive_stats` |
| Restore preview / apply | same pattern |
| Purge preview | count only; archive table unchanged |
| Unauthorized mutate | **403** |
| DB error | **500** + UI retry |

---

## 5) GAP tracking

| GAP | Status |
|-----|--------|
| **GAP-032** | **Closed** — DataHub archiving API + UI |
| **GAP-033** | **Open** v3.1 — archiving cron daemon |
| SSOT `dataHub.advanced.archiving` | **Implemented · Design: Done** |

---

*Contract version: v3.0 · 2026-05-26 · **Approved**.*
