# DataHub Merge Readiness Review — DH-MERGE-READINESS-1

> **Date:** 2026-06-01  
> **Branch:** `feat/gap-008-sources-backend-wiring`  
> **Baseline commits reviewed:** `559c0e5` (GAP-037 fix), `39e6622` (runtime verify docs), `9c59593` (DH-SMOKE-1 docs)  
> **Scope:** DataHub only — no other modules/tabs/pages

---

## Final recommendation

**Ready to merge** with **non-blocking notes**.

DataHub core/advanced tabs, Telegram analytics subtabs (targeted re-check), role gates, backend-first data paths, and P0/GAP-037 closure criteria are satisfied. No blocking defect found for merge of the DataHub stabilization delta since `559c0e5`.

---

## Merge readiness checklist

| # | Criterion | Result | Evidence |
|---|-----------|--------|----------|
| 1 | GAP-037 closed + runtime verified | **Pass** | `39e6622`, DH-BUGFIX-2; `GAPS_AND_PLAN.md` |
| 2 | DH-SMOKE-1 overall | **Pass** | `9c59593`, `DATAHUB_SMOKE_RUNTIME_RESULTS.md` |
| 3 | Targeted Telegram subtabs (Categories / Breaking / Geographic) | **Pass** | DH-MERGE-READINESS-1 Playwright — scoped `[aria-label*="Telegram analytics"]` |
| 4 | UI role gates (admin/trader vs user/vip/viewer) | **Pass** | 5/5 roles; zero DataHub mutations during run |
| 5 | No fake/mock primary production data | **Pass** | No `75.0%` cache mock; no `fetchDataHubState` in DataHub components |
| 6 | Primary paths backend-first | **Pass** | React Query + `/api/v1/data-sources|data-categories|data-hub|telegram` |
| 7 | No DataHub 4xx/5xx during normal navigation | **Pass*** | One transient `404` on `agents/summary` during tab switch; direct re-check **200** |
| 8 | No DataHub-relevant console errors | **Pass** | Filtered console empty on targeted run |
| 9 | `TELEGRAM_PUBLISHER_DRY_RUN` unchanged | **Pass** | PM2 env present (value masked in ops logs) |
| 10 | No env/migration/live publish/dispatch | **Pass** | Review actions read-only |
| 11 | Working tree clean for scope | **Pass** | Reverted accidental `AutomationTopics.tsx` formatting-only drift |
| 12 | Changed files limited and justified | **Pass** | See § Files changed |

\*Non-blocking: intermittent 404 not reproduced on curl re-test (see § Network).

---

## Targeted smoke cleanup (DH-SMOKE-1 inconclusive items)

**Method:** Playwright headless on `https://titan.zala.ir`; JWT session inject (admin); tablist scoped to `aria-label` **Telegram analytics** (not main Data Hub tabs).

| Subtab | DH-SMOKE-1 | DH-MERGE-READINESS-1 | API observed |
|--------|------------|----------------------|--------------|
| **Categories** | Inconclusive | **Pass** | `GET /api/v1/telegram/health` 200 |
| **Breaking News** | Inconclusive | **Pass** | `GET /api/v1/telegram/breaking-news?...` 200 |
| **Geographic Map** | Inconclusive | **Pass** | Panel renders; map uses `GET /api/v1/telegram/events/recent` (lazy; may load after idle) |

**Selector fix:** Use exact labels from i18n — `Breaking News`, `Geographic Map` — inside `telegram_data_navigation` tablist only.

---

## Role-gate verification summary

**Method:** `titan_user` role inject + `titan_user_updated` event; **Sources** tab `Add Source` button (same pattern as DH-P0-SECURITY-7).

| Role | Write expected | Result | Disabled | Permission title |
|------|----------------|--------|----------|------------------|
| admin | allowed | **Pass** | no | — |
| trader | allowed | **Pass** | no | — |
| user | blocked | **Pass** | yes | yes |
| vip | blocked | **Pass** | yes | yes |
| viewer | blocked | **Pass** | yes | yes |

**Mutations:** No `POST/PUT/PATCH/DELETE` to DataHub API paths during automated run.

**Prior evidence:** `DATAHUB_UI_ROLE_GATE_VERIFICATION.md` (CROSS-003 closed) — still consistent.

**Hidden write endpoints:** Not exercised (read-only smoke). Backend RBAC on mutate routes unchanged since `e9115af` / `45ac3a1`.

---

## Backend-first / mock leakage

| Check | Result |
|-------|--------|
| `fetchDataHubState` in `components/.../DataHub/**` | **None** |
| Leak guard in `useDataHub.ts` | Merges API results only; no IndexedDB fallback as primary |
| Summary cards | `useDataHubSummaryMetrics` → `/data-sources/health`, `/stats` |
| Telegram panel | `axios` → `/api/v1/telegram/health`, `/agents/summary` |
| GAP-037 endpoint `/stats/real-time` | **Not wired in UI** (backend fixed; UI uses health + agents/summary) |

---

## Network note (transient 404)

During DH-MERGE-READINESS-1 navigation, one capture showed:

- `404 GET /api/v1/telegram/agents/summary?timeRange=24`

Immediate re-test (same host, admin JWT): **200** with valid JSON. DH-SMOKE-1 also recorded **200** for this path. Treated as **transient/race** during tab transition — **not a merge blocker**.

---

## Dependency / impact review

| Dependency | DataHub impact | Status |
|------------|----------------|--------|
| **Settings** | No DataHub-specific settings change in delta | OK |
| **Auth / JWT** | `telegramReadAuth` + DataHub write `authorize(admin,trader)` | OK |
| **RBAC / Permissions** | UI `dataHubPermissions.ts` + backend middleware | OK |
| **API contracts** | Response shapes stable; GAP-037 processor fields preserved | OK |
| **Cache / Redis** | Not required for DataHub list reads in smoke | OK |
| **PostgreSQL** | All primary reads 200 in smoke | OK |
| **PM2** | `titan-backend` online; health 200 | OK |
| **Docker / Nginx** | `titan.zala.ir` → API proxy OK | OK |
| **Logs / Monitoring** | No `telegram_created_at` missing-column in recent verification | OK |
| **Runtime** | `TELEGRAM_PUBLISHER_DRY_RUN` still **true**; live publish N/A | OK |

---

## Files changed (since pre-GAP-037 stable `559c0e5^`)

| File | Change |
|------|--------|
| `backend/routes/telegram.js` | GAP-037 processor stats JOIN + COALESCE |
| `docs/ssot_v3/GAPS_AND_PLAN.md` | GAP-037 Closed |
| `docs/ssot_v3/DATAHUB_P0_SECURITY_CLOSURE_SUMMARY.md` | GAP-037 verified note |
| `docs/ssot_v3/EVIDENCE.md` | Runtime note for `/stats/real-time` |
| `docs/ssot_v3/DATAHUB_SMOKE_RUNTIME_RESULTS.md` | DH-SMOKE-1 evidence (new) |
| `docs/ssot_v3/DATAHUB_MERGE_READINESS_REVIEW.md` | This review (new) |

**Not in delta:** frontend feature files (except reverted local formatting drift on `AutomationTopics.tsx`).

---

## Blocking issues

**None identified** for DataHub merge of commits `559c0e5` … `9c59593` (+ this doc).

---

## Non-blocking issues

1. **UI does not call** `GET /api/v1/telegram/stats/real-time` — backend fixed for API consumers; optional future UI wiring.
2. **Transient 404** on `agents/summary` during one automated tab switch — monitor post-merge; not reproduced on curl.
3. **Geographic Map** lazy-load — smoke Pass on render; `events/recent` may fire after idle (not always in short capture window).
4. **Open GAPs** (GAP-014, GAP-017, GAP-025, schedulers, bundle size) — v3.1 / non-DataHub-merge blockers per `GAPS_AND_PLAN.md`.
5. **Live Telegram publish/dispatch** — still NO-GO without separate high-risk approval despite GAP-036 closure.

---

## Constraints honored

- No new features, redesign, migration, env change, live publish/dispatch, or dry-run disable.
- Read-only browser verification; accidental formatting-only working-tree drift reverted.

---

## Changelog

| Date | Change |
|------|--------|
| 2026-06-01 | DH-MERGE-READINESS-1 — merge readiness review + targeted smoke cleanup |
