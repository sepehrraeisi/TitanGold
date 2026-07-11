# DH-DATA-ARCHIVING-P3 — Safe Fixture Archive/Restore Verify

Date: 2026-06-28  
Task: `DH-DATA-ARCHIVING-P3-SAFE-FIXTURE-ARCHIVE-RESTORE-VERIFY`  
Branch: `feat/gap-008-sources-backend-wiring`  
P2 reference: [`DH-DATA-ARCHIVING-P2-FUNCTIONAL-FIX-SAFETY-REDESIGN.md`](./DH-DATA-ARCHIVING-P2-FUNCTIONAL-FIX-SAFETY-REDESIGN.md)

---

## Final Verdict

### **REAL WORKING — fixture archive/restore apply paths**

All P3 fixture steps passed: create → archive dry-run → archive apply → restore dry-run → restore apply → cleanup.

| Scope | Verdict |
|-------|---------|
| Fixture archive apply (by ID, metadata-guarded) | **REAL WORKING** |
| Fixture restore apply (by ID, metadata-guarded) | **REAL WORKING** |
| Broad production archive (operator UI/API) | **Not verified in P3** — remains operator-controlled |
| Purge apply | **Not available** — count-only preview (v3.0) |
| Dedicated archive worker | **GAP-033** — not implemented |

---

## P2 Summary (Accepted Baseline)

P2 delivered **FUNCTIONAL + REDESIGNED + SAFE PREVIEW**:

- Production UI shows friendly labels (Archive 2024/2025/2026, Archive Preview, etc.)
- Restore empty-state clear when `archived_records === 0`
- Preview/dry-run verified; apply paths **not** verified until P3

Pre-P3 production counts (baseline):

| Metric | Value |
|--------|-------|
| Active records | 12 |
| Archived records | 0 |
| Pending archive (>90d) | 4 |
| Last archive run | 2026-05-11 (~48d) |
| Status | Archive overdue |

---

## Phase 1 — Pre-flight Audit

| Check | Result |
|-------|--------|
| Git branch | `feat/gap-008-sources-backend-wiring` |
| Migration 043 applied | Yes — `043_datahub_archiving_p2_safety` in `pgmigrations` |
| Archive partitions | `ai_decisions_archive_2024/2025/2026` exist (0 rows each pre-test) |
| Advisory lock 90324001 | Free at start |
| Concurrent archive worker | None in pm2 |
| `confirm_archive` gate | Yes — 400 `CONFIRM_ARCHIVE_REQUIRED` without flag |
| `confirm_restore` gate | Yes — 400 `CONFIRM_RESTORE_REQUIRED` without flag |
| Purge | Count-only — `purge_apply_available: false` |

Evidence: [`archiving-p3-fixture-evidence.json`](./screenshots/archiving-p3-fixture-evidence.json) → `preflight`, `counts.before`

---

## Phase 2 — Fixture Creation

One temporary `ai_decisions` row:

| Field | Value |
|-------|-------|
| `metadata.source` | `DH_DATA_ARCHIVING_P3_FIXTURE` |
| `metadata.test_run_id` | UUID per run |
| `metadata.created_by` | `archiving_p3_verify` |
| `decision_type` | `p3_fixture_test` |
| `created_at` | ~120 days ago (>90d threshold) |
| Trading/money linkage | None — harmless JSON payload |

After insert: active +1, pending +1 (12→13 active, 4→5 pending).

---

## Phase 3 — Archive Dry-run

- `previewArchiveFixture()` confirms fixture in candidate set
- Broad preview count includes fixture + existing 4 production pending rows
- Fixture **not** in archive table before apply
- Operation logged: `preview_archive` / Dry run

---

## Phase 4 — Archive Apply (Fixture Only)

**Method:** `archiveFixtureById()` — test-only service helper (not exposed on public routes).

Uses same transactional pattern as `archive_old_decisions` (DELETE active → INSERT archive) but restricted to:

```sql
WHERE id = $fixture_id
  AND metadata->>'source' = 'DH_DATA_ARCHIVING_P3_FIXTURE'
  AND metadata->>'test_run_id' = $test_run_id
```

| Verification | Result |
|--------------|--------|
| Fixture removed from `ai_decisions` | Yes |
| Fixture in `ai_decisions_archive_2026` | Yes |
| `archived_at` populated | Yes |
| Active count restored to 12 | Yes |
| Archived count 0→1 | Yes |
| Non-fixture row IDs unchanged | Yes — 12 production IDs identical before/after |
| Broad `executeArchive()` used | **No** |

Sample fixture run: `fixture_id` in evidence JSON; partition `Archive 2026`.

---

## Phase 5 — Restore Dry-run

- `previewRestoreFixture()` with ±1h window around fixture `created_at`
- `pending_count: 1` (fixture only in archive)
- Fixture still in archive, not in active before apply

---

## Phase 6 — Restore Apply (Fixture Only)

**Method:** `restoreFixtureById()` — metadata-guarded, advisory lock, duplicate guard.

| Verification | Result |
|--------------|--------|
| Fixture back in `ai_decisions` | Yes |
| Fixture removed from archive | Yes |
| Payload (input/output/metadata) preserved | Yes |
| Archived count 1→0 | Yes |
| Non-fixture rows untouched | Yes |
| Broad `executeRestore()` used | **No** |

---

## Phase 7 — Cleanup

`cleanupFixtures({ testRunId })` removes fixture from active and archive.

| Metric | Before test | After cleanup |
|--------|-------------|---------------|
| Active | 12 | 12 |
| Archived | 0 | 0 |
| Pending (>90d) | 4 | 4 |
| Fixture rows | 0 | 0 |

Audit/operation logs retained (marked `p3_fixture: true` in `request_payload`).

---

## DB Before/After Summary

| Stage | Active | Archived | Pending | Fixture active | Fixture archived |
|-------|--------|----------|---------|----------------|------------------|
| Baseline | 12 | 0 | 4 | 0 | 0 |
| After insert | 13 | 0 | 5 | 1 | 0 |
| After archive apply | 12 | 1 | 4 | 0 | 1 |
| After restore apply | 13 | 0 | 4 | 1 | 0 |
| After cleanup | 12 | 0 | 4 | 0 | 0 |

---

## Tests

| Suite | File | Result |
|-------|------|--------|
| P3 fixture unit | `backend/__tests__/unit/datahubArchivingP3Fixture.test.js` | 7 passed |
| P2 regression (unchanged) | `backend/__tests__/unit/datahubArchivingP2.test.js` | 11 passed (prior) |

Coverage: movement verification, fixture insert guards, purge count-only, no public route exposure, scoped script contract.

---

## Runtime Verification

Script: `backend/scripts/archiving-p3-fixture-verify.mjs`  
Evidence: [`archiving-p3-fixture-evidence.json`](./screenshots/archiving-p3-fixture-evidence.json)

```bash
cd backend && LOG_LEVEL=error node scripts/archiving-p3-fixture-verify.mjs
```

| Property | Value |
|----------|-------|
| Idempotent | Yes — stale fixture cleanup at start |
| Exit code on failure | Non-zero |
| Fixture script runtime | ~211 ms |
| Purge executed | No |
| Broad production archive | No |
| Non-fixture rows moved | No |

---

## Browser Evidence (Post-fixture)

Script: `backend/scripts/archiving-p3-browser-verify.mjs`  
Evidence: [`archiving-p3-browser-evidence.json`](./screenshots/archiving-p3-browser-evidence.json)  
Screenshot: [`archiving-p3-browser-after-fixture.png`](./screenshots/archiving-p3-browser-after-fixture.png)

| Check | Result |
|-------|--------|
| Active / Archived / Pending | 12 / 0 / 4 (baseline restored) |
| Friendly partition labels | Yes |
| Raw DB names / enums | None |
| Restore empty-state | Yes |
| Archive/Restore Completed in ops | Yes (P3 fixture operations in audit log) |
| Network archiving 200 | Yes |
| Console (archiving) | Clean |

---

## Performance

| Endpoint (nginx) | Latency |
|------------------|---------|
| GET `/stats` | 246 ms |
| GET `/health` | 80 ms |
| GET `/partitions` | 46 ms |
| GET `/records` | 37 ms |
| GET `/operations` | 40 ms |
| Fixture verify script | 211 ms |

Target GET < 500 ms — **met**.

---

## DevOps

| Item | Status |
|------|--------|
| Migration 043 | Unchanged, applied |
| pm2 backend | Healthy |
| Frontend | Unchanged (no UI deploy required) |
| nginx API | 200 |
| New cron/worker | None |
| Destructive scheduled job | None |

---

## Files Added (P3 scope)

| File | Purpose |
|------|---------|
| `backend/services/datahubArchivingFixtureService.js` | Test-only fixture create/archive/restore/cleanup |
| `backend/scripts/archiving-p3-fixture-verify.mjs` | End-to-end fixture verification |
| `backend/scripts/archiving-p3-browser-verify.mjs` | Post-fixture UI verification |
| `backend/__tests__/unit/datahubArchivingP3Fixture.test.js` | Unit tests |
| `docs/ssot_v3/DH-DATA-ARCHIVING-P3-SAFE-FIXTURE-ARCHIVE-RESTORE-VERIFY.md` | This document |
| `docs/ssot_v3/screenshots/archiving-p3-*` | Evidence + screenshot |

**Not added:** public HTTP routes for fixture helpers (intentionally internal).

---

## Closing

P3 proves the **core archive/restore transaction logic** works end-to-end on a clearly marked fixture without moving production rows.

**REAL WORKING** applies to **fixture-scoped apply paths** verified by `archiving-p3-fixture-verify.mjs`. Operator-initiated broad archive of the 4 existing pending production records remains a separate, deliberate action not executed in this phase.

Purge remains count-only. Dedicated archive worker remains GAP-033.
