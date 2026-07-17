# ARB-WP1B-2A Closeout — Overview Tab Professional Redesign + Human-QA Remediation

**Module:** AI → Agents → Arbitrage Scanner → Overview  
**Work Package:** ARB-WP1B-2A  
**Date:** 2026-07-17  

## Final status (before Human QA re-check)

| Item | Value |
|------|--------|
| Human QA | **FAIL → remediations deployed; awaiting re-PASS** |
| Engineering verdict | **NEEDS MORE VERIFICATION** |
| ARB-WP1B-2A | Remediation implemented + Staging Browser QA; awaiting Human QA |
| Arbitrage Agent | **OPEN** — Candidates / History / Profit & Risk / Settings / Integrations remain |
| ARB-WP1B-2B | **NOT STARTED** (stop condition) |

## Distinction

| Kind | Value |
|------|--------|
| **Runtime implementation baseline (initial redesign)** | `40f4c5f` |
| **Runtime implementation baseline (Human-QA remediation)** | *(this remediation commit on `main` after push)* |
| **Documentation closeout HEAD (prior)** | `4d42353` |
| **Served frontend bundle (before remediation)** | `assets/index-WlHdPJwp.js` |
| **Served frontend bundle (after remediation)** | `assets/index-DsAjAa6N.js` |
| **Environment** | Staging `https://titan.zala.ir` |
| **Frozen WP1A runtime** | `f4fd43a` |
| **Frozen WP1B-1 runtime** | `a9d6a5e` |

---

## Human-QA Defects Addressed (ARB-WP1B-2A remediation)

| # | Defect | Fix |
|---|--------|-----|
| 1 | Latest Scan + Scan Outcome duplicated Candidate/Rejected/Qualified | Removed Scan Outcome metric block; counts appear once under Latest Scan |
| 2 | Analytical / execution limitations repeated many times | One compact interpretation sentence; removed bullets / duplicate cards / redundant hints |
| 3 | Metric-card descriptions truncated with ellipsis on Desktop | Removed metric `hint`/`line-clamp` on Overview counts |
| 4 | Oversized Recent Candidate Summary empty state | Replaced with compact `OverviewCompactEmpty` (`py-4`) |
| 5 | Latest scan labeled Legacy — SoT RCA required | **Case B** recorded (see below); UI shows Legacy **once** without hiding the read-path defect |
| 6 | State coverage incomplete | Unit fixtures for never-scanned / all-rejected / failed / loading / API error / permission / modern / genuine legacy |
| 7 | Persian / tablet / mobile / a11y incomplete | Staging Browser QA EN+FA + 1440/768/390/844 viewports |

---

## Latest-Scan Legacy RCA — **Case B**

### Traced record (Staging)

| Field | Value |
|-------|--------|
| Decision ID | `c5164284-f7a2-4aa9-b5c9-0666f3e8ce96` |
| Displayed time | `7/17/2026, 12:42:40 PM` (local) ≈ `2026-07-17T09:12:40.830Z` |
| Persist path | `backend/services/agents/arbitrage.js` `run()` writes modern shape with `legacy: false` |
| Read path | `backend/routes/ai-agents.js` details/`lastScan` calls `normalizeScanResult(latestRaw, { legacy: true })` |
| History path | `backend/services/arbitrageScanContract.js` `fetchArbitrageScanHistory` also forces `{ legacy: true }` |

### Classification

**Case B — Post-WP1A scan incorrectly classified as Legacy by the read-path.**

- Write path produces the modern WP1A contract.
- Read/normalize path **always** forces `legacy: true`, so every latest/history item surfaces as Legacy even when the persisted payload is modern.
- This is a **reproduced WP1A contract/read-path defect**, not a genuine pre-WP1A legacy row, and not a frontend-only mis-detect of a modern API flag.

### Overview remediation response (authorized scope)

- Do **not** silently reopen or patch WP1A backend in this slice.
- Overview displays API `legacy` truthfully **once** (status pill + one short note).
- Does **not** repeat “Legacy normalized scan record”.
- Propose separate Work Package: **ARB-WP1A-R1 — Legacy read-path force**  
  - Call `normalizeScanResult(raw)` without forced `{ legacy: true }`  
  - Let shape / persisted `raw.legacy` decide  
  - Add contract regression tests for manual + scheduled modern runs

### ARB-O2 implication

Legacy/Modern correctness for post-WP1A scans remains **blocked on WP1A-R1**. Overview presentation is honest about the API flag without concealing Case B.

---

## 1. Scope

Overview-only Human-QA remediation: information hierarchy, truncation, compact empty state, Legacy presentation honesty, focused tests, Staging Browser QA, deploy, Git closeout docs.

## 2. Out of Scope

Candidates / History / Profit & Risk / Settings / Integrations redesigns; `AgentControlShell`; Data Hub; Agents Shell; silent WP1A backend contract fix; Live execution; DB mutations; ARB-WP1B-2B.

## 3. Repository Status

- Isolated worktree: `/tmp/titangold-arb-wp1b2a-overview`
- Branch: `feat/arb-wp1b2a-overview-remediation` (from `origin/main` @ `4d42353`)
- Original tree `/home/ubuntu/webapp/TitanGold`: dirty **only** with protected unrelated scripts
- Protected files untouched:
  - `scripts/backup-db.sh`
  - `scripts/phase2-monitoring/titangold-backup-healthcheck.sh`
  - `scripts/phase2-monitoring/titangold-telegram-notify.sh`

## 4. RCA (Overview presentation)

### Duplicated metrics (removed)

- Scan Outcome Candidate / Rejected / Qualified block (same as Latest Scan)

### Repeated analytical copy (reduced to one)

- Removed multi-bullet Analytical Interpretation / execution-support info row / metric hints that restated “analytical only / not execution”

### Truncation (removed)

- No `line-clamp` essential hints on Overview metric cards

### Empty state (compacted)

- `OverviewCompactEmpty` with optional View Scan History action

## 5. Dependency Findings

| Layer | Dependency | Action |
|-------|------------|--------|
| UI | DATAHUB tokens, MetricCard, StatusPill, SecondaryButton | Reused |
| Shell | `AgentControlShell` | Unchanged |
| API | details payload / `legacy` flag | Displayed as returned (Case B noted) |
| Contracts | WP1A definitions | Not silently changed |
| i18n | blue+green EN/FA | Compact keys added |

## 6. Source of Truth

- WP1A analytical semantics remain authoritative
- Shell owns chrome metrics and Run Scan
- Overview: Latest Scan → one Interpretation → Next step / compact preview
- Unknown → `N/A`; no fabricated realized/captured profit

## 7. Architecture Decision

Three content groups only:

1. **Latest Scan** — time, status, Spread/Rejected/Qualified once, optional risk
2. **Interpretation** — one compact sentence + optional rejection pills + Legacy note once
3. **Next step** — nav + compact preview or compact empty

## 8–12. Backend / DB / Redis / Security / Runtime

| Area | Result |
|------|--------|
| Backend Changes | **NOT APPLICABLE** (Case B proposed as separate WP1A-R1) |
| Database | **NOT APPLICABLE** — no data mutation |
| Redis | **NOT APPLICABLE** |
| Security | Permission/error Overview states preserved |
| Runtime/Worker | Unchanged — Demo + Emergency Stop + broker offline |

## 13. Frontend Changes

- `components/ai/ArbitrageAgentControl.tsx` — hierarchy / truncation / empty / Legacy-once
- Locales EN/FA (blue + green) — compact interpretation / next / legacy_once
- `src/__tests__/components/ai/ArbitrageAgentControl.wp1b2a.overview.test.tsx` — remediation assertions

## 14. UI/UX Redesign

| Item | Status |
|------|--------|
| Layout / Spacing / Cards / Typography / Badges | PASS (Staging Browser QA) |
| Loading / Empty / Error | PASS (unit + Browser where applicable) |
| Accessibility / Keyboard / Responsive / Dark / i18n / Overflow / Focus | PASS (Staging Browser QA) |

## 15. Tests

| Suite | Executed | Passed | Failed | Skipped | Env |
|-------|----------|--------|--------|---------|-----|
| `ArbitrageAgentControl.wp1a.test.tsx` | 6 | 6 | 0 | 0 | vitest/jsdom |
| `ArbitrageAgentControl.wp1b1.test.tsx` | 7 | 7 | 0 | 0 | vitest/jsdom |
| `ArbitrageAgentControl.wp1b1.status.test.tsx` | 3 | 3 | 0 | 0 | vitest/jsdom |
| `ArbitrageAgentControl.wp1b2a.overview.test.tsx` | 11 | 11 | 0 | 0 | vitest/jsdom |

**Total:** 27 executed · 27 passed · 0 failed · 0 skipped  
**Environment:** Node vitest in `/tmp/titangold-arb-wp1b2a-overview` (`--pool=forks --maxWorkers=1`)

## 16. Performance

| Metric | Result |
|--------|--------|
| Overview initial render baseline | **BASELINE NOT AVAILABLE** |
| Extra Overview API | None |
| Polling added | None |

## 17. Browser QA

Staging after deploy of bundle `assets/index-DsAjAa6N.js`.

| Item | Result |
|------|--------|
| No Scan Outcome / Analytical Interpretation / oversized empty titles | PASS |
| No essential Overview ellipsis | PASS |
| Legacy label at most once | PASS |
| Nav Review candidates / Scan history | PASS |
| Escape closes shell | PASS |
| Tablet / mobile portrait / landscape | PASS |
| Persian labels / no EN leakage / no raw keys | PASS |
| Console Overview-related errors | PASS |
| Runtime Emergency Stop / Broker Offline | PASS |

Automated Staging Playwright: **35/35 PASS**

Runtime (`/api/settings/execution-runtime`):

- requestedMode / globalRuntimeMode / effectiveMode: `demo`
- killSwitchActive: `true`
- workerAcknowledged: `true`
- providerConnected: `false`
- deploymentEngineEnabled: `false`

## 18. Human-QA Handoff

Human QA must explicitly PASS ARB-O1 … ARB-O5 (see handoff below).  
Note for ARB-O2: Legacy API flag is Case B; modern classification requires WP1A-R1.

## 19. Regression

- WP1A write contract untouched
- WP1B-1 shell unchanged (unit regression green)
- No backend restart

## 20. Build/Deployment

- Production-style `vite build` from isolated worktree
- Sync to nginx root `/home/ubuntu/webapp/TitanGold/dist`
- Backend restart: **not required**
- Served bundle verified: `assets/index-DsAjAa6N.js`

## 21. Files Changed (remediation)

- `components/ai/ArbitrageAgentControl.tsx`
- `deploy/blue/locales/en.json`
- `deploy/blue/locales/fa.json`
- `deploy/green/locales/en.json`
- `deploy/green/locales/fa.json`
- `src/__tests__/components/ai/ArbitrageAgentControl.wp1b2a.overview.test.tsx`
- `docs/ARBITRAGE_WP1B2A_OVERVIEW_CLOSEOUT.md`

## 22. Commits

- `40f4c5f` — initial Overview redesign (prior runtime)
- Remediation commit: `fix(arb): simplify Overview and correct legacy scan presentation`
- Prior docs-only: `400f449`, `2ebc6d9`, `4d42353`

## 23. Git Verification

- Isolated worktree used for implementation
- Path-scoped staging only (no protected scripts)
- Original `/home/ubuntu/webapp/TitanGold` remains dirty only for protected unrelated scripts

## 24. Remaining Risks

- **Case B** Legacy misclassification until WP1A-R1
- Human QA re-check not yet performed
- Other Arbitrage tabs still older interior layouts

## 25. Final Verdict

**NEEDS MORE VERIFICATION** — pending explicit Human-QA PASS on ARB-O1 … ARB-O5.

## Rollback

1. Revert the remediation commit on `main`
2. Rebuild frontend and sync `dist/`
3. Confirm served bundle returns to `assets/index-WlHdPJwp.js` (or documented prior)

## Remaining Arbitrage tabs

- Candidates
- Scan History
- Profit & Risk
- Settings
- Integrations

Do **not** begin ARB-WP1B-2B until this slice is Human-QA PASS and CLOSED AND FROZEN.
Do **not** silently patch WP1A; open **ARB-WP1A-R1** for Legacy read-path force if approved.
