# T2 Retry Orchestrator (durable / fail-closed)

Operational tooling for a future Owner-authorized one-shot T2 transaction:

1. Engine topology 2 → 1 (stop exact extra `titan-engine-worker`)
2. Persist already-live telegram-collector DB-B discrete `DB_*` env via the **same** guarded `pm2 save`

Default CLI is non-mutating. Live adapter is repo-owned (`liveBoundary.mjs`) but only selected when **all** execution gates are present, and still requires `--confirm-run-transaction`.

## Durable journal

- Exclusive run dir: `<journalRoot>/TITANGOLD_T2_RUN_<RUN_ID>/` (0700)
- Journal file: `journal.json` (0600)
- Auth consumption persisted **before** any backup/PM2 mutation
- Same RUN_ID / crash-after-consume / terminal → fail closed (Owner/RCA; no auto-replay)

## Central mutation guard

Every mutating boundary op (`ensureDir`, `writeBackup`, `chmod`, `stop`, `save`, `restoreDump`, `start`) goes through `guardedCall` → `requireMutationOpen`.

Rollback path: nonterminal → `ROLLBACK_RUNNING` → guarded restore/start → `ROLLED_BACK`.  
Never mutate after terminal states.

## Env allowlist

Secret-safe structural/value comparison of real PM2 env containers (not metadata).  
Only permitted durable diffs: engine extra online→stopped + collector `DB_*` appear (`DB_USER=tg_rot_b_0824`).  
Evidence: presence bits / SAME|CHANGED counts — never values.

## Future one-shot envelope (DO NOT execute casually)

precheck → journal → consume auth (persisted) → backup → stop extra → singleton →
guarded `pm2 save` → allowlist proof → health → COMPLETE

Tool version: see `TOOL_VERSION` in `constants.mjs`.
