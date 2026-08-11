# ARTEMIS WP-C — Orchestration / Synthesis / Control-Chain Discovery

**Status:** DISCOVERY ONLY · OWNER ARCHITECTURE REVIEW REQUIRED  
**Base:** `origin/main` = `69b71b6a628b8139d3161bb4efc41507a72db9cf`  
**Branch:** `feat/artemis-wp-c-orchestration-discovery`  
**Worktree:** `/home/ubuntu/worktrees/titangold-artemis-wp-c-discovery`  
**Risk tier:** Tier 0 — Read-Only / Documentation  
**Implementation started:** NO  
**Migration / runtime / provider / financial side effects:** NONE  

This is the **single canonical** WP-C discovery document. Do not create parallel planning docs.

---

## 0. Authority and freeze preservation

| Item | State | Truth |
|---|---|---|
| WP-B.1 | CLOSED AND FROZEN | PROVEN BY CODE + Rule 02 prior freeze |
| WP-A | CLOSED AND FROZEN | PROVEN BY docs / Git |
| Data Hub / Trend / Arbitrage | FROZEN | PROVEN BY Rule 02 / closeouts |
| Artemis maturity | ADVISORY ONLY (`LEGACY_ADVISORY`) | PROVEN BY CODE |
| `artemisConsumable` | `false` | PROVEN BY CODE (`artemisReadinessService.js`) |
| `decisionEligible` | `false` | PROVEN BY CODE |
| `executionEligible` | `false` | PROVEN BY CODE |
| Evidence readiness | `ON_READ_PARTIAL` — NOT `EVIDENCE_READY` | PROVEN BY CODE |
| `orchestration` | `LEGACY` · `realAgentCoordination=false` | PROVEN BY CODE |
| B10 / WP-D / Shadow / Paper / Live | NOT STARTED | PROVEN BY Rule 02 + docs |

**Owner authorization for this document:** Discovery + gap analysis only. No implementation.

---

## 1. Discovery method

Allowed and used:

- Static code inspection on exact `origin/main`
- Git history / ancestry verification
- Existing WP-A / WP-B.1 / contract foundation docs
- Local non-provider static reading of schemas and services

Not performed:

- Production deploy / PM2 / restart
- DB DDL/DML / migration
- Credentials / private API / orders
- Agent execution for validation
- Bug fixes (bugs documented only)

Truth labels used throughout:

- **PROVEN BY CODE**
- **PROVEN BY CURRENT DATA** (not claimed unless inspected live)
- **INFERRED**
- **PROPOSED**
- **UNKNOWN / REQUIRES MEASUREMENT**

---

## 2. Current real Artemis orchestration path

### 2.1 End-to-end reality (PROVEN BY CODE)

```
Canonical product UI (AIManager Artemis sections)
  → GET /api/v1/artemis/readiness
  → GET /api/v1/artemis/logs
  → buildArtemisReadiness + audit projection
  → Overview / Evidence / Decisions / Orchestration / Controls / Lineage / System
     (READ-ONLY product shell — does not generate new decisions)

Parallel legacy decision path:
TradingEngine.shouldExecuteTrade / getArtemisApproval
  → POST /api/v1/artemis/decision
  → evaluateExecutionPolicy (runtime / kill-switch / capability)
  → getMixtureDecision (MoE LLM) OR confidence/signals fallback
  → optional crude dailyLoss 5% check (NOT Risk Agent)
  → containLegacyArtemisDecision → ALWAYS executionEligible=false
  → system_logs(category='artemis_decision')
  → TE uses isArtemisDecisionExecutionAuthorized
     (requires executionEligible && approvedForExecution → currently impossible)

Optional env-gated legacy worker path:
engineWorker (ENGINE_ENABLED=true)
  → coordinateAgents → callAgentAPI (MOCK)
  → getMixtureDecision (without product containment on that worker output)
  → Telegram publish path (NOT Order Management)
```

Mount: `backend/routes/v1/index.js` → `/artemis`.

### 2.2 Exact owners

| Concern | Owner file / function | Classification | Action |
|---|---|---|---|
| Product readiness SSOT | `artemisReadinessService.js` `buildArtemisReadiness` | REAL (read aggregation) | KEEP |
| Product UI shell | `components/ai/AIManager/**` + `services/artemisReadinessApi.ts` | REAL / READ-ONLY | KEEP / REUSE |
| Decision generation | `routes/artemis.js` `POST /decision` | LEGACY | REPLACE in WP-C |
| MoE / advisory synthesis | `artemisOrchestrator.js` `getMixtureDecision` / `aggregateDecisions` | LEGACY (real LLM I/O) | ADAPT / REPLACE |
| Mock Agent coordination | `artemisOrchestrator.js` `callAgentAPI` / `coordinateAgents` | MOCK | REPLACE |
| Recommendations display | `DecisionsSection.tsx` ← `/logs` projection | LEGACY / READ-ONLY | ADAPT |
| Coordination state | readiness `orchestration` + legacy `GET /orchestration` | LEGACY / PARTIAL | REPLACE |
| Controls / safety display | `ControlsSection.tsx` ← readiness.controlChain | PARTIAL (display) | ADAPT |
| Runtime safety SSOT | `runtimeExecutionStateService.js` + `evaluateExecutionPolicy` | REAL | KEEP |
| History / audit | `artemisAuditProjection.js` + `system_logs` + `ai_decisions` | PARTIAL | ADAPT |
| `approved:true` semantics | `artemisDecisionContainment.js` | LEGACY (non-exec) | KEEP until removed |
| Execution authorization predicate | `artemisExecutionGate.js` | REAL fail-closed | KEEP |
| Evidence on-read | `artemisEvidenceOnReadService.js` + adapters | ADAPTER / PARTIAL / FROZEN WP-B.1 | KEEP foundation; ADAPT consumer |
| Agent identity | `artemisAgentIdentity.js` + `constants/artemisAgentCatalog.js` | REAL / PARTIAL | REUSE |
| Risk veto on Artemis | **missing** (crude dailyLoss only) | UNAVAILABLE in Artemis path | ADAPT later |
| Portfolio / Optimization on Artemis | **missing** | UNAVAILABLE / NOT APPLICABLE | ADAPT / DEFER |
| Liquidity feasibility on Artemis | stub Agent + unwired analyzer | BLOCKED / STUB | REPLACE later |
| Order Management from Artemis | not wired | NOT EXECUTION ELIGIBLE | DEFER |

### 2.3 Misleading surfaces that are NOT execution authorization (PROVEN BY CODE)

1. Legacy field `approved:true` — labeled `advisory_signal_only_not_execution_authorization`
2. MoE prompts using word **EXECUTE**
3. Capability name `CAP.ARTEMIS_DECISION_EXECUTE` (authorizes calling `/decision`, not Live orders)
4. Method names `getArtemisApproval` / `shouldExecuteTrade`
5. `GET /orchestration` fake CPU/memory percentages
6. Placeholder systemHealth values on `/state`
7. Decision Engine Settings UI implying an active “engine”
8. engineWorker MoE cycle when `ENGINE_ENABLED=true` (not OM)

**Hard rule preserved:** only `executionEligible===true && approvedForExecution===true && action∈{BUY,SELL,EXECUTE}` may authorize TE. Today both flags are forced false.

### 2.4 Overall classification

**CURRENT REAL ARTEMIS ORCHESTRATION = LEGACY ADVISORY + PARTIAL READINESS SHELL**

- Real: readiness aggregation, containment, TE fail-closed gate, runtime Kill Switch SSOT, WP-B.1 on-read evidence for 3 Agents, Integrations credential owner
- Legacy: MoE majority synthesis, `/decision` path, `approved` field, dual decision-engine config
- Mock: `callAgentAPI`, Pattern/Technical/Timing/Liquidity mock/stub paths
- Not connected: Risk veto → Portfolio/Optimization → Liquidity → OM control chain

---

## 3. Target control chain (PROPOSED)

```
Analytical / Opportunity Agents
  → Canonical Evidence (WP-B.1 contract; on-read now)
  → Artemis Synthesis (role-aware; not equal voting)
  → Risk Veto / Limits
  → Portfolio / Optimization bounded allocation-sizing
  → Liquidity Feasibility
  → Runtime Safety / Emergency Stop / capability / mode
  → Order Management (ExecutionIntent only)
  → Provider (only when separately Tier-4 authorized)
```

### Authority boundaries (PROPOSED; not implemented)

| Authority | May | Must not |
|---|---|---|
| **Artemis** | Admit evidence; resolve conflict; propose decisions; explain limitations | Bypass Risk/Portfolio/Liquidity/runtime; invent account state; place orders |
| **Risk** | Veto / block / limit / require more evidence | Count as equal directional vote |
| **Portfolio / Optimization** | Bounded sizing / allocation within canonical balances | Unrestricted directional signal; fabricate balance |
| **Liquidity** | Feasibility / capacity / slippage / expiry | Directional vote; stale approval as Live auth |
| **Runtime safety** | Authoritative Kill Switch / mode / capability gate | Be overridden by advisory synthesis |
| **Order Management** | Execute only approved ExecutionIntent with revalidation | Invent BUY/SELL direction; skip gates |

**No execution authorization is granted by Discovery.**

---

## 4. Synthesis semantics (DESIGN ONLY — PROPOSED)

### 4.1 Evidence admission

1. Schema validation against frozen WP-B.1 / contract foundation envelope
2. Reject envelopes that claim `executionEligible=true` or `approvedForExecution=true`
3. Reject Pattern (and any Agent) when provenance is mock/unknown
4. Contain legacy MoE outputs as non-evidence advisory artifacts until retired
5. Identity normalize via `artemisAgentIdentity` / catalog aliases

### 4.2 Freshness states

`fresh` · `stale` · `degraded` · `unknown`

Never invent freshness. If source-candle / source timestamp unavailable → `unknown` (current WP-B.1 behavior for many rows — PROVEN BY CODE / docs).

### 4.3 Availability states (must remain distinct)

| State | Meaning |
|---|---|
| `unavailable` | Agent/evidence not present |
| `neutral` | Valid evidence concluding no directional bias |
| `weak` | Valid but low-strength |
| `failed` | Run attempted and failed |
| `stale` | Previously valid, now expired |
| `degraded` | Valid with quality/provider degradation |

**Unavailable ≠ Neutral.** Missing evidence must not become a confirming or opposing vote.

### 4.4 Confidence

- Require provenance + method
- Distinguish calibrated vs uncalibrated
- Allow `confidence = unavailable`
- Signal strength ≠ confidence
- Forbid fake defaults such as `0.5` / `0.55` as “neutral confidence”
- Current MoE averages provider confidences — **LEGACY / unsafe for WP-C** (PROVEN BY CODE)

### 4.5 Data quality

Track coverage, provider degradation, missing features, limitations, source quality. Propagate limitations into ArtemisDecision. Do not silently drop them.

---

## 5. Conflict resolution (PROPOSED)

Example conflict:

- Trend bullish
- Sentiment bearish
- Volume weak
- Technical unavailable/mock
- Price Prediction bullish (if admitted later)
- Market Intelligence high-risk narrative
- Risk veto

### Required behaviors

1. **Detect conflict** when admitted evidence disagrees on direction/regime/risk for a compatible context (same venue/symbol/timeframe/horizon window).
2. **Severity:** informational / material / blocking.
3. **Do not** use simple equal Agent voting.
4. **Do not** invent arbitrary numeric weights in Discovery.
5. Prefer **HOLD / ABSTAIN / insufficient_evidence** when:
   - required analytical coverage missing
   - contradictory high-strength evidence without higher-authority resolution
   - Risk unavailable or vetoes
   - context incompatible (timeframe/horizon mismatch)
6. Risk veto is authoritative for control — not averaged away.
7. Propagate all supporting + conflicting evidence + limitations into the decision record.
8. When no safe decision can be produced: emit explicit non-decision state (`insufficient_evidence` / `blocked_by_risk` / `incompatible_evidence`), never a fake HOLD-as-success without reason.

### Role-aware preference order (PROPOSED, not weighted scores)

1. Runtime safety / Kill Switch (hard stop)
2. Risk veto / limits
3. Compatibility + freshness + data-quality gates
4. Analytical evidence synthesis with correlation dedup
5. Opportunity forecasts as secondary context (not automatic direction)
6. Portfolio/Optimization sizing only after a non-blocked analytical proposal
7. Liquidity feasibility only near execution-intent stage
8. Order Management never participates in direction synthesis

---

## 6. Correlation / double-counting

Contract already defines correlation-family metadata (`CORRELATION_FAMILY` in `artemisEvidenceContract.js`) — **PROVEN BY CODE**. WP-B tags only; WP-C must score/dedup.

| Relationship | Finding | Label |
|---|---|---|
| Trend ↔ Technical | Shared OHLCV family intended; Technical today is `Math.random` mock — no real shared input yet | INFERRED (future) · PROVEN BY CODE (current non-overlap) |
| Trend ↔ Timing | Similar indicators; Timing uses mock historical series today | INFERRED · PROVEN BY CODE (Timing mock) |
| Trend ↔ Volume | Same MEXC OHLCV path; both adapters `OHLCV_CANDLE` | PROVEN BY CODE |
| Sentiment ↔ Market Intelligence | Shared CryptoPanic / NewsAPI providers | PROVEN BY CODE |
| Price Prediction ↔ Technical | Future OHLCV family; Technical mock today | INFERRED |
| Volume ↔ Liquidity | Partial microstructure family; Liquidity Agent stub / analyzer unwired | INFERRED · PROVEN BY CODE (stub) |
| Fundamental ↔ Market Intelligence | Narrative family; Fundamental news currently placeholder | INFERRED · PROVEN BY CODE (placeholder) |
| Risk ↔ Portfolio | Account-state family; not directional votes | INFERRED |
| Arbitrage | Separate `SPREAD_MONITOR` family | PROVEN BY CODE |
| Legacy orchestrator `agent-N` graph | Artificial dependency — not correlation SoT | PROVEN BY CODE |

**Strategy (PROPOSED):**

- Persist `correlationFamily` on every evidence item
- Group same-family evidence before synthesis
- Count correlated group once for confirmation strength
- Preserve lineage of each member
- No invented correlation coefficients — any numeric adjustment = REQUIRES MEASUREMENT / Owner-approved policy later

---

## 7. All 15 Agent dependency matrix

**consumable now** = adapter/on-read can build a truthful envelope for *future* WP-C intake. System-level `artemisConsumable` remains `false`.

| agentId | role | maturity | evidence | real/mock/stub | WP-C relevance | consumable now | class | blocker | remediation | stage |
|---|---|---|---|---|---|---|---|---|---|---|
| trend | analytical_evidence | frozen real product | adapter YES | real OHLCV | high | YES | **A** | identity alias / freshness unknown gaps | keep adapter; normalize identity | WP-C intake |
| arbitrage | opportunity_forecast | frozen real product | adapter YES | real public spread | high (opportunity) | YES | **A** | must not become directional vote | keep opportunity schema | WP-C intake |
| volume | analytical_evidence | real path | adapter YES | real OHLCV volume | high | YES | **A** | correlated with trend | dedup ohlcv family | WP-C intake |
| pattern | analytical_evidence | partial | excluded | mock fallback risk | medium | NO | **B** | mock provenance dishonest | fail closed on mock; then adapter | before reliance |
| sentiment | analytical_evidence | partial | no adapter | mock-heavy without keys | medium | NO | **B** | mock sources; no adapter | provenance + adapter | later |
| price_prediction | opportunity_forecast | partial | no adapter | mixed / mock fallback | medium | NO | **B** | uncalibrated / mock | provenance + adapter | later |
| fundamental | analytical_evidence | partial | no adapter | placeholders | low initial | NO | **B** | placeholder news/funding | mark unavailable; later adapter | later |
| market_intelligence | analytical_evidence | larger partial | no adapter | real-ish + degradation | medium | NO | **B** | scale/confidence debt; no adapter | adapter + scale fix | later |
| technical | analytical_evidence | MVP mock | no adapter | mock | high if real | NO | **C** | no real market data | real OHLCV product | Agent WP then WP-C |
| timing | opportunity_forecast | MVP mock | no adapter | mock series | medium | NO | **C** | mock data | real OHLCV product | Agent WP then WP-C |
| liquidity | execution_feasibility | stub | blocked | stub `0.55` | control chain | NO | **C** | stub; analyzer unwired | real order-book feasibility | Agent/control WP |
| risk | control_veto | substantial + gate debt | N/A directional | calc on often-mock prices; UUID debt | control | NO* | **D** | not on Artemis path; UUID hardcode | control schema + `agent_key=risk` | WP-C control |
| portfolio | control_sizing | partial | N/A | partial / identity debt | control | NO* | **D** | not on Artemis path; self-id debt | SoT balances + control schema | WP-C control |
| order | execution | real gated path | NOT_EXECUTION_ELIGIBLE | execution ops | execution only | NO | **D** | must not synthesize direction | ExecutionIntent only | late WP-C / later maturity |
| optimization | NOT_APPLICABLE | utility/backtest | NOT_APPLICABLE | utility | deferred | NO | **E** | not equal analytical producer | keep out of initial set | deferred |

\* Risk/Portfolio are “consumable” only as **control authorities**, not evidence votes.

### Class counts

- **A** 3 — trend, arbitrage, volume  
- **B** 5 — pattern, sentiment, price_prediction, fundamental, market_intelligence  
- **C** 3 — technical, timing, liquidity  
- **D** 3 — risk, portfolio, order  
- **E** 1 — optimization  

---

## 8. Initial WP-C Agent set recommendation (PROPOSED)

### INITIAL ANALYTICAL SET

1. **trend** — direction/regime evidence (frozen, adapter-ready)
2. **volume** — confirming/diverging volume context (adapter-ready; correlate with trend)
3. **arbitrage** — opportunity context only (not directional vote)

Rationale: smallest diverse set with truthful adapters; covers regime + microstructure volume + non-directional opportunity. Avoids correlated mock Agents.

### CONTROL SET (integrate as authorities, not votes)

1. **risk** — veto/limits (after UUID/control wiring)
2. **portfolio** — bounded sizing (after identity/balance SoT)
3. **runtime safety / Kill Switch** — already real SSOT (not an Agent)
4. **liquidity** — only after real feasibility implementation (otherwise fail-closed / unavailable)
5. **order** — ExecutionIntent consumer only; never initial advisory voter

### DEFERRED SET

- pattern (until mock provenance fixed)
- technical, timing (until real implementation)
- sentiment, market_intelligence, fundamental, price_prediction (adapter + provenance first)
- optimization (`NOT_APPLICABLE` to equal synthesis)

**Do not require all 15 Agents before WP-C starts.**

---

## 9. WP-C vs B10 vs WP-D

| Package | Belongs | Does not belong |
|---|---|---|
| **WP-C** | orchestration contracts; admission; synthesis/conflict/correlation; control-chain wiring; TE auth transport fix; product UI readiness/audit wiring; Shadow *prep* architecture | full evaluation/backtest/calibration; Live |
| **B10** | append-only / versioned Artemis evidence + decision-context persistence foundation (if Owner approves) | synthesis algorithm; Live; broad Agent rewrites |
| **WP-D** | lineage/replay/evaluation/backtesting/calibration/performance/promotion metrics | initial synthesis MVP |

### Sequencing recommendation

**Primary PROPOSED sequence: A — WP-C core → B10 → Shadow**

Rationale (PROVEN BY CODE + INFERRED):

- WP-B.1 already proved on-read evidence for 3 Agents
- WP-C contracts/admission/synthesis/control UI can consume on-read without migration
- Shadow needs durable ArtemisDecision + evidence references → B10 prerequisite for Shadow activation
- Full WP-D evaluation comes after Shadow records exist

**Alternative REQUIRES OWNER DECISION: C — Small B10 prerequisite → WP-C core → remaining WP-D**

Use C if Owner prefers persistence schema locked before synthesis implementation to reduce contract churn.

**Not recommended: B — full B10 before any WP-C core**, because it blocks useful orchestration design already justified by on-read proof.

Shadow / Paper / Live remain NOT STARTED under all options until separately authorized.

---

## 10. ArtemisDecision vs ExecutionIntent (PROPOSED)

### 10.1 ArtemisDecision (advisory / shadowable)

Proposed fields:

- `decisionId`
- `decisionContextId`
- `symbol` / `base` / `quote` / `venue` / `marketType`
- `timeframe` / `analysisHorizon`
- timestamps: `createdAt`, `analysisAt`, `sourceWindow`, `expiresAt`
- `evidenceRefs[]` (agentId, runId, contractVersion, correlationFamily, freshness, availability)
- `synthesisOutcome` (`proposed` / `hold` / `abstain` / `insufficient_evidence` / `blocked_by_*`)
- `direction` or explicit `abstain`
- `confidence` + `confidenceProvenance` + calibrated|uncalibrated|unavailable
- `conflictState` + severity + members
- `limitations[]`
- `riskStatus` (pending / approved_limits / vetoed / unavailable)
- `allocationProposal` (bounded; optional; unavailable until Portfolio)
- `liquidityStatus` (pending / feasible / infeasible / stale / unavailable)
- `runtimeStatus` (mode, killSwitch, policy)
- `executionEligibilityState` — **must remain false** until later maturity gates
- `classification` / `maturityStage`
- versions: contract / policy / implementation

### 10.2 ExecutionIntent (later-stage separate contract)

Must prevent:

- Risk bypass
- Liquidity bypass
- stale decision execution
- duplicate execution (idempotency key)
- wrong symbol/timeframe/venue
- legacy `approved:true` becoming executable
- silent promotion from advisory/shadow to Live

ExecutionIntent may exist only after ArtemisDecision + Risk + Portfolio + Liquidity + runtime gates are explicitly satisfied and Tier rules allow. **Not in Discovery implementation.**

---

## 11. Failure / degraded mode (PROPOSED)

| Condition | Advisory behavior | Execution eligibility |
|---|---|---|
| One analytical Agent fails | Continue if remaining admitted evidence sufficient; mark missing | fail closed |
| Multiple analytical Agents fail | Degrade; likely abstain/insufficient | fail closed |
| All analytical unavailable | No directional decision; explicit unavailable | fail closed |
| Risk unavailable | Block proposal that needs control; do not invent pass | fail closed |
| Portfolio unavailable | Allow analysis-only; sizing unavailable | fail closed for size-requiring intents |
| Optimization unavailable | Ignore (NOT_APPLICABLE) | no change by itself |
| Liquidity unavailable | Analysis-only; no feasibility approval | fail closed for execution |
| Provider degraded | Mark degraded evidence/providers | fail closed |
| Stale evidence | Exclude from confirmation; may force abstain | fail closed |
| Unresolved material conflict | HOLD/ABSTAIN/insufficient | fail closed |
| DB read failure | Degraded UI + deny decision persistence paths | fail closed |
| Artemis LLM/provider unavailable | Deterministic fallback synthesis or abstain; never fake consensus | fail closed |
| Emergency Stop active | Advisory may explain blocked state | fail closed; side effects suppressed |

**Execution eligibility must fail closed. Advisory may degrade gracefully when truthful.**

---

## 12. LLM / Multi-AI Council role (PROPOSED)

### Current reality (PROVEN BY CODE)

- Legacy MoE in `artemisOrchestrator.js` calls Gemini/Claude/OpenAI/DeepSeek/OpenRouter via `providerPool.js`
- Credentials from canonical `api_integrations` (Settings Integrations)
- Aggregation = majority action + average confidence (naive)
- This is **not** the Core Rule Multi-AI Council architecture

### Proposed role split

1. **Deterministic pre-validation:** schema, identity, freshness, availability, correlation grouping, Risk hard constraints input packing
2. **Optional AI synthesis:** explain conflicts, propose structured rationale, critique assumptions — advisors only
3. **Deterministic post-validation:** re-check authority boundaries, reject execution flags, enforce abstain rules, write audit-safe artifact
4. **Fallback when provider unavailable:** deterministic synthesis/abstain; never pretend LLM consensus occurred
5. **Auditability:** store advisor artifact refs separately from Agent evidence and from control outputs

External AIs are advisors. Artemis remains synthesizer. Risk retains veto.

No private exchange calls and no new Artemis secret subsystem.

---

## 13. Settings / API Integrations (PROVEN BY CODE)

Canonical owner already exists:

- UI: `components/settings/configuration/Integrations.tsx`
- API: `/api/config/integrations` + encrypted `api_integrations`
- Consumer: `providerPool.js`
- Artemis System section links to Integrations — does not own secrets

WP-C must **reuse** this owner for health/routing/fallback/quota/privacy metadata.  
**Do not create an Artemis-specific credential/config subsystem.**

Known debt: dual decision-engine config (`artemis_state` vs `system_config`) — CORRECT later inside WP-C packages, not Discovery fix.

---

## 14. Security / RBAC (PROVEN BY CODE + PROPOSED)

### Current

- `AI_AGENT_READ` → readiness/logs/orchestration GET
- `ARTEMIS_DECISION_EXECUTE` → POST `/decision` (advisory generation capability name is misleading)
- `ARTEMIS_STATE_WRITE` → config/state writes
- `KILL_SWITCH_CONTROL` → settings kill-switch
- Product audit projection strips raw Agent I/O from `/logs`
- Simple UI forbids raw enums / WP codes / secrets via presentation rules

### Gaps

- TE → Artemis call without Authorization header (fail-closed today via 401) — transport must be fixed in WP-C
- Some legacy routes (`/health`, `/learning`, `/scenarios`) weaker than product readiness capability gating
- Capability name `ARTEMIS_DECISION_EXECUTE` may be misread as Live authorization

### Visibility proposal

| Audience | May see |
|---|---|
| Simple UI | truthful maturity, advisory recommendations, safety blocked reasons, high-level health |
| Advanced UI | evidence/synthesis/conflict/control diagnostics, contract versions, correlation families |
| Admin/operator | readiness blockers, provider health (no raw secrets), Kill Switch controls, audit projections |

No raw secrets, signed provider payloads, or full encrypted key material in Artemis UI.

---

## 15. UI / product discovery (no redesign now)

Canonical section IDs already exist:  
`overview · evidence · decisions · orchestration · controls · lineage · system`

### Future WP-C requirements (PROPOSED)

**Simple**

- Home: advisory maturity + what Artemis can/cannot do
- AI Inputs: connected vs evidence-compatible vs blocked (keep distinction)
- Recommendations: ArtemisDecision outcomes, never execution approval
- Coordination: realAgentCoordination only when true; else NOT CONNECTED / PARTIAL
- Safety & Approval: Risk/runtime states; explicit non-approval
- History & Audit: advisory + evidence refs without raw payloads
- System Health: providers/runtime/Data Hub links

**Advanced**

- Evidence diagnostics
- Synthesis diagnostics
- Conflict diagnostics
- Control-chain diagnostics

### Truthful states to preserve/extend

`NOT CONNECTED` · `PARTIAL` · `SHADOW` · `ADVISORY` · `BLOCKED` · `UNAVAILABLE`

**Evidence-compatible ≠ connected to Artemis.** Keep this WP-A/WP-B.1 truth.

---

## 16. Shadow mode discovery (architecture only)

Shadow means:

- Artemis creates ArtemisDecision records
- No ExecutionIntent activation / no orders
- Evidence refs + decisions recorded
- Later comparison/evaluation possible (WP-D)
- Control chain outcomes observable
- `executionEligible` remains `false`

### Persistence prerequisite (PROPOSED)

Append-only Artemis decision-context + evidence-reference store (**B10 candidate**), separate from:

- `ai_decisions` (remain Agent-run SoT)
- `system_logs` (remain operational/advisory log, insufficient as Shadow SoT)

Without B10 (or equivalent approved persistence), Shadow activation is **BLOCKED BY EVIDENCE / persistence gap**.

---

## 17. Data / storage discovery

| Store | Role today | WP-C implication |
|---|---|---|
| `ai_decisions` | Canonical Agent-run SoT; on-read evidence source | **PRESERVE** as Agent-run SoT |
| `system_logs` (`artemis_decision`) | Unstructured advisory decision log | Insufficient for Shadow lineage |
| `artemis_state` | status/strategy/config | Config only; not decision lineage |
| `ai_learning_events` | learning events | Not decision context |
| Order/execution tables | independent of Artemis decisionContextId | No Artemis linkage today |
| Evidence persist table | **missing** | B10 candidate |
| ArtemisDecision persist table | **missing** | B10 / Shadow prerequisite |

**No migration in Discovery.**

---

## 18. Proposed WP-C work packages

Adjustable after Owner review. Defaults:

### WP-C.1 — Orchestration contracts + deterministic admission

- **Objective:** ArtemisDecision contract, admission rules, legacy MoE containment boundary, identity normalization for synthesis input
- **Likely files:** `backend/contracts/*`, `artemisDecisionContainment.js`, `artemisAgentIdentity.js`, schemas, readiness flags (read path)
- **Depends on:** WP-B.1 frozen contract
- **Risk:** Tier 2
- **Migration:** NO · **Provider:** NO · **Runtime mutation:** NO (library/contract first)
- **Human QA:** contract/readiness milestone later
- **Owner gate:** approve contract shape before coding

### WP-C.2 — Synthesis / conflict / correlation engine

- **Objective:** deterministic role-aware synthesis; conflict states; correlation grouping; abstain rules; optional LLM advisor slot behind post-validation
- **Likely files:** new synthesis service (not equal-vote MoE), replace/adapt `aggregateDecisions` consumers
- **Depends on:** WP-C.1
- **Risk:** Tier 2–3
- **Migration:** NO initially · **Provider:** optional later LLM only via Integrations · **Runtime mutation:** NO until explicitly authorized deploy
- **Human QA:** advisory decision scenarios
- **Owner gate:** conflict policy + no-weight rule confirmation

### WP-C.3 — Required Agent remediation (scoped)

- **Objective:** only remediations required for initial set reliability (e.g., Pattern provenance if Owner expands set; identity debts). Prefer separate Agent WPs for Technical/Timing/Liquidity productization
- **Depends on:** Owner choice of initial set
- **Risk:** Tier 2–3 by Agent
- **Migration:** NO unless Agent already requires it (stop if so)
- **Provider:** public-only if already authorized by Agent outcome
- **Owner gate:** per-Agent scope

### WP-C.4 — Risk / Portfolio / Optimization integration

- **Objective:** wire Risk veto + Portfolio bounded sizing into ArtemisDecision lifecycle; keep Optimization NOT_APPLICABLE unless Owner reclassifies
- **Likely files:** `risk-gate.js` UUID debt fix via `agent_key`, portfolio SoT, readiness.controlChain → real pipeline
- **Depends on:** WP-C.1–C.2
- **Risk:** Tier 3
- **Migration:** NO expected · **Provider:** NO · **Runtime mutation:** NO until authorized
- **Human QA:** veto/sizing scenarios
- **Owner gate:** Risk hard authority + Portfolio SoT

### WP-C.5 — Liquidity / runtime-safety / Order intent boundary

- **Objective:** define Liquidity unavailable vs feasible; keep runtime SSOT; introduce ExecutionIntent boundary without enabling Live
- **Depends on:** WP-C.4; Liquidity real product may be external prerequisite
- **Risk:** Tier 3 (Tier 4 if any real order path touched — stop)
- **Migration:** NO · **Provider:** NO private · **Runtime mutation:** NO
- **Human QA:** fail-closed eligibility
- **Owner gate:** no Live; ExecutionIntent non-activating

### WP-C.6 — Product UI / readiness / audit integration

- **Objective:** Simple/Advanced diagnostics for synthesis/conflict/control; truthful states; TE→Artemis authenticated transport fix (still fail-closed)
- **Likely files:** AIManager Artemis sections, readiness service, `tradingEngine.js` auth transport
- **Depends on:** WP-C.1–C.2 (+ partial C.4)
- **Risk:** Tier 2
- **Migration:** NO · **Provider:** NO · **Runtime mutation:** deploy only when authorized
- **Human QA:** Simple + Advanced Browser QA
- **Owner gate:** no Simple redesign beyond truthful wiring without approval

### WP-C.7 — Shadow preparation

- **Objective:** Shadow architecture wiring against B10 persistence; still `executionEligible=false`
- **Depends on:** WP-C core + **B10 approved and implemented**
- **Risk:** Tier 3
- **Migration:** via B10 only · **Provider:** NO · **Runtime mutation:** NO Live
- **Human QA:** Shadow recording without orders
- **Owner gate:** explicit Shadow authorization (separate from WP-C discovery)

---

## 19. Decision Register

| ID | Topic | Recommendation | Status |
|---|---|---|---|
| D1 | Synthesis strategy | Deterministic role-aware synthesis + optional LLM advisor; retire naive majority MoE as authority | PROPOSED |
| D2 | Correlation strategy | Family grouping + single confirmation credit; no invented coefficients | PROPOSED |
| D3 | Initial Agent set | Analytical: trend, volume, arbitrage; Control: risk, portfolio, runtime; defer others | PROPOSED |
| D4 | Risk authority | Hard veto/limit; not a vote; resolve UUID via `agent_key=risk` | PROPOSED |
| D5 | Portfolio / Optimization | Portfolio = bounded sizing; Optimization remains NOT_APPLICABLE to equal synthesis | PROPOSED |
| D6 | Liquidity boundary | Feasibility only after real implementation; else unavailable fail-closed | PROPOSED |
| D7 | Order boundary | ExecutionIntent consumer only; never invents direction | PROPOSED |
| D8 | WP-C / B10 sequence | Primary **A** (WP-C core → B10 → Shadow); alt **C** | REQUIRES OWNER DECISION |
| D9 | Shadow persistence prerequisite | Append-only ArtemisDecision + evidence refs (B10 candidate); not `system_logs` | PROPOSED |
| D10 | ArtemisDecision contract | Fields in §10.1; always non-execution until later gates | PROPOSED |
| D11 | ExecutionIntent boundary | Separate later contract; blocks legacy `approved:true` | PROPOSED |
| D12 | LLM role | Advisor behind deterministic pre/post validation; Integrations remain secret owner | PROPOSED |
| D13 | Degraded behavior | Advisory degrade truthful; execution eligibility always fail closed | PROPOSED |
| D14 | Expand initial set to include Pattern/Sentiment/etc. | Keep deferred until provenance/adapters ready | DEFERRED |
| D15 | Activate Shadow/Paper/Live in WP-C | Forbidden by freeze | BLOCKED BY EVIDENCE / POLICY |
| D16 | B10 migration now | Not part of Discovery | REQUIRES OWNER DECISION (later) |
| D17 | Replace Capability name `ARTEMIS_DECISION_EXECUTE` | Rename/clarify to reduce misread | PROPOSED |
| D18 | Fix TE unauthenticated Artemis transport | Required in WP-C.6; keep fail-closed | PROPOSED |

**No new choices are OWNER APPROVED by this Discovery document.**

---

## 20. Known bugs / debts discovered (DOCUMENT ONLY — do not fix here)

| Item | Evidence | Label |
|---|---|---|
| `callAgentAPI` returns mock NEUTRAL + random confidence | `artemisOrchestrator.js` | PROVEN BY CODE |
| `GET /orchestration` fabricates CPU/memory | `routes/artemis.js` | PROVEN BY CODE |
| Dual decision-engine config owners | readiness dualConfig flag | PROVEN BY CODE |
| TE calls Artemis without auth header | `tradingEngine.js` | PROVEN BY CODE |
| Risk Gate hardcoded UUID | `risk-gate.js` | PROVEN BY CODE |
| Liquidity Agent stub confidence 0.55 | `agents/liquidity.js` | PROVEN BY CODE |
| Pattern mock can appear as realtime provenance | `agents/pattern.js` (WP-B documented) | PROVEN BY CODE / docs |
| MoE prompt language implies EXECUTE | `artemisOrchestrator.js` | PROVEN BY CODE |
| Portfolio self-id inconsistency (`portfolio_allocation`) | Agent code / catalog | PROVEN BY CODE |

---

## 21. Safety ledger for this Discovery

| Metric | Count |
|---|---|
| Product code changes | 0 |
| Runtime changes | 0 |
| DB mutations | 0 |
| Migrations | 0 |
| Provider/private API calls | 0 |
| Agent executions | 0 |
| Financial side effects | 0 |
| PM2 mutations | 0 |
| Protected script touches | 0 |
| PR created | 0 |
| Merge performed | 0 |
| WP-C implementation started | NO |
| B10 started | NO |
| WP-D started | NO |
| Shadow/Paper/Live activated | NO |

Changed files expected for Discovery commit only:

1. `.cursor/rules/titangold-current-active-work.mdc`
2. `docs/ARTEMIS_WP_C_ORCHESTRATION_DISCOVERY.md`

---

## 22. Final Discovery verdict

**ARTEMIS WP-C DISCOVERY COMPLETE**  
**OWNER ARCHITECTURE REVIEW REQUIRED**  
**NO IMPLEMENTATION STARTED**

Current system is a truthful advisory shell over legacy MoE, with WP-B.1 on-read evidence for trend/arbitrage/volume and a fail-closed execution gate. The control chain Risk → Portfolio/Optimization → Liquidity → Order is **not** wired into Artemis decisions. WP-C should build role-aware synthesis and control-chain architecture without claiming EVIDENCE_READY, Shadow, Paper, or Live readiness.
