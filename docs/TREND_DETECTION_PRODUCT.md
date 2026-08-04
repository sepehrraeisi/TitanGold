# Trend Detection — Specialized Product Engineering Document

Living document for **TREND-DETECTION-SPECIALIZED-PRODUCTIZATION** (Program Slice, Tier 2).

## User needs

Trend Detection answers:

- Current market direction and strength (ADX, MA, momentum context)
- Trending vs ranging regime
- Supporting vs conflicting indicator evidence
- Weakening and reversal signals when measured
- Multi-timeframe agreement when compare timeframes are configured
- Freshness and provenance of public OHLCV data
- Comparison with the prior persisted analysis

It does **not** imply guaranteed prediction, financial advice, or execution.

## Existing implementation classification

| Area | Classification | Notes |
|------|----------------|-------|
| `backend/services/trendAnalyzer.js` | REUSE DIRECTLY | ADX/SMA/EMA, MEXC public OHLCV |
| `backend/services/agents/trend.js` | REUSE DIRECTLY | Agent registry entry |
| `components/ai/TrendAgentControl.tsx` | LEGACY — RETIRED from registry | Client-side IndexedDB path; not product owner |
| `backend/services/trendDomain.js` | TARGETED CORRECTION | Canonical DTOs |
| `backend/services/trendRunService.js` | NEW orchestration | Manual run + history via `ai_decisions` |
| `components/ai/TrendWorkspace.tsx` | NEW product UI | Agent Product Template V1 shell |

## Product architecture (8 sections)

1. **Overview** — direction, regime, ADX, freshness, summary
2. **Regime & Strength** — regime pill, strength classification
3. **Evidence & Indicators** — supporting/conflicting lists
4. **Weakening & Reversal** — measured signals only
5. **Multi-Timeframe** — optional compare timeframes from settings
6. **Analysis History** — persisted `ai_decisions` runs
7. **Settings** — symbol/timeframe/analyzer params (no auto-execute)
8. **Integrations** — public data, persistence, redis, scheduler (read-only)

## API contracts

Base: `/api/v1/ai-agents/:id/trend`

| Method | Path | Capability |
|--------|------|------------|
| GET | `/overview` | AI_AGENT_READ |
| POST | `/analyze` | AI_AGENT_EXECUTE_SAFE |
| GET | `/runs` | AI_AGENT_READ |
| GET | `/runs/:runId` | AI_AGENT_READ |
| GET/PATCH | `/settings` | READ / EXECUTE_SAFE |
| GET | `/integrations` | AI_AGENT_READ |

Persistence: `ai_decisions` with `decision_type = trend_analysis`. No migration required.

## Database

Reuse `ai_agents.config` for settings and `ai_decisions` for runs/history.

## Security

- Public MEXC OHLCV only for analysis
- Idempotency via `idempotencyKey` in `input_data`
- Auto Execute blocked (`execution_blocked`)
- Scheduler allowlist unchanged (`arbitrage` only)

## Deferred

- Scheduled Trend runs (requires separate outcome + allowlist approval)
- Predictive accuracy scoring without persisted evaluation method

## Human QA

See final handoff checklist in closeout report.

---

## Evidence Ledger (Human-QA Readiness Remediation — 2026-08-04)

### Provenance

| Field | Value |
|-------|-------|
| Base SHA (`origin/main`) | `9c9f860` |
| Branch | `feat/trend-detection-agent-full-product` |
| Branch HEAD (git) | `0a28597` |
| Remediation delta | **Uncommitted** in worktree (guardExecution, integrations DTO, public OHLCV path, E2E suite, tests) |
| Backend runtime marker (`TITAN_RUNTIME_COMMIT`) | `af1b690` |
| Backend runtime files deployed | `trendDomain.js`, `agents/trend.js` (patched on Staging runtime path) |
| Frontend runtime implementation | Built from worktree @ `0a28597` + remediation delta |
| Documentation HEAD | Same worktree (this file updated in remediation) |
| Served bundle (Staging) | `assets/index-BFJyoumV.js` |
| Dist path | `/home/ubuntu/webapp/TitanGold/dist` |
| Deployment target | Staging — `https://titan.zala.ir` |
| Nginx target | Existing TitanGold Staging vhost → `/home/ubuntu/webapp/TitanGold/dist` |
| Frontend load verification | `curl https://titan.zala.ir/` → `index-BFJyoumV.js` |

### Commit classification (after `af1b690`)

| SHA | Scope |
|-----|-------|
| `f4b98df` | E2E/test behavior |
| `42d6445` | Frontend runtime routing (`trend` / `trend_detection` → workspace) |
| `0a28597` | E2E/test behavior |
| Worktree delta | Integrations DTO fix, guardExecution, public OHLCV in `agents/trend.js`, E2E replacement |

### E2E (retries=0, trace on)

| Run set | Result |
|---------|--------|
| Pre-remediation | FAIL — stale bundle + integration tab React #31 + hidden testId |
| Post-routing deploy (3×) | 4/4 pass (flaky browser crash run 1 without `NODE_OPTIONS`) |
| Post public-OHLCV fix (3× consecutive) | **12/12 pass** (4 tests × 3 runs) |

Scenarios: A read-only all sections + cancel, B one analyze POST, C settings PATCH, A FA mobile RTL.

### RCA — E2E failures (branch-owned)

1. Stale frontend before `42d6445` — invalid Browser QA
2. `agent_key=trend` not routed to workspace — fixed in `AIAgents.tsx`
3. `data-testid="trend-workspace"` outside portal dialog — fixed
4. Integrations DTO passed object to `StatusPill` — fixed in `trendDomain.js`
5. `agents/trend.js` called fail-closed `initializeExchange` — fixed to public `fetchOHLCV(null, …)`

### Shared-shell audit

| File | Trend need | Shell impact | Type | Consumers |
|------|------------|--------------|------|-----------|
| `AIAgents.tsx` | Route `trend`/`trend_detection` to `TrendAgentPopup` | Workspace routing only | Additive routing | Arbitrage unchanged; legacy agents use registry |
| `agentRegistry.ts` | `TrendAgentPopup` lazy entry | Registry entry only | Additive | Trend card open |
| `navigation.ts` | Trend section types | Type extension | Additive | URL sync consumers |
| `urlSync.ts` | Trend section in URL | Parse/serialize | Additive | Deep-link |

Canonical ID: DB `agent_key=trend`; legacy alias `trend_detection` accepted in loader only; **one** product owner: `TrendAgentPopup` → `TrendWorkspace`.

### Legacy reachability

| Check | Result |
|-------|--------|
| `TrendAgentControl` in `agentRegistry` | NO |
| `TrendAgentControl` in production dist chunks | NO |
| Product owner | `TrendAgentPopup` / `TrendWorkspace` only |
| Native dialogs (alert/confirm/prompt) reachable | **0** (source audit + E2E ledger) |

### Side-effect ledger (E2E observed)

**Scenario A — read-only load:** analyze POSTs=0, settings PATCH=0, monitoring mutations=0, private provider POSTs=0, native dialogs=0, console errors=0, page errors=0.

**Scenario B — one confirmed analysis:** analyze POST=1, persisted run=1, private provider=0, scheduler mutations=0, worker restarts=0, dialogs=0.

**Scenario C — settings save:** settings PATCH=1, analyze POST=0.

Manual API verify (post-fix): POST analyze → `status=completed`, `direction=bullish`, MEXC public provenance, ~11s execution.

### Performance (BASELINE NOT AVAILABLE for prior Trend product)

| Sample | Value |
|--------|-------|
| Analyze API (HTTP, successful run) | ~14s |
| Analyzer execution (observed) | ~11.2s |
| History API (HTTP) | ~1.05s |
| Main bundle | 2,514,504 bytes (`index-BFJyoumV.js`) |
| Duplicate analyze (cancel flow) | 0 POST before confirm |

### Automated tests (invalidated scope)

| Suite | Result |
|-------|--------|
| `trendDomain.test.js` | 7/7 pass |
| `TrendWorkspace.test.tsx` | 3/3 pass |
| `nativeDialogAudit.test.ts` | 3/3 pass |
| `agentKeyRouting.test.ts` | 3/3 pass |
| `AIAgents.test.tsx` (trend open) | pass (updated for workspace) |

Known base CI debt: broad backend `jest --testPathPattern=trend` matches unrelated suites — not repaired.

### Scheduler / runtime safety

| Check | Result |
|-------|--------|
| `titan-engine-worker` PID | `498812`, `498842` (unchanged, ↺=0) |
| Scheduler allowlist | `arbitrage` only (unchanged) |
| Demo / Emergency Stop | Active (integrations DTO: demo + killSwitch) |
| Live execution | Unavailable |

### Human-QA status

**READY FOR OWNER HUMAN QA** — automated remediation gates satisfied; owner sign-off on full design-system matrix (keyboard, Escape, Back/Forward, overflow per section) remains the Human-QA milestone.
