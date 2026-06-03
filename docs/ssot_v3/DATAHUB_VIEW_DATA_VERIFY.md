# DataHub View Data — DH-QA-VERIFY-1

> **Date:** 2026-06-03  
> **Fix commit:** `1da1dc5` (`fix(datahub): wire View Data modal to collected_data API`)  
> **Target:** Local Vite dev `http://127.0.0.1:3000` → proxy → backend `:5002`  
> **Method:** Playwright headless (`tmp-dh-qa-verify-1.mjs`, not committed); admin JWT session inject (no secrets logged)

---

## Executive summary

| Result | Detail |
|--------|--------|
| **View Data (source with data)** | **Pass** — records render; pagination `1-20 / 257` |
| **View Data (source without data)** | **Pass** — `No records found`; total `0` |
| **API error handling** | **Pass** — `Failed to fetch` banner + **Retry**; not shown as empty list |
| **Network** | **Pass** — `GET /api/v1/data-sources/collected?source_id=…&limit=20&offset=0` → **200** |
| **DataHub mutations** | **Pass** — no POST/PUT/PATCH/DELETE on `/data-sources` or `/data-hub` during test |
| **Modal styling** | **Pass** — slate gradient modal (not legacy `bg-card` monolith) |
| **Final status** | **View Data FIXED** |

Production (`https://titan.zala.ir`) was **not** re-tested in this run; verification used the branch build at `1da1dc5` on local dev.

---

## Sources exercised

| Case | ID | Name | Type | Page |
|------|-----|------|------|------|
| With data | `b1ec7306-fc00-4d3c-8857-0a3000aa422a` | اقتصاد 24 دلار و ارز | rss | 2 |
| Without data | `ba8ec2c7-094d-4742-9a9c-c07855963add` | TiTan Test Channel (E2E) | telegram | 1 |

---

## Network evidence

**With data (200):**

```
GET /api/v1/data-sources/collected?limit=20&offset=0&source_id=b1ec7306-fc00-4d3c-8857-0a3000aa422a
```

**Without data (200, zero rows):**

```
GET /api/v1/data-sources/collected?limit=20&offset=0&source_id=ba8ec2c7-094d-4742-9a9c-c07855963add
```

**Simulated failure:** Playwright `route.abort('failed')` on `/collected` → UI shows **Failed to fetch** + **Retry** (no successful empty state).

---

## Console evidence

| Category | Notes |
|----------|--------|
| **DataHub View Data** | No errors on successful load paths |
| **Intentional abort** | `Failed to load collected data: TypeError: Failed to fetch` (expected during error simulation) |
| **Non-DataHub noise** | MEXC ticker 404, WebSocket errors, React hydration warning in `DataHubSummaryCards` skeleton — pre-existing; out of scope |

---

## Screenshots

| File | Shows |
|------|--------|
| `test-results/dh-qa-verify-1/with-data-modal.png` | Record list + `1-20 / 257` |
| `test-results/dh-qa-verify-1/without-data-modal.png` | `No records found` + `0` |
| `test-results/dh-qa-verify-1/api-error-modal.png` | `Failed to fetch` + **Retry** |

---

## Follow-up (DH-QA-FIX-1B)

Locale key `datahub_collected_unavailable` added to `deploy/blue/locales` and `deploy/green/locales` (en/fa) so the API-failure list pane shows translated copy instead of the raw key.
