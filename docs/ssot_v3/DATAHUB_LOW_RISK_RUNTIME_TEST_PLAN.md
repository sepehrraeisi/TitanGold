# DataHub Low-Risk Runtime Test Plan (DH-FINAL-3)

> **Status:** Plan / docs only — **no runtime execution yet**  
> **Date:** 2026-05-29  
> **Prerequisite:** [`DATAHUB_RUNTIME_ACTION_INVENTORY.md`](./DATAHUB_RUNTIME_ACTION_INVENTORY.md) (DH-FINAL-1), bug fixes DH-FINAL-2 (`9274e35`)  
> **Next phase:** DH-FINAL-4 executes this plan; DH-FINAL-5+ covers high-risk writes separately.

---

## Goal

Verify read/list/preview/dry-run DataHub actions return **200 + sane UI** before touching destructive or outbound actions (apply, publish, dispatch, archive execute, approve, CRUD deletes, etc.).

---

## Test account & environment

| Requirement | Detail |
|-------------|--------|
| **Role** | `admin` or `trader` (required for Advanced **preview/dry-run POSTs**; Core **GETs** need any authenticated user) |
| **Session** | Valid `titan_token` in localStorage or sessionStorage (UI login) |
| **Backend** | `GET http://127.0.0.1:5002/health` → **200** before starting |
| **DB** | Postgres up; migrations applied (no new migration in this phase) |
| **Discovery / Prioritization toggles** | May stay as-is; **do not toggle** settings in this phase |
| **Telegram collector** | Optional for subset T-* ; collector service running if testing collector **GET** health only |

### UI vs curl-auth

| Mode | When to use | Notes |
|------|-------------|-------|
| **UI (primary)** | All Core reads, CSV export, tab navigation, Advanced list panels | Record Network tab status + screenshot if fail |
| **curl-auth (secondary)** | Spot-check same endpoint as UI; regression for already-verified POSTs | JWT: login UI → copy token, or sign with `JWT_SECRET` + `{ userId }` matching DB session |
| **curl unauth** | **Not sufficient** for protected routes — only proves route mounted (401) |

---

## Global stop conditions

**Stop the entire DH-FINAL-3 run immediately if any of:**

1. `GET /health` fails or backend not listening on `:5002`
2. Any Core read returns **500** on first attempt (after one Retry click)
3. Raw HTTP strings appear in UI (`Not Found`, `Internal Server Error`, `Unauthorized` as literal title)
4. Unexpected **403** on Core GET for admin/trader account (indicates auth misconfiguration)
5. Test account lacks admin/trader and Advanced preview/dry-run batch is reached → **stop Advanced POST section**, document role gap; do not escalate privileges mid-run

**Per-test stop:** Record failure evidence, **do not** click destructive buttons listed in [Must not click](#must-not-click), continue remaining tests unless global stop triggered.

---

## Must not click (this phase)

| Category | Forbidden actions |
|----------|-------------------|
| Sources / Categories | Create, Edit Save, Delete (soft/hard), Restore, Test connection, View collected data modal (INV-004 — defer) |
| Pipeline / Health / Logs | Any action beyond Refresh / Retry / filters / export |
| Discovery | Scan, Approve, Reject, Enable toggle, Add/Delete rule |
| Prioritization | Preview, Apply, Override, Enable toggle, Configure Save |
| Crawlers | Create, Edit, Delete, **Run (live)** |
| Publisher | Create, Publish, Disable, Test (deferred to optional dry-run batch with guards) |
| Automation | Create/Edit/Delete topic, Refresh queue, Dispatch, Fail item, Retry execution, Schedule toggle |
| Archiving | Archive execute, Restore execute (any confirm modal) |
| Access / Safety | Save, Reset, Create/Update/Delete rule |
| Telegram Collector | Login, Sync sources, Register channels, Force sync, Test fetch, Link channel, any PATCH/POST |
| Telegram Analytics | Mark processed (write — DH-FINAL-5+) |

---

## Evidence to record

For each test (pass or fail):

| Field | Example |
|-------|---------|
| Test ID | `C-01` |
| Timestamp (UTC) | `2026-05-29T14:30:00Z` |
| Tester / method | `UI` or `curl` |
| HTTP status | `200` |
| Response snippet | `{ "data": [...], "pagination": {...} }` or UI: row count |
| Screenshot / HAR | Optional on fail; Network tab endpoint + status on fail |
| Notes | Empty state OK? Sanitized error banner? |

Store results in a follow-up doc or PR comment table when DH-FINAL-4 runs (this file is the plan only).

---

## Already verified — skip or light regression only

| Action | Evidence | DH-FINAL-3 treatment |
|--------|----------|----------------------|
| Discovery Scan | `ca6226e` — POST 200 success | **Exclude** (write + side effects); optional regression curl in DH-FINAL-7 |
| Prioritization Preview | `ca6226e` — POST 200, 48 sources | **Exclude** (writes preview run rows); optional regression later |
| UX-2 query sanitize | commits `4f09e00`–`6b2dc0f` | Observe during reads — no raw 404/500 strings |
| INV-001 CSV export | `9274e35` | Include in client-only batch |
| INV-002 mark-processed auth | `9274e35` | **Exclude** (write) from this phase |

---

## Test matrix — Core reads

| Test ID | Area | Action | Endpoint / UI path | Method | Risk | Preconditions | Expected result | Stop condition |
|---------|------|--------|-------------------|--------|------|---------------|-----------------|----------------|
| C-01 | Summary | KPI load / Retry | `AI Center → DataHub` header cards · Retry | GET `/api/v1/data-sources/stats`, `/health` | Low | Logged in; tab visible | Cards show numbers or N/A (cache); no mock `75%`; no raw error | 500 or raw error text → global stop |
| C-02 | Sources | Open tab + list load | `DataHub → Sources` | GET `/api/v1/data-sources?page=1&limit=20` | Low | Same session | Table or empty state; pagination if rows; sanitized alert only on fail | 500 on load |
| C-03 | Sources | Refresh | Click Refresh | GET same as C-02 | Low | C-02 pass | Refetch; spinner settles; data unchanged or updated | 500 after retry |
| C-04 | Sources | Pagination Next | Next page (if enabled) | GET `page=2` | Low | `pagination.hasNextPage` | Page 2 loads or control disabled | 500 |
| C-05 | Categories | Open + list | `DataHub → Categories` | GET `/api/v1/data-categories/` | Low | Logged in | List or empty; no crash | 500 |
| C-06 | Categories | Refresh | Refresh button | GET same | Low | C-05 pass | List refetch OK | 500 |
| C-07 | Pipeline | Open + load | `DataHub → Pipeline` | GET `/api/v1/data-sources/pipeline` | Low | Tab switch | Metrics or `pipeline_empty_state`; no raw API string | 500 → alert + retry works or global stop |
| C-08 | Pipeline | Refresh | Refresh Pipeline | GET same | Low | C-07 pass | Snapshot refetch | 500 |
| C-09 | Health | Open + load | `DataHub → Health` | GET `/health`, `/stats`, `/state`, `/access-logs?limit=1` | Low | Tab switch | Status translated; counts numeric; avg response/cache = N/A | Any query 500 + broken UI |
| C-10 | Health | Refresh all | Retry on banner if shown, else tab re-enter | GET same quartet | Low | C-09 pass | All cards populate or graceful N/A | Persistent 500 |
| C-11 | Logs | Open + load | `DataHub → Logs` | GET `/access-logs?limit=100&offset=0` | Low | Tab switch | Table or `no_logs`; status metric cards | 500 |
| C-12 | Logs | Retry | Retry on alert (if error injected) | GET same | Low | Optional: only if C-11 showed error | List reload | — |
| C-13 | Logs | Filters | Status / agent / telegram-only toggles | — (client) | None | Rows present optional | Filtered view; no API call | — |

---

## Test matrix — Client-only

| Test ID | Area | Action | Endpoint / UI path | Method | Risk | Preconditions | Expected result | Stop condition |
|---------|------|--------|-------------------|--------|------|---------------|-----------------|----------------|
| K-01 | Sources | Export CSV | Sources → Export CSV | Client `downloadCSV` | None | ≥1 source row | File downloads; headers = source fields; **not** filename-as-data (INV-001 regression) | Empty file or `[object Object]` rows |
| K-02 | Categories | Export CSV | Categories → Export CSV | Client | None | ≥1 category (or filtered subset) | Valid CSV | Download fails |
| K-03 | Logs | Export CSV | Logs → Export CSV | Client | None | ≥1 log row | Valid CSV | Download fails |

---

## Test matrix — Advanced safe reads

| Test ID | Area | Action | Endpoint / UI path | Method | Risk | Preconditions | Expected result | Stop condition |
|---------|------|--------|-------------------|--------|------|---------------|-----------------|----------------|
| A-01 | Crawlers | List load | `Advanced → Crawlers` | GET `/api/v1/data-hub/crawlers` | Low | admin/trader login | List + summary metrics or empty | 500 |
| A-02 | Crawlers | Run history expand | Expand row → history | GET `/api/v1/data-hub/crawlers/:id/runs` | Low | ≥1 crawler exists | Runs list or empty | 404/500 |
| A-03 | Discovery | Stats + suggestions | `Advanced → Discovery` | GET `/discovery/stats`, `/suggestions?status=pending` | Low | Tab open | Dashboard cards; pending list or empty | Query banner with sanitized i18n only |
| A-04 | Discovery | Rules list | Rules sub-tab | GET `/discovery/rules` | Low | Same | Rules or empty | 500 |
| A-05 | Prioritization | Settings + sources + runs | `Advanced → Prioritization` | GET `/settings`, `/sources`, `/runs` | Low | Tab open | Table or empty; tiers/scores 0–100 | 500 |
| A-06 | Access Control | List | `Advanced → Access Control` | GET `/api/v1/data-hub/access-control/` | Low | Tab open | Per-source cards | 500 |
| A-07 | Safety | Rules list | `Advanced → Safety Filtering` (each tab) | GET `/filter-rules?active_only=true` | Low | Tab open | Rules or empty | 500 |
| A-08 | Safety | Evaluate (read-only POST) | Evaluate tab → sample URL/text → Evaluate | POST `/filter-rules/evaluate` | Low | No rule mutation | `{ allowed: true/false, reason }` | 500; **do not** create rules |
| A-09 | Publisher | List + metrics | `Advanced → Telegram Publisher` | GET `/telegram-publishers/` | Low | Tab open | Channels + metrics or empty | 500 unsanitized |
| A-10 | Publisher | History tab | Select channel → History | GET `/telegram-publishers/:id/history` | Low | ≥1 publisher | History rows or empty | 404/500 |
| A-11 | Automation | Overview load | `Advanced → Automation` | GET `/automation/overview` | Low | Tab open | Topics, queue, schedule, summary | 500 |
| A-12 | Archiving | Dashboard | `Advanced → Archiving` | GET `/archiving/stats`, `/archiving/records` | Low | Tab open | Health counts; partitions; records page | 500 |

---

## Test matrix — Preview-only POSTs (no execute)

| Test ID | Area | Action | Endpoint / UI path | Method | Risk | Preconditions | Expected result | Stop condition |
|---------|------|--------|-------------------|--------|------|---------------|-----------------|----------------|
| P-01 | Archiving | Archive preview | Preview / dry-run button (no confirm) | POST `/archiving/archive/preview` `{days_old}` | Low | admin/trader; **do not** open confirm modal | `{ pending_count, ... }`; no row move | 500; **abort if confirm dialog appears** — cancel immediately |
| P-02 | Archiving | Restore preview | Restore preview with date range | POST `/archiving/restore/preview` | Low | Valid date inputs | Preview count | 500; no restore confirm |
| P-03 | Archiving | Purge preview | Purge preview | POST `/archiving/purge/preview` | Low | Same | `would_purge_count`; no delete | 500 |

---

## Test matrix — Dry-run POSTs (optional batch — run last, guarded)

> Run only after all Core + Advanced reads pass. **Skip entire batch** if env cannot guarantee no live side effects.

| Test ID | Area | Action | Endpoint / UI path | Method | Risk | Preconditions | Expected result | Stop condition |
|---------|------|--------|-------------------|--------|------|---------------|-----------------|----------------|
| D-01 | Crawlers | Dry run | Crawlers → Dry run on **one** crawler | POST `/crawlers/:id/run` `{dry_run:true}` | Medium | admin/trader; verify `dry_run:true` in Network payload; **never** click Run (live) | Run status success; **no** new `collected_data` rows (spot-check count optional) | Live run clicked; 403 pre-crawl → record, continue |
| D-02 | Publisher | Test message | Publisher → Test on channel with **no bot token** or `TELEGRAM_PUBLISHER_DRY_RUN=true` | POST `/telegram-publishers/:id/test` | Medium | Confirm env dry-run; **do not** Publish | `dry_run: true` or test OK in response | Any live Telegram send; cancel Publish prompts |
| D-03 | Automation | Test run | Automation → Test run with **Dry-run toggle ON** | POST `/automation/test-run` `{dry_run:true}` | Medium | Toggle verified ON before click; queue may mutate — acceptable | 200; execution dry_run in history | Dry-run toggle OFF; Dispatch clicked |

**Explicitly excluded from dry-run batch:** Discovery Scan, Prioritization Preview (already verified writes), Automation Refresh queue (adds queue rows), Publisher Publish.

---

## Test matrix — Telegram analytics reads (optional)

| Test ID | Area | Action | Endpoint / UI path | Method | Risk | Preconditions | Expected result | Stop condition |
|---------|------|--------|-------------------|--------|------|---------------|-----------------|----------------|
| T-01 | Telegram Data | Overview refresh | `DataHub → Telegram` analytics tab | GET `/telegram/health`, `/agents/summary` | Low | Tab open | Metrics or `-`; overview empty/loading i18n | Agents 500 unsanitized |
| T-02 | Telegram Data | Agent feed read | AI Inbox → select agent | GET `/agents/:key/feed` | Low | Bearer token | Message list or empty | 401/404 |
| T-03 | Telegram Data | Categories / Breaking / Map | Sub-tabs | GET `/categories/summary`, `/breaking-news`, `/events/recent` | Low | Same session | Charts/cards or empty | 401 |

**Excluded:** Telegram Collector panel (most actions are POST/mutate); mark-processed; sync; login wizard.

---

## Recommended execution order (DH-FINAL-4)

| Phase | Tests | Rationale |
|-------|-------|-----------|
| 0 | Backend `GET /health` | Gate |
| 1 | C-01 → C-13 | Core reads — highest traffic |
| 2 | K-01 → K-03 | Client CSV — INV-001 regression |
| 3 | A-01 → A-12 | Advanced lists |
| 4 | P-01 → P-03 | Archiving previews only |
| 5 | T-01 → T-03 | Telegram analytics reads (optional) |
| 6 | D-01 → D-03 | Dry-run batch — **only if phases 1–4 green** |

---

## Out of scope (DH-FINAL-3 / DH-FINAL-4)

Deferred to **high-risk phase** (inventory P0/P1):

- Hard delete, live crawler run, publisher live publish, automation dispatch (live), archiving execute/restore execute, prioritization apply, discovery approve/reject, source/category CRUD, telegram force sync/register, filter/access writes, prioritization override, collector login/sync/test-fetch

Deferred **code fixes** (not blockers for read tests):

- INV-003 refresh channels button missing  
- INV-004 View collected data modal  
- INV-005 core RBAC (document only if viewer role tested)

---

## Changelog

| Date | Change |
|------|--------|
| 2026-05-29 | DH-FINAL-3 initial plan — docs only |
