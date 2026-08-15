# ARTEMIS WP-C — Orchestration / Synthesis / Control-Chain Discovery

**Status:** **WP-C DISCOVERY ARCHITECTURE — OWNER APPROVED** · **WP-C.1 CLOSED AND FROZEN** · **WP-C.2 CLOSED AND FROZEN**  
**Canonical product main:** `origin/main` = `cf04f1137cd148385624dc12f10e9628ec530a13`  
**WP-C.2 product merge:** PR #25 → `cf04f1137cd148385624dc12f10e9628ec530a13`  
**WP-C.2 implementation branch final HEAD:** `e9b03a63499b79e3f8f335a095c95e712a16eaf6`  
**WP-C.1 product merge (historical):** PR #23 → `47655c008c01266299d6e92eb9c5b24ab5c7c5a3`  
**Pre-C.1 frozen main baseline (Discovery era):** `69b71b6a628b8139d3161bb4efc41507a72db9cf`  
**Discovery branch:** `feat/artemis-wp-c-orchestration-discovery`  
**Discovery Owner-approval SHA:** `658290a07641f317b60ee8d4afec87464edfcdbc`  
**Hardened Discovery HEAD (pre-approval):** `b3274a59060db8c30f9f3dc35ef3e1de009ed8b7`  
**C.1 implementation branch:** `feat/artemis-wp-c1-orchestration-contracts`  
**C.1 implementation final HEAD:** `3ca6558c06a3412aa1ce8feb09e039bd7d172acb`  
**C.2 implementation branch:** `feat/artemis-wp-c2-deterministic-synthesis`  
**C.2 worktree:** `/home/ubuntu/worktrees/titangold-artemis-wp-c2`  
**Risk tier (Discovery):** Tier 0 — Documentation milestone  
**C.1 pure-library product:** **CLOSED AND FROZEN**  
**C.1 Runtime Wired / Active:** **NO / NO**  
**C.2 Runtime Wired / Active:** **NO / NO**  
**B10 / WP-D / Shadow / Paper / Live:** **NOT STARTED**  

This is the **single canonical** WP-C living document. Do not create parallel Artemis closeout docs.

### C.1 factual status (CLOSED AND FROZEN)

Delivered library files on main:

- `backend/contracts/artemisDecisionContract.js` — `artemis-decision-1.0.0`
- `backend/services/artemisEvidenceAdmissionService.js` — pure admission/compatibility
- `backend/__tests__/unit/artemisDecisionContract.wpC1.test.js`

Invariants: `decisionEligible=false`, `executionEligible=false`, legacy `approved`/`approvedForExecution` rejected.  
Final integrity: agentId↔role/authorityClass; admissionState↔confirmationSemantics; Decision-safe `evidenceRefs`; Policy A exact `artemis-evidence-1.0.0`.  
WP-B.1 frozen. Sentiment untouched / not Artemis-consumable. Optimization remains NOT_APPLICABLE to initial control chain.

See **§23 WP-C.1 CLOSEOUT AND FREEZE** for full lifecycle, CI, server alignment, and provenance semantics.

### C.2 factual status (library implementation — not closed)

Owner-authorized pure deterministic synthesis / conflict / qualitative correlation:

- `backend/contracts/artemisSynthesisContract.js` — `artemis-synthesis-1.0.0` / policy `wp-c2-synthesis-1.0.0`
- `backend/services/artemisDeterministicSynthesisService.js`
- `backend/__tests__/unit/artemisSynthesis.wpC2.test.js`

Policy locks: `MIN_INDEPENDENT_DIRECTIONAL_FAMILIES=2` · Trend+Volume = one OHLCV family · Arbitrage opportunity-only · no numeric synthesis confidence · no correlation coefficients · no Risk/Portfolio/Liquidity/Order integration · no Sentiment remediation · no B10 · no runtime activation.

See **§24 WP-C.2 DETERMINISTIC SYNTHESIS IMPLEMENTATION**.

---

## 0A. OWNER APPROVAL MILESTONE (LOCKED)

**Verdict:** WP-C DISCOVERY ARCHITECTURE — OWNER APPROVED  
**Hardened SHA approved as architecture baseline:** `b3274a59060db8c30f9f3dc35ef3e1de009ed8b7`  
**Implementation had not begun at this milestone:** YES  

### Owner-approved decisions

1. **Target control chain:** Analytical Evidence → Artemis Synthesis → Risk veto → Portfolio bounded sizing/allocation → Liquidity feasibility → Runtime safety → Order Management via ExecutionIntent only
2. **Risk:** hard veto/control authority; not an equal analytical vote; unavailable Risk may permit explicitly non-actionable advisory analysis only; `decisionEligible`/`executionEligible` fail closed; current Demo RiskGate fail-open MUST NOT be interpreted as Artemis approval
3. **Portfolio:** bounded sizing/allocation only
4. **Optimization:** outside initial Artemis control chain; NOT_APPLICABLE unless separately promoted later
5. **Liquidity:** execution feasibility only; unavailable until real implementation; fail closed for execution
6. **Order:** ExecutionIntent consumer only; never creates BUY/SELL direction
7. **Correlation:** qualitative containment only; preserve all lineage; source/feature/signal correlation are distinct; correlated evidence cannot claim independent confirmation; no numeric de-correlation or invented coefficients without measurement
8. **Current evidence intake:** trend + volume = one OHLCV directional/regime family; arbitrage = opportunity context only; NOT a directional analytical vote
9. **Second independent family:** sentiment is the preferred future remediation candidate; sentiment is NOT currently Artemis-consumable; do NOT remediate sentiment in C.1
10. **Approved sequence:** WP-C.1 → WP-C.2 → B10 → control/runtime integration → Shadow preparation → separate Owner gate for Shadow activation
11. **B10:** NOT required before C.1/C.2; REQUIRED before meaningful Shadow; `system_logs` must NOT become Shadow SoT
12. **WP-D:** replay / evaluation / backtesting / calibration later
13. **Shadow / Paper / Live:** NOT STARTED; NOT AUTHORIZED
14. **C.1/C.2:** may proceed as pure deterministic library work
15. **Multi-family claim:** no meaningful multi-family synthesis claim until an independent family is remediated and validated

**Sentiment status (explicit):** selected future remediation candidate · **NOT evidence-approved** · **NOT Artemis-consumable** · no C.1 remediation.

After this milestone, C.1 must branch from the Owner-approval commit SHA (`WP_C_DISCOVERY_APPROVED_SHA`). Do not rewrite this Discovery architecture baseline after C.1 branches.

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
  → Portfolio bounded sizing / allocation
  → Liquidity Feasibility
  → Runtime Safety / Emergency Stop / capability / mode
  → Order Management (ExecutionIntent only)
  → Provider (only when separately Tier-4 authorized)
```

**Optimization wording (correction):**  
Initial control chain uses **Portfolio bounded sizing/allocation only**.  
An optional future Optimization service may participate **only if separately promoted/approved**.  
Optimization remains **NOT_APPLICABLE** to the initial Artemis control chain.

### Authority boundaries (PROPOSED; not implemented)

| Authority | May | Must not |
|---|---|---|
| **Artemis** | Admit evidence; resolve conflict; propose decisions; explain limitations | Bypass Risk/Portfolio/Liquidity/runtime; invent account state; place orders |
| **Risk** | Veto / block / limit / require more evidence | Count as equal directional vote; treat Demo fail-open as approval |
| **Portfolio** | Bounded sizing / allocation within canonical balances | Unrestricted directional signal; fabricate balance |
| **Optimization** | Outside initial chain (`NOT_APPLICABLE`) | Imply current participation in Artemis control |
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
   - Risk unavailable (for decisionEligible/executionEligible) or Risk vetoes
   - context incompatible (timeframe/horizon mismatch)
6. Risk veto is authoritative for control — not averaged away.
7. Propagate all supporting + conflicting evidence + limitations into the decision record.
8. When no safe decision can be produced: emit explicit non-decision state (`insufficient_evidence` / `blocked_by_risk` / `incompatible_evidence`), never a fake HOLD-as-success without reason.

### Role-aware preference order (PROPOSED, not weighted scores)

1. Runtime safety / Kill Switch (hard stop)
2. Risk veto / limits
3. Compatibility + freshness + data-quality gates
4. Analytical evidence synthesis with **qualitative correlation containment** (not numeric de-correlation)
5. Opportunity forecasts as secondary context (not automatic direction)
6. Portfolio bounded sizing only after a non-blocked analytical proposal
7. Liquidity feasibility only near execution-intent stage
8. Order Management never participates in direction synthesis
9. Optimization remains outside this order unless separately promoted

---

## 6. Correlation / double-counting (CORRECTED)

Contract already defines correlation-family metadata (`CORRELATION_FAMILY` in `artemisEvidenceContract.js`) — **PROVEN BY CODE**. WP-B tags only.

### 6.1 Findings (unchanged facts)

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

### 6.2 Correlation kinds (must remain distinct)

| Kind | Meaning | Example |
|---|---|---|
| **SOURCE CORRELATION** | Same upstream raw feed / provider / candle series | Trend + Volume both read MEXC OHLCV |
| **FEATURE CORRELATION** | Derived features overlap even if interpretation differs | SMA/EMA used by multiple Agents |
| **SIGNAL CORRELATION** | Final directional/regime conclusions move together | Two Agents both emit bullish for same window |

These are **not equivalent**. Same source family does **not** prove evidence items are identical.

### 6.3 Discovery-level correlation policy (CORRECTED — PROPOSED)

**Rejected prior wording:** “count correlated group once / flatten same-family into one identical vote” — **TOO STRONG**.

**Corrected policy:**

1. Preserve every admitted evidence item and its lineage
2. Identify `correlationFamily` (and later source/feature/signal tags when available)
3. Group same / upstream-related families for diagnostics
4. Do **not** claim independent confirmation from correlated members
5. Do **not** flatten all same-family evidence into one identical vote
6. Apply a **bounded family-level influence policy later** only after measurement
7. Do **not** invent numeric coefficients in Discovery or in initial WP-C deterministic engine
8. Initial WP-C may use **qualitative correlation containment** only (e.g., “correlated — not independent confirmation”)
9. Quantitative influence / scoring / de-correlation = **UNKNOWN / REQUIRES MEASUREMENT**

---

## 7. All 15 Agent dependency matrix (REVALIDATED)

**consumable now** = adapter/on-read can build a truthful envelope for *future* WP-C intake. System-level `artemisConsumable` remains `false`.

**Class definitions (enforced):**

- **A** = READY FOR WP-C CONSUMPTION (truthful path exists today)
- **B** = SMALL OUTPUT / ADAPTER / PROVENANCE CORRECTION BEFORE WP-C
- **C** = REAL AGENT IMPLEMENTATION / DATA-PATH WORK REQUIRED BEFORE RELIANCE
- **D** = CONTROL-CHAIN SPECIALIST — SEPARATE WP-C INTEGRATION
- **E** = DEFERRED / NOT REQUIRED FOR INITIAL WP-C

An Agent may be technically **C** and still **operationally deferred** from the initial set. Both are recorded.

| agentId | role | maturity | evidence | real/mock/stub | WP-C relevance | consumable now | class | blocker | remediation | stage |
|---|---|---|---|---|---|---|---|---|---|---|
| trend | analytical_evidence | frozen real product | adapter YES | real OHLCV | high directional/regime | YES | **A** | identity alias / freshness unknown gaps | keep adapter; normalize identity | WP-C intake |
| volume | analytical_evidence | real path | adapter YES | real OHLCV volume | high; same OHLCV family as trend | YES | **A** | source-correlated with trend | qualitative containment with trend | WP-C intake |
| arbitrage | opportunity_forecast | frozen real product | adapter YES | real public spread | opportunity context only | YES | **A** | must not become directional analytical vote | keep opportunity schema | WP-C opportunity |
| pattern | analytical_evidence | partial | excluded | real MEXC path + dishonest mock fallback risk | same OHLCV family — no diversity gain | NO | **B** | `meta.source:'realtime'` even on mock path | fail-closed mock + truthful provenance; then adapter | before same-family reliance |
| sentiment | analytical_evidence | partial | no adapter | Twitter/News mock-without-key; Reddit public real path; aggregate weights mock if `!error` | **candidate independent family** (`TEXT_SOCIAL_NEWS`) | NO | **C** | dishonest `meta.source:'realtime'`; mock-weighted confidence | fail-closed zero-real-sources; ignore `mock:true`; truthful provenance; then adapter | bounded remediation WP then intake |
| price_prediction | opportunity_forecast | partial | no adapter | OHLCV real + mock predictions fallback | same OHLCV family; uncalibrated | NO | **C** | mock predictions + missing provenance on real path | fail-closed mock; provenance; calibration or confidence UNAVAILABLE | Agent remediation then later |
| fundamental | analytical_evidence | partial | no adapter | F&G real; funding/news placeholders; random tokenomics; `_meta.source:'real'` dishonest | weak / not initial | NO | **C** | placeholders inside decision + dishonest provenance | remove placeholders from decision path or broad rebuild | deferred from initial (technically C) |
| market_intelligence | analytical_evidence | larger partial | no adapter | empty news treated available; VIX numeric fallback; base confidence 50 | potentially independent but not trustworthy | NO | **C** | synthetic confidence / fallback / provenance gaps | fail-closed + confidence rewrite + slice isolation; else rebuild | deferred from initial (technically C) |
| technical | analytical_evidence | MVP mock | no adapter | `Math.random` mock | future OHLCV family | NO | **C** | no real market data | real OHLCV product | Agent WP then WP-C |
| timing | opportunity_forecast | MVP mock | no adapter | mock series | future OHLCV-like | NO | **C** | mock data | real OHLCV product | Agent WP then WP-C |
| liquidity | execution_feasibility | stub | blocked | stub `0.55` | control feasibility | NO | **C** | stub; analyzer unwired | real order-book feasibility | Agent/control WP |
| risk | control_veto | substantial + gate debt | N/A directional | UUID hardcode; Demo fail-open on gate error exists today | control authority | NO* | **D** | not on Artemis path; do not import Demo fail-open as Artemis approval | control schema + `agent_key=risk` | WP-C control packages |
| portfolio | control_sizing | partial | N/A | partial / identity debt | control authority | NO* | **D** | not on Artemis path; self-id debt | SoT balances + control schema | WP-C control packages |
| order | execution | real gated path | NOT_EXECUTION_ELIGIBLE | execution ops | execution only | NO | **D** | must not synthesize direction | ExecutionIntent only | after control packages |
| optimization | NOT_APPLICABLE | utility/backtest | NOT_APPLICABLE | utility | not initial control | NO | **E** | not producer/control for initial chain | keep out unless separately promoted | deferred |

\* Risk/Portfolio are “consumable” only as **control authorities**, not evidence votes.

### Class counts (revised)

- **A** 3 — trend, volume, arbitrage  
- **B** 1 — pattern  
- **C** 7 — sentiment, price_prediction, fundamental, market_intelligence, technical, timing, liquidity  
- **D** 3 — risk, portfolio, order  
- **E** 1 — optimization  

### Independent evidence-family candidate analysis

| Candidate | Provider/data | Trustworthy today? | Independent of OHLCV? | Min remediation | Without broad rebuild? | Verdict |
|---|---|---|---|---|---|---|
| **sentiment** | Twitter (key), Reddit public JSON, CryptoPanic/News (key); mock-on-missing-key | **NO** (weights mock; labels realtime) | **YES** if real sources only | ignore mock; fail-closed if zero real; truthful provenance; adapter | **YES** (bounded) | **Best A candidate** |
| **market_intelligence** | CryptoPanic/NewsAPI, CoinGecko, Blockchain.info, Glassnode, Alpha Vantage | **NO** (base-50 confidence; VIX fallback; empty-news-as-available) | **YES** potentially | large fail-closed + confidence rewrite; or narrow CoinGecko-only slice | **NO** for full product; maybe for narrow slice | Prefer after sentiment |
| **fundamental** | Alternative.me F&G + placeholders/random | **NO** | Weak/partial | remove placeholders / rebuild decision | **NO** | Not initial |
| **pattern** | MEXC OHLCV | Partial | **NO** (same family) | provenance only | YES | Does not fix diversity |
| **price_prediction** | MEXC OHLCV + model/mock | Partial | **NO** | fail-closed + calibration | NO for calibrated forecast | Does not fix diversity |

### Diversity correction recommendation

**Prefer A:** add **one independent analytical family before meaningful multi-family WP-C synthesis**.

**Recommended additional Agent:** `sentiment` — after a **bounded truthful remediation** (do not weight `mock:true`; fail-closed when no real source; honest provenance; then WP-B-style adapter). Reddit-only path is the key bounded real source today (**PROVEN BY CODE**).

Until that remediation lands:

- Current truthful directional/regime intake is effectively **one OHLCV family** (trend + volume) plus opportunity context (arbitrage)
- Any WP-C synthesis over only that set must be labeled **architecture-only / insufficient for meaningful multi-family synthesis**

**Do not** treat Market Intelligence as winner without the larger remediation above.

---

## 8. Initial WP-C Agent buckets (OWNER APPROVED)

Buckets replace the prior “INITIAL ANALYTICAL SET” wording. Arbitrage is **not** directional analytical evidence.

### INITIAL DIRECTIONAL / REGIME EVIDENCE

1. **trend** — direction/regime (frozen, adapter-ready, OHLCV)
2. **volume** — volume features from same OHLCV family (adapter-ready; **not** independent confirmation of trend)

**Diversity gap:** after qualitative correlation containment, this is **one directional evidence family**.

### OPPORTUNITY CONTEXT

1. **arbitrage** — spread/opportunity context only; **never** an equal directional analytical vote

### CONTROL AUTHORITIES

1. **risk** — veto/limits (after UUID/control wiring); Artemis must not treat Demo fail-open as approval
2. **portfolio** — bounded sizing (after identity/balance SoT)
3. **runtime safety / Kill Switch** — already real SSOT (not an Agent)
4. **liquidity** — only after real feasibility implementation (otherwise unavailable / fail-closed)
5. **order** — ExecutionIntent consumer only; never initial advisory voter
6. **optimization** — **outside initial chain** (`NOT_APPLICABLE`) unless separately promoted

### DEFERRED

- **sentiment** — selected future remediation candidate (technically **C** today); **NOT evidence-approved**; **NOT Artemis-consumable**; **do NOT remediate in C.1**
- **market_intelligence** — technically **C**; deferred
- **fundamental** — technically **C**; deferred from initial
- **pattern** — **B** provenance; deferred for diversity (same OHLCV family)
- **price_prediction** — **C**; deferred; same OHLCV family
- **technical**, **timing** — **C**; need real productization
- **optimization** — **E** / NOT_APPLICABLE

### Recommendation status

| Question | Answer | Status |
|---|---|---|
| Is trend+volume+arbitrage the final smallest credible multi-family synthesis set? | **NO** — one OHLCV family + opportunity context | OWNER APPROVED |
| Preferred second family | **sentiment** after bounded remediation | OWNER APPROVED (future candidate only) |
| Until sentiment remediation | Architecture-only / single-family synthesis over OHLCV + opportunity context; no multi-family claim | OWNER APPROVED |
| Final initial intake for C.1/C.2 libraries | trend + volume (+ arbitrage opportunity context) | OWNER APPROVED |
| Sentiment remediate in C.1? | **NO** | OWNER APPROVED |

**Do not require all 15 Agents before WP-C starts.** C.1/C.2 may proceed as pure contracts/deterministic libraries over current on-read evidence while clearly labeled insufficient for multi-family claims.

---

## 9. WP-C vs B10 vs WP-D (OWNER APPROVED SEQUENCE)

| Package | Belongs | Does not belong |
|---|---|---|
| **WP-C.1 / WP-C.2** | contracts; admission; ArtemisDecision schema; deterministic safety boundaries; pure synthesis/conflict/correlation library | runtime orchestration activation; Shadow; Live; B10 migration |
| **B10** | append-only / versioned ArtemisDecision + evidence-reference persistence; durable decision context | Shadow activation; synthesis algorithm ownership; Live |
| **WP-C control/runtime packages** | Risk; Portfolio; Liquidity boundary; runtime safety; Order ExecutionIntent boundary; product/history/audit | Optimization unless separately promoted; Live |
| **WP-C Shadow prep** | Shadow wiring against B10; still `executionEligible=false` | Shadow activation without Owner gate |
| **WP-D** | lineage/replay/evaluation/backtesting/calibration/performance/promotion | initial synthesis MVP |

### Precise sequence (OWNER APPROVED — Option A narrowed)

```
PHASE 1 — WP-C.1
  orchestration contracts
  admission
  ArtemisDecision schema
  deterministic safety boundaries
  (pure/library; uses WP-B.1 on-read evidence; NO B10 required)

PHASE 2 — WP-C.2
  deterministic synthesis / conflict / qualitative correlation engine
  pure/library behavior
  NO runtime orchestration activation
  NO provider dependency required
  (NO B10 required)

THEN — B10
  append-only / versioned ArtemisDecision + evidence-reference persistence
  durable decision context
  NO Shadow activation yet
  DO NOT use system_logs as Shadow SoT
  DO NOT present runtime-generated Artemis decisions as durable audited lineage
    until approved persistence exists

THEN — WP-C control / runtime integration packages
  Risk · Portfolio · Liquidity boundary · runtime safety
  · Order ExecutionIntent boundary · product/history/audit

THEN — WP-C Shadow preparation

THEN — separate Owner gate: Shadow activation
```

### Sequence lock answers

| Question | Answer |
|---|---|
| B10 required before C.1 / C.2? | **NO** — C.1/C.2 may operate as pure contracts/services over WP-B.1 on-read |
| B10 required before meaningful Shadow? | **YES** |
| B10 required before Shadow activation Owner gate? | **YES** |
| system_logs as Shadow SoT? | **NO** |
| WP-D timing? | After Shadow foundation / durable records; remains replay/eval/calibration |

**No concrete source blocker** was found against this narrowed Option A sequence. Remaining dependency is Owner approval + separate authorization for each phase.

Shadow / Paper / Live remain NOT STARTED until separately authorized.

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
| Risk unavailable | Analytical/advisory synthesis may continue **only** as explicitly **non-actionable** analysis with `riskStatus=UNAVAILABLE` | `decisionEligible` / `executionEligible` **fail closed** |
| Portfolio unavailable | Allow analysis-only; sizing unavailable | fail closed for size-requiring intents |
| Optimization unavailable | Ignore (NOT_APPLICABLE / outside initial chain) | no change by itself |
| Liquidity unavailable | Analysis-only; no feasibility approval | fail closed for execution |
| Provider degraded | Mark degraded evidence/providers | fail closed |
| Stale evidence | Exclude from independent confirmation claims; may force abstain | fail closed |
| Unresolved material conflict | HOLD/ABSTAIN/insufficient | fail closed |
| DB read failure | Degraded UI + deny decision persistence paths | fail closed |
| Artemis LLM/provider unavailable | Deterministic fallback synthesis or abstain; never fake consensus | fail closed |
| Emergency Stop active | Advisory may explain blocked state | fail closed; side effects suppressed |

### 11.1 Risk unavailable semantics (IMPORTANT DISTINCTION)

**Current RiskGate runtime (PROVEN BY CODE — do not rewrite in Discovery):**

- `backend/services/risk-gate.js` resolves fail policy from runtime SSOT
- Demo / injected-demo: `failClosedOnError: false` (fail-open on Risk gate **error**)
- Live / kill-switch / unknown runtime: fail-closed
- This existing Demo fail-open behavior is **not** redefined here

**Future Artemis semantics (PROPOSED — no code change now):**

1. Analytical/advisory synthesis may continue with Risk status **UNAVAILABLE** only as explicitly **non-actionable** analysis
2. `decisionEligible` and `executionEligible` must **fail closed** when mandatory Risk authority is unavailable
3. No Artemis control chain may interpret current Demo fail-open RiskGate error behavior as **Risk approval**
4. Risk veto remains authoritative when Risk is available; unavailable ≠ approved

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

## 18. Proposed WP-C work packages (aligned to locked sequence)

### WP-C.1 — Orchestration contracts + deterministic admission

- **Objective:** ArtemisDecision contract, admission rules, legacy MoE containment boundary, identity normalization, deterministic safety boundaries
- **Likely files:** `backend/contracts/*`, `artemisDecisionContainment.js`, `artemisAgentIdentity.js`, schemas, readiness flags (read path)
- **Depends on:** WP-B.1 frozen contract · **B10 NOT required**
- **Risk:** Tier 2
- **Migration:** NO · **Provider:** NO · **Runtime mutation:** NO (library/contract first)
- **Human QA:** contract/readiness milestone later
- **Owner gate:** approve contract shape before coding

### WP-C.2 — Synthesis / conflict / qualitative correlation engine

- **Objective:** deterministic role-aware synthesis; conflict states; qualitative correlation containment; abstain rules; optional LLM advisor slot behind post-validation later
- **Likely files:** new pure synthesis library (not equal-vote MoE); no runtime orchestration activation in this package
- **Depends on:** WP-C.1 · **B10 NOT required** · **Provider dependency NOT required**
- **Risk:** Tier 2–3
- **Migration:** NO · **Provider:** NO for core deterministic engine · **Runtime mutation:** NO
- **Human QA:** library/scenario tests; later Browser QA with UI package
- **Owner gate:** conflict + qualitative correlation policy confirmation
- **Truth label:** with only OHLCV family admitted, outputs are architecture-capable but **insufficient for multi-family synthesis claims** until an independent family (preferred: remediated sentiment) is added

### B10 — Append-only ArtemisDecision + evidence-reference persistence

- **Objective:** durable decision context; versioned evidence refs; not Shadow activation
- **Depends on:** WP-C.1 schema stability (C.2 preferred but not a hard code blocker if schema frozen in C.1)
- **Risk:** Tier 3
- **Migration:** YES (when Owner authorizes) · **Provider:** NO · **Runtime mutation:** NO Live
- **Owner gate:** explicit B10 authorization
- **Required before Shadow:** YES
- **Required before C.1/C.2:** NO

### WP-C.3 — Required Agent remediation (scoped; e.g. sentiment family)

- **Objective:** bounded truthful remediation for the Owner-chosen independent family (preferred: sentiment) and only other remediations required for the approved initial set
- **Depends on:** Owner decision on diversity recommendation A
- **Risk:** Tier 2–3
- **Migration:** NO unless Agent already requires it (stop if so)
- **Provider:** public-only if already authorized by Agent outcome (Reddit public path needs no secret)
- **Owner gate:** per-Agent scope; prefer separate Agent WP if rebuild needed

### WP-C.4 — Risk / Portfolio control integration (Optimization out)

- **Objective:** wire Risk veto + Portfolio bounded sizing into ArtemisDecision lifecycle
- **Optimization:** remains outside unless separately promoted
- **Likely files:** `risk-gate.js` UUID debt fix via `agent_key`, portfolio SoT, readiness.controlChain → real pipeline
- **Depends on:** WP-C.1–C.2 and preferably B10 if durable control outcomes must be audited
- **Risk:** Tier 3
- **Migration:** NO expected · **Provider:** NO · **Runtime mutation:** NO until authorized
- **Human QA:** veto/sizing + Risk-unavailable fail-closed scenarios
- **Owner gate:** Risk hard authority + Portfolio SoT; Demo fail-open must not become Artemis approval

### WP-C.5 — Liquidity / runtime-safety / Order intent boundary

- **Objective:** Liquidity unavailable vs feasible; keep runtime SSOT; ExecutionIntent boundary without enabling Live
- **Depends on:** WP-C.4; Liquidity real product may be external prerequisite
- **Risk:** Tier 3 (Tier 4 if any real order path touched — stop)
- **Migration:** NO · **Provider:** NO private · **Runtime mutation:** NO
- **Human QA:** fail-closed eligibility
- **Owner gate:** no Live; ExecutionIntent non-activating

### WP-C.6 — Product UI / readiness / audit integration

- **Objective:** Simple/Advanced diagnostics; truthful states; TE→Artemis authenticated transport fix (still fail-closed); history/audit against B10 when present
- **Likely files:** AIManager Artemis sections, readiness service, `tradingEngine.js` auth transport
- **Depends on:** WP-C.1–C.2 (+ control packages / B10 for durable audit views)
- **Risk:** Tier 2
- **Migration:** NO · **Provider:** NO · **Runtime mutation:** deploy only when authorized
- **Human QA:** Simple + Advanced Browser QA
- **Owner gate:** no Simple redesign beyond truthful wiring without approval

### WP-C.7 — Shadow preparation

- **Objective:** Shadow architecture wiring against B10 persistence; still `executionEligible=false`
- **Depends on:** **B10 implemented** + control/runtime packages as required for observable chain
- **Risk:** Tier 3
- **Migration:** via B10 only · **Provider:** NO · **Runtime mutation:** NO Live
- **Human QA:** Shadow recording without orders
- **Owner gate:** Shadow **preparation** only — **Shadow activation is a separate Owner gate**

---

## 19. Decision Register (OWNER APPROVED ARCHITECTURE)

| ID | Topic | Recommendation | Status |
|---|---|---|---|
| D1 | Synthesis strategy | Deterministic role-aware synthesis + optional LLM advisor; retire naive majority MoE as authority | OWNER APPROVED (architecture) |
| D2 | Correlation policy | Qualitative containment: preserve lineage; identify families; no independent-confirmation claim; no flatten-to-one-vote; no invented coefficients | OWNER APPROVED |
| D2b | Quantitative correlation scoring | Numeric influence / de-correlation | UNKNOWN / REQUIRES MEASUREMENT |
| D3 | Initial Agent set | Buckets: directional/regime = trend+volume (one OHLCV family); opportunity = arbitrage; control = risk/portfolio/runtime/(liquidity later)/order; sentiment = future remediation only | OWNER APPROVED |
| D3b | Diversity recommendation | Prefer remediated `sentiment` before multi-family claims; until then architecture-only / single-family; **do NOT remediate sentiment in C.1** | OWNER APPROVED |
| D4 | Risk authority | Hard veto/limit; not a vote; resolve UUID via `agent_key=risk` | OWNER APPROVED |
| D4b | Risk unavailable semantics | Advisory may continue as non-actionable with UNAVAILABLE; decisionEligible/executionEligible fail closed; Demo fail-open ≠ Artemis Risk approval | OWNER APPROVED |
| D5 | Portfolio / Optimization | Portfolio = bounded sizing; Optimization remains deferred / NOT_APPLICABLE to initial chain | OWNER APPROVED |
| D6 | Liquidity boundary | Feasibility only after real implementation; else unavailable fail-closed | OWNER APPROVED |
| D7 | Order boundary | ExecutionIntent consumer only; never invents direction | OWNER APPROVED |
| D8 | WP-C / B10 sequence | C.1 → C.2 → B10 → control/runtime integration → Shadow prep → separate Shadow activation gate | OWNER APPROVED |
| D9 | Shadow persistence prerequisite | Append-only ArtemisDecision + evidence refs (B10); not `system_logs`; no durable audited lineage claim before B10 | OWNER APPROVED |
| D10 | ArtemisDecision contract | Fields in §10.1; always non-execution until later gates | OWNER APPROVED (shape for C.1) |
| D11 | ExecutionIntent boundary | Separate later contract; blocks legacy `approved:true` | OWNER APPROVED |
| D12 | LLM role | Advisor behind deterministic pre/post validation; Integrations remain secret owner | OWNER APPROVED (architecture) |
| D13 | Degraded behavior | Advisory degrade truthful; execution eligibility always fail closed | OWNER APPROVED |
| D14 | Expand initial set / Pattern etc. | Pattern B same-family; MI/fundamental/PP remain C/deferred | DEFERRED |
| D15 | Activate Shadow/Paper/Live in WP-C | Forbidden; Shadow activation separate Owner gate after prep | BLOCKED BY POLICY |
| D16 | B10 migration now | Not part of C.1; required before Shadow, not before C.1/C.2 | OWNER APPROVED (timing) |
| D17 | Replace Capability name `ARTEMIS_DECISION_EXECUTE` | Rename/clarify to reduce misread | PROPOSED (later package) |
| D18 | Fix TE unauthenticated Artemis transport | Required in later UI/runtime package; keep fail-closed | PROPOSED (later package) |

**Architecture is OWNER APPROVED. C.1 implementation is separately authorized on a new branch. This Discovery document remains the architecture baseline and must not be rewritten after C.1 branches except for factual C.1 status pointers.**

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
| Sentiment labels `meta.source:'realtime'` while mock sources may be weighted | `agents/sentiment.js` + `sentimentAPI.js` | PROVEN BY CODE |
| Market Intelligence base confidence 50 + VIX fallback | `market_intelligence.js` / `macroAPI.js` | PROVEN BY CODE |
| Fundamental `_meta.source:'real'` with placeholders/random | `agents/fundamental.js` | PROVEN BY CODE |
| RiskGate Demo fail-open on error | `risk-gate.js` | PROVEN BY CODE |
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

**ARTEMIS WP-C DISCOVERY ARCHITECTURE — OWNER APPROVED**  
**IMPLEMENTATION HAD NOT BEGUN AT THIS MILESTONE**  
**C.1 MUST BRANCH FROM THE OWNER-APPROVAL COMMIT SHA**  
**NO RUNTIME ACTIVATION**  
**C.2 / B10 / SHADOW / PAPER / LIVE NOT STARTED**

Hardening + approval summary:

- trend+volume are one OHLCV directional family; arbitrage is opportunity context, not analytical vote
- sentiment is the selected future independent-family remediation candidate; not consumable; not remediated in C.1
- B/C/E classes revalidated from source (B=1, C=7)
- correlation policy = qualitative containment; quantitative scoring REQUIRES MEASUREMENT
- sequence locked: C.1 → C.2 → B10 → control/runtime → Shadow prep → separate Shadow gate
- Optimization out of initial control chain
- Risk unavailable ≠ approval; Demo fail-open must not be imported as Artemis Risk approval

Current system remains a truthful advisory shell over legacy MoE, with WP-B.1 on-read evidence for trend/arbitrage/volume and a fail-closed execution gate.

---

## 23. WP-C.1 CLOSEOUT AND FREEZE

**Verdict:** **ARTEMIS WP-C.1 — CLOSED AND FROZEN**  
**Owner closeout review:** PASS  
**Server content alignment closeout review:** PASS  

### 23.1 Lifecycle milestones

| Milestone | SHA / ref | Notes |
|---|---|---|
| Discovery Owner approval | `658290a07641f317b60ee8d4afec87464edfcdbc` | Architecture locked; implementation had not begun |
| Hardened Discovery (pre-approval) | `b3274a59060db8c30f9f3dc35ef3e1de009ed8b7` | Architecture baseline |
| C.1 implementation code milestone | `a68168c8fa1cc3eb343998ba400f606c19cb013b` | Decision contract + admission + tests |
| C.1 correction | `d32e583d8358119a317f248158b656cf7b6914c2` | Admission/contract compatibility hardening |
| Prior integrity review HEAD | `51dc36f9937e40126dfc8bcf6c2c543a5cff96b0` | Pre final integrity |
| C.1 final integrity | `3ca6558c06a3412aa1ce8feb09e039bd7d172acb` | Evidence-ref integrity; PR branch final HEAD |
| PR #23 squash merge → main | `47655c008c01266299d6e92eb9c5b24ab5c7c5a3` | Canonical product baseline |

### 23.2 Delivered scope (pure library)

- Canonical ArtemisDecision contract (`artemis-decision-1.0.0`)
- Deterministic WP-B.1 evidence admission
- Strict role/identity semantics
- Decision-safe evidence refs
- Unavailable / stale / degraded truth handling
- Correlation metadata preservation only (no scoring)
- Frozen Volume adapter BUY/SELL/HOLD compatibility
- Arbitrage opportunity-only semantics

**Explicitly not delivered / not activated:** synthesis · C.2 · B10 · persistence · Risk/Portfolio/Liquidity/Order runtime integration · Sentiment remediation · runtime route wiring · Shadow / Paper / Live · provider calls · Agent execution

### 23.3 Verification evidence

| Suite | Result |
|---|---|
| Focused WP-C.1 | 62 PASS |
| Artemis unit | 12 suites / 126 PASS |
| Full backend unit | 101 suites / 790 PASS |
| PR #23 Backend Tests | SUCCESS |
| PR #23 E2E Tests | SUCCESS |
| GitGuardian | SUCCESS — 12 commits scanned; no secrets detected |
| Unresolved review threads | 0 |

Owner reviews: architecture PASS · code PASS · PR/CI PASS · server alignment closeout PASS.

**Human QA:** NOT APPLICABLE BY SCOPE (no UI / no runtime route / no orchestration / no execution behavior change). Equivalent milestone verification via tests, CI, security scan, exact server content verification, module import smoke, root HTTP 200, backend health 200/ok.

### 23.4 Server content alignment

| Item | Truth |
|---|---|
| Runtime tree | `/home/ubuntu/webapp/TitanGold` |
| Runtime-tree git SHA before alignment | `a100f7ba21131c351b561fb66554e90990da8725` |
| Dirty tree | YES (~481 entries) |
| Mutation method | Create exactly two previously MISSING files only |
| `artemisDecisionContract.js` SHA256 | `fcc16f70f495b4cdec72d498d8dbed4259902352d62c6475d7cae61f92db98b0` |
| `artemisEvidenceAdmissionService.js` SHA256 | `72dc9d33d43038033ebcb764a1c70ee2643706246e86df35015587ced136a1e7` |
| Exact main content match | YES (both) |
| Other runtime-tree files modified | 0 |
| Frozen dependencies modified | NO |
| Restart / PM2 mutation | NO |
| `TITAN_RUNTIME_COMMIT` | unchanged `48d7722b651e1d551bbbf128eaa30e1b1c136163` |

Post-alignment health snapshot (no topology repair):

- `https://titan.zala.ir/` → 200
- `GET /api/v1/health` → 200 / ok
- PM2 backend ids 1–4 online
- `titan-engine-worker` ids 5, 9 online
- Telegram processor id11 online · id15 stopped
- collector id16 online · id12 stopped

### 23.5 Provenance semantics (must stay distinct)

| Layer | State |
|---|---|
| GitHub Source | `main` @ `47655c008c01266299d6e92eb9c5b24ab5c7c5a3` |
| Server Content | WP-C.1 two-file content aligned to that main |
| Runtime Active | legacy runtime unchanged |
| WP-C.1 Runtime Wired | **NO** |
| WP-C.1 Runtime Active | **NO** |
| Product orchestration | **LEGACY** |
| `artemisConsumable` | `false` |
| `decisionEligible` | `false` |
| `executionEligible` | `false` |
| Evidence readiness | `ON_READ_PARTIAL` — NOT `EVIDENCE_READY` |

Do **not** claim `runtimeCommit = 47655c`.

### 23.6 Frozen declaration and future sequence

**WP-C.1 is CLOSED AND FROZEN.** No further Artemis implementation is authorized by this closeout.

Approved future sequence remains:

1. **WP-C.1** — DONE / FROZEN  
2. **WP-C.2** — deterministic synthesis / conflict / qualitative correlation — **requires new Owner authorization**  
3. **B10** — append-only decision/evidence persistence  
4. Control / runtime integration  
5. Shadow preparation  
6. Separate Owner gate for Shadow activation  

Still closed / not started at WP-C.1 freeze: C.2 · B10 · WP-D · Shadow · Paper · Live.  
Sentiment remains future remediation candidate / NOT Artemis-consumable.  
Optimization remains NOT_APPLICABLE to the initial Artemis control chain.

---

## 24. WP-C.2 DETERMINISTIC SYNTHESIS IMPLEMENTATION

**Status:** **CLOSED AND FROZEN** (see §25 FINAL CLOSEOUT / FREEZE)  
**Implementation branch:** `feat/artemis-wp-c2-deterministic-synthesis`  
**Implementation final HEAD:** `e9b03a63499b79e3f8f335a095c95e712a16eaf6`  
**Product merge:** PR #25 → `cf04f1137cd148385624dc12f10e9628ec530a13`  

Integrity + final adversarial hardening (same branch):
- Distinct `correlationFamily` identity enforcement (duplicate family summaries rejected)
- Conflict precedence: blocking cross-family before material same-family
- No synthetic correlation-family defaults for non-confirming evidence
- Strict nested synthesis contract + outcome cross-field invariants
- Projection refuses invalid synthesis assessments
- **Any** duplicate `agentId+canonical runId` → fail-closed all copies (`DUPLICATE_IDENTITY_AMBIGUOUS`); no first/last/freshest winner
- Directional family members must be `AUTHORITY_CLASS.ANALYTICAL_EVIDENCE` only
- Coherent families require real directional members; MIXED requires ≥2; non-confirming/unavailable require 0
- C.2 outcome allowlist only (no `BLOCKED_BY_RISK` / runtime / unspecified / unavailable control claims)
- Projection evidence lineage: contributing Agent IDs must appear in Decision-safe `evidenceRefs`
- `MAX_SYNTHESIS_INPUT_ENVELOPES = 32` (no silent truncation)
- Opportunity availability only when canonically proven
- `admittedDirectionalMemberCount` = distinct confirming Agent IDs (bounded by `memberAgentIds`)
- Non-confirming `OPPORTUNITY_FORECAST` → `opportunityContext` only (never directional familyMembers)
- `resolveCrossFamilySynthesis` fail-closed via `validateSynthesisFamilyAssessmentSet` (`invalid_family_assessment_set`)
- Invalid synthesis assessment is not exposed as a usable result (`assessment: null`)

### 24.1 Delivered library footprint

| File | Role |
|---|---|
| `backend/contracts/artemisSynthesisContract.js` | `artemis-synthesis-1.0.0` assessment validator |
| `backend/services/artemisDeterministicSynthesisService.js` | admit → family assess → qualitative resolve → Decision projection helper |
| `backend/__tests__/unit/artemisSynthesis.wpC2.test.js` | focused C.2 matrix |

Frozen C.1 files remain unmodified and are imported/reused (`admitEvidenceSet`, `validateArtemisDecision`, WP-B.1 envelope contract).

### 24.2 Owner-approved policy locks

| Rule | Value |
|---|---|
| Policy version | `wp-c2-synthesis-1.0.0` |
| `MIN_INDEPENDENT_DIRECTIONAL_FAMILIES` | **2** |
| Trend + Volume | one `ohlcv_candle_family` (not two independent confirmations) |
| Arbitrage | opportunity context only; **no** directional influence |
| Sentiment | future remediation; **not** remediated / not consumable in C.2 |
| Correlation | qualitative only — no coefficients, weights, majority, averages |
| Synthesis confidence | UNAVAILABLE / `qualitative_synthesis_not_calibrated` |
| Eligibility | `artemisConsumable=false`, `decisionEligible=false`, `executionEligible=false` |
| Controls | Risk / Portfolio / Optimization / Liquidity / Runtime / Order **not** integrated |
| Input bound | `MAX_SYNTHESIS_INPUT_ENVELOPES = 32` (refuse excess; no truncation) |
| C.2 outcomes | PROPOSED / HOLD / ABSTAIN / INSUFFICIENT_EVIDENCE / INCOMPATIBLE_EVIDENCE only |
| B10 | **NOT STARTED** |
| Runtime / server | library content aligned; **NOT ACTIVATED** |

### 24.3 Current realistic set truth

With Trend + Volume + Arbitrage:

- independent directional families = **1**
- `multiFamilyConfirmation = false`
- overall = **INSUFFICIENT_EVIDENCE / ABSTAIN** (expected, not a defect)

Cross-family PROPOSED paths are covered by **algorithm-only family-summary fixtures** and do **not** imply additional Agents are currently Artemis-consumable.

### 24.4 Provenance semantics

| Layer | State |
|---|---|
| GitHub Source | product main @ `cf04f113…` (PR #25) |
| Server Content | two C.2 library files exact-main aligned |
| Runtime Active | legacy · C.2 not wired / not active |
| Product orchestration | **LEGACY** |

---

## 25. WP-C.2 FINAL CLOSEOUT / FREEZE

**Status:** **CLOSED AND FROZEN** (docs-only closeout branch pending Owner merge)  
**Closeout branch:** `docs/artemis-wp-c2-freeze`  
**Closeout worktree:** `/home/ubuntu/worktrees/titangold-artemis-wp-c2-freeze`

### 25.1 Product merge identity

| Item | Value |
|---|---|
| Implementation PR | **#25** |
| Title | `feat(artemis): add WP-C.2 deterministic synthesis and conflict policy` |
| Squash / product main SHA | `cf04f1137cd148385624dc12f10e9628ec530a13` |
| Implementation branch final HEAD | `e9b03a63499b79e3f8f335a095c95e712a16eaf6` |

Branch HEAD ≠ squash-main SHA (expected after squash merge).

### 25.2 Delivered library + policy

Files:

- `backend/contracts/artemisSynthesisContract.js`
- `backend/services/artemisDeterministicSynthesisService.js`
- `backend/__tests__/unit/artemisSynthesis.wpC2.test.js`

Contract/policy:

- `artemis-synthesis-1.0.0`
- `wp-c2-synthesis-1.0.0`
- `MIN_INDEPENDENT_DIRECTIONAL_FAMILIES = 2`
- `MAX_SYNTHESIS_INPUT_ENVELOPES = 32`

Frozen semantics:

- Trend + Volume = **one** OHLCV family
- Arbitrage = opportunity-only (zero directional vote)
- PROPOSED requires ≥2 independent directional families
- Correlation qualitative only (no coefficients / weights / majority / confidence averaging)
- Synthesis confidence UNAVAILABLE / UNCALIBRATED
- Duplicate `agentId+runId` fail-closed
- Invalid family kernel fail-closed
- Controls are not C.2 directional votes

Current realistic synthesis:

- family count = **1**
- outcome = `INSUFFICIENT_EVIDENCE` / `ABSTAIN`

### 25.3 Test + CI evidence

Pre-PR / local (not GitHub CI):

- Focused WP-C.2: **61 PASS / 0 fail / 0 skip**
- Artemis unit: **13 suites / 187 PASS**
- Full backend unit: **102 suites / 851 PASS**

PR #25 actual GitHub CI:

- Backend Tests = **SUCCESS**
- E2E Tests = **SUCCESS**
- GitGuardian Security Checks = **SUCCESS** (7 commits scanned; no secrets)
- Frontend CI = **NOT TRIGGERED** (NOT TRIGGERED ≠ PASS)
- Unresolved review threads = **0**
- Bugbot = NOT ENABLED (not a finding)

### 25.4 Server content alignment

Owner-authorized create-only of EXACTLY two previously-missing files in `/home/ubuntu/webapp/TitanGold` from main `cf04f113…`:

| File | SHA256 | Bytes | Match |
|---|---|---|---|
| `backend/contracts/artemisSynthesisContract.js` | `22ced7e7a6bbfa7f730ab2945eb09e9953c139f9d6fe3cd6647d9b9bb237a1f9` | 25853 | EXACT / `cmp IDENTICAL` / `O_EXCL` |
| `backend/services/artemisDeterministicSynthesisService.js` | `44dab3ac49ccbdea667137db4a63e20978428b62e9f6d324c1b7a76d709b79b9` | 30312 | EXACT / `cmp IDENTICAL` / `O_EXCL` |

Other runtime files mutated by alignment: **0**

Runtime-tree provenance:

- Branch `main` · observed HEAD `a100f7ba21131c351b561fb66554e90990da8725`
- Dirty YES · before 482 · after 483
- Task-attributable path delta **+2** (`??` both targets)
- Absolute porcelain net delta **+1** (unrelated concurrent dirty fluctuation)
- Do not stage / clean

### 25.5 Runtime active state

| Item | Value |
|---|---|
| `TITAN_RUNTIME_COMMIT` | `48d7722b651e1d551bbbf128eaa30e1b1c136163` (unchanged; ≠ product main) |
| C.2 Runtime Wired | **NO** |
| C.2 Runtime Active | **NO** |
| C.1 Runtime Wired | **NO** |
| Restart / PM2 / deploy | **NO** |
| DB / migration / providers / Agents | **0** |

Post-alignment health/topology (read-only):

- root HTTP 200 · `/api/v1/health` HTTP 200 / `status=ok`
- backend ids 1–4 online · workers 5,9 online
- processor id11 online / id15 stopped · collector id16 online / id12 stopped

Module smoke PASS: contract/policy versions, min families=2, max inputs=32, no-evidence → `insufficient_evidence`, eligibility flags false.

### 25.6 Human QA

**NOT APPLICABLE BY SCOPE** — no UI / frontend / runtime route / active orchestration / execution / provider / DB change.

Applicable gates: source review, focused/backend tests, GitHub Backend+E2E CI, secret scan, exact-content server verification, pure module smoke, health.

### 25.7 Three-state ledger

| State | Value |
|---|---|
| GitHub Source | `main` @ `cf04f1137cd148385624dc12f10e9628ec530a13` |
| Server Content | WP-C.2 two library files exact-content aligned to product main |
| Runtime Active | legacy unchanged · C.2 not wired/active · `TITAN_RUNTIME_COMMIT=48d7722…` |

### 25.8 Maturity / next work

- `artemisConsumable=false` · `decisionEligible=false` · `executionEligible=false`
- Product orchestration = **LEGACY**
- Evidence readiness = `ON_READ_PARTIAL` — NOT `EVIDENCE_READY`
- **NOT STARTED:** B10 · WP-D · Risk/Portfolio/Liquidity/Order/runtime-safety integration · Sentiment remediation · Shadow · Paper · Live

Next Artemis implementation requires separate Owner authorization after this freeze merges.
