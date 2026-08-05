# Trend Detection — Specialized Product Engineering Document

Living document for **TREND-DETECTION-SPECIALIZED-PRODUCTIZATION** (Program Slice, Tier 2).

**Status:** `HUMAN-QA PASSED / READY FOR PR` (not merged, not frozen)

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
- Dual-worker scheduler leader election remediation (separate shared-runtime outcome)

## Known analytical limitations

- Analysis uses public OHLCV only; no private account or order context
- Compare timeframes capped at three; primary excluded from compare set
- MTF agreement is heuristic alignment, not execution signal
- Prior-run comparison requires same symbol and compatible persisted snapshots
- Freshness reflects last candle timestamp, not live tick data
- Accuracy metrics not shown without persisted evaluation method

---

## Final Closeout Evidence (2026-08-05)

### Owner Human QA

**PASS** — verified by Owner:

- Multi-Timeframe primary + 2 comparisons renders correctly
- English success interpolation is correct
- Persian success interpolation is correct
- Hard refresh restores persisted MTF result without second analysis
- Prior-run comparison works

### Runtime provenance (verbatim, Staging `https://titan.zala.ir`)

| Field | Value |
|-------|-------|
| Branch | `feat/trend-detection-agent-full-product` |
| Runtime implementation commit | **`186c088`** |
| Documentation / test HEAD (pre-closeout commit) | **`8bd39b1`** |
| Backend `/api/v1/health` `commit` | **`186c088`** |
| Backend `/api/v1/health` `runtimeCommit` | **`186c088`** |
| Backend `provenanceVerified` | **`true`** |
| `backend/runtime-provenance.json` `implementationCommit` | **`186c088`** (repo aligned at closeout) |
| Served frontend bundle | **`assets/index-CLwf6ADb.js`** |
| Environment | Staging |
| Source worktree | `/home/ubuntu/worktrees/titangold-trend-agent` |

**Note:** Live health marker and served bundle matched `186c088` / `index-CLwf6ADb.js` before closeout. Repository `runtime-provenance.json` was stale at `756edab` and corrected to `186c088` in closeout commit (documentation alignment; no runtime redeploy required).

### Automated test totals

| Suite | Executed | Passed |
|-------|----------|--------|
| Backend `trendDomain.test.js` | 15 | 15 |
| Frontend `trendFeedback.test.ts` | 12 | 12 |
| Frontend `trendSignalSemantics.test.ts` | 2 | 2 |
| **Unit subtotal** | **29** | **29** |
| E2E `Scenario A — EN desktop` (Staging) | 1 | 1 |
| E2E `Scenario PRE-PR` read-only closeout smoke (Staging) | 1 | 1 |
| **Closeout E2E subtotal** | **2** | **2** |

Additional E2E scenarios (MTF-1/2/CLOSEOUT, analyze/settings) exist in `e2e/trend-staging.spec.ts` and were exercised during remediation; not re-run at pre-PR closeout to avoid unnecessary analysis POSTs.

### Browser QA (exact deployed runtime)

Pre-PR smoke @ `186c088`:

- Login via real form — PASS
- Trend workspace — PASS
- All specialized tabs (Overview, Regime, Evidence, Weakening/Reversal, MTF, History, Settings, Integrations) — PASS
- Persisted MTF matrix visible after navigation — PASS
- Hard refresh restores MTF without analyze POST — PASS
- History prior-run detail opens — PASS
- FA mobile RTL overview + MTF — PASS
- Console errors — **0**
- Page errors — **0**
- Raw i18n keys observed — **0**

### Side-effect ledger (PRE-PR smoke)

| Check | Result |
|-------|--------|
| `/trend/analyze` POST | 0 |
| Private MEXC requests | 0 |
| Financial actions | 0 |
| Scheduler mutations | 0 |
| `titan-engine-worker` restarts | 0 |
| Native dialogs | 0 |

### Scheduler state

- Trend **not scheduled** (Integrations shows not-scheduled; allowlist remains `arbitrage` only)
- `titan-engine-worker` instances observed: **2** (fork mode, ↺=0 each)
- Dual-worker leader election: **NOT VERIFIED** — deferred to separate shared-runtime remediation; Trend closeout does not modify worker count or allowlist

### Rollback

1. Revert merge of `feat/trend-detection-agent-full-product` (when merged) or stop serving branch build
2. Redeploy prior Staging artifact from `origin/main` (`6972dd5` baseline) via standard blue deploy
3. PM2 restart `titan-backend` only; do **not** restart `titan-engine-worker` unless separately authorized
4. Verify `/api/v1/health` commit and served bundle revert
5. Trend agent card returns to pre-product routing if frontend rolled back

### Human-QA status

**HUMAN-QA PASSED / READY FOR PR**

Draft PR prepared; merge and freeze pending review.

---

## Evidence Ledger (prior rounds — archived)

### Human-QA round 2 — 2026-08-04

| Field | Value |
|-------|-------|
| Base SHA | `9c9f860` |
| Implementation commit | `ad53ce2` |
| Served bundle | `assets/index-urwZv0ot.js` |

Owner defects addressed in rounds 2–3; MTF pipeline defect fixed in `756edab`; closeout interpolation + provenance in `186c088`.
