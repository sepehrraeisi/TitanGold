# ARB-WP1A-R1 Closeout — Modern Scan Legacy Classification Repair

**Module:** AI → Agents → Arbitrage Scanner  
**Work Package:** ARB-WP1A-R1 — Modern Scan Legacy Classification Repair  
**Date:** 2026-07-17  

## Final status (before Human QA)

| Item | Value |
|------|--------|
| Human QA | **NOT STARTED** — awaiting ARB-R1-1 … ARB-R1-4 |
| Engineering verdict | **NEEDS MORE VERIFICATION** |
| Arbitrage Agent | **OPEN** |
| ARB-WP1B-2A Overview | **OPEN** (return target after this slice closes) |
| Next after Human QA closeout | Return to **ARB-WP1B-2A** — do not auto-start |

## Distinction

| Kind | Value |
|------|--------|
| **Runtime implementation baseline** | *(commit after push)* — `fix(arb): classify modern and legacy scan contracts correctly` |
| **Served frontend bundle** | `assets/index-DdyO2tD0.js` |
| **Environment** | Staging `https://titan.zala.ir` |
| **Backend process commit (health, after reload)** | reports `a17ef46` from original tree checkout (process cwd `/home/ubuntu/webapp/TitanGold/backend`); **runtime files for this fix were synced from worktree and reloaded** |
| **Isolated worktree** | `/tmp/titangold-arb-wp1a-r1` |
| **Preflight origin/main** | `9ab8ca6` |
| **Preflight served bundle (before)** | `assets/index-CSyOLG24.js` |

---

## 1. Scope

Repair scan-contract classification ownership: modern vs Legacy detection, read-path normalization, details/history/latest-scan agreement, minimal frontend consumption, tests, controlled Staging verification.

## 2. Out of Scope

Overview/Candidates/History/Profit&Risk/Settings/Integrations redesign; AgentControlShell; RTL foundation; profitability formulas; qualification rules; execution; Connections; Redis cache; Data Hub; Agents Shell; Live; Emergency Stop clear.

## 3. Repository / Runtime Preflight

| Item | Value |
|------|--------|
| origin/main (start) | `9ab8ca6` |
| Isolated branch | `fix/arb-wp1a-r1-legacy-classification` @ `9ab8ca6` |
| Ahead/behind | 0 / 0 vs origin/main at start |
| Isolated status | clean |
| Original worktree | behind origin/main; dirty **only** protected scripts |
| Active frontend source | `/home/ubuntu/webapp/TitanGold/dist` (nginx) |
| Active backend source | `/home/ubuntu/webapp/TitanGold/backend` (PM2 `titan-backend`) |
| PM2 | `titan-backend` online (cluster), `titan-engine-worker` online |
| Backend health commit before reload | `1a3955f` (≠ repo HEAD — documented) |
| Runtime | Demo, Kill Switch active, worker acknowledged, broker offline |

Protected files untouched:

- `scripts/backup-db.sh`
- `scripts/phase2-monitoring/titangold-backup-healthcheck.sh`
- `scripts/phase2-monitoring/titangold-telegram-notify.sh`

## 4. RCA

### Symptom

Post-WP1A scans (persisted `legacy: false`, `analyticalMode`, `_meta.version=2.0.0-wp1a`) rendered as **Legacy**.

### Reverified affected record

| Field | Value |
|-------|--------|
| Decision ID | `c5164284-f7a2-4aa9-b5c9-0666f3e8ce96` |
| created_at | `2026-07-17T09:12:40.830Z` |
| Persisted | `legacy: false`, `analytical_spread_monitor`, `_meta.version: 2.0.0-wp1a`, has `candidates` |

### Lifecycle

Manual/Scheduler → `services/agents/arbitrage.js` `run()` → persist `ai_decisions.output_data` → details route / `fetchArbitrageScanHistory` → **`normalizeScanResult(raw, { legacy: true })`** → API `legacy: true` → Overview/History Legacy labels.

### Root cause

`normalizeScanResult` only used the modern branch when `isNewShape && !legacy`. Call sites **forced** `{ legacy: true }`, so modern payloads always fell into the historical path and returned `legacy: true`.

### Call sites that forced Legacy

1. `backend/routes/ai-agents.js` details/`lastScan`
2. `backend/services/arbitrageScanContract.js` `fetchArbitrageScanHistory`

Write path already set `legacy: false` + `_meta.version` — not the producer defect.

## 5. Canonical classification

Owner: `classifyScanContract` / `normalizeScanResult` in `arbitrageScanContract.js`.

Precedence:

1. Explicit contract version (`contractVersion` or `_meta.version` with wp1a)
2. Explicit `legacy` boolean marker
3. Verified modern payload shape
4. Verified historical `opportunities[]` shape
5. `partial` when evidence insufficient

Deprecated `options.legacy` **cannot** override explicit modern data.

API fields:

- `classification`: `modern` | `legacy` | `partial`
- `legacy`: `false` | `true` | `null` (partial)
- `contractVersion` when known
- status: `completed` | `failed` | `unavailable`

## 6. Existing data (read-only audit)

Agent `04b6ca95-5fd3-471d-a568-bd7f1c391d83`, decision_type `arbitrage_scan`, after controlled scan:

| Class | Count |
|-------|------:|
| clearly modern | 17 |
| clearly Legacy | 12 |
| partial/ambiguous | 0 |
| **total** | **29** |

Rule: `classifyScanContract` precedence above. No UPDATE/DELETE/backfill.

## 7–12. Layers

| Area | Result |
|------|--------|
| Backend | Fixed classification + call sites; producer adds top-level `contractVersion` |
| Database | NOT APPLICABLE (no migration) |
| Redis | NOT APPLICABLE |
| Security | Auth/capability unchanged; errors sanitized as before |
| Runtime/Worker | Analytical scan only; side effects suppressed (`KILL_SWITCH_ACTIVE`) |
| Frontend | Consume `classification`/`legacy`; History humanizes status; no layout redesign |

## 13. Controlled scan evidence

| Field | Value |
|-------|--------|
| Decision ID | `6e9ada1e-e94a-48df-9e03-5ff202dab847` |
| created_at | `2026-07-17T18:38:33.361Z` |
| Producer | POST `/api/ai-agents/:id/run` (manual analytical) |
| Persisted | `legacy: false`, `contractVersion: 2.0.0-wp1a`, `_meta.version: 2.0.0-wp1a` |
| Details API | `classification: modern`, `legacy: false` |
| History API | same |
| Overview UI | **Completed**, no Legacy |
| History UI | Analytical scan · Completed |

Scheduler path: same `run()` producer → same modern contract. Passive observation of a new scheduler tick during this window: **NOT VERIFIED** (no scheduler restart triggered; remaining test = observe next scheduled `arbitrage_scan` after closeout).

## 14. Tests

### Backend (Jest)

| Suite | Executed | Passed | Failed | Skipped |
|-------|----------|--------|--------|---------|
| `arbitrage.wp1a.test.js` | 8 | 8 | 0 | 0 |
| `arbitrage.wp1a.r1.classification.test.js` | 11 | 11 | 0 | 0 |
| **Backend total** | **19** | **19** | **0** | **0** |

### Frontend (Vitest)

| Suite | Executed | Passed | Failed | Skipped |
|-------|----------|--------|--------|---------|
| WP1A | 6 | 6 | 0 | 0 |
| WP1B-1 | 7 | 7 | 0 | 0 |
| WP1B-1 status | 3 | 3 | 0 | 0 |
| WP1B-2A Overview | 12 | 12 | 0 | 0 |
| AI-FOUNDATION-R1 RTL | 7 | 7 | 0 | 0 |
| **Frontend total** | **35** | **35** | **0** | **0** |

**Combined:** 54 executed · 54 passed · 0 failed · 0 skipped · 0 retried

## 15. Performance

| Path | Observation |
|------|-------------|
| details / history | Bounded pagination unchanged; no full-history scan; no N+1 introduced |
| Overview load | Same single details request |
| Baseline | **BASELINE NOT AVAILABLE** for historical p95 |

## 16. Browser QA

Staging after deploy — **24/24 PASS** including:

- Modern Completed (EN/FA)
- History page 2 Legacy retained
- RTL + IRANSans preserved
- Desktop/tablet/mobile/landscape
- Escape / console clean
- Bundle `index-DdyO2tD0.js`

## 17. Runtime safety (post-scan)

- requestedMode / effectiveMode: `demo`
- killSwitchActive: `true`
- workerAcknowledged: `true`
- providerConnected: `false`
- policy on controlled run: `sideEffectsSuppressed: true`, reason `KILL_SWITCH_ACTIVE`
- No orders / transfers / notifications

## 18. Build / Deployment

- Frontend: production `vite build` → sync `dist/`
- Backend: synced changed service/route files into active backend cwd + `pm2 reload titan-backend`
- Health/ready: ok after reload
- Served bundle: `assets/index-DdyO2tD0.js`

## 19. Files Changed

- `backend/services/arbitrageScanContract.js`
- `backend/routes/ai-agents.js`
- `backend/services/agents/arbitrage.js`
- `backend/__tests__/services/agents/arbitrage.wp1a.test.js`
- `backend/__tests__/services/agents/arbitrage.wp1a.r1.classification.test.js`
- `components/ai/ArbitrageAgentControl.tsx`
- `services/api.ts`
- `types.ts`
- `src/__tests__/components/ai/ArbitrageAgentControl.wp1b2a.overview.test.tsx`
- `docs/ARBITRAGE_WP1A_R1_LEGACY_CLASSIFICATION_CLOSEOUT.md`

## 20. Commits / Git

Recorded after scoped push. Path-scoped staging only.

## 21. Remaining Risks

- Scheduler modern classification on a future tick: **NOT VERIFIED** in this window
- Backend health `commit` field still reflects original tree HEAD, not worktree SHA — operational process/reporting quirk; file hashes were synced
- Human QA pending

## 22. Final Verdict

**NEEDS MORE VERIFICATION**

## Rollback

1. Revert the ARB-WP1A-R1 commit on `main`
2. Restore prior `arbitrageScanContract.js` / `ai-agents.js` / `arbitrage.js` on the PM2 cwd and reload
3. Rebuild frontend to prior bundle (`index-CSyOLG24.js`) if needed

## Return target

After Human-QA PASS and closeout freeze: return to **ARB-WP1B-2A** (do not auto-start).
