# AI-FOUNDATION-R2 — Safe Analytical Scheduler Separation and Canonical Agent Resolution

**Status:** `NEEDS MORE VERIFICATION` (Human-QA pending: AI-SCHED-1 … AI-SCHED-4)

**Work Package:** `AI-FOUNDATION-R2`

**Runtime implementation commits:** `3f2f7b0` (core), `76a76b6` (status TTL/heartbeat)

**Documentation closeout HEAD:** `4fb907b`

**Return target after Human QA:** `ARB-WP1A-R1` (ARB-R1-3 scheduler contract)

**Do not close:** ARB-WP1A-R1, full Arbitrage Agent, Overview, Scan History drill-down, Connections

---

## RCA

1. **Kill-Switch wipe:** `engineWorkerLeader` called `scheduler.stop()` under Emergency Stop and cleared safe analytical timers.
2. **Synthetic Agent IDs:** `agent-1`…`agent-15` do not resolve in `ai_agents`; canonical Arbitrage is `agent_key=arbitrage`.

---

## Ownership

- Owner: `titan-engine-worker`
- Status SoT: Redis `titan:scheduler:analytical_status` (TTL 700s + ≤60s heartbeat under KS)
- API `GET /api/v1/scheduler/status` prefers worker Redis; never claims backend singleton as owner

---

## Kill-Switch separation

- Stop/do not start trading engine + autopilot
- Preserve/recover analytical `agents` interval via `applyEmergencyStopSeparation()`
- Skip live-capable allowlisted agents under KS
- Policy still evaluated every run; side effects suppressed
- No `Scheduler Service Stopped` spam

---

## Canonical resolution + allowlist

- `scheduledAgentResolver.js`: `agent_key` / UUID; reject `agent-N`; empty list = nobody
- Staging: `scheduler_config.agents.agents = ["arbitrage"]`, interval `300000`
- Before snapshot: `/tmp/ai-f2-sched-config-before.json`

---

## Tests

- Focused: **33/33 PASS**
- Broader related: **61 PASS, 3 skipped**

---

## Staging scheduled evidence

| Field | Value |
|-------|--------|
| First decision ID | `48604985-483c-4177-9bbc-3ea917702e99` |
| Timestamp | `2026-07-18T12:36:52.318Z` |
| Producer | `trigger=scheduler`, `producer=titan-engine-worker` |
| Agent | `arbitrage` / `04b6ca95-5fd3-471d-a568-bd7f1c391d83` |
| Contract | `2.0.0-wp1a`, `legacy=false`, classification `modern` |
| Counts | candidates 7 / rejected 7 / qualified 0 |
| POST /run nearby | **0** |
| Recurrence | ~1 row / 5 min; Total Scans 31 → 49 |
| Manual shape match | vs `6e9ada1e-…` — PASS |

---

## Browser QA (engineering)

PASS: Overview Completed (no Legacy), History Analytical·Completed·Dry Run, EN/FA RTL IRANSans, desktop/tablet/mobile, console clean, no /run mutation.

Note: Overview does not surface Total Scans string; count verified via History/API.

---

## Runtime safety

Demo · Kill Switch active · workerAcknowledged · provider offline · no external side effects

Frontend bundle unchanged: `assets/index-DdyO2tD0.js`

---

## Protected files

Untouched: `scripts/backup-db.sh`, `titangold-backup-healthcheck.sh`, `titangold-telegram-notify.sh`

---

## Rollback

1. `git revert 76a76b6` then `3f2f7b0` (or redeploy prior artifacts)
2. Restore scheduler_config from before snapshot
3. Restart worker + reload backend

---

## Deferred

- ARB-WP1B-2B History drill-down
- Overview / Connections — not started
- ARB-WP1A-R1 close — after Human QA

---

## Human-QA

- **AI-SCHED-1** Emergency Stop Separation
- **AI-SCHED-2** Canonical Agent Resolution
- **AI-SCHED-3** Scheduled Modern Scan
- **AI-SCHED-4** Stability and Regression

**Engineering verdict before Human QA:** `NEEDS MORE VERIFICATION`
