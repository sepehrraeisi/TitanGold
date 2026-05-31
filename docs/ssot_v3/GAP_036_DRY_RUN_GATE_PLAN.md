# GAP-036 — Safe Publisher / Automation Dry-Run Gate Plan (DH-P0-SECURITY-8)

> **Status:** Planning only — **execution not started**  
> **Date:** 2026-05-31  
> **Gap:** GAP-036 (Open) — blocks D-02 / D-03 and high-risk DataHub outbound Telegram  
> **Related:** [`DATAHUB_P0_SECURITY_VERIFICATION.md`](./DATAHUB_P0_SECURITY_VERIFICATION.md), [`DATAHUB_DRY_RUN_TEST_PLAN.md`](./DATAHUB_DRY_RUN_TEST_PLAN.md), [`DATAHUB_DRY_RUN_RUNTIME_RESULTS.md`](./DATAHUB_DRY_RUN_RUNTIME_RESULTS.md)

---

## Executive summary

| Item | Detail |
|------|--------|
| **Problem** | Production `titan-backend` runs with `NODE_ENV=production` and `TELEGRAM_PUBLISHER_DRY_RUN` unset. `isPublisherDryRunForced()` returns **false**, so publisher **test**, **publish**, and automation paths that call `runPublisherPublish()` may hit the live Telegram Bot API when a publisher has a bot token and chat_id. |
| **Impact** | D-02 (`POST …/telegram-publishers/:id/test`) and D-03 (`POST …/automation/test-run`) remain **NO-GO**. High-risk execution (DH-FINAL-6R) remains **NO-GO**. |
| **Recommended option** | **Option A** — set `TELEGRAM_PUBLISHER_DRY_RUN=true` in PM2 env for `titan-backend` only, then controlled restart with `--update-env`. |
| **Why Option A** | Matches existing code in `backend/services/telegramPublisherService.js`; protects **all** publisher and automation-via-publisher paths; allows realistic D-02/D-03 verification on the **same** active publisher chain. |
| **Approval required** | Explicit operator approval **before** any env change, restart, or D-02/D-03 execution. This document does **not** authorize execution. |

**Code reference (no change required):**

```5:8:backend/services/telegramPublisherService.js
export function isPublisherDryRunForced() {
  if (process.env.TELEGRAM_PUBLISHER_DRY_RUN === 'true') return true;
  if (process.env.TELEGRAM_PUBLISHER_DRY_RUN === 'false') return false;
  return process.env.NODE_ENV !== 'production';
}
```

When forced dry-run is true, `runPublisherTest()` returns `dry_run: true`, `status: 'dry_run'`, `telegram_message_id: null` without calling `sendTelegramBotMessage()`.

---

## Current runtime baseline (2026-05-30 audit)

Captured in DH-P0-SECURITY-1 / DH-FINAL-5G (read-only). Re-capture at execution time.

| Check | Known value |
|-------|-------------|
| `NODE_ENV` (PM2 `titan-backend`) | `production` |
| `TELEGRAM_PUBLISHER_DRY_RUN` | unset (`null` in PM2) |
| `isPublisherDryRunForced()` | **false** |
| Active publishers | 1 |
| With bot token | 1 |
| With chat_id | 1 |
| Example publisher id (DH-FINAL-4/5) | `5ab9a6bc-…` (confirm at run time) |
| D-01 crawler dry-run | **Pass** |
| D-02 / D-03 | **Not executed** — NO-GO |

---

## Option comparison

### Option A — `TELEGRAM_PUBLISHER_DRY_RUN=true` (preferred)

| Dimension | Detail |
|-----------|--------|
| **Steps** | 1) Pre-change capture (below). 2) Add `TELEGRAM_PUBLISHER_DRY_RUN: "true"` to `titan-backend` env in `backend/ecosystem.config.json` (or approved PM2 env source — see Change section). 3) `pm2 restart …/ecosystem.config.json --only titan-backend --update-env`. 4) Post-change verification. 5) Only then run D-02, then D-03 per test plan. |
| **Risk** | **Low–medium** — brief API unavailability during restart; **no** live send if gate works; other PM2 apps untouched. |
| **Pros** | Most realistic; covers test, publish, automation dispatch chain; single switch; reversible. |
| **Cons** | Requires env change + restart; production flag must be removed or accepted after verification window. |
| **Rollback** | Remove or set `TELEGRAM_PUBLISHER_DRY_RUN=false`; restart `titan-backend` only; verify unset/previous via `pm2 jlist`. |
| **Verification** | PM2 env shows `true`; `GET /health` 200; D-02 response `dry_run: true`, `telegram_message_id: null`; D-03 `publishResult.dry_run === true` or execution `dry_run`; no Telegram message id; logs show no outbound Bot API send. |

### Option B — Token-less publisher probe

| Dimension | Detail |
|-----------|--------|
| **Steps** | 1) Use or create publisher with **no** `bot_token_encrypted`. 2) Run D-02 against that id only. 3) Optionally wire automation topic to same publisher for D-03. |
| **Risk** | **Medium** — wrong publisher id → live send on tokenized publisher; does not prove production publisher row. |
| **Pros** | No PM2 env change; no restart. |
| **Cons** | Does not verify active production publisher; automation may target different publisher; `dryRun = forced \|\| !token` only safe for **that** row. |
| **Rollback** | N/A (no env change); delete/disable probe publisher if created. |
| **Verification** | D-02 on token-less id only; confirm active tokenized publisher **not** used. |

### Option C — Staging / non-production runtime

| Dimension | Detail |
|-----------|--------|
| **Steps** | 1) Deploy branch to staging with `NODE_ENV !== 'production'` (or `TELEGRAM_PUBLISHER_DRY_RUN=true`). 2) Run D-02/D-03 against staging DB/API. |
| **Risk** | **Low** on prod Telegram; **medium** ops cost (parity drift). |
| **Pros** | Clean separation; no production restart. |
| **Cons** | Requires staging parity (DB, publishers, automation topics); may not match prod publisher id/token state. |
| **Rollback** | Tear down staging test; prod unchanged. |
| **Verification** | Staging health + dry-run responses; confirm prod PM2 untouched. |

---

## Recommended option: A

**Rationale:** GAP-036 is an **operational env gate**, not a code defect. Option A aligns with `DATAHUB_DRY_RUN_TEST_PLAN.md`, DH-FINAL-5G unblock criteria, and `GAPS_AND_PLAN.md` notes. It is the only option that validates D-02/D-03 on the **same** active publisher + automation chain used in production without weakening `NODE_ENV=production` globally.

**Required approval before execution:**

1. Maintenance window acceptable for `titan-backend` restart (2 cluster instances).
2. Stakeholder sign-off that **all** publisher tests and automation dispatches will be dry-run only while flag is `true`.
3. Rollback owner assigned.
4. Separate approval to run D-02 and D-03 **after** post-change verification passes.

---

## Option A — Execution plan (do not run until approved)

### Pre-change capture

Run read-only; save output to execution log (e.g. `DATAHUB_DRY_RUN_RUNTIME_RESULTS.md` appendix or ticket).

| Step | Command / action | Record |
|------|------------------|--------|
| Git | `git status` | branch, clean/dirty |
| PM2 | `pm2 status` | `titan-backend` online, instance count |
| Health | `curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:5002/health` (or prod URL) | expect **200** |
| Env read-only | `pm2 jlist` → filter `titan-backend` env | `NODE_ENV`, `TELEGRAM_PUBLISHER_DRY_RUN` |
| Publisher SQL | `SELECT COUNT(*) FILTER (WHERE is_active) AS active_count, COUNT(*) FILTER (WHERE is_active AND bot_token_encrypted IS NOT NULL) AS with_token, COUNT(*) FILTER (WHERE is_active AND channel_id IS NOT NULL AND channel_id <> '') AS with_chat FROM telegram_publishers;` | counts only — **no** token values |
| Baseline D-02/D-03 | **Do not run** | document "not executed pre-change" |

### Change (env only — no code, DB, tokens, or publisher rows)

**Preferred (version-controlled):** Add to `backend/ecosystem.config.json` under `apps[0].env` for `titan-backend`:

```json
"TELEGRAM_PUBLISHER_DRY_RUN": "true"
```

**Alternative (if policy forbids ecosystem commit on prod host):** Set via `pm2 set` / deploy pipeline env injection — must still appear in `pm2 jlist` for `titan-backend` after restart.

**Do not:**

- Edit `backend/.env` unless that is the single approved source of truth (ecosystem `env` + `env_file` both load — verify effective value after restart).
- Change `NODE_ENV`, bot tokens, `telegram_publishers` rows, or automation topics for this gate.

### Restart (titan-backend only)

```bash
pm2 restart /home/ubuntu/webapp/TitanGold/backend/ecosystem.config.json --only titan-backend --update-env
```

**Do not** restart `titan-engine-worker` or other processes unless explicitly approved.

### Post-change verification (before D-02 / D-03)

| # | Check | Pass criteria |
|---|--------|----------------|
| 1 | `pm2 status` | `titan-backend` online, expected instance count |
| 2 | `GET /health` | **200**, DB connected |
| 3 | PM2 env | `TELEGRAM_PUBLISHER_DRY_RUN` === `"true"` on **both** cluster workers |
| 4 | Optional code-path probe | Call internal health or run **read-only** check that `isPublisherDryRunForced()` would be true (e.g. log line at startup if added later — not required for v1) |
| 5 | D-02 / D-03 | **Still do not run** until rows 1–3 pass |

### D-02 / D-03 execution (separate approval, after post-change verification)

Only after table above passes. Follow [`DATAHUB_DRY_RUN_TEST_PLAN.md`](./DATAHUB_DRY_RUN_TEST_PLAN.md).

| Test | Endpoint | Body | Pass criteria |
|------|----------|------|----------------|
| **D-02** | `POST /api/v1/data-hub/telegram-publishers/:id/test` | `{ "message": "DH-P0-SECURITY-8 dry-run probe" }` | `dry_run: true`, `status: "dry_run"`, `telegram_message_id: null`; history `status=dry_run` |
| **D-03** | `POST /api/v1/data-hub/automation/test-run` | `{ "dry_run": true }` (+ `topic_id` if required) | `publishResult.dry_run === true` or execution dry-run; **no** live `telegram_message_id`; **no** publisher `sent_count` increment |

**Auth:** admin/trader JWT (same as prior DataHub runtime tests). **No** UI "Live Run" clicks.

**Order:** D-02 first → confirm gate → D-03 second.

Record results in [`DATAHUB_DRY_RUN_RUNTIME_RESULTS.md`](./DATAHUB_DRY_RUN_RUNTIME_RESULTS.md). GAP-036 may be marked **Closed** only after D-02 and D-03 pass and operator accepts residual risk for live publish while flag remains `true`.

---

## Safety requirements (hard gates)

D-02 and D-03 **must not** run until **all** are true:

1. Written approval for env change + restart.
2. `TELEGRAM_PUBLISHER_DRY_RUN=true` visible in PM2 env for `titan-backend`.
3. `titan-backend` restarted with `--update-env`.
4. `GET /health` returns **200**.
5. Operator confirms `isPublisherDryRunForced()` behavior (via D-02 probe response, not code deploy).

While `TELEGRAM_PUBLISHER_DRY_RUN=true`:

- Live publish and live dispatch from UI/API should remain **dry-run only** (forced).
- Plan a **rollback window** after verification; leaving `true` in production may block real sends intentionally.

---

## Rollback plan (Option A)

| Step | Action |
|------|--------|
| 1 | Revert `TELEGRAM_PUBLISHER_DRY_RUN` in `ecosystem.config.json` (remove key or set `"false"`) |
| 2 | `pm2 restart /home/ubuntu/webapp/TitanGold/backend/ecosystem.config.json --only titan-backend --update-env` |
| 3 | `pm2 jlist` — confirm `TELEGRAM_PUBLISHER_DRY_RUN` unset or previous value |
| 4 | `GET /health` — **200** |
| 5 | Document rollback time and verifier |

**Do not** run D-02/D-03 during rollback unless testing live path is explicitly approved (would be live-send capable again).

---

## Stop conditions (abort immediately)

| Condition | Action |
|-----------|--------|
| Backend health not **200** after restart | Rollback; incident log |
| PM2 env does not show `TELEGRAM_PUBLISHER_DRY_RUN=true` after restart | Do not run D-02/D-03; fix env source; re-restart |
| D-02 response contains non-null `telegram_message_id` | **Stop**; rollback; check channel for message; document in results |
| D-02 `dry_run: false` or `status` not `dry_run` | **Stop**; no D-03 |
| D-03 indicates live dispatch or live publish result | **Stop**; rollback |
| Logs show Telegram Bot API `sendMessage` / outbound send for probe | **Stop**; rollback |
| `titan-engine-worker` or other PM2 app restarted/affected unintentionally | **Stop**; assess blast radius |
| Any unapproved DB/token/publisher row change | **Stop**; revert |

---

## What this plan does not cover

| Item | Owner / doc |
|------|-------------|
| GAP-037 `GET /telegram/stats/real-time` schema 500 | Separate backend fix |
| Live publish / live automation dispatch approval | [`DATAHUB_HIGH_RISK_EXECUTION_PLAN.md`](./DATAHUB_HIGH_RISK_EXECUTION_PLAN.md) |
| UI banner when dry-run not forced (P2) | Future enhancement |
| Leaving `TELEGRAM_PUBLISHER_DRY_RUN=true` permanently | Product/ops decision after verification |

---

## GAP-036 closure criteria (future)

| Criterion | Status |
|-----------|--------|
| Plan documented | ✅ This doc (DH-P0-SECURITY-8) |
| Env gate applied | ⏳ Pending approval |
| D-02 Pass | ⏳ Pending |
| D-03 Pass | ⏳ Pending |
| Rollback tested or documented | ⏳ Pending |
| GAP-036 marked Closed in `GAPS_AND_PLAN.md` | ⏳ After execution |

---

## Changelog

| Date | Change |
|------|--------|
| 2026-05-31 | DH-P0-SECURITY-8 — planning doc created; no env/restart/D-02/D-03 |
