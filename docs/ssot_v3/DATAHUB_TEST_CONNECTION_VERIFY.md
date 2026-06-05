# DataHub Test Connection — DH-QA-VERIFY-2

> **Date:** 2026-06-03  
> **Fix commit:** `e31f341` (`fix(datahub): test Telegram sources via server-side collector link`)  
> **Target:** Local Vite dev `http://localhost:3000` → proxy → backend `:5002`  
> **Method:** Playwright headless (`tmp-dh-qa-verify-2.mjs`, not committed); admin JWT session inject (no secrets logged)

---

## Executive summary

| Result | Detail |
|--------|--------|
| **Telegram Test Connection** | **Pass** — collector-linked success message; no bot-token error |
| **API source regression** | **Pass** — `Connection test successful` |
| **Network** | **Pass** — `POST /api/v1/data-sources/<id>/test-connection` only (no other DataHub mutations) |
| **Secrets in response** | **Pass** — no `botToken`, `credentials`, or `encrypted` in JSON body |
| **Final status** | **Telegram Test Connection FIXED** |

**Note:** Requests from `http://127.0.0.1:3000` hit CORS (`Not allowed by CORS`) because `CORS_ALLOWED_ORIGINS` lists `http://localhost:3000` but not `127.0.0.1:3000`. Verification used `http://localhost:3000` as intended for local dev.

Production (`https://titan.zala.ir`) was not re-tested in this run.

---

## Sources exercised

| Case | ID | Name | Type |
|------|-----|------|------|
| Telegram (collector-linked) | `d51d05a4-748a-4459-8a30-f132ef8d3e81` | BBCPersian | telegram |
| API (regression) | `ed0fb136-d20f-46f6-97aa-e70d2605cfef` | alphavantage DEMO TEST | api |

---

## UI evidence

**Telegram alert (browser `alert`):**

> Collector-linked channel "BBCPersian" is active in Telegram Collector. No stored records yet; messages ingest via the collector.

- Does **not** show: `Telegram bot token or channel ID missing`
- Message is actionable for operators (collector path explained)

**API alert:**

> Connection test successful

---

## Network evidence

**Telegram (HTTP 200):**

```
POST /api/v1/data-sources/d51d05a4-748a-4459-8a30-f132ef8d3e81/test-connection
```

```json
{
  "success": true,
  "mode": "collector",
  "message": "Collector-linked channel \"BBCPersian\" is active in Telegram Collector. No stored records yet; messages ingest via the collector.",
  "responseTime": 9
}
```

**API (HTTP 200):**

```
POST /api/v1/data-sources/ed0fb136-d20f-46f6-97aa-e70d2605cfef/test-connection
```

```json
{
  "success": true,
  "message": "Connection test successful",
  "data": [ "... sample market data ..." ]
}
```

No credentials or tokens in either response body.

---

## Console evidence

| Category | Notes |
|----------|--------|
| **DataHub Test Connection** | No `[DataHub Error - Test Connection]` on successful paths |
| **Non-DataHub noise** | MEXC 404, WebSocket, hydration warning in summary skeleton — pre-existing |

---

## Screenshots

| File | Shows |
|------|--------|
| `test-results/dh-qa-verify-2/after-telegram-test.png` | Post-test Data Sources view |
| `test-results/dh-qa-verify-2/after-api-test.png` | Post-test Data Sources view |
