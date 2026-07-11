# DH-TELEGRAM-PUBLISHER-P1-SAFE-RCA-AND-TEST-DELIVERY

> **Task:** DH-TELEGRAM-PUBLISHER-P1-SAFE-RCA-AND-TEST-DELIVERY  
> **Date:** 2026-07-09  
> **Commit:** `9421d2b` — `docs(datahub): telegram publisher P1 safe RCA and delivery evidence`  
> **Mode:** Read-only RCA → safe dry-run tests → browser QA (no blind fixes)  
> **Verdict:** **REAL WORKING LIVE VERIFIED** (P2 controlled live test succeeded; dry-run gate restored)

---

## Executive summary

Telegram Publisher is **not code-broken** after unification/redesign. Test and publish requests succeed and write `publisher_delivery_history`, but **no Telegram messages are delivered** because production PM2 sets:

```
TELEGRAM_PUBLISHER_DRY_RUN=true
NODE_ENV=production
```

This forces all test/publish paths through dry-run recording (`telegram_message_id: null`). Operators perceive “Publisher broken” because UI success messages do not result in channel messages — the dry-run safety banner is present but easy to miss against green success toasts.

**Live test was not performed** — intentional production safety gate. Remediation for live sends is operational (disable dry-run flag), not a Publisher code defect.

---

## Phase 1 — RCA truth table

| Layer | Expected | Actual | Evidence | Fix needed |
|-------|----------|--------|----------|------------|
| **PM2 env** | Live optional when operator confirms | `TELEGRAM_PUBLISHER_DRY_RUN=true` forces dry-run | `pm2 env titan-backend` | **Operational:** set `false` for live (not code change in P1) |
| **Frontend UI** | Clear dry-run vs live | Banner + `dry_run_forced` from API; publish button label switches | Browser screenshot `telegram-publisher-p1-overview.png` | None for P1 (UX adequate with banner) |
| **Frontend API** | `confirm_publish: true` on publish | Always sent; no `confirm_live` (automation-only param) | `TelegramPublisher.tsx` `handlePublish` | None — Publisher uses `confirm_publish` by design |
| **Backend route** | `/api/v1/data-hub/telegram-publishers/:id/test` + `/publish` | 200 for dry-run test/publish | API trace 2026-07-09 | None |
| **Service** | `runPublisherTest` / `runPublisherPublish` | Dry-run when `isPublisherDryRunForced()` | `telegramPublisherService.js` L7–11, L303, L508 | None |
| **Bot token** | Encrypted in `telegram_publishers` | `has_bot_token: true`, `token_len: 158` (masked) | DB query | None |
| **Channel** | Active target channel | `channel_id: 104595348`, `is_active: true` | DB + API list | None |
| **Mappings** | Source→publisher required | 6 mappings; BBCPersian/JUST IN TIME publish dry-run OK | API publish trace | None |
| **ACL gateway** | Publisher agent allowed per source | `alphavantage DEMO TEST` → 403 `agent_not_in_allow_list`; BBCPersian/JUST IN TIME → 200 dry-run | API trace | **Config:** add `publisher` to source ACL allow-list where needed |
| **Filter rules** | Enforced before send | Pass for tested sources | History `blocked: 1` total (legacy) | None |
| **Telegram API network** | Backend reaches `api.telegram.org` | HTTP 302 in 0.12s | `curl` from server | None |
| **Notifications P3** | Must not own Publisher credentials | Separate `notification_settings` / env `TELEGRAM_BOT_TOKEN`; reads publisher for delivery only | `notificationService.js` | **No regression** |
| **Telegram Collector** | Must not publish | Collector ingests only; no `sendMessage` in collector paths | Code audit | **No regression** |
| **Automation Routing** | Uses Publisher via `runPublisherPublish` | Separate `confirm_live` for automation queue only | `datahubAutomationService.js` | **No regression** |
| **Data Pipeline** | Feeds data, no bypass | Routes through ACL gateway on publish | `dataPipeline.js` | **No regression** |
| **Delivery history** | Reflects dry-run honestly | 71 `dry_run` rows; recent tests show no `telegram_message_id` | DB `publisher_delivery_history` | None |

---

## Phase 2 — Delivery path trace

Active publisher: `887495e6-0b47-4450-88ef-35dd43477f9a` (تایتان تست)

### Test path (channel config test)

| Step | PASS/FAIL | Evidence |
|------|-----------|----------|
| UI Test button → `POST /:id/test` | **PASS** | Browser + API |
| Route auth (admin/trader) | **PASS** | JWT admin |
| `runPublisherTest` | **PASS** | No mapping/ACL required for test |
| Token lookup (decrypt) | **PASS** | Token present (not used in dry-run) |
| Dry-run gate (`TELEGRAM_PUBLISHER_DRY_RUN`) | **PASS (forced)** | `dry_run: true` |
| Telegram Bot API `sendMessage` | **SKIP** | Not called in dry-run |
| `publisher_delivery_history` | **PASS** | `status: dry_run`, `history_id` set |
| `telegram_message_id` | **PASS (null)** | Correct for dry-run |

### Publish path (source-mapped, BBCPersian)

| Step | PASS/FAIL | Evidence |
|------|-----------|----------|
| UI/API `POST /:id/publish` | **PASS** | `publishDryRun` API 200 |
| `confirm_publish: true` | **PASS** | Required and sent |
| ACL gateway (`agentKey: publisher`) | **PASS** | BBCPersian allowed |
| `assertPublisherMapping` | **PASS** | Mapping enabled |
| `enforcePublishingPolicy` | **PASS** | No block |
| Dry-run gate | **PASS (forced)** | `dry_run: true` |
| Telegram Bot API | **SKIP** | Dry-run |
| History | **PASS** | `status: dry_run` |

### Publish path (alphavantage — ACL blocked)

| Step | PASS/FAIL | Evidence |
|------|-----------|----------|
| ACL gateway | **FAIL (expected)** | 403 `agent_not_in_allow_list` |
| Service never reached | **PASS** | Gateway blocks before history (no blocked row in this path) |

---

## Phase 3 — Safe tests (2026-07-09)

### Dry-run test (performed)

```http
POST /api/v1/data-hub/telegram-publishers/887495e6-0b47-4450-88ef-35dd43477f9a/test
{ "message": "P1 browser dry-run test — <timestamp>" }
```

**Response:** `200`, `success: true`, `dry_run: true`, `status: dry_run`, `telegram_message_id: null`, `history_id` recorded.

### Publish dry-run (performed)

```http
POST /api/v1/data-hub/telegram-publishers/887495e6-0b47-4450-88ef-35dd43477f9a/publish
{
  "message": "P1 safe publish dry-run — <timestamp>",
  "source_id": "<BBCPersian source uuid>",
  "confirm_publish": true,
  "content_type": "manual",
  "data_type": "telegram"
}
```

**Response:** `200`, `dry_run: true`, `telegram_message_id: null`, history recorded.

### Live test (not performed)

**Reason:** `TELEGRAM_PUBLISHER_DRY_RUN=true` in production PM2 — intentional safety gate.

**Remediation for operator live test:**

1. Set `TELEGRAM_PUBLISHER_DRY_RUN=false` in PM2 ecosystem for `titan-backend`
2. `pm2 restart titan-backend`
3. Confirm source ACL allows `publisher` agent
4. Use mapped source + `confirm_publish: true` from UI
5. Send one message: `TitanGold Telegram Publisher live test — <timestamp>`
6. Verify `telegram_message_id` in history and channel message

---

## Phase 4 — Common failure checks

| Check | Result |
|-------|--------|
| P2 Notifications disabled live Telegram globally | **No impact on Publisher** — separate credentials path; Publisher dry-run is its own env flag |
| Token moved/hidden | **Token intact** in `telegram_publishers.bot_token_encrypted` |
| Channel mapping broken | **Mappings work** for BBCPersian/JUST IN TIME |
| dry-run default | **Yes — forced in prod** via `TELEGRAM_PUBLISHER_DRY_RUN=true` |
| `confirm_live` missing in UI | **By design** — Publisher uses `confirm_publish`; `confirm_live` is automation/notifications only |
| Bot API server-side only | **Confirmed** — `sendTelegramBotMessage` in backend; browser makes zero `api.telegram.org` calls |
| ACL too strict | **Partial** — some sources block publisher agent (correct policy) |
| History misleading | **No** — dry-run rows correctly lack `telegram_message_id` |

---

## Phase 5 — UI/UX audit

| Requirement | Status |
|-------------|--------|
| Dry-run banner when forced | **Present** — `publisher_dry_run_forced_banner` |
| Publish button label | **Conditional** — `Publish / Dry-run` when forced; `Publish` when live allowed |
| Test success message distinguishes dry-run | **Yes** — `publisher_test_dry_run` / `publisher_publish_dry_run` |
| Separate live confirmation dialog | **Gap (non-blocking)** — `confirm_publish` always true; live gated by server env |

---

## Phase 6 — Security verification

| Rule | Status |
|------|--------|
| Bot token not in API responses | **PASS** — `has_bot_token` boolean only |
| No frontend `api.telegram.org` | **PASS** — browser QA `noBrowserTelegramApi: true` |
| ACL + filter + mapping enforced on publish | **PASS** |
| Manual test bypasses mapping | **Only test endpoint** — publish requires mapping or `allow_temporary_publish` |

---

## Phase 7 — Performance

| Endpoint | Target | Measured |
|----------|--------|----------|
| `GET /telegram-publishers` | < 500ms | **210ms** |
| `GET /mappings` | < 500ms | **55ms** |
| `GET /:id/history` | < 500ms | **81ms** |
| Test POST | — | **86ms** |
| Publish POST (dry-run) | — | **131ms** |

No heavy pipeline queries on Publisher page.

---

## Phase 8 — Tests & build

| Check | Result |
|-------|--------|
| `telegramPublisherDelivery.test.js` | Pass |
| `telegramPublisherFilterRules.test.js` | Pass |
| Browser QA script | Pass (`browserQaPass: true`) |

---

## Phase 9 — Browser evidence

**Script:** `backend/scripts/telegram-publisher-p1-browser-verify.mjs`  
**Evidence:** `docs/ssot_v3/screenshots/telegram-publisher-p1-evidence.json`

| Screenshot | Content |
|------------|---------|
| `telegram-publisher-p1-overview.png` | Channels, mappings, dry-run banner |
| `telegram-publisher-p1-history.png` | Delivery history with dry-run statuses |

---

## Database snapshot (masked)

| Metric | Value |
|--------|-------|
| Active publishers with token | 2 |
| Mappings enabled | 6 |
| History `dry_run` | 71 |
| History `sent` (last live) | 3 — last **`2026-07-09`** (P2 live test) |
| History `failed` | 1 |
| History `blocked` | 1 |

---

## P2 — Controlled Live Test (2026-07-09)

**Task:** `DH-TELEGRAM-PUBLISHER-P2-CONTROLLED-LIVE-ENABLE-TEST`

### Pre-live checklist — all pass

| Check | Result |
|-------|--------|
| Active publisher + bot token | `887495e6-…` — `has_token: true` |
| Channel active | `104595348` |
| Mapping BBCPersian enabled | `d51d05a4-748a-4459-8a30-f132ef8d3e81` |
| ACL allows `publisher` | No block (default allow) |
| Dry-run test works | `dry_run: true`, history recorded |
| `api.telegram.org` reachable | HTTP 200 from backend |

### Env before / after

| Phase | `TELEGRAM_PUBLISHER_DRY_RUN` | `dry_run_forced` (API) |
|-------|------------------------------|------------------------|
| Before P2 live | `true` | `true` |
| During live test | `false` | `false` |
| After rollback (Option A) | `true` | `true` |

**Rollback decision:** **Option A** — restored `TELEGRAM_PUBLISHER_DRY_RUN=true` and `pm2 restart titan-backend --update-env`. Live remains disabled by default until operator explicitly re-enables.

### Live test (exactly one message)

| Field | Value |
|-------|-------|
| Timestamp | `2026-07-09T20:59:55.037Z` |
| Message | `TitanGold Telegram Publisher live test — 2026-07-09T20:59:55.037Z` |
| Publisher | `887495e6-0b47-4450-88ef-35dd43477f9a` (تایتان تست) |
| Source | BBCPersian (mapped, no temporary bypass) |
| `confirm_publish` | `true` |
| API response | `200`, `success: true`, `dry_run: false`, `status: sent` |
| `telegram_message_id` | **`205`** (Telegram Bot API accepted message) |
| `history_id` | `5bbe54b7-0c74-4e42-8363-a6b4f1a95e39` |
| `delivery_mode` (metadata) | `live` |
| Duplicate sends | **None** — single controlled publish |

### P2 browser evidence

**Script:** `backend/scripts/telegram-publisher-p2-live-browser-verify.mjs`  
**Evidence:** `docs/ssot_v3/screenshots/telegram-publisher-p2-live-evidence.json`

| Screenshot | Content |
|------------|---------|
| `telegram-publisher-p2-live-overview.png` | Dry-run banner restored post-rollback |
| `telegram-publisher-p2-live-history.png` | History row with live test message + `sent` |

Post-rollback browser QA: **pass** (`browserQaPass: true`)

### Scope honored

- Telegram Collector — **not touched**
- Notifications — **not touched**
- Automation Routing — **not touched**
- ACL / filter / mapping — **enforced** (BBCPersian mapped source)
- Bot token / chat ID — **not exposed** in evidence

---

## Final verdict

**REAL WORKING LIVE VERIFIED**

- P1: Dry-run path operational; safety gate documented
- P2: **One live Telegram message delivered** (`telegram_message_id: 205`)
- Delivery history **matches** live behavior (`status: sent`, `delivery_mode: live`)
- Post-test rollback to **`TELEGRAM_PUBLISHER_DRY_RUN=true`** (Option A)
- No Telegram secret leak; no Collector/Notifications/Automation regression
- Browser QA and backend tests **pass**

**Operational note:** Re-enable live Publisher sends only by setting `TELEGRAM_PUBLISHER_DRY_RUN=false` in `backend/ecosystem.config.json` and restarting `titan-backend` with operator approval.
