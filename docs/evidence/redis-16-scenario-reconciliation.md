# Redis 16-Scenario Reconciliation Matrix

Freeze HEAD: `b94ee1dad2987ba2f0747cd0a6e00da1ca1888bf`  
Evidence primary: `docs/evidence/redis-process-level.json`  
Gap fill: `docs/evidence/redis-gap-scenarios-14-15.json`  
Related: `docs/evidence/worker-scheduler-process-level.json`

| # | Required Scenario | Existing Test/Evidence | Actually Executed? | Result | Gap? |
|---|-------------------|------------------------|--------------------|--------|------|
| 1 | Backend starts while Redis unavailable | `process_start_redis_unavailable` (child backend probe, REDIS dead port) | Yes | PASS | No — equivalent process-level start path |
| 2 | Worker starts while Redis unavailable | `worker_ack_path_redis_unavailable` + worker soft restart coverage | Yes | PASS | No |
| 3 | Scheduler starts while Redis unavailable | `scheduler_policy_redis_unavailable` (policy deny, sideEffects suppressed) | Yes | PASS | No |
| 4 | Redis fails during runtime lookup | `redis_pause_during_runtime_lookup` (CLIENT PAUSE; ready timeout fail-closed) | Yes | PASS | No |
| 5 | Redis restarts while backend remains running | `backend_survives_redis_reconnect` (pause→resume; backend PIDs unchanged) | Yes | PASS | No — pause/resume ≡ temporary Redis outage+return |
| 6 | Redis restarts while worker remains running | reconnect window + `staging_worker_still_online_after_tests` + gap14 end-state | Yes | PASS | No |
| 7 | Stale runtime state | `redis_stale_weaker_cache_rejected` (weaker live/ks=false, older version) | Yes | PASS | No |
| 8 | Invalid JSON | `redis_invalid_json_ignored` | Yes | PASS | No |
| 9 | Older revision than PostgreSQL | Same stale fixture uses `version = pg.version - 1`; cache match requires equal version in SSOT | Yes | PASS | No — not duplicated as separate line |
| 10 | Invalid newer revision | `redis_invalid_newer_revision_ignored` | Yes | PASS | No |
| 11 | Duplicate pub/sub event | `isolated_redis_pubsub_duplicate_out_of_order` | Yes | PASS | No |
| 12 | Out-of-order pub/sub event | Same fixture (publish `version-5` then later current) | Yes | PASS | No |
| 13 | Delayed pub/sub event | Same fixture (300ms delay then republish) | Yes | PASS | No |
| 14 | Worker restart while Redis unavailable | **NEW** `gap14_worker_restart_while_redis_unavailable` | Yes (2026-07-14) | PASS | Closed |
| 15 | Backend cluster restart while Redis unavailable | **NEW** `gap15_backend_cluster_instance_restart_while_redis_unavailable` | Yes (2026-07-14) | PASS | Closed |
| 16 | Redis reconnect after failure | `backend_survives_redis_reconnect` | Yes | PASS | No |

## Gate verdict

**PASS** — all safety-relevant scenarios materially covered by executed process-level evidence; no newly discovered safety defect; PostgreSQL remain authoritative; Kill Switch stayed active; Live impossible; broker connections stayed 0.

## Safety invariants verified on every scenario

- PG `killSwitchActive=true`, `globalMode=demo`
- Ready / child probes: effectiveMode demo, side effects suppressed for live-capable paths
- No Kill Switch clear, no Live enable, no real exchange connection
