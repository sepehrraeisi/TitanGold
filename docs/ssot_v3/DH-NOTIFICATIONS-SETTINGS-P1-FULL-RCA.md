# DH-NOTIFICATIONS-SETTINGS-P1-FULL-RCA

Date: 2026-06-20

Mode: READ-ONLY AUDIT

Scope: Settings -> Notifications, Telegram notification config, email config, browser/push notifications, alert rules, notification history, workers, and compatibility with Telegram Publisher, Automation Routing, Access Control, and Filter Rules.

Hard safety constraints observed:

- No code was modified except this RCA document.
- No database rows were inserted, updated, or deleted.
- No Telegram, email, push, webhook, or test notification send endpoint was called.
- Backend was not started for runtime testing because startup enables background services that can have side effects.

## Final Verdict

**D) BROKEN / UNSAFE**

Notifications/Settings is not production-safe today. It is a mixed collection of partially implemented systems:

- A rich Settings -> Notifications UI persists most settings into `user_preferences.preferences.notifications`, but many actions use local browser storage/IndexedDB or direct Telegram API calls rather than the backend notification tables.
- Backend notification tables and routes exist, but the main UI is not wired to them.
- Telegram notification tests and sends can send real messages without dry-run, explicit live confirmation, or Publisher mapping checks.
- Personal price alert worker can send Telegram directly from user preference JSON and bypasses Telegram Publisher, publisher dry-run, publisher mapping, ACL, and Filter Rules.
- Legacy env-backed Telegram sending still exists separately from Telegram Publisher and personal notification settings.
- Secrets are duplicated across env/deploy files and user preference JSON, and user-provided bot tokens are stored/handled in plaintext paths.

The system has useful pieces, but it must be treated as unsafe until P2 consolidates send paths and credential handling.

## 1. UI Wiring Table

| UI section/action | Component | Hook/service | API endpoint | Backend route/service | DB table/storage | Status |
|---|---|---|---|---|---|---|
| Settings tab navigation -> Notifications | `components/Settings.tsx` | none | none | none | none | working navigation |
| Telegram enable/disable | `components/settings/NotificationsSettings.tsx` | `userPreferencesService.updatePreference` | `PUT /api/v1/user-preferences/category/notifications` | `backend/routes/userPreferences.js` | `user_preferences.preferences.notifications` | partial |
| Telegram bot token/chat id form | `NotificationsSettings.tsx` | `userPreferencesService`, direct `fetch` | mixed: category update and `/api/v1/user-preferences/telegram/test` | `userPreferences.js` | plaintext JSON in `user_preferences` when saved | broken/unsafe |
| Telegram bot verify/getMe | `NotificationsSettings.tsx` | `api.getTelegramBotInfo` | direct Telegram API/proxy path | no authenticated app route | browser fetch, no DB | unsafe |
| Send test Telegram notification | `NotificationsSettings.tsx` | direct `fetch` | `POST /api/v1/user-preferences/telegram/test` | `userPreferences.js` imports `node-telegram-bot-api` | no history write | unsafe real send |
| Add/remove/update Telegram channels | `NotificationsSettings.tsx` | `api.addTelegramChannel`, `updateTelegramChannel`, `removeTelegramChannel` | none | none | IndexedDB/localStorage via `saveNotificationSettings` | partial/local-only |
| Test Telegram channel | `NotificationsSettings.tsx` | `api.testTelegramChannel` | direct Telegram getChat | no app route | no DB | unsafe/exposes token client-side |
| Send test Telegram message | `NotificationsSettings.tsx` | `api.sendTestTelegramMessage` | direct Telegram sendMessage | no app route | IndexedDB/localStorage history/analytics | unsafe real send |
| Browser/push enable and permission | `NotificationsSettings.tsx` | Web Notification API | browser permission only | none | `user_preferences` after save, local runtime permission | partial |
| Send test browser notification | `NotificationsSettings.tsx` | `api.sendBrowserNotification` | none | browser-only Notification API | IndexedDB/localStorage analytics/history | partial/local-only |
| Global quiet hours / DND | `NotificationsSettings.tsx` | `userPreferencesService.updatePreference` | category preference update | `userPreferences.js` | `user_preferences` | partial; only local frontend senders honor it |
| Import/export notification settings | `NotificationsSettings.tsx` | `api.exportNotificationSettings`, `api.importNotificationSettings` | none | none | local JSON/IndexedDB/localStorage | partial/local-only |
| Clear notification history | `NotificationsSettings.tsx` | `api.clearNotificationHistory` | none | none | IndexedDB/localStorage | partial/local-only |
| Analytics reset | `NotificationsSettings.tsx` | `handleSave` | category preference update | `userPreferences.js` | `user_preferences` plus local analytics | partial |
| Email configuration page | `components/settings/EmailSettings.tsx` | `emailService.ts`, `database` | `POST /api/v1/email/test`; `POST /api/v1/email/send` exists | `backend/routes/email.js` | frontend `database.save('settings','email_config')`, not backend `system_settings` | partial/unsafe test |
| Price/favorite alerts UI | favorites components/routes, not Settings -> Notifications | favorites API | `GET/POST/PUT/DELETE /api/v1/favorite-alerts...` | `favoriteAlerts.js`, `favoritesAlertMonitor.js` | `favorite_alerts` | partial, send path unsafe |
| Backend notification settings/history UI | not wired from Settings -> Notifications | none found | `GET/PUT /api/v1/notifications/settings`, `GET /history` | `notifications.js` | `notification_settings`, `notification_history` | backend exists, UI not wired |

i18n/UX findings:

- Many labels in `NotificationsSettings.tsx` are hardcoded English: setup instructions, bot token, chat id, test status strings, confirmation text, browser unsupported alert.
- Several keys have fallback strings, meaning missing locale keys are tolerated instead of detected.
- Persian locale lacks many keys used by the notification screen (`enable_telegram_notifications`, many advanced settings, import/export, analytics labels, DND labels).
- UI says "Bot token will not be exported", but token can be stored in local/browser settings and `user_preferences` depending on path.
- "Send Test Notification" and "Send Test Message" do not clearly say they are real outbound Telegram messages.
- No distinction is made between personal notifications and DataHub Telegram Publisher broadcast channels.

Unsafe UI actions without adequate confirmation:

- Telegram test notification real send.
- Telegram test message real send.
- Email SMTP test performs a real network connection to SMTP.
- Email send endpoint exists and sends real email.
- Browser test displays a real local notification, though this is local and permission-gated.

## 2. Backend Route Audit

| Method | Path | Auth | Schema | Request body | Response | DB reads | DB writes | Side effects | Send risk |
|---|---|---|---|---|---|---|---|---|---|
| GET | `/api/v1/notifications` | `authenticate` | none | none | array of notifications | `notifications` legacy table | none | none | none |
| POST | `/api/v1/notifications/broadcast` | `authenticate` only | none | `{title,message,level}` | broadcast payload | none | none | WebSocket broadcast to all connected clients | real in-app broadcast; no admin role |
| GET | `/api/v1/notifications/settings` | `authenticate` | none | none | `{settings}` | `notification_settings` | none | none | none |
| PUT | `/api/v1/notifications/settings` | `authenticate` | manual array check | `{settings: [...]}` | saved settings | `notification_settings` | upsert settings | none | none |
| GET | `/api/v1/notifications/history` | `authenticate` | query parsing only | query `limit,offset,unreadOnly` | history/unread count | `notification_history` | none | none | none |
| PUT | `/api/v1/notifications/history/:id/read` | `authenticate` | none | none | updated row | `notification_history` | mark read | none | none |
| DELETE | `/api/v1/notifications/history/:id` | `authenticate` | none | none | success | `notification_history` | delete row | none | none |
| POST | `/api/v1/notifications/test` | `authenticate` | none | `{channel,category}` optional | inserted notification | none | inserts `notification_history` | no outbound today | DB write, no dry-run flag |
| GET | `/api/v1/user-preferences` | `authenticate` | none | none | preference object | `user_preferences`, `preference_categories` | none | none | none |
| GET | `/api/v1/user-preferences/category/:category` | `authenticate` | category existence check | none | category preference | `preference_categories`, `user_preferences` | none | none | none |
| PUT | `/api/v1/user-preferences/category/:category` | `authenticate`, `preferencesLimiter` | Joi `categoryUpdateSchema` | `{category,values,version,syncSource}` | updated category | `user_preferences` | update preference JSON/history trigger | WebSocket/update behavior in service path | no outbound |
| GET | `/api/v1/user-preferences/telegram` | `authenticate` | none | none | telegram config | `user_preferences` | none | none | returns bot config, may expose secret |
| PUT | `/api/v1/user-preferences/telegram` | `authenticate`, limiter | manual validation | `{botToken,chatId,enabled}` | telegram config | `user_preferences` | plaintext JSON config write | none | stores secret |
| POST | `/api/v1/user-preferences/telegram/test` | `authenticate`, limiter | none | route ignores body; reads stored config | success/error | `user_preferences` | none | sends Telegram via `node-telegram-bot-api` | real send, no dry-run |
| POST | `/api/v1/email/test` | `authenticate` | manual fields | SMTP config | connection result | none | none | `nodemailer.verify()` outbound SMTP connection | real external network test |
| POST | `/api/v1/email/send` | `authenticate` | manual fields | `{config,options}` | message id | none | none | sends email | real send, no role/dry-run |
| GET | `/api/v1/favorite-alerts/:favoriteId/alerts` | `authenticate` | ownership check | none | alerts | `favorites`, `favorite_alerts` | none | none | none |
| GET | `/api/v1/favorite-alerts/alerts/active` | `authenticate` | none | none | active alerts | `favorite_alerts`, `favorites` | none | none | none |
| POST | `/api/v1/favorite-alerts/:favoriteId/alerts` | `authenticate` | manual | alert config | created alert | `favorites` | insert `favorite_alerts` | monitor may later send | creates future send rule |
| PUT | `/api/v1/favorite-alerts/alerts/:alertId` | `authenticate` | manual | alert fields | updated alert | `favorite_alerts` | update | monitor may later send | modifies future send rule |
| DELETE | `/api/v1/favorite-alerts/alerts/:alertId` | `authenticate` | ownership check | none | success | `favorite_alerts` | delete | none | none |
| POST | `/api/v1/favorite-alerts/alerts/:alertId/trigger` | `authenticate` | manual price | `{triggered_price}` | updated alert | `favorite_alerts` | marks triggered | no notification send in route | DB state mutation |
| GET | `/api/v1/favorite-alerts/monitor/stats` | `authenticate` | none | none | monitor stats | `favorite_alerts` | none | none | leaks global active count to any authenticated user |
| POST | `/api/v1/favorite-alerts/alerts/:alertId/test` | `authenticate` | ownership check | none | would-trigger result | `favorite_alerts`, `favorites`, external MEXC | none | external price fetch | no outbound notification |
| CRUD | `/api/v1/webhooks...` | `authenticate` | manual | webhook URL/events | webhook config | `webhooks`, `webhook_deliveries` | create/update/delete | future outbound webhook deliveries | real outbound when triggered |

Endpoints that can cause real outbound messages or broadcasts:

- `POST /api/v1/user-preferences/telegram/test`
- Direct frontend Telegram Bot API `sendMessage` through `api.sendTestTelegramMessage`
- Direct frontend Telegram Bot API `getMe`/`getChat` exposes token client-side and calls external Telegram
- `POST /api/v1/email/test` external SMTP connection
- `POST /api/v1/email/send` real email send
- `POST /api/v1/notifications/broadcast` real WebSocket broadcast to all connected clients
- `favoritesAlertMonitor.sendNotifications()` real Telegram send when alerts trigger
- legacy `telegramService.sendMessage()` from engine/data-source paths using env bot
- `webhookDispatcher.triggerWebhook()` real webhook POST when triggered

## 3. Database Audit

Tables found:

- `notification_settings`
- `notification_history`
- `user_preferences`
- `preference_categories`
- `preference_change_history`
- `user_preference_cache`
- `favorite_alerts`
- `favorites`
- `webhooks`
- `webhook_deliveries`
- `system_settings`
- related: `telegram_publishers`, `publisher_delivery_history`

Production counts from read-only DB queries:

| Metric | Count |
|---|---:|
| `notification_settings` | 0 |
| enabled `notification_settings` | 0 |
| `notification_history` | 0 |
| unread `notification_history` | 0 |
| active `user_preferences` rows | 1 |
| users with `preferences.notifications` | 1 |
| users with Telegram notification enabled in preferences | 0 |
| `favorite_alerts` | 0 |
| active `favorite_alerts` | 0 |
| triggered `favorite_alerts` | 0 |
| `webhooks` | 0 |
| active `webhooks` | 0 |
| `webhook_deliveries` | 0 |
| pending failed `webhook_deliveries` | 0 |
| `preference_change_history` | 37 |
| notification-related preference history rows | 35 |
| `system_settings` | 4 |
| email config rows in `system_settings` | 0 |
| `telegram_publishers` | 3 |
| active `telegram_publishers` | 1 |
| `publisher_delivery_history` | 33 |

Schema/ownership:

- `notification_settings.user_id`, `notification_history.user_id`, `user_preferences.user_id`, `favorite_alerts.user_id`, and `webhooks.user_id` all reference `users(id)`.
- `notification_settings` has uniqueness on `(user_id, channel, category)`.
- `notification_history` has user/time and unread indexes.
- `favorite_alerts` has active/favorite/user indexes.
- `webhook_deliveries` tracks retry metadata with indexes on webhook and pending retry.
- No retention/cleanup was found for `notification_history`; `preference_change_history` has archive functions.
- `webhook_deliveries` has retry metadata but retry scheduling is in-memory and not clearly wired on startup.

Latest-row status:

- Notification settings/history/favorite alerts/webhooks/webhook deliveries are empty in current DB.
- The one existing notification preference sample is only UI display preference (`duration`, `position`, `showIcons`, `showProgress`), not Telegram/email/push config.

## 4. Relationship With Telegram Publisher

Answers:

1. **Does Notifications use the same Telegram bot token as Telegram Publisher?** Not as a managed shared system. Publisher uses `telegram_publishers.bot_token_encrypted`; Notifications can use `user_preferences.preferences.notifications.telegram.botToken`; legacy engine/service uses env `TELEGRAM_BOT_TOKEN`.
2. **Does Notifications use `telegram_publishers` table?** No.
3. **Does Notifications write `publisher_delivery_history`?** No. Frontend notification sends write local history; Publisher writes `publisher_delivery_history`; `user-preferences/telegram/test` writes no history.
4. **Does Notifications have its own bot/channel config?** Yes, in user preference JSON and local/IndexedDB paths.
5. **Does Notifications require Settings to be configured for Publisher to work?** No.
6. **Can Publisher work when Notifications disabled?** Yes; Publisher is separate.
7. **Can Notifications send messages when Publisher disabled?** Yes; personal Telegram notification paths and legacy env-backed `telegramService` can send independently.
8. **Are there duplicate bot credentials stored in different places?** Yes: env/deploy files, user preference JSON/local storage, and Publisher encrypted table.

Relationship classification:

**C) partially duplicated**, with confused legacy paths. It is not a shared credential manager.

## 5. Relationship With Automation Routing

Findings:

- Automation Routing uses Telegram Publisher through `runPublisherPublish()`.
- Automation history joins publisher names from `telegram_publishers`.
- No direct call from Automation Routing service/routes to Notifications, `favorite_alerts`, or notification history was found.
- Automation failures are not sent to the notification system.
- Notification system does not consume automation queue/history.
- Automation P2 safety remains valid inside Automation Routing because it uses Publisher.

Unsafe bypass path:

- A source-derived or automation-like message could be sent through notification/personal Telegram paths if a future caller uses `sendTelegramNotification()` or direct `telegramService.sendMessage()` instead of Publisher.
- Existing favorite price alerts are market-derived but not DataHub source-derived; ACL/filter does not necessarily apply there.
- Legacy `data-sources/publish-telegram`, engine worker, and trading engine Telegram paths use env-backed `telegramService`; those are outside Settings -> Notifications but demonstrate that Telegram sends can bypass Publisher safety if used for DataHub content.

Conclusion:

Notifications does not currently bypass Automation Routing directly, but the notification send stack is available as a bypass channel unless P2 explicitly forbids DataHub source-derived content from using it.

## 6. Access Control And Filter Rules Compatibility

Classification:

1. Personal/system notifications with no source content:
   - Browser local notifications, UI preference changes, generic in-app notification history, and favorite price alerts do not inherently require DataHub source ACL/filter.

2. Source-derived notification content:
   - Must enforce Access Control, Blacklist/Whitelist Filter Rules, publisher mapping, and dry-run.
   - Current notification send paths do not distinguish source-derived vs personal/system content.
   - Current notification send APIs do not carry `source_id` context.
   - Current notification send APIs do not call `accessControlGateway`, `filterRulesGateway`, Telegram Publisher mapping checks, or Publisher dry-run enforcement.

Compatibility verdict:

**Not compatible for DataHub source-derived content.** It is only acceptable for strictly personal/system notifications after send paths are locked down and labeled.

## 7. Test Notification Behavior

| Test action | Endpoint/path | Real send? | Dry-run? | Confirmation? | History? | Config validation? | Status |
|---|---|---:|---:|---:|---|---|---|
| Backend in-app test | `POST /api/v1/notifications/test` | no outbound today | no | no | writes `notification_history` | minimal | partial; DB write, not safe for read-only |
| Personal Telegram test | `POST /api/v1/user-preferences/telegram/test` | yes | no | no | no | checks enabled/token/chat id | unsafe |
| UI Telegram test message | direct Telegram `sendMessage` via `services/api.ts` | yes | no | no | local IndexedDB/localStorage only | format only | unsafe |
| Telegram bot getMe/channel getChat | direct Telegram API | external API call | no | no | no | token format only | unsafe token exposure |
| Browser push test | browser Notification API | local browser notification | no | permission-gated | local history/analytics | browser permission | partial |
| Email SMTP test | `POST /api/v1/email/test` | external SMTP verify | no | no | no | basic fields | unsafe for audit |
| Email send | `POST /api/v1/email/send` | yes | no | no | no | basic fields | unsafe |

No send/test endpoint comparable to Publisher's P2 dry-run contract was found.

## 8. Alert Rules Behavior

Price/favorite alerts:

- Stored in `favorite_alerts`.
- Created/updated/deleted through `backend/routes/favoriteAlerts.js`.
- Ownership checks exist for CRUD routes.
- Worker: `backend/services/favoritesAlertMonitor.js`.
- Startup: `backend/server.js` starts monitor automatically every 10 seconds.
- Trigger logic: fetches MEXC ticker price, checks above/below target, marks alert inactive/triggered.
- Telegram delivery: reads `user_preferences.preferences.notifications.telegram`, instantiates `node-telegram-bot-api`, sends directly to user chat.
- Browser/email delivery: TODO/log-only today.
- Retry logic: none for Telegram alerts.
- Dedup logic: weak; marking inactive happens before send, but no advisory lock/claiming. Multiple API processes/workers can double-process.
- History: no `notification_history` write for alert delivery.
- Dry-run/test: `POST /alerts/:id/test` checks would-trigger and fetches price, but does not send. Real monitor has no dry-run.

Trade/system/error/personal alerts:

- UI has notification type toggles/templates for `trades`, `alerts`, `news`, `predictions`, `errors`.
- No production scheduler/worker was found that consumes these categories from Settings -> Notifications.
- They are effectively UI/local settings unless some frontend caller invokes `sendTelegramNotification()`.

Alert verdict:

**Price alerts are partially real but unsafe; trade/system/error alert categories are mostly UI/local-only.**

## 9. Scheduler / Worker Audit

Notification-related workers:

- `favoritesAlertMonitor` starts from backend startup and checks every 10 seconds.
- WebSocket notification server starts at `/ws/notifications`.
- `webhookDispatcher` has in-memory `setTimeout` retry scheduling, but no confirmed startup loop was found in `server.js` to process pending retries.
- Legacy engine/trading workers can send Telegram using env-backed `telegramService`.

Answers:

1. Notification scheduler? No unified notification scheduler. Favorite alert monitor exists.
2. PM2 process? Runs inside backend API process from `server.js`; no separate notification-specific PM2 worker was found in this audit.
3. Interval? Favorite alert monitor every 10 seconds.
4. Enabled in production? It starts unconditionally when backend starts.
5. Lock/advisory lock? No.
6. Can double-send? Yes in multi-process/cluster startup or overlapping checks.
7. Retry failed sends? No for favorite Telegram alerts; webhook dispatcher has in-memory retry only.
8. Rate limits? No backend rate limit for favorite alert Telegram sends; frontend local rate limiter exists only in browser.
9. History? Favorite alert sends do not write `notification_history` or publisher history.
10. Dry-run? No for monitor delivery.

## 10. Security / Privacy Audit

Risks:

- Telegram bot tokens are handled in plaintext in browser and user preference JSON.
- `GET /api/v1/user-preferences/telegram` can return Telegram config, including token, to the authenticated user. That is still sensitive and should be masked by default.
- Env/deploy files contain real Telegram credential material. This is duplicate credential storage and should not be committed.
- `POST /api/v1/email/send` lets any authenticated user submit arbitrary SMTP config and recipients. It sends real email with no admin role, no dry-run, no ownership of SMTP credentials, and no audit history.
- `POST /api/v1/notifications/broadcast` lets any authenticated user broadcast WebSocket notification payloads to all connected clients; no admin role.
- WebSocket `/ws/notifications` accepts connections and broadcasts without per-user scoping in `broadcastNotification()`.
- Favorite alert monitor logs user/asset context and can send to user-configured Telegram without history or consent confirmation at trigger time.
- Chat IDs are visible/editable in UI and can be persisted in user preferences.
- No encryption layer equivalent to `telegram_publishers.bot_token_encrypted` is used for personal notification bot tokens.
- Multiple token sources make rotation/revocation unclear.

Privacy verdict:

**Unsafe until tokens are encrypted/masked, send endpoints are role/ownership scoped, and broadcasts are per-user.**

## 11. Performance Results

Endpoint latency:

- Backend API on `127.0.0.1:5001` was not running.
- Listening ports found: `80`, `443`, and frontend `3000`; no backend `5001`.
- Backend was not started because doing so would start background workers (`favoritesAlertMonitor`, autopilot worker) and could violate the no-side-effect audit constraint.

Safe read-only DB query latency:

| Query | Execution time | Notes |
|---|---:|---|
| notification settings by user | 0.137 ms | uses `idx_notification_settings_user`; 0 rows |
| notification history by user | 0.111 ms | uses `idx_notification_history_user_created`; 0 rows |
| user preference notifications JSON | 0.072 ms | uses `idx_user_preferences_active`; 1 row |
| active favorite alerts by user | 0.057 ms | uses `idx_favorite_alerts_user_id`; 0 rows |

Performance conclusion:

Current DB access is fast at present data volumes. The bigger performance risk is worker behavior: favorite alert monitor polls every 10 seconds, fetches external prices, and has no process-wide lock or batching limits beyond grouping by symbol.

## 12. Runtime Verification

Safe runtime actions performed:

- Read-only DB schema/count/index/FK queries.
- Read-only search of UI/backend/service/migration code.
- Attempted GET endpoint measurement without starting backend; connection was refused.

Actions intentionally not performed:

- No Telegram test/send endpoint.
- No email test/send endpoint.
- No notification test endpoint because it writes `notification_history`.
- No PUT/POST settings/preferences/alert/webhook operations.
- No backend startup due automatic worker side effects.

Dry-run support:

- No real notification send path with dry-run was found.
- Publisher has dry-run, but Notifications does not use Publisher.

## 13. UX Issues

Major UX gaps:

- Users cannot tell that Notifications is personal/local while Telegram Publisher is DataHub broadcast.
- UI implies Telegram settings are central, but Publisher uses separate configured publishers.
- "Send Test" labels do not warn that real Telegram/email messages may be sent.
- Browser/local history and backend `notification_history` are separate, but UI does not explain this.
- Analytics counters are local/preference-based and not delivery-truth from backend.
- Telegram channel management is local/IndexedDB-like and not `telegram_publishers`.
- Email configuration lives in a separate Settings tab and frontend database storage, not notification settings backend.
- No visible error/history surface for backend notification sends, favorite alert sends, or Telegram test failures beyond transient status messages/logs.
- Persian/English localization is incomplete and falls back silently.
- No "configured/not configured" authoritative status based on backend-safe credential manager.

## 14. Recommended P2 Implementation Plan

1. Freeze unsafe sends:
   - Disable or guard `POST /user-preferences/telegram/test`, direct frontend Telegram send, and `/email/send` behind explicit role/confirmation until dry-run exists.
   - Require `confirm_live=true` and default `dry_run=true` for all test/send endpoints.

2. Create one notification service contract:
   - `notificationService.createEvent()`, `notificationService.deliver()`, `notificationService.test({dry_run})`.
   - Persist all attempts in `notification_history` with `status`, `channel`, `error_code`, `dry_run`, `destination_masked`, `source_id`, and `correlation_id`.

3. Separate personal notifications from DataHub publishing:
   - Personal/system notifications: no ACL/filter required unless source content is attached.
   - Source-derived notifications: must route through Telegram Publisher or an enforcement gateway that calls ACL/filter and publisher mapping.

4. Credential management:
   - Encrypt personal Telegram bot tokens server-side.
   - Never return full tokens from GET APIs.
   - Remove real tokens from repo/env deploy files and rotate exposed credentials.
   - Provide masked status and explicit "owned by current user" metadata.

5. UI rewiring:
   - Wire Settings -> Notifications to backend notification settings/history, not local-only storage.
   - Add explicit copy explaining Personal Notifications vs Telegram Publisher Broadcasts.
   - Rename test buttons to "Send Real Test Message" only when live confirmation is present; otherwise use "Dry-run Test".

6. Alert worker hardening:
   - Move favorite alert delivery into the unified notification service.
   - Add advisory lock or DB row claim (`FOR UPDATE SKIP LOCKED`) before triggering.
   - Add retry count, history, dedup key, rate limits, and dry-run mode.

7. Security controls:
   - Restrict broadcast and arbitrary email send endpoints by role.
   - Scope WebSocket broadcasts to user/session unless explicitly admin/system.
   - Add schemas for all notification routes.

8. Tests:
   - Unit tests for dry-run, live confirmation, token masking, ownership, and source-derived enforcement.
   - Integration tests proving Notifications cannot bypass ACL/filter/Publisher mapping for DataHub source content.
   - Worker concurrency tests for favorite alerts.

9. Runtime verification:
   - Add safe dry-run endpoints for notification test, email test, Telegram test, and alert simulation.
   - Measure GET/PUT endpoints once backend can run without auto-starting side-effect workers in audit mode.

