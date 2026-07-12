# DataHub Merge Release Notes

## Summary

This merge contains the complete DataHub operational rebuild and production closeout.

Pull Request [#12](https://github.com/sepehrraeisi/TitanGold/pull/12) merged `feat/gap-008-sources-backend-wiring` into `main`. The original PR description was empty; this document recovers the intended release notes inside the repository.

## Scope

- DataHub frontend redesign and functional hardening
- Backend API and service fixes
- Database migrations through 048
- DevOps and production deployment safeguards
- Security and RBAC improvements
- Performance optimization and Redis caching
- Human QA fixes and final closure documentation

## Major Areas

- Data Sources
- Categories
- Data Pipeline
- Health Monitoring
- Access Logs
- Advanced Features
- Telegram Collector
- Telegram Publisher
- Automation Routing
- Data Archiving
- Notifications-related DataHub integrations

## Production Status

- DataHub: **HUMAN QA ACCEPTED / REAL WORKING / CLOSED**
- Telegram Publisher runtime mode: **LIVE**
- Emergency rollback:
  - switch to Dry-run in Telegram Publisher UI
  - or set `TELEGRAM_PUBLISHER_FORCE_DRY_RUN=true` in PM2 ecosystem and reload backend

## Validation

- Relevant backend tests passed
- Relevant frontend tests passed
- `npm run build` passed
- Production frontend deployment verification passed (`./scripts/deploy-production-frontend.sh`)
- Secret scan passed
- Working tree clean before merge

## Migrations

Includes DataHub-related migrations through **048** (`048_telegram_publisher_runtime_settings.sql`), plus earlier DataHub migrations (021–047 as applicable). See `docs/ssot_v3/DATAHUB-FINAL-CLOSURE-SUMMARY.md` for the applied inventory.

## Key Deliverables on Main

| Artifact | Path |
|----------|------|
| Final closure summary | `docs/ssot_v3/DATAHUB-FINAL-CLOSURE-SUMMARY.md` |
| Publisher P3 runtime mode | `backend/services/telegramPublisherRuntimeModeService.js` |
| Migration 048 | `backend/database/migrations/048_telegram_publisher_runtime_settings.sql` |
| Production frontend deploy safeguard | `scripts/deploy-production-frontend.sh` |
| Scheduler runtime detection | `backend/services/pipelineSchedulerRuntime.js` |

## Excluded Work

WIP work was preserved on:

`backup/pre-main-consolidation-2026-07-11`

That branch was **not** part of PR #12 (DataHub merge). It was merged separately via PR #13 after the DataHub closeout.

## Known Non-blocking Gaps

Reference:

`docs/ssot_v3/DATAHUB-FINAL-CLOSURE-SUMMARY.md`

## Merge Metadata

| Item | Value |
|------|-------|
| **Feature branch** | `feat/gap-008-sources-backend-wiring` |
| **Feature HEAD** | `19d63d2` |
| **Publisher P3** | `d46c58c` |
| **DataHub merge commit (PR #12)** | `9247195` |
| **Merge date** | 2026-07-11 (UTC+3:30: 15:03:57) |
| **GitHub PR** | [#12 — Feat/gap 008 sources backend wiring](https://github.com/sepehrraeisi/TitanGold/pull/12) |
| **Main HEAD at DataHub merge** | `9247195` |
