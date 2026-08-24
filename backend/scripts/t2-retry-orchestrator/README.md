# T2 Retry Orchestrator (durable / fail-closed)

Operational tooling for a future Owner-authorized one-shot T2 transaction:

1. Engine topology 2 → 1 (stop exact extra `titan-engine-worker`)
2. Persist already-live telegram-collector DB-B discrete `DB_*` env via the **same** guarded `pm2 save`

Default CLI is non-mutating. Live adapter (`liveBoundary.mjs`) is selected only when **all** gates are **explicit** (no default `--expected-tool-version`), including `--confirm-run-transaction`.

## Durable journal

- Exclusive run dir: `<journalRoot>/TITANGOLD_T2_RUN_<RUN_ID>/` (0700)
- Journal file: `journal.json` (0600)
- Atomic persist: temp write → fsync file → rename → fsync directory
- Auth consumption persisted **before** any backup/PM2 mutation
- Same RUN_ID / crash-after-consume / terminal → fail closed (Owner/RCA; no auto-replay)

## Side-effect ledger + rollback

Ledger bits: `BACKUP_WRITTEN` · `STOP_ATTEMPTED` · `ENGINE_STOP_APPLIED` · `SAVE_ATTEMPTED` · `DUMP_SAVE_APPLIED`

Inverse mutations only when proven. Stale identity **before** stop → `FAILED` with zero PM2 rollback mutation.

Rollback path: nonterminal → `ROLLBACK_RUNNING` → conditional guarded restore/start → **PRE_EQUIVALENT proof** → `ROLLED_BACK`, else `FAIL_FORWARD_COMPLETE`.

## Allowlists

- Env: secret-safe key/value compare; only engine extra online→stopped + collector `DB_*` appear
- Collector: exact live→persist equality for all five `DB_*` (evidence `*_MATCH=YES/NO` only)
- Stable PM2 config: name/script/cwd/exec_mode/interpreter/instances/namespace/args/node_args/autorestart/watch

## Future one-shot envelope (DO NOT execute casually)

precheck → journal → consume auth (persisted) → backup → stop extra → singleton →
guarded `pm2 save` → allowlist + DB exact match → health → COMPLETE

Tool version: `TOOL_VERSION` in `constants.mjs` (currently **1.3.0**).

Active dump restore preserves **exact PRE mode** (never forces `0664`). Engine retain/extra selection requires full stable-config + env equivalence. Rollback proves full live PRE_EQUIVALENCE for all PM2 groups.
