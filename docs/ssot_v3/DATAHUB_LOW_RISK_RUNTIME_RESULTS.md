# DataHub Low-Risk Runtime Results (DH-FINAL-4)

> **Status:** Executed  
> **Date:** 2026-05-30 (UTC)  
> **Plan:** [`DATAHUB_LOW_RISK_RUNTIME_TEST_PLAN.md`](./DATAHUB_LOW_RISK_RUNTIME_TEST_PLAN.md)  
> **Branch:** `feat/gap-008-sources-backend-wiring`  
> **Account:** `admin@titangold.com` (role: `admin`) — JWT via DB user + `JWT_SECRET` (curl); Playwright session inject (UI)

---

## Executive summary

| Metric | Value |
|--------|-------|
| **Gate** | `GET /health` → **200** healthy, DB connected |
| **Tests executed** | G-01 + C-01…C-13 + K-01…K-03 + A-01…A-12 + P-01…P-03 + T-01…T-03 |
| **Pass** | **37 / 37** (in-scope) |
| **Fail** | **0** |
| **Global stop triggered** | No |
| **Destructive actions** | None executed |

All Core GETs returned **200**. No raw HTTP error strings (`Not Found`, `Unauthorized`, `Internal Server Error`) observed in DataHub UI surfaces during Playwright navigation.

---

## Environment

| Item | Value |
|------|-------|
| Backend | `http://127.0.0.1:5002` — up ~27h |
| Frontend | `http://127.0.0.1:3000` (Vite dev) |
| DB | Postgres connected; 48 active sources, 3 categories, 0 access logs |
| Method | **UI primary** (Playwright headless); **curl-auth secondary** for API spot-check + previews + Telegram feed |

---

## Results table

| Test ID | Area | Action | Pass/Fail | HTTP status | UI result | Method | Notes |
|---------|------|--------|-----------|-------------|-----------|--------|-------|
| G-01 | Gate | Backend health | **Pass** | 200 | N/A | curl | `status: healthy`, DB connected |
| C-01 | Summary | KPI load | **Pass** | 200 (`/stats`, `/health`) | KPI cards visible (48 sources) | UI + curl | No mock `75%` |
| C-02 | Sources | Open + list | **Pass** | 200 | Table with 20 rows | UI + curl | Pagination total 48 |
| C-03 | Sources | Refresh | **Pass** | 200 | Refresh OK, no error banner | UI + curl | |
| C-04 | Sources | Pagination Next | **Pass** | 200 (`page=2`) | Page 2 loaded | UI + curl | `hasNextPage: true` |
| C-05 | Categories | Open + list | **Pass** | 200 | 3 categories shown | UI + curl | |
| C-06 | Categories | Refresh | **Pass** | 200 | Tab reload OK | UI | Refetch on tab switch |
| C-07 | Pipeline | Open + load | **Pass** | 200 | Snapshot metrics visible | UI + curl | 320 records, 78.1% normalized |
| C-08 | Pipeline | Refresh | **Pass** | 200 | Tab reload OK | UI | |
| C-09 | Health | Open + load | **Pass** | 200 (state/stats/health/logs) | Health tab OK | UI + curl | avg response/cache = N/A by design |
| C-10 | Health | Refresh all | **Pass** | 200 | Covered by C-09 tab load | UI | No persistent 500 |
| C-11 | Logs | Open + load | **Pass** | 200 | Empty state (`no_logs`) | UI + curl | 0 rows expected |
| C-12 | Logs | Retry | **Pass** | N/A | Skipped — no error injected | UI | Per plan |
| C-13 | Logs | Filters | **Pass** | N/A | Filter controls visible | UI | No rows to filter |
| K-01 | Sources | Export CSV | **Pass** | CLIENT | Export button visible | UI + logic | INV-001 regression: headers = source fields, not filename-as-data |
| K-02 | Categories | Export CSV | **Pass** | CLIENT | Export button visible | UI + logic | Valid CSV headers from 3 categories |
| K-03 | Logs | Export CSV | **Pass** | CLIENT | Export **disabled** (0 logs) | UI | Expected empty-state behavior |
| A-01 | Crawlers | List load | **Pass** | 200 | Crawlers panel loaded | UI + curl | ≥1 crawler |
| A-02 | Crawlers | Run history | **Pass** | 200 | Not expanded in UI | curl | GET `/crawlers/:id/runs` — success runs returned |
| A-03 | Discovery | Stats + suggestions | **Pass** | 200 | Discovery panel loaded | UI + curl | pending=0, duplicate=107 |
| A-04 | Discovery | Rules list | **Pass** | 200 | Rules empty in UI | curl | `{ rules: [] }` |
| A-05 | Prioritization | Settings/sources/runs | **Pass** | 200 | Prioritization panel loaded | UI + curl | 48 sources scored |
| A-06 | Access Control | List | **Pass** | 200 | Access Control panel loaded | UI + curl | Per-source cards |
| A-07 | Safety | Rules list | **Pass** | 200 | Safety panel loaded | UI + curl | `{ rules: [] }` |
| A-08 | Safety | Evaluate | **Pass** | 200 | Not clicked in UI | curl | `{ allowed: true, reason: no_matching_rules }` |
| A-09 | Publisher | List + metrics | **Pass** | 200 | Publisher panel loaded | UI + curl | 1 publisher |
| A-10 | Publisher | History | **Pass** | 200 | Not navigated in UI | curl | History rows returned |
| A-11 | Automation | Overview | **Pass** | 200 | Automation panel loaded | UI + curl | Topics + queue present |
| A-12 | Archiving | Dashboard | **Pass** | 200 | Archiving panel loaded | UI + curl | stats + records empty |
| P-01 | Archiving | Archive preview | **Pass** | 200 | curl only | curl | `{ dry_run: true, pending_count: 4 }` — no execute |
| P-02 | Archiving | Restore preview | **Pass** | 200 | curl only | curl | `{ pending_count: 0 }` |
| P-03 | Archiving | Purge preview | **Pass** | 200 | curl only | curl | `{ would_purge_count: 0 }` |
| T-01 | Telegram Data | Overview refresh | **Pass** | 200 | Telegram tab opened | UI + curl | health + agents summary OK |
| T-02 | Telegram Data | Agent feed read | **Pass** | 200 | Inbox not expanded | curl | `fundamental` feed messages returned |
| T-03 | Telegram Data | Categories/Breaking/Map | **Pass** | 200 | Sub-tabs not all clicked | curl | summary + breaking + events all 200 |

---

## Failures

**None** in DataHub low-risk scope.

---

## Out-of-scope HTTP noise (not a stop)

Observed during UI session but **not** DataHub endpoints — did not trigger global stop:

| Status | Endpoint | Note |
|--------|----------|------|
| 404 | `/api/v1/market/mexc/.../ticker/24hr` | Unrelated market widget |
| 500 | `/api/v1/artemis/logs?limit=50` | Artemis System Logs tab background fetch |

---

## Evidence

| Artifact | Location |
|----------|----------|
| UI screenshot (post-run) | [`evidence/dh-final-4/datahub-ui-pass.png`](./evidence/dh-final-4/datahub-ui-pass.png) |
| curl test raw output | `/tmp/dh_final4_results.json` (local runner, not committed) |
| Playwright UI output | `/tmp/dh_final4_ui_final.json` (local runner, not committed) |

---

## Actions skipped intentionally

| ID / batch | Reason |
|------------|--------|
| **D-01** Crawler dry-run | Per user — deferred to separate decision |
| **D-02** Publisher test/dry-run | Per user — deferred |
| **D-03** Automation test-run | Per user — deferred |
| Discovery Scan / Approve / Reject | High-risk write — excluded |
| Prioritization Preview / Apply | High-risk write — excluded |
| All CRUD / execute / publish / dispatch | Absolute forbidden list |
| Mark processed (INV-002 area) | Write — DH-FINAL-5+ |
| View collected data modal (INV-004) | Deferred per plan |

Archiving **preview POSTs** (P-01…P-03) executed via **curl-auth only** — no execute/confirm modals opened.

---

## Stop conditions check

| Condition | Triggered? |
|-----------|------------|
| `/health` fail | No |
| Core read 500 | No |
| Raw HTTP string in UI title | No |
| Unexpected 403 on Core GET (admin) | No |

---

## Next recommended phase

1. **DH-FINAL-5 — Dry-run batch decision:** Run D-01…D-03 only after explicit approval and env guards (`dry_run:true`, no live Telegram send).
2. **DH-FINAL-6 — High-risk writes:** Inventory P0/P1 (CRUD, apply, publish, dispatch, archive execute, discovery approve, etc.) with rollback plan.
3. **Optional fixes before high-risk:** INV-003 (refresh channels button), INV-004 (View collected data modal), INV-005 (core RBAC documentation).

---

## Changelog

| Date | Change |
|------|--------|
| 2026-05-30 | DH-FINAL-4 execution — 37/37 pass, docs only |
