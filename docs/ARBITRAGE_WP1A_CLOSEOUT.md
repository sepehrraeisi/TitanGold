# ARB-WP1A Closeout — Contract Repair, Truthful Analytical Mode and Scan History

**Module:** AI → Agents → Arbitrage Scanner  
**Work Package:** ARB-WP1A  
**Date:** 2026-07-16  
**Human QA:** ARB-A9 **PASS** (explicit Human confirmation)  
**Engineering verdict:** **REAL WORKING**  
**WP1A status:** **CLOSED AND FROZEN**  

**Arbitrage Agent status:** OPEN — additional slices remain.  
**ARB-WP1B status:** NOT STARTED  

**Runtime implementation HEAD:** `f4fd43a`  
**Served bundle:** `assets/index-kRpMtyAR.js`  

---

## 1. RCA (from discovery)

Confirmed Staging contradictions:

1. `Total Scans = 0` while `ai_decisions` had 12 `arbitrage_scan` rows — details used stale `ai_agents.total_decisions`.
2. `Net profit captured ≈ -$51` with empty execution history — mislabeled sum of estimated last-scan profits.
3. Negative net rows shown as opportunities / high-conviction.
4. Best profit hardcoded `0`; histories hardcoded `[]`.
5. Raw strategy keys `strategy_spot` / `strategy_triangle`.
6. Product claimed triangular / cross-exchange / futures / Auto Execute without implementation.

## 2. Architecture decisions

| Decision | Choice |
|----------|--------|
| Scan history SoT | `ai_decisions` where `decision_type = arbitrage_scan` |
| Last scan | Latest decision by `created_at`; `metadata.last_result` is denormalized cache only |
| Total scans | `COUNT(ai_decisions)` — **not** `ai_agents.total_decisions` (deprecated for Arbitrage) |
| Card count | Same COUNT via list aggregate (Agents Shell label still “Results” — shell frozen) |
| Current product mode | Analytical MEXC spot bid/ask **spread monitor** |
| Qualified opportunities | Always empty until proven multi-leg strategy exists |
| Execution / realized profit | Unsupported — not fabricated |
| Schema migration | None in WP1A |

## 3. Canonical definitions

- **Scan:** one persisted `arbitrage_scan` decision  
- **Spread Candidate:** analytical same-market condition with positive expected net above min threshold — **not** executable arbitrage  
- **Rejected Candidate:** failed qualification (e.g. `NON_POSITIVE_NET`, `BELOW_MIN_PROFIT`, …)  
- **Qualified Opportunity:** executable multi-leg arbitrage meeting all WP rules — **none in WP1A**  
- **Missing values:** `N/A` / `null` — never `--` or fake `0.0%`  
- **Risk score:** 0–100 score unit (not %)

## 4. API contract (ARB-WP1A)

### GET `/api/v1/ai-agents` (arbitrage row)

- `decisions` / `totalScans` = canonical scan count  
- `lastUpdate` = last scan completion time  

### GET `/api/ai-agents/:id/details` (arbitrage)

- `metrics.scanStats`, `candidateStats`, `qualifiedStats`, `riskStats`  
- `metrics.netProfitCapturedUSDT = null` (removed meaning)  
- `execution.supported = false`  
- `lastScan` normalized (candidates / rejected / qualified)  
- no `executionHistory` / `opportunityHistory` arrays  

### GET `/api/ai-agents/:id/scan-history?page=&pageSize=`

- Paginated history from `ai_decisions`  
- Auth + `AI_AGENT_READ`  
- Legacy rows normalized at read time  

### POST run

- Same service contract for manual and scheduler  
- Persists one decision; does not invent realized profit  

## 5. Legacy data

Existing 12 decisions preserved. Negative legacy “opportunities” reclassified as rejected (`LEGACY_NEGATIVE_ESTIMATE`) at read time. No destructive backfill.

## 6. Unsupported capability decisions

Disabled / labeled Not available:

- Triangular, cross-exchange, futures scanning  
- Auto Execute (stored preference preserved, not operational)  
- Settlement / transfers  
- Binance / Gate as active integrations  
- Execution history / captured profit  

## 7. Provider

Replaced hardcoded `localhost:5002` with `INTERNAL_API_BASE` or `http://127.0.0.1:${PORT||5002}`.

## 8. Market proxy security note

`/api/market/mexc/*` is reachable via public Nginx `/api/` → `:5002`. Public-read market data. **Foundation Work Package recommended** for auth/rate-limit hardening — out of ARB-WP1A scope.

## 9. Runtime mismatch note

Process health commit was `d17fd8e` while repo HEAD advanced for Agents Shell docs/UI. Arbitrage backend files were **identical** between `d17fd8e` and pre-WP1A `origin/main`. WP1A backend deploy requires backend PM2 reload.

## 10. Protected unrelated files

Never touched:

- `scripts/backup-db.sh`  
- `scripts/phase2-monitoring/titangold-backup-healthcheck.sh`  
- `scripts/phase2-monitoring/titangold-telegram-notify.sh`  

## 11. Tests / performance / deploy

Filled at closeout time in the final report.

## 12. Human-QA scenarios

ARB-A1 … ARB-A8 as specified in the Work Package (pending human execution).

### ARB-A9 — Button Design-System Compliance (Human-QA remediation)

**Human-QA defect (FAIL):** six action buttons did not match TitanGold Design System  
(`Run Scan`, `Close`, `Pause`, `Restart`, `Reset`, `Save changes`).

**RCA:** Arbitrage panel used one-off Tailwind (green primary, rectangular `rounded-lg` / `rounded-md`, slate filled Close) instead of shared Data Hub button tokens (`PrimaryButton` / `SecondaryButton` / `BTN_WARNING` / `BTN_ACTION_BLUE`).

**Canonical variants applied:**

| Control | Variant | Token / component |
|---------|---------|-------------------|
| Run Scan | Primary purple, pill | `PrimaryButton` / `BTN_PRIMARY` |
| Save changes | Primary purple, pill | `PrimaryButton` / `BTN_PRIMARY` |
| Close | Neutral outline, pill | `SecondaryButton` / `BTN_SECONDARY` |
| Reset | Neutral outline, pill | `SecondaryButton` / `BTN_SECONDARY` |
| Pause | Amber warning, pill | `BTN_WARNING` |
| Restart | Blue secondary, pill | `BTN_ACTION_BLUE` |

**Shared foundation:** exported `BTN_ACTION_BLUE`, `BTN_WARNING`, `FOCUS_RING` from `dataHubUi.tsx` (no Arbitrage-only button CSS).

**Interaction preservation:** handlers unchanged; pending refs prevent double Run Scan / Pause / Restart / Save; Reset/Save disabled when not dirty.

**Automated tests:** `src/__tests__/components/ai/ArbitrageAgentControl.wp1a.test.tsx` — 6 passed (WP1A + ARB-A9).

**Browser QA (staging `https://titan.zala.ir`, supporting evidence):**

| Control | Visual | Hover classes | Focus utility | Disabled | Loading | Action |
|---------|--------|---------------|---------------|----------|---------|--------|
| Run Scan | Primary purple pill VERIFIED | PASS | PASS (`focus-visible:ring`) | PASS | PASS (pending guard) | PASS |
| Close | Neutral outline pill VERIFIED | PASS | PASS | N/A | N/A | PASS |
| Pause | Amber warning pill VERIFIED | PASS | PASS | PASS | PASS (`aria-busy`) | PASS |
| Restart | Blue secondary pill VERIFIED | PASS | PASS | PASS | PASS | PASS |
| Reset | Neutral outline pill VERIFIED | PASS | PASS | PASS (not dirty) | N/A | PASS |
| Save changes | Primary purple pill VERIFIED | PASS | PASS | PASS (not dirty) | PASS | PASS |

- EN + FA labels verified (no raw keys); FA examples: اجرای اسکن / بستن / توقف / راه‌اندازی مجدد / بازنشانی / ذخیره تغییرات  
- Served bundle: `assets/index-kRpMtyAR.js`  
- Runtime: Effective Mode Demo, Emergency Stop active, worker acknowledged true  
- No Live enable / no Kill Switch clear / no external side effects in this remediation  

**Commits:**

- `45f5488` — `fix(arb): align WP1A actions with TitanGold design system`  
- `71d5f69` — `fix(arb): use loading i18n for pending Pause/Restart labels`  
- `cfaf954` — `fix(arb): stack WP1A status actions cleanly on narrow viewports`  
- `f4fd43a` — `docs(arb): record ARB-A9 button design-system remediation evidence`  

**Human-QA decision:** **ARB-A9 = PASS** (explicit Human confirmation of all six controls).

## 13. Shared Design-Token Baseline Verification (post ARB-A9 PASS)

### Classification: **Case A — Safe additive shared-token extension**

`git diff 1a3955f..f4fd43a -- components/ai/AIManager/tabs/DataHub/dataHubUi.tsx`:

- Lines added: **11**  
- Lines removed: **3** (private `FOCUS_RING` relocated to exported constant with **identical** class string)  
- Existing exports modified: **none** (`BTN_PRIMARY`, `BTN_SECONDARY`, outline tokens unchanged)  
- Existing class values modified: **none**  
- Existing shared components modified: **none** (`PrimaryButton` / `SecondaryButton` still compose the same tokens)  
- New exports: `BTN_ACTION_BLUE`, `BTN_WARNING`, `FOCUS_RING` (promotion of previously private focus utility)  
- Arbitrage-specific naming in shared owner: **none** — tokens follow `DESIGN_SYSTEM_DATAHUB.md` §6.2 / §2.3  

Data Hub business/runtime files under `components/ai/AIManager/tabs/DataHub/**` unchanged except this token file.  
Agents Shell files (`AIAgents`, `AgentCard`, `AgentSafetyBanner`, `shell/*`) unchanged (0 files).

### Token-consumer matrix (verified)

| Token | Defined In | Existing Consumers | New Consumers | Existing Behavior Changed? |
|-------|------------|--------------------|---------------|----------------------------|
| `BTN_PRIMARY` | `dataHubUi.tsx` | Data Hub panels/modals; Agents `AgentCard` / shell | Unchanged usage; Arbitrage via `PrimaryButton` | No |
| `BTN_SECONDARY` | `dataHubUi.tsx` | Data Hub panels/modals; Agents `AIAgents` retry | Unchanged usage; Arbitrage via `SecondaryButton` | No |
| `BTN_WARNING` | `dataHubUi.tsx` (new) | none | Arbitrage Pause | N/A (additive) |
| `BTN_ACTION_BLUE` | `dataHubUi.tsx` (new) | none | Arbitrage Restart / Start | N/A (additive) |
| `FOCUS_RING` | `dataHubUi.tsx` (exported; value identical to prior private) | Segmented control / PrimaryButton / SecondaryButton / inputs (in-file) | Arbitrage Pause/Restart wrapper | No (same string) |

No Arbitrage-only parallel button system. No Data Hub → Arbitrage imports. No circular dependency.

### Closed-baseline regression

**Data Hub (Telegram Collector) — Staging Browser QA:** PASS  
- Primary purple pills (e.g. Start Login Wizard / شروع ویزارد ورود)  
- Secondary slate outline (Refresh health / به‌روزرسانی سلامت)  
- Outline amber/sky/red retained  
- EN + FA, dark theme, desktop, no overflow on panel, no console errors from token change  

**Agents Shell — Staging Browser QA + unit tests:** PASS  
- Page renders; 15 cards; search/filter/sort present  
- Open Agent remains purple Primary pill (`باز کردن عامل`)  
- Safety banner Dry Run / Emergency Stop intact  
- Unit: `AIAgents.test.tsx` 14 passed; `AgentCard.test.tsx` 17 passed  

**Arbitrage buttons on served bundle:** VERIFIED (same `assets/index-kRpMtyAR.js`)

### Runtime safety (closeout check)

- Effective Mode: Demo  
- Emergency Stop: active  
- workerAcknowledged: true  
- Live: impossible  

### Protected unrelated files (still dirty only in original worktree; never committed)

- `scripts/backup-db.sh`  
- `scripts/phase2-monitoring/titangold-backup-healthcheck.sh`  
- `scripts/phase2-monitoring/titangold-telegram-notify.sh`  

## 14. Remaining Arbitrage slices

- **ARB-WP1B:** AgentControlShell + full professional redesign — **NOT STARTED** (do not begin automatically)  
- Later: real multi-leg strategies only with proven executable contracts  
- Foundation: market-proxy exposure hardening  

## 15. Rollback

```bash
git revert <WP1A_COMMITS>
# rebuild frontend, reload titan-backend
```

No schema migration to roll back.
