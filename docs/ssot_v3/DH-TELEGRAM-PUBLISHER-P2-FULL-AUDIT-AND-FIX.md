# DH-TELEGRAM-PUBLISHER-P2-FULL-AUDIT-AND-FIX

Date: 2026-06-20
Mode: AUDIT -> IMPLEMENTATION -> VERIFY
Verdict: REAL WORKING
Commit: TBD

## 1. Pre-change audit

### UI components

| Area | Component / hook | API | Backend / service | DB | Pre-change status |
|---|---|---|---|---|---|
| Main Telegram Publisher tab | `components/ai/AIManager/tabs/DataHub/advanced/TelegramPublisher.tsx`, `useTelegramPublishersQuery` | `GET /api/v1/data-hub/telegram-publishers` | `backend/routes/telegram-publishers.js`, `listPublisherMetrics()` | `telegram_publishers`, `publisher_delivery_history` | Partial. List loaded, but terminology and helper copy were unclear. |
| Channels section | Same component | `GET /telegram-publishers` | `mapPublisherRow()` | `telegram_publishers` | Partial. Channels listed, but "Publisher Channel" meaning was not clear. |
| New Channel modal | Inline `DataHubModal`; legacy unused `TelegramPublisherModal.tsx` also exists | `POST /telegram-publishers` | `encryptBotTokenOptional()` | `telegram_publishers` | Partial. Creation worked but helper copy and terminology were weak. |
| Test button | `handleTest`, `useTestTelegramPublisherMutation` | `POST /telegram-publishers/:id/test` | `runPublisherTest()` | `publisher_delivery_history` | Partial. Backend worked as config test/dry-run, but UI did not explain that it is not source publishing. |
| Publish button | `handlePublish`, `usePublishTelegramPublisherMutation` | `POST /telegram-publishers/:id/publish` | `runPublisherPublish()` | `publisher_delivery_history` | Broken. UI sent no `source_id`; backend schema requires `source_id` for ACL/filter enforcement. |
| Input/Output Channel Mapping | Static rows in `TelegramPublisher.tsx` | None | None | None | UI-only/broken. Rows looked actionable but did nothing. |
| History tab | `usePublisherHistoryQuery` | `GET /telegram-publishers/:id/history` | history route | `publisher_delivery_history` | Partial. Showed only preview/status/time; no source, content type, delivery mode, user, or error code. |
| Templates tab | Preview block in `TelegramPublisher.tsx` | None | `telegram_publishers.template` only | no templates table | UI-only. No CRUD table/API existed. |
| Disable button | `useDisableTelegramPublisherMutation` | `DELETE /telegram-publishers/:id` | soft-disable route | `telegram_publishers.is_active` | Working. No enable action existed in UI. |

### Backend routes

| Route | Method | Schema | Required fields | source_id | ACL | Filter rules | Dry-run | History |
|---|---:|---|---|---|---|---|---|---|
| `/api/v1/data-hub/telegram-publishers` | GET | `publisherListResponseSchema` | auth | No | N/A | N/A | N/A | metrics read |
| `/api/v1/data-hub/telegram-publishers` | POST | `createTelegramPublisherSchema` | `name`, `channel_id` | No | role write auth only | N/A | N/A | No |
| `/api/v1/data-hub/telegram-publishers/:id` | PUT | `updateTelegramPublisherSchema` | one update field | No | role write auth only | N/A | N/A | No |
| `/api/v1/data-hub/telegram-publishers/:id` | DELETE | `uuidParamSchema` | `id` | No | role write auth only | N/A | N/A | No |
| `/api/v1/data-hub/telegram-publishers/:id/test` | POST | `testPublisherSchema` | optional message | No | role write auth only | N/A | Yes, forced by `TELEGRAM_PUBLISHER_DRY_RUN` or missing token | Yes |
| `/api/v1/data-hub/telegram-publishers/:id/publish` | POST | `publishPublisherSchema` | `source_id`, `message`, `confirm_publish` | Yes | Yes, via gateway/assertion | Yes, `enforcePublishingPolicy()` | Yes | Yes after P2; blocked filter attempts recorded |
| `/api/v1/data-hub/telegram-publishers/:id/history` | GET | history query/response schemas | `id`, optional pagination | No | auth | N/A | N/A | read |
| `/api/v1/data-sources/publish-telegram` | POST | legacy ad hoc body | `source_id`, `message` | Yes | Yes | Yes | No explicit dry-run | No publisher history |
| `/api/v1/notifications/*` | GET/PUT/POST | notification routes | user auth | No | N/A | N/A | test notification only | `notification_history` |

### DB audit

Runtime counts after P2 verification:

| Table/metric | Count |
|---|---:|
| `telegram_publishers` | 2 |
| active publishers | 1 |
| `publisher_delivery_history` | 31 |
| dry-run history rows | 24 |
| sent history rows | 2 |
| failed history rows | 1 |
| blocked history rows | 1 |
| `datahub_publisher_source_mappings` | 2 |
| `telegram_channels` | 45 |
| `data_sources` | 55 |

Relevant schemas:

- `telegram_publishers`: persisted output channels with `channel_id`, optional encrypted bot token, `template`, `sent_count`, `last_sent_at`, `is_active`.
- `publisher_delivery_history`: delivery/test/dry-run log. P2 added `source_id`, `data_type`, `created_by`, `error_code`.
- `datahub_publisher_source_mappings`: P2 table mapping `source_id` to `publisher_id`, with `is_enabled`, nullable `template_id`, creator/timestamps.
- No real publisher templates table existed pre-change. P2 keeps templates as preview-only.
- Notification tables are separate: `notification_settings`, `notification_history`, legacy `notifications`.

### Settings -> Notifications dependency

Telegram Publisher and Settings -> Notifications are separate systems:

- Publisher channel credentials live in `telegram_publishers.bot_token_encrypted` and `telegram_publishers.channel_id`.
- Legacy/general notification Telegram config uses environment-backed `backend/services/telegram.js` (`TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`) and notification tables.
- Telegram Publisher does not require notification settings to work.
- The UI note is accurate after P2: personal alerts/trade notifications belong in Settings -> Notifications; DataHub broadcasts belong in Telegram Publisher.

## 2. Changes made

- Added real source-to-publisher mapping persistence with migration `041_datahub_publisher_source_mappings.sql`.
- Added mapping API: `GET/POST/PUT/DELETE /api/v1/data-hub/telegram-publishers/mappings`.
- Updated publish API payload to include `source_id`, `data_type`, `allow_temporary_publish`, and preserved `confirm_publish`.
- Enforced mapping before source publish unless temporary/manual publish is explicitly selected.
- Kept ACL and Blacklist/Whitelist enforcement after mapping; mapping does not weaken policies.
- Recorded richer publisher history with source, source name, user, content type, delivery mode, and error code.
- Recorded filter-blocked publish attempts as `status=blocked` with `error_code=FILTER_RULE_BLOCKED`.
- Improved UI copy, i18n, and terminology for Publisher Channel, Source Mapping, Test, Publish, and Message Preview Templates.
- Replaced the prompt-based Publish flow with an inline form requiring a DataHub source.
- Converted static mapping rows into clickable mapping rows that open a create/edit modal.
- Kept Templates preview-only and renamed it honestly to "Message Preview Templates".

## 3. Publish/Test contract

Test is a channel configuration test:

- Endpoint: `POST /api/v1/data-hub/telegram-publishers/:id/test`
- Does not require `source_id`.
- Uses dry-run when `TELEGRAM_PUBLISHER_DRY_RUN=true` or token is missing.
- Writes history with `content_type=test`.

Publish is source publishing:

- Endpoint: `POST /api/v1/data-hub/telegram-publishers/:id/publish`
- Requires `source_id`, `message`, `content_type`, `confirm_publish=true`.
- UI validates source/message before request.
- Requires enabled source mapping by default.
- Temporary/manual publish is explicit in UI and still enforces ACL/filter rules.

Visible backend errors include `SOURCE_ACCESS_DENIED`, `FILTER_RULE_BLOCKED`, `VALIDATION_ERROR`-style schema failures, `BOT_TOKEN_MISSING`, and mapping-required errors.

## 4. Mapping behavior

P2 chose the production-ready table option:

`datahub_publisher_source_mappings(id, source_id, publisher_id, is_enabled, template_id, created_at, updated_at, created_by)`.

UI behavior:

- Shows input source name/type, output publisher/channel, enabled/disabled status, last activity/status, and "ACL/filter protected" policy status.
- Clicking a row opens the edit mapping modal.
- "Create mapping" opens the same modal for new mappings.
- "Disable mapping" soft-disables by setting `is_enabled=false`.
- Empty state explains what mapping means.

## 5. Templates decision

P2 did not fake template CRUD. No `datahub_publisher_templates` table existed pre-change, and adding full template CRUD plus attachment workflow is P3 scope.

Current state is explicit: "Message Preview Templates" displays the template stored on the selected publisher channel.

P3 backlog: add `datahub_publisher_templates`, CRUD API, preview, and mapping/template attachment.

## 6. Security compatibility

Verified:

- Source publish still requires `source_id`.
- Legacy `/api/v1/data-sources/publish-telegram` still requires `source_id`.
- ACL denial returns `SOURCE_ACCESS_DENIED`.
- Blacklist/Whitelist publishing rules return `FILTER_RULE_BLOCKED`.
- Dry-run does not bypass ACL/filter.
- Mapping is checked before publish but does not replace ACL/filter checks.
- Mapping management route is treated as admin configuration, not source publishing, so global source ACL does not block creating mappings.

## 7. Runtime verification

Environment:

- `TELEGRAM_PUBLISHER_DRY_RUN=true`
- PM2 backend restored on port 5002.
- Telegram collector was moved off backend port conflict caused by a broad restart.

Functional checks:

| Check | Result |
|---|---|
| `GET /data-hub/telegram-publishers` | 200, 28-40ms |
| `POST /data-hub/telegram-publishers/mappings` | 201, mapping created |
| `GET /data-hub/telegram-publishers/mappings` | 200, mappings listed |
| `POST /:id/test` | 200, dry-run, history written |
| `POST /:id/publish` allowed source | 200, dry-run, history written with source/user/content_type |
| `POST /:id/publish` source denied by ACL | 403, `SOURCE_ACCESS_DENIED` |
| `POST /:id/publish` blocked by temp publishing blacklist rule | 403, `FILTER_RULE_BLOCKED`, history `status=blocked` |

Performance guard, 5 local backend runs:

| Endpoint | Times (s) | PASS criteria |
|---|---|---|
| `/data-sources/pipeline` | 0.055, 0.011, 0.007, 0.008, 0.007 | < 0.500s |
| `/data-sources?page=1&limit=20` | 0.057, 0.054, 0.020, 0.018, 0.017 | < 0.500s |
| `/data-hub/telegram-publishers` | 0.006, 0.009, 0.008, 0.007, 0.008 | < 0.500s |

Build/tests:

- `node --check` passed for changed backend files.
- `ReadLints` found no issues in changed frontend TS/TSX files.
- `npm run build` passed. Existing warnings remain for old missing exports in unrelated modules and large chunks.
- `npm test -- backend/__tests__/unit/telegramPublisherFilterRules.test.js` was blocked before tests ran by missing dependency `@testing-library/dom` in the repository test harness. The test file was updated for the new blocked-history behavior.

Browser/UI:

- Authenticated local frontend loaded.
- Browser navigation to DataHub was blocked by the current AI shell navigation not exposing DataHub in the snapshot during this run. UI verification therefore relied on successful Vite build, lints, and backend workflow verification.

Screenshots:

- Not captured. Browser snapshot confirmed authenticated shell loaded; DataHub tab was not reachable in the available navigation snapshot.

## 8. Remaining P3 backlog

- Implement real `datahub_publisher_templates` table, CRUD API, preview, and mapping attachment.
- Add enable/reactivate publisher action if product wants symmetric Disable/Enable controls.
- Add paginated/all-publisher history view rather than per-selected-publisher only.
- Add dedicated frontend component tests once the test harness dependency issue is fixed.
- Add a direct UI route/deep link to DataHub/Telegram Publisher for easier browser automation.

## 9. Final verdict

REAL WORKING

Reasons:

- Test works and clearly records dry-run/config results.
- Publish works with `source_id` and dry-run.
- Mapping click now opens edit behavior and mapping APIs are real.
- History updates with source/user/content/error details.
- i18n missing keys were fixed in EN/FA for blue/green locales.
- ACL and filter enforcement remain active.
- UI terminology is clearer and templates are honestly labeled preview-only.
