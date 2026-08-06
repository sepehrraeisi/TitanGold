## Summary

Resolves the **E2E promotion marker crash-safety** fail-safe blocker for Trend Detection (PR #18, Draft). No product features, no Scheduler/worker changes, no Staging product redeploy, no merge.

### Marker lifecycle fix

- Setup **never silently deletes** an existing promotion marker.
- Valid `promotion_pending` / `promoted` markers are **cleaned first** (`rowCount === 1`) before a new setup.
- Incomplete/invalid markers **abort setup**.
- Cleanup failure **preserves** the marker and aborts setup.
- Before DB role promotion: atomic `state=promotion_pending` marker (identity only; no secrets).
- After successful promotion: atomic `state=promoted`.
- Teardown cleans **both** pending and promoted; marker removed only after successful DB cleanup.

### Commits

| Commit | Role |
|--------|------|
| `81e25f6` | Implementation + focused crash-safety tests |
| `18ef08f` | Docs / Rule 02 closeout |
| (follow-up) | CI path nudge / docs body if needed |

### Runtime provenance (unchanged — tooling/tests only)

| Field | Value |
|-------|-------|
| Runtime implementation | **`85a762b`** |
| Served bundle | **`assets/index-CLflvsy0.js`** |
| `provenanceVerified` | **true** |

### Tests (local)

- `fixtureProcess.test.ts` + `globalSetup.test.ts`: **21/21 PASS**

### Deferred

- Dual-worker scheduler fingerprint remediation
- Trend merge/freeze

## Test plan

- [x] Existing promoted marker never silently deleted
- [x] Existing pending marker cleaned before new setup
- [x] Promote fail leaves pending; teardown cleans it
- [x] Crash window pending still cleans exact fixture
- [x] Cleanup fail aborts and preserves marker
- [x] Invalid marker aborts setup
- [x] Successful cleanup allows new promotion
- [x] No shell/secret regression
- [ ] GitHub PR checks on final HEAD (Backend / Frontend / E2E / Migrations / Security)

**Verdict:** TREND E2E MARKER CRASH-SAFETY FIX COMPLETE — READY FOR FINAL RE-REVIEW
