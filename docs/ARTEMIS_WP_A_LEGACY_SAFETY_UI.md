# ARTEMIS WP-A — Legacy Safety Containment + Specialized UI/UX Redesign

**Status:** OWNER HUMAN QA PASS — PRE-PR CLOSEOUT / REVIEW EVIDENCE (not CLOSED)  
**Classification:** Shared Foundation implementation  
**Foundation baseline (closed):** `01e461634c6910bad795a2c3c3b506ecf2c343df`  
**Branch:** `feat/artemis-wp-a-legacy-safety-ui`  
**Worktree:** `/home/ubuntu/worktrees/titangold-artemis-wp-a`

## 1. Outcome

Contain legacy Artemis advisory so no caller can treat it as v4.5 execution approval, and redesign Artemis as a truthful Central Intelligence product surface for current maturity (LEGACY_ADVISORY).

## 2. Needs-assessment findings (touched surfaces)

| Area | User goal | Decision | Notes |
|------|-----------|----------|-------|
| AI Center nav label | Find Artemis | RENAME | Visible `AI Manager` → `Artemis`; id `manager` kept |
| AI Center tabs | Reach Artemis/Agents/Data Hub/Training/Analytics/Integrations/Topic Routing | REDESIGN | Data Hub restored as first-class AI Center product |
| Data Hub | Completed data foundation must remain reachable | MOVE / REHOME | Canonical owner: AI Center → Data Hub; not an Artemis subsection |
| Artemis shell | Maturity + safety at a glance | REDESIGN | Requested/Effective mode separate; no Demo↔Real toggle |
| Overview | “What can Artemis do now?” | REDESIGN | Readiness, Runtime Safety, Intelligence Inputs, Control Chain, Limitations |
| Evidence | Contract readiness | ADD FEATURE (truthful unavailable) | No fake EvidenceEnvelope |
| Decisions | Advisory vs execution | REDESIGN | Legacy Advisory + executionEligible=No |
| Orchestration | Real coordination? | REDESIGN | Legacy Orchestration / canonical UNAVAILABLE |
| Controls | Control-chain visibility | ADD/REDESIGN | Risk veto explicit; not a trading panel |
| Lineage & Audit | Audit truth | REDESIGN | Separate current sources vs canonical readiness |
| System & Integrations | Dependency ownership | REDESIGN + LINK | Link Decision Engine / Connections; Data Hub as external dependency with Open Data Hub |
| Autopilot | Not product-ready | HIDE / Legacy Admin gate | ConfirmModal; no native dialogs |
| Insights widget | Reachable dashboard | REDESIGN | Readiness-backed; no confidence 87 |
| Decision Engine / Learning / Backtesting / Data Hub / Logs / Settings / Monitoring / Scenarios | Ownership | LINK / MOVE / RETIRE from Artemis nav | Backend retained; not in canonical Artemis nav |
| POST `/artemis/decision` | Safety | CONTAIN | Additive advisory fields; TE fail-closed |

## 3. Final AI Center menu architecture

1. Artemis (`manager`) — Central Intelligence
2. Agents — Specialized Intelligence
3. Data Hub (`data_hub`) — Data Foundation (first-class)
4. Training — Model/Agent Training
5. Analytics — Evaluation / analytics
6. Integrations (`config`) — AI/provider configuration
7. Topic Routing — routing capability

Deep link: `?view=ai&aiTab=data_hub`  
Legacy compatibility: `?view=ai&subtab=data_hub` and `?view=ai&artemisSection=data_hub` → AI Center Data Hub.

## 4. Final Artemis IA

1. Overview  
2. Evidence  
3. Decisions  
4. Orchestration  
5. Controls  
6. Lineage & Audit  
7. System & Integrations  
8. Legacy Admin (explicit gate only; not product Autopilot)

Deep link: `?artemisSection=<id>` (compat: `subtab`).

## 5. Backend safety changes

- `artemisDecisionContainment.js` — wraps all decision responses
- Schema requires `executionEligible:false`, `approvedForExecution:false`, `LEGACY_ADVISORY_ONLY`
- `GET /api/v1/artemis/readiness` — read-only aggregation
- `tradingEngine.js` — `/api/v1/artemis/decision`; requires both eligibility flags; fail-closed fallback

## 6. Side-effect ledger (expected)

private provider calls=0 · orders=0 · transfers=0 · withdrawals=0 · financial=0 · Scheduler mutations=0 · worker topology=0 · migrations=0 · Live=0

## 7. Tests

- Backend unit: containment, readiness, TE gate
- Frontend vitest: AI Center label, sections, Insights, deep link, FA RTL, no Autopilot product nav, no fake metrics
- Frontend vitest: first-class Data Hub nav, single owner, legacy `data_hub` deep links, Artemis → Open Data Hub, urlSync `aiTab`

## 7.1 Centralization rule

Centralization must never make an already-completed product unreachable.

When moving a feature out of Artemis, BEFORE removing the old primary navigation:

1. identify canonical new owner
2. implement canonical new route/navigation
3. verify feature parity
4. preserve compatible deep links
5. then retire the old navigation

No completed product may become orphaned. A textual link is not enough.

## 8. Staging / Human QA

See checklist below. WP-A must not close until Owner Human QA PASS.

### Owner Human QA checklist

- [ ] Menu architecture (AI Center + Artemis IA)
- [ ] Visual hierarchy / maturity clarity
- [ ] Safety status (Requested/Effective/Kill Switch/Eligibility)
- [ ] Evidence readiness truthful
- [ ] Decision semantics (not “Approved for Execution”)
- [ ] Controls chain (Risk veto)
- [ ] Orchestration truthfulness
- [ ] Lineage usefulness
- [ ] System/integration ownership links
- [ ] Data Hub first-class AI Center tab (not buried under Artemis)
- [ ] Data Hub product parity (Sources/Categories/Pipeline/Health/Logs/Advanced/Telegram)
- [ ] EN / FA / RTL
- [ ] Mobile / tablet
- [ ] Overall product quality

## 9. Known limitations

- Canonical evidence/orchestration/lineage not implemented (WP-B/C/D)
- Liquidity control blocked
- Dual Decision Engine config owners
- Dual `titan-engine-worker` deploy guard deferred
- Legacy tabs retained in codebase but out of canonical Artemis nav
- Autopilot remains available only behind Legacy Admin gate

## 10. Verdict (pre–Human QA target)

**ARTEMIS WP-A — IMPLEMENTED ON STAGING · READY FOR OWNER HUMAN QA**


## 11. Staging evidence (2026-08-07)

| Item | Value |
|------|-------|
| Branch | `feat/artemis-wp-a-legacy-safety-ui` |
| Implementation HEAD | `32a65e49ae890838fc532930ad0a03f2ed1efe82` (`32a65e4`) |
| Runtime commit | `32a65e4` (`provenanceVerified=true`) |
| Deploy method | Guarded script aborted (dual `titan-engine-worker`); controlled **titan-backend-only** restart |
| Served bundle | `index-BW_Un-M9.js` (matches worktree dist) |
| Worker before | id4 pid=1639616 ↺=0; id8 pid=1639645 ↺=0 |
| Worker after | id4 pid=1639616 ↺=0; id8 pid=1639645 ↺=0 |
| Backend tests | 8/8 PASS (containment, readiness, TE gate) |
| Frontend tests | 9/9 PASS (`ArtemisWpA.test.tsx`) |
| Production build | PASS |
| Native dialogs (WP-A Autopilot chunk) | 0 |
| Artemis Insights fake confidence | Removed (readiness-backed) |
| Side effects | private=0 orders=0 transfers=0 withdrawals=0 scheduler mutations=0 workers=0 migrations=0 Live=0 |
| Draft PR | BLOCKED — `gh` token invalid; branch pushed for Owner to open Draft PR |

## 12. Pre–Human QA verdict

**ARTEMIS WP-A — IMPLEMENTED ON STAGING**  
**READY FOR OWNER HUMAN QA**

Not CLOSED.

## 13. Data Hub navigation correction (Owner QA blocker)

| Item | Value |
|------|-------|
| Previous path | Artemis tab `data_hub` inside AI Manager |
| Canonical path | AI Center → Data Hub (`data_hub`) |
| Compatibility | `subtab=data_hub` / `artemisSection=data_hub` / `aiTab=data_hub` |
| Artemis reference | System & Integrations → Open Data Hub (external dependency, not embedded) |
| Data Hub files deleted | 0 |
| Data Hub functionality removed | 0 |
| Data Hub backend/API changed | 0 |
| Duplicate owner | No — `DataHubWorkspace` wraps existing `DataHubTab` only |
| Implementation HEAD | `06561cf0c4e97586d29f7e1386336fd83705f5e3` (`06561cf`) |
| Backend runtime | `32a65e4` (unchanged; frontend-only correction) |
| Served bundle | `index-CMh5A4K9.js` |
| Data Hub chunk | `DataHubWorkspace-CSVuQGC4.js` (lazy) |
| Workers before/after | id4 pid=1639616 ↺=0; id8 pid=1639645 ↺=0 |
| Frontend tests | 16/16 PASS (`ArtemisWpA.test.tsx`) |
| urlSync regression | 11/11 PASS |
| Production build | PASS |
| Side effects | private=0 orders=0 transfers=0 withdrawals=0 scheduler=0 workers=0 migrations=0 Live=0 |

## 14. Verdict after Data Hub rehome

**ARTEMIS WP-A — DATA HUB NAVIGATION REGRESSION CORRECTED**  
**READY FOR OWNER HUMAN QA**

Not CLOSED.

## 15. Legacy AI Manager salvage audit (read-only)

Audit date: 2026-08-08  
Branch HEAD at audit: `cd1cb55972f36da62cc6d47fa1544e3664c58fde` (docs may advance after this section)  
Scope: former AIManager tabs only. No tab restoration. No backend/deploy.

Approved AI Center nav (unchanged):

1. Artemis  
2. Agents  
3. Data Hub  
4. Training  
5. Analytics  
6. Integrations  
7. Topic Routing  

### 15.1 Matrix

| Former area | Value | Current owner | Reachable? | Disposition |
|-------------|-------|---------------|------------|-------------|
| Overview | High (truthful readiness, not old synthetic metrics) | Artemis → Overview | Yes | **A PRESERVED IN ARTEMIS** (redesigned `ArtemisSections.OverviewSection`). Legacy `OverviewTab.tsx` unimported. |
| Decision Engine | High (config) | Settings → Configuration → Decision Engine | Yes | **B REHOMED**. Artemis System/Controls link only. Legacy `DecisionEngineTab.tsx` is a dead redirect, unimported. |
| Orchestration | Low as mock UI; high as truthful unavailability | Artemis → Orchestration | Yes (truthful unavailable) | **D LEGACY / SUPERSEDED**. Do not restore `OrchestrationTab.tsx` (`GET /api/v1/artemis/orchestration` + mock-style task/resource UI). Unimported. |
| Learning | Medium–high unique (decision mistakes/improvements) | None in current nav; intended Training | No UI | **C FUTURE REHOME** → AI Center → Training. Not an Artemis tab. See §15.2. |
| Monitoring | Medium (runtime status vs config) | Artemis Overview/System (runtime) + Settings → Configuration → Monitoring (config) | Yes | **A + B**. Legacy `MonitoringTab.tsx` is a dead redirect, unimported. |
| Trading Scenarios | Medium workflow; IndexedDB + synthetic backtest coupling | None in current nav; intended Analytics/Evaluation | No UI | **C FUTURE REHOME** → Analytics/Evaluation after truthfulness review. See §15.2. |
| Data Hub | High completed product | AI Center → Data Hub | Yes | **B REHOMED**. Canonical `DataHubWorkspace` → `DataHubTab`. |
| Backtesting | Low as current UI (client `Math.random` + IndexedDB); backend `backtest_runs` also simulated | None in nav; intended Analytics | No UI | **D LEGACY / SUPERSEDED** for current UI; **C FUTURE REHOME** only after a truthful engine. See §15.2. Do not restore into Artemis. |
| System Logs | Medium audit browser (filters/pagination) | Artemis → Lineage & Audit (legacy decision logs subset) | Partial | **A** for Artemis-specific logs already in Lineage. **C FUTURE REHOME** of full log browser into Lineage (not a new Artemis tab). `SystemLogsTab.tsx` unimported. |
| Settings | High where canonical | Settings (Configuration / Connections / runtime) | Yes | **B REHOMED**. Legacy `SettingsTab.tsx` unimported (mostly redirects + unreachable Scheduler subpanel). |
| Autopilot | Low at current maturity; admin-only | Artemis → Legacy Admin gate | Yes (gated) | **A PRESERVED** as Legacy Administrative / Not Automated-Trading Ready / Not Live. |

`SchedulerSettings.tsx` is only mounted from dead `SettingsTab` / `ArtemisComponents.tsx`. Arbitrage Integrations already shows scheduler status for the allowlisted agent. Do **not** restore 24/7 scheduler toggles into Artemis. Future owner: Settings/runtime (separate WP; WP-A forbids scheduler mutation).

`ArtemisComponents.tsx`: filename-only, not production-imported. Do not revive.

### 15.2 Learning / Backtesting / Scenarios detail

#### Learning

| Item | Finding |
|------|---------|
| Frontend | `components/ai/AIManager/tabs/LearningTab.tsx` (unimported) |
| Backend/API | `GET /api/v1/artemis/learning`; `PATCH /api/artemis/learning/mistake/:id/mark-learned` |
| Persistence | PostgreSQL `ai_learning_events` |
| Production reachability | **No** (no AIManager/Training import) |
| Unique useful functionality | Yes: decision-derived improvements/mistakes, mark-learned. Native `alert` still present. |
| Equivalent in Training? | **No.** TrainingCenter owns sessions/agents/recommendations/history/config via `/api/v1/training/*`. |
| Recommended owner | AI Center → Training (or Evaluation), not Artemis |
| Future WP justified? | Yes — Training productization: absorb learning events without duplicating Artemis nav |

#### Backtesting

| Item | Finding |
|------|---------|
| Frontend | `components/ai/AIManager/tabs/BacktestingTab.tsx` (unimported) |
| Backend/API | UI uses `services/api.ts` `runBacktest` / `fetchBacktestResults` (**IndexedDB** + **`Math.random` simulation**). Separate unused `backend/routes/backtest.js` (`backtest_runs`) also simulates. |
| Persistence | IndexedDB `settings.backtest_results` (UI); unused PG `backtest_runs` |
| Production reachability | **No** |
| Unique useful functionality | Run/history UX idea only; **not truthful**. Must not be shown as real evaluation. |
| Equivalent in Analytics? | **No.** AnalyticsDashboard is agent accuracy/trends/comparison via `/api/v1/analytics/overview`. Training only has a “require backtest” config checkbox. |
| Recommended owner | Analytics/Evaluation **after** a truthful backtest engine exists |
| Future WP justified? | Yes, but not a restore of this tab. Do not put synthetic backtest in Artemis. |

#### Trading Scenarios

| Item | Finding |
|------|---------|
| Frontend | `components/ai/AIManager/tabs/ScenariosTab.tsx` (unimported) |
| Backend/API | UI uses IndexedDB `fetchTradingScenarios` / `generateAITradingScenario`. Unused `backend/routes/scenarios.js`. |
| Persistence | IndexedDB `settings.trading_scenarios` (UI); unused PG `trading_scenarios` |
| Production reachability | **No** |
| Unique useful functionality | Scenario CRUD + AI generate + trigger backtest. Coupled to synthetic backtest. Native dialogs present. |
| Equivalent in Analytics? | **No.** PricePrediction agent has a local “scenarios” view of a prediction, not this product. |
| Recommended owner | Analytics / Simulation / Evaluation after SoT + truthfulness review |
| Future WP justified? | Yes — rehome or retire after deciding IndexedDB vs PG owner. Not an Artemis tab. |

### 15.3 Salvage verdict

No completed product remains orphaned from **canonical navigation** after Data Hub rehome.

No **required Artemis tab** is missing: Overview, Orchestration (truthful), Controls, Lineage, System, Legacy Admin Autopilot are present; Decision Engine/Monitoring/Settings are linked to Settings; Data Hub is first-class in AI Center.

Learning / Scenarios / truthful Backtesting are **future rehomes outside Artemis**, not reasons to restore legacy Manager clutter.

**LEGACY AI MANAGER SALVAGE AUDIT — PASS**  
**NO REQUIRED ARTEMIS TABS MISSING**  
**OWNER ACCEPTED — 2026-08-08**

Do not restore any former AIManager tabs into Artemis or AI Center navigation.

## 16. Future rehome backlog (out of WP-A)

Accepted by Owner. Record only. **Do not implement in WP-A.**

| ID | Capability | Future owner | Gate |
|----|------------|--------------|------|
| FR-1 | Learning (decision mistakes / improvements / mark-learned; `ai_learning_events`) | AI Center → Training specialization / consolidation | Separate Training WP. Not an Artemis tab. |
| FR-2 | Trading Scenarios (CRUD / generate; IndexedDB today) | Analytics / Evaluation / Simulation | Separate WP after Source-of-Truth review. Not an Artemis tab. |
| FR-3 | Backtesting | Analytics / Evaluation | Only after a truthful canonical backtesting engine **and** persistence owner are proven. Current IndexedDB + `Math.random` UI must not be restored. |
| FR-4 | Full System Log browser | Artemis → Lineage & Audit enhancement | Only if operationally justified. Current Lineage already shows Artemis-specific legacy decision logs. Not a new Artemis nav tab. |

`SchedulerSettings` remains out of Artemis. Any 24/7 scheduler toggle UI is a separate Settings/runtime WP (WP-A forbids scheduler mutation).

## 17. Owner Human QA prep (current Staging)

Environment: **Staging** `https://titan.zala.ir` (not Production)  
Health: `status=ok` · `commit=32a65e4` · `runtimeCommit=32a65e4` · `provenanceVerified=true`  
Served frontend bundle: `index-CMh5A4K9.js` (Data Hub first-class rehome)  
Data Hub chunk: `DataHubWorkspace-CSVuQGC4.js`  
Docs HEAD (this handoff): recorded after commit  
Workers: unchanged (no restart for this docs-only prep)  
Deploy for this prep: **none** (documentation only)

Entry: `https://titan.zala.ir/?view=ai`

### 17.1 AI Center navigation (must remain exactly this order)

| Check | Deep link | Pass? |
|-------|-----------|-------|
| Artemis visible | `?view=ai&aiTab=manager` | ☐ |
| Agents visible | `?view=ai&aiTab=agents` | ☐ |
| Data Hub visible and fully reachable | `?view=ai&aiTab=data_hub` | ☐ |
| Training visible | `?view=ai&aiTab=training` | ☐ |
| Analytics visible | `?view=ai&aiTab=analytics` | ☐ |
| Integrations visible | `?view=ai&aiTab=config` | ☐ |
| Topic Routing visible | `?view=ai&aiTab=topic_routing` | ☐ |
| Browser Back / Forward works across AI tabs | history after switching tabs | ☐ |

Former Manager tabs must **not** appear in this nav: Learning, Trading Scenarios, Backtesting, Decision Engine, Monitoring, System Logs, Settings, Orchestration-as-product, Autopilot-as-product.

### 17.2 Artemis sections

| Check | Deep link | Pass? |
|-------|-----------|-------|
| Overview | `?view=ai&aiTab=manager&artemisSection=overview` | ☐ |
| Evidence | `&artemisSection=evidence` | ☐ |
| Decisions | `&artemisSection=decisions` | ☐ |
| Orchestration | `&artemisSection=orchestration` | ☐ |
| Controls | `&artemisSection=controls` | ☐ |
| Lineage & Audit | `&artemisSection=lineage` | ☐ |
| System & Integrations | `&artemisSection=system` | ☐ |
| Legacy Admin gate (not product Autopilot) | `&artemisSection=legacy_admin` | ☐ |

### 17.3 Visual / truthfulness (Artemis)

| Check | Pass? |
|-------|-------|
| No misleading Live / Real activation | ☐ |
| Legacy Advisory is clear | ☐ |
| Not Execution Eligible is clear | ☐ |
| Emergency Stop is clear | ☐ |
| No fake metrics | ☐ |
| No fake confidence | ☐ |
| No fake orchestration (unavailable is truthful) | ☐ |
| Unavailable states are understandable | ☐ |
| No native dialogs (`alert` / `confirm` / `prompt`) in canonical Artemis | ☐ |
| Layout professional — not warning-box overload | ☐ |

### 17.4 Data Hub (first-class; do not rewrite)

Owner: AI Center → Data Hub (`DataHubWorkspace` → existing `DataHubTab`).  
Artemis System → **Open Data Hub** is a link only.

| Check | Pass? |
|-------|-------|
| Sources | ☐ |
| Categories | ☐ |
| Pipeline | ☐ |
| Health | ☐ |
| Logs | ☐ |
| Advanced | ☐ |
| Telegram | ☐ |
| No functionality lost after rehome | ☐ |

### 17.5 Layouts

| Check | Pass? |
|-------|-------|
| EN desktop LTR | ☐ |
| FA RTL desktop | ☐ |
| Mobile portrait | ☐ |
| Tablet sanity | ☐ |

### 17.6 Explicit out of Human QA / WP-A

- Do not restore Learning / Scenarios / Backtesting / full System Logs
- Do not implement FR-1…FR-4
- Do not modify Data Hub product code
- Do not change Scheduler / workers
- Do not Live-activate
- Do not private provider calls
- Do not mark WP-A **CLOSED** from this prep

Owner records PASS or FAIL against this checklist. Cursor must wait for **explicit Owner Human QA PASS**.

## 18. Owner Human QA result (2026-08-08)

| Surface | Verdict |
|---------|---------|
| Data Hub | **PASS** — out of scope; do not touch |
| Artemis | **FAIL** — skeletal / engineering language / insufficient specialized UX |

WP-A remains OPEN. No closeout PR.

## 19. Specialized tab redesign — needs assessment (before implementation)

Truth classes used below: MEASURED · PERSISTED · DERIVED · CONFIGURED · LEGACY · UNAVAILABLE.

### 19.1 Final Artemis IA (unchanged names; Legacy Admin removed from primary nav)

1. Overview  
2. Evidence  
3. Decisions  
4. Orchestration  
5. Controls  
6. Lineage & Audit  
7. System & Integrations  

Legacy Admin: **not a primary tab**. Admin-only status disclosure under System → Administrative / Legacy Tools. Autopilot Enable / Run Once UI hidden at current maturity; backend capability preserved.

No tabs merged or renamed.

### 19.2 Overview

| Item | Assessment |
|------|------------|
| User question | What can Artemis do now, what is blocking it, and what needs attention? |
| Decisions/actions | Understand maturity; open owners (Agents, Data Hub, Decision Engine, Connections, control Agents) |
| Real data | Runtime SSOT (MEASURED); readiness aggregation (CONFIGURED/DERIVED); inventory (PERSISTED); advisory/run counts (PERSISTED); blockers (DERIVED) |
| Owners | Runtime SSOT; `/artemis/readiness`; `ai_agents`; `system_logs` / `ai_decisions`; Settings Decision Engine; AI Center Data Hub/Agents |
| Justified now | Hero, readiness pipeline, 15-Agent role summary, top blockers, recent activity if persisted, quick links |
| Deferred | Canonical evidence envelopes; real orchestration; Live/execution |
| Hierarchy | Hero → pipeline → Agent summary → blockers → activity → links |
| Visualization | Pipeline/stepper + grouped Agent counts + compact activity list |
| Mobile | Summary-first stacked hero; pipeline vertical; links wrap |
| Empty | Compact empty activity; never fake zeros as success |
| Hide from primary UX | WP names, raw enums, API paths, UUIDs |

### 19.3 Evidence

| Item | Assessment |
|------|------------|
| User question | What intelligence is available to Artemis, from whom, and is it usable? |
| Actions | Search/filter Agents; open Agent product; inspect contract readiness |
| Real data | 15-Agent catalog (CONFIGURED); `ai_agents` inventory (PERSISTED); contract not implemented (UNAVAILABLE); evidence envelopes (UNAVAILABLE) |
| Distinguish | Exists ≠ operational ≠ contract-compatible ≠ currently consumable |
| Justified now | Agent Evidence Readiness workspace + contract panel |
| Deferred | Real EvidenceEnvelope publishing |
| Visualization | Grouped table/cards + filters + compact contract panel |
| Hide | WP-B/WP-D, raw keys as primary copy |

### 19.4 Decisions

| Item | Assessment |
|------|------------|
| User question | What has Artemis concluded, why, and can anything be executed? |
| Data | `system_logs` category `artemis_decision` (LEGACY/PERSISTED); containment flags (CONFIGURED); `approved:true` is advisory only |
| Justified now | Status summary + history table/timeline + filters + details drawer |
| Confidence | Only in Technical Details; not as calibrated probability |
| Empty | Compact: no advisory records yet |
| Hide | Raw JSON, `approved:true` as execution approval |

### 19.5 Orchestration

| Item | Assessment |
|------|------------|
| User question | How should Artemis coordinate intelligence, and what is actually ready? |
| Data | Agent inventory (PERSISTED); role catalog (CONFIGURED); real coordination (UNAVAILABLE); legacy coordinateAgents (LEGACY, mock) |
| Justified now | Truthful topology + per-node status + canonical vs legacy sections + Agent deep links |
| Must not | Fake active orchestration; expose agent-1..15 / UUID mismatch in primary copy |
| Visualization | Role-group flow into Artemis then control chain |

### 19.6 Controls

| Item | Assessment |
|------|------------|
| User question | Who can approve, block, size, validate, or execute? |
| Data | controlChain (CONFIGURED); runtime (MEASURED); Risk UUID debt (CONFIGURED limitation); Liquidity not control-eligible (CONFIGURED/UNAVAILABLE) |
| Justified now | Visual authority chain + veto emphasis + why execution = No + owner links |
| Must not | Fake readiness %; hardcoded UUID as primary UI; “stub” wording |
| Order boundary | Executes approved intent only; cannot determine market direction |

### 19.7 Lineage & Audit

| Item | Assessment |
|------|------------|
| User question | Can I trace what happened and which system produced it? |
| Data | `system_logs` Artemis records (LEGACY/PERSISTED); `ai_decisions` Agent runs (PERSISTED); canonical lineage (UNAVAILABLE) |
| Justified now | Source summary + unified read-only activity view + filters + details + compact lineage-unavailable card |
| Must not | Mutate sources; treat the two tables as one SoT; use WP-C as primary copy |

### 19.8 System & Integrations

| Item | Assessment |
|------|------------|
| User question | Are Artemis dependencies healthy and where are they managed? |
| Data | LLM provider health (MEASURED); Connections count (MEASURED); Data Hub source counts (PERSISTED/DERIVED, read-only); runtime (MEASURED); Decision Engine dual-config (CONFIGURED); scheduler allowlist/status (MEASURED/LEGACY read-only Redis); provenance env commit (MEASURED if present) |
| Justified now | Dependency cards with status, truth, limitation, canonical links; admin-only legacy tools disclosure |
| Must not | Raw `/api/v1/artemis/health` as status; Data Hub rewrite; Enable Autopilot / Run Once in product UI |

### 19.9 Features deferred (not WP-A)

Canonical EvidenceEnvelope · real 15-Agent orchestration · Risk UUID modernization · Liquidity control eligibility · Live/execution · FR-1…FR-4 rehomes · Autopilot productization

## 20. Specialized redesign implementation ledger

### 20.1 IA

Unchanged names. Legacy Admin removed from primary nav. No tabs merged/renamed.

### 20.2 Features added (truthful, read-only)

- Product presentation layer (`artemisProductCopy.ts`) — no raw enums in primary UX
- Overview executive cockpit: hero, pipeline, 15-Agent summary, blockers, activity, quick links
- Evidence workspace: 15 Agents by role, search/filters, contract panel
- Decisions workspace: advisory summary, history table/drawer, execution-ineligible wording
- Orchestration topology: role groups + canonical vs legacy coordination
- Controls authority chain with Risk veto, liquidity limitation, Order boundary
- Lineage unified read-only audit (Artemis logs ≠ Agent runs)
- System operational dependencies + admin-only legacy tools disclosure (no Enable/Run Once)
- Readiness API enrichment: inventory, catalog, providers, connections, Data Hub counts, scheduler read-only, advisory/run counts, provenance, pipeline, blockers

### 20.3 Deferred

Canonical EvidenceEnvelope · real orchestration · Risk UUID modernization · Liquidity control eligibility · Live · FR-1…FR-4 · Autopilot product UI

### 20.4 Staging evidence

| Item | Value |
|------|-------|
| Implementation HEAD | `fa9b1b1` |
| Runtime commit | `fa9b1b1` (`provenanceVerified=true`) |
| Served bundle | `index-Dk1RoeiR.js` |
| Data Hub chunk | `DataHubWorkspace-DlvypHXD.js` (untouched product; lazy chunk rebuilt) |
| Deploy | titan-backend-only + dist rsync; workers not restarted |
| Workers | id4 pid=1639616 ↺=0; id8 pid=1639645 ↺=0 |
| Backend tests | containment 3/3 + readiness 2/2 PASS |
| Frontend tests | 21/21 PASS (`ArtemisWpA.test.tsx`) |
| Production build | PASS |
| Native dialogs (canonical Artemis) | 0 |
| Synthetic metrics | 0 |
| Raw enum/key scan (primary Overview) | 0 |
| Data Hub | Owner PASS unchanged; not modified |
| Side effects | private=0 orders=0 transfers=0 withdrawals=0 scheduler=0 workers=0 migrations=0 Live=0 |
| Draft PR | Not created (WP-A remains open) |

## 21. Verdict after specialized redesign

**ARTEMIS WP-A — SPECIALIZED REDESIGN IMPLEMENTED**  
**READY FOR OWNER HUMAN QA RE-REVIEW**

Not CLOSED.

## 22. Owner Human QA Round 2 — novice-first redesign

Owner Round 1: Data Hub PASS / frozen. Artemis FAIL (engineering-oriented + count/list contradictions).

### 22.1 Count / list RCA

| Symptom | Cause | Fix |
|---------|--------|-----|
| Recommendations: count=7 and “No advisory records” | Summary from `readiness.advisory.count`; list from `/logs` `systemLogs`. Empty `[]` short-circuited fallback. `/logs` failures returned empty silently. `/logs.total` was page length, not COUNT. | Readiness now returns `count + latestAt + recent[] + loadedCount + detailsAvailable` from the same `system_logs` category. UI uses `resolveRecordWindow(audit.systemLogs \|\| readiness.advisory.recent)`. If count>0 and loaded=0 → “N records exist, but details could not be loaded” + Retry. Never “No records”. |
| History: Agent runs=6051 and “No audit records” | Same empty-array trap on `audit.decisions \|\| readiness.agentRuns.recent`. Recent window was 12 and unused when audit returned `[]`. | `agentRuns.recent` window=50 + `detailsAvailable`. UI states “6,051 recorded · Showing latest 50” or truthful unavailable. `/logs` fail-soft + real totals. |

### 22.2 Visible IA (IDs unchanged)

Home · AI Inputs · Recommendations · Coordination · Safety & Approval · History & Audit · System Health  
Deep links: `overview` `evidence` `decisions` `orchestration` `controls` `lineage` `system`.

### 22.3 Presentation

Simple (default) / Advanced — UI preference only (`localStorage titangold.ui.artemis.presentation`). Not Demo/Live.

First-visit explainer: dismissible “New to Artemis?” (3 steps + Got it). Preference: `titangold.ui.artemis.explainerDismissed`.

### 22.4 Staging evidence (Round 2)

| Item | Value |
|------|-------|
| Implementation HEAD | `7420903` |
| Documentation HEAD | living doc on `feat/artemis-wp-a-legacy-safety-ui` after Round 2 closeout note |
| Runtime commit | `7420903` (`provenanceVerified=true`) |
| Served bundle | `index-Ckx5_P5w.js` |
| Data Hub chunk | `DataHubWorkspace-B8N0zeJk.js` (product source untouched; Vite chunk rebuilt) |
| Deploy | dist rsync + titan-backend restart only; workers not restarted |
| Workers | id4 pid=1639616 ↺=0; id8 pid=1639645 ↺=0 |
| Backend tests | containment 3/3 + readiness 3/3 PASS |
| Frontend tests | 28/28 PASS (`ArtemisWpA.test.tsx`, including A–E) |
| Production build | PASS |
| Data Hub | Owner PASS unchanged; not modified |
| Side effects | private=0 orders=0 transfers=0 withdrawals=0 scheduler=0 workers=0 migrations=0 Live=0 · authorized titan-backend restart only |
| Screenshots | Owner captures in Round 3 (login-gated Staging) |
| Draft PR | Not created (WP-A remains open) |

### 22.5 Verdict

**ARTEMIS WP-A — NOVICE-FIRST REDESIGN IMPLEMENTED**  
**READY FOR OWNER HUMAN QA ROUND 3**

Not CLOSED.

## 23. DESIGN SYSTEM COMPLIANCE (Owner Round 3 visual pass)

Authoritative standard: `DESIGN_SYSTEM_DATAHUB.md`.  
Authoritative reference UI: `TelegramPanel.tsx` + `dataHubUi.tsx` only. Other Data Hub tabs were not used as visual benchmarks.

Artemis does **not** import Data Hub business components. Visual rules were copied into:

- `components/ai/AIManager/artemisDesignTokens.ts`
- `components/ai/AIManager/components/ArtemisUi.tsx`

### 23.1 Compliance inventory (pre-pass → remediation)

| Design rule | Artemis before | Gap | Remediation |
|-------------|----------------|-----|-------------|
| Primary slate/glass gradient | flat `bg-card` | not DS family | `ARTEMIS_SHELL` / header gradient |
| Purple nav accent | oversized `bg-blue-600` rect tabs | confused with info blue | `ARTEMIS_TAB_*` rounded-full purple selected |
| Compact typography | `text-2xl/3xl` hero, `text-sm` body | oversized | titles `text-sm md:text-base`; body `text-xs`; secondary `text-[11px]`; badges `text-[10px]` |
| Semantic metric cards | flat `bg-secondary/20` | no semantic gradient | `MetricCard` emerald/amber/red/blue/purple |
| Status pills | `rounded-md text-xs` | not DS pill grammar | one `StatusPill` owner: `rounded-full text-[10px]` success/error/warning/info/neutral/primary |
| Primary actions | rectangular blue | not purple pill | `ARTEMIS_BTN_PRIMARY` purple `rounded-full text-xs` |
| Filters | `bg-background border-border text-sm` | browser-default feel | `ARTEMIS_INPUT`/`SELECT` slate-950/900 + slate-700 |
| Modal/drawer | `bg-black/40` + `bg-card` | not DS overlay/panel | overlay `bg-black/60 backdrop-blur-sm`; panel slate gradient `border-white/10 rounded-xl shadow-2xl` |
| Explainer | heavy full-width blue box | visually dominates | subtle purple/slate glass; Got it purple pill; Learn more sky text |
| Simple/Advanced | blue rectangular toggle | looked like trading mode | compact purple segmented control |
| Tables | generic `text-sm` + `border-border` | not DS table | overflow-x-auto, thead `text-[11px]` muted, row `border-slate-900/60` |
| Technical details | `bg-secondary/20` often visible | too primary | collapsed `ARTEMIS_TECH` mono `text-[10px]` |
| Coordination wall | tall identical cards | height noise | group containers + 1/2/3-col compact rows |
| Safety cards | giant identical cards | weak hierarchy | vertical stepper + semantic accents |

### 23.2 Per-screen compliance

| Screen | DataHub pattern used | Deviation | Reason | Responsive | Visual QA |
|--------|----------------------|-----------|--------|------------|-----------|
| Shell / header | `DATAHUB_SHELL` gradient + glass | AI Center outer chrome unchanged | Shared chrome includes frozen Data Hub; Artemis-only shell is the compliance surface | header wrap; nav `overflow-x-auto` | Owner Round 4 PASS |
| Nav | `DataHubTabStrip` purple pills | 7 product sections vs Data Hub collector tabs | Artemis IA approved; same pill grammar | horizontal scroll, no clip | Owner Round 4 PASS |
| Explainer | info glass + purple primary + sky text | 3-step novice copy | product identity, not Collector onboarding | stacks on mobile | Owner Round 4 PASS |
| Simple/Advanced | segmented control purple selected | labels Simple/Advanced not Collector modes | presentation preference only | wrap | Owner Round 4 PASS |
| Home | hero glass + metric 2/4 grid + flow nodes + mini metrics + amber/red alerts | hero title `text-base md:text-lg` (not `text-sm`) | primary product state needs one step above section titles; still far below old 2xl/3xl | metric `grid-cols-2 md:grid-cols-4`; flow column→row | Owner Round 4 PASS |
| AI Inputs | semantic group metric cards + DS table + mobile cards | group accents are role-semantic not live health % | no fake percentages; color = role/state | 1/2/3 card grid; table `md+`, cards mobile | Owner Round 4 PASS |
| Recommendations | slate intelligence cards + compact Advisory pill + DS drawer | page-level amber limited to one alert, not full-page border | avoid amber wash | 1/2 card grid | Owner Round 4 PASS |
| Coordination | inner slate + semantic pills + expandable groups + compact agent rows | flow uses `+` / `→` not Collector pipeline chrome | Artemis coordination story | agent grid 1/2/3 | Owner Round 4 PASS |
| Safety & Approval | error alert + semantic stepper | Emergency Stop remains visible even when runtime emerald | safety-block must not be softened | stepper full width, 2-col owner/can-block | Owner Round 4 PASS |
| History & Audit | metric cards + compact `ARTEMIS_ROW` timeline + DS drawer | source pills Artemis/Agents/Safety | semantic accent per source | metrics 2/3; rows full width | Owner Round 4 PASS |
| System Health | operational status cards + collapsed mono diagnostics | 2-col tablet, 3-col wide | readability over forcing 4-col | 1/2/3 | Owner Round 4 PASS |
| Drawer | canonical modal overlay/panel | close = slate secondary (`ARTEMIS_BTN_MODAL_CLOSE`) | matches DataHub modal close, not purple primary | near-full mobile + internal scroll | Owner Round 4 PASS |

### 23.3 Justified deviations remaining

1. **AI Center outer card** not restyled — would change chrome around frozen Data Hub.
2. **Hero title one step larger** than section titles — primary “analyzing only” statement.
3. **Artemis purple identity** slightly stronger than Collector on Home hero — central-intelligence product, still same token family.
4. **No pixel-perfect screenshot CI** — infrastructure does not support it; visual-structure class-token tests added instead.

### 23.4 Tests / build / staging (Round 3 visual)

| Item | Value |
|------|-------|
| Visual implementation HEAD | `12f47b0` |
| Documentation HEAD | living doc on `feat/artemis-wp-a-legacy-safety-ui` after this section |
| Runtime commit (backend) | `7420903` (`provenanceVerified=true`) — backend unchanged this round |
| Served bundle | `index-DMthIK9F.js` |
| Data Hub chunk | `DataHubWorkspace-Zt-_1y4f.js` (product source untouched; Vite chunk rebuilt) |
| Deploy | dist rsync only; titan-backend not restarted; workers not restarted |
| Workers | id4 pid=1639616 ↺=0; id8 pid=1639645 ↺=0 |
| Frontend tests | 31/31 PASS (`ArtemisWpA.test.tsx`, including visual-structure + A–E) |
| Production build | PASS |
| Data Hub source diff | empty / Owner PASS unchanged |
| Side effects | private=0 orders=0 transfers=0 withdrawals=0 scheduler=0 workers=0 migrations=0 Live=0 · backend restart=0 |
| Screenshots | Owner captures in Round 4 (login-gated Staging) |
| Draft PR | Not created (WP-A remains open) |

### 23.5 Verdict

**ARTEMIS WP-A — DATAHUB DESIGN SYSTEM COMPLIANT**  
**READY FOR OWNER HUMAN QA ROUND 4**

Not CLOSED.

## 24. Owner Human QA Round 4 PASS — pre-PR closeout

Owner verdict (Round 4):

| Gate | Result |
|------|--------|
| Data Hub Human QA | PASS / FROZEN (prior Owner PASS remains valid) |
| Artemis IA | PASS |
| Novice-first UX | PASS |
| Simple View | PASS |
| Advanced View | PASS |
| DESIGN_SYSTEM_DATAHUB.md compliance | PASS |
| Owner Human QA Round 4 | **PASS** |

Owner-reviewed surfaces: Home · AI Inputs · Recommendations · Coordination · Safety & Approval · History & Audit · System Health · Simple · Advanced · DataHub design-system harmony.

Verified implementation commit: `12f47b08f60378516efa85b19607a36f06ff60f8`  
`feat(artemis): align WP-A UI with DataHub design system`

No new screenshots were invented. Owner Human QA is the visual authority. Cursor closeout did not redeploy Staging because provenance already matched the approved Human-QA state.

### 24.1 Future rehome backlog (NOT implemented; not WP-A blockers)

Preserved from §16:

| ID | Item | Future home |
|----|------|-------------|
| FR-1 | Learning | Training specialization |
| FR-2 | Trading Scenarios | Analytics / Evaluation / Simulation |
| FR-3 | Backtesting | Analytics after truthful engine + persistence |
| FR-4 | Full System Logs browser | History & Audit enhancement if justified |

### 24.2 Pre-PR closeout evidence

| Item | Value |
|------|-------|
| origin/main | `a100f7b` |
| Visual implementation HEAD | `12f47b0` |
| Documentation HEAD (this closeout) | recorded after this section on `feat/artemis-wp-a-legacy-safety-ui` |
| Backend runtime | `7420903` (`provenanceVerified=true`) |
| Served bundle | `index-DMthIK9F.js` |
| Data Hub chunk | `DataHubWorkspace-Zt-_1y4f.js` (product source untouched) |
| Deploy this closeout | none (Staging already matched Human-QA state) |
| Workers | id4 pid=1639616 ↺=0; id8 pid=1639645 ↺=0 |
| Backend tests | containment 3/3 + readiness 3/3 + TE gate 3/3 = 9/9 PASS |
| Frontend WP-A | `ArtemisWpA.test.tsx` 31/31 PASS |
| Regression | Agents / Trend / Arbitrage / Telegram Collector i18n+labels / Connections nav — included suites PASS |
| Production build | PASS (artifact unchanged: `index-DMthIK9F.js`) |
| Data Hub product implementation | TelegramPanel / dataHubUi unchanged vs this WP-A visual commit |
| Trend / Arbitrage product files | 0 in WP-A diff vs main |
| Protected scripts | 0 |
| Scheduler/worker/migrations | 0 |
| Side effects | private=0 orders=0 transfer/withdraw=0 financial=0 Live=0 scheduler=0 workers=0 migrations=0 backend restart=0 |
| Draft PR | created after this closeout; remains Draft; not merge-ready until independent review + Owner merge approval |
| WP-A CLOSED | NO |

### 24.3 Verdict

**ARTEMIS WP-A — OWNER HUMAN QA PASS**  
**DRAFT PR READY FOR INDEPENDENT REVIEW**

Not CLOSED.
