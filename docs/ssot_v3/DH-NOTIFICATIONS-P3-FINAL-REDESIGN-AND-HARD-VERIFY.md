# DH-NOTIFICATIONS-P3-FINAL-REDESIGN-AND-HARD-VERIFY

Status: PARTIAL / VERIFIED FOR NOTIFICATIONS UI
Date: 2026-06-23
Scope: Settings -> Notifications, notification API wiring, runtime browser verification, dependency audit, DataHub design-system redesign.

## Verdict

Do not use REAL WORKING for the whole product yet because browser console still shows unrelated MEXC market-widget 404 errors outside the Notifications dependency chain.

Notifications-specific verdict: PASS after P3 changes.

- No Notifications warning banners remain with a valid runtime session.
- No raw `Not Found` is rendered in Channels, Preferences, or History.
- Invalid/stale auth no longer becomes three per-tab warning banners; the app clears session storage and returns to Login.
- Channels, Preferences, and History all render with real backend data and screenshots.
- Build, relevant frontend tests, relevant backend tests, PM2 reload/restart, runtime endpoint checks, and browser verification were completed.

## Phase 1 - Root Cause

Human QA saw:

- `Notification channels could not be loaded`
- `Notification preferences could not be loaded`
- `Notification history could not be loaded`

Root cause: stale/invalid browser token after backend runtime uses `JWT_SECRET=your-super-secret-jwt-key-change-this-in-production-2024`. The frontend still restored `titan_user` from storage, rendered Settings, and then all three Notifications requests failed with `401 {"error":"Invalid token"}`. `NotificationsSettings.tsx` converted those three auth failures into three tab-specific warning banners.

Control evidence:

- Invalid/stale token browser run:
  - `GET https://titan.zala.ir/api/v1/notifications/channels` -> `401`, payload `{"error":"Invalid token"}`
  - `GET https://titan.zala.ir/api/v1/notifications/preferences` -> `401`, payload `{"error":"Invalid token"}`
  - `GET https://titan.zala.ir/api/v1/notifications/history` -> `401`, payload `{"error":"Invalid token"}`
  - Browser showed all three old warning banners before the fix.
- Valid token browser run:
  - `GET /api/v1/notifications/preferences` -> `200`
  - `GET /api/v1/notifications/channels` -> `200`
  - `GET /api/v1/notifications/history` -> `200`
  - Browser showed no Notifications warning banners.

Not root cause:

- Backend route missing: no. `backend/routes/v1/index.js` mounts `router.use('/notifications', notificationRoutes)`.
- Nginx proxy missing: no. `/etc/nginx/sites-enabled/titan-zala` proxies `location /api/` to `http://127.0.0.1:5002`.
- Schema mismatch: no. Valid response shapes matched frontend expectations.
- Promise.allSettled alone: no. It exposed three independent auth failures, but auth/session handling was the real trigger.
- Stale bundle: no. Deployed asset after rebuild was `assets/index-CUhNveSl.js`.

Fix:

- `services/api.ts`: notification API requests now treat `401/403` as `AUTH_EXPIRED`, clear `titan_token`/`titan_user` from local and session storage, and dispatch `titan_auth_expired`.
- `App.tsx`: listens for `titan_auth_expired`, calls `logoutUser()`, and clears app user state.
- `NotificationsSettings.tsx`: auth-expired failures are not rendered as per-tab warning banners.

## Phase 2 - Cross Module Audit

| Dependency | Used by Notifications? | Status | Evidence |
| --- | --- | --- | --- |
| Telegram Publisher | Yes | Working | `getNotificationChannels()` reads active `telegram_publishers`; authenticated `/api/v1/data-hub/telegram-publishers` returned `200` with active publisher `887495e6-0b47-4450-88ef-35dd43477f9a`. |
| Automation Routing | Indirect/source-derived flow | Working | `/api/v1/data-hub/automation/overview` returned `200`; automation has publisher targets but Settings -> Notifications does not publish directly. |
| Favorite Alerts | Yes, source of notification events | Working | `favoritesAlertMonitor.js` calls `createNotificationEvent()`; `/api/v1/favorite-alerts/alerts/active` returned `200` with empty active list. |
| Email Configuration | Safety dependency | Working as dry-run/frozen | `/api/v1/email/test` with `dry_run:true` returned `200`; no SMTP/live send attempted. |
| Notification History | Yes | Working | DB count `notification_history=19`; `/api/v1/notifications/history` returned `200`, `total=18/19` depending on test timing, latest `dry_run`. |
| User Preferences | Yes | Working | DB count `notification_preferences=1`; `/api/v1/notifications/preferences` returned `200`; `/api/v1/user-preferences/telegram` returned `200`. |
| ACL | Yes for source-derived delivery | Working | `notificationService.js` calls `enforceSourceAccess(... RUNTIME_AGENT_KEYS.PUBLISHER ...)`; `/api/v1/data-hub/access-control` returned `200`. |
| Filter Rules | Yes for source-derived delivery | Working | `notificationService.js` calls `enforcePublishingPolicy()`; `/api/v1/data-hub/filter-rules` returned `200` with `rules: []`. |
| Publisher Mapping | Yes for source-derived Telegram delivery | Working | DB count `publisher_mappings_enabled=2`; `/api/v1/data-hub/telegram-publishers/mappings` returned `200` with enabled mappings. |
| Redis | Runtime dependency | Reachable with config warning | `redis-cli -u "$REDIS_URL" ping` printed `PONG` but also `AUTH failed`; reachable, but Redis auth configuration should be cleaned separately. |
| Auth | Yes | Working after fix | Valid token -> all notification endpoints `200`; invalid token -> endpoints `401`, storage cleared, Login visible, no per-tab banners. |
| Nginx | Yes | Working | `/api/` proxies to `127.0.0.1:5002`; endpoint checks through `https://titan.zala.ir` returned expected `200/401`. |
| PM2 | Yes | Working | `titan-backend` cluster ids 4/5 online after reload; `titan-frontend` online after restart. |
| Deploy | Yes | Working for Notifications | `npm run build` succeeded; nginx serves `/home/ubuntu/webapp/TitanGold/dist`; browser used rebuilt asset `index-CUhNveSl.js`. |

Security cleanup:

- `components/settings/NotificationsSettings.tsx`: no `api.telegram.org`, `bot_token`, `Bot Token`, `Chat ID`, `sendMessage`, or `node-telegram-bot-api` matches.
- `backend/services/telegram.js`: legacy `sendMessage` logs skipped and routes through Telegram Publisher.
- `backend/services/telegramPublisherService.js`: only intended publisher service contains Telegram Bot API send path.
- `backend/services/fetchers/telegramFetcher.js`: collector fetcher uses `node-telegram-bot-api`; not a Settings -> Notifications send path.

## Phase 3 - Design System Redesign

Reference: `DESIGN_SYSTEM_DATAHUB.md`.

Implemented in `components/settings/NotificationsSettings.tsx`:

- Slate dark theme with glass-like `bg-gradient-to-br from-slate-950/90 via-slate-950/80 to-slate-900/80`.
- Status summary header with metric tiles: delivery mode, active channels, history entries, blocked/failed.
- Stronger tab hierarchy with rounded segmented navigation.
- Connected channel cards in a responsive `grid grid-cols-1 md:grid-cols-3`.
- DataHub-style badges using emerald/blue/amber/red semantic tones.
- Skeleton loading state for initial load and History reload.
- Compact inline notices instead of dominant top-level warning banners.
- Empty History state with a structured dashed card and short explanatory message.
- Safer null/partial response handling by merging nested channel defaults.
- History filter no longer reloads Preferences and Channels.
- Dark-theme responsive spacing and typography aligned to the design reference.

Before screenshots:

- `docs/ssot_v3/screenshots/notifications-p3-invalid-token-before-channels.png`
- `docs/ssot_v3/screenshots/notifications-p3-invalid-token-before-preferences.png`
- `docs/ssot_v3/screenshots/notifications-p3-invalid-token-before-history.png`

After screenshots:

- `docs/ssot_v3/screenshots/notifications-p3-after-channels.png`
- `docs/ssot_v3/screenshots/notifications-p3-after-preferences.png`
- `docs/ssot_v3/screenshots/notifications-p3-after-history.png`
- `docs/ssot_v3/screenshots/notifications-p3-after-invalid-session.png`

Browser report:

- `docs/ssot_v3/notifications-p3-warning-banner-rca.json`
- `docs/ssot_v3/notifications-p3-final-browser-report.json`

## Phase 4 - Tab By Tab Verification

Channels:

- Network: PASS. `GET /api/v1/notifications/channels` returned `200`.
- Console: PASS for Notifications-specific logs. Global unrelated MEXC 404 remains outside scope.
- Rendering: PASS. Telegram, Browser, Email cards visible with status summary.
- Actions: PASS. Telegram dry-run test button created history entry id `25` with `status:"dry_run"`.
- Loading State: PASS. Initial skeleton renders before data.
- Empty State: PASS. Safe default channel cards render when non-auth channel data fails.
- Error State: PASS. Non-auth failure shows compact safe-default notice; auth failure logs out instead of tab banners.
- Persistence: PASS. Save flow updates preferences and channel state reloads.

Preferences:

- Network: PASS. `GET /api/v1/notifications/preferences` returned `200`; `PUT /api/v1/notifications/preferences` returned `200`.
- Console: PASS for Notifications-specific logs.
- Rendering: PASS. Quiet Hours, Do Not Disturb, and frequency controls visible.
- Actions: PASS. Frequency changed to `high`, Save returned `Settings saved`.
- Loading State: PASS. Initial skeleton covers preference load.
- Empty State: N/A; preferences always use defaults plus server values.
- Error State: PASS. Auth failure no longer creates per-tab banner.
- Persistence: PASS. After reload, browser report recorded `persistedFrequency: "high"`.

History:

- Network: PASS. `GET /api/v1/notifications/history` returned `200`.
- Console: PASS for Notifications-specific logs.
- Rendering: PASS. History table visible with dry-run rows.
- Actions: PASS. Filters `all/sent/failed/blocked/dry run` visible; changing filter reloads History only.
- Loading State: PASS. History reload skeleton exists.
- Empty State: PASS. Empty state renders when list is empty.
- Error State: PASS. Auth failure logs out instead of tab banners.
- Persistence: PASS. New dry-run entry appears after test and remains after reload.

## Phase 5 - Browser Evidence

Valid-session browser evidence:

- `GET /api/v1/notifications/preferences` -> `200`
- `GET /api/v1/notifications/channels` -> `200`
- `GET /api/v1/notifications/history` -> `200`
- `POST /api/v1/notifications/test` -> `200`, payload includes `dry_run:true`, `history.id:25`
- `PUT /api/v1/notifications/preferences` -> `200`, payload includes `frequency_level:"high"`
- Banners:
  - Channels: false
  - Preferences: false
  - History: false
- Raw `Not Found`: false

Invalid/stale-session browser evidence:

- `GET /api/v1/notifications/preferences` -> `401 {"error":"Invalid token"}`
- `GET /api/v1/notifications/history` -> `401 {"error":"Invalid token"}`
- `GET /api/v1/notifications/channels` -> `401 {"error":"Invalid token"}`
- local/session token and user storage after fix: null
- Login visible: true
- Notifications warning banners: false

Console evidence:

- Notifications-specific console errors: none in valid-session flow.
- Global unrelated console errors remain for MEXC ticker 404 and one Artemis fallback fetch during page bootstrap. These are outside the Notifications chain but prevent a whole-product REAL WORKING claim.

Performance evidence:

- After redesign browser navigation summary: duration `592ms`, DOMContentLoaded `591ms`, load `592ms`, resources `19`.
- Before screenshot evidence captured the old warning-banner state; old precise performance metric was not captured before code changes, so performance is verified post-change only.

## Phase 6 - End To End Flow

Verified chain:

User -> Notifications UI -> `services/api.ts` notificationRequest -> nginx `/api/` -> Express `/api/v1` -> `backend/routes/v1/index.js` -> `backend/routes/notifications.js` -> `backend/services/notificationService.js` -> Auth middleware -> ACL/filter/publisher mapping when source-derived -> DB tables -> History -> UI refresh.

Evidence:

- UI dry-run click called `POST /api/v1/notifications/test`.
- Backend recorded notification history entry id `25`.
- History reload called `GET /api/v1/notifications/history`.
- UI table showed latest `Telegram / test / dry run / dry-run / Notification channel test`.
- Live send remains blocked unless explicit future publisher-supported path exists; tests confirm live unsupported paths.

## Phase 7 - Build, Test, Deploy

Build:

- `npm run build` PASS.
- Vite warnings remain for unrelated missing exports in TopicRouting/Scenarios/API cancellation and large chunks; build completed successfully.

Tests:

- `npm test -- --run src/__tests__/NotificationsSettings.test.tsx` PASS, 6 tests.
- `cd backend && npm test -- __tests__/unit/notificationRoutes.test.js __tests__/unit/notificationService.test.js --runInBand` PASS, 14 tests.
- Incorrect root-level backend attempts documented:
  - Vitest runner failed because backend tests import `@jest/globals`.
  - Root `npx jest` failed because root/deploy package collisions and ESM config. Correct backend package runner passed.

Deploy/runtime:

- `pm2 reload titan-backend` PASS.
- `pm2 restart titan-frontend` PASS.
- `pm2 status` showed `titan-backend`, `titan-frontend`, Telegram collector/processor online.
- `GET https://titan.zala.ir/api/v1/health` -> `200`, env `production`, service `titan-backend`.

Cleanup:

- No unsafe Telegram credential strings in `NotificationsSettings.tsx`.
- Notification UI no longer accepts Telegram bot token/chat id.
- Safe dry-run behavior verified.

## Phase 8 - Final Rule Check

- No warning banners remain: PASS for valid session and stale-auth scenario after fix.
- No Not Found in Notifications tabs: PASS.
- No raw errors in Notifications UI: PASS.
- No broken Notifications tab: PASS.
- Design system compliance complete: PASS for Notifications module.
- Browser verification complete: PASS with screenshots and JSON report.
- Dependency audit complete: PASS, with Redis auth warning and unrelated MEXC console errors documented.
- End-to-end flow verified: PASS.
- Runtime verified: PASS.
- Screenshots attached: PASS.

Final verdict: PARTIAL for whole product because unrelated global console errors remain. Notifications module itself is verified and no longer reproduces the rejected P2 warning banners.

## Addendum - Subagent Audit Reconciliation

Post-implementation read-only audits completed after the main verification and add these clarifications:

- Design audit: the old implementation was not DataHub-compliant. The P3 rewrite addressed this at the `NotificationsSettings.tsx` presentation layer with DataHub-style shell, metric cards, compact badges, skeletons, boxed empty states, responsive cards, and slate/glass styling. It does not yet import shared `dataHubUi.tsx` primitives directly, so future consolidation can replace the local presentation helpers with shared primitives without changing API behavior.
- Dependency audit: Settings -> Notifications is backend-backed and works for status, preferences, history, and dry-run tests. It is not a personal live delivery system. Live Telegram/email delivery remains intentionally unsupported or dry-run-only outside the Telegram Publisher path.
- Automation Routing is not directly used by Settings -> Notifications. It is a separate DataHub publisher flow and should not be counted as required for loading the Settings Notifications tabs.
- ACL, Filter Rules, and Publisher Mapping are enforced for source-derived notification events where `source_id` is present. A simple channel dry-run from Settings has no `source_id`, so it validates the default publisher and writes dry-run history without exercising ACL/filter/mapping.
- Redis is not directly used by `notificationService.js`; it is a broader runtime infrastructure dependency. The observed `PONG` proves reachability, but the CLI `AUTH failed` warning remains a separate infra cleanup item.
- `NotificationsSettingsWrapper.tsx` appears stale: it passes old props (`initialSettings`, `onSave`) to `NotificationsSettings`, while the active route in `components/Settings.tsx` renders `NotificationsSettings` directly. It is not in the active path, but should be removed or refactored before reuse.
- PM2/deploy remains intentionally dry-run-biased for publisher delivery; this is safe for P3 but means "live personal notification delivery" is not part of the verified scope.
