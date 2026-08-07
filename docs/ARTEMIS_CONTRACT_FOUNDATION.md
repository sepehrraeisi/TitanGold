# Artemis Contract Foundation — Discovery & Design

**Status:** OWNER RE-REVIEW REMEDIATION COMPLETE — READ-ONLY DISCOVERY / CONTRACT DESIGN  
**Classification:** Shared Foundation discovery (Tier 0)  
**Governing authority:** TitanGold Core Engineering Rules **v4.5** — Sections 45–54 (esp. §47)  
**Rule 02:** ARTEMIS CONTRACT FOUNDATION — READ-ONLY DISCOVERY AND CONTRACT DESIGN  
**Branch:** `feat/artemis-contract-foundation`  
**Worktree:** `/home/ubuntu/worktrees/titangold-artemis-contract-foundation`  
**Base `origin/main`:** `a100f7ba21131c351b561fb66554e90990da8725`  
**Runtime implementation changed:** **0**  
**Migrations / deployments / Scheduler / worker / private provider calls:** **0**

**Preserved prior checkpoint (do not reopen):**  
TREND DETECTION — CLOSED AND FROZEN · runtime `b242c9c` · docs freeze `a100f7b` · Scheduler allowlist `["arbitrage"]` · dual `titan-engine-worker` deferred.

---

## 1. Outcome and Scope

### Primary outcome

Produce one owner-reviewable Shared Foundation discovery package that:

1. Inventories the **real** current Artemis runtime (proven imports/routes/workers — not filenames alone).
2. Maps all **15 Agents** with non-equal authority classes.
3. Designs **one** canonical versioned Agent→Artemis evidence contract (v4.5 §47).
4. Defines compatibility, correlation, conflict resolution, control chain, lineage/replay, and maturity stages.
5. Documents the **smallest future adapters** for frozen Arbitrage and Trend — without modifying their product surfaces.

### Explicit authorization

Authorized: discovery, SoT mapping, contract design, planning, this living document, Rule 02 update.

**IMPLEMENTATION IS NOT AUTHORIZED** in this outcome (no Artemis runtime code, no adapters, no migrations, no deploy, no Scheduler/worker mutation, no Live, no orders, no private provider calls).

### Risk tier

Tier 0 — Read-Only / Documentation.

---

## 2. Existing Artemis Runtime Inventory

### 2.1 Verdict on current Artemis

**Artemis today is a partial LLM Mixture-of-Experts (MoE) orchestrator + state/UI surface — not the v4.5 Agent-evidence orchestration authority.**

| Capability | Current state | Evidence class |
|---|---|---|
| Multi-LLM decision aggregation | Implemented (`getMixtureDecision`) | PROVEN |
| Agent evidence contract (canonical envelope) | **Absent** | PROVEN gap |
| Real Agent→Artemis consumption | **Not implemented** — `callAgentAPI` returns **mock** signals | PROVEN |
| Agent identity in coordination | **Broken** — `AGENT_DEPENDENCIES` keyed by `agent-1..15`; DB path uses UUID `ai_agents.id` | PROVEN defect |
| Legacy `/decision` approval semantics | Can return `approved:true` BUY/SELL without control chain; classify **LEGACY_ADVISORY_ONLY** | PROVEN safety finding |
| Role-aware conflict resolution | Absent (majority vote + confidence average across LLM providers) | PROVEN |
| Risk veto in Artemis decision path | **Not wired** to Artemis `/decision`; Risk Gate uses hardcoded Risk UUID | PROVEN |
| Portfolio / Liquidity / OM control chain | **Not present** in Artemis decision route | PROVEN |
| Live automated trading | Not authorized; policy may classify path as dry-run while response still says approved | PROVEN |

### 2.2 Proven backend owners

| Path | Mount / import | Role | Provenance |
|---|---|---|---|
| `backend/routes/v1/index.js` | `router.use('/artemis', artemisRoutes)` | Mounts Artemis under `/api/v1/artemis` | PROVEN |
| `backend/routes/artemis.js` | Imported by v1 index | Health, state, decision, config, decision-engine patch, logs | PROVEN |
| `backend/services/artemisOrchestrator.js` | Imported by routes + `engineWorker.js` | `getMixtureDecision`, `coordinateAgents`, training helpers | PROVEN |
| `backend/schemas/artemisSchemas.js` | Imported by routes + `schemas/index.js` | Zod response/body schemas | PROVEN |
| `backend/workers/engineWorkerLeader.js` | **PM2 entry** (`ecosystem.config.json` → `titan-engine-worker`) | Kill-switch monitor; starts scheduler / autopilot / tradingEngine | PROVEN |
| `backend/workers/engineWorker.js` | Alternate full-cycle script | DataHub → `coordinateAgents` (mock) → MoE → Telegram; **not** the PM2 entry | PROVEN import; FILENAME-ONLY for PM2 |
| `backend/engine/scheduler.js` | `startArtemisScheduler` | Interval exists; **`autoDecisions` body is empty placeholder** (no Live side effects) | PROVEN |
| `backend/engine/tradingEngine.js` | `getArtemisApproval` | Calls `http://localhost:${PORT}/api/artemis/decision` — **path mismatch** vs mounted `/api/v1/artemis/decision` → falls back to LLM helper | PROVEN defect |
| `backend/routes/config.js` | `/artemis` GET/PUT | `system_config` key `artemis.decision_engine` — **dual config** alongside `artemis_state.config.decisionEngine` | PROVEN |
| `backend/services/risk-gate.js` | Used by `manualTrading.js` | Pre-trade risk gate — **not** Artemis `/decision`; hardcodes `RISK_AGENT_ID` UUID | PROVEN |
| `backend/services/runtimeExecutionStateService.js` | Used by risk-gate / execution policy | Effective mode + Kill Switch (Redis cache, DB authoritative) | PROVEN |
| `backend/services/agentExecutionPolicyService.js` | Used by Artemis `/decision` | Demo/Live policy + confirmation | PROVEN |
| `backend/services/capabilities.js` | `ARTEMIS_DECISION_EXECUTE`, `ARTEMIS_STATE_WRITE` | Capability gates | PROVEN |

### 2.3 Proven frontend owners

| Path | Role | Provenance |
|---|---|---|
| `components/ai/AIManager/index.tsx` + tabs | Canonical Artemis/Manager UI shell | PROVEN (mounted via AICenter) |
| `components/ai/hooks/useArtemisState.ts` | Artemis state hook → `GET /api/v1/artemis/state` | PROVEN |
| `components/ai/AIManager/tabs/DecisionEngineTab.tsx` | Mostly redirects to Settings Decision Engine | PROVEN |
| `components/settings/configuration/DecisionEngine.tsx` | Decision Engine config UI → `/api/v1/config/artemis` | PROVEN |
| `components/widgets/ArtemisInsightsWidget.tsx` | Dashboard widget | PROVEN import; **hardcoded stub data** (not API-backed) |
| `components/ai/ArtemisComponents.tsx` | Legacy Backtesting/Logs/Settings surface | **FILENAME-ONLY / likely dead** — no production import from AIManager/App; do not treat as canonical UI |
| `services/api.ts` / `services/api-backend.ts` | `fetchArtemisState`, Artemis helpers, `/api/v1/artemis/*` | PROVEN |
| `e2e/artemis-tabs.spec.ts` | E2E coverage for Artemis tabs | PROVEN |

### 2.4 Critical implementation facts (PROVEN)

1. **`getMixtureDecision`** prompts LLMs with opportunity + “Agent Signals” JSON and aggregates provider votes by **majority action** and **average confidence** (`aggregateDecisions`).
2. **`coordinateAgents` → `callAgentAPI`** currently returns a **mock** structure (`signal: 'NEUTRAL'`, `confidence: 50 + Math.random() * 30`) — comment states production would call real agent APIs. It does **not** call `agents/registry.runAgent`.
3. **Legacy Agent ID / dependency graph defect (Finding 1):** see §2.6.
4. **Legacy `/artemis/decision` approval semantics (Finding 2):** see §2.7 — classify output **LEGACY_ADVISORY_ONLY / NOT_EXECUTION_ELIGIBLE**.
5. **Risk identity debt (Finding 3):** `risk-gate.js` hardcodes `RISK_AGENT_ID = 79bbdf0b-94a3-4cbc-adef-98c25f5ba1a7`. It still calls the existing Risk Agent implementation (do not invent a second Risk owner). Future Artemis must resolve Risk via canonical `agent_key` / registry ownership; UUID remains instance/run provenance only.
6. Persistence of Agent run history uses `ai_decisions` (shared table, agent-specific `decision_type`) via `agentExecutionService` / Trend / Arbitrage writers — a **parallel** path from Artemis MoE. Artemis decisions log to **`system_logs`** (`category=artemis_decision`) and do **not** INSERT into `ai_decisions`.
7. Tables: `artemis_state`, `ai_decisions`, `ai_agents` (schema in `database/schema.sql`).
8. **Config dual-path:** Settings Decision Engine writes `system_config` (`artemis.decision_engine`) while Artemis routes also use `artemis_state.config.decisionEngine`.
9. **Trading Engine Artemis approval URL** uses `/api/artemis/decision` (missing `/v1`) against a server that mounts only `/api/v1/artemis` — proven broken path with fallback.
10. Message bus referenced by orchestrator is **RabbitMQ** (`messageQueue.js`), not Redis; Redis remains runtime-state cache only.

### 2.5 Deploy copies

`deploy/blue/**` and `deploy/green/**` contain mirrored Artemis files. Canonical engineering source for this discovery is the worktree root (not deploy mirrors).

### 2.6 Finding 1 — Legacy Agent ID / dependency graph defect (PROVEN)

In `backend/services/artemisOrchestrator.js`:

| Step | Current behavior |
|---|---|
| Dependency map | `AGENT_DEPENDENCIES` is keyed by positional IDs `agent-1` … `agent-15` |
| Normal DB path | `coordinateAgents()` loads enabled Agents via `SELECT id, name, type, status, config FROM ai_agents …` |
| Identity type | `ai_agents.id` is a **UUID** |
| Plan lookup | `buildExecutionPlan()` uses `AGENT_DEPENDENCIES[agent.id]` |
| Result | On the normal DB-backed path, dependency lookups miss; the legacy graph is **not keyed to real DB identity** |
| Fallback path | Only the DB-unavailable fallback fabricates `agent-1..agent-15` objects — that is not the normal production path |
| Execution call | `callAgentAPI(agent.id, …)` receives the UUID (or synthetic id) and returns mock `NEUTRAL` + random confidence |

**Classification:** This is not merely a mock-data defect. It is an **identity and orchestration contract defect**.

**Future rule (design — not implemented here):** Artemis must use canonical stable `agent_key` as evidence `agentId`. Do **not** use positional `agent-N` identity or hardcoded `ai_agents` UUIDs as the cross-system Agent identity. UUID may remain record/instance provenance where needed.

### 2.7 Finding 2 — Legacy `/api/v1/artemis/decision` approval semantics (PROVEN safety finding)

Escalate beyond “legacy MoE exists.” Current route semantics are unsafe to treat as execution authorization.

Proven behavior:

1. Route requires `CAP.ARTEMIS_DECISION_EXECUTE`.
2. Calls `evaluateExecutionPolicy()` with `agentKey = 'artemis_decision'`, `params.action = 'execute_decision'`, and **does not** pass `apply: true`.
3. `artemis_decision` is registered as `sideEffectClass = portfolio_mutation`, `liveCapable = true` (`agentCapabilityRegistry.js`).
4. `requiresLiveSideEffects()` treats `portfolio_mutation` as live-side-effect requested **only** when `params.apply === true` (or `params.input.apply === true`).
5. Therefore the policy can classify this route as a **safe/dry-run** path even though the endpoint has execute/approval naming and Trading Engine integration intent.
6. With Kill Switch active, policy may still **allow** the dry-run analytical path while suppressing external side effects.
7. The route assigns `sideEffectsSuppressed` but **does not stop** merely because `sideEffectsSuppressed === true`.
8. It can subsequently return `approved: true` with `action: BUY` or `SELL` from MoE confidence or the legacy fallback.
9. The fallback can approve from caller-provided `opportunity.confidence` and averaged signal confidence **without** the canonical Risk → Portfolio → Liquidity → Runtime → Order Management chain.

**Not claimed:** This route itself is **not** proven here to place an exchange order directly.

**Hard classification until control chain exists:**

- Output class: **`LEGACY_ADVISORY_ONLY`**
- Eligibility: **`NOT_EXECUTION_ELIGIBLE`**
- **Hard target rule:** No current `approved: true` from the legacy Artemis route may be interpreted as v4.5 `approved_for_execution`.

---

## 3. Source-of-Truth Map

| Concern | Canonical owner today | Notes for Artemis Foundation |
|---|---|---|
| **Canonical Agent identity (future)** | Stable `agent_key` as evidence `agentId` | **Approved direction:** do **not** use `ai_agents` UUID as cross-system `agentId`; UUID = record/instance only |
| Agent key inventory (planning) | `constants/agentKeys.ts` (`AGENT_KEYS`, 15 keys) | `TREND` constant = `trend_detection`; registry maps to `trend` |
| Backend agent module dispatch | `backend/services/agents/registry.js` (`AGENT_MODULES`) | Key `trend` (not `trend_detection`) |
| Frontend control panels | `components/ai/agentRegistry.ts` | Lazy panels; Trend registered as `trend` |
| Agent run persistence | PostgreSQL `ai_decisions` | **Preserve** as Agent-run SoT; do **not** overwrite frozen `output_data` into a new schema |
| Future Artemis evidence/decision lineage | **Does not exist yet** | Prefer separate append-only/versioned persistence owner (migration requires explicit approval) |
| Trend product contract | `backend/services/trendDomain.js` + `trendRunService.js` | Canonical Artemis `agentId` = **`trend`**; `trend_detection` = documented legacy alias only; product stays frozen |
| Arbitrage product contract | `backend/services/arbitrageScanContract.js` + `arbitrageRunService.js` | `decision_type = arbitrage_scan`; CLOSED/FROZEN |
| Artemis MoE orchestration | `artemisOrchestrator.js` | LLM MoE — **not** evidence-contract consumer; dependency graph identity broken (§2.6) |
| Legacy Artemis decision route | `POST /api/v1/artemis/decision` | **LEGACY_ADVISORY_ONLY / NOT_EXECUTION_ELIGIBLE** (§2.7); CONTAIN |
| Artemis UI/state | `artemis_state` + `/api/v1/artemis/*` | State/config/health |
| Runtime mode / Kill Switch | `runtimeExecutionStateService.js` (DB SoT; Redis cache) | Must remain fail-closed |
| Capability matrix | Connections / `capabilities.js` / agent capability registry | Agents must not fork capability copies |
| Scheduler allowlist | Analytical scheduler status services | Staging allowlist remains `["arbitrage"]` |
| Risk veto (pre-trade) | `risk-gate.js` → existing Risk Agent | Hardcoded `RISK_AGENT_ID` UUID debt; still the same Risk owner — resolve via canonical key later |
| Canonical Artemis evidence contract | **DOES NOT EXIST YET** | Approved naming: `schemaVersion=1.0.0`, `contractVersion=artemis-evidence-1.0.0` |

**Key alias debt (document only — do not “fix” frozen products in this outcome):**  
- Canonical Trend Artemis `agentId` = **`trend`**. `trend_detection` is a **legacy alias only**.  
- `portfolio` (registry) ↔ output `agent_key: 'portfolio_allocation'` in `agents/portfolio.js`.  
- `order` (registry) ↔ payload `agent: 'order_management'` in `agents/order.js`.

---

## 4. Current Decision Flow

### 4.1 As implemented today (PROVEN)

```
Market/context (often incomplete / mock)
  → coordinateAgents (mock callAgentAPI signals)
  → convert to signals[]
  → getMixtureDecision (multi-LLM MoE) OR confidence average fallback
  → POST /artemis/decision policy gate (demo/live confirmation)
  → BUY/SELL/HOLD JSON (+ system_logs)
```

Worker path (`engineWorker` full cycle) follows the same orchestrator functions and may publish to Telegram — still without Risk→Portfolio→Liquidity→OM chain.

### 4.2 Target control chain (DESIGN — v4.5 §50; not implemented)

```
Market / external data
  → specialized Agents (canonical evidence packages)
  → Artemis context alignment + conflict resolution
  → Risk validation / veto
  → Portfolio + Optimization limits / sizing
  → Liquidity execution-feasibility
  → Runtime / Capability / Emergency Stop validation
  → Explicit confirmation where required
  → Order Management (execution-only)
  → Provider
  → Reconciliation / audit
```

**Hard rule:** No Agent analytical output is directly executable. No Live activation is authorized by this discovery.

---

## 5. Agent Role and Authority Matrix

Authority model (non-equal votes):

- **Risk** owns **veto**.
- **Portfolio / Optimization** own **bounded capital sizing/allocation**.
- **Liquidity** owns **execution feasibility**.
- **Order Management** **executes approved intent only** — does **not** determine market direction.

Legend for permissions: Advise | Evidence | Veto | Size | Feasibility | Execute

### 5.1 Analytical / evidence

| agentId | Display | authorityClass | Maturity (current) | Advise | Evidence | Veto | Size | Feas. | Exec |
|---|---|---|---|---|---|---|---|---|---|
| `technical` | Technical Analysis | `analytical_evidence` | Partial module + UI; mock markers in agent module | Y | Y | N | N | N | N |
| `trend` | Trend Detection | `analytical_evidence` | **CLOSED AND FROZEN** product (`trendDomain`/`trendRunService`) | Y | Y | N | N | N | N |
| `pattern` | Pattern Recognition | `analytical_evidence` | Partial; synthetic OHLCV paths present | Y | Y | N | N | N | N |
| `volume` | Volume Analysis | `analytical_evidence` | Partial module + UI | Y | Y | N | N | N | N |
| `sentiment` | Sentiment Analysis | `analytical_evidence` | Partial module + UI | Y | Y | N | N | N | N |
| `fundamental` | Fundamental Analysis | `analytical_evidence` | Partial; some random fallbacks | Y | Y | N | N | N | N |
| `market_intelligence` | Market Intelligence | `analytical_evidence` | Larger module; maturity not frozen as Artemis-ready | Y | Y | N | N | N | N |

### 5.2 Opportunity / forecast

| agentId | Display | authorityClass | Maturity | Advise | Evidence | Veto | Size | Feas. | Exec |
|---|---|---|---|---|---|---|---|---|---|
| `price_prediction` | Price Prediction | `opportunity_forecast` | Partial | Y | Y | N | N | N | N |
| `timing` | Timing | `opportunity_forecast` | Partial; synthetic series present | Y | Y | N | N | N | N |
| `arbitrage` | Arbitrage | `opportunity_forecast` | **CLOSED AND FROZEN** analytical spread monitor | Y | Y | N | N | N | N |

### 5.3 Capital / control

| agentId | Display | authorityClass | Maturity | Advise | Evidence | Veto | Size | Feas. | Exec |
|---|---|---|---|---|---|---|---|---|---|
| `risk` | Risk Management | `control_veto` | Substantial module + Risk Gate for manual trading | Y | Y | **Y** | N* | N | N |
| `portfolio` | Portfolio Allocation | `control_sizing` | Partial module + UI | Y | Y | N | **Y** | N | N |
| `optimization` | Optimization | `control_sizing` | Partial module + UI | Y | Y | N | **Y** | N | N |

\*Risk may **reduce/limit** size as part of veto/limit authority; it does not own portfolio allocation.

### 5.4 Execution feasibility / execution

| agentId | Display | authorityClass | Maturity | Advise | Evidence | Veto | Size | Feas. | Exec |
|---|---|---|---|---|---|---|---|---|---|
| `liquidity` | Liquidity Analysis | `execution_feasibility` | **MVP Stub** (`source: 'mock'`, 41-line module) | Y | Y† | N | N | **Y** (future) | N |
| `order` | Order Management | `execution` | Module exists; must remain execution-only | N‡ | N‡ | N | N | N | **Y** (future, gated) |

†Liquidity evidence is feasibility evidence, not market-direction evidence.  
‡Order Management may emit execution/audit records, not analytical market conclusions.

### 5.5 Per-Agent detail (compact)

For every Agent:

| Field | Pattern across Agents |
|---|---|
| Current Artemis relationship | **None verified** — Artemis does not consume real Agent evidence packages today (mock coordination path). |
| Future Artemis relationship | Produce/adapt to canonical envelope; Artemis consumes by `authorityClass`. |
| Market/symbol/timeframe | Required on envelope when applicable; Trend/Arbitrage already encode symbol/timeframe or venue/symbol contexts in product contracts. |
| Freshness | Trend: explicit `fresh`/`aged`/`stale`/`unavailable`. Others: mostly undefined — must be required by contract or marked `unavailable`. |
| Confidence | Often overloaded or mock. Contract forbids fake confidence; require `confidenceMethod` + provenance or `unavailable`. |
| Correlation family | See §9 (LIKELY until measured). |
| Artemis readiness (today) | Mostly `NOT_ASSESSED` or at best `ROLE_MAPPED` by this document; Trend/Arbitrage can reach `CONTRACT_MAPPED` after adapter design approval — **not** `ARTEMIS_CONSUMABLE` yet. |

---

## 6. Canonical Evidence Contract

**Owner (proposed):** Shared Foundation package — single schema module + validation + persistence adapter (future implementation WP).  
**Governing rule:** Core Rules v4.5 §47.  
**Proposed initial versions:**

- `schemaVersion`: `1.0.0`
- `contractVersion`: `artemis-evidence-1.0.0`

### 6.1 Canonical Evidence Envelope (required fields)

| Field | Type / notes | Truthfulness rule |
|---|---|---|
| `schemaVersion` | string | Required |
| `contractVersion` | string | Required |
| `agentId` | canonical key (`trend`, `arbitrage`, …) | Aliases recorded in provenance, not duplicate envelopes |
| `agentRole` | enum matching taxonomy §46 | Required |
| `authorityClass` | `analytical_evidence` \| `opportunity_forecast` \| `control_veto` \| `control_sizing` \| `execution_feasibility` \| `execution` | Required |
| `runId` | UUID of Agent run / `ai_decisions.id` when applicable | Required when persisted |
| `correlationId` | UUID linking related Agent runs | Required when Artemis batch exists |
| `decisionContextId` | UUID of Artemis decision context | Nullable until Artemis decision starts |
| `ownershipScope` | `{ type: user\|tenant\|system, id? }` | Required when applicable; else `not_applicable` |
| `provider` | string or unavailable | No guessing |
| `venue` | string or unavailable | |
| `marketType` | spot\|futures\|… or unavailable | |
| `symbol` | canonical symbol | |
| `baseAsset` / `quoteAsset` | strings or unavailable | |
| `timeframe` | canonical TF id or unavailable | |
| `analysisHorizon` | string/enum or unavailable | |
| `analysisTimestamp` | ISO-8601 | Required |
| `sourceTimestamp` | ISO-8601 or unavailable | |
| `sourceCandleTimestamp` | ISO-8601 or unavailable | |
| `expiryTimestamp` | ISO-8601 or unavailable | |
| `freshnessStatus` | `fresh`\|`aged`\|`stale`\|`expired`\|`unavailable` | Required |
| `freshnessReason` | stable reason key | Required when not fresh |
| `provenance` | object (source, cache, versions) | Required |
| `dataQuality` | `ok`\|`degraded`\|`insufficient`\|`unavailable` | Required |
| `availability` | `available`\|`unavailable`\|`not_applicable`\|`blocked` | Required |
| `unavailableReason` | reason key or null | Required when unavailable/blocked |
| `lifecycleStatus` | Agent-local lifecycle (e.g. completed/failed) | Required |
| `signal` / `conclusion` | role-specific structured conclusion | No fake BUY from stubs |
| `direction` | enum or unavailable | Analytical Agents |
| `regime` | enum or unavailable | |
| `strength` | number/enum or unavailable | Not a substitute for confidence |
| `confidenceValue` | number or **null/unavailable** | Only when method exists |
| `confidenceMethod` | string or unavailable | |
| `confidenceProvenance` | object or unavailable | |
| `supportingEvidence` | EvidenceItem[] | |
| `conflictingEvidence` | EvidenceItem[] | |
| `invalidatingConditions` | array | |
| `riskFlags` | array | |
| `limitations` | array of stable keys/text refs | Required (may be empty only if explicitly none) |
| `recommendedNextActionClass` | advisory enum — **not** an order | |
| `executionClass` | `none`\|`advisory_only`\|`requires_control_chain`\|… | Default non-executable |
| `modelAlgorithmVersion` | string or unavailable | |
| `configurationVersion` | string or unavailable | |
| `codeImplementationVersion` | git/impl version or unavailable | |
| `createdAt` / `completedAt` | ISO-8601 | |

**Forbidden:** fake zero confidence, guessed success, synthetic “neutral vote” for missing Agents, silent fill of N/A fields with `0`/`false` success.

### 6.2 Envelope validation principles (design)

- Unknown fields rejected at Artemis ingress (allowlist).
- AuthorityClass mismatch with agentId → reject.
- Stale/expired → eligible for analysis display only; ineligible for decision confirmation.
- Missing required control evidence (Risk/Liquidity when execution proposed) → fail closed.

---

## 7. Evidence Item Contract

Each supporting/conflicting item:

| Field | Notes |
|---|---|
| `evidenceId` | Stable within run |
| `evidenceType` | e.g. `indicator`, `pattern`, `spread`, `orderbook`, `policy` |
| `canonicalSource` | Owner system/table/provider |
| `value` / `unit` | Optional; typed |
| `interpretation` | Machine key + optional i18n key — not raw internal dumps as user prose |
| `directionalContribution` | `supports`\|`conflicts`\|`neutral`\|`not_applicable` |
| `strengthOrSeverity` | Optional; not confidence |
| `timestamp` | ISO-8601 |
| `freshness` | Same enum family as envelope |
| `provenance` | Object |
| `quality` | Enum |
| `limitation` | Optional key |
| `correlationFamily` | See §9 |
| `explanationKey` | i18n-safe key |

---

## 8. Compatibility Rules

Artemis may combine evidence only when **all applicable** dimensions match or are explicitly declared compatible by policy:

| Dimension | Rule |
|---|---|
| Provider / venue | Same venue unless cross-venue strategy context is declared |
| Market type | Spot ≠ futures unless strategy declares cross-market |
| Symbol | Canonical symbol equality after normalization owner |
| Timeframe | Equal OR explicit multi-TF context (`decisionContext` holds primary + compares) |
| Horizon | Forecast horizons must not be silently averaged |
| Source-time window | Overlapping acceptable windows; otherwise `incompatible` |
| Freshness | Stale cannot confirm; may inform “stale_evidence” state |
| Ownership scope | Never mix user portfolios / tenants |
| Runtime environment | Staging ≠ Production decisions |

**Explicit non-combinable states (must not become “neutral votes”):**

- `unavailable`
- `stale`
- `incompatible`
- `not_applicable`
- `blocked`
- `insufficient_evidence`

---

## 9. Correlation Families

Do **not** assume correlation from Agent names alone. Until measured, treat the following as **LIKELY** shared-source families requiring future validation:

| Family ID | Likely members | Shared source (likely) | Artemis handling |
|---|---|---|---|
| `ohlcv_candle_family` | technical, trend, pattern, volume, timing (partial) | Same OHLCV candles | Deduplicate confirmation weight; preserve lineage |
| `microstructure_family` | volume, liquidity (future) | Trades/order book | Partial overlap — do not full-collapse |
| `external_narrative_family` | sentiment, market_intelligence | News/social/external feeds | Shared-source penalty when same feed IDs |
| `account_state_family` | risk, portfolio, optimization | Balances/positions/exposure | Control chain — not “votes” |
| `spread_monitor_family` | arbitrage | Venue bid/ask | Independent of candle trend family unless proven otherwise |
| `execution_path_family` | liquidity, order | Feasibility + intent | Not analytical confirmation |

**Rules:**

- Artemis must not double-count correlated evidence as independent confirmation.
- Apparent consensus from one family must be reported as such.
- Correlation adjustment must be versioned and auditable — never hidden.

---

## 10. Conflict Resolution

When Agents disagree, Artemis must:

1. Preserve each Agent conclusion and evidence arrays.
2. Classify timeframe/horizon incompatibility separately from true conflict.
3. Mark stale/unavailable/blocked distinctly.
4. Apply **role-specific authority** (Risk veto beats analytical majority).
5. Explain preference / rejection reasons with stable keys.
6. Return `insufficient_evidence` when unsafe to resolve.
7. **Never** resolve by blind averaging of unrelated values or equal Agent votes.

Disallowed: majority of mock signals; treating missing Agents as HOLD votes; converting disagreement into synthetic confidence.

---

## 11. Risk Authority

**Owner:** Risk Management Agent + Risk Gate service (future Artemis integration must call the **same** policy authority — not a parallel Artemis-only risk).

May: reject, limit, require more evidence, reduce size, block asset/market/operation, enforce exposure/loss/volatility limits.

Must not be silently overridden by Artemis or Order Management.

Override (if ever): separate high-risk capability + Human approval + audit.

**Today:** Risk Gate is wired to manual trading — **not** Artemis `/decision`. Gap is intentional to close only under a future approved WP.

---

## 12. Portfolio / Optimization Authority

Must consume canonical available balance, positions, exposure, allocation constraints, user/strategy limits.

May produce bounded sizing/allocation.

Must not invent balances, place orders, or override Emergency Stop / runtime policy.

Artemis must treat sizing outputs as **control envelopes**, not directional votes.

---

## 13. Liquidity Authority

Owns **execution feasibility** near execution time.

Must report (future contract): venue, symbol, side, proposed size, order-book timestamp, spread, expected slippage, market-impact estimate, max feasible size, expiry, limitations.

Stale liquidity approval ≠ execution approval.

**Today:** Liquidity Agent module is an MVP stub with mock confidence — **not** CONTROL_ELIGIBLE.

---

## 14. Order Management Authority

Executes **only** approved, bounded, traceable intents containing at minimum:

- `decisionContextId`
- contributing Agent `runId`s
- Risk approval
- Portfolio sizing
- Liquidity approval
- Runtime-policy approval
- Provider capability
- Requested + effective mode
- Emergency Stop state
- Idempotency key
- Operation limits
- Confirmation evidence where required
- Audit owner

Must revalidate time-sensitive gates before provider calls.

Must **not** decide market direction, manufacture profitability, or replace Artemis/Risk/Portfolio/Liquidity.

---

## 15. Artemis Decision Lifecycle

Proposed canonical decision states (v4.5 §49.1 — adopt only with definitions):

`insufficient_evidence` · `incompatible_evidence` · `stale_evidence` · `analysis_only` · `proposed` · `blocked_by_risk` · `blocked_by_portfolio` · `blocked_by_liquidity` · `blocked_by_runtime` · `awaiting_confirmation` · `shadow_only` · `paper_only` · `approved_for_execution` · `execution_failed` · `executed` · `reconciled`

**Hard rule for today’s legacy route:** classify every current `POST /api/v1/artemis/decision` success payload as **`LEGACY_ADVISORY_ONLY` / `NOT_EXECUTION_ELIGIBLE`**.  

**No current `approved: true` from the legacy Artemis route may be interpreted as v4.5 `approved_for_execution`.**

---

## 16. Lineage and Audit

Every Artemis decision must be reconstructable with:

- `decisionId`, `decisionContextId`
- contributing Agent run IDs
- excluded outputs + reasons
- contract / Agent implementation / model / configuration versions
- source timestamps, freshness decisions, data-quality decisions
- correlation handling + weighting/policy versions
- Risk / Portfolio / Liquidity / runtime-safety results
- confirmation, order intent, provider response, reconciliation

**Never** persist Secrets or signed provider payloads in lineage.

Existing stores to reuse/extend later (not migrate in this outcome): `ai_decisions`, `system_logs`, `artemis_state` — plus **new** decision-context tables only when an approved implementation WP requires them.

---

## 17. Replay / Backtest / Evaluation

### Replay

Replay must distinguish original historical evidence vs current code/config vs recomputed result. Do not silently re-score history under new models.

### Backtest leakage prevention

Forbid future-data leakage, incomplete-candle leakage, survivorship bias where relevant, look-ahead config, post-decision outcomes as inputs, hidden revisions.

### Evaluation / calibration

Accuracy/confidence/trust scores only with persisted methodology. Segment by Agent, symbol, market, timeframe, horizon, regime, model/config versions.

Separate metrics for: direction correctness, forecast calibration, opportunity realization, risk effectiveness, sizing effectiveness, liquidity-estimation quality, execution quality.

**No single accuracy number for all roles.**

---

## 18. Runtime / Capability / Emergency Stop Boundaries

| Gate | Owner | Artemis rule |
|---|---|---|
| Effective runtime mode | `runtimeExecutionStateService` | Fail closed when unknown |
| Kill Switch / Emergency Stop | Same | Blocks execution eligibility; Redis failure must not elevate |
| Capabilities / RBAC | `capabilities.js` + Connections matrix | Frontend visibility ≠ authorization |
| Scheduler allowlist | Analytical scheduler | Remains `["arbitrage"]` in this outcome; Trend not allowlisted |
| Worker topology | PM2 | Dual `titan-engine-worker` is a **known deferred** shared-runtime condition — do not mutate here |
| Provider Connection | Canonical Connections / Capability Matrix | Public vs private vs transactional separation |

Artemis must not bypass these gates.

---

## 19. Automated-Trading Maturity

Design-only stages (aligned to v4.5 §53; user-facing shorthand Independent → Contract Compatible → Shadow → Paper → Limited Live → Expanded Live):

| Stage | Name | Entry (future) | Exit / rollback triggers |
|---|---|---|---|
| 0 | Specialized Agent Product | Agent REAL WORKING product | Defect reopen |
| 1 | Canonical Evidence / Contract Compatible | Envelope persisted + tested | Contract break |
| 2 | Artemis Advisory | Consumable + explainable recommendations, no orders | Evidence/quality failure |
| 3 | Shadow | Parallel decisions recorded, no orders | Calibration/conflict failure |
| 4 | Paper | Full chain simulated | Reconciliation/risk failure |
| 5 | Limited sandbox / test env | Explicit env + Tier-4 where needed | Any safety failure |
| 6 | Limited Live | Explicit Tier-4 + full §53.6 checklist | Immediate rollback on any listed failure |
| 7 | Expanded Live | Separate outcome after Stage 6 | Separate authorization |

**No stage transition is authorized in this discovery outcome.**

---

## 20. Completed-Agent Adapter Plan

### 20.1 Trend (CLOSED AND FROZEN)

| Topic | Finding |
|---|---|
| Current output | `buildTrendSnapshot` + `ai_decisions` rows (`decision_type=trend_analysis`): direction, regime, strength, ADX, evidence arrays, freshness, provenance, analyticalSignal, MTF helpers |
| Contract mismatch | Product-shaped snapshot ≠ full Artemis envelope (missing authorityClass, decisionContextId, confidenceMethod separation, executionClass, correlationFamily on items, ownershipScope, contractVersion on every emit) |
| Smallest future adapter | Pure function `trendSnapshotToArtemisEvidence(snapshot, runMeta) → EvidenceEnvelope` living **outside** frozen Trend UI/domain mutation surface; Trend continues writing current SoT; adapter reads persisted snapshot |
| Regression consumers | Trend popup/overview/history/settings/integrations; `trendRunService`; Staging smoke scenarios A/C |
| Frozen-surface protections | Do not edit `TrendAgentPopup` product IA, `trendDomain` semantics, Scheduler allowlist, or Live paths for adapter work |

### 20.2 Arbitrage (CLOSED AND FROZEN)

| Topic | Finding |
|---|---|
| Current output | `arbitrage_scan` contract v`2.0.0-wp1a`: analytical spread monitor, candidates/rejected, lifecycle metrics, **no** executable multi-leg opportunity claim |
| Contract mismatch | Opportunity/scan DTO ≠ Artemis envelope; confidence semantics product-specific; not a directional BUY signal for OM |
| Smallest future adapter | `arbitrageScanToArtemisEvidence(scanOutput, runMeta)` mapping candidates to opportunity_forecast evidence with `executionClass=none` / advisory; preserve truthful “not executable arbitrage” limitations |
| Regression consumers | Arbitrage Overview/Candidates/History/Profit&Risk/Settings/Integrations; scan history contracts; Scheduler allowlisted path |
| Frozen-surface protections | Do not change analytical_mode semantics, do not enable order placement, do not expand allowlist in adapter WP |

---

## 21. Security and Privacy

- Capabilities required for Artemis write/decision remain server-enforced.
- No JWTs/API keys/secrets in evidence lineage or logs.
- Fail closed on Kill Switch / unknown runtime mode for any execution-bound path.
- Demo/Dry-Run must not be reported as Live success.
- Adapter and contract validation must reject mass-assignment of unknown fields.
- This discovery performs **zero** private provider calls.

---

## 22. Database and Cache Implications

**No migration in this outcome.** Future implications (design only):

| Store | Implication |
|---|---|
| `ai_decisions` | Likely remains Agent run SoT; Artemis envelope may live in `output_data` via adapter **or** parallel typed column/table after approved migration |
| `artemis_state` | Config/state only — insufficient for decision lineage |
| New `artemis_decision_contexts` / `artemis_decision_lineage` (proposed names) | Needed before DECISION_ELIGIBLE automation |
| Redis | Cache only for runtime propagation; never authoritative for permissions or Live enablement |

---

## 23. Proposed Implementation Slices (future — not authorized now)

**Owner-approved order.** No slice below is authorized for implementation by this discovery commit.

### WP-A — Legacy Artemis safety containment (first)

- Prove all consumers of `/artemis/decision` (including Trading Engine path mismatch).
- Prevent legacy `approved: true` from being treated as execution eligibility.
- Preserve backward compatibility for advisory consumers.
- Explicitly mark / contain output as advisory / analysis-only until the full control chain exists.
- No Live activation.
- Focused regression only.

### WP-B — Canonical contract package

- Shared canonical enums/types.
- Zod / JSON Schema.
- Strict validators.
- Version constants (`schemaVersion=1.0.0`, `contractVersion=artemis-evidence-1.0.0`).
- Golden fixtures.
- Canonical identity / alias registry (`agent_key` as `agentId`; Trend `trend` + alias `trend_detection`).
- No Agent product rewrites.

### WP-C — Evidence persistence / lineage foundation

- Separate approved migration (explicit owner approval required).
- Append-only / versioned evidence and decision-context persistence.
- Preserve `ai_decisions` as existing Agent-run Source of Truth.
- Do **not** overwrite frozen Agent `output_data` into a new schema.

### WP-D — Read-only adapters

- Trend adapter outside frozen product surfaces.
- Arbitrage adapter outside frozen product surfaces.
- Map persisted product outputs → canonical envelope; no product IA/business edits.

### WP-E — Artemis advisory consumer

- `analysis_only`.
- Correlation-aware.
- Conflict-aware.
- No orders.

### Only after WP-A…WP-E

1. Risk → Portfolio/Optimization → Liquidity control-chain work (resolve Risk via canonical identity; replace Liquidity stub before feasibility eligibility).
2. Shadow / Paper maturity WPs (separate authorizations).
3. Tier-4 Live only under explicit separate authorization.
4. Dual `titan-engine-worker` remediation remains a **separate** shared-runtime outcome.

---

## 24. Migration and Compatibility Risks

| Risk | Severity | Mitigation |
|---|---|---|
| **Finding 1:** `AGENT_DEPENDENCIES[agent.id]` UUID miss vs `agent-1..15` graph | High | Future orchestration must key by canonical `agent_key`; do not repair in discovery |
| **Finding 2:** legacy `/decision` returns `approved:true` without control chain / without requiring `apply:true` live side-effect intent | Critical | WP-A containment; classify `LEGACY_ADVISORY_ONLY`; never map to `approved_for_execution` |
| **Finding 3:** Risk Gate hardcoded `RISK_AGENT_ID` UUID | High | Keep single Risk owner; resolve via canonical agent identity in future WP; no Risk Gate change now |
| Parallel per-Agent Artemis schemas | High | One shared contract owner before adapters proliferate |
| Mock `coordinateAgents` mistaken for real evidence | High | Gate MoE on real envelopes; WP-B/D/E |
| Overwriting frozen `ai_decisions.output_data` | High | Forbidden; use separate append-only Artemis lineage (WP-C) |
| Trading Engine `/api/artemis` vs `/api/v1/artemis` path mismatch | High | Prove consumers in WP-A; fix only under approved containment/Trading WP; no Live |
| Dual Decision Engine config owners | High | Single SoT before advisory activation |
| Confidence averaging / majority / equal votes | High | Role-aware policy; ban equal weights |
| AgentId alias debt | Medium | Canonical `agentId` + alias registry (Trend = `trend`) |
| Reopening frozen Trend/Arbitrage | High | Adapter-outside-freeze rule (WP-D) |
| Using `ai_decisions.confidence` as calibrated probability | Medium | Nullable + method required |
| Artemis decisions only in `system_logs` | Medium | WP-C lineage before DECISION_ELIGIBLE |
| Dead/alternate surfaces (`ArtemisComponents.tsx`, non-PM2 `engineWorker.js`) | Medium | Do not revive; prove reachability before edits |
| Dual workers / Scheduler fingerprint | Medium | Separate shared-runtime outcome |
| Deploy blue/green drift | Medium | Implement only in canonical source; deploy via normal pipeline |

---

## 25. Acceptance Criteria

This discovery outcome is complete when:

- [x] ACTIVE Rule 01 verified as **v4.5**
- [x] Rule 02 transitioned to Artemis discovery (implementation not authorized)
- [x] Isolated branch + worktree from verified `origin/main`
- [x] Living doc with sections 1–28
- [x] Agent authority matrix for 15 Agents
- [x] Canonical envelope + Evidence Item designed
- [x] Compatibility / correlation / conflict / control chain / lineage / maturity designed
- [x] Frozen Trend + Arbitrage adapter plans documented
- [x] Runtime code = 0; migrations = 0; deployments = 0; Scheduler/worker mutations = 0; private provider calls = 0
- [x] Owner re-review findings 1–3 documented (identity graph, legacy approval semantics, Risk UUID debt)
- [x] Owner design directions recorded as APPROVED in §26
- [ ] Owner re-review of remediated document (Human) — **pending**

---

## 26. Owner Decisions — APPROVED DESIGN DIRECTION

These are **no longer ambiguous**. Recorded as owner-approved design direction for future implementation WPs (still **not** implementation authorization):

1. **Canonical contract — APPROVED**  
   `schemaVersion = 1.0.0`  
   `contractVersion = artemis-evidence-1.0.0`  
   until an implementation review proves a naming conflict.

2. **Canonical Agent identity — APPROVED**  
   Use canonical stable agent key as evidence `agentId`.  
   Do **not** use `ai_agents` UUID as canonical cross-system `agentId`.  
   UUID remains record/instance identity where needed.

3. **Trend canonical Artemis `agentId` — APPROVED**  
   `trend`  
   `trend_detection` is a documented **legacy alias only**.  
   Do **not** modify the frozen Trend product to rename it.

4. **Persistence direction — APPROVED**  
   Preserve `ai_decisions` as the existing Agent-run Source of Truth.  
   Do **not** overwrite frozen Agent `output_data` into a new schema.  
   Prefer a separate append-only/versioned Artemis evidence/decision lineage persistence owner in the future implementation WP.  
   Exact table design still requires implementation-time DB review and explicit migration approval.

5. **Legacy `/artemis/decision` — APPROVED: CONTAIN**  
   Do not treat as execution approval.  
   Preserve compatibility until consumers are proven.  
   Future containment must make output explicitly advisory/analysis-only until the full control chain exists.  
   Classification: `LEGACY_ADVISORY_ONLY` / `NOT_EXECUTION_ELIGIBLE`.

6. **Liquidity — APPROVED**  
   Real Liquidity productization is **mandatory** before any execution-feasibility eligibility.

7. **Dual `titan-engine-worker` remediation — APPROVED as separate outcome**  
   Remains a separate shared-runtime outcome; not part of Artemis Contract Foundation discovery.

**Still open for a later implementation WP (not blocking this discovery remediation):** single Decision Engine config SoT (`artemis_state` vs `system_config`) — to be decided during WP-A/WP-E consumer proof.

---

## 27. Explicit Non-Goals

- Implementing Artemis runtime changes
- Implementing Agent adapters
- DB migrations
- Deployments / PM2 restarts / worker topology changes
- Scheduler allowlist expansion
- Live trading / order execution
- Private provider calls
- Reopening Trend or Arbitrage frozen product UX/business logic
- Reopening Data Hub / Agents Shell / AI Shared Foundation
- Declaring any Agent `EXECUTION_ELIGIBLE` or automated-trading ready
- Equal-weight voting design

---

## 28. Final Recommendation

**Proceed to owner re-review of this remediated Contract Foundation design.**  

Do **not** implement Artemis runtime, adapters, migrations, or control-chain wiring until the owner explicitly approves the next Work Package (expected first: **WP-A Legacy Artemis safety containment**).

Until then:

- Keep Trend and Arbitrage **CLOSED AND FROZEN**.
- Treat legacy `/artemis/decision` as **`LEGACY_ADVISORY_ONLY` / `NOT_EXECUTION_ELIGIBLE`** — never as `approved_for_execution`.
- Keep Scheduler allowlist `["arbitrage"]`.
- Keep dual-worker issue deferred.
- Preserve ACTIVE Core Rules **v4.5** as governing authority for all subsequent Artemis work.

**Discovery verdict:**  
`ARTEMIS CONTRACT FOUNDATION DISCOVERY REMEDIATED — READY FOR OWNER RE-REVIEW`

---

## Evidence Ledger (this outcome)

| Item | Value |
|---|---|
| Rule 01 | v4.5 (Cursor User Rules id `16854512`) |
| Base `origin/main` | `a100f7ba21131c351b561fb66554e90990da8725` |
| Branch | `feat/artemis-contract-foundation` |
| Worktree | `/home/ubuntu/worktrees/titangold-artemis-contract-foundation` |
| Parallel discovery reconciliation | Inventory + Agent authority findings folded into §§2–3, §24, §26 |
| Owner re-review remediation | Findings 1–3 + APPROVED §26 directions + WP-A…WP-E order |
| Runtime code changed | 0 |
| Migrations | 0 |
| Deployments | 0 |
| Scheduler mutations | 0 |
| Worker mutations | 0 |
| Private provider calls | 0 |
| Trend checkpoint preserved | `b242c9c` runtime · `a100f7b` docs freeze |
