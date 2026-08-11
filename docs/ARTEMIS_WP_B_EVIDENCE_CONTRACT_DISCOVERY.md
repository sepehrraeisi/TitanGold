# Artemis WP-B — Canonical Evidence Contract + Agent Compatibility Discovery

**Status:** WP-B.1 IMPLEMENTATION COMPLETE — AUTOMATED QA PASS — BROWSER QA PASS — OWNER HUMAN QA PASS — READY FOR PR FINAL REVIEW — **NOT CLOSED** — **NOT FROZEN** — **NOT MERGED**  
**Classification:** Shared Foundation implementation (Tier 2) after B0 discovery  
**Governing authority:** TitanGold Core Engineering Rules **v4.6** §§45–54 (esp. §47–48)  
**Rule 02:** ARTEMIS WP-B.1 — CANONICAL EVIDENCE FOUNDATION  

**Implementation branch:** `feat/artemis-wp-b-evidence-foundation`  
**Worktree:** `/home/ubuntu/worktrees/titangold-artemis-wp-b-foundation`  
**Discovery branch (intact):** `feat/artemis-wp-b-evidence-contract-discovery`  
**Discovery base `origin/main`:** `845ea0d35b75b1beca516be235f47d98c5703692`  
**WP-A product baseline (FROZEN):** `7c13fe13015de1b44ab534dff8deb72c6e5f5668`  
**WP-A docs closeout:** `845ea0d35b75b1beca516be235f47d98c5703692`  
**B0 Owner-approved discovery:** `b2b42271d45260296e70b222293f33b1591562d9`

**Runtime / product code changed:** **YES** (WP-B.1 backend evidence foundation + additive i18n)  
**Migrations / Scheduler / worker topology / Live / orders / private provider:** **0**

Frozen surfaces (do not reopen): WP-A UI IA · Data Hub · Trend product · Arbitrage product.

Current Artemis maturity remains **ADVISORY ONLY** / `LEGACY_ADVISORY_ONLY` / `executionEligible=false`.  
WP-B.1 does **not** authorize WP-C orchestration, B10 persistence, execution, Live, or control-chain activation.

**Contract versions (APPROVED through initial WP-B adapters):**  
`schemaVersion = 1.0.0` · `contractVersion = artemis-evidence-1.0.0`  
Adapter versions remain separate: Trend `1.0.0` · Arbitrage `1.0.0` · Volume `1.0.0`.

---

## 1. Executive finding

Artemis today is a **legacy LLM Mixture-of-Experts advisory surface** plus WP-A containment. It is **not** a v4.6 evidence orchestrator.

Proven:

1. `POST /api/v1/artemis/decision` still computes legacy `approved:true` BUY/SELL internally, then **WP-A wrap** forces `executionEligible=false`, `approvedForExecution=false`, `classification=LEGACY_ADVISORY_ONLY`.
2. Trading Engine gate ignores `approved` and requires both eligibility flags — so legacy `approved:true` **≠** execution authorization. **Do not change this.**
3. `callAgentAPI` still returns mock `NEUTRAL` + random 50–80 confidence. No real Agent envelope is consumed.
4. `AGENT_DEPENDENCIES` is keyed by `agent-1…15`; DB Agents use UUID `ai_agents.id` → dependency graph misses on the production path.
5. Canonical EvidenceEnvelope exists **only as Foundation design + readiness constants** (`schemaVersion=1.0.0`, `contractVersion=artemis-evidence-1.0.0`, `implemented:false`, `compatibleAgentCount:0`).
6. `ai_decisions` is Agent-run SoT (UUID `agent_id`). Artemis MoE logs to `system_logs.category='artemis_decision'`. These must stay separate.
7. `/logs` and `/readiness` agent-run queries select `d.input` / `d.output` but the table columns are `input_data` / `output_data` → fail-soft `sourceError`. **B7 is Owner-authorized** to correct these read-only column references only. This is **not** a WP-A UI reopen and must not leak raw blobs.
8. Trend + Arbitrage have product-grade persisted DTOs suitable for **read-only adapters**. Volume is the third WP-B.1 adapter. **Pattern is deferred** (mock-OHLCV fallback). Technical/Timing/Liquidity are mock/stub. Order is not an analytical producer. Optimization is **NOT_APPLICABLE** for Artemis sizing/control. Risk/Portfolio/Liquidity/Order must **not** be forced into a directional BUY/SELL envelope.

**B0 Owner-approved WP-B.1 goal (implementation still not started):** make analytical Agents **contract-compatible evidence producers** via real read-only adapters, without promoting any Agent or Artemis to execution eligibility.

**Approved first implementation (not started, not authorized by B0):** shared envelope + identity normalizer + validators + read-only adapters for `trend` then `arbitrage` then `volume` from persisted runs, plus on-read projection + safe RBAC projection + readiness counts + B7 SQL column correction. No migration in WP-B.1. No orchestration rewrite. No WP-A UI redesign. No Pattern adapter in WP-B.1.

### 1.1 B0 Owner decisions (RESOLVED)

| # | Decision | Resolution |
|---|---|---|
| 1 | Canonical identity | `agentId` = stable backend `agent_key`. Trend = `trend`. `trend_detection` remains alias only. Frozen frontend keys unchanged. No `ai_decisions` migration. UUID = `agentRecordId`. |
| 2 | WP-B must prove the contract | WP-B is **not** types-only. WP-B.1 includes real read-only adapters: Trend → Arbitrage → Volume. Adapters live **outside** frozen product owners. |
| 3 | No migration in WP-B.1 | On-read generation from `ai_decisions` / product DTOs. B10 persist table remains a later gated decision. |
| 4 | Artemis read SQL | B7 **may** change `d.input`/`d.output` → `input_data`/`output_data`. Scoped: no WP-A UI reopen, no raw blob exposure, no debug endpoints, no execution-semantic change. Regression tests required. |
| 5 | Optimization authority | WP-B: `optimization = NOT_APPLICABLE` for sizing/control. Remains utility/backtest until a dedicated WP proves authority. **Portfolio** is the current sizing-role candidate. |
| 6 | Pattern | Primary = **NEEDS OUTPUT CORRECTION**. Not in WP-B.1. Later adapter requires proven real-source provenance; fail unavailable on mock/unknown. `source != mock` is not sufficient by itself. |
| 7 | Trend strength ≠ confidence | Snapshot `strength` comes from `raw.trend.confidence`. First Trend adapter: `conclusion.strength` = that truthful value; `confidence = UNAVAILABLE`. `_meta.confidence` is strength/100, not epistemic confidence. |
| 8 | Generic 0.5 fallback | Do **not** treat every `0.5` as unavailable. Only when Agent output has **no explicit confidence field** and `ai_decisions.confidence=0.5` was supplied by `agentExecutionService`. Explicit documented 0.5 remains valid. Tests cover both. |
| 9 | Freshness | Missing actual `sourceTimestamp`/`sourceCandleTimestamp` → `freshness.status=unknown`. Unknown timeframe → do not assume `1h`. Product DTO may keep display fallbacks; adapter owns stricter Artemis truth. |
| 10 | Compatibility counts | Mutually exclusive primary classes totaling **15**. `UNAVAILABLE / DEFERRED` is a **secondary** Artemis readiness dimension. |
| 11 | Contract version | Keep `1.0.0` / `artemis-evidence-1.0.0` through initial adapters. Adapter version ≠ contractVersion. |
| 12 | WP-B/C/D boundary | Keep Discovery split with clarifications in §18. Dedicated Agent productization may be required before WP-C/D can consume Technical, Timing, Liquidity, Pattern, etc. |

---

## 2. Source / code map

| Concern | Canonical owner today | WP-B relationship |
|---|---|---|
| Artemis HTTP | `backend/routes/artemis.js` | Consume later; do not weaken WP-A wrap |
| MoE orchestrator | `backend/services/artemisOrchestrator.js` | Legacy; do not use as evidence SoT |
| WP-A containment | `backend/services/artemisDecisionContainment.js` | KEEP UNCHANGED |
| TE eligibility gate | `backend/services/artemisExecutionGate.js` | KEEP UNCHANGED |
| Readiness | `backend/services/artemisReadinessService.js` | Update counts only after real envelopes exist |
| Audit projection | `backend/services/artemisAuditProjection.js` | PRODUCT-SAFE field allowlist — reuse pattern |
| Zod HTTP schemas | `backend/schemas/artemisSchemas.js` | No EvidenceEnvelope today |
| Agent dispatch | `backend/services/agents/registry.js` (`AGENT_MODULES`, 15 keys) | Identity source for `agentId` |
| Capability / side effects | `backend/services/agentCapabilityRegistry.js` | Role/liveCapable; includes `artemis_decision` |
| Execution policy | `backend/services/agentExecutionPolicyService.js` | Runtime gate; not evidence |
| Runtime mode / Kill Switch | `backend/services/runtimeExecutionStateService.js` | Fail-closed owner |
| Agent-run persistence | PostgreSQL `ai_decisions` | **Preserve** as Agent-run SoT |
| Artemis advisory logs | `system_logs` (`artemis_decision`) | Separate from evidence |
| Artemis catalog | `constants/artemisAgentCatalog.js` | Alias + authority groups |
| Frontend keys | `constants/agentKeys.ts` | `TREND=trend_detection` alias debt |
| Frontend panels | `components/ai/agentRegistry.ts` | Shell only |
| Agent product template | `components/ai/product/*`, `components/ai/shell/*` | Do not redesign |
| Trend product DTO | `backend/services/trendDomain.js` + `trendRunService.js` | **Frozen** — adapter reads only |
| Arbitrage product DTO | `backend/services/arbitrageScanContract.js` + `arbitrageRunService.js` | **Frozen** — adapter reads only |
| Risk gate (manual trading) | `backend/services/risk-gate.js` (hardcoded Risk UUID) | Control owner later; not WP-B adapter target |
| Liquidity real formulas | `backend/services/liquidity/LiquidityAnalyzerService.ts` | Unwired; not WP-B |
| Foundation design | `docs/ARTEMIS_CONTRACT_FOUNDATION.md` | Parent design; WP-B refines for implementation |
| WP-A product | `docs/ARTEMIS_WP_A_LEGACY_SAFETY_UI.md` | Frozen IA/screens |
| TE Artemis caller | `backend/engine/tradingEngine.js` `getArtemisApproval` | Unauthenticated → 401 → fail-closed fallback; **WP-C** |
| Scheduler allowlist | analytical scheduler / `scheduledAgentResolver.js` | Staging `["arbitrage"]`; do not expand |

---

## 3. Legacy Artemis truth (re-audit at `845ea0d`)

| ID | Finding | Do not change in WP-B |
|---|---|---|
| A | Orchestrator identity: `AGENT_DEPENDENCIES['agent-1'..'agent-15']` vs UUID `ai_agents.id` | Replace only via new evidence identity, not a silent graph rewrite in WP-B.1 |
| B | `POST /api/v1/artemis/decision` + `containLegacyArtemisDecision` | Keep wrap; no execution semantics |
| C | Mock `callAgentAPI`; TE `getAgentSignals` synthetic + `/api/ai-agents/agent-N/run` | WP-C to retire mocks |
| D | Risk: catalog veto + crude `dailyLoss` 5% check; Risk Gate **not** on `/decision`; hardcoded UUID debt | WP-C control chain |
| E | Portfolio/Optimization: readiness `PARTIAL` / sizing authority only; not on `/decision` | WP-C |
| F | Liquidity: `BLOCKED`, stub `confidence:0.55` mock | Not feasibility-ready; WP-D/agent product |
| G | Order: `execution_only`, `NOT_EXECUTION_ELIGIBLE`; never chooses direction | KEEP |
| H | Persistence: Artemis → `system_logs`; Agents → `ai_decisions`; `/logs` column-name bug | Fix read path in WP-B ingestion |
| I | Frontend: WP-A canonical sections consume readiness + projected audit, not envelopes | Frozen UI |
| J | Readiness: `implemented:false`, evidence `UNAVAILABLE`, orchestration `LEGACY` | Truthful; update only when envelopes exist |

**Reconfirmed:** legacy `approved:true` ≠ `approved_for_execution`. TE predicate:

`executionEligible === true && approvedForExecution === true && action ∈ {BUY,SELL,EXECUTE}`.

---

## 4. Canonical contract proposal

Keep Foundation versions (already shown in WP-A readiness UI):

- `schemaVersion`: **`1.0.0`**
- `contractVersion`: **`artemis-evidence-1.0.0`**

Do **not** require the full 40-field Foundation list on every emit. Use a **base envelope** + **role extension**. Missing inapplicable fields must be omitted or explicitly `unavailable` — never fake zeroes.

### 4.1 Base envelope (all roles)

| Canonical name | Type | Req | Domain / meaning | Source owner | Truth class | Nullability | Validation | UI | Artemis decisioning | Exec-related? |
|---|---|---|---|---|---|---|---|---|---|---|
| `schemaVersion` | string | R | `1.0.0` | contract owner | configured | no | exact match | Advanced | yes | no |
| `contractVersion` | string | R | `artemis-evidence-1.0.0` | contract owner | configured | no | exact or compatible minor | Advanced | yes | no |
| `agentId` | string | R | canonical `agent_key` (`trend`, not UUID) | registry + catalog | configured | no | must normalize via alias table | Simple | yes | no |
| `agentRecordId` | uuid \| unavailable | O | `ai_agents.id` instance provenance | DB | persisted | yes | uuid if present | Advanced | lineage | no |
| `agentRole` | enum | R | see §7 | catalog | configured | no | must match authorityClass family | Simple | yes | no |
| `authorityClass` | enum | R | `analytical_evidence` \| `opportunity_forecast` \| `control_veto` \| `control_sizing` \| `execution_feasibility` \| `execution` | catalog | configured | no | reject mismatch vs agentId | Simple | yes | no |
| `runId` | uuid \| unavailable | R* | `ai_decisions.id` when persisted | Agent writer | persisted | unavailable allowed for ephemeral | uuid or unavailable | Advanced | yes | no |
| `correlationId` | uuid \| unavailable | O | batch / same-context grouping | Artemis later | derived | yes | uuid | Advanced | WP-C | no |
| `decisionContextId` | uuid \| unavailable | O | Artemis evaluation context | Artemis later | unavailable until WP-C | yes | omit until consumer exists | Advanced | WP-C | no |
| `ownershipScope` | `{type,id?}` \| unavailable | O | user/tenant/system | auth | measured | unavailable if N/A | allowlist types | Advanced | yes | no |
| `provider` | string \| unavailable | O | data provider | Agent / Connections | measured or unavailable | yes | no secrets | Advanced | compatibility | no |
| `venue` | string \| unavailable | O | exchange/venue | Agent | measured or unavailable | yes | | Advanced | compatibility | no |
| `marketType` | enum \| unavailable | O | spot/futures/… | Agent | measured or unavailable | yes | | Advanced | compatibility | no |
| `symbol` | string \| unavailable | R* | canonical pair | Agent | measured | unavailable if N/A | non-empty if available | Simple | yes | no |
| `baseAsset` / `quoteAsset` | string \| unavailable | O | split symbol | derived | derived or unavailable | yes | | Advanced | compatibility | no |
| `timeframe` | string \| unavailable | O | canonical TF | Agent | measured or unavailable | yes | | Simple | yes | no |
| `analysisHorizon` | string \| unavailable | O | forecast/analysis horizon | Agent | configured or unavailable | yes | | Advanced | compatibility | no |
| `analysisTimestamp` | iso8601 | R | when analysis completed | Agent / writer | measured | no | ISO | Simple | yes | no |
| `sourceTimestamp` | iso8601 \| unavailable | O | source-data time | Agent | measured or unavailable | yes | | Advanced | freshness | no |
| `sourceCandleTimestamp` | iso8601 \| unavailable | O | closed candle time | Agent | measured or unavailable | yes | | Advanced | freshness | no |
| `expiryTimestamp` | iso8601 \| unavailable | O | when evidence expires | policy / Agent | derived or unavailable | yes | | Advanced | WP-C | no |
| `freshness` | object | R | see §9 | adapter + policy | derived | status required | enum | Simple | yes | no |
| `provenance` | object | R | source, writer, versions | adapter | derived | no | allowlisted keys | Advanced | yes | no |
| `dataQuality` | object | R | see §10 | adapter | derived | status required | enum | Simple | yes | no |
| `availability` | enum | R | `available` \| `unavailable` \| `not_applicable` \| `blocked` | adapter | derived | no | enum | Simple | yes | no |
| `unavailableReason` | key \| null | C | required if not available | adapter | derived | null iff available | stable key | Simple | yes | no |
| `lifecycleStatus` | enum | R | `completed` \| `failed` \| `partial` \| `skipped` | Agent run | measured | no | enum | Advanced | yes | no |
| `limitations` | string[] / keys | R | known limits; empty only if explicitly none | Agent / adapter | measured/configured | may be empty array | bounded length | Simple | yes | no |
| `executionClass` | enum | R | default `advisory_only` | contract | configured | no | **never** `executable` in WP-B | Simple | yes | **flag only** |
| `codeImplementationVersion` | string \| unavailable | O | git/impl SHA | deploy provenance | configured | unavailable ok | | Advanced | replay | no |
| `modelAlgorithmVersion` | string \| unavailable | O | model/algo id | Agent | configured or unavailable | yes | | Advanced | replay | no |
| `configurationVersion` | string \| unavailable | O | agent config hash/version | Agent settings | configured or unavailable | yes | | Advanced | replay | no |
| `createdAt` / `completedAt` | iso8601 | O | persist times | DB | persisted | yes | | Advanced | lineage | no |

\*R for analytical/opportunity producers when a run exists; control/execution roles may mark symbol/timeframe `not_applicable`.

`executionClass` allowed in WP-B: `none` | `advisory_only` | `not_applicable`.  
**Forbidden in WP-B emits:** `requires_control_chain` as if already satisfied, `executable`, `approved_for_execution`.

### 4.2 Analytical / opportunity extension

| Name | Type | Req | Meaning | Truth | Notes |
|---|---|---|---|---|---|
| `conclusion.signal` | enum \| unavailable | O | BUY/SELL/HOLD/NEUTRAL/WATCH or role-specific | measured/derived | no fake NEUTRAL for missing data |
| `conclusion.direction` | enum \| unavailable | O | bullish/bearish/neutral/unavailable | measured/derived | |
| `conclusion.regime` | string \| unavailable | O | e.g. Trend regime | measured | Trend has this |
| `conclusion.strength` | number \| enum \| unavailable | O | **not** confidence (v4.6: strength ≠ probability ≠ DQ ≠ confidence) | measured | Trend snapshot `strength` = `raw.trend.confidence` on original scale |
| `confidence` | object \| unavailable | R* | see §8 | see §8 | Trend WP-B.1 = UNAVAILABLE; never coerce missing → 0.5; never treat every stored 0.5 as fake |
| `evidence.items` | EvidenceItem[] | O | bounded, see §11 | measured | max count/size |
| `evidence.counterItems` | EvidenceItem[] | O | conflicts | measured | |
| `recommendedNextActionClass` | enum \| unavailable | O | `observe` \| `review` \| `insufficient` \| `not_applicable` | derived | **not an order** |

### 4.3 Control / feasibility / execution extensions (separate sub-schemas)

Do **not** flatten Risk/Liquidity/Order into `direction`.

| Role | Sub-schema focus | WP-B emit? |
|---|---|---|
| `control_veto` (risk) | `verdict` allow/limit/block, `limitations`, `riskFlags`, exposure refs | Adapter **deferred** — Risk Gate not Artemis-wired; primary = NEEDS OUTPUT CORRECTION |
| `control_sizing` (**portfolio only**) | bounded allocation/size envelope, constraints, **no invented balances** | Deferred — Portfolio is the sizing-role **candidate**, not yet truthful SoT |
| `optimization` | backtest/utility params and results | **NOT_APPLICABLE** for Artemis sizing/control in WP-B. Do not label `control_sizing` from the name alone. |
| `execution_feasibility` (liquidity) | spread, depth, slippage, max feasible size, book timestamp, expiry | **Not now** — stub; primary = NEEDS REAL IMPLEMENTATION; secondary feasibility = UNAVAILABLE / BLOCKED |
| `execution` (order) | audit of execution intent only | **Not an evidence producer** |

### 4.4 EvidenceItem (bounded)

| Name | Type | Req | Notes |
|---|---|---|---|
| `evidenceId` | string | R | stable within run |
| `evidenceType` | enum | R | `indicator` \| `pattern` \| `spread` \| `metric` \| `narrative` \| `policy` \| `other` |
| `canonicalSource` | string | R | owner system/table/provider **name**, not payload |
| `value` / `unit` | optional | O | typed; no secrets |
| `interpretationKey` | i18n key \| unavailable | O | not raw internal dumps |
| `directionalContribution` | enum | R | `supports` \| `conflicts` \| `neutral` \| `not_applicable` |
| `timestamp` | iso8601 \| unavailable | O | |
| `freshness` | enum \| unavailable | O | same family as envelope |
| `correlationFamily` | string \| unavailable | O | see §12 |
| `limitation` | key \| null | O | |

**Limits (design):** max **32** items/envelope; each value string ≤ **256** chars; no nested arbitrary JSON; **no** raw provider bodies, signed URLs, API keys, or `input_data` dumps.

### 4.5 Compatibility fallback

- Unknown `agentId` after alias normalize → reject at ingress.
- Unknown extra fields → **reject** (allowlist), do not silently drop into product UI.
- Older `contractVersion` → consumer may read if policy lists it; else `incompatible`.
- Missing confidence → `confidence.availability=unavailable`, never coerce to 0.5.
- Missing freshness timestamps → `freshness.status=unknown`.

---

## 5. Identity normalization

**B0 APPROVED:** Artemis `agentId` = stable backend **`agent_key`**.  
Trend canonical: **`trend`**. Legacy/frontend/self ids such as `trend_detection` remain **aliases only**.  
Do **not** change frozen frontend keys in WP-B.  
Do **not** migrate `ai_decisions`.  
DB UUID remains **`agentRecordId`** (instance/run provenance only).

`normalizeAgentKey()` already exists in `constants/artemisAgentCatalog.js` — WP-B should make **one backend owner** (same alias table) and stop inventing a second map.

### 5.1 Identity table (all registered Agents)

| Canonical `agentId` | Aliases | Frontend `AGENT_KEYS` | Registry / scheduler | `run()` self-id | `ai_decisions` | Catalog authority |
|---|---|---|---|---|---|---|
| `technical` | `technical_analysis` | `technical` | `technical` | implicit | UUID FK | evidence |
| `trend` | **`trend_detection`** | **`trend_detection`** | `trend` | **`trend_detection`** | UUID; `decision_type=trend_analysis` | evidence |
| `pattern` | `pattern_recognition` | `pattern` | `pattern` | `pattern` | UUID | evidence |
| `volume` | `volume_analysis` | `volume` | `volume` | `volume` | UUID | evidence |
| `sentiment` | `sentiment_analysis` | `sentiment` | `sentiment` | `sentiment` | UUID | evidence |
| `fundamental` | `fundamental_analysis` | `fundamental` | `fundamental` | `fundamental` | UUID | evidence |
| `market_intelligence` | — | `market_intelligence` | `market_intelligence` | `market_intelligence` | UUID | evidence |
| `price_prediction` | — | `price_prediction` | `price_prediction` | `price_prediction` | UUID | forecast |
| `timing` | `market_timing` | `timing` | `timing` | `timing` | UUID | forecast |
| `arbitrage` | — | `arbitrage` | `arbitrage` (allowlisted) | `arbitrage` | UUID; `decision_type=arbitrage_scan` | forecast |
| `risk` | `risk_management` | `risk` | `risk` | `risk` | UUID; Risk Gate also hardcoded UUID | veto |
| `portfolio` | `portfolio_allocation`, `portfolio_management` | `portfolio` | `portfolio` | **`portfolio_allocation`** | UUID | sizing |
| `optimization` | — | `optimization` | `optimization` | `agent: 'optimization'` | UUID | **NOT_APPLICABLE** (utility/backtest; not sizing authority) |
| `liquidity` | `liquidity_analysis` | `liquidity` | `liquidity` | `liquidity` | UUID | feasibility |
| `order` | `order_management` | `order` | `order` | `agent: 'order_management'` | UUID | execution |

**Not Agents:** `artemis_decision` (policy key only); `sma_crossover_example`; `_template.js`.  
**Legacy `agent-N`:** still in orchestrator + TE; scheduler **rejects**. WP-B identity table must map `agent-N` → **unavailable/legacy**, not to a real `agentId`.

**Hardcoded UUID debt:** `risk-gate.js` `RISK_AGENT_ID=79bbdf0b-94a3-4cbc-adef-98c25f5ba1a7` — document only; resolve in WP-C via `agent_key=risk`.

No data migration in WP-B. Adapters join `ai_decisions.agent_id → ai_agents.agent_key → normalizeAgentKey()`.

---

## 6. Full Agent compatibility matrix

Registry verified: **15** `AGENT_MODULES` keys. Capability registry has **16** (`+ artemis_decision`).

| agentId | Maturity | Inputs | Output today | Persist | History | Confidence today | Timestamps | TF/symbol | Risk info | DQ | Algo/model | Limitations | Side-effect | Analytical evidence now? | Classification |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `arbitrage` | CLOSED product | public markets | scan contract v2 WP1A | `arbitrageRunService` → `ai_decisions` | yes | heuristic 0.1–0.85 by candidate count | scan ts | venue/symbol | not veto | partial | scan impl version | not executable multi-leg | EXTERNAL_READ | yes (opportunity) | **ADAPTER READY** |
| `trend` | CLOSED product | OHLCV | snapshot DTO | `trendRunService` → `ai_decisions` | yes | `raw.trend.confidence` is **strength**, not confidence; `_meta.confidence` = strength/100 | analysis + `last_candle_timestamp` (product may fallback) | yes | no | product freshness may assume 1h / analysis time | trend domain | identity alias | ANALYSIS | yes (strength + freshness unknown if no source candle) | **ADAPTER READY** |
| `volume` | partial | OHLCV ≥20 | OBV/VWAP/spikes + rec 0–100 | generic writer (top-level confidence often missing → writer fallback 0.5) | yes | heuristic 0–100 when explicit | analysis ts | yes | no | implicit via candle count | volumeAnalyzer | not calibrated | ANALYSIS | yes after flatten + fallback-provenance check | **ADAPTER READY** |
| `pattern` | partial | OHLCV or **mock OHLCV** | patterns + dominant_signal | generic | yes | avg top-3 0–1 | analysis ts | yes | no | mock path | pattern module | mock fallback | ANALYSIS | no until real-source provenance is canonical | **NEEDS OUTPUT CORRECTION** |
| `risk` | substantial + gate | portfolio/mock prices | risk_metrics + score | generic + risk_gate rows | yes | heuristic 0.3–0.95 | ts | symbol | **is** risk | mock prices | risk-agent | UUID debt; not on Artemis `/decision` | ANALYSIS (catalog veto) | control, not direction | **NEEDS OUTPUT CORRECTION** (control schema) |
| `sentiment` | partial | twitter/reddit/news (often mock) | sentiment_label + rec | generic | yes | heuristic 0–1 by source count | ts; TF on input only | symbol; TF=`24h` default | no | mock sources | sentiment module | no direction enum | ANALYSIS | weak | **NEEDS OUTPUT CORRECTION** |
| `price_prediction` | partial | price history | horizons + accuracy | generic → **0.5 if no top-level confidence** | yes | mixed 0–1 / 0–100 | ts | yes | no | uncalibrated | prediction module | not calibrated forecast | ANALYSIS | forecast only | **NEEDS OUTPUT CORRECTION** |
| `portfolio` | partial | caller portfolio | allocation rec; **wrong self-id** | generic → 0.5 fake | yes | Sharpe heuristic | ts | N/A-ish | risk_metrics | invented if caller incomplete | optimizer random_search | liveCapable vs analysis mismatch | PORTFOLIO_MUTATION | no (sizing) | **NEEDS OUTPUT CORRECTION** |
| `fundamental` | partial | Fear&Greed + placeholders | decision buy/sell/hold | generic | yes | heuristic 0–1 | ts + placeholders | TF default `1d` | no | funding/news/mcap fake | fundamental module | placeholders | ANALYSIS | not truthful | **NEEDS OUTPUT CORRECTION** |
| `market_intelligence` | larger module | news/onchain/macro | rec + **confidence 0–100** | generic stores 0–100 in DECIMAL | yes | heuristic 0–100 | ts + data_freshness meta | TF default `24h` | no | null sources | MI module | scale inconsistency | EXTERNAL_READ | after scale fix | **NEEDS OUTPUT CORRECTION** |
| `optimization` | partial | backtest params | best_strategy; **no confidence/signal** | generic writer may store fallback 0.5 | yes | unavailable unless explicit | ts | yes | no | SMA default | optimizer | not evidence; not sizing authority | ANALYSIS | no | **NOT AN ANALYTICAL EVIDENCE PRODUCER** |
| `technical` | MVP mock | none real | RSI/MACD random | generic | yes | 0.55–0.7 random | ts only | yes | no | mock | mock indicators | `_meta.source=mock` | ANALYSIS | no | **NEEDS REAL IMPLEMENTATION** |
| `timing` | MVP mock | mock series | timingScore + BUY/SELL/HOLD | generic | yes | 0–1 from mock | ts only | yes | no | mock | mock | TODO real data | ANALYSIS | no | **NEEDS REAL IMPLEMENTATION** |
| `liquidity` | MVP stub | none | `result:'MVP analysis complete'`, **0.55 fake** | generic | yes | fake constant | ts only | symbol | no | none | stub; real analyzer unwired | Artemis BLOCKED | EXTERNAL_READ | no | **NEEDS REAL IMPLEMENTATION** |
| `order` | real execution path | exchange (gated) | dry-run / order ops | generic audit | action history | none | ts | symbol | no | N/A | order module | liveCapable | ORDER_LIVE | no | **NOT AN ANALYTICAL EVIDENCE PRODUCER** |

### Primary compatibility counts (MUTUALLY EXCLUSIVE — total = 15)

| Classification | Count | Agents |
|---|---|---|
| CONTRACT READY | **0** | none emit canonical envelope today |
| ADAPTER READY | **3** | `arbitrage`, `trend`, `volume` |
| NEEDS OUTPUT CORRECTION | **7** | `pattern`, `sentiment`, `price_prediction`, `portfolio`, `fundamental`, `market_intelligence`, `risk` |
| NEEDS REAL IMPLEMENTATION | **3** | `technical`, `timing`, `liquidity` |
| NOT AN ANALYTICAL EVIDENCE PRODUCER | **2** | `order`, `optimization` |
| **TOTAL** | **15** | registry `AGENT_MODULES` |

`artemis_decision` remains a capability/policy key only — **not** a 16th Agent in this count.

### Secondary Artemis readiness (not another primary class)

| Agent | Secondary dimension |
|---|---|
| `liquidity` | feasibility readiness = **UNAVAILABLE / BLOCKED** |
| `pattern` | real-source evidence readiness = **BLOCKED** until provenance is proven canonical |
| `optimization` | sizing/control authority = **NOT_APPLICABLE** |
| `trend` / `arbitrage` / `volume` | WP-B.1 adapter-eligible; still `executionEligible=false` |

---

## 7. Role taxonomy

| Role | authorityClass | Who | Same base envelope? | Sub-schema | Vote in synthesis? |
|---|---|---|---|---|---|
| ANALYTICAL EVIDENCE PRODUCER | `analytical_evidence` | technical, trend, pattern, volume, sentiment, fundamental, market_intelligence | yes | analytical extension | evidence only — **not equal votes** |
| OPPORTUNITY / FORECAST | `opportunity_forecast` | price_prediction, timing, arbitrage | yes | opportunity extension | evidence; not execution |
| RISK AUTHORITY / VETO | `control_veto` | risk (+ risk-gate service) | base + veto sub-schema | `verdict`, limits, flags | **authoritative**; beats analytical majority |
| PORTFOLIO / ALLOCATION | `control_sizing` | portfolio | base + sizing sub-schema | constraints, proposed weights | sizing only; no direction |
| OPTIMIZATION | **`not_applicable`** | optimization | not a control envelope in WP-B | utility/backtest only until a dedicated WP proves inputs, truthful account state, bounded sizing, deterministic output, authority, tests | not a vote |
| LIQUIDITY / FEASIBILITY | `execution_feasibility` | liquidity | base + feasibility sub-schema | book ts, spread, slippage, max size, expiry | feasibility only; currently UNAVAILABLE / BLOCKED |
| ORDER EXECUTION | `execution` | order | execution audit schema, **not** market evidence | intent + gates | never chooses direction |
| DATA / CONTEXT PROVIDER | n/a | Data Hub / Connections | not Agent envelope | context refs only | not votes |

**Hard rules:** no equal-vote Agent model. Risk veto preserved. Order never decides direction. Liquidity never implies analytical direction. Portfolio must not invent balances. Optimization is **not** `control_sizing` merely because of its name.

---

## 8. Confidence provenance model

**Do not** normalize arbitrary 0–100 and 0–1 scores into one “confidence %”.

Proposed object (required when `availability=available`; otherwise whole object `unavailable`):

```
confidence: {
  availability: available | unavailable,
  value: number | null,          // only if available
  scale: unit_interval | percent_100 | unknown,
  kind: MEASURED | MODEL_PROBABILITY | CALIBRATED | HEURISTIC | RULE_SCORE | DERIVED | LEGACY | UNAVAILABLE,
  calibrationState: uncalibrated | pending | calibrated | not_applicable | unavailable,
  sampleWindow: { n?, from?, to? } | unavailable,
  provenance: { methodKey, writer, notesKey? }
}
```

| Agent | Today | Map to kind | WP-B adapter? |
|---|---|---|---|
| `trend` | Snapshot `strength` = `raw.trend.confidence` (0–100). `trendRunService` persists `ai_decisions.confidence` as that value/100, else `_meta.confidence`. `_meta.confidence` is **normalized strength**, not epistemic/predictive confidence. | **UNAVAILABLE** for first adapter | yes for **strength** only. Do not emit `confidence.value` from strength or `_meta.confidence`. |
| `arbitrage` | 0.1–0.85 from candidate count (explicit Agent field) | HEURISTIC | yes — not model probability; explicit 0.5 remains valid if produced |
| `volume` | 0–100 heuristic when Agent emits it; generic writer may store 0.5 if missing | HEURISTIC if explicit; else UNAVAILABLE | yes after fallback-provenance check |
| `pattern` | avg pattern scores 0–1 | HEURISTIC only after real-source provenance | **no** in WP-B.1 |
| `sentiment` | 0–1 from source count | HEURISTIC | no until sources truthful |
| `price_prediction` | mixed scales; uncalibrated | MODEL_PROBABILITY only if method documented; else HEURISTIC/UNAVAILABLE | no |
| `market_intelligence` | 0–100 heuristic | HEURISTIC | after scale fix |
| `fundamental` | 0–1 from placeholders | LEGACY / UNAVAILABLE | no |
| `risk` | 0.3–0.95 from counts | RULE_SCORE (not veto strength) | control schema later |
| `technical` / `timing` / `liquidity` | random / constant 0.55 | UNAVAILABLE (fake) | **never emit as confidence** |
| `order` / `optimization` | none / writer fallback possible | UNAVAILABLE | n/a |

### 8.1 Generic `0.5` fallback rule (B0 APPROVED)

Writer: `agentExecutionService.js` inserts  
`typeof result?.confidence === 'number' ? result.confidence : 0.5`.

**Do not implement** `if confidence === 0.5 → unavailable`. That would destroy legitimate explicit 0.5 values.

Canonical rule:

- If the Agent output has **no explicit confidence field**, AND persisted `ai_decisions.confidence` is `0.5` because generic `agentExecutionService` supplied its missing-confidence fallback → `confidence.availability = unavailable`.
- If the Agent **explicitly produced** a documented confidence of exactly `0.5` with valid provenance and semantics → it remains valid.

Tests must cover both cases. Provenance must identify the writer (`agentExecutionService` fallback vs Agent emit).

---

## 9. Freshness / temporal contract

Distinguish four times:

| Clock | Field | Meaning |
|---|---|---|
| Analysis | `analysisTimestamp` | Agent run completed |
| Source data | `sourceTimestamp` / `sourceCandleTimestamp` | market/event time used |
| Ingestion | (optional, Data Hub) | when TitanGold ingested |
| Persistence | `createdAt` / `completedAt` | `ai_decisions.created_at` |

```
freshness: {
  status: fresh | aged | stale | expired | unknown | unavailable,
  reasonKey: string | null,
  analysisTimestamp: iso8601,
  sourceTimestamp: iso8601 | unavailable,
  policyId: string,          // per-agent policy, not one global TTL
  maxAgeMs: number | unavailable
}
```

**Do not** hardcode one TTL.

Canonical Artemis freshness is **stricter** than a product display convenience. The frozen Trend domain may:

- fall back to analysis time when source-candle time is missing (`computeFreshness` uses `basisTs = candleTs || analysisTs`);
- default unknown timeframe to `1h` (`TIMEFRAME_MS[timeframe] || TIMEFRAME_MS['1h']`; product DTO `timeframe || '1h'`).

**The WP-B evidence adapter MUST NOT convert those product fallbacks into a fake `fresh` state.**

For Artemis evidence:

- missing **actual** `sourceTimestamp` / `sourceCandleTimestamp` → `freshness.status = unknown`
- unknown timeframe → do **not** silently assume `1h` for canonical evidence freshness

A product DTO may remain frozen and unchanged. The adapter owns the stricter Artemis truth projection.

| Agent family | Realistic policy (design) |
|---|---|
| Trend / volume / technical (OHLCV) | relative to **actual closed candle** + **known** timeframe only; else `unknown` |
| Pattern | not in WP-B.1; later: same OHLCV rule only after real-source provenance |
| Arbitrage spreads | short wall-clock (seconds–minutes); scan timestamp |
| Sentiment / MI / fundamental | source `publishedAt` if present; else unknown |
| Risk / portfolio | account-state freshness; stale ≠ analytical stale |
| Liquidity | order-book ts; stale feasibility **never** execution approval (WP-C/D) |

---

## 10. Data-quality / limitations

```
dataQuality: {
  status: ok | degraded | insufficient | unavailable,
  sourceAvailability: available | degraded | unavailable | not_applicable,
  coverage: unavailable | { expected?, observed?, unit? },  // only if measured
  completeness: unavailable | degraded | ok,
  staleness: mirrors freshness.status,
  providerDegradation: boolean | unavailable,
  sampleAdequacy: ok | insufficient | unavailable,
  knownLimitationKeys: string[]
}
```

**No fake percentages.** Artemis minimum to classify evidence:

| Class | Rule |
|---|---|
| usable | `availability=available` AND `freshness.status∈{fresh,aged}` AND `dataQuality.status∈{ok,degraded}` AND confidence not required-fake |
| degraded | available but aged/degraded/sample thin — displayable, not confirming |
| unavailable | mock source, missing run, blocked, or fake confidence |

Limitations are **required** (array). Frozen Trend/Arbitrage already have truthful limitation language — adapters must copy keys, not invent success.

---

## 11. Bounded evidence payload

`evidence` is **not** arbitrary JSON.

Allowed item types: facts/observations, indicators/features, detected patterns, supporting metrics, source **references** (ids/names), counter-evidence, uncertainty flags, explanation **keys**.

Disallowed in normal Artemis evidence: raw provider payloads, signed URLs, credentials, full `input_data`/`output_data` blobs, PII, chat IDs.

Size: ≤32 items; ≤8 KB serialized envelope target; reject oversize at validation.

---

## 12. Correlation / double-counting

Artemis must not treat correlated Agents as independent confirmation.

| Family ID | Likely members | Shared source | WP-B metadata | WP-C scoring |
|---|---|---|---|---|
| `ohlcv_candle_family` | technical, trend, pattern, volume, timing (partial), price_prediction (partial) | same OHLCV | emit `correlationFamily` + provider/symbol/TF/sourceCandleTimestamp | dedup weight |
| `microstructure_family` | volume, liquidity (future) | trades/book | family id only | partial overlap |
| `external_narrative_family` | sentiment, market_intelligence, fundamental (news) | external feeds | feed/source ids if known | shared-source penalty |
| `account_state_family` | risk, portfolio, optimization | balances/positions | **not votes** | control chain |
| `spread_monitor_family` | arbitrage | venue bid/ask | independent unless proven | keep separate |
| `execution_path_family` | liquidity, order | feasibility + intent | not analytical confirmation | WP-C/D |

WP-B only **tags** lineage (`correlationFamily`, provider, venue, symbol, timeframe, source window).  
WP-C implements correlation-aware synthesis. **No scoring algorithm now.**

---

## 13. Persistence / lineage

### What `ai_decisions` is today

Agent-run SoT: `id`, `agent_id` (UUID), `user_id`, `decision_type`, `input_data`, `output_data`, `confidence`, `was_successful`, `execution_time_ms`, `created_at`, `metadata`, `agent_version`.

Writers: `agentExecutionService` (skips arbitrage), `trendRunService`, `arbitrageRunService`, `risk-gate`, some routes.

Artemis `/decision` does **not** INSERT here.

### Decision

| Question | Recommendation |
|---|---|
| A. Initial evidence generation | **On-read adapters** from existing `ai_decisions.output_data` / product DTOs. Optionally cache later. |
| B. Future persist owner | New append-only `artemis_evidence_packages` (name TBD) — **gated migration, not WP-B.1** |
| C. Lineage chain | Agent run (`ai_decisions.id`) → evidence package → Artemis evaluation → Artemis decision → Risk verdict → execution intent |
| D. Replay | Store envelope + contractVersion + codeImplementationVersion; replay must distinguish original vs recomputed |
| E. Schema retention | Keep old `contractVersion` readable; never overwrite historical rows |
| F. Idempotency | `runId` + `contractVersion` + `adapterVersion` unique |
| G. Audit | PRODUCT-SAFE projection only; full envelope INTERNAL/DIAGNOSTIC |

**Preserve `ai_decisions`.** Do not overwrite frozen Trend/Arbitrage `output_data`.  
**B0 APPROVED:** WP-B.1 uses **on-read** evidence generation only. **NO evidence table migration.** B10 remains a separate future gated decision after on-read evidence is proven end-to-end.

### 13.1 B7 read-SQL correction (Owner-authorized, scoped)

Confirmed defect: Artemis `/logs` and readiness queries select `d.input` / `d.output` while canonical columns are `input_data` / `output_data`.

B7 **MAY** correct these read-only column references.

Do **not**:

- reopen WP-A UI
- expose raw `input_data` / `output_data`
- weaken the existing safe projection
- add debug/raw endpoints
- change execution semantics

Product routes must continue returning allowlisted safe projections only.  
Regression tests must prove raw `input_data` / `output_data` never leak.

---

## 14. Artemis consumption contract (design only)

Future ingestion service (no API implementation now):

`validateAndAcceptEvidence(envelope, policy) → { status, reasons[] }`

Required behaviors:

- reject invalid schema / unknown fields / authority mismatch
- reject stale where policy requires (else mark `stale_evidence`)
- unavailable ≠ neutral ≠ HOLD vote
- preserve `agentId`, provenance, confidence.kind, limitations, correlationFamily
- missing Risk ≠ approval
- missing Liquidity ≠ executable
- legacy `approved:true` ≠ execution approval
- WP-A `/decision` remains LEGACY_ADVISORY until WP-C consumer replaces MoE

Minimum boundary: internal service + later `GET` read-only list of latest envelopes per `agentId`+symbol+TF for UI.  
**No POST that triggers Live. No `/decision` semantic change in WP-B.**

---

## 15. Frontend product implications (WP-A UI frozen)

Do **not** redesign IA. Map future data ownership only:

| Screen (WP-A id) | Would consume | Simple-safe | Advanced/Diagnostics | Until WP-C/D remains |
|---|---|---|---|---|
| Home / Overview | readiness + blocker keys; not full envelopes | maturity, kill switch, evidence UNAVAILABLE until adapters live | contract versions | orchestration fake metrics |
| AI Inputs / Evidence | latest envelopes by role group | agentId, availability, freshness.status, conclusion.direction if available | confidence.kind, limitations, evidence.items | fake envelopes |
| Recommendations / Decisions | Artemis evaluation (WP-C) | advisory-only label, counts without contradiction | lifecycle state | MoE `approved` as execution |
| Coordination / Orchestration | correlation families + realAgentCoordination | “not connected” until WP-C | family dedup explanation | mock resource % |
| Safety & Approval / Controls | control-chain status | Risk veto / liquidity BLOCKED / order not eligible | Risk UUID debt | fake Available liquidity |
| History & Audit / Lineage | projected audit + future evidence runIds | product-safe log fields | envelope versions | raw metadata |
| System Health | readiness contract.implemented / compatibleAgentCount | truthful counts | provenance SHA | dual-config debt |

Simple view: no engineering tokens (`authorityClass`, UUID, correlationFamily ids).  
Advanced: contract fields. Diagnostics: INTERNAL only, never ordinary `user`.

---

## 16. Security / RBAC

| Class | Examples | user/vip | trader | admin |
|---|---|---|---|---|
| PRODUCT SAFE | agentId, symbol, TF, direction, availability, freshness.status, limitation keys, advisory flags, executionEligible=false | yes | yes | yes |
| PRIVILEGED DIAGNOSTIC | evidence item values, algorithm versions, correlationFamily, adapter errors | no | limited | yes |
| INTERNAL ONLY | full `output_data`, provider error bodies, run SQL, mock flags | no | no | logs only |
| SECRET / NEVER RETURN | JWT, API keys, signed URLs, credentials, chat IDs | never | never | never |

Reuse WP-A `artemisAuditProjection` allowlist pattern. Same projection for all roles on product routes; do not reintroduce raw `metadata` / `input` / `output` / `input_data` / `output_data`.  
B7 SQL correction must ship with regression tests proving those blobs never leak on product routes.  
No user-ownership migration now.

---

## 17. Versioning / compatibility

**B0 APPROVED — keep through initial WP-B adapters:**

- `schemaVersion = 1.0.0` (structure)
- `contractVersion = artemis-evidence-1.0.0` (semantics + enums)

Do **not** bump merely because Trend / Arbitrage / Volume adapters are added.  
Version bump requires actual contract semantic/schema compatibility impact.  
`adapterVersion` remains separate from `contractVersion`.

Policy:

- Additive optional fields allowed in `1.0.x` / `1.x` with consumer ignore-unknown **only inside privileged diagnostic**, not product allowlist.
- Ingress **rejects** unknown fields (fail closed).
- Deprecated fields: keep readable ≥ one minor; never required for new emits.
- Adapter version separate (`adapterVersion`) from contractVersion.
- Replay uses **stored** contractVersion, not “latest code reinterpretation” unless explicitly labeled recomputed.
- Breaking change → `2.0.0` + Owner approval + Agent list + Artemis consumer impact.

No implementation now.

---

## 18. WP-B / WP-C / WP-D boundary

**B0 APPROVED** (Discovery split, with clarifications). Foundation’s types-only WP-B is rejected: WP-B must prove the contract with real read-only adapters.

### IN WP-B (Owner-approved scope — implementation still **not** started / not authorized by B0)

- Canonical envelope + identity normalization + validation
- Truthful confidence / freshness / DQ semantics (Trend strength ≠ confidence; no fake 1h/fresh; fallback-provenance for 0.5)
- Read-only adapters: **Trend → Arbitrage → Volume** (outside frozen product owners)
- On-read projection from `ai_decisions` / product DTOs
- Safe RBAC projection
- Readiness `compatibleAgentCount` only when adapters actually return envelopes
- Read-only SQL correction (`input`/`output` → `input_data`/`output_data`) with leak regression tests
- **NO** orchestration replacement
- **NO** migration in WP-B.1
- **NO** Pattern adapter in WP-B.1

Optional later **B10 / WP-B.2 (gated):** append-only evidence persistence — only after on-read evidence is proven end-to-end.

### DEFER WP-C

- Real Artemis evidence consumption
- Retirement of mock `callAgentAPI` / `agent-N` orchestration
- Conflict resolution
- Correlation-aware synthesis (use WP-B tags)
- Risk / Portfolio / Liquidity / runtime control chain
- Authenticated TE → Artemis transport
- Advisory decision lifecycle integration

### DEFER WP-D

- Lineage / replay / evaluation / calibration
- Shadow
- Paper
- Promotion evidence
- Operational maturity

Dedicated Agent productization may be required before WP-C/D can use Agents such as Technical, Timing, Liquidity, Pattern, etc.

### OUT OF PROGRAM (this Artemis evidence program)

- Reopening WP-A UI / Data Hub / Trend / Arbitrage product IA
- Equal-vote Agent model
- Expanding scheduler allowlist
- Enabling Live / orders / private credentials for “evidence testing”
- Treating `optimization` as `control_sizing` or directional evidence
- Treating Order Management as market oracle
- Implicit WP-B.1 authorization from this B0 round

---

## 19. Proposed WP-B implementation work packages (DO NOT EXECUTE)

| ID | Outcome | Likely files | DB | FE | BE | Tests | Migration | Safety | Human QA | Deps | Rollback |
|---|---|---|---|---|---|---|---|---|---|---|---|
| B0 | Owner review + baseline corrections | docs + Rule 02 only | 0 | 0 | 0 | n/a | no | n/a | **COMPLETE this round** | — | n/a |
| B1 | Shared contract module + Zod + fixtures (`1.0.0` / `artemis-evidence-1.0.0`) | new `backend/services/artemisEvidenceContract.js` (or `contracts/`), schemas, unit tests | 0 | types-only optional | new module | unit golden | no | low | no | B0 + **WP-B.1 auth** | delete module |
| B2 | Identity normalizer owner (backend) | catalog reuse / `agentIdentity.js`; tests for all aliases incl. `trend_detection` → `trend` | 0 | **frozen FE keys unchanged** | yes | unit | no | low | no | B1 | revert module |
| B3 | Confidence/freshness/DQ helpers; fallback-provenance for 0.5; Trend strength ≠ confidence; unknown freshness if no source candle / TF | contract helpers + tests (explicit 0.5 vs writer fallback; missing candle → unknown) | 0 | 0 | yes | unit | no | med (truth) | no | B1 | revert |
| B4 | Trend read-only adapter | new adapter **outside** `trendDomain.js`; reads persisted snapshot; `conclusion.strength` truthful; `confidence=UNAVAILABLE` | read | 0 | yes | unit + snapshot fixtures | no | med | no (frozen UI) | B1–B3 | disable adapter |
| B5 | Arbitrage read-only adapter | new adapter outside arbitrage product DTOs | read | 0 | yes | unit | no | med | no | B1–B3 | disable adapter |
| B6 | Volume adapter (explicit confidence only; fallback-provenance) | new adapter; **Pattern not included** | read | 0 | yes | unit | no | med | no | B1–B3 | disable |
| B7 | On-read projection + scoped SQL column fix | `artemis.js` read path, readiness evidence block; **leak regression tests** | read | 0 | yes | API contract + no-raw-blob tests | no | med | light | B4–B6 | revert SQL + hide evidence |
| B8 | RBAC product projection for envelopes | extend audit-projection pattern | 0 | 0 | yes | unit | no | high (leak) | no | B1 | revert |
| B9 | Readiness truthful counts | `artemisReadinessService.js` | 0 | frozen UI already displays fields | yes | unit | no | low | no | B7 | revert counts |
| B10 | Optional persist table | new migration + writer | **yes — gated after on-read proof** | 0 | yes | db tests | **explicit Owner** | high | yes | B7 | down migration |

**WP-B.1 implementation is not authorized by this B0 document.** Next gate: explicit **WP-B.1 IMPLEMENTATION AUTHORIZATION**.

---

## 20. B0 Owner decisions (RESOLVED)

All discovery open questions from HEAD `1f5cd78` are **closed**. See §1.1 for the full table.

Remaining items are **not** open B0 questions; they are future gates:

1. Explicit **WP-B.1 IMPLEMENTATION AUTHORIZATION** (required before any runtime code).
2. Later Pattern adapter only after canonical real-source provenance (not `source != mock` alone).
3. B10 persist table only after on-read evidence is proven end-to-end.
4. Dedicated Optimization authority WP before any `control_sizing` label.
5. Dedicated productization for Technical / Timing / Liquidity (and Pattern) before WP-C/D consumption.

---

## 21. Risk register

| Risk | Impact | Mitigation in WP-B |
|---|---|---|
| Naive `0.5 → unavailable` destroys legitimate scores | false unavailability | fallback-provenance only; tests for explicit vs writer 0.5 |
| Trend strength mapped to `confidence.value` | false epistemic certainty | first adapter: strength stays strength; confidence UNAVAILABLE |
| Product freshness fallback (analysis time / default 1h) copied into envelope | fake `fresh` | adapter emits `unknown` when source candle or TF missing |
| Adapter mutates frozen Trend/Arbitrage | product regression | adapters **outside** frozen modules; read-only |
| B7 SQL fix leaks `input_data`/`output_data` | WP-A class leak | allowlist projection + leak regression tests |
| Pattern mock OHLCV treated as evidence | false confirmation | Pattern not in WP-B.1; later fail unavailable without proven provenance |
| Optimization labeled `control_sizing` by name | false authority | WP-B: NOT_APPLICABLE; Portfolio remains sizing candidate |
| `agent-N` mapped to real agents | wrong identity | map to unavailable/legacy only |
| WP-B silently reopens `/decision` semantics | execution creep | do not edit containment/TE gate |
| Correlation ignored | double-counting later | emit family tags now; no scoring |
| Migration without approval | SoT split / data loss | B10 gated; default on-read only |
| UI redesign under “just show evidence” | WP-A freeze break | no FE IA work; optional later WP-C wiring |
| B0 treated as WP-B.1 authorization | unapproved runtime | Rule 02 next gate is explicit WP-B.1 IMPLEMENTATION AUTHORIZATION |

---

## 22. Explicit non-goals

- Reopen or restyle WP-A UI
- Modify Data Hub / Trend / Arbitrage product behavior
- Implement orchestration, conflict engine, or control chain
- Enable Live, orders, private provider calls, or scheduler expansion
- Create a second Artemis contract or per-Agent schema owner
- Equal-weight Agent voting
- Fake NEUTRAL/HOLD for missing Agents
- Treat `approved:true` as execution
- Implement Liquidity feasibility or Order direction
- Shadow/paper/Live maturity stages
- Any deploy or worker/Scheduler mutation in discovery, B0, or before WP-B.1 authorization
- Pattern adapter in WP-B.1
- Mapping Trend strength / `_meta.confidence` to Artemis `confidence.value`
- Naive `confidence === 0.5 → unavailable`
- Copying Trend product freshness fallbacks (analysis-time / default `1h`) into canonical evidence
- Labeling Optimization `control_sizing` in WP-B
- Implicit WP-B.1 implementation from this B0 round

---

## 23. Discovery provenance

| Item | Value |
|---|---|
| Rule 01 | TitanGold Core Engineering Rules **v4.6** |
| origin/main used | `845ea0d35b75b1beca516be235f47d98c5703692` |
| WP-A product baseline | `7c13fe13015de1b44ab534dff8deb72c6e5f5668` |
| Discovery branch | `feat/artemis-wp-b-evidence-contract-discovery` |
| Prior discovery HEAD | `1f5cd787947af461394ebdb37b0693525c361312` |
| Runtime code changed | NO |
| Migration | NO |
| Implementation started | NO |
| WP-A remains frozen | YES |
| Rule 02 | ARTEMIS WP-B — B0 OWNER-APPROVED EVIDENCE CONTRACT BASELINE |
| Next gate | WP-B.1 IMPLEMENTATION AUTHORIZATION |

**Verdict:**  
**ARTEMIS WP-B — B0 OWNER REVIEW COMPLETE**  
**CONTRACT BASELINE APPROVED WITH CORRECTIONS**  
**IMPLEMENTATION NOT STARTED** *(historical B0 closeout; superseded by §24 WP-B.1 ledger)*

---

## 24. WP-B.1 Evidence Ledger (current Source of Truth)

| Item | Value |
|---|---|
| Outcome | Canonical Evidence Foundation 1.0.0 + on-read Trend/Arbitrage/Volume adapters |
| Risk tier | Shared Foundation / Tier 2 |
| B0 baseline | `b2b42271d45260296e70b222293f33b1591562d9` |
| origin/main | `845ea0d35b75b1beca516be235f47d98c5703692` |
| WP-A product (FROZEN) | `7c13fe13015de1b44ab534dff8deb72c6e5f5668` |
| Commit A (contract + identity + truth) | `78a9c7d969f90e5dddd3ad5485b41406f102170f` |
| Commit B (Trend/Arbitrage/Volume adapters) | `85b0b04c81bb36b3ab07d46fa312e0b885d0aacc` |
| Commit C (on-read + SQL + readiness + i18n) | `11a178be97938b6113b1ab8565f616b9fa8a93d3` |
| Pre-Human-QA validator strictness | `6c12fe69bf109f8969fc437476c8f5b679f15aa3` |
| Pre-Human-QA frontend consumption truth | `4652c36f21039e7f99f2600751a007b73a0347c4` |
| Semantic hardening implementation | `48d7722b651e1d551bbbf128eaa30e1b1c136163` |
| Documentation HEAD | *(this Human QA PASS docs milestone commit)* |
| Backend runtimeCommit (Staging) | `48d7722b651e1d551bbbf128eaa30e1b1c136163` |
| Frontend product implementation tree | `4652c36f21039e7f99f2600751a007b73a0347c4` |
| Served frontend bundle | `assets/index-DRB6fBxf.js` |
| Docs milestone vs runtime | This Human QA PASS docs update is **NOT** the deployed runtime SHA · runtime remains `48d7722` · frontend product tree `4652c36` · served `assets/index-DRB6fBxf.js` |
| Data Hub lazy chunk | `assets/DataHubWorkspace-DmjSjCKZ.js` |
| schemaVersion / contractVersion | `1.0.0` / `artemis-evidence-1.0.0` *(not bumped)* |
| Adapter versions | trend `1.0.0` · arbitrage `1.0.0` · volume `1.0.0` |
| Compatible agents | 3 (`trend`, `arbitrage`, `volume`) |
| Catalog readiness | `ROLE_MAPPED` + `consumption=evidence_compatible` for Trend/Arbitrage/Volume |
| Artemis integration readiness | **NOT** `EVIDENCE_READY` · `evidence.readiness=ON_READ_PARTIAL` · `artemisConsumable=false` |
| Pattern | BLOCKED / excluded from WP-B.1 |
| Optimization | `NOT_APPLICABLE` for sizing/control |
| Artemis consumable | **false** |
| Decision eligible | **false** |
| executionEligible | **false** |
| approvedForExecution | **false** |
| Maturity | `LEGACY_ADVISORY` / `LEGACY_ADVISORY_ONLY` |
| Persistence | On-read only · **no** `ai_decisions` migration · **no** B10 table |
| SQL column fix | `/logs` + readiness use `d.input_data AS input`, `d.output_data AS output` |
| Identity | envelope `agentId` = one of 15 canonical keys only · alias/`agent-N` rejected by validator |
| UUID identifiers | `agentRecordId`/`runId`/`correlationId`/`decisionContextId` = UUID, `null`, `"unavailable"`, or `{availability:unavailable\|not_applicable\|blocked, reasonKey?}` |
| dataQuality | status/sourceAvailability/completeness/sampleAdequacy enums · staleness=freshness states · providerDegradation boolean or unavailable · coverage unavailable or `{expected,observed,unit}` |
| confidence | `calibrationState` enum · `sampleWindow` unavailable or bounded `{start,end,size,unit}` |
| EvidenceItem nested | freshness/provenance use the same sub-schemas as the top-level contract |
| Role extensions | analytical ≠ opportunity ≠ veto ≠ sizing ≠ feasibility ≠ execution · Optimization `NOT_APPLICABLE` · no fake Risk/Liquidity/Order adapters |
| Nested contract | allowlisted conclusion/strength/confidence/freshness/dataQuality/provenance/EvidenceItem/ownershipScope/opportunity/control/allocation/feasibility |
| Secret scan | defense in depth · still rejects JWT/API key/token/`input_data`/`output_data`/`metadata` |
| Trend confidence | UNAVAILABLE · `conclusion.strength` from `raw.trend.confidence` (`percent_100`) |
| Generic writer 0.5 | UNAVAILABLE unless explicit Agent confidence field exists |
| Freshness | missing/ambiguous source or unknown TF → `unknown` · never assume `1h` |
| Frozen diff vs B0 | Trend/Arbitrage/Data Hub/WP-A IA/containment/TE gate owners = **unchanged** |
| Backend unit | `npm run test:unit` → **100 passed / 100 total / 728 tests / EXIT 0** |
| Frontend Artemis regression | `ArtemisWpA.test.tsx` → **35 passed / 35** |
| Production frontend build | `npm run build` → **PASS** |
| Staging Browser QA | authenticated Simple+Advanced 7 sections + Data Hub nav → **69/69 PASS** |
| Migration | **NO** / **0** |
| Private/public provider calls | **0** |
| Agent executions for testing | **0** |
| titan-engine-worker | pid `1454` / `1510` · restart `0` · topology unchanged |
| Live / orders / transfers / withdrawals | **0** |
| PR | **not created** · READY FOR PR FINAL REVIEW |
| Human QA | **PASS** (Owner) |
| Closed / frozen | **NO** · **NOT CLOSED** · **NOT FROZEN** · **NOT MERGED** |

### 24.1 Recovery from interrupted local work

| Field | Value |
|---|---|
| Interrupted local HEAD before resume | `b2b42271d45260296e70b222293f33b1591562d9` |
| Remote implementation branch HEAD before resume | `b2b42271d45260296e70b222293f33b1591562d9` |
| Interrupted modified/untracked | Rule 02 WP-B.1 · `backend/contracts/artemisEvidenceContract.js` · catalog timing alias (partial) |
| Partial file repaired | `artemisEvidenceContract.js` secret-key scan folded into `validateEvidenceEnvelope` |
| Work lost | **NO** |
| reset/stash/clean used | **NO** |

### 24.2 Remaining gates

- Owner Human QA: **PASS** (see §24.5)
- Next: Owner merge decision after PR CI + independent review
- Do **not** merge without explicit Owner authorization
- Do **not** start WP-C orchestration or B10 persistence
- Do **not** label Trend/Arbitrage/Volume as `EVIDENCE_READY` merely because on-read adapters exist
- Keep `artemisConsumable` / `decisionEligible` / `executionEligible` = **false**
- Keep Pattern excluded · Optimization `NOT_APPLICABLE`
- Superseded by §25 — WP-B.1 CLOSED AND FROZEN

### 24.3 Pre-Human-QA remediation

| Item | Value |
|---|---|
| Independent review blockers | unknown `agentId` not fail-closed in validator · nested JSON only size/secret-scanned · `EVIDENCE_READY` overclaim · frontend not deployed |
| Validator | canonical `agentId` allowlist + nested field allowlists + typed optional domains · secret scan retained |
| Frontend align | WP-B.1 product copy deployed to `https://titan.zala.ir` · Home no longer treats `evidenceCompatible` as Artemis-connected |
| Backend deploy | `titan-backend` by NAME only · runtime `6c12fe6` |
| Frontend deploy | nginx root `/home/ubuntu/webapp/TitanGold/dist` · served `index-DRB6fBxf.js` |
| Worker restart | **0** |
| Authenticated `/readiness`+`/logs` | `implemented=true` · `compatibleAgentCount=3` · `ON_READ_PARTIAL` · `artemisConsumable/decisionEligible/executionEligible=false` · `orchestration=LEGACY` · `sourceError=null` |
| Browser QA | Simple + Advanced · no raw enums/i18n keys/WP-B/WP-C copy in Simple · Optimization truthful · Pattern blocked · Advisory only · Data Hub canonical mount |
| Pre-existing Data Hub console | hydration `<div>` inside `<p>` on Data Hub nav · **not** WP-B.1 owned · Data Hub remains FROZEN |

### 24.4 Canonical contract semantic hardening

| Item | Value |
|---|---|
| UUID identifiers | available = RFC 4122 · absent/`null` allowed · `"unavailable"` or `{availability, reasonKey?}` · reject `foo`/`run-1`/`agent123` |
| dataQuality | real enums · no fake coverage percent · measured coverage must declare expected/observed/unit |
| confidence | `calibrationState` ∈ uncalibrated/pending/calibrated/not_applicable/unavailable |
| sampleWindow | unavailable representation or bounded ISO start/end + non-negative integer size + unit enum |
| EvidenceItem | nested freshness/provenance validated with the same sub-schemas |
| Role model | identity/authority mapping for 15 agents is separate from role-payload validation |
| WP-B.1 emitters | Trend / Arbitrage / Volume only · Pattern excluded · Optimization `NOT_APPLICABLE` |
| Invalid roles | Risk/Portfolio/Optimization/Liquidity/Order analytical BUY/SELL/bullish envelopes rejected · Arbitrage directional vote rejected |
| Execution | still fail-closed · `artemisConsumable/decisionEligible/executionEligible=false` · TE gate untouched |
| Frontend | not redeployed · previous Browser QA remains valid · bounded smoke only |

### 24.5 Owner Human QA

| Item | Value |
|---|---|
| OWNER HUMAN QA | **PASS** |
| Milestone | Staging Artemis product truthfulness after WP-B.1 Evidence Foundation |
| Visual / product checks (no screenshots / no secrets) | recorded below |
| Home truthful advisory-only state | **PASS** |
| AI Inputs working ≠ connected | **PASS** |
| Pattern blocked | **PASS** |
| Liquidity blocked | **PASS** |
| Order unavailable | **PASS** |
| Recommendations advisory-only | **PASS** |
| Coordination not active | **PASS** |
| Emergency Stop active | **PASS** |
| Execution unavailable | **PASS** |
| History/Audit safe | **PASS** |
| System Health truthful | **PASS** |
| Advanced diagnostics consistent | **PASS** |
| Data Hub regression | **PASS** |
| Eligibility flags unchanged | `artemisConsumable=false` · `decisionEligible=false` · `executionEligible=false` |
| Pattern / Optimization | Pattern **excluded** · Optimization **NOT_APPLICABLE** |
| Staging runtime notes | Backend Staging runtime remains `48d7722` · frontend product tree `4652c36` · served bundle `assets/index-DRB6fBxf.js` |
| Docs vs deploy | This docs milestone is **NOT** the deployed runtime SHA |

**Verdict:**  
**ARTEMIS WP-B.1 — IMPLEMENTATION COMPLETE**  
**CANONICAL EVIDENCE FOUNDATION VERIFIED**  
**AUTOMATED QA PASS**  
**BROWSER QA PASS**  
**OWNER HUMAN QA PASS**  
**READY FOR PR FINAL REVIEW**  
**SUPERSEDED BY §25 — WP-B.1 CLOSED AND FROZEN**


## 25. WP-B.1 CLOSEOUT — CLOSED AND FROZEN

| Item | Value |
|---|---|
| Final state | **ARTEMIS WP-B.1 — CLOSED AND FROZEN** |
| PR #20 product merge | `26d0128d56f3babcd20d848331c096265e03f608` |
| PR #21 Telegram/main source alignment | `eee00a8bb93ecd9e29f30acbb69b355cb433c1c2` |
| Owner Human QA | **PASS** |
| Final-head CI | **PASS** |
| Independent review | **PASS** |
| Staging content alignment | **PASS** (product content equivalence; no-op full-tree deploy avoided) |
| Browser regression | **PASS** (bounded Staging smoke) |
| Migration | **0** |
| Provider calls (validation) | **0** |
| Agent execution (validation) | **0** |
| Financial side effects | **0** |
| Artemis maturity | Advisory only (`LEGACY_ADVISORY_ONLY`) |
| Evidence readiness | `ON_READ_PARTIAL` — **NOT** `EVIDENCE_READY` |
| `artemisConsumable` | `false` |
| `decisionEligible` | `false` |
| `executionEligible` | `false` |
| Orchestration | `LEGACY` / advisory-only |
| Pattern | excluded |
| Optimization | `NOT_APPLICABLE` |
| WP-C started | **NO** |
| B10 started | **NO** |

### 25.1 Content-alignment provenance (do not conflate with docs SHA)

| Component | Verdict |
|---|---|
| Backend WP-B.1 runtime paths vs main | content-equivalent (Human-QA baseline `48d7722` ≡ main) |
| Frontend WP-B.1 runtime paths vs main | content-equivalent (Human-QA tree `4652c36` ≡ main) |
| Served bundle | `assets/index-DRB6fBxf.js` |
| Telegram processor vs main | content-equivalent (hotfix already production + PR #21) |
| Backend redeploy / restart for closeout | **NOT REQUIRED** |
| Frontend redeploy for closeout | **NOT REQUIRED** |
| Telegram redeploy / restart for closeout | **NOT REQUIRED** |
| Docs closeout SHA | documentation milestone only — **not** claimed as deployed product runtime SHA |

### 25.2 Operational topology retained

- `telegram-processor` id11 = online
- `telegram-processor` id15 = STOPPED (NO DELETE)
- collector id16 = online (untouched)
- duplicate collector id12 = STOPPED (untouched)
- frontend Vite PM2 ids 7/13 = STOPPED (untouched)
- engine workers = untouched

**Verdict:**  
**ARTEMIS WP-B.1 — CLOSED AND FROZEN**  
**WP-C NOT STARTED**  
**B10 NOT STARTED**
