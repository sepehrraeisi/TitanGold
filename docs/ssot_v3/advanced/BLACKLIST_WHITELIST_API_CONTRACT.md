# DataHub Advanced — Blacklist / Whitelist API Contract (v3.0)

> Subtab: `dataHub.advanced.blacklist` · UI: `BlacklistWhitelist.tsx`  
> Replaces: IndexedDB `data_hub_state.advanced.blacklist/whitelist` + `services/api.ts` `addToBlacklist` / `addToWhitelist` (GAP-024).

---

## Scope decisions (v3.0 — locked for implementation)

### Rule dimensions

| Dimension | v3.0 | Notes |
|-----------|------|--------|
| **Domain allow/block** | **Yes** | Match host/URL/domain (`example.com`, `*.cdn.evil.net`). Stored as `scope=domain`. |
| **Source allow/block** | **Yes** | Match `data_sources.id` (FK optional). Stored as `scope=source`. On blacklist: may set source `is_active=false` (same as legacy IndexedDB behavior). |
| **Keyword allow/block** | **Yes** | Match substring/regex on normalized payload text. Stored as `scope=keyword`. |

Legacy `patterns[]` in `DataHubAdvancedFeatures` → migrated to **domain** or **keyword** rows (`match_kind`).

### List type (blacklist vs whitelist)

| `list_type` | Behavior |
|-------------|----------|
| `blacklist` | Block / drop / skip when matched |
| `whitelist` | Allow-only bypass: if **any active whitelist** exists for a scope, non-matching items in that scope are blocked (strict mode per scope group — see evaluation) |

**Precedence:** whitelist match wins over blacklist for same item; blacklist + whitelist on same source → **whitelist removed on insert** (legacy behavior).

### Apply target (`apply_target`)

| Target | v3.0 enforcement | v3.1 |
|--------|-------------------|------|
| **`ingestion`** | **Yes** — filter on ingest path: skip writing actionable `collected_data` / enqueue when blocked; log to `data_hub_logs` | Extend workers |
| **`publishing`** | **Read + evaluate API only** — rules stored; automation dispatch / publisher checks call `POST .../evaluate` (no silent drop in worker yet) | GAP-025 hook publisher/automation |
| **`both`** | Stored; evaluated as ingestion + publishing | Full worker hooks |

**v3.0 default for new rules:** `ingestion`. UI lets user pick `ingestion` | `publishing` | `both`.

### Lifecycle: soft delete vs hard delete

| Operation | v3.0 |
|-----------|------|
| **Disable** | `is_active = false` (preferred “off”) |
| **Delete** | Soft: `is_active=false` + `deleted_at` timestamp (retain row) |
| **Hard delete** | `DELETE ...?hard=true` admin-only optional — **not required v3.0** |

No physical row delete by default (audit-friendly).

### Audit / history

| Feature | v3.0 |
|---------|------|
| **CRUD audit** | Insert row in `data_hub_logs` on create/update/toggle (same pattern as sources ACL) |
| **Dedicated `filter_rule_history` table** | **Out of scope** — GAP-004 / v3.1 |
| **UI “history” tab** | **Out of scope** — show `last_matched_at` on rule row only (nullable, updated by evaluate) |

### UI “Rules” tab (fake toggles today)

| v3.0 | v3.1 |
|------|------|
| Remove hard-coded rules; show **keyword/domain** rules list OR empty state pointing to “Add rule” | Auto-rules (fail-3x, spam regex) as `rule_kind=system` rows |

---

## Out of scope (v3.0)

- RBAC beyond `authenticate` + optional `admin|trader` write (align access-control).
- Geo/IP/agent-based filters.
- Per-category matrix (use access-control + category names in keyword rules only).
- Bulk import CSV.
- Real-time stream blocking in telegram-collector process (API ready; worker hook later).

---

## Database

### Migration `028_create_datahub_filter_rules.sql`

Table: `datahub_filter_rules`

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID PK | |
| `list_type` | `blacklist` \| `whitelist` | |
| `scope` | `domain` \| `source` \| `keyword` | |
| `match_value` | TEXT | domain host, source_id UUID string, or keyword pattern |
| `match_kind` | `exact` \| `contains` \| `prefix` \| `regex` | default `contains` for keyword, `exact` for source |
| `apply_target` | `ingestion` \| `publishing` \| `both` | default `ingestion` |
| `reason` | TEXT nullable | |
| `is_active` | BOOLEAN default true | |
| `deleted_at` | TIMESTAMPTZ nullable | soft delete |
| `last_matched_at` | TIMESTAMPTZ nullable | |
| `created_at` / `updated_at` | TIMESTAMPTZ | |
| `created_by` | VARCHAR nullable | user id from JWT |

Indexes:

- `(list_type, scope, is_active)` where `deleted_at IS NULL`
- `(scope, match_value)` for source/domain lookups

**No FK** on `match_value` for domain/keyword; optional FK `data_sources(id)` when `scope=source` (app-level validation).

### Summary view (API computed)

`GET /summary` returns counts: `blacklistActive`, `whitelistActive`, `byScope`, `lastUpdated`.

---

## API — `/api/v1/data-hub/filter-rules`

Auth: `authenticate` on all routes. Write: `authorize(['admin','trader'])` (same as access-control v3.0).

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/` | Query: `list_type?`, `scope?`, `apply_target?`, `active_only=true` → `{ rules: FilterRule[], summary }` |
| `GET` | `/:id` | Single rule |
| `POST` | `/` | Create rule (body below) → `201` |
| `PUT` | `/:id` | Update rule |
| `PATCH` | `/:id/toggle` | `{ is_active: boolean }` |
| `DELETE` | `/:id` | Soft delete (default) or `?hard=true` |
| `POST` | `/evaluate` | Body: `{ source_id?, url?, text?, apply_target }` → `{ allowed, matched_rules[], reason }` |

### Create / update body (camelCase in UI → snake_case API)

```json
{
  "list_type": "blacklist",
  "scope": "domain",
  "match_value": "spam.example.com",
  "match_kind": "exact",
  "apply_target": "ingestion",
  "reason": "Known spam domain",
  "is_active": true
}
```

Source scope example:

```json
{
  "list_type": "blacklist",
  "scope": "source",
  "match_value": "<data_source_uuid>",
  "match_kind": "exact",
  "apply_target": "both",
  "reason": "Repeated failures"
}
```

### Evaluation semantics (`POST /evaluate`)

1. Collect candidate rules: `is_active=true`, `deleted_at IS NULL`, `apply_target` in (`requested`, `both`).
2. If any **whitelist** matches → `allowed: true` (unless blacklist also matches same source id — then deny with reason `conflict`).
3. Else if any **blacklist** matches → `allowed: false`.
4. Else → `allowed: true`.

Match helpers:

- **source:** `match_value === source_id`
- **domain:** parse host from `url`; `exact` / `prefix` / `regex` on host
- **keyword:** `contains` or `regex` on `text`

### Errors

| Status | When |
|--------|------|
| `400` | Invalid scope/list_type; bad regex; empty match_value |
| `409` | Duplicate active rule (same list_type + scope + match_value + match_kind) |
| `404` | Unknown id |

---

## Frontend (backend-first)

| Piece | Path |
|-------|------|
| API client | `services/datahubFilterRulesApi.ts` |
| Hooks | `hooks/useDatahubFilterRules.ts` |
| Panel | `advanced/BlacklistWhitelist.tsx` — `DATAHUB_SHELL`, no `fetchDataHubState` |
| Modal | `modals/FilterRuleModal.tsx` — `DataHubModal` §10 |

Remove dependency on `dataHub` / `setDataHub` props for list CRUD (keep optional `sourceQualityMap` read-only for context).

Tabs v3.0:

1. **Blacklist** — active blacklist rules  
2. **Whitelist** — active whitelist rules  
3. **All rules** — combined table with scope/target badges (replaces fake “Rules” toggles)

---

## Design pass (GAP-023 remainder)

Same workflow as Design-3: slate shell, metric cards, pills (`list_type`, `scope`, `apply_target`), `text-[11px]` alerts, i18n en/fa × 4 locale files.

---

## GAP tracking

| GAP | Title | Status after v3.0 |
|-----|-------|-------------------|
| **GAP-024** | Blacklist/Whitelist backend-first + UI | **Target: Closed** |
| GAP-004 | Richer policy UI + history table | Open v3.1 |
| GAP-025 | Publishing-path enforcement in automation/publisher workers | Open v3.1 |

---

## Demos (`DataHub_DEMOS.md`)

**Success:** create domain blacklist → evaluate blocked URL → create source whitelist → evaluate allowed.  
**Failure:** duplicate `409`, invalid regex `400`, evaluate with no rules `allowed: true`.  
**Design:** visual checklist for shell/tabs/modal.

---

## SSOT target

`dataHub.advanced.blacklist` → **Implemented · Design: Done** (after GAP-024 + design pass).

---

## Implementation checklist

- [ ] Migration `028_create_datahub_filter_rules.sql`
- [ ] `backend/services/datahubFilterRulesService.js`
- [ ] `backend/routes/data-hub-filter-rules.js` mounted in `server.js`
- [ ] Frontend API + hooks + panel rewrite
- [ ] Ingestion hook (minimal): call evaluate in `collected_data` insert path OR document as GAP-024b if too large
- [ ] i18n keys
- [ ] Demos + SSOT + `GAPS_AND_PLAN.md` GAP-024 Closed
- [ ] `npm run build`
- [ ] commit/push on feature branch

---

*Contract version: v3.0 · 2026-05-24 · Awaiting implementation (GAP-024).*
