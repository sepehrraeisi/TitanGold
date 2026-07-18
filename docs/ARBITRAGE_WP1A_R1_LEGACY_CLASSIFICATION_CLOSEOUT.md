# ARB-WP1A-R1 Closeout — Modern and Legacy Scan Classification

**Module:** AI → Agents → Arbitrage Scanner  
**Work Package:** ARB-WP1A-R1 — Modern Scan Legacy Classification Repair  
**Environment:** Staging (`https://titan.zala.ir`)

---

## Final status

| Item | Value |
|------|--------|
| Engineering verdict | **`REAL WORKING`** |
| Slice status | **`CLOSED AND FROZEN`** |
| Human QA | **PASS** (ARB-R1-1 … ARB-R1-4) |
| Final Human-QA verdict | **PASS** |

| Dependent / deferred | Status |
|----------------------|--------|
| AI-FOUNDATION-R2 (scheduler path) | **CLOSED AND FROZEN** — runtime baseline `76a76b6` |
| ARB-WP1B-2A Overview | **OPEN — READY FOR FINAL HUMAN-QA AND CLOSEOUT** |
| Scan History drill-down | **DEFERRED** → `ARB-WP1B-2B` |
| Connections | **NOT STARTED** → `SETTINGS-CONNECTIONS-D1` |

---

## Baselines (keep separate)

| Kind | Value |
|------|--------|
| **ARB-WP1A-R1 runtime implementation baseline** | `69d5ee2` — `fix(arb): classify modern and legacy scan contracts correctly` |
| **AI-FOUNDATION-R2 runtime implementation baseline** | `76a76b6` — analytical scheduler separation + status TTL |
| **Pre-Human-QA ARB-WP1A-R1 documentation** | `4658529` — `docs(arb): record ARB-WP1A-R1 runtime commit and Staging evidence` |
| **Pre-closeout repository documentation HEAD** | `5fdb84d` — AI-FOUNDATION-R2 docs closeout |
| **Documentation closeout HEAD** | `docs(arb): close modern and legacy scan classification R1` on `main` (see Git after push) |
| **Served frontend bundle** | `assets/index-DdyO2tD0.js` |

After `69d5ee2`, runtime source for classification was not changed except separately documented **AI-FOUNDATION-R2** worker/scheduler work (`3f2f7b0`, `76a76b6`) and documentation-only commits.

---

## 1. Human QA

| Scenario | Result |
|----------|--------|
| **ARB-R1-1** Modern Scan | **PASS** |
| **ARB-R1-2** Genuine Legacy Scan | **PASS** |
| **ARB-R1-3** Scheduler Contract Consistency | **PASS** |
| **ARB-R1-4** Safety and Regression | **PASS** |
| **Final Human-QA verdict** | **PASS** |

---

## 2. Contract behavior

### Canonical classification owner

`classifyScanContract` / `normalizeScanResult` in `backend/services/arbitrageScanContract.js`.

Precedence:

1. Explicit contract version (`contractVersion` or `_meta.version` with wp1a)
2. Explicit `legacy` boolean marker
3. Verified modern payload shape
4. Verified historical `opportunities[]` shape
5. `partial` when evidence is insufficient

Deprecated `options.legacy` **cannot** override explicit modern data. No destructive historical rewrite / backfill.

### Producers

| Path | Result |
|------|--------|
| Manual analytical run | Modern WP1A contract (`legacy: false`, `contractVersion: 2.0.0-wp1a`) |
| Scheduler analytical tick | Same canonical `arbitrage` service / contract; modern classification |
| Overview ↔ Scan History | Agree on classification and completion semantics |
| One tick → one decision | Confirmed (manual controlled run + scheduler recurrence via Foundation R2) |

---

## 3. Human-observed History labels

### Modern rows

`Analytical scan · Completed · Dry run`

- Modern WP1A contract
- Not labeled Legacy
- Consistent in Overview and Scan History
- Produced by manual and scheduler paths

### Genuine historical rows

`Legacy scan · Completed · Dry run`

**These describe different dimensions and are not contradictory:**

| Token | Dimension |
|-------|-----------|
| **Legacy** | Stored **contract generation** (historical shape / version) |
| **Completed** | Successful **scan completion** status |
| **Dry Run** | **Execution-safety** classification (non-live analytical operation) |

Legacy:

- appears only once per historical row
- does not replace modern records
- does not imply execution
- does not imply realized profit
- preserves available historical values (unknown modern fields remain N/A / null — not fabricated as profit)

---

## 4. Evidence

### Modern manual scan

| Field | Value |
|-------|--------|
| Decision ID | `6e9ada1e-e94a-48df-9e03-5ff202dab847` |
| created_at | `2026-07-17T18:38:33.361Z` |
| Producer | Manual `POST …/run` |
| Persisted | `legacy: false`, `contractVersion: 2.0.0-wp1a` |
| Details / History API | `classification: modern`, `legacy: false` |
| UI | Completed / Analytical scan · Completed · Dry run |

### Modern scheduler scan (depends on AI-FOUNDATION-R2)

| Field | Value |
|-------|--------|
| First verified scheduler decision | `48604985-483c-4177-9bbc-3ea917702e99` @ `2026-07-18T12:36:52.318Z` |
| Producer | `trigger=scheduler`, `producer=titan-engine-worker` |
| Contract | `2.0.0-wp1a`, `legacy: false`, `modern` |
| Nearby POST `/run` | 0 |
| Recurrence | ~one modern row per 300000ms allowlisted tick |

### Genuine historical / Legacy

| Field | Value |
|-------|--------|
| Example ID | `a96d7b71-0b8b-4d12-b799-a02b25fdad59` @ `2026-02-23T13:23:08.852Z` |
| Reason | Historical `opportunities[]` / `_meta.version` `1.0.0` (not WP1A modern shape) |
| API | `classification: legacy`, `legacy: true` |
| UI | Legacy scan · Completed · Dry run |

### Case B (misclassified modern before fix)

`c5164284-f7a2-4aa9-b5c9-0666f3e8ce96` — persisted modern (`legacy: false`, wp1a) but forced Legacy by read-path `{ legacy: true }` — repaired by `69d5ee2`.

### Classification counts (engineering audit at R1 implementation)

At controlled-scan window (agent `04b6ca95-…`, `arbitrage_scan`): modern ~17 · Legacy ~12 · partial 0 · total ~29 (later totals grew via scheduler; Live/History pagination continues to show Legacy on later pages).

### Tests (at R1 implementation)

| Layer | Result |
|-------|--------|
| Backend Jest (WP1A + R1 classification) | **19/19 PASS** |
| Frontend Vitest (WP1A / WP1B-1 / WP1B-2A / AI-RTL) | **35/35 PASS** |
| Combined | **54/54 PASS** |

### Browser QA / i18n

Engineering + Human QA: English, Persian, RTL, IRANSans, Overview/History agreement, no raw enum/key on verified paths. Served bundle `assets/index-DdyO2tD0.js`.

### Runtime safety (closeout passive verification)

- Effective Mode: `demo`
- Emergency Stop: active
- workerAcknowledged: true
- providerConnected: false
- Live impossible
- Scheduler owner: `titan-engine-worker`
- Allowlist: `["arbitrage"]`
- Latest scan: modern / Completed / Dry Run
- Genuine Legacy rows still present on later History pages

### Dependencies / baselines untouched

- Data Hub — untouched
- Agents Shell — untouched
- AI-FOUNDATION-R1 — untouched
- AI-FOUNDATION-R2 — closed separately; not modified in this docs closeout

### Protected unrelated files

Untouched:

- `scripts/backup-db.sh`
- `scripts/phase2-monitoring/titangold-backup-healthcheck.sh`
- `scripts/phase2-monitoring/titangold-telegram-notify.sh`

---

## 5. Original RCA (summary)

**Symptom:** Post-WP1A modern scans rendered as Legacy.

**Cause:** Read path called `normalizeScanResult(raw, { legacy: true })`, forcing the historical branch even when persisted data was modern.

**Fix:** Canonical `classifyScanContract` precedence; remove force-Legacy from details/`lastScan` and `fetchArbitrageScanHistory`; producer top-level `contractVersion`; minimal frontend consumption of `classification` / `legacy`.

---

## 6. Deferred Scan History UX

**`ARB-WP1B-2B — Scan History Redesign and Scan Detail Drill-down`**

- Rows do not open details; no drawer/details route exposed
- Information-architecture / UX enhancement
- **Not** a classification defect
- **Not authorized** in this closeout

---

## 7. Rollback

1. Revert `69d5ee2` on `main` (or redeploy prior classification sources)
2. Restore prior `arbitrageScanContract.js` / `ai-agents.js` / `arbitrage.js` on PM2 cwd and reload
3. Rebuild frontend to prior bundle if UI consumption must roll back
4. Scheduler Foundation (`76a76b6`) rolls back separately if required

Documentation-only closeout commits do not require runtime rebuild.

---

## 8. Return target

After this freeze: **ARB-WP1B-2A Overview — READY FOR FINAL HUMAN-QA AND CLOSEOUT**.

Do **not** auto-start Overview, Scan History drill-down, or Connections from this closeout.
