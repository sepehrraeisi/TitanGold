# ARTEMIS WP-A — Legacy Safety Containment + Specialized UI/UX Redesign

**Status:** IMPLEMENTATION IN PROGRESS → Staging → Owner Human QA  
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
| AI Center tabs | Reach Agents/Training/Analytics/Config/Topic Routing | KEEP order | Labels assessed; no gratuitous regroup in WP-A |
| Artemis shell | Maturity + safety at a glance | REDESIGN | Requested/Effective mode separate; no Demo↔Real toggle |
| Overview | “What can Artemis do now?” | REDESIGN | Readiness, Runtime Safety, Intelligence Inputs, Control Chain, Limitations |
| Evidence | Contract readiness | ADD FEATURE (truthful unavailable) | No fake EvidenceEnvelope |
| Decisions | Advisory vs execution | REDESIGN | Legacy Advisory + executionEligible=No |
| Orchestration | Real coordination? | REDESIGN | Legacy Orchestration / canonical UNAVAILABLE |
| Controls | Control-chain visibility | ADD/REDESIGN | Risk veto explicit; not a trading panel |
| Lineage & Audit | Audit truth | REDESIGN | Separate current sources vs canonical readiness |
| System & Integrations | Dependency ownership | REDESIGN + LINK | Link Decision Engine / Connections; dual-config limitation |
| Autopilot | Not product-ready | HIDE / Legacy Admin gate | ConfirmModal; no native dialogs |
| Insights widget | Reachable dashboard | REDESIGN | Readiness-backed; no confidence 87 |
| Decision Engine / Learning / Backtesting / Data Hub / Logs / Settings / Monitoring / Scenarios | Ownership | LINK / MOVE / RETIRE from Artemis nav | Backend retained; not in canonical Artemis nav |
| POST `/artemis/decision` | Safety | CONTAIN | Additive advisory fields; TE fail-closed |

## 3. Final AI Center menu architecture

1. Artemis (`manager`)
2. Agents
3. Training
4. Analytics
5. API / Integrations (`config`)
6. Topic Routing

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
