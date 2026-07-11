# DH-NOTIFICATIONS-P2-NOTFOUND-REPAIR

Date: 2026-06-23

Verdict: REAL WORKING after repair verification.

## Human QA Rejection

Human QA rejected the previous P2 claim because Settings -> Notifications showed a raw `Not Found` alert above Channels, Preferences, and History. Channels also had no real cards visible.

## Exact Origin

The raw text came from the browser runtime path:

- `GET https://titan.zala.ir/api/v1/notifications/preferences`
- `GET https://titan.zala.ir/api/v1/notifications/channels`
- `GET https://titan.zala.ir/api/v1/notifications/history`

During fresh runtime verification, these returned nginx HTML `404 Not Found` whenever backend port `5002` was not listening. Backend direct `http://localhost:5002/api/v1/notifications/*` was connection-refused in the same state.

The backend route mount itself was correct:

- `backend/server.js` mounts `v1Router` at `/api/v1`.
- `backend/routes/v1/index.js` imports `../notifications.js`.
- `backend/routes/v1/index.js` mounts it at `/notifications`.
- `backend/routes/notifications.js` defines `/preferences`, `/channels`, `/history`, `/test`.

The frontend displayed the raw backend/nginx message from `components/settings/NotificationsSettings.tsx` before this repair:

- pre-repair line 85: global `statusMessage`
- pre-repair line 112: `setStatusMessage(error.message)`
- pre-repair lines 218-220: global raw alert rendered above all tabs
- pre-repair line 224: Channels only rendered when `channels` was non-null

## Root Cause

There were two coupled failures:

1. Runtime/backend failure: several dirty files had duplicate-appended ESM content. After PM2 reload, backend could not start reliably on port `5002`; nginx then returned HTML `404 Not Found` for `/api/v1/notifications/*`.
2. UI error handling failure: `NotificationsSettings.tsx` used one global `statusMessage` for load errors. Any failed notification fetch rendered the raw error across all tabs. Channels also depended on nullable `channels`, so a load failure left no cards visible.

## Fix

Frontend:

- Replaced global load error rendering with `channelsError`, `preferencesError`, and `historyError`.
- Changed load flow to `Promise.allSettled` so one failed endpoint does not poison all tabs.
- Added safe default Channels data, so Telegram/Browser/Email cards always render.
- Replaced raw `Not Found` UI with friendly section messages only.
- Added tests for Channels cards, no raw `Not Found`, section-specific 404 handling, Preferences save, History empty state, and no Bot Token/Chat ID inputs.

Backend/runtime:

- Removed duplicate-appended ESM content from dirty backend files so PM2 backend starts on `0.0.0.0:5002`.
- Confirmed `/api/v1/notifications/*` routes are mounted through `v1Router`.
- Reloaded `titan-backend` and restarted `titan-frontend`.

## Endpoint Table

Endpoint | nginx status | backend status | result
--- | ---: | ---: | ---
`GET /api/v1/notifications/preferences` | 200, 118.8ms | 200, 11.4ms | PASS
`GET /api/v1/notifications/channels` | 200, 68.6ms | 200, 16.9ms | PASS
`GET /api/v1/notifications/history` | 200, 84.5ms | 200, 25.0ms | PASS
`POST /api/v1/notifications/test` | 200, dry-run | 200, dry-run | SAFE
`POST /api/v1/user-preferences/telegram/test` | 200, dry-run | 200, dry-run | SAFE
`POST /api/v1/email/send` | 200, dry-run | 200, dry-run | SAFE
`POST /api/v1/notifications/broadcast` | 200, dry-run | 200, dry-run | SAFE

Unauthenticated checks return `401`, not `404`, confirming nginx/backend routing exists.

## Browser Evidence

Saved screenshots:

- `docs/ssot_v3/screenshots/notifications-p2-repair-channels.png`
- `docs/ssot_v3/screenshots/notifications-p2-repair-preferences.png`
- `docs/ssot_v3/screenshots/notifications-p2-repair-history.png`

Browser verification report:

- `docs/ssot_v3/notifications-p2-repair-browser-report.json`

Results:

- Channels: no `Not Found`; Telegram/Browser/Email cards visible.
- Preferences: no `Not Found`; Quiet Hours, Do Not Disturb, Frequency visible.
- Preferences save: `PUT /api/v1/notifications/preferences` persisted `frequency_level: normal` after reload.
- History: no `Not Found`; filters visible and backend history rows/empty state render.
- Network: preferences/channels/history all returned 200.
- Browser direct Telegram API: no `api.telegram.org` request.
- Console: no notification-related errors. Existing console errors are unrelated MEXC market 404s.

## Security Regression

Frontend grep found no direct Telegram Bot API calls in current source. Matches are only Telegram Collector paths (`/api/telegram-collector`) and test assertions that verify Bot Token/Chat ID are absent from Notifications UI.

No Bot Token input, Chat ID input, BotFather instruction, or live send button is rendered in `NotificationsSettings.tsx`.

## Tests

Passed:

- `npm run test:run -- src/__tests__/NotificationsSettings.test.tsx` — 5 tests passed.
- `cd backend && npm test -- --runInBand backend/__tests__/unit/notificationService.test.js backend/__tests__/unit/notificationRoutes.test.js` — 14 tests passed.
- `npm run build` — passed.

## Final Verdict

REAL WORKING for `DH-NOTIFICATIONS-P2-REPAIR-NOTFOUND-UI-BUG`.

Residual non-notification issue: deployed app still logs unrelated MEXC market 404 errors. They do not affect Settings -> Notifications and are outside this repair scope.
