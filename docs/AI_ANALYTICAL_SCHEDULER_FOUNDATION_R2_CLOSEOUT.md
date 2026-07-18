# AI-FOUNDATION-R2 — Safe Analytical Scheduler Separation and Canonical Agent Resolution

**Status:** `CLOSED AND FROZEN`

**Engineering verdict:** `REAL WORKING`

**Work Package:** `AI-FOUNDATION-R2 — Safe Analytical Scheduler Separation and Canonical Agent Resolution`

**Environment:** Staging (`https://titan.zala.ir`)

| Baseline | Commit / artifact |
|----------|-------------------|
| Runtime implementation (core) | `3f2f7b0` — `fix(ai): separate analytical scheduler from Emergency Stop wipe` |
| Runtime implementation (status TTL/heartbeat) | `76a76b6` — `fix(ai): keep analytical scheduler status fresh between ticks` |
| **Final runtime implementation baseline** | **`76a76b6`** (owns deployed worker/scheduler/status source) |
| Pre-Human-QA documentation HEAD | `3155957` |
| Documentation closeout HEAD | `docs(ai-runtime): close analytical scheduler foundation R2` on `main` (see Git after push) |
| Served frontend bundle | `assets/index-DdyO2tD0.js` (unchanged; no FE rebuild for this WP) |

**Return target:** `ARB-WP1A-R1 — Final Scheduler Contract Verification and Closeout`

**Do not close in this WP:** ARB-WP1A-R1 · Overview · Scan History drill-down · Connections

---

## 1. Original RCA

### Kill-Switch defect

`engineWorkerLeader` called `scheduler.stop()` while Emergency Stop was active. That cleared **all** Agent timers, including safe analytical jobs that the canonical execution policy allows in Demo/Dry Run.

Observed before fix: no active Agent timer, repeated `Scheduler Service Stopped` logs, no scheduler-created Arbitrage decisions, all Arbitrage decisions correlated with manual HTTP `POST …/run`.

### Agent-identity defect

Scheduler used synthetic IDs (`agent-1` … `agent-15`) that do not exist in `ai_agents`. Canonical Arbitrage is `agent_key = arbitrage` (UUID `04b6ca95-5fd3-471d-a568-bd7f1c391d83`). Synthetic IDs failed closed at the canonical DB lookup.

Both defects were repaired in `3f2f7b0` / `76a76b6`.

---

## 2. Emergency Stop separation

Under Emergency Stop:

- Trading engine and autopilot are not started / remain stopped
- Analytical Agent interval is preserved/recovered via `applyEmergencyStopSeparation()`
- Live-capable allowlisted Agents are skipped at the scheduler gate
- Every scheduled run still passes `evaluateExecutionPolicy` via `executeAgentRun`
- External side effects remain suppressed
- Worker acknowledgement is preserved
- Repeated 3-second Kill-Switch polling is idempotent (no stop-log spam)

Safe Staging config (non-secret):

```json
{ "agents": ["arbitrage"], "enabled": true, "interval": 300000 }
```

---

## 3. Canonical Agent resolution

Owner: `backend/services/scheduledAgentResolver.js`

- Accepts stable `agent_key` or canonical UUID
- Rejects synthetic `agent-N`
- Unknown / disabled / paused / ambiguous → fail closed / skip
- Preferred registration identifier: `agent_key`
- Staging allowlist: only `arbitrage`

---

## 4. Explicit allowlist behavior

`scheduler_config.agents.agents`:

| Value | Meaning |
|-------|---------|
| `[]` | Run **no** Agents (empty ≠ all) |
| `["arbitrage"]` | Only Arbitrage (Staging controlled) |
| `agent-6` | Rejected by validation |

Malformed allowlist values are rejected. Duplicates are deduplicated.

---

## 5. Worker ownership and status SoT

| Role | Process |
|------|---------|
| Authoritative scheduler owner | `titan-engine-worker` (`engineWorkerLeader.js`) |
| Not owner | `titan-backend` cluster singleton |

Worker-authoritative status: Redis `titan:scheduler:analytical_status` (TTL 700s + ≤60s heartbeat under Emergency Stop).

`GET /api/v1/scheduler/status` prefers worker Redis and never reports the inactive backend singleton as owner. API start/stop on the cluster returns `409 SCHEDULER_OWNER_IS_WORKER`.

Closeout passive verification (read-only):

- `owner`: `titan-engine-worker`
- `isRunning`: true
- `allowlist` / `registeredJobs`: `["arbitrage"]`
- `activeIntervals` includes `agents`
- `emergencyStopSeparation`: true
- Effective Mode: `demo`
- Kill Switch: active
- workerAcknowledged: true
- providerConnected: false

---

## 6. Timer lifecycle

- One `agents` interval per worker process
- `ensureAnalyticalAgentScheduler()` prevents duplicates
- In-flight lock per `agent_key` prevents overlapping runs
- No automatic Live restart

---

## 7. One-tick / one-decision and modern contract

Engineering Staging evidence (first scheduler-created row after deploy):

| Field | Value |
|-------|--------|
| decision ID | `48604985-483c-4177-9bbc-3ea917702e99` |
| timestamp | `2026-07-18T12:36:52.318Z` |
| producer | `trigger=scheduler`, `producer=titan-engine-worker` |
| agent_key / UUID | `arbitrage` / `04b6ca95-5fd3-471d-a568-bd7f1c391d83` |
| contractVersion | `2.0.0-wp1a` |
| legacy | `false` |
| classification | `modern` |
| nearby POST `/run` | 0 |
| Manual shape match | vs `6e9ada1e-…` — PASS |

Recurrence: approximately one decision per 300000ms interval.

---

## 8. Human QA — PASS (AI-SCHED-1 … AI-SCHED-4)

Human QA explicitly approved all four scenarios.

### AI-SCHED-1 — Emergency Stop Separation — PASS

- Emergency Stop remained active
- Effective Mode remained Demo / Dry Run
- Live execution remained impossible
- Analytical Scheduler continued without clicking Run Scan
- No order, transfer, settlement, or external notification

### AI-SCHED-2 — Canonical Agent Resolution — PASS

- Canonical Arbitrage Agent resolved and executed
- Only Arbitrage allowlisted
- No visible activity from another Agent
- No synthetic Agent-ID dependency in the final runtime path

### AI-SCHED-3 — Scheduled Modern Scan — PASS

- Total Scans increased without clicking Run Scan
- Observed count changed from **52 → 53**
- Latest Scan timestamp advanced by one normal interval (~5:48 PM → ~5:53 PM)
- Overview showed **Completed**
- Scan History showed **Analytical scan · Completed · Dry run**
- New record was **not** labeled Legacy
- One observed tick created exactly one visible new History row
- Overview and Scan History timestamps/counts agreed

### AI-SCHED-4 — Stability and Regression — PASS

- No duplicate timer behavior visible
- No duplicate decision row visible for one tick
- No repeated UI flicker
- Status remained stable
- Persian RTL and canonical Persian font passed
- English passed
- No visible Console/runtime, shell, or safety regression

---

## 9. Tests

| Suite | Result |
|-------|--------|
| Focused (resolver + foundation R2 + schedulerWorkerSafety) | **33/33 PASS** |
| Broader related (policy / contract / order / killSwitch) | **61 PASS, 3 skipped** |

---

## 10. Performance and operations

| Metric | Evidence |
|--------|----------|
| Stop-log spam | Eliminated under KS steady state |
| Tick duration | ~2.5–5.4s (`durationMs` in worker logs) |
| Status TTL | 700s + ≤60s heartbeat |
| Agent discovery per tick | Allowlist-only (no synthetic 15-ID loop) |
| Memory before/after | `BASELINE NOT AVAILABLE` |

---

## 11. Runtime safety

- Effective Mode: Demo (Dry Run path for analytical scans)
- Emergency Stop: Active
- Worker acknowledged: true
- Provider/broker: offline
- Deployment Live engine: disabled
- Live remains impossible
- No orders / transfers / settlement / real notifications from this foundation

Frontend bundle unchanged: `assets/index-DdyO2tD0.js`

Commits after `76a76b6` through pre-closeout HEAD `3155957` were **documentation-only** (`docs/AI_ANALYTICAL_SCHEDULER_FOUNDATION_R2_CLOSEOUT.md` only).

---

## 12. Protected unrelated files

Untouched throughout this WP:

- `scripts/backup-db.sh`
- `scripts/phase2-monitoring/titangold-backup-healthcheck.sh`
- `scripts/phase2-monitoring/titangold-telegram-notify.sh`

---

## 13. Rollback

1. Redeploy worker/scheduler/status sources from before `3f2f7b0`, or `git revert 76a76b6` then `3f2f7b0`
2. Restore `scheduler_config.agents` from pre-change snapshot (`agents: []` or approved prior JSON)
3. `pm2 restart titan-engine-worker` and `pm2 reload titan-backend`
4. Confirm Demo / Kill Switch / worker acknowledgement / scheduler status owner

Documentation-only closeout commits do not require runtime rollback.

---

## 14. Final status matrix

| Item | Status |
|------|--------|
| AI-FOUNDATION-R2 | **CLOSED AND FROZEN** (`REAL WORKING`) |
| ARB-WP1A-R1 | **READY FOR FINAL VERIFICATION AND CLOSEOUT** (not closed here) |
| Overview | **OPEN — INTERRUPTED** |
| Scan History drill-down | **DEFERRED** → `ARB-WP1B-2B — Scan History Redesign and Scan Detail Drill-down` |
| Connections | **NOT STARTED** → `SETTINGS-CONNECTIONS-D1 — Read-Only Discovery and Security Audit` |

---

## 15. Stop

After this documentation closeout:

- Do **not** begin ARB-WP1A-R1 automatically
- Do **not** continue Overview
- Do **not** implement Scan History drill-down
- Do **not** begin Connections
