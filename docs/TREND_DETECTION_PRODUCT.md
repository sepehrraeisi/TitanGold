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

## Evidence Ledger (Human-QA round 2 — 2026-08-04)

### Committed / deployed provenance

| Field | Value |
|-------|-------|
| Base SHA | `9c9f860` |
| Implementation commit | **`ad53ce2`** (code + deploy) |
| Documentation HEAD | **`29c2010`** |
| Backend runtime marker | **`ad53ce2`** |
| Served bundle | **`assets/index-urwZv0ot.js`** |
| Worktree | clean |

### Scheduler vs backend (distinct processes)

| Process | PIDs | Restarts | Role |
|---------|------|----------|------|
| `titan-engine-worker` | `1377375`, `1377399` | 0 | Scheduler owner — **not restarted** |
| `titan-backend` | 4 cluster instances | restarted for deploy | API only |

### Owner defect fixes (`ad53ce2`)

1. Header monitoring → **Not scheduled** (not "Monitoring active")
2. Canonical ADX thresholds — regime/strength/evidence aligned (ADX 23 → transition)
3. Freshness from last candle + localized reason/timestamp
4. Localized evidence (no raw keys in UI)
5. Compare-timeframe settings + truthful MTF unavailable state
6. Localized integration labels/status/reasons
7. Removed duplicate Close in action bar
8. History run detail layer with comparison gate
9. Committed + deployed from same SHA
10. Scheduler PIDs documented separately from backend cluster

### Verification @ `ad53ce2`

- Backend tests: `trendDomain.test.js` **8/8**
- Frontend Trend suite: **12/12**
- E2E: **3× consecutive 12/12** (retries=0)
- Side effects: analyze POST=1 on confirm only; private MEXC=0; worker restarts=0; native dialogs=0

### Human-QA status

**READY FOR OWNER HUMAN QA**
