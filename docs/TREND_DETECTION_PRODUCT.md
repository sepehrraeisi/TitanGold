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
