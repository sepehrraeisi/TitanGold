# DH-DATA-ARCHIVING-P2 — Functional Fix, Safety Redesign

Date: 2026-06-28 (Human QA round 2 rejection + deploy fix: 2026-06-28)  
Task: `DH-DATA-ARCHIVING-P2-FUNCTIONAL-FIX-SAFETY-REDESIGN`  
Branch: `feat/gap-008-sources-backend-wiring`  
P1 reference: [`DH-DATA-ARCHIVING-P1-COMPREHENSIVE-RCA.md`](./DH-DATA-ARCHIVING-P1-COMPREHENSIVE-RCA.md)  
Design reference: [`DESIGN_SYSTEM_DATAHUB.md`](../../DESIGN_SYSTEM_DATAHUB.md)

---

## Final Verdict

### **PARTIAL — P2 rejected by Human QA (round 2); stale deploy fixed; automated production verify PASS; awaiting Human QA re-run**

Do **not** claim **FUNCTIONAL + REDESIGNED + SAFE PREVIEW** until a human re-runs QA on `https://titan.zala.ir` after hard refresh.

| Layer | Assessment |
|-------|------------|
| Backend API + SQL | **Functional** — enriched health/partition/operation metadata; migration 043 applied |
| UI source code | **Redesigned** — P2 component + label mapping in repo |
| Production UI (nginx/dist) | **Fixed 2026-06-28** — was serving stale pre-P2 bundle; rebuild deployed |
| Safety | **Hardened** — RBAC on preview POST; confirm gates; batch limit; advisory lock; restore duplicate guard |
| Archive/restore apply | **Not verified on production data** — dry-run/preview only |
| Scheduler | **Manual only** — no dedicated archive worker |

---

## Human QA Round 2 — Rejection

**Date:** 2026-06-28  
**Result:** **REJECTED / PARTIAL**

### Symptoms reported

| Symptom | Observed by QA |
|---------|----------------|
| Raw partition names | `ai_decisions_archive_2024`, `_2025`, `_2026` |
| Raw operation enums | `preview_purge`, `preview_archive`, `preview_restore` |
| Restore panel | Disabled with no empty-state explanation |
| Partitions | Raw DB table names instead of friendly labels |
| Operations | Raw enum values instead of translated labels |
| Status card | Only em dash (`—`) |

### Root cause (confirmed)

**Stale production frontend bundle — not wrong component, not missing i18n keys, not backend mapping failure.**

| Factor | Finding |
|--------|---------|
| nginx root | `/home/ubuntu/webapp/TitanGold/dist` (serves static production build) |
| pm2 `titan-frontend` | `npm run dev` on `:3000` — had P2 source code but **not** what Human QA saw on HTTPS |
| Pre-fix dist chunk | `DataHubTab-CUO28e3n.js` (Jun 27 ~17:03) — contained `archiving_desc_v3`, **no** P2 keys |
| Post-fix dist chunk | `DataHubTab-BYziE4XX.js` (Jun 28 10:43:40 UTC) — contains `archiving_explanation_p2`, `archiving_restore_empty` |
| Duplicate components | **None** — single `Archiving.tsx` wired via `AdvancedFeatures.tsx` |
| Backend API | Always returned friendly `label` / `operation_label` / `status_code` — frontend stale bundle ignored mapping |

Evidence: [`archiving-p2-deploy-evidence.json`](./screenshots/archiving-p2-deploy-evidence.json)

### Fix applied

1. `npm run build` — rebuilt `dist/` with P2 bundle hashes
2. nginx serves updated files immediately (same root path; no pm2 frontend restart required for HTTPS users)
3. Frontend hardening: `mapHealthCodeFromApi()` for status card when legacy `status` string present; restore empty copy expanded
4. Label mapping enforced client-side regardless of backend (`normalizePartition`, `operationLabel`, `isRawArchivingLabel`)

---

## Human QA Round 1 — Fixes (code, pre-deploy)

| Defect | Root cause | Fix |
|--------|------------|-----|
| Restore panel silently disabled | `archived_records === 0` + missing dates combined with no explanation | `getRestoreBlockReason()` — explicit messages; empty state hides controls when no archived rows |
| Partitions table empty | Client relied on stats-only; legacy rows without `label`/`year` rendered blank | `normalizePartition()` fallback; `useArchivePartitionsQuery` when stats partitions empty |
| Raw operation enums in UI | `operationLabel()` returned backend `operation_label` or fell back to `operation_type` | Always resolve via i18n from `operation_type` |
| Restore UX generic inputs | `datetime-local` without design-system styling | `type="date"` + `INPUT_CLASS`; emerald panel styling |
| Confusing disabled controls | Tooltip-only RBAC gate | Inline `DataHubAlert` + visible reason text |

### Restore block reasons (UI)

| Condition | User-visible message |
|-----------|---------------------|
| `archived_records === 0` | "No archived decisions are available yet. Archive decisions first before restoring." — empty state, no date inputs, buttons hidden |
| Read-only user | "Restore requires administrator or trader permission." |
| Dates missing/invalid | "Select an archive date range." |

### Operation labels (i18n — never raw enum)

| operation_type | UI label |
|----------------|----------|
| `preview_archive` | Archive Preview |
| `archive` / `archive_old_decisions` | Archive Completed |
| `preview_restore` | Restore Preview |
| `restore` / `restore_from_archive` | Restore Completed |
| `preview_purge` | Purge Preview |

Dry-run badge: `Dry run` via `archiving_dry_run_badge`. Status badge: `Success` / `Failed`.

---

## P1 RCA Summary (Accepted)

P1 verdict: **FUNCTIONAL BUT OUTDATED**.

Key findings carried into P2:

- Scope limited to `ai_decisions` → `ai_decisions_archive` (not Pipeline/Telegram/Automation).
- GET endpoints worked; stats accurate (12 active, 0 archived, 4 pending).
- UI exposed raw partition names and operation enums when stale bundle rendered.
- `list_archive_partitions()` parsed duplicate/wrong end dates — fixed in migration 043.
- Purge is count-only — no delete in v3.0.

---

## P2 Fixes (implementation)

### Functional

| Item | Fix |
|------|-----|
| Partition labels | `Archive 2024/2025/2026` via backend enrich + frontend `normalizePartition()` fallback |
| Operation labels | i18n from `operation_type` — never render raw enum |
| Health status | Stable codes + i18n; frontend `mapHealthCodeFromApi()` fallback |
| Partition dates | Migration 043 fixes `list_archive_partitions()` parsing |

### Safety hardening

| Control | Implementation |
|---------|----------------|
| Preview RBAC | `writeAuth` on preview POST; UI `dataHubWriteGate` |
| Apply archive | `confirm_archive: true` required |
| Apply restore | `confirm_restore: true` required |
| Batch limit | 1000 rows default |
| Concurrency | Advisory lock 90324001 |
| Restore duplicates | SQL guard `RESTORE_DUPLICATE_CONFLICT` |
| Purge | Count-only; `purge_apply_available: false` |

---

## Tests

| Suite | File | Result |
|-------|------|--------|
| Backend unit | `backend/__tests__/unit/datahubArchivingP2.test.js` | 11 passed |
| Frontend i18n | `src/__tests__/archivingRoutingI18n.test.ts` | 14 passed |
| Human QA regressions | `src/__tests__/archivingHumanQa.test.ts` | 9 passed |

---

## API Verification (post-fix, via nginx + backend direct)

Both paths return enriched labels (backend unchanged; confirms QA issue was frontend bundle):

| Endpoint | nginx `titan.zala.ir` | backend `:5002` |
|----------|----------------------|-----------------|
| GET `/stats` | 200 | 200 |
| GET `/partitions` | 200 | 200 |
| GET `/operations` | 200 | 200 |

Sample `/stats` response (nginx, 2026-06-28):

- `health.status_code`: `warning_stale_archive`
- `health.records_pending_archive`: `4`
- `partitions[].label`: `Archive 2024`, `Archive 2025`, `Archive 2026`
- `recent_operations[].operation_label`: `Purge preview`, `Archive preview`, etc.
- Raw `partition_name` / `operation_type` present in JSON but **must not** appear in UI (frontend maps them)

---

## Browser Evidence (post-rebuild)

Scripts: `backend/scripts/archiving-p2-browser-verify.mjs`  
Run production: `APP=https://titan.zala.ir EVIDENCE_FILE=archiving-p2-production-evidence.json node scripts/archiving-p2-browser-verify.mjs`

| Evidence file | URL |
|---------------|-----|
| Local dev | [`archiving-p2-browser-evidence.json`](./screenshots/archiving-p2-browser-evidence.json) |
| Production | [`archiving-p2-production-evidence.json`](./screenshots/archiving-p2-production-evidence.json) |
| Deploy/build | [`archiving-p2-deploy-evidence.json`](./screenshots/archiving-p2-deploy-evidence.json) |

Screenshots (refreshed 2026-06-28): `archiving-p2-overview.png`, `archiving-p2-partitions.png`, `archiving-p2-operations.png`

| Check | Production (`titan.zala.ir`) |
|-------|------------------------------|
| Raw partition names in body | **None** (`forbiddenInBody: []`) |
| Raw operation enums in body | **None** |
| Archive 2024/2025/2026 visible | **Yes** |
| Restore empty-state copy | **Yes** (when `archived_records === 0`) |
| `preview_*` visible | **No** |
| Archiving network 200 | **Yes** (`/stats`, `/records`) |
| Console (archiving-specific) | Clean — unrelated MEXC/WS noise from Header |

---

## Build / Deploy Evidence

| Item | Value |
|------|-------|
| Build command | `npm run build` (2026-06-28 10:43 UTC) |
| Old chunk | `DataHubTab-CUO28e3n.js` |
| New chunk | `DataHubTab-BYziE4XX.js` |
| `index.html` main | `index-C3OCpwrE.js` |
| nginx root | `/home/ubuntu/webapp/TitanGold/dist` |
| Asset Last-Modified | `Sun, 28 Jun 2026 10:43:40 GMT` |
| pm2 backend reload | Not required (backend unchanged in this fix) |
| **Required after frontend changes** | **`npm run build`** — HTTPS users do not use dev server |

---

## DevOps

| Item | Status |
|------|--------|
| Migration 043 applied | Yes |
| `npm run build` (dist) | Yes — 2026-06-28 |
| `pm2 reload titan-backend` | Not needed for this fix |
| `pm2 titan-frontend` (dev) | Separate from production HTTPS path |
| Archive worker | **No** — manual/maintenance only |

---

## Files Changed (P2 scope)

| Area | Files |
|------|-------|
| Backend labels | `backend/services/datahubArchivingLabels.js` |
| Backend service | `backend/services/datahubArchivingService.js` |
| Migration | `backend/database/migrations/043_datahub_archiving_p2_safety.sql` |
| Frontend UI | `components/.../Archiving.tsx`, `archiving/archivingLabels.ts` |
| i18n | `deploy/blue|green/locales/en.json`, `fa.json` |
| Tests | `backend/__tests__/unit/datahubArchivingP2.test.js`, `src/__tests__/archiving*.test.ts` |
| Verify scripts | `backend/scripts/archiving-p2-*.mjs` |

**Out of scope:** `collected_data`, Pipeline, Telegram, Automation.

---

## Closing

Human QA round 2 rejection was caused by **stale `dist/` production bundle**, not missing P2 code. After `npm run build`, automated browser verification on **`https://titan.zala.ir`** passes all label/empty-state checks.

**Current verdict: PARTIAL / P2 rejected (pending Human QA re-run on production after hard refresh).**

Archive/restore **apply** was not executed on production data; do not claim REAL WORKING for apply paths.
