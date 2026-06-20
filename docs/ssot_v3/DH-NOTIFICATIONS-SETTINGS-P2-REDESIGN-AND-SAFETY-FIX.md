# DH-NOTIFICATIONS-SETTINGS-P2-REDESIGN-AND-SAFETY-FIX

Date: 2026-06-20

Mode: IMPLEMENTATION + VERIFY

RCA: `docs/ssot_v3/DH-NOTIFICATIONS-SETTINGS-P1-FULL-RCA.md`

## Verdict

Before: **BROKEN / UNSAFE**

After: **REAL WORKING**

Settings -> Notifications is now a personal notification preference center. It no longer acts as a Telegram Publisher clone, no longer accepts Telegram bot tokens or chat IDs in the Notifications UI, and no longer exposes live unsafe test/send paths for Telegram, email, or notification broadcasts.

Commit hash: final hash is produced after this document is committed; record it from `git log -1 --format=%H`.

## Removed UI Sections

- Removed the legacy `Telegram`, `Browser`, `Global Settings`, and `Analytics` tab model from `components/settings/NotificationsSettings.tsx`.
- Removed Bot Token, Chat ID, BotFather setup instructions, Add Channel, local Telegram channel management, Telegram advanced parse/rate/retry controls, Import/Export, Reset Analytics, and fake analytics from the user notification UI.
- Removed local-only Telegram history/analytics from the visible product surface.

## New UI Structure

Settings -> Notifications now has three tabs:

- **Channels**: Telegram status is read from Telegram Publisher availability. Browser is shown as local permission-backed notification preview. Email is shown as coming soon/admin SMTP required.
- **Preferences**: quiet hours, do not disturb, and notification frequency only.
- **History**: backend-backed notification history with status filters for all, sent, failed, blocked, and dry-run.

The Telegram card explains that personal notifications use the configured Telegram Publisher delivery layer and that broadcast channels are managed in DataHub -> Advanced Features -> Telegram Publisher.

## Backend Architecture

Added `backend/services/notificationService.js` as the unified backend notification service with:

- `getNotificationPreferences(userId)`
- `updateNotificationPreferences(userId, preferences)`
- `getNotificationChannels(userId)`
- `getNotificationHistory(userId, filters)`
- `createNotificationEvent(payload)`
- `deliverNotificationEvent(event, options)`
- `testNotificationChannel({ userId, channel, dryRun, confirmLive })`

Added clean API contract under:

- `GET /api/v1/notifications/preferences`
- `PUT /api/v1/notifications/preferences`
- `GET /api/v1/notifications/channels`
- `GET /api/v1/notifications/history`
- `POST /api/v1/notifications/test`
- `POST /api/v1/notifications/events` admin-only

Source-derived Telegram notifications require source context, Access Control Gateway, Filter Rules Gateway, and source-to-publisher mapping before a dry-run history item can be recorded.

## Database Changes

Added migration `backend/database/migrations/043_notifications_unified_center.sql`.

The migration creates `notification_preferences` and safely extends `notification_history` with:

- `channel`
- `message_type`
- `message_preview`
- `status`
- `dry_run`
- `source_id`
- `publisher_id`
- `destination_masked`
- `error_code`
- `error_message`
- `metadata`

No old notification data is deleted. The migration was applied successfully against the local verification database.

## Security Changes

- Frontend direct Telegram Bot API calls were removed/replaced with backend dry-run notification APIs.
- Vite `/api/telegram` proxy to `api.telegram.org` was removed from root, deploy/green, and deploy/blue configs.
- Notifications UI no longer renders raw bot token or chat ID inputs.
- Legacy `PUT /api/v1/user-preferences/telegram` now rejects credential writes and directs users to Telegram Publisher.
- Legacy `POST /api/v1/user-preferences/telegram/test` now routes through `notificationService` and defaults to dry-run.
- Email `/test` and `/send` endpoints are dry-run by default and return `LIVE_NOT_SUPPORTED_YET` for confirmed live attempts.
- Notification broadcast is admin-only, dry-run by default, and live broadcast returns `LIVE_NOT_SUPPORTED_YET`.
- Notification history stores masked destinations, never raw Telegram secrets.
- Users can only read/update their own notification preferences/history through authenticated routes.

## Unsafe Endpoints Handled

- `POST /api/v1/user-preferences/telegram/test`: dry-run through `notificationService`; no direct Telegram Bot API send.
- `POST /api/v1/email/test`: dry-run only; no SMTP verify in P2.
- `POST /api/v1/email/send`: dry-run only; no arbitrary authenticated SMTP send in P2.
- `POST /api/v1/notifications/broadcast`: admin-only dry-run; live unsupported.
- Frontend direct Telegram `getMe`, `getChat`, and `sendMessage`: removed from Notifications paths.

## Publisher Relationship

Telegram Publisher remains the only managed DataHub Telegram broadcast and delivery layer. It owns bot credentials, output channels, source-to-publisher mappings, and source-derived delivery safety.

Settings -> Notifications now only manages personal notification preferences and reads Telegram delivery status from Telegram Publisher. It cannot define Telegram credentials or channels directly and cannot bypass Publisher/ACL/Filter for source-derived notifications.

## Favorite Alerts Decision

Favorite alert delivery no longer uses raw Telegram credentials from `user_preferences`. `backend/services/favoritesAlertMonitor.js` routes Telegram attempts through `notificationService`.

For P2, live Telegram favorite alert delivery is intentionally disabled and recorded as skipped/unsupported until a hardened P3 delivery worker is implemented. Browser and email favorite alert attempts are also recorded as skipped when server-side delivery is not supported.

The alert monitor now atomically marks an alert inactive before notification recording, reducing duplicate attempts in multi-worker deployments.

## Tests

Backend:

- `npm test -- --runInBand backend/__tests__/unit/notificationService.test.js backend/__tests__/unit/notificationRoutes.test.js`
- Result: 2 suites passed, 14 tests passed.

Frontend:

- `npm run test:run -- src/__tests__/NotificationsSettings.test.tsx`
- Result: 1 suite passed, 2 tests passed.

Build:

- `npm run build`
- Result: passed. Vite emitted pre-existing warnings about stale browser data, large chunks, and unrelated missing exports in other AI components, but build completed successfully.

## Runtime Verification

Safe DB/service verification created temporary user/source/publisher/mapping data, executed only dry-run and unsupported live paths, then cleaned all temporary data.

Verified:

- GET preferences returns safe data with no secrets.
- PUT preferences saves quiet hours, DND, and frequency while ignoring bot token-like input.
- Channels shows Telegram provider status from Telegram Publisher.
- Telegram dry-run test writes backend history and sends nothing.
- Live Telegram test without `confirm_live:true` returns 400.
- Source-derived Telegram dry-run enforces source mapping, ACL, and filter policy.
- Missing source-to-publisher mapping records skipped/blocked history.
- History is backend-backed.
- Favorite alert monitor has no direct Telegram Bot API send path.

Endpoint verification with an in-process Express app and real routes:

- `GET /api/v1/notifications/preferences`: 25.86ms
- `GET /api/v1/notifications/channels`: 7.04ms
- `GET /api/v1/notifications/history`: 7.01ms
- `POST /api/v1/notifications/test` default dry-run: 200
- `POST /api/v1/notifications/test` live without confirm: 400
- `POST /api/v1/email/send` dry-run: 200
- `POST /api/v1/email/send` live confirmed: 400 `LIVE_NOT_SUPPORTED_YET`
- `POST /api/v1/user-preferences/telegram/test`: 200 dry-run
- `POST /api/v1/notifications/broadcast`: 403 for non-admin; admin dry-run 200; admin live confirmed 400 `LIVE_NOT_SUPPORTED_YET`

## Performance Results

Targets:

- Preferences GET < 300ms
- Channels GET < 300ms
- History GET < 500ms

Measured:

- Preferences GET: 25.86ms
- Channels GET: 7.04ms
- History GET: 7.01ms

The new endpoints use notification preference/history/publisher tables only and do not call DataHub pipeline snapshots.

## Remaining P3 Backlog

- Implement hardened live personal Telegram delivery worker if product still needs live personal alerts.
- Add secured admin SMTP configuration and production-safe email delivery.
- Add a full UI navigation shortcut from Notifications to Telegram Publisher instead of status text only.
- Add retention/cleanup policy for notification history.
- Optionally move remaining legacy local notification helper APIs out of `services/api.ts` once no callers depend on compatibility wrappers.
- Review non-notification Telegram fetcher and legacy trading notifications separately; they are outside Settings -> Notifications P2 and do not send through the new UI.
