# Full Branch Review — DH-FULL-BRANCH-REVIEW-1

> **Date:** 2026-06-01  
> **Branch:** `feat/gap-008-sources-backend-wiring` @ `f9af102`  
> **Compare base (historical):** `15c7ec2` (local `main` before PR merges)  
> **Remote `origin/main`:** `ae516d0` (includes PR #8 merge through `39e6622`)  
> **Review only — no merge performed**

---

## Executive summary

| Question | Answer |
|----------|--------|
| Is the **5-commit stabilization slice** (`559c0e5`..`f9af102`) safe? | **Yes** — verified in DH-BUGFIX-1/2, DH-SMOKE-1, DH-MERGE-READINESS-1 |
| Is the **full branch** (~94 commits) verified end-to-end? | **No** — only DataHub (+ P0 security/dry-run) paths were runtime-tested |
| Is **full branch** already on `main`? | **Mostly yes** — PR #8 merged **91 commits** through `39e6622`; **3 doc commits** remain ahead of `origin/main` |
| Recommended merge strategy | **Merge pending docs-only delta to `main`**; do **not** re-merge full branch; treat historical full branch as **needs separate verification** for non-DataHub commits |

**Final recommendation:** **Not safe to merge full branch as a single “fully verified” unit** without additional module review — but **safe to merge remaining docs-only delta** (`origin/main..f9af102`). For greenfield merges, **would have needed separate PR split**; retrospectively, PR #8 already landed the code bulk.

---

## Current git state vs `main`

| Metric | Value |
|--------|-------|
| `origin/main` tip | `ae516d0` — Merge PR #8 from `feat/gap-008-sources-backend-wiring` |
| Feature branch tip | `f9af102` |
| **Pending on branch (not on `origin/main`)** | **3 commits**, **2 files** (docs only) |
| Historical branch size (`15c7ec2..f9af102`) | **94 commits**, **187 files** |

### Pending commits (`origin/main..HEAD`)

| Commit | Area |
|--------|------|
| `9c59593` | Docs — DH-SMOKE-1 results |
| `89111f8` | Docs — merge readiness review |
| `f9af102` | Docs — role-gate sync in smoke doc |

### Pending files

- `docs/ssot_v3/DATAHUB_SMOKE_RUNTIME_RESULTS.md`
- `docs/ssot_v3/DATAHUB_MERGE_READINESS_REVIEW.md`

---

## Commit grouping table (historical `15c7ec2..f9af102`, n=94)

Path-aware classification (primary paths touched per commit).

| Area | Count | Description |
|------|-------|-------------|
| **Docs only** | 47 | SSOT, plans, verification, DEMOS, PR summaries |
| **Docs (DataHub/SSOT)** | 29 | DataHub-tagged doc commits (often paired with code in same PR flow) |
| **DataHub (code)** | ~35 | Backend-first tabs, advanced features, design pass, fixes (see code-path log) |
| **Automation/Telegram Publisher** | 4+ | GAP-016/018/019, publisher service, dry-run gate |
| **Security/RBAC** | 4+ | GAP-006/009/011, CROSS-003, `telegramReadAuth`, write gates |
| **Database/migrations** | 8+ | Migrations 025–033 + 012 fix + query perf |
| **Config/runtime/env** | 1 | `e4f2b79` — `TELEGRAM_PUBLISHER_DRY_RUN=true` in ecosystem |
| **Backend/API (non-DataHub)** | 2+ | `42c48af` analytics route; `57f1e8e` Artemis fallback |
| **Infra/scripts** | 2+ | Backup rotation / healthcheck scripts |
| **Settings** | 1+ | Automation/Cache settings touches |
| **Frontend/UI (non-DataHub)** | 1+ | Sources soft-delete UI (`51f9995`) — DataHub-adjacent |
| **Tests** | 1+ | `e2e/dataHub.controlled-smoke.spec.ts` |

### Representative DataHub code commits (35 touching DataHub paths)

Includes: `d945f23` GAP-008 Sources … through `559c0e5` GAP-037 fix, P0 security (`e9115af`, `45ac3a1`, `ce944cb`), GAP-024–032 features, `a1ac041` leak guard, `e4f2b79` dry-run env.

### Commits outside DataHub theme (require separate review)

| Commit | Risk / note |
|--------|-------------|
| `42c48af` | fix(api): restore analytics overview route |
| `3b364a3` | feat(infra): backup system upgrade |
| `2873367` | feat(infra): 7-4-3 backup automation |
| `57f1e8e` | fix(ai): Artemis default fallback state |
| `e97e812`, `341a815` | Backup / environment docs |

---

## Changed files grouping (`15c7ec2..f9af102`, n=187)

| Area | Files | Examples |
|------|-------|----------|
| **DataHub (frontend)** | 76 | `components/ai/AIManager/tabs/DataHub/**`, hooks, `services/data*Api.ts` |
| **Docs (DataHub/SSOT)** | 55 | `docs/ssot_v3/**`, plans, verification, GAP docs |
| **Database/migrations** | 11 | `025`–`033` DataHub tables, `012` FK fix, `query_performance_optimization.sql` |
| **DataHub (backend)** | 5+ | `backend/routes/data-*`, `telegram.js`, `datahub*Service.js` |
| **Automation/Telegram Publisher** | 9 | `telegram-publishers.js`, `telegramPublisherService.js`, automation UI panels |
| **Security/RBAC** | 3 | `telegramAuth.js`, `dataHubPermissions.ts`, route `writeAuth` |
| **Config/runtime/env** | 1 | `backend/ecosystem.config.json` |
| **Backend/API (non-DataHub)** | 5 | `analytics.js`, `access-control.js`, `v1/index.js` |
| **Settings** | 2 | `AutomationSettings.tsx`, `CacheSettings.tsx` |
| **Infra/scripts** | 12 | `scripts/titangold-backup-*.sh`, cron conf |
| **Docs only (general)** | 4 | scripts README, environment proof |
| **Tests** | 1 | `e2e/dataHub.controlled-smoke.spec.ts` |
| **Other** | 1 | `public/maps/world-countries.json` (Geographic heat map) |

---

## Changes outside DataHub

**Present and already on `origin/main` via PR #8:**

- Backup/infra scripts (`scripts/titangold-*`, cron)
- Analytics route restore (`backend/routes/analytics.js`)
- Artemis import fallback (`57f1e8e`)
- Deploy locale mirrors (`deploy/blue|green/locales`)
- Broad `services/api.ts` edits (shared client — DataHub + global impact)
- Settings sub-panels (Automation/Cache)
- Migration `012_add_ab_testing.sql` (non-DataHub table)

**Not verified in DH-SMOKE-1 / MERGE-READINESS-1** — treat as **integration risk** if regressions appear post-merge.

---

## Migrations / env / config / runtime

| Type | Finding |
|------|---------|
| **Migrations** | **11 SQL files** (025–033 DataHub + 012 fix + query perf). Must be **applied** on each environment before relying on advanced tabs. Not run in this review. |
| **Env files** | **No `.env` committed**. `ecosystem.config.json` adds `TELEGRAM_PUBLISHER_DRY_RUN: true` (masked in ops). |
| **PM2** | Uses `env_file` → `backend/.env` (secrets not in repo). |
| **Runtime** | Dry-run gate **reduces** live publish risk; does not enable live dispatch. |

---

## Live publish / dispatch risk

| Control | Status |
|---------|--------|
| `TELEGRAM_PUBLISHER_DRY_RUN=true` in ecosystem | **Present** (`e4f2b79`) — **do not disable** without ops approval |
| Publisher/automation code paths | Support `dry_run`; D-02/D-03 verified under forced dry-run (GAP-036) |
| UI publish/dispatch buttons | Gated by role + dry-run; **not clicked** in smoke |
| **Risk if env flag set false** | **HIGH** — live Bot API send / queue dispatch possible |

**Conclusion:** Branch introduces publisher/automation **machinery** but current **runtime config blocks live send**. Risk is **misconfiguration**, not missing guards.

---

## Dependency impact

| Dependency | Impact |
|------------|--------|
| **Settings** | Minor touches (Automation/Cache copy); no DataHub blocker |
| **Auth/JWT** | `telegramReadAuth`, `authenticate`, `authorize` on DataHub routes |
| **RBAC** | Write roles `admin`/`trader`; UI `dataHubPermissions.ts` |
| **API contracts** | New `/api/v1/data-hub/*`, `/data-sources`, `/telegram/*`; GAP-037 preserves stats response shape |
| **PostgreSQL** | 11 migrations; all DataHub advanced features DB-backed |
| **Redis/cache** | Not central to DataHub smoke; no change flagged |
| **PM2** | `titan-backend` cluster; ecosystem env for dry-run |
| **Docker/Nginx** | No Dockerfile changes in delta; Nginx proxies `/api` (verified via `titan.zala.ir`) |
| **Logs** | Request logging; no new missing-column errors post GAP-037 |
| **Frontend routing** | `/?view=ai` → Manager → Data Hub (unchanged pattern) |

---

## Blockers (full branch merge as “fully verified”)

1. **Verification gap:** ~94 commits / 187 files — only **DataHub stabilization + P0/dry-run** runtime-tested; **non-DataHub commits unverified**.
2. **Migration dependency:** DB must have migrations **025–033** applied; not confirmed in this review.
3. **Scope conflation:** Cannot certify backup infra, analytics route, Artemis fix from DataHub smoke alone.

**No code defect blocker** identified for DataHub-specific paths already merged to `main`.

---

## Non-blocking risks

1. Pending **3 doc commits** — safe to merge independently.
2. Transient `404` on `agents/summary` during fast tab switch (re-test 200).
3. UI does not call `/telegram/stats/real-time` (backend fixed anyway).
4. Open v3.1 GAPs (GAP-014, GAP-017, schedulers, bundle size).
5. Shared `services/api.ts` churn — regression risk outside DataHub.
6. Local `main` branch may be **behind** `origin/main` (~96) — operators should `git pull` before local merges.

---

## Recommended merge strategy

| Strategy | When | Action |
|----------|------|--------|
| **A. Merge pending docs only** ✅ | **Now** | Merge/cherry-pick `9c59593`..`f9af102` → `main` (2 new doc files). Zero code risk. |
| **B. Full branch merge** | **Already done** | PR #8 (`ae516d0`) merged code through `39e6622`. **Do not re-merge** entire branch. |
| **C. Stabilization slice only** | N/A | `559c0e5`..`f9af102` — code already on `main`; only docs pending. |
| **D. Separate PR split** | **Retrospective** | Ideal for future: infra, analytics, DataHub features as separate PRs with per-area smoke. |

### Operator checklist before trusting production

1. Confirm migrations **025–033** applied on production DB.
2. Confirm `TELEGRAM_PUBLISHER_DRY_RUN` **true** on all `titan-backend` workers (value masked).
3. Merge doc commits `9c59593`..`f9af102` to `main`.
4. Optional: spot-check analytics + Artemis after PR #8 merge.
5. Do **not** disable dry-run for live Telegram without `DATAHUB_HIGH_RISK_EXECUTION_PLAN` approval.

---

## Relation to prior reviews

| Review | Scope | Verdict |
|--------|-------|---------|
| `559c0e5`..`f9af102` stabilization | 5 commits | Safe to merge |
| DH-SMOKE-1 / MERGE-READINESS-1 | DataHub UI | Pass |
| **This review** | Full branch 94 commits | **Not fully verified**; docs delta safe; code bulk already on `main` |

---

## Changelog

| Date | Change |
|------|--------|
| 2026-06-01 | DH-FULL-BRANCH-REVIEW-1 — full branch vs main analysis |
