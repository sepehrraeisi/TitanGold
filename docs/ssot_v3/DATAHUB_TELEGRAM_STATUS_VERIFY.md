# DataHub Telegram Collector Status — DH-QA-VERIFY-4

> **Date:** 2026-06-03  
> **RCA:** DH-QA-RCA-2  
> **Target:** Local dev — Vite `http://localhost:3000`, API `:5002`  
> **Method:** API probe + `fetchSource` skip check + Playwright (`tmp-dh-qa-verify-4.mjs`, not committed)

---

## RCA → fix summary

| Problem | Fix |
|---------|-----|
| Scheduler bot-pull failed without token → `last_status=error` | Skip `telegramFetcher` when collector-linked + active channel; reschedule only |
| List UI used raw `last_status` | Backend enriches `operational_status`, `telegram_ingestion_mode`, `suppress_last_error`, `success_rate_display` |
| Misleading Last error / 0% success | Suppress legacy error string; Success Rate **N/A** for collector mode |
| Test Connection vs card contradiction | Card uses collector operational model; Test Connection unchanged |

---

## Status model implemented

| Condition (collector mode, no bot token) | `operational_status` | UI pill |
|------------------------------------------|----------------------|---------|
| Channel missing / inactive | `error` | Status: Error |
| Active channel, messages, no `collected_data` | `pending` | Status: Pending ingestion |
| Active channel, no messages yet | `linked` | Status: Linked |
| Has `collected_data` | `active` | Status: Active |

Bot-token Telegram sources: unchanged — `last_status` drives UI.

---

## Per-source evidence (after fix)

| Source | `operational_status` | `telegram_ingestion_mode` | UI (scoped card) |
|--------|----------------------|---------------------------|------------------|
| BBCPersian | `pending` | `collector` | Pending ingestion, no Last error |
| DIRHAM_RATE(U.A.E) | `pending` | `collector` | Pending ingestion |
| IndyPersian | `pending` | `collector` | Pending ingestion |

`last_status` remains `error` in DB (historical); not reset per task rules.

---

## Scheduler verification

`fetchSource(BBCPersian)` → `{ success: true, skipped: true, reason: 'collector_ingestion' }`  
`error_count` unchanged (1898 → 1898). Log: `Skipping bot-pull fetch for collector-linked Telegram source`.

---

## Build

`npm run build` — **Pass**

## Screenshot

`test-results/dh-qa-verify-4/data-sources-telegram-status.png`

---

## Files changed

- `backend/services/telegramCollectorSourceStatus.js` (new)
- `backend/services/dataFetcher.js`
- `backend/jobs/dataFetchScheduler.js`
- `backend/routes/data-sources.js`
- `backend/schemas/dataHubSchemas.js`
- `services/dataSourcesApi.ts`
- `types.ts`
- `components/ai/AIManager/tabs/DataHub/DataSourcesPanel.tsx`
- `components/ai/AIManager/tabs/DataHub/dataHubUi.tsx`
- `deploy/blue/locales/en.json`, `fa.json`
- `deploy/green/locales/en.json`, `fa.json`
