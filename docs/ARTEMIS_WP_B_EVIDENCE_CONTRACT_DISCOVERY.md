# Artemis WP-B — Canonical Evidence Contract + Agent Compatibility Discovery

**Status:** DISCOVERY COMPLETE — READY FOR OWNER REVIEW — IMPLEMENTATION NOT STARTED  
**Classification:** Shared Foundation discovery (Tier 0)  
**Governing authority:** TitanGold Core Engineering Rules v4.5 §§45–54 (esp. §47–48)  
**Rule 02:** ARTEMIS WP-B — CANONICAL EVIDENCE CONTRACT DISCOVERY  

**Branch:** `feat/artemis-wp-b-evidence-contract-discovery`  
**Worktree:** `/home/ubuntu/worktrees/titangold-artemis-wp-b-discovery`  
**Discovery base `origin/main`:** `845ea0d35b75b1beca516be235f47d98c5703692`  
**WP-A product baseline (FROZEN):** `7c13fe13015de1b44ab534dff8deb72c6e5f5668`  
**WP-A docs closeout:** `845ea0d35b75b1beca516be235f47d98c5703692`  

**Runtime / product code changed:** **0**  
**Migrations / deploy / Scheduler / worker / Live / orders / private provider:** **0**

Frozen surfaces (do not reopen): WP-A UI · Data Hub · Trend · Arbitrage.

Current Artemis maturity remains **ADVISORY ONLY** / `LEGACY_ADVISORY_ONLY` / `executionEligible=false`.  
WP-B discovery does **not** authorize execution, Live, or control-chain activation.

---

## 1. Executive finding

Artemis today is a **legacy LLM Mixture-of-Experts advisory surface** plus WP-A containment. It is **not** a v4.5 evidence orchestrator.

Proven:

1. `POST /api/v1/artemis/decision` still computes legacy `approved:true` BUY/SELL internally, then **WP-A wrap** forces `executionEligible=false`, `approvedForExecution=false`, `classification=LEGACY_ADVISORY_ONLY`.
2. Trading Engine gate ignores `approved` and requires both eligibility flags — so legacy `approved:true` **≠** execution authorization. **Do not change this.**
3. `callAgentAPI` still returns mock `NEUTRAL` + random 50–80 confidence. No real Agent envelope is consumed.
4. `AGENT_DEPENDENCIES` is keyed by `agent-1…15`; DB Agents use UUID `ai_agents.id` → dependency graph misses on the production path.
5. Canonical EvidenceEnvelope exists **only as Foundation design + readiness constants** (`schemaVersion=1.0.0`, `contractVersion=artemis-evidence-1.0.0`, `implemented:false`, `compatibleAgentCount:0`).
6. `ai_decisions` is Agent-run SoT (UUID `agent_id`). Artemis MoE logs to `system_logs.category='artemis_decision'`. These must stay separate.
7. `/logs` and `/readiness` agent-run queries select `d.input` / `d.output` but the table columns are `input_data` / `output_data` → fail-soft `sourceError`. WP-B ingestion must read the real columns; this is **not** a WP-A UI reopen.
8. Trend + Arbitrage have the only product-grade persisted DTOs suitable for **read-only adapters**. Volume/Pattern are next. Technical/Timing/Liquidity are mock/stub. Order is not an analytical producer. Risk/Portfolio/Optimization/Liquidity/Order must **not** be forced into a directional BUY/SELL envelope.

**WP-B goal (after Owner approval):** make analytical Agents **contract-compatible evidence producers** without promoting any Agent or Artemis to execution eligibility.

**Recommended first implementation (not started):** shared envelope + identity normalizer + validators + read-only adapters for `trend` and `arbitrage` (then `volume`) from persisted runs, plus an on-read projection service. No migration in the first WP-B slice. No orchestration rewrite. No WP-A UI redesign.

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
| `conclusion.strength` | number \| enum \| unavailable | O | **not** confidence | measured | |
| `confidence` | object \| unavailable | R* | see §8 | see §8 | omit fake 0.5 defaults |
| `evidence.items` | EvidenceItem[] | O | bounded, see §11 | measured | max count/size |
| `evidence.counterItems` | EvidenceItem[] | O | conflicts | measured | |
| `recommendedNextActionClass` | enum \| unavailable | O | `observe` \| `review` \| `insufficient` \| `not_applicable` | derived | **not an order** |

### 4.3 Control / feasibility / execution extensions (separate sub-schemas)

Do **not** flatten Risk/Liquidity/Order into `direction`.

| Role | Sub-schema focus | WP-B emit? |
|---|---|---|
| `control_veto` (risk) | `verdict` allow/limit/block, `limitations`, `riskFlags`, exposure refs | Adapter **optional / deferred** — Risk Gate not Artemis-wired; classify NEEDS OUTPUT CORRECTION |
| `control_sizing` (portfolio/optimization) | bounded allocation/size envelope, constraints, **no invented balances** | Deferred — not truthful SoT of account state |
| `execution_feasibility` (liquidity) | spread, depth, slippage, max feasible size, book timestamp, expiry | **Not now** — stub |
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

**Approved direction (reconfirmed):** Artemis `agentId` = stable **`agent_key`**.  
DB UUID = `agentRecordId` (instance/run provenance only).  
Do **not** migrate `ai_decisions` now.

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
| `optimization` | — | `optimization` | `optimization` | `agent: 'optimization'` | UUID | sizing (catalog) / utility impl |
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
| `trend` | CLOSED product | OHLCV | snapshot DTO | `trendRunService` → `ai_decisions` | yes | dual 0–100 and 0–1 | analysis + `last_candle_timestamp` | yes | no | partial freshness | trend domain | identity alias | ANALYSIS | yes | **ADAPTER READY** |
| `volume` | partial | OHLCV ≥20 | OBV/VWAP/spikes + rec 0–100 | generic writer (top-level confidence often missing → **0.5 fake**) | yes | heuristic 0–100 | analysis ts | yes | no | implicit via candle count | volumeAnalyzer | not calibrated | ANALYSIS | yes after flatten | **ADAPTER READY** |
| `pattern` | partial | OHLCV or **mock OHLCV** | patterns + dominant_signal | generic | yes | avg top-3 0–1 | analysis ts | yes | no | mock path | pattern module | mock fallback | ANALYSIS | only if real OHLCV | **ADAPTER READY** (caveat) / else **NEEDS OUTPUT CORRECTION** |
| `risk` | substantial + gate | portfolio/mock prices | risk_metrics + score | generic + risk_gate rows | yes | heuristic 0.3–0.95 | ts | symbol | **is** risk | mock prices | risk-agent | UUID debt; not on Artemis `/decision` | ANALYSIS (catalog veto) | control, not direction | **NEEDS OUTPUT CORRECTION** (control schema) |
| `sentiment` | partial | twitter/reddit/news (often mock) | sentiment_label + rec | generic | yes | heuristic 0–1 by source count | ts; TF on input only | symbol; TF=`24h` default | no | mock sources | sentiment module | no direction enum | ANALYSIS | weak | **NEEDS OUTPUT CORRECTION** |
| `price_prediction` | partial | price history | horizons + accuracy | generic → **0.5 if no top-level confidence** | yes | mixed 0–1 / 0–100 | ts | yes | no | uncalibrated | prediction module | not calibrated forecast | ANALYSIS | forecast only | **NEEDS OUTPUT CORRECTION** |
| `portfolio` | partial | caller portfolio | allocation rec; **wrong self-id** | generic → 0.5 fake | yes | Sharpe heuristic | ts | N/A-ish | risk_metrics | invented if caller incomplete | optimizer random_search | liveCapable vs analysis mismatch | PORTFOLIO_MUTATION | no (sizing) | **NEEDS OUTPUT CORRECTION** |
| `fundamental` | partial | Fear&Greed + placeholders | decision buy/sell/hold | generic | yes | heuristic 0–1 | ts + placeholders | TF default `1d` | no | funding/news/mcap fake | fundamental module | placeholders | ANALYSIS | not truthful | **NEEDS OUTPUT CORRECTION** |
| `market_intelligence` | larger module | news/onchain/macro | rec + **confidence 0–100** | generic stores 0–100 in DECIMAL | yes | heuristic 0–100 | ts + data_freshness meta | TF default `24h` | no | null sources | MI module | scale inconsistency | EXTERNAL_READ | after scale fix | **NEEDS OUTPUT CORRECTION** |
| `optimization` | partial | backtest params | best_strategy; **no confidence/signal** | generic → 0.5 fake | yes | unavailable | ts | yes | no | SMA default | optimizer | not evidence | ANALYSIS | no | **NOT AN ANALYTICAL EVIDENCE PRODUCER** |
| `technical` | MVP mock | none real | RSI/MACD random | generic | yes | 0.55–0.7 random | ts only | yes | no | mock | mock indicators | `_meta.source=mock` | ANALYSIS | no | **NEEDS REAL IMPLEMENTATION** |
| `timing` | MVP mock | mock series | timingScore + BUY/SELL/HOLD | generic | yes | 0–1 from mock | ts only | yes | no | mock | mock | TODO real data | ANALYSIS | no | **NEEDS REAL IMPLEMENTATION** |
| `liquidity` | MVP stub | none | `result:'MVP analysis complete'`, **0.55 fake** | generic | yes | fake constant | ts only | symbol | no | none | stub; real analyzer unwired | Artemis BLOCKED | EXTERNAL_READ | no | **NEEDS REAL IMPLEMENTATION** / **UNAVAILABLE** |
| `order` | real execution path | exchange (gated) | dry-run / order ops | generic audit | action history | none | ts | symbol | no | N/A | order module | liveCapable | ORDER_LIVE | no | **NOT AN ANALYTICAL EVIDENCE PRODUCER** |

### Counts

| Classification | Count | Agents |
|---|---|---|
| CONTRACT READY | **0** | none emit canonical envelope today |
| ADAPTER READY | **3–4** | `arbitrage`, `trend`, `volume`, `pattern` (real OHLCV only) |
| NEEDS OUTPUT CORRECTION | **6** | `sentiment`, `price_prediction`, `portfolio`, `fundamental`, `market_intelligence`, `risk` |
| NEEDS REAL IMPLEMENTATION | **3** | `technical`, `timing`, `liquidity` |
| NOT AN ANALYTICAL EVIDENCE PRODUCER | **2** | `order`, `optimization` (+ `artemis_decision`) |
| UNAVAILABLE / DEFERRED | **1** | `liquidity` as feasibility authority |

---

## 7. Role taxonomy

| Role | authorityClass | Who | Same base envelope? | Sub-schema | Vote in synthesis? |
|---|---|---|---|---|---|
| ANALYTICAL EVIDENCE PRODUCER | `analytical_evidence` | technical, trend, pattern, volume, sentiment, fundamental, market_intelligence | yes | analytical extension | evidence only — **not equal votes** |
| OPPORTUNITY / FORECAST | `opportunity_forecast` | price_prediction, timing, arbitrage | yes | opportunity extension | evidence; not execution |
| RISK AUTHORITY / VETO | `control_veto` | risk (+ risk-gate service) | base + veto sub-schema | `verdict`, limits, flags | **authoritative**; beats analytical majority |
| PORTFOLIO / ALLOCATION | `control_sizing` | portfolio | base + sizing sub-schema | constraints, proposed weights | sizing only; no direction |
| OPTIMIZATION | `control_sizing` **or** `not_applicable` | optimization | **different** if kept as backtest utility | do not fake sizing authority | not a vote |
| LIQUIDITY / FEASIBILITY | `execution_feasibility` | liquidity | base + feasibility sub-schema | book ts, spread, slippage, max size, expiry | feasibility only |
| ORDER EXECUTION | `execution` | order | execution audit schema, **not** market evidence | intent + gates | never chooses direction |
| DATA / CONTEXT PROVIDER | n/a | Data Hub / Connections | not Agent envelope | context refs only | not votes |

**Hard rules:** no equal-vote Agent model. Risk veto preserved. Order never decides direction. Liquidity never implies analytical direction. Portfolio/Optimization must not invent balances.

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
| `trend` | `trend.confidence` 0–100 + `_meta.confidence` 0–1 | HEURISTIC / RULE_SCORE; scale explicit | yes — pick one scale, never double-convert silently |
| `arbitrage` | 0.1–0.85 from candidate count | HEURISTIC | yes — not model probability |
| `volume` | 0–100 heuristic; writer often stores 0.5 | HEURISTIC; **must not emit writer default 0.5** | yes if real score present else unavailable |
| `pattern` | avg pattern scores 0–1 | HEURISTIC | only if not mock OHLCV |
| `sentiment` | 0–1 from source count | HEURISTIC | no until sources truthful |
| `price_prediction` | mixed scales; uncalibrated | MODEL_PROBABILITY only if method documented; else HEURISTIC/UNAVAILABLE | no |
| `market_intelligence` | 0–100 heuristic | HEURISTIC | after scale fix |
| `fundamental` | 0–1 from placeholders | LEGACY / UNAVAILABLE | no |
| `risk` | 0.3–0.95 from counts | RULE_SCORE (not veto strength) | control schema later |
| `technical` / `timing` / `liquidity` | random / constant 0.55 | UNAVAILABLE (fake) | **never emit as confidence** |
| `order` / `optimization` | none / fake 0.5 writer | UNAVAILABLE | n/a |

Generic `agentExecutionService` default **`confidence=0.5` when missing is a SoT poison**. WP-B adapters must treat stored `0.5` without explicit Agent confidence field as **UNAVAILABLE**, not 50%.

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

| Agent family | Realistic policy (design) |
|---|---|
| Trend / volume / pattern / technical (OHLCV) | relative to **closed candle** + timeframe (e.g. 1h candle stale after 2×TF) |
| Arbitrage spreads | short wall-clock (seconds–minutes); scan timestamp |
| Sentiment / MI / fundamental | source `publishedAt` if present; else unknown |
| Risk / portfolio | account-state freshness; stale ≠ analytical stale |
| Liquidity | order-book ts; stale feasibility **never** execution approval (WP-C/D) |

If source time missing → `unknown`, not fake `fresh`.

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
Proposed migration is **future gated artifact only** — **not implemented now**.

Fix WP-B read SQL: `input_data` / `output_data` (not `input`/`output`).

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

Reuse WP-A `artemisAuditProjection` allowlist pattern. Same projection for all roles on product routes; do not reintroduce raw `metadata`/`input`/`output`.  
No user-ownership migration now.

---

## 17. Versioning / compatibility

Confirm Foundation versions:

- `schemaVersion = 1.0.0` (structure)
- `contractVersion = artemis-evidence-1.0.0` (semantics + enums)

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

Foundation doc split (contract → migration → adapters → consumer UI) **delays proof** that any Agent can populate the envelope. User candidate (contract+adapters+ingestion in WP-B; orchestration in WP-C; maturity in WP-D) **fits the codebase better**.

### IN WP-B (after Owner approval of this discovery — not started)

- Canonical envelope + role extensions (Zod/JSON Schema + fixtures)
- Backend identity normalizer (single alias table; `agentId`=`agent_key`)
- Confidence / freshness / dataQuality types (no fake defaults)
- Read-only adapters: **Trend**, **Arbitrage**, then **Volume** (Pattern only if real OHLCV)
- On-read projection from `ai_decisions` (`input_data`/`output_data` fix)
- Validation service + golden fixtures
- PRODUCT-SAFE RBAC projection
- Readiness: `compatibleAgentCount` / `evidenceCompatible` only when adapters actually return envelopes
- Tests; **no** WP-A UI redesign; **no** migration in WP-B.1

Optional **WP-B.2 (gated):** append-only evidence table migration — separate Owner approval.

### DEFER WP-C

- Replace mock `callAgentAPI` / `agent-N` graph with real envelope ingestion
- Conflict resolution + correlation-aware synthesis (use WP-B tags)
- Wire Risk veto / Portfolio sizing / Liquidity feasibility / runtime into `/decision`
- TE → Artemis authenticated internal transport (fail-closed today; do not weaken `authenticateStrict`)
- Decision lifecycle states beyond advisory
- Any UI activation of Evidence/Decisions against real envelopes **without IA rewrite**

### DEFER WP-D

- Lineage/replay/evaluation/calibration
- Shadow / paper / promotion gates
- Liquidity real feasibility product
- Technical / Timing real market-data productization
- Live / automated-trading stages 5–7

### OUT OF PROGRAM (this Artemis evidence program)

- Reopening WP-A UI / Data Hub / Trend / Arbitrage product IA
- Equal-vote Agent model
- Expanding scheduler allowlist
- Enabling Live / orders / private credentials for “evidence testing”
- Treating `optimization` as directional evidence
- Treating Order Management as market oracle

---

## 19. Proposed WP-B implementation work packages (DO NOT EXECUTE)

| ID | Outcome | Likely files | DB | FE | BE | Tests | Migration | Safety | Human QA | Deps | Rollback |
|---|---|---|---|---|---|---|---|---|---|---|---|
| B0 | Owner approves this discovery | docs only | 0 | 0 | 0 | n/a | no | n/a | review | — | n/a |
| B1 | Shared contract module + Zod + fixtures | new `backend/services/artemisEvidenceContract.js` (or `contracts/`), schemas, unit tests | 0 | types-only optional | new module | unit golden | no | low | no | B0 | delete module |
| B2 | Identity normalizer owner (backend) | catalog reuse / `agentIdentity.js`; tests for all aliases incl. `trend_detection` | 0 | 0 | yes | unit | no | low | no | B1 | revert module |
| B3 | Confidence/freshness/DQ helpers; reject writer `0.5` poison | contract helpers + tests | 0 | 0 | yes | unit | no | med (truth) | no | B1 | revert |
| B4 | Trend read-only adapter | new adapter **outside** `trendDomain.js`; reads `trendRunService` / `ai_decisions` | read | 0 | yes | unit + snapshot fixtures | no | med | no (frozen UI) | B1–B3 | disable adapter |
| B5 | Arbitrage read-only adapter | new adapter outside arbitrage product DTOs | read | 0 | yes | unit | no | med | no | B1–B3 | disable adapter |
| B6 | Volume adapter (flatten confidence) | new adapter | read | 0 | yes | unit | no | med | no | B1–B3 | disable |
| B7 | On-read projection service + fix `/logs`+`/readiness` SQL columns | `artemis.js` read path, readiness evidence block | read | 0 | yes | API contract tests | no | med | light | B4–B6 | revert SQL + hide evidence |
| B8 | RBAC product projection for envelopes | extend audit-projection pattern | 0 | 0 | yes | unit | no | high (leak) | no | B1 | revert |
| B9 | Readiness truthful counts | `artemisReadinessService.js` | 0 | frozen UI already displays fields | yes | unit | no | low | no | B7 | revert counts |
| B10 | Optional persist table | new migration + writer | **yes — gated** | 0 | yes | db tests | **explicit Owner** | high | yes | B7 | down migration |

**WP-B implementation is not authorized by this document.**

---

## 20. Open decisions (Owner)

1. Confirm `agentId=trend` with `trend_detection` as alias only (frontend key unchanged until a later product WP).
2. Confirm WP-B includes **read-only Trend+Arbitrage adapters**, not contract-only (Foundation WP-B was contract-only).
3. Confirm **no migration** in WP-B.1; persist table only as optional B10.
4. Should `/logs` column-name fix ship inside B7 even though it touches Artemis routes? (Recommended: yes — read-only bugfix, not WP-A reopen.)
5. Is `optimization` permanently `not_applicable` as sizing authority until a dedicated sizing WP?
6. Pattern adapter: require `source≠mock` or skip entirely in WP-B?
7. Dual confidence scales on Trend: which field is canonical for envelope `confidence.value`?
8. When (if ever) to increment `contractVersion` vs keep `artemis-evidence-1.0.0` through WP-B adapters.

---

## 21. Risk register

| Risk | Impact | Mitigation in WP-B |
|---|---|---|
| Fake confidence (0.5 writer default) enters envelope | false Artemis certainty | treat missing/poison 0.5 as UNAVAILABLE |
| Adapter mutates frozen Trend/Arbitrage | product regression | adapters **outside** frozen modules; read-only |
| Unknown JSON in `evidence` leaks secrets | WP-A class leak | allowlist + size limits + RBAC projection |
| `agent-N` mapped to real agents | wrong identity | map to unavailable/legacy only |
| WP-B silently reopens `/decision` semantics | execution creep | do not edit containment/TE gate |
| Correlation ignored | double-counting later | emit family tags now; no scoring |
| Migration without approval | SoT split / data loss | B10 gated; default on-read only |
| UI redesign under “just show evidence” | WP-A freeze break | no FE IA work; optional later WP-C wiring |

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
- Any deploy or worker/Scheduler mutation in discovery or WP-B.0

---

## 23. Discovery provenance

| Item | Value |
|---|---|
| origin/main used | `845ea0d35b75b1beca516be235f47d98c5703692` |
| WP-A product baseline | `7c13fe13015de1b44ab534dff8deb72c6e5f5668` |
| Discovery branch | `feat/artemis-wp-b-evidence-contract-discovery` |
| Runtime code changed | NO |
| Implementation started | NO |
| WP-A remains frozen | YES |

**Verdict target:**  
**ARTEMIS WP-B — DISCOVERY COMPLETE**  
**CANONICAL EVIDENCE CONTRACT READY FOR OWNER REVIEW**  
**IMPLEMENTATION NOT STARTED**
