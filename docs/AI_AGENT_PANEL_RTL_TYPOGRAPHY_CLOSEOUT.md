# AI-FOUNDATION-R1 Closeout — Agent Panel RTL and Persian Typography

**Module:** AI Shared Foundation → Agent Control Panels  
**Work Package:** AI-FOUNDATION-R1  
**Date:** 2026-07-17  

## Final status (before Human QA)

| Item | Value |
|------|--------|
| Human QA | **NOT STARTED** — awaiting AI-RTL-1 … AI-RTL-4 |
| Engineering verdict | **NEEDS MORE VERIFICATION** |
| ARB-WP1B-2A | Remains open / not closed by this package |
| Return target after Human QA | **ARB-WP1A-R1** (Legacy read-path) — do not auto-start |

## Distinction

| Kind | Value |
|------|--------|
| **Runtime implementation commit** | `cecbe79` — `fix(ai-shell): inherit RTL and Persian typography in agent panels` |
| **Served frontend bundle** | `assets/index-CSyOLG24.js` |
| **Environment** | Staging `https://titan.zala.ir` |
| **Isolated worktree** | `/tmp/titangold-ai-rtl-typography` |
| **Branch** | `fix/ai-foundation-r1-rtl-typography` |

Suggested commit:

`fix(ai-shell): inherit RTL and Persian typography in agent panels`

---

## 1. Scope

Shared ownership only:

- `lang` / `dir` on AgentControlShell portal root
- Persian / Latin typography inheritance for portal content
- local LTR isolation helper for technical values
- shared focus / Escape / responsive behavior under correct direction

## 2. Out of Scope

Arbitrage Overview redesign; Candidates/History/Profit&Risk/Settings/Integrations; Data Hub; Agents Shell business redesign; backend/DB/Redis/worker; WP1A contracts; migrating other Agents’ business content; font file commits.

## 3. Repository Status

- Clean isolated worktree from `origin/main` @ `7b8d99e`
- Original `/home/ubuntu/webapp/TitanGold` remains dirty **only** for protected unrelated scripts
- Protected files untouched:
  - `scripts/backup-db.sh`
  - `scripts/phase2-monitoring/titangold-backup-healthcheck.sh`
  - `scripts/phase2-monitoring/titangold-telegram-notify.sh`

## 4. RCA

### User-visible symptom

With TitanGold in Persian, opening the Arbitrage Agent panel showed LTR ordering and Latin (`Inter`) typography, unlike the rest of the Persian app.

### Root cause

1. **Language SoT:** `LanguageContext` (`context/LanguageContext.tsx`) holds `language` (`en` | `fa`).
2. **Direction / font SoT for the main app:** `components/Dashboard.tsx` sets `dir={rtl|ltr}`, class `rtl`, and inline `fontFamily: IRANSans, Vazir, Tahoma, sans-serif` on its **page wrapper div** — not on `html`/`body`.
3. **Global CSS SoT** (`index.html`):
   - Latin: `body { font-family: "Inter", sans-serif; }`
   - Persian: `[dir="rtl"]`, `.rtl`, `[dir="rtl"] *` → `IRANSans, Vazir, Tahoma`
4. **Portal:** `AgentControlShell` uses `createPortal(..., document.body)`.
5. Portal content is a **sibling of** the Dashboard wrapper under `body`, so it did **not** inherit `dir` or the Persian font style.
6. Computed Staging evidence **before fix**:
   - App wrapper: `direction=rtl`, `font=IRANSans, Vazir, Tahoma, sans-serif`
   - Shell/overlay: `direction=ltr`, `font=Inter, sans-serif`, parent=`BODY`

This is a shared shell/portal defect, not an Overview-content defect.

### Why the fix addresses the cause

Portal overlay + dialog now explicitly receive `lang`, `dir`, class `rtl` (FA), and the same IRANSans stack as Dashboard from `useLanguage().language`. Descendants (including Overview) inherit direction and typography.

## 5. Dependency Findings

| Layer | Owner | Action |
|-------|--------|--------|
| Language | `LanguageContext` | Reused |
| App dir/font | `Dashboard.tsx` + `index.html` CSS | Mirrored on portal; no duplicate context |
| Shell | `AgentControlShell.tsx` | Fixed |
| Consumers | Currently **only** `ArbitrageAgentControl` | Benefits automatically; second agent key covered by unit harness |

## 6. Source of Truth

| Concern | Owner |
|---------|--------|
| Active language | `LanguageContext.language` |
| Canonical Persian font | `IRANSans, Vazir, Tahoma` via Dashboard + `index.html` |
| Canonical Latin font | `Inter` via `body` |
| Document `html lang` | Remains static `en` in `index.html` (pre-existing); portal sets its own `lang` |

No new LanguageContext, theme system, or font files.

## 7. Architecture Decision

- Keep portal target as `document.body` (viewport overlay / focus ownership unchanged).
- Make the **portal root** direction- and typography-aware.
- Export `AgentTechnicalLtr` for local `dir="ltr"` on symbols/ISO times/IDs.
- Shell last-run timestamp uses `AgentTechnicalLtr` when a real timestamp is shown.

## 8–12. Backend / DB / Redis / Security / Runtime

| Area | Result |
|------|--------|
| Backend | NOT APPLICABLE |
| Database | NOT APPLICABLE |
| Redis | NOT APPLICABLE |
| Security | Unchanged |
| Runtime | VERIFIED Demo + Kill Switch + broker offline |

## 13. Frontend Changes

- `components/ai/shell/AgentControlShell.tsx` — portal `lang`/`dir`/typography + `AgentTechnicalLtr`
- `src/__tests__/components/ai/shell/AgentControlShell.rtl.test.tsx` — focused foundation tests

## 14. UI/UX

Shared chrome only. No Arbitrage business redesign. Logical flex `justify-between` follows `dir`.

## 15. Tests

| Suite | Executed | Passed | Failed | Skipped | Env |
|-------|----------|--------|--------|---------|-----|
| `AgentControlShell.rtl.test.tsx` | 7 | 7 | 0 | 0 | vitest/jsdom |
| `ArbitrageAgentControl.wp1a.test.tsx` | 6 | 6 | 0 | 0 | vitest/jsdom |
| `ArbitrageAgentControl.wp1b1.test.tsx` | 7 | 7 | 0 | 0 | vitest/jsdom |
| `ArbitrageAgentControl.wp1b1.status.test.tsx` | 3 | 3 | 0 | 0 | vitest/jsdom |
| `ArbitrageAgentControl.wp1b2a.overview.test.tsx` | 11 | 11 | 0 | 0 | vitest/jsdom |

**Total:** 34 executed · 34 passed · 0 failed · 0 skipped  
**Environment:** `/tmp/titangold-ai-rtl-typography`, vitest `--pool=forks --maxWorkers=1`

## 16. Performance

BASELINE NOT AVAILABLE — no extra API/polling.

## 17. Browser QA (computed styles)

Staging after deploy of `assets/index-CSyOLG24.js`.

| Check | Result |
|-------|--------|
| FA app root | `rtl` + `IRANSans, Vazir, Tahoma` |
| FA shell / overlay | `lang=fa`, `dir=rtl`, computed `direction=rtl`, same IRANSans stack |
| FA h2 / button / Overview | IRANSans; Overview `direction=rtl` |
| Technical LTR | `agent-technical-ltr` `dir=ltr` |
| EN shell | `lang=en`, `dir=ltr`, `Inter` |
| Viewports 1440 / 768 / 390 / 844 | PASS |
| Escape / Tab / no overflow / console | PASS |

Automated Staging Playwright: **35/35 PASS**

Runtime:

- requestedMode / effectiveMode / globalRuntimeMode: `demo`
- killSwitchActive: `true`
- workerAcknowledged: `true`
- providerConnected: `false`
- deploymentEngineEnabled: `false`

## 18. Human-QA Handoff

See AI-RTL-1 … AI-RTL-4 below.

## 19. Regression

- WP1A / WP1B-1 / WP1B-2A overview unit suites green
- Six approved Arbitrage button variants unchanged (WP1B-1 suite)
- No backend restart

## 20. Build/Deployment

- `npm run build` from isolated worktree
- Sync to `/home/ubuntu/webapp/TitanGold/dist`
- Served bundle: `assets/index-CSyOLG24.js`
- Backend restart: not required

## 21. Files Changed

- `components/ai/shell/AgentControlShell.tsx`
- `src/__tests__/components/ai/shell/AgentControlShell.rtl.test.tsx`
- `docs/AI_AGENT_PANEL_RTL_TYPOGRAPHY_CLOSEOUT.md`

## 22–23. Commits / Git

- Runtime + initial docs: `cecbe79` on `origin/main`
- Documentation closeout HEAD may differ if a docs-only stamp follows
- Isolated worktree synchronized; original tree protected-dirty only

## 24. Remaining Risks

- Only Arbitrage currently mounts `AgentControlShell` in production UI; shared fix verified via second agent-key unit harness + Arbitrage Staging Browser QA
- `html[lang]` remains `en` at document root (pre-existing app pattern); portal sets its own `lang`
- Human QA not yet performed

## 25. Final Verdict

**NEEDS MORE VERIFICATION**

## Rollback

1. Revert the AI-FOUNDATION-R1 commit on `main`
2. Rebuild frontend and sync `dist/`
3. Confirm served bundle returns to prior hash (`index-DsAjAa6N.js` or documented prior)

## Return target

After Human QA PASS on AI-RTL-1…4 and closeout freeze: return to **ARB-WP1A-R1** (do not auto-start).
