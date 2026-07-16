# ARB-WP1B-2A Closeout — Overview Tab Professional Redesign

**Module:** AI → Agents → Arbitrage Scanner → Overview  
**Work Package:** ARB-WP1B-2A  
**Date:** 2026-07-16  

## Final status (before Human QA)

| Item | Value |
|------|--------|
| Human QA | **NOT STARTED** |
| Engineering verdict | **NEEDS MORE VERIFICATION** |
| ARB-WP1B-2A | Implementation + Staging Browser QA complete; awaiting Human QA |
| Arbitrage Agent | **OPEN** — Candidates / History / Profit & Risk / Settings / Integrations remain |
| ARB-WP1B-2B | **NOT STARTED** (stop condition) |

## Distinction

| Kind | Value |
|------|--------|
| **Runtime implementation baseline (this slice)** | `40f4c5f` |
| **Documentation closeout HEAD** | `400f449` |
| **Documentation closeout HEAD** | `400f449` |
| **Served frontend bundle (before)** | `assets/index-D6ZmsjWR.js` |
| **Served frontend bundle (after)** | `assets/index-WlHdPJwp.js` |
| **Environment** | Staging `https://titan.zala.ir` |
| **Frozen WP1A runtime** | `f4fd43a` |
| **Frozen WP1B-1 runtime** | `a9d6a5e` |
| **Frozen WP1B-1 docs** | `a17ef46` |

---

## 1. Scope

Professional redesign of **Overview only**, using verified WP1A contracts and WP1B-1 shared shell, without modifying AgentControlShell or WP1A canonical definitions.

## 2. Out of Scope

Candidates, Scan History, Profit & Risk, Settings, Integrations redesigns; AgentControlShell; Data Hub; Agents Shell; DB/Redis/worker/scheduler; Live execution; external notifications; ARB-WP1B-2B.

## 3. Repository Status

- Isolated worktree: `/tmp/titangold-arb-wp1b2a-overview`
- Branch: `feat/arb-wp1b2a-overview` (from `origin/main` @ `a17ef46`)
- Original tree `/home/ubuntu/webapp/TitanGold`: dirty **only** with protected unrelated scripts (not staged/committed)
- Protected files untouched:
  - `scripts/backup-db.sh`
  - `scripts/phase2-monitoring/titangold-backup-healthcheck.sh`
  - `scripts/phase2-monitoring/titangold-telegram-notify.sh`

## 4. RCA (Overview content)

### Duplicated from shared shell (removed / not repeated)

- Operational status, Dry Run badge, Emergency Stop, Broker
- Total Scans, Best Qualified Profit, Qualified Opportunities (shell metrics row)
- Run Scan / Pause / Restart primary actions

### Genuinely useful (kept / elevated)

- Latest-scan completion time and humanized status
- Distinct spread / rejected / qualified counts with explanation
- Analytical interpretation (scan ≠ execution; candidate ≠ opportunity)
- Execution support = Not supported
- Rejection reason summary (humanized)
- Compact recent candidate preview
- Next-step navigation to Candidates / History / Settings

### Weak hierarchy (fixed)

- Flat KPI grid that competed with the shell
- Empty containers without guidance
- Raw rejection enums / weak empty copy

### Misleading / overly technical (fixed)

- Dry Run duplicated inside Overview
- Captured/realized profit wording that could be misread as a metric
- Raw backend status / enum leakage

## 5. Dependency Findings

| Layer | Dependency | Action |
|-------|------------|--------|
| UI | `DATAHUB_SHELL`, `DataHubSectionHeader`, `MetricCard`, `DataHubAlert`, `DataHubEmpty`, `StatusPill`, `SecondaryButton` | Reused |
| Shell | `AgentControlShell` | Unchanged |
| API | `GET /api/ai-agents/:id/details` via `fetchArbitrageAgentData` | Read path; error surfacing only |
| Contracts | WP1A candidateStats / qualifiedStats / riskStats / rejectionReason / legacy | Preserved |
| i18n | `deploy/{blue,green}/locales/{en,fa}.json` | Extended |

## 6. Source of Truth

- WP1A analytical spread monitor semantics remain authoritative
- Shell owns chrome metrics and Run Scan
- Overview answers: latest scan / why no qualified / what next
- Unknown → `N/A`; zero only when real; no fabricated duration/symbols/latency/realized profit

## 7. Architecture Decision

Overview is a **presentation-only** vertical slice:

1. Latest Scan (status + compact metrics with context)
2. Scan Outcome (distinct counts + why-no-qualified)
3. Analytical Interpretation + next steps
4. Recent Candidate Summary (preview only)

No new backend contracts. Frontend mapping only: humanize statuses/rejections; surface load errors as permission/auth/network/generic without raw status codes in UI.

## 8. Backend Changes

**NOT APPLICABLE** — no backend route/service changes.

## 9. Database Changes

**NOT APPLICABLE**

## 10. Redis/Cache Changes

**NOT APPLICABLE**

## 11. Security Changes

- Permission/auth Overview states fail closed (403/401)
- Generic API errors do not expose status codes or capability internals
- No Live / order / notification side effects introduced

## 12. Runtime/Worker Changes

**NOT APPLICABLE** — no worker/scheduler changes. Passive remains Demo + Emergency Stop.

## 13. Frontend Changes

- `components/ai/ArbitrageAgentControl.tsx` — Overview redesign
- `services/api.ts` — `fetchArbitrageAgentData` throws on failure (was swallowing nulls)
- Locales EN/FA (blue + green)
- Focused tests: `ArbitrageAgentControl.wp1b2a.overview.test.tsx`
- Minor regression assertion updates in WP1A / WP1B-1 status tests

## 14. UI/UX Redesign

Design-system matrix (engineering Browser QA evidence required for PASS):

| Item | Status |
|------|--------|
| Layout | PASS (Staging Browser QA) |
| Spacing | PASS |
| Cards | PASS |
| Typography | PASS |
| Badges | PASS |
| Loading | PASS |
| Empty State | PASS |
| Error State | PASS |
| Forms | N/A |
| Actions | PASS (navigation SecondaryButtons) |
| Confirmations | N/A |
| Accessibility | PASS (headings, labels, focusable actions) |
| Keyboard | PASS (shell preserved; Overview links reachable) |
| Responsive | PASS (desktop/tablet/mobile/landscape checked) |
| Dark Theme | PASS |
| i18n | PASS (EN/FA) |
| Overflow | PASS |
| Focus | PASS (no Overview focus trap regression vs shell) |

## 15. Tests

| Suite | Executed | Passed | Failed | Skipped | Env |
|-------|----------|--------|--------|---------|-----|
| `ArbitrageAgentControl.wp1a.test.tsx` | 6 | 6 | 0 | 0 | vitest/jsdom |
| `ArbitrageAgentControl.wp1b1.test.tsx` | 7 | 7 | 0 | 0 | vitest/jsdom |
| `ArbitrageAgentControl.wp1b1.status.test.tsx` | 3 | 3 | 0 | 0 | vitest/jsdom |
| `ArbitrageAgentControl.wp1b2a.overview.test.tsx` | 8 | 8 | 0 | 0 | vitest/jsdom |

**Total (focused closeout run):** 24 executed · 24 passed · 0 failed · 0 skipped · 0 retried  
**Retries:** not used  
**Environment:** Node vitest in isolated worktree `/tmp/titangold-arb-wp1b2a-overview`

Covered Overview states: completed latest scan, never-scanned, all-rejected, legacy rejection label, API error + retry, permission-limited, loading skeleton, EN/FA, navigation, no shell metric duplication, no raw rejection enum, N/A / no captured-profit claim.

## 16. Performance

| Metric | Result |
|--------|--------|
| Overview initial render baseline | **BASELINE NOT AVAILABLE** |
| Extra Overview API | None — reuses existing details payload |
| Polling added | None |
| DB/Redis diagnostics | None |

## 17. Browser QA

Staging `https://titan.zala.ir` after deploy.

| Item | Result |
|------|--------|
| Served bundle | `assets/index-WlHdPJwp.js` |
| Desktop Overview load + hierarchy | PASS |
| No shell metric duplication / no Dry Run dup | PASS |
| Navigation Review candidates / Scan history | PASS |
| Escape closes shell | PASS |
| Tablet / mobile portrait / mobile landscape | PASS |
| Persian Overview labels | PASS |
| Hard refresh | PASS |
| Dark theme | PASS |
| Console Overview-related errors | PASS |
| Runtime safety badges (Emergency Stop / Broker Offline) | PASS |

Automated Staging Playwright checks: **32/32 PASS**

Passive API runtime check (`/api/trading-engine/status`, `/api/settings/execution-runtime`):

- requestedMode / globalRuntimeMode / effectiveMode: `demo`
- killSwitchActive: `true`
- workerAcknowledged: `true`
- providerConnected: `false`
- deploymentEngineEnabled: `false`

Explicit negatives verified:

- No captured/realized profit metric
- No execution claim
- No negative candidate as opportunity
- No raw enum / raw i18n key in Overview
- No `--` placeholders
- Runtime safety unchanged (Demo, Emergency Stop active)

## 18. Human-QA Handoff

Human QA must explicitly PASS:

### ARB-O1 — Information Hierarchy
### ARB-O2 — Data Truthfulness
### ARB-O3 — Empty and Failure States
### ARB-O4 — Navigation and Usefulness
### ARB-O5 — Responsive, Language and Accessibility

## 19. Regression

- WP1A analytical contracts unchanged
- WP1B-1 shell frame unchanged
- Status presentation (one Dry Run in header) preserved
- Other Arbitrage tabs not redesigned (intentionally untouched)

## 20. Build/Deployment

- Production-style `vite build` from isolated worktree
- Sync to nginx root `/home/ubuntu/webapp/TitanGold/dist`
- Backend restart: **not required** (frontend-only)
- Migration: **none**

## 21. Files Changed

- `components/ai/ArbitrageAgentControl.tsx`
- `services/api.ts`
- `deploy/blue/locales/en.json`
- `deploy/blue/locales/fa.json`
- `deploy/green/locales/en.json`
- `deploy/green/locales/fa.json`
- `src/__tests__/components/ai/ArbitrageAgentControl.wp1b2a.overview.test.tsx`
- `src/__tests__/components/ai/ArbitrageAgentControl.wp1a.test.tsx`
- `src/__tests__/components/ai/ArbitrageAgentControl.wp1b1.status.test.tsx`
- `docs/ARBITRAGE_WP1B2A_OVERVIEW_CLOSEOUT.md`

## 22. Commits

Actual:

- `40f4c5f` — `feat(arb): redesign Overview around truthful scan outcomes`

- `400f449` — `docs(arb): record ARB-WP1B-2A Overview closeout evidence`

`origin/main` == `400f449` (docs closeout)
Runtime served from implementation commit `40f4c5f` / bundle `index-WlHdPJwp.js`

## 23. Git Verification

Recorded after push:

- Isolated worktree clean at `40f4c5f`
- `HEAD` == - `400f449` — `docs(arb): record ARB-WP1B-2A Overview closeout evidence`

`origin/main` == `400f449` (docs closeout)
Runtime served from implementation commit `40f4c5f` / bundle `index-WlHdPJwp.js`
- Original worktree `/home/ubuntu/webapp/TitanGold` remains dirty only for protected unrelated scripts

## 24. Remaining Risks

- Human QA not yet performed
- Other Arbitrage tabs still use older interior layouts
- History tab still contains pre-existing “realized/captured” denial copy (out of Overview scope)
- API error path depends on frontend throw behavior of `fetchArbitrageAgentData`

## 25. Final Verdict

**NEEDS MORE VERIFICATION** — pending explicit Human-QA PASS on ARB-O1 … ARB-O5.

## Rollback

1. Revert the ARB-WP1B-2A commit on `main`
2. Rebuild frontend and sync `dist/`
3. Confirm served bundle returns to prior hash (`index-D6ZmsjWR.js` or documented prior)

## Remaining Arbitrage tabs

- Candidates
- Scan History
- Profit & Risk
- Settings
- Integrations

Do **not** begin ARB-WP1B-2B until this slice is Human-QA PASS and CLOSED AND FROZEN.
