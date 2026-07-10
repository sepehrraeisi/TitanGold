# DH-AUTODISCOVERY-P1 — RCA & UX Audit

**Task:** DH-AUTODISCOVERY-P1-RCA-AND-UX-AUDIT  
**Date:** 2026-05-29  
**Mode:** Read-only — no code changes, no production writes  
**Branch context:** `feat/gap-008-sources-backend-wiring` (post P2/P3 duplicate URL guard)

---

## Executive summary

Auto Discovery has a **real backend implementation** (scan, rules CRUD, suggestions, approve/reject, history API) and **partial frontend wiring** (stats, suggestions, rules, scan — but **not history**). Production evidence shows the feature **has never produced a reviewable suggestion**: all **214** suggestion rows are `status=duplicate`; **0** `pending`, **0** `approved`, **0** `rejected`.

Root cause of “discovery not working” in QA is **over-aggressive hostname-layer deduplication** in `discoveryDedupe.js` (confidence 82 ≥ threshold 75), which treats:

- **Telegram:** any `t.me` channel as duplicate of the first existing Telegram source (false positive).
- **Crawler/RSS:** any article URL on a domain that already has an RSS source as duplicate of that feed (wrong granularity — pages ≠ feeds).

Additional gaps: History tab is a placeholder; scan result banner lacks detail; `pending_approval` i18n key missing; approve path does **not** call P2 `evaluateDuplicateUrlGuard`.

### Verdict: **D) BROKEN / UNSAFE**

| Criterion | Status |
|-----------|--------|
| Scan runs against real data | ✅ Yes |
| Creates actionable `pending` suggestions | ❌ Never in production |
| Dedupe logic correct | ❌ False positives block all candidates |
| Approval creates sources safely | ⚠️ Path exists; no P2 guard; never exercised |
| History UX | ❌ API exists; UI not wired |
| Duplicate URL guard (P2) integrated | ❌ Not on scan or approve |

**Recommended next task:** DH-AUTODISCOVERY-P2 — fix dedupe semantics, wire history UI, improve scan feedback, integrate P2 guard on approve, fix i18n.

---

## Phase A — Product purpose audit

### A1. What is Auto Discovery supposed to discover?

**Code evidence:** `gatherCandidates()` in `backend/services/datahubDiscoveryService.js`.

| Category | Discovered? | Mechanism |
|----------|-------------|-----------|
| Telegram channels | ✅ Yes | `telegram_channels` without linked `data_sources` row (`LEFT JOIN` on username in URL) |
| RSS feeds | ⚠️ Indirect | Not feed URLs directly — URLs extracted from `collected_data` metadata/normalized_data when parent source type is `rss` |
| Website pages | ✅ Yes | Same `collected_data` path when parent source type is not `rss` → `suggested_type: 'web'` |
| APIs | ⚠️ Rules only | `source_kind: 'api'` on rules; no crawler/Telegram auto-detection |
| URLs in crawler output | ✅ Yes | `collected_data` last 7 days, LIMIT 500, fields `metadata.url`, `normalized_data.metadata.url`, `meta.source_url` |
| URLs in Telegram messages | ❌ No | Only registered `telegram_channels` table — not message body URLs |
| URLs in `collected_data` | ✅ Yes | Primary crawler input |
| Existing crawler outputs | ✅ Yes | Via `collected_data` join |
| Existing `data_sources` | ❌ Not candidates | Used as dedupe baseline via `loadSourceFingerprints()` |
| Rule seed URLs | ✅ Yes | Enabled rules where `pattern.startsWith('http')` |

**Contract alignment:** `docs/ssot_v3/advanced/DISCOVERY_API_CONTRACT.md` §1 matches implementation.

### A2. What problem is it designed to solve?

**Purpose (UI + contract):** Suggest **new data sources** for human approval — scan crawler output and unlinked Telegram channels (plus optional rule seeds); **no auto-create**.

- UI: `auto_discovery_desc` — *"Scan crawler output and telegram channels for new source suggestions. Approval required — no auto-create."*
- Scan inserts `datahub_discovery_suggestions` with `status='pending'` only when dedupe passes.
- Approve is the **only** path that `INSERT`s into `data_sources`.

**Not designed for:** discovering individual article URLs as sources (but crawler path currently surfaces article URLs from RSS ingestion — product/implementation mismatch).

### A3. Does code prevent auto-create?

| Action | Auto-creates `data_sources`? | Evidence |
|--------|------------------------------|----------|
| `POST /scan` | ❌ No | Only inserts into `datahub_discovery_suggestions` |
| `POST /suggestions/:id/approve` | ✅ Yes | `approveSuggestion()` → `INSERT INTO data_sources` |
| `POST /suggestions/:id/reject` | ❌ No | Status update only |

**Conclusion:** Scan does not auto-create. UI claim **"Approval required — no auto-create"** is **accurate** for scan. Approve intentionally creates sources (by design).

**Gap:** Backend scan does **not** check `datahub_discovery_settings.enabled` — only the UI disables the button. API can scan while “disabled” if called directly.

---

## Phase B — Backend route and code trace

**Mount:** `backend/routes/v1/index.js` → `/api/v1/data-hub/discovery`  
**Router:** `backend/routes/data-hub-discovery.js`  
**Service:** `backend/services/datahubDiscoveryService.js`

### Routes table

| Method | Path | Handler | Auth | Validates input | Writes DB | Status |
|--------|------|---------|------|-----------------|-----------|--------|
| GET | `/settings` | `getDiscoverySettings` | `authenticate` + read limiter | — | Read `datahub_discovery_settings` | ✅ Implemented |
| PATCH | `/settings` | `updateDiscoverySettings` | `authenticate` + `authorize(admin,trader)` + write limiter | Zod `enabled: boolean` | Update settings | ✅ Implemented |
| GET | `/stats` | `getDiscoveryStats` | `authenticate` + read limiter | — | Read suggestions + settings | ✅ Implemented |
| GET | `/history` | `listScanHistory` | `authenticate` + read limiter | `limit` query (max 100) | Read `datahub_discovery_scans` | ✅ Implemented |
| GET | `/rules` | `listDiscoveryRules` | `authenticate` + read limiter | — | Read rules | ✅ Implemented |
| POST | `/rules` | `createDiscoveryRule` | write auth | Zod create schema | Insert rule | ✅ Implemented |
| PUT | `/rules/:id` | `updateDiscoveryRule` | write auth | UUID + partial schema | Update rule | ✅ Implemented |
| DELETE | `/rules/:id` | `softDeleteDiscoveryRule` | write auth | UUID param | Soft-delete rule | ✅ Implemented |
| GET | `/suggestions` | `listSuggestions` | `authenticate` + read limiter | Zod query (`status`, `discovery_source`, `limit`, `offset`) | Read suggestions | ✅ Implemented |
| POST | `/scan` | `runDiscoveryScan` | write auth | Empty body `{}` | Insert scan + suggestions; update settings | ✅ Implemented |
| POST | `/suggestions/:id/approve` | `approveSuggestion` | write auth | Zod approve body | Insert `data_sources`; update suggestion | ✅ Implemented |
| POST | `/suggestions/:id/reject` | `rejectSuggestion` | write auth | Zod reject body | Update suggestion | ✅ Implemented |

**Stubbed / hardcoded:** None — all routes delegate to real service logic.

**Response shapes (key endpoints):**

```json
// GET /stats
{ "pending": 0, "approved": 0, "rejected": 0, "duplicate": 214, "settings": { "enabled": true, "last_scan_at": "..." } }

// POST /scan
{ "scan_id": "uuid", "scan": { "id", "status", "added_count", "duplicate_count", "blocked_count", "skipped_count", "started_at", "finished_at" }, "added": 0, "duplicates": 1, "blocked": 0, "skipped": 0 }

// GET /history
{ "scans": [ { "id", "status", "added_count", "duplicate_count", "blocked_count", "skipped_count", "error_message", "started_at", "finished_at" } ] }
```

---

## Phase C — Database model audit

**Migration:** `backend/database/migrations/030_create_datahub_discovery.sql`

### Tables

#### `datahub_discovery_settings` (singleton)

| Column | Type | Notes |
|--------|------|-------|
| id | SMALLINT PK (=1) | Single row |
| enabled | BOOLEAN | Default false |
| last_scan_at | TIMESTAMPTZ | Updated on successful scan |
| updated_at | TIMESTAMPTZ | |

**Production:** 1 row — `enabled: true`, `last_scan_at: 2026-06-13T11:42:05.958Z`

#### `datahub_discovery_rules`

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| name | VARCHAR(255) | |
| pattern | TEXT | Seed URL (http only used in scan) |
| source_kind | api/rss/website/telegram | |
| category, priority | | |
| is_enabled | BOOLEAN | Default true |
| metadata | JSONB | |
| deleted_at | TIMESTAMPTZ | Soft delete |
| created_at, updated_at | TIMESTAMPTZ | Trigger on update |

**FK:** None to other discovery tables (referenced by suggestions.rule_id)

**Production count:** **0** rules

#### `datahub_discovery_scans`

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| status | running/success/failed | |
| triggered_by | UUID → users | |
| added_count, duplicate_count, blocked_count, skipped_count | INTEGER | |
| error_message | TEXT | |
| metadata | JSONB | Unused `{}` in production |
| started_at, finished_at | TIMESTAMPTZ | |

**Production count:** **12** scans (3 failed, 9 success)

#### `datahub_discovery_suggestions`

| Column | Type | Notes |
|--------|------|-------|
| status | pending/approved/rejected/duplicate | **No `pending_approval`** |
| suggested_name, suggested_type, suggested_url | | |
| host_key, path_key, title_key | | Dedupe fingerprints |
| priority_score | NUMERIC 0–100 | |
| discovery_source | crawler/telegram/known_sources/rule | |
| rule_id, scan_id | UUID FK | |
| evidence | JSONB | e.g. `collected_data_id`, `telegram_channel_id` |
| duplicate_of_source_id, duplicate_of_suggestion_id | UUID FK | |
| duplicate_reason, duplicate_confidence | | |
| approved_by, rejected_by, reviewed_at, review_note | | Audit on approve/reject |
| created_source_id | UUID → data_sources | Set on approve only |
| deleted_at, created_at, updated_at | | |

**Indexes:** status+score, host+path, unique pending (host_key, path_key, suggested_type)

**Production count:** **214** suggestions — **all `duplicate`**

### Production counts summary

| Metric | Value |
|--------|-------|
| Discovery rules | 0 |
| Suggestions `pending` | 0 |
| Suggestions `approved` | 0 |
| Suggestions `rejected` | 0 |
| Suggestions `duplicate` | 214 |
| Scan rows | 12 |
| Settings enabled | true |

### `pending_approval` — enum or i18n?

- **Not a DB status.** DB enum: `pending`, `approved`, `rejected`, `duplicate`.
- **UI bug:** `AutoDiscoveryConfig.tsx` uses `t('pending_approval')` as metric label; key **missing** from `en.json` / `fa.json` → raw key rendered.
- Stats API returns `pending` (correct field); label is wrong/missing translation.

### Latest scan record (most recent)

| Field | Value |
|-------|-------|
| scan_id | `80ef5ec6-fa72-492b-8103-29f4f099859c` |
| status | success |
| started_at | 2026-06-13T11:42:05.914Z |
| finished_at | 2026-06-13T11:42:05.957Z |
| duration | ~43 ms |
| added_count | 0 |
| duplicate_count | 1 |
| blocked_count | 0 |
| skipped_count | 0 |

---

## Phase D — Scan behavior audit

### D1. User clicks “Scan for sources”

| Step | Detail |
|------|--------|
| Endpoint | `POST /api/v1/data-hub/discovery/scan` |
| Body | `{}` |
| Frontend | `runDiscoveryScan()` in `services/dataHubDiscoveryApi.ts` |
| Hook | `useRunDiscoveryScanMutation()` |

### D2. Requires “Enable Discovery”?

- **UI:** Yes — button disabled when `!stats?.settings?.enabled` (`AutoDiscoveryConfig.tsx:114`).
- **Backend:** **No** — `runDiscoveryScan()` does not read `enabled` flag.

### D3. Requires active rules?

- **No.** `gatherCandidates()` always queries `collected_data`, `telegram_channels`, and rules.
- With 0 rules, scan still runs on crawler + Telegram inputs.

### D4. Why scan runs with 0 rules?

Rules are **optional seeds**, not a gate. Empty rules array is valid.

### D5. What data sources does it scan?

1. **Crawler:** Last 7 days of `collected_data` (up to 500 rows), joined to parent `data_sources`.
2. **Telegram:** Up to 200 `telegram_channels` without matching active telegram `data_sources` URL.
3. **Rules:** Enabled rules with HTTP patterns (0 in production).

**Production scale:** ~1,173,294 `collected_data` rows in 7d; only **500** scanned per run.

### D6–D8. Tables read / written

**Read:** `data_sources`, `datahub_discovery_suggestions` (pending/approved), `collected_data`, `telegram_channels`, `datahub_discovery_rules`, filter rules (via `evaluateFilterRules`)

**Write:** `datahub_discovery_scans`, `datahub_discovery_suggestions`, `datahub_discovery_settings.last_scan_at`

### D9–D11. Scan banner counters

| UI token | API field | Meaning |
|----------|-----------|---------|
| `+0` | `added` | New `pending` suggestions inserted this scan |
| `duplicates 1` | `duplicates` | Candidates skipped as duplicate (inserted as `status=duplicate` or unique violation) |
| `blocked 0` | `blocked` | Blocked by SSRF/invalid URL or `evaluateFilterRules` (ingestion target) |

`skipped` is tracked in DB but **not shown** in UI banner.

### D12. Duplicate detection source

`backend/utils/discoveryDedupe.js` — **not** P2 `evaluateDuplicateUrlGuard` / `urlDuplicateNormalization.js`.

Three layers:

1. **Hostname match** → confidence 82 (or 95 if path also matches)
2. **Host + path exact match** → confidence 98
3. **Title Jaccard similarity** ≥ 85%

`shouldSkipAsDuplicate`: confidence **≥ 75** → no `pending` row.

### D13. Latest human QA scan evidence

**QA observation:** Last scan ≈ **6/13/2026, 3:11:41 PM**; result `+0 · duplicates 1 · blocked 0`.

**Timezone match:** `778df96f-6235-414b-8093-52ed7ad30e18` at `2026-06-13T11:41:41.636Z` ≈ **15:11:41 Iran (UTC+3:30)** — matches QA timestamp.

| Field | Value |
|-------|-------|
| **scan_id** | `778df96f-6235-414b-8093-52ed7ad30e18` |
| started_at | 2026-06-13T11:41:41.636Z |
| finished_at | 2026-06-13T11:41:41.746Z (~110 ms) |
| status | success |
| added (pending created) | 0 |
| duplicates | 1 |
| blocked | 0 |
| skipped | 0 |
| **Candidates in this scan** | 1 (sole unlinked Telegram channel) |

**Duplicate item:**

| Field | Value |
|-------|-------|
| suggestion_id | `8461b837-c48f-4c98-9e57-e5e12a8937ed` |
| suggested_name | Test Crypto Signals |
| suggested_url | `https://t.me/@crypto_signals_test` |
| suggested_type | telegram |
| discovery_source | telegram |
| telegram_channel_id | `85d5cea5-372d-42c8-9ee6-c63de00797df` |
| duplicate_reason | `hostname_match_existing_source` |
| duplicate_confidence | 82 |
| duplicate_of_source_id | `8175957c-26a8-4544-b501-1a25a6e31afa` |
| matched source name | آژانس خبری رکنا \| Rokna NEWS Agency |
| matched source url | `https://t.me/Rokna_news` |

**Why marked duplicate:** `host_key` for all Telegram URLs is `t.me`. Paths differ (`/rokna_news` vs `/@crypto_signals_test`), but layer-1 hostname match returns confidence **82** ≥ 75. **False positive** — unrelated channels.

**P2 duplicate URL guard:** Not invoked during scan. Even if invoked, normalized Telegram identity might differ; current dedupe does not use P2 normalization.

### Historical scan progression

| Date | added | duplicates | Notes |
|------|-------|------------|-------|
| 2026-05-29 (×3) | 0 | 0 | **Failed** — `column "success_rate" does not exist` |
| 2026-05-29+ | 0 | 26→40 | Crawler article URLs from `eghtesaad24.ir` |
| 2026-06-13 | 0 | 1 | Only unlinked test Telegram channel left |

**All 214 duplicate rows:** `duplicate_reason = hostname_match_existing_source`  
- 205 crawler/rss (`eghtesaad24.ir` article URLs vs RSS feed `https://eghtesaad24.ir/fa/rss/12`)  
- 9 telegram (`t.me` hostname collision)

---

## Phase E — Rules behavior audit

### E1. What is a discovery rule?

A named **seed URL** (+ metadata) used to inject an extra scan candidate. Stored in `datahub_discovery_rules`.

### E2. “Pattern or seed URL” semantics

**Not regex.** Code only processes rules where `rule.pattern.startsWith('http')` — treated as a **URL** passed through `normalizeDiscoveryUrl()`. Non-HTTP patterns are **silently skipped**.

No domain-only or Telegram username pattern matching.

### E3. Suggested type (`source_kind`)

| UI value | Maps to `suggested_type` |
|----------|--------------------------|
| website | `web` |
| rss | `rss` |
| telegram | `telegram` |
| api | `api` |

### E4–E5. Rules required? Why scan with 0?

Not required. Scan uses crawler + Telegram regardless.

### E6. Active/inactive

`is_enabled` on rule; only enabled rules queried. Default **true** on create. UI does not expose enable/disable toggle (only delete).

### E7. Validation

Zod: name 1–255 chars, pattern 1–2000 chars, enum source_kind. **No URL format validation** at schema level; invalid HTTP URLs skipped in `gatherCandidates` try/catch.

### E8–E10. Where rules apply

| Target | Applied? |
|--------|----------|
| `collected_data` | ❌ Rules don't filter crawler output |
| Crawler output | ❌ Only as separate seed candidate |
| Telegram messages | ❌ |

Rules add **one candidate per enabled HTTP pattern**, not filter/match against content.

### UI modal vs API

Modal sends: `name`, `pattern`, `source_kind`, `category` (hardcoded `uncategorized`), `priority` (hardcoded `medium`). Category/priority not shown in modal.

---

## Phase F — Suggestions workflow audit

### F1. What creates a suggestion?

`runDiscoveryScan()` loop over `gatherCandidates()` results → INSERT `datahub_discovery_suggestions` as `pending` or `duplicate`.

### F2. Statuses

| Status | Exists in DB | Shown in UI |
|--------|--------------|-------------|
| pending | ✅ | Suggestions tab (only this status fetched) |
| approved | ✅ | Stats count only |
| rejected | ✅ | Stats count only |
| duplicate | ✅ | Not shown in UI |
| pending_approval | ❌ | N/A — i18n label bug only |

### F3. Why raw `pending_approval`?

`AutoDiscoveryConfig.tsx:136` calls `t('pending_approval')`. Key absent from locale files → i18n fallback shows raw key. Should use `discovery_status_pending` or new `discovery_pending_approval` key.

### F4–F5. Approve behavior

`approveSuggestion()`:

1. Validates `status === 'pending'`
2. `assertSafeDiscoveryUrl`
3. `evaluateFilterRules` (ingestion)
4. **`INSERT INTO data_sources`** with `config.created_from = 'discovery_approval'`
5. Updates suggestion → `approved`, sets `created_source_id`, `approved_by`, `reviewed_at`

### F6–F9. Duplicate guards on approve

| Check | Called? |
|-------|---------|
| P2 `evaluateDuplicateUrlGuard` | ❌ **No** |
| Source name duplicates | ❌ No |
| Telegram channel ID/username (P2) | ❌ No |
| Discovery `checkDuplicateLayers` | ❌ No (only at scan) |

**Risk:** If dedupe is fixed and pending suggestions appear, approve can create duplicate active URLs unless P2 guard added.

### F10. Reject + audit trail

Reject sets `rejected_by`, `reviewed_at`, `review_note`. Approve sets `approved_by`, etc. **Audit columns exist** but never populated in production (no approve/reject ever).

### Production workflow evidence

| Event | Count |
|-------|-------|
| Real `pending` suggestion | **0 ever** |
| Approved | **0** |
| Rejected | **0** |
| Duplicate records | **214** |

---

## Phase G — History UX audit

### G1. History API exists?

✅ `GET /api/v1/data-hub/discovery/history?limit=N` — returns `{ scans: [...] }`.

### G2. Usable data?

✅ Yes — 12 scan rows with counts, timestamps, status, `error_message` on failures.

### G3–G4. Why UI doesn't render?

`AutoDiscoveryConfig.tsx` History tab (lines 309–312) only renders:

```tsx
{t('discovery_history_hint')}
// "Scan history is available via GET /api/v1/data-hub/discovery/history."
```

- `fetchDiscoveryHistory()` exists in `dataHubDiscoveryApi.ts`
- **No hook** in `useDataHubDiscovery.ts`
- **No query/mutation** wired — deliberate placeholder / incomplete frontend

### G5. Backend missing fields?

Partial. Missing for ideal UX:

- `triggered_by` user display name (UUID only in DB)
- Per-scan candidate list / detail endpoint
- `metadata` unused (could store candidate sources scanned)

### G6. Recommended history UI (document only)

| Column | Source |
|--------|--------|
| Scan time | `started_at` |
| Duration | `finished_at - started_at` |
| Status | `status` |
| New suggestions | `added_count` |
| Duplicates skipped | `duplicate_count` |
| Blocked | `blocked_count` |
| Skipped (SSRF) | `skipped_count` |
| Error | `error_message` |
| Actions | “View details” → future detail drawer |

---

## Phase H — i18n audit

### Known missing / raw keys

| Key | File | English expected | Persian (fa.json) |
|-----|------|------------------|-------------------|
| `pending_approval` | `AutoDiscoveryConfig.tsx:136` | "Pending approval" | "در انتظار تأیید" — **missing** |

### Other i18n issues

| Issue | File | Detail |
|-------|------|--------|
| Hardcoded `API` | `DiscoveryRuleModal.tsx:67` | Not using `t()` |
| Raw `discovery_source` enum | `AutoDiscoveryConfig.tsx:215` | Shows `telegram`, `crawler` untranslated |
| `discovery_history_hint` | locales | Exposes API path to end users — bad UX copy |
| `discovery_empty_hint` | locales | Says "active rules" required — **misleading** (rules optional) |
| Fallback `'Auto discovery'` | `AutoDiscoveryConfig.tsx:179` | English fallback in ariaLabel |

### Keys present and correct

`discovery_status_*`, `auto_discovery_desc`, `discovery_scan_result`, `discovery_dup`, `discovery_blocked`, tab labels, rule modal labels (except API).

---

## Phase I — Integration with Duplicate URL Guard (P2)

| Checkpoint | Status | Evidence |
|------------|--------|----------|
| Scan calls P2 duplicate detection | ❌ | Uses `discoveryDedupe.js` host/path/title only |
| Suggestion creation skips P2 duplicates | ❌ | Hostname-layer false positives instead |
| Approve calls `evaluateDuplicateUrlGuard` | ❌ | `approveSuggestion()` direct INSERT |
| Duplicate details returned to UI | ❌ | Scan response has counts only; duplicate suggestions not listed |
| Telegram channel ID/username dedupe | ❌ | All `t.me` share `host_key` |
| RSS/web/API normalized URL dedupe | ❌ | Not used; article URLs ≠ normalized feed URLs |

**Risk before sign-off:** **HIGH** — discovery dedupe is logically broken for Telegram and RSS-domain cases; approve path bypasses P2 guard.

---

## Phase J — Production status verdict

### Classification: **D) BROKEN / UNSAFE**

**Rationale:**

1. **Broken core value:** 12 scans, 214 suggestions, **zero** actionable `pending` — feature cannot fulfill “suggest new sources for approval.”
2. **Broken dedupe:** 100% of duplicates from `hostname_match_existing_source` with false positives (Telegram `t.me`, RSS article URLs vs feed domain).
3. **Unsafe approve path:** No P2 guard; would create duplicates if dedupe fixed without guard.
4. **Partial UI:** History unimplemented; scan feedback inadequate; misleading empty states.
5. **Not UI-only:** Backend is real and writes DB — but behavior is incorrect for production use.

**Not A (FULLY WORKING):** No pending suggestions, no approvals, history UI missing, dedupe wrong.  
**Not B (PARTIAL) alone:** Backend completeness exceeds partial, but production outcome is failure — elevated to D.  
**Not C (UI ONLY):** Substantial backend with 214 DB rows and 12 scans.

---

## Phase K — Recommended Phase 2 plan

### P2.1 Fix dedupe semantics (blocker)

1. **Telegram:** Compare normalized channel username/slug in `path_key`, not `t.me` hostname alone. Integrate P2 Telegram identity normalization.
2. **Crawler/RSS:** Do not suggest raw article URLs as sources — extract **feed/site root** or only suggest URLs that look like feeds (`/rss`, `.xml`, `feed`). Or restrict crawler candidates to net-new domains only (no hostname-only skip).
3. Raise hostname-only match threshold or **remove** hostname-only duplicate for multi-tenant hosts (`t.me`, `medium.com`, etc.).
4. Optionally call `evaluateDuplicateUrlGuard` at scan time for consistent semantics with Data Sources P2.

### P2.2 Scan UX

1. Require `enabled` on backend for `POST /scan`.
2. Replace banner with: candidates scanned, new suggestions, duplicates (with link), blocked, rules used count.
3. Empty state when 0 rules: clarify rules optional; explain crawler + Telegram sources.
4. Post-scan detail panel listing duplicate items with `duplicate_reason` + matched source.

### P2.3 History UI

1. Add `useDiscoveryHistoryQuery` hook.
2. Render table from `GET /history`.
3. Optional: `GET /scans/:id/suggestions` for detail drill-down.

### P2.4 Suggestions UI

1. Tab filter: pending / duplicate / all.
2. Show confidence, reason, matched source name for duplicates.
3. Fix `pending_approval` → `discovery_pending_approval` i18n.

### P2.5 Approval safety

1. Call `evaluateDuplicateUrlGuard` in `approveSuggestion()` — return `409 DUPLICATE_ACTIVE_URL` with details.
2. Telegram username collision check aligned with P2/P3.

### P2.6 Rules UI

1. Document pattern = full HTTP seed URL.
2. Validate URL on create (client + server).
3. Expose `is_enabled`, `category`, `priority` if product needs them.

### P2.7 Tests

- Scan with 0 rules → candidates from crawler/Telegram only
- Scan with rules → seed candidate included
- Telegram distinct channels → `pending` not false duplicate
- RSS article URL → does not duplicate solely on domain
- Approve creates source
- Approve duplicate blocked by P2 guard
- History API + UI render

---

## Phase L — Deliverables summary

### 1. RCA document

This file: `docs/ssot_v3/DH-AUTODISCOVERY-P1-RCA.md`

### 2. Reference tables

**Routes:** § Phase B (12 endpoints, all implemented)  
**DB tables:** § Phase C (4 tables)  
**Production counts:** § Phase C summary  
**Scan behavior:** § Phase D  
**Risks:** § Phase I + Verdict

### 3. Latest QA scan evidence

**Scan `778df96f-6235-414b-8093-52ed7ad30e18`** — `+0 · duplicates 1 · blocked 0`  
Duplicate: Test Crypto Signals (`@crypto_signals_test`) falsely matched to unrelated Rokna Telegram source via `t.me` hostname rule.

### 4. Verdict

**D) BROKEN / UNSAFE**

### 5. Recommended next implementation task

**DH-AUTODISCOVERY-P2:** Fix Telegram/RSS dedupe false positives, integrate P2 guard on approve, wire History UI, improve scan result detail, fix `pending_approval` i18n.

---

## Appendix — File reference

| Area | Path |
|------|------|
| Migration | `backend/database/migrations/030_create_datahub_discovery.sql` |
| Routes | `backend/routes/data-hub-discovery.js` |
| Service | `backend/services/datahubDiscoveryService.js` |
| Dedupe | `backend/utils/discoveryDedupe.js` |
| Safety | `backend/utils/discoverySafety.js` |
| Scoring | `backend/utils/discoveryScoring.js` |
| P2 guard (not wired) | `backend/services/dataSourceUrlDuplicateService.js` |
| UI | `components/ai/AIManager/tabs/DataHub/advanced/AutoDiscoveryConfig.tsx` |
| Rule modal | `components/ai/AIManager/tabs/DataHub/modals/DiscoveryRuleModal.tsx` |
| API client | `services/dataHubDiscoveryApi.ts` |
| Hooks | `hooks/useDataHubDiscovery.ts` |
| Contract | `docs/ssot_v3/advanced/DISCOVERY_API_CONTRACT.md` |
| Locales | `deploy/blue/locales/en.json`, `fa.json` |

---

*Audit completed read-only against production DB on 2026-06-13. No scheduler, crawler, pipeline, normalization, or duplicate URL systems were modified.*
