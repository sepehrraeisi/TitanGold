# DH-DATA-ARCHIVING-P2 — Functional Fix, Safety Redesign

Date: 2026-06-28  
Task: `DH-DATA-ARCHIVING-P2-FUNCTIONAL-FIX-SAFETY-REDESIGN`  
Branch: `feat/gap-008-sources-backend-wiring`  
P1 reference: [`DH-DATA-ARCHIVING-P1-COMPREHENSIVE-RCA.md`](./DH-DATA-ARCHIVING-P1-COMPREHENSIVE-RCA.md)  
Design reference: [`DESIGN_SYSTEM_DATAHUB.md`](../../DESIGN_SYSTEM_DATAHUB.md)

---

## Final Verdict

### **FUNCTIONAL + REDESIGNED + SAFE PREVIEW**

| Layer | Assessment |
|-------|------------|
| Backend API + SQL | **Functional** — enriched health/partition/operation metadata; migration 043 applied |
| UI/UX | **Redesigned** — design-system layout; friendly labels; no raw DB/enum strings in UI |
| Safety | **Hardened** — RBAC on preview POST; confirm gates; batch limit; advisory lock; restore duplicate guard |
| Archive/restore apply | **Not verified on production data** — dry-run/preview only in runtime verification |
| Scheduler | **Manual only** — no dedicated archive worker; maintenance may run if enabled (GAP-033) |

---

## P1 RCA Summary (Accepted)

P1 verdict: **FUNCTIONAL BUT OUTDATED**.

Key findings carried into P2:

- Scope limited to `ai_decisions` → `ai_decisions_archive` (not Pipeline/Telegram/Automation).
- GET endpoints worked; stats accurate (12 active, 0 archived, 4 pending).
- UI exposed raw partition names (`ai_decisions_archive_2024`) and operation enums (`preview_purge`).
- `list_archive_partitions()` parsed duplicate/wrong end dates.
- Apply/restore required confirmation but preview POST was not RBAC-gated in UI.
- Purge is count-only — no delete in v3.0.
- No dedicated archive cron/worker; `maintenanceService` may call `archive_old_decisions(90)`.

---

## P2 Fixes

### Functional

| Item | Fix |
|------|-----|
| Partition labels | `Archive 2024/2025/2026` via `enrichPartitionRow()` — raw table names not returned to UI |
| Operation labels | `Archive preview`, `Archive applied`, `Restore preview`, `Restore applied`, `Purge preview` |
| Health status | Stable codes: `healthy`, `warning_stale_archive`, `warning_pending`, `no_archives`, `error` |
| SQL messages | `status_message` kept server-side; UI uses `status_code` + i18n |
| Partition dates | Migration 043 fixes `list_archive_partitions()` FROM/TO regex parsing |

### Safety hardening

| Control | Implementation |
|---------|----------------|
| Preview RBAC | `writeAuth` on all preview POST routes; UI `dataHubWriteGate` disables buttons + tooltip |
| Apply archive | Requires `confirm_archive: true` — 400 `CONFIRM_ARCHIVE_REQUIRED` without it |
| Apply restore | Requires `confirm_restore: true` — 400 `CONFIRM_RESTORE_REQUIRED` without it |
| Batch limit | `archive_old_decisions(days, max_rows)` — default 1000 via service (`ARCHIVE_MAX_ROWS`) |
| Concurrency | `pg_try_advisory_lock(90324001)` — 409 `ARCHIVE_IN_PROGRESS` |
| Restore duplicates | SQL guard raises `RESTORE_DUPLICATE_CONFLICT` before move |
| Purge | Count-only; `purge_apply_available: false` in API response |

### Scheduler clarity

UI copy (P2 i18n):

- **Manual only** — archive jobs from this panel or ops maintenance.
- **Maintenance scheduler** may run archive jobs if enabled (no dedicated worker in v3.0).
- GAP-033 remains open for dedicated archive worker.

### UI/UX redesign

`Archiving.tsx` rebuilt per design system:

- Explanation card (scope: AI decisions only)
- Lifecycle flow strip
- Metric cards: Active, Archived, Pending, Last run, Status
- Archive panel: threshold slider, dry-run, apply with confirm modal, safety note
- Restore panel: date range, validation, dry-run, confirm restore
- Purge panel: count-only badge + non-destructive copy
- Partitions table: friendly labels, year, rows, size, date range
- Recent operations: translated labels + status badges
- Empty states for no archives, no operations, no pending

---

## Tests

| Suite | File | Result |
|-------|------|--------|
| Backend unit | `backend/__tests__/unit/datahubArchivingP2.test.js` | 11 passed |
| Frontend i18n | `src/__tests__/archivingRoutingI18n.test.ts` | 14 passed |

Coverage includes: health codes, partition enrich, operation labels, confirm gates, purge count-only, RBAC route contract, no raw UI strings.

---

## Runtime Verification (Safe — No Apply)

Script: `backend/scripts/archiving-p2-runtime-verify.mjs`  
Evidence: `docs/ssot_v3/screenshots/archiving-p2-runtime.json`

| Endpoint | Status | Latency |
|----------|--------|---------|
| GET `/stats` | 200 | 233 ms |
| GET `/health` | 200 | 54 ms |
| GET `/partitions` | 200 | 27 ms |
| GET `/records` | 200 | 15 ms |
| GET `/operations` | 200 | 75 ms |

| Safety check | Result |
|--------------|--------|
| POST archive without confirm | 400 `CONFIRM_ARCHIVE_REQUIRED` |
| POST purge preview | 200 count-only, `purge_apply_available: false` |
| Destructive apply executed | **No** |
| Partition labels in API | `Archive 2024`, `Archive 2025`, `Archive 2026` |
| Health code | `warning_stale_archive` |

All GET endpoints under **500 ms** target.

---

## Browser Evidence

Script: `backend/scripts/archiving-p2-browser-verify.mjs`  
Evidence: `docs/ssot_v3/screenshots/archiving-p2-browser-evidence.json`

Screenshots:

- `archiving-p2-overview.png`
- `archiving-p2-partitions.png`
- `archiving-p2-operations.png`

| Check | Result |
|-------|--------|
| Raw partition names in body | **None** |
| Raw operation enums in body | **None** |
| `preview_purge` visible | **No** |
| `Not Found` on archiving panel | **No** |
| Archiving network 200 | **Yes** (`/stats`, `/records`) |
| Console (archiving-specific) | Clean — unrelated MEXC ticker 404s from Header |

---

## Performance

| Endpoint | P2 measured |
|----------|-------------|
| `/stats` | 233–414 ms |
| `/health` | 54–88 ms |
| `/partitions` | 27–181 ms |
| `/records` | 15–75 ms |
| `/operations` | 44–75 ms |

Target: GET &lt; 500 ms — **met**.

---

## DevOps

| Item | Status |
|------|--------|
| Migration 043 applied | Yes — recorded in `pgmigrations` |
| `pm2 reload titan-backend` | Yes |
| `pm2 reload titan-frontend` | Yes |
| Archive worker started | **No** — not in pm2 list |
| Destructive cron scheduled | **No** — manual/maintenance only |
| Backend logs (archiving) | Clean on GET/preview paths |

---

## Files Changed (P2 scope)

| Area | Files |
|------|-------|
| Backend labels | `backend/services/datahubArchivingLabels.js` |
| Backend service | `backend/services/datahubArchivingService.js` |
| Migration | `backend/database/migrations/043_datahub_archiving_p2_safety.sql` |
| Frontend UI | `components/.../Archiving.tsx`, `archiving/archivingLabels.ts` |
| API types | `services/dataHubArchivingApi.ts` |
| i18n | `deploy/blue|green/locales/en.json`, `fa.json` |
| Tests | `backend/__tests__/unit/datahubArchivingP2.test.js`, `src/__tests__/archivingRoutingI18n.test.ts` |
| Verify scripts | `backend/scripts/archiving-p2-*.mjs` |

**Out of scope (unchanged):** `collected_data`, Pipeline, Telegram, Automation.

---

## Closing

Data Archiving P2 delivers a **design-system-compliant**, **RBAC-aware**, **safety-hardened** workflow with **verified dry-run preview** behavior. Archive/restore **apply** was not executed on production data in this phase; verdict is **FUNCTIONAL + REDESIGNED + SAFE PREVIEW**, not REAL WORKING for apply paths.
