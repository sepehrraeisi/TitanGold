# T2 Retry Orchestrator (durable / fail-closed)

Operational tooling for a future Owner-authorized one-shot T2 transaction:

1. Engine topology 2 → 1 (stop exact extra `titan-engine-worker`)
2. Persist already-live telegram-collector DB-B discrete `DB_*` env via the **same** guarded `pm2 save`

This directory is **source + tests only**. Default CLI is non-mutating.

## Future one-shot envelope (DO NOT execute from this gate)

1. Fresh Rule02 / Owner authorization artifact present
2. Fresh precheck (semantic process resolve; dump vs live)
3. Fresh dump backup under `/home/ubuntu/TITANGOLD_PM2_SECURE_BACKUPS/TITANGOLD_PM2_ENGINE_RECON_<RUN_ID>/dump.pm2.pre` (0700/0600)
4. Consume authorization immediately before first mutation
5. Revalidate extra engine identity; `pm2 stop <exact-extra-pm_id>`
6. Verify singleton online engine retained
7. One guarded `pm2 save`
8. Semantic allowlist proof:
   - `ENGINE_EXTRA_STATUS_ONLINE_TO_STOPPED`
   - `COLLECTOR_DB_KEYS_APPEAR` (`DB_USER=tg_rot_b_0824` expected; values never logged)
   - dump SHA change = expected after successful save (NOT failure)
9. Health 5002/5003 + collector accounts/channels = 200
10. Terminal `COMPLETED` → mutation capability CLOSED

Rollback (exact pre dump + start extra) only before terminal closeout if required.

## Safety

- No historical pm_id authority
- No embedded credentials
- Injected command boundary required for any mutation
- CLI without `--execute` exits non-zero and mutates nothing
- Even with `--execute`, this source-fix CLI keeps the live PM2 adapter unwired (fail-closed)

## Tests

`backend/__tests__/unit/t2RetryOrchestrator.test.js` (T1–T16 + SHA regression)
