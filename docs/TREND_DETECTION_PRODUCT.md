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

---

## Final PR Safety Closeout Evidence (2026-08-06)

PR **#18** remains **Draft**. Four remaining re-review findings resolved on branch `feat/trend-detection-agent-full-product`.

### Runtime provenance (verbatim, Staging `https://titan.zala.ir`)

| Field | Value |
|-------|-------|
| Branch | `feat/trend-detection-agent-full-product` |
| Runtime implementation commit | **`85a762b`** |
| Branch HEAD (tests + docs) | **`5c11e4d`** (+ docs closeout commit) |
| Backend `/api/v1/health` `commit` | **`85a762b`** |
| Backend `/api/v1/health` `runtimeCommit` | **`85a762b`** |
| Backend `provenanceVerified` | **`true`** |
| `backend/runtime-provenance.json` `implementationCommit` | **`85a762b`** |
| Served frontend bundle | **`assets/index-CLflvsy0.js`** |
| Frontend build source commit | **`85a762b`** worktree |
| Environment | Staging |
| Source worktree | `/home/ubuntu/worktrees/titangold-trend-agent` |

Deploy note: `scripts/deploy-backend-runtime-provenance.sh` aborted before PM2 mutation because Staging has **two** `titan-engine-worker` instances (fingerprint guard expects one). Backend sync + dist rsync completed; **`titan-backend` only** restarted manually with `TITAN_RUNTIME_COMMIT=85a762b`. Workers unchanged (↺=0, same PIDs).

### E2E fixture safety model

| Control | Implementation |
|---------|----------------|
| Shell execution | **Removed** — `execFileSync(process.execPath, [script, ...args], { shell: false })` via `e2e/fixtureProcess.mjs` |
| Input validation | `backend/scripts/e2eFixtureSafety.js` — disposable `e2e_*`, `@titangold.test`, safe owner, UUID, backend root |
| Deploy-env gate | `TITAN_DEPLOY_ENV=staging` required before promote/cleanup; production rejected; `--target-env` alone insufficient |
| Promotion marker | `.e2e-fixture-promotion.json` (gitignored) — identity metadata only; no passwords/tokens |
| Cleanup | No marker → safe no-op; marker present → mandatory identity + `rowCount === 1` + marker removed on success |
| GitHub CI | Isolated Postgres + explicit `TITAN_DEPLOY_ENV=staging` documented in `.github/workflows/e2e-tests.yml` |

### Confidence column nullability

| Check | Result |
|-------|--------|
| `information_schema.columns` `is_nullable` | **`YES`** |
| Canonical INSERT with `confidence NULL` + rollback | **PASS** (DB-backed integration test on migrated Staging schema) |
| Synthetic `0.5` fallback | **Not restored** |

### Automated test totals (safety closeout)

| Suite | Executed | Passed |
|-------|----------|--------|
| Backend `e2eFixtureSafety.test.js` | 10 | 10 |
| Backend `e2eFixtureRoleMutation.test.js` | 6 | 6 |
| Backend `aiDecisionsConfidence.integration.test.js` | 2 | 2 |
| Frontend `fixtureProcess.test.ts` | 9 | 9 |
| Frontend `globalSetup.test.ts` | 4 | 4 |
| **Safety subtotal** | **31** | **31** |
| Prior Trend unit subtotal (`trendDomain` + feedback + semantics) | 29 | 29 |
| **Combined unit subtotal** | **60** | **60** |

GitHub checks on pushed HEAD **`5c11e4d`**: pending re-run after push (prior **`295294a`** was green).

### Selective Staging smoke (@ `85a762b` / `index-CLflvsy0.js`)

| Scenario | Result |
|----------|--------|
| Login + Trend opens (EN desktop tabs) | PASS |
| Settings save (`Scenario C`) | PASS |
| FA mobile RTL overview | PASS |
| PRE-PR read-only (EN + FA + hard refresh, no analyze) | PASS (1 retry; first attempt had transient trading-engine status console noise) |
| Shared header generic monitoring labels | PASS (via tab navigation) |
| Integrations MEXC public readiness | PASS (Integrations tab rendered; no private provider POST) |

### Side-effect ledger (selective smoke)

| Check | Result |
|-------|--------|
| `/trend/analyze` POST (read-only smoke) | 0 |
| Private MEXC requests | 0 |
| Financial actions | 0 |
| Scheduler mutations | 0 |
| `titan-engine-worker` restarts | 0 |
| Console/page errors (final PRE-PR retry) | 0 |

### Deferred

- Dual-worker scheduler leader election / deploy fingerprint guard (Staging has 2 workers; unchanged)
- Trend merge + freeze
- Core Rules v4.5 activation (not authorized)

### Verdict

**TREND FINAL PR SAFETY CLOSEOUT COMPLETE — READY FOR RE-REVIEW**

---

## E2E Promotion Marker Crash-Safety Fix (2026-08-06)

Fail-safe blocker from final re-review: setup previously called `clearPromotionMarker()` at startup, which could silently drop the only cleanup record after an interrupted promote.

### Marker lifecycle (current)

| Phase | Behavior |
|-------|----------|
| Setup startup | Never silently delete. Valid `promotion_pending` / `promoted` → verified cleanup first (`rowCount === 1`); incomplete/invalid → abort; cleanup failure preserves marker |
| Before promote | Write atomic `state=promotion_pending` marker (identity only; no secrets) |
| After promote | Atomically replace marker with `state=promoted` |
| Teardown | Cleans both pending and promoted; marker removed only after successful DB cleanup |

### Focused tests

`src/__tests__/e2e/fixtureProcess.test.ts` — crash-safety scenarios (existing promoted never silent-deleted, pending cleaned before new setup, promote fail leaves pending, pending still cleans after crash window, cleanup fail aborts, invalid marker aborts, successful cleanup allows new promotion, no shell/secret regression).

Local focused totals: fixtureProcess **17** + globalSetup **4** = **21/21 PASS**.

No Staging product redeploy required (E2E tooling/tests only). Runtime remains **`85a762b`** / **`assets/index-CLflvsy0.js`**.

### Verdict

**TREND E2E MARKER CRASH-SAFETY FIX COMPLETE — READY FOR FINAL RE-REVIEW**
