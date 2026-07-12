# Post-DataHub Repository Cleanup

**Date:** 2026-07-12  
**Context:** Accidental merge of `backup/pre-main-consolidation-2026-07-11` via PR #13 (`d443af5`) on top of the intended DataHub merge PR #12 (`9247195`).

## What Was Accidental (PR #13 / backup branch)

| Artifact | Type | Notes |
|----------|------|-------|
| `backend/database/migrations/039_datahub_priority_tier.sql` | Real duplicate SQL | Identical 14-line block appended twice (28 lines). Idempotent at runtime but bad hygiene. |
| `backend/config/index.js` export | Accidental export removal | `checkRequiredSecrets` still defined and used internally; bottom export lost `checkRequiredSecrets`. |
| `services/accessControlApi.ts` line 137 | Stray import | Duplicate `import { SourceAccessControl }` after exports (merge artifact). |
| `backend/utils/prioritizationTelegramMetrics.js` | Duplicate comment block | Trailing JSDoc duplicated at EOF. |
| `scripts/backup-db.sh`, `scripts/titangold-backup-healthcheck.sh`, `scripts/phase2-monitoring/*` | Infra WIP | Large monitoring/backup enhancements from backup branch `d932a31`; outside DataHub closeout scope. |
| Advanced Features components (`AutoDiscoveryConfig`, `SmartPrioritization`, `BlacklistWhitelist`) | Formatting-only drift | Indentation changes only; no logic delta vs PR #12. |

## What Was Corrected

1. **Migration 039** — restored single 14-line definition (matches `19d63d2` / PR #12).
2. **`checkRequiredSecrets` export** — restored `export { maskSecrets, checkRequiredSecrets }` in `backend/config/index.js`.
3. **`accessControlApi.ts`** — removed stray trailing import.
4. **`prioritizationTelegramMetrics.js`** — removed duplicate EOF comment.
5. **Infrastructure scripts** — reverted to PR #12 (`9247195`) versions.
6. **Advanced Features formatting** — reverted to PR #12 versions.

## What Intentionally Remains (not accidental)

| Item | Verdict | Rationale |
|------|---------|-----------|
| Access Control Registry UI (`AccessControlModal.tsx`, `useAccessControl.ts`, registry API helpers) | Partially QA'd, functional | Backend `GET /agents/registry` existed in PR #12; backup merge added production-wired frontend. Not dead/hidden code. |
| `App.tsx` `titan_auth_expired` listener | Intentional wiring | Pairs with `services/api.ts` auth-expiry dispatch; documented in notifications redesign SSOT. |
| `package.json` `@testing-library/dom` | Test harness fix | Required for vitest/jest-dom peer dependency; documented in publisher P2 audit. |
| `docs/ssot_v3/DATAHUB-MERGE-RELEASE-NOTES.md` | Intentional | Added on `743caae` after PR #12 merge. |
| All DataHub PR #12 scope (migrations through 048, services, UI) | Intentional | Core deliverable; unaffected by cleanup. |

## Runtime API RCA — `GET /api/v1/data-hub/telegram-publishers/runtime-mode`

**Symptom during audit:** HTTP 500.

**Root cause:** PostgreSQL cluster **down** on port 5433 (`pg_lsclusters`: `14/main` status `down`).  
**Error:** `connect ECONNREFUSED 127.0.0.1:5433` during `ensureSettingsRow()` INSERT into `telegram_publisher_runtime_settings`.

**Not caused by:**

- Missing migration 048
- Publisher runtime-mode service regression
- Backup-merge code changes

**Remediation (ops):** `sudo pg_ctlcluster 14 main start` → verify `pg_isready -p 5433` → optional `pm2 restart titan-backend`.

**Post-remediation:** endpoint returns **HTTP 200** with valid JSON payload.

## Validation (2026-07-12)

| Check | Result |
|-------|--------|
| `GET .../runtime-mode` (JWT admin) | **200** (after PostgreSQL start) |
| `npm run build` | **PASS** |
| `src/__tests__/archivingHumanQa.test.ts` | **9/9 PASS** |
| `backend/__tests__/unit/pipelineSchedulerRuntime.test.js` | **6/6 PASS** |
| `backend npm run test:unit` | **43/45 suites pass** — pre-existing: `dataPipeline.test.js` (jest ESM syntax), `timeout.test.js` (timing flake) |
| `backend` integration `sourceAccessControlEnforcement` | **2 failures** (409 vs expected 403/200) — pre-existing DB/state conflict; not introduced by cleanup |
| Full root `npm run test:run` | Includes `deploy/green` copies — **not used as gate** |

## Merge Provenance

```
main HEAD (pre-cleanup): 743caae
DataHub merge (PR #12):  9247195
Backup merge (PR #13):   d443af5  ← accidental
Feature branch HEAD:     19d63d2  (fully merged via PR #12)
Backup branch HEAD:      77540cc  (merged via PR #13)
```

## Verdict

**Repository hygiene cleanup: COMPLETE** for merge artifacts listed above.

**REPOSITORY CLEAN:** **YES** for merge-artifact criteria (duplicate SQL, export restore, dead import, infra WIP reverted, formatting drift reverted) with `runtime-mode` returning 200 after PostgreSQL availability.

**Residual (outside this cleanup scope):**

- Pre-existing backend unit test failures (`dataPipeline`, `timeout` flake)
- Pre-existing ACL integration test 409 conflicts
- PostgreSQL must remain running on 5433 for runtime-mode and DB-backed APIs
