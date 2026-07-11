# DataHub — Final Closure Summary

**Date:** 2026-07-10  
**Branch:** `feat/gap-008-sources-backend-wiring`  
**HEAD (closure baseline):** `d46c58c`  
**Production URL:** `https://titan.zala.ir`  
**Final status:** **DATAHUB — HUMAN QA ACCEPTED / REAL WORKING / CLOSED**

This document is a read-only closure index. Detailed evidence lives in per-task SSOT files under `docs/ssot_v3/DH-*.md`.

---

## 1. Completed Tabs and Phases

### Main DataHub navigation (`DataHubTab.tsx`)

| Tab | Phases completed | Final verdict | Primary SSOT |
|-----|------------------|---------------|--------------|
| **Data Sources** | GAP-008 wiring, P2 duplicate URL guard, P3 duplicate management UI | REAL WORKING | `DH-DATASOURCES-P2-DUPLICATE-URL-GUARD.md`, `DH-DATASOURCES-P3-DUPLICATE-MANAGEMENT.md` |
| **Categories** | Taxonomy normalization (uncategorized seed), Design pass | REAL WORKING | Pipeline / sources SSOT cross-refs |
| **Data Pipeline** | Transfer bridge, normalization worker, capacity dashboard, Telegram Transfer Health, closeout QA | **REAL WORKING / CLOSED** | `DH-DATA-PIPELINE-NORMALIZATION-SUMMARY-AND-CAPACITY-FIX.md` |
| **Health Monitoring** | P1 pipeline sync, P2 cold-load decouple + index | **REAL WORKING / CLOSED** | `DH-HEALTH-MONITORING-P2-COLD-LOAD-PERFORMANCE-FIX.md` |
| **Access Logs** | P1 API + UI fix | REAL WORKING | `DH-ACCESSLOGS-P1-FIX.md` |
| **Advanced Features** | See sub-tabs below | REAL WORKING | Multiple `DH-*` docs |
| **Telegram Collector** | P2–P7.4 route repair, security, writes, performance, design, agent feed, metric polish | **PERMANENTLY CLOSED / REAL WORKING** | `DH-TELEGRAM-COLLECTOR-P7-AGENT-FEED-PERFORMANCE-FINAL.md` |

### Advanced Features sub-tabs (`AdvancedFeatures.tsx`)

| Sub-tab | Phases completed | Final verdict | Primary SSOT |
|---------|------------------|---------------|--------------|
| **Web Crawlers** | GAP-026 backend-first, P2 architecture, P4 source sync | REAL WORKING | `DH-WEBCRAWLER-P2-ARCHITECTURE-FIX.md`, `DH-WEBCRAWLER-P4-SOURCE-SYNC.md` |
| **Auto Discovery** | P1 RCA, P2 dedupe safety + deploy verify | **PASS** | `DH-AUTODISCOVERY-P2-DEPLOY-VERIFY.md` |
| **Smart Prioritization** | GAP-030 backend, P2 apply fix + post-verify | **ACCEPTED WITH TUNING BACKLOG** | `DH-SMARTPRIORITY-P2-APPLY-FIX.md`, `DH-SMARTPRIORITY-P2-POST-VERIFY.md` |
| **Access Control** | P1 RCA, P2 enforcement gateway, P2 publisher API fix, P3 final verify | **REAL ENFORCED** | `DH-ACCESSCONTROL-P3-FINAL-VERIFY.md` |
| **Blacklist / Whitelist** | GAP-024 backend, P2 gateway enforcement | **REAL ENFORCED** | `DH-BLACKLISTWHITELIST-P2-ENFORCEMENT.md` |
| **Telegram Publisher** | P1 RCA, P2 workflow + live test, P3 runtime delivery mode | **REAL WORKING / HUMAN QA ACCEPTED / CLOSED** | `DH-TELEGRAM-PUBLISHER-P3-RUNTIME-LIVE-MODE-CONTROL.md` |
| **Automation Routing** | P1 RCA, P2 safety, P3 E2E redesign, P4 production repair + polish | **Production Operational (dry-run verified)** | `DH-AUTOMATION-ROUTING-P4-PRODUCTION-REPAIR-AND-OPERATIONAL-VERIFY.md` |
| **Data Archiving** | GAP-032 backend, P2 safety redesign, P3 fixture archive/restore verify | **REAL WORKING** (fixture apply paths); manual ops only | `DH-DATA-ARCHIVING-P3-SAFE-FIXTURE-ARCHIVE-RESTORE-VERIFY.md` |

### Cross-cutting

| Area | Phases | Final verdict | Primary SSOT |
|------|--------|---------------|--------------|
| **Performance (DataHub)** | P2 baseline/deploy verify, P3 bottleneck closeout | **PASS** | `DH-PERFORMANCE-P3-FINAL-VERIFY.md` |
| **Telegram count reconciliation** | Metric definition audit | **CLOSED (expected mismatch documented)** | `DH-DATA-PIPELINE-TELEGRAM-COUNT-RECONCILIATION.md` |

### Adjacent module (Settings, not a DataHub tab)

| Module | Phases | Verdict | SSOT |
|--------|--------|---------|------|
| **Notifications** | P2 unified center, P3 redesign/hard verify, P4 browser persistence | **PASS** (Notifications scope only) | `DH-NOTIFICATIONS-P3-FINAL-REDESIGN-AND-HARD-VERIFY.md` |

---

## 2. Final Commit Hashes

Authoritative feature commits recorded at closeout. Docs-only follow-ups may exist; implementation truth is the commits below.

| Area | Phase / milestone | Commit | Message (short) |
|------|-------------------|--------|-----------------|
| **DataHub baseline wiring** | GAP-008 | `b6123b4` | Complete DataHub sources backend wiring |
| **Access Logs** | P1 | `4f7f7da` | Access Logs API, UI, fetch logging |
| **Web Crawlers** | GAP-026 | `794eb10` | Crawlers backend-first (website + RSS) |
| **Auto Discovery** | P2 verify | `bb5ef19` | Auto Discovery dedupe safety + UX |
| **Smart Prioritization** | P2 apply | `a9fbe7e` | Smart Prioritization apply + Telegram scoring |
| **Access Control** | P3 final | `6f145f4` | Centralize access control enforcement gateway |
| **Blacklist / Whitelist** | P2 | `0563e76` | Enforce policies across ingestion and publishing |
| **Telegram Publisher** | P2 | `12177c3` | Stabilize publisher workflow and source mapping |
| **Telegram Publisher** | P3 runtime mode | `d46c58c` | Persistent runtime delivery mode (**HEAD**) |
| **Automation Routing** | P2 safety | `978ac1f` | Harden automation routing safety |
| **Automation Routing** | P3 E2E | `8a9fb3d` | Validate and redesign automation end-to-end |
| **Automation Routing** | P4 production | `f558e26` | Repair production routing + optimize refresh |
| **Automation Routing** | P4 polish | `84c8f9e` | Polish automation status labels |
| **Data Archiving** | P2 | `a7f1b75` | Redesign and harden archiving workflow |
| **Data Archiving** | P2 QA fix | `8524386` | Address archiving P2 human QA defects |
| **Data Archiving** | P3 fixture | `ce1bc6e` | Verify archive/restore fixture flow |
| **Data Pipeline** | Foundation | `e16b041` | Telegram → collected_data transfer bridge |
| **Data Pipeline** | Normalization | `b3d20ea` | Production normalization worker |
| **Data Pipeline** | Transfer health UI | `7535ed9` | Telegram Transfer Health dashboard |
| **Data Pipeline** | Closeout polish | `6fa9158` | Final pipeline operations dashboard polish |
| **Data Pipeline** | Closeout QA | `8a2597a` | Pipeline closeout QA fixes + evidence |
| **Health Monitoring** | P2 fix | `558341c` | Decouple slow diagnostics from core status |
| **Health Monitoring** | P2 docs | `802332b` | Health monitoring P2 closeout evidence |
| **Telegram Collector** | P3 | `e77a6f9` | Collector verify, redesign, security |
| **Telegram Collector** | P7 agent feed | `6e542ce` | Optimize agent feed performance |
| **Telegram Collector** | P7.2 auth | `763a435` | Align collector JWT with backend issuer |
| **Telegram Collector** | P7 cleanup | `96accaa` | Cleanup after P7 completion |
| **Notifications (Settings)** | P2 | `0c9228b` | Unify notifications center |
| **Notifications** | P4 persistence | `45c35da` | Persist browser notification channel state |
| **Production frontend safeguard** | P3 closeout | `d46c58c` | Includes `scripts/deploy-production-frontend.sh` |

**Production frontend bundles (verified 2026-07-10):**

- Index: `assets/index-BBlvCWrL.js`
- DataHub lazy chunk: `assets/DataHubTab-MbvnB3Oa.js`

---

## 3. Applied Migrations

Verified against production `pgmigrations` (2026-07-10). DataHub-relevant migrations:

| # | Migration name | Purpose |
|---|----------------|---------|
| 020 | `020_alter_data_sources` | Data sources schema extensions |
| 021 | `021_create_source_access_control` | Access control policies |
| 023 | `023_add_unique_constraint_data_sources` | Duplicate URL guard (DB) |
| 024 | `024_scheduling_and_incremental` | Scheduling / incremental fetch |
| 025 | `025_create_telegram_publishers` | Publisher config + delivery history |
| 026 | `026_create_datahub_automation_topics` | Automation topics |
| 027 | `027_create_datahub_automation_queue` | Automation queue + executions |
| 028 | `028_create_datahub_filter_rules` | Blacklist / whitelist rules |
| 029 | `029_create_datahub_crawlers` | Web / RSS crawlers |
| 030 | `030_create_datahub_discovery` | Auto discovery suggestions |
| 031 | `031_create_datahub_prioritization` | Smart prioritization |
| 032 | `032_add_prioritization_audit_columns` | Prioritization audit |
| 033 | `033_create_datahub_archiving_operations` | Archiving operations log |
| 034 | `034_seed_uncategorized_category` | Default category seed |
| 035 | `035_telegram_transfer_indexes` | Transfer pipeline indexes |
| 036 | `036_collected_data_pending_index` | Pending collected_data index |
| 037 | `037_telegram_channel_unprocessed_index` | Collector unprocessed index |
| 038 | `038_discovery_ignored_status` | Discovery ignored status |
| 039 | `039_datahub_priority_tier` | Priority tier column |
| 040 | `040_telegram_processed_at_index` | Processed message index |
| 041 | `041_datahub_publisher_source_mappings` | Publisher source mappings |
| 042 | `042_collected_data_automation_refresh_index` | Automation refresh index |
| 042 | `042_datahub_automation_safety` | Automation safety columns |
| 043 | `043_datahub_archiving_p2_safety` | Archiving P2 safety functions |
| 043 | `043_notifications_unified_center` | Notifications center (Settings) |
| 044 | `044_telegram_analytics_indexes` | Collector analytics indexes |
| 045 | `045_telegram_agent_feed_indexes` | Agent feed performance |
| 046 | `046_collected_data_norm_summary_24h_index` | Normalization summary index |
| 047 | `047_telegram_messages_created_at_index` | Health monitoring intake index |
| 048 | `048_telegram_publisher_runtime_settings` | Publisher runtime mode + audit |

Also applied: `add_notification_tables`, `20260214_add_telegram_default_categories`.

**Note:** Two migrations share prefix `042` and `043` (different files, both recorded). Do not re-run without checking `pgmigrations`.

---

## 4. Current Production Runtime Modes

Snapshot taken 2026-07-10 against live backend (`http://127.0.0.1:5002`).

### Telegram Publisher delivery mode (DB-backed)

| Setting | Value |
|---------|-------|
| **Configured mode** | `live` |
| **Effective mode** | `live` |
| **Server safety override** | **Inactive** (`TELEGRAM_PUBLISHER_FORCE_DRY_RUN=false` in `backend/ecosystem.config.json`) |
| **Last changed by** | `admin@titangold.com` |
| **Reason** | `ریدیزاین` (Human QA acceptance) |
| **Persistence** | Verified after `pm2 restart titan-backend` — mode unchanged |

**Operator decision:** Production intentionally left in **`live`** after Human QA acceptance. No additional live messages sent during final closeout verification.

**Emergency rollback (env):** Set `TELEGRAM_PUBLISHER_FORCE_DRY_RUN=true` in PM2 ecosystem and `pm2 reload titan-backend --update-env` to force dry-run regardless of DB mode.

### Automation Routing

| Setting | Value |
|---------|-------|
| **Production topics** | Route through active publisher + enabled mappings (P4 verified) |
| **Default dispatch** | Respects publisher **effective mode**; automation `dry_run` flag still honored |
| **Live Telegram from automation** | Requires explicit `confirm_live` (unchanged safety semantics) |

### Data Pipeline / normalization

| Setting | Value |
|---------|-------|
| **Normalization worker** | Production worker deployed (`b3d20ea`); scheduler status shown honestly in UI |
| **Telegram transfer** | Active bridge; historical backlog documented separately (non-blocking) |

### Frontend serving path

| Component | Runtime |
|-----------|---------|
| **Production UI (operators)** | nginx → `/home/ubuntu/webapp/TitanGold/dist` |
| **PM2 `titan-frontend`** | Vite dev server on `:3000` — **not** production path |

Always deploy frontend changes via `./scripts/deploy-production-frontend.sh` before marking UI tasks closed.

---

## 5. Remaining Known Non-Blocking Gaps

These items are documented and **do not block** the DataHub closure verdict.

| Gap | Severity | Notes | SSOT ref |
|-----|----------|-------|----------|
| Telegram messages historical backlog (~720k unprocessed) | Ops / throughput | Transfer draining; not a UI defect | `DH-DATA-PIPELINE-TELEGRAM-COUNT-RECONCILIATION.md` |
| Archiving: no cron / dedicated worker (GAP-033) | Product | Manual UI or ops scripts only | `DH-DATA-ARCHIVING-P1-COMPREHENSIVE-RCA.md` |
| Archiving: broad production archive apply not executed | Safety | Fixture paths verified; operator bulk archive is deliberate | `DH-DATA-ARCHIVING-P3-SAFE-FIXTURE-ARCHIVE-RESTORE-VERIFY.md` |
| Smart Prioritization top-tier clustering / placeholders | Tuning | Accepted with backlog | `DH-SMARTPRIORITY-P2-POST-VERIFY.md` |
| Publisher: no separate live confirmation dialog | UX | `confirm_publish` always true; live gated by runtime mode | `DH-TELEGRAM-PUBLISHER-P1-SAFE-RCA-AND-TEST-DELIVERY.md` |
| Blacklist whitelist strict allow-list semantics | Future P3 | P2 gateway enforced; semantics not strict allow-list | `DH-BLACKLISTWHITELIST-P2-ENFORCEMENT.md` |
| Pipeline P2 follow-ups (legacy fast-path cleanup, capacity presets) | Performance debt | Documented at pipeline closeout | `DH-DATA-PIPELINE-NORMALIZATION-SUMMARY-AND-CAPACITY-FIX.md` |
| Scheduler HTTP API rejects telegram/normalization restart sections | Ops | `updateConfig()` internal support exists; API rejects | `DH-DATA-PIPELINE-NORMALIZATION-SUMMARY-AND-CAPACITY-RCA.md` |
| Redis persistence / some slow aggregate endpoints | Infra | P3 PASS for target endpoints; Redis auth noted in P2 | `DH-PERFORMANCE-P2-DEPLOY-VERIFY.md` |
| Unrelated MEXC / Artemis console 404 on bootstrap | Out of scope | Does not affect DataHub tabs | `DH-NOTIFICATIONS-P3-FINAL-REDESIGN-AND-HARD-VERIFY.md` |
| Vite build warnings (TopicRouting missing exports, chunk size) | Build hygiene | Non-blocking for DataHub runtime | Build logs |

---

## 6. Deploy Commands

### Canonical production frontend deploy

```bash
cd /home/ubuntu/webapp/TitanGold
./scripts/deploy-production-frontend.sh
```

Script behavior:

1. `npm run build`
2. Verify `dist/index.html` mtime changed
3. Verify DataHub bundle contains expected smoke marker (`publisher_delivery_mode_title`)
4. Reload nginx (disable with `RELOAD_NGINX=false`)
5. Fetch production index hash — **fail** if stale bundle served
6. Authenticated API smoke: `GET /runtime-mode` (when `backend/.env` + JWT available)

**Policy:** `dist/` is **not** tracked in git.

### Backend deploy

```bash
cd /home/ubuntu/webapp/TitanGold/backend
pm2 reload ecosystem.config.json --update-env
# or
pm2 restart titan-backend
```

Verify health:

```bash
curl -sk https://titan.zala.ir/api/v1/health
```

### Migrations (single file)

```bash
cd /home/ubuntu/webapp/TitanGold/backend
node scripts/run_single_migration.js database/migrations/<file>.sql
```

Check applied:

```sql
SELECT name FROM pgmigrations ORDER BY id;
```

### Release verification rule (mandatory for future frontend work)

No frontend task may be marked **REAL WORKING / CLOSED** until:

1. Production `dist/` rebuilt via `./scripts/deploy-production-frontend.sh`
2. Production URL checked (not only `:3000` dev)
3. New feature visible in screenshot
4. Deployed bundle identifier recorded in SSOT

---

## 7. Rollback Notes

### Telegram Publisher — return to safe dry-run

**Option A — UI (preferred for day-to-day):**  
DataHub → Advanced → Telegram Publisher → **Enable Dry-run** (admin, reason required).

**Option B — DB/API:**

```bash
# PUT /api/v1/data-hub/telegram-publishers/runtime-mode
# body: { "mode": "dry_run", "confirm_runtime_mode_change": true, "reason": "..." }
```

**Option C — Emergency env override:**

```json
"TELEGRAM_PUBLISHER_FORCE_DRY_RUN": "true"
```

Then: `pm2 reload titan-backend --update-env`

### Frontend rollback

```bash
git checkout <previous-commit> -- components/ services/ deploy/
npm run build
./scripts/deploy-production-frontend.sh
```

Or revert commit:

```bash
git revert <commit-hash>
./scripts/deploy-production-frontend.sh
```

### Backend rollback

```bash
git revert <commit-hash>
pm2 reload titan-backend --update-env
```

**Migrations:** No automated down-migration. Roll back code first; DB schema changes are forward-compatible unless explicitly documented otherwise. Do not drop tables in production without ops approval.

### Automation Routing rollback

Restore previous topic/publisher mapping configuration via UI or DB; verify with:

```bash
node backend/scripts/automation-p4-browser-verify.mjs   # if present
```

Dry-run dispatch before re-enabling live paths.

### Archiving rollback

P3 fixture operations are metadata-guarded. Production archive/restore apply requires explicit operator confirmation in UI. No destructive cron was added.

---

## 8. Human QA Evidence Index

| Area | Screenshot / evidence path |
|------|----------------------------|
| Telegram Publisher P3 | `docs/ssot_v3/screenshots/telegram-publisher-p3-human-qa-after-rebuild.png` |
| Telegram Publisher P3 automated | `docs/ssot_v3/screenshots/telegram-publisher-p3-runtime-evidence.json` |
| Data Pipeline closeout | `docs/ssot_v3/screenshots/data-pipeline-closeout-evidence.json` (if present) |
| Health Monitoring P2 | `docs/ssot_v3/screenshots/health-monitoring-p2-performance-*.png` |
| Archiving P2/P3 | `docs/ssot_v3/screenshots/archiving-p2-*.png`, `archiving-p3-fixture-evidence.json` |
| Automation P4 | `docs/ssot_v3/screenshots/automation-p4-browser-evidence.json` |
| Notifications P3 | `docs/ssot_v3/screenshots/notifications-p3-*.png` |

---

## 9. Final Verdict

**DATAHUB — HUMAN QA ACCEPTED / REAL WORKING / CLOSED**

All primary DataHub tabs and Advanced Features sub-tabs have passed their scoped Human QA or SSOT acceptance criteria. Production frontend is served from rebuilt `dist/`; backend runtime modes are documented; migrations through **048** are applied; known gaps are non-blocking and tracked in SSOT.

**Closure baseline commit:** `d46c58c`  
**Branch:** `feat/gap-008-sources-backend-wiring`  
**Next work:** Move to the next product area outside DataHub scope.
