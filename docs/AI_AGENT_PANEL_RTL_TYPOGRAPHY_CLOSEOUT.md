# AI-FOUNDATION-R1 Closeout — Agent Panel RTL and Persian Typography

**Module:** AI Shared Foundation → Agent Control Panels  
**Work Package:** AI-FOUNDATION-R1  
**Date:** 2026-07-17  

## Final status

| Item | Value |
|------|--------|
| Human QA | **PASS** — AI-RTL-1 … AI-RTL-4 explicit PASS |
| Engineering verdict | **REAL WORKING** |
| AI-FOUNDATION-R1 status | **CLOSED AND FROZEN** |
| Interrupted Arbitrage Overview (ARB-WP1B-2A) | **OPEN** (not closed by this package) |
| Next approved slice | **ARB-WP1A-R1 — Modern Scan Legacy Classification Repair** |
| Next slice implementation | **NOT STARTED** |

## Distinction

| Kind | Value |
|------|--------|
| **Runtime implementation baseline** | `cecbe79` — `fix(ai-shell): inherit RTL and Persian typography in agent panels` |
| **Pre-Human-QA documentation HEAD** | `2abdb3c` |
| **Documentation closeout HEAD** | *(this docs-only commit on `main`)* |
| **Served frontend bundle** | `assets/index-CSyOLG24.js` (unchanged by docs closeout; no rebuild) |
| **Environment** | Staging `https://titan.zala.ir` |
| **Isolated worktree** | `/tmp/titangold-ai-rtl-typography` |
| **Branch (implementation)** | `fix/ai-foundation-r1-rtl-typography` |

After `cecbe79`, only documentation commits update HEAD. Runtime code and served bundle remain those of `cecbe79` / `index-CSyOLG24.js`.

---

## Human QA

| Scenario | Result |
|----------|--------|
| AI-RTL-1 — Persian Direction | **PASS** |
| AI-RTL-2 — Persian Typography | **PASS** |
| AI-RTL-3 — English Regression | **PASS** |
| AI-RTL-4 — Responsive and Accessibility | **PASS** |
| **Final Human-QA verdict** | **PASS** |

### Confirmed Human behavior

- Persian `AgentControlShell` renders RTL
- Canonical TitanGold Persian font is used
- Header, status, tabs and Overview content are RTL
- Technical symbols and timestamps remain readable
- English remains LTR with the canonical Latin font
- Desktop, tablet and mobile layouts pass
- Keyboard, Escape and focus behavior pass
- No visible clipping or horizontal overflow

### Verified presentation contract

| Mode | `lang` | `dir` | Canonical font |
|------|--------|-------|----------------|
| Persian | `fa` | `rtl` | `IRANSans, Vazir, Tahoma` |
| English | `en` | `ltr` | `Inter` |

Also verified:

- Portal rendering inherits the intended language presentation
- Technical values remain locally readable (`AgentTechnicalLtr` / `dir="ltr"`)
- Responsive behavior (1440×900, 768×1024, 390×844, 844×390)
- Keyboard, Escape, focus trap, focus restoration
- No clipping / no horizontal overflow

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

- Clean isolated worktree: `/tmp/titangold-ai-rtl-typography`
- Original `/home/ubuntu/webapp/TitanGold` remains dirty **only** for protected unrelated scripts
- Protected files untouched (never staged/committed):
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

This was a shared shell/portal defect, not an Overview-content defect.

### Why the fix addressed the cause

Portal overlay + dialog explicitly receive `lang`, `dir`, class `rtl` (FA), and the same IRANSans stack as Dashboard from `useLanguage().language`. Descendants (including Overview) inherit direction and typography.

## 5. Dependency Findings

| Layer | Owner | Action |
|-------|--------|--------|
| Language | `LanguageContext` | Reused |
| App dir/font | `Dashboard.tsx` + `index.html` CSS | Mirrored on portal; no duplicate context |
| Shell | `AgentControlShell.tsx` | Fixed at `cecbe79` |
| Consumers | Currently **only** `ArbitrageAgentControl` in UI | Benefits automatically; second agent key covered by unit harness |

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
| Runtime | VERIFIED Demo + Kill Switch + broker offline (passive closeout re-check) |

## 13. Frontend Changes (runtime baseline `cecbe79`)

- `components/ai/shell/AgentControlShell.tsx` — portal `lang`/`dir`/typography + `AgentTechnicalLtr`
- `src/__tests__/components/ai/shell/AgentControlShell.rtl.test.tsx` — focused foundation tests

Documentation-only closeout does **not** modify runtime files and does **not** rebuild/redeploy.

## 14. UI/UX

Shared chrome only. No Arbitrage business redesign. Logical flex `justify-between` follows `dir`.

## 15. Tests (evidence)

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

## 17. Browser QA / computed-style evidence

Staging with served bundle `assets/index-CSyOLG24.js`.

| Check | Result |
|-------|--------|
| FA app root | `rtl` + `IRANSans, Vazir, Tahoma` |
| FA shell / overlay | `lang=fa`, `dir=rtl`, computed `direction=rtl`, same IRANSans stack |
| FA h2 / button / Overview | IRANSans; Overview `direction=rtl` |
| Technical LTR | `agent-technical-ltr` `dir=ltr` |
| EN shell | `lang=en`, `dir=ltr`, `Inter` |
| Viewports 1440 / 768 / 390 / 844 | PASS |
| Escape / Tab / no overflow / console | PASS |

Automated Staging Playwright (pre-Human-QA): **35/35 PASS**  
Human QA: **PASS** (AI-RTL-1 … AI-RTL-4)

## 18. Runtime safety (passive closeout)

- requestedMode / effectiveMode / globalRuntimeMode: `demo`
- killSwitchActive: `true`
- workerAcknowledged: `true`
- providerConnected: `false`
- deploymentEngineEnabled: `false`
- Live remains impossible
- No Run Scan / Pause / Restart / Save / provider side effects during closeout

## 19. Regression

- WP1A / WP1B-1 / WP1B-2A overview unit suites green at implementation time
- Six approved Arbitrage button variants unchanged (WP1B-1 suite)
- Data Hub CLOSED AND FROZEN — untouched
- Agents Shell CLOSED AND FROZEN — untouched
- No backend restart for docs closeout

## 20. Build/Deployment

- Runtime build/deploy completed for `cecbe79` → bundle `assets/index-CSyOLG24.js`
- Documentation closeout: **no rebuild, no redeploy, no PM2/Nginx change**

## 21. Files Changed

### Runtime (`cecbe79`)

- `components/ai/shell/AgentControlShell.tsx`
- `src/__tests__/components/ai/shell/AgentControlShell.rtl.test.tsx`

### Documentation

- `docs/AI_AGENT_PANEL_RTL_TYPOGRAPHY_CLOSEOUT.md` (`2abdb3c` stamp + this closeout commit)

## 22. Commits

| Commit | Role |
|--------|------|
| `cecbe79` | **Runtime implementation baseline** |
| `2abdb3c` | Pre-Human-QA documentation HEAD |
| *(this commit)* | Documentation closeout HEAD — `docs(ai-shell): close RTL and Persian typography foundation` |

## 23. Git Verification

- Path-scoped docs-only staging (no `git add .` / `-A` / `-a`)
- Protected scripts absent from commit
- No secrets / JWTs / tokens / credentials in documentation
- Isolated verification worktree clean after push
- Documentation HEAD equals `origin/main`
- Served runtime bundle still equals `assets/index-CSyOLG24.js`

## 24. Remaining Risks

- Only Arbitrage currently mounts `AgentControlShell` in production UI; shared fix remains authoritative for future consumers
- `html[lang]` remains `en` at document root (pre-existing app pattern); portal sets its own `lang`
- Interrupted ARB-WP1B-2A Overview remains OPEN pending its own Human-QA / closeout path
- ARB-WP1A-R1 remains NOT STARTED

## 25. Final Verdict

**REAL WORKING** — AI-FOUNDATION-R1 **CLOSED AND FROZEN**.

## Rollback

1. Revert runtime commit `cecbe79` on `main` (docs-only commits do not change runtime)
2. Rebuild frontend and sync `dist/`
3. Confirm served bundle returns to prior hash (`index-DsAjAa6N.js` or documented prior)

## Next approved slice (do not auto-start)

**ARB-WP1A-R1 — Modern Scan Legacy Classification Repair** — `NOT STARTED`
