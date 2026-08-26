# T2 Retry Orchestrator (durable / fail-closed)

Operational tooling for a future Owner-authorized one-shot T2 transaction:

1. Engine topology 2 → 1 (stop exact extra `titan-engine-worker`)
2. Persist already-live telegram-collector DB-B discrete `DB_*` env via the **same** guarded `pm2 save`
3. Harden the newly written active PM2 dump mode to **0600** immediately after that single save

Default CLI is non-mutating. Live adapter (`liveBoundary.mjs`) is selected only when **all** gates are **explicit** (no default `--expected-tool-version`), including `--confirm-run-transaction`.

## Durable journal

- Exclusive run dir: `<journalRoot>/TITANGOLD_T2_RUN_<RUN_ID>/` (0700)
- Journal file: `journal.json` (0600)
- Atomic persist: temp write → fsync file → rename → fsync directory
- Auth consumption persisted **before** any backup/PM2 mutation
- Same RUN_ID / crash-after-consume / terminal → fail closed (Owner/RCA; no auto-replay)

## Side-effect ledger + rollback

Ledger bits: `BACKUP_WRITTEN` · `STOP_ATTEMPTED` · `ENGINE_STOP_APPLIED` · `SAVE_ATTEMPTED` · `DUMP_SAVE_APPLIED` · `DUMP_MODE_HARDEN_ATTEMPTED` · `DUMP_MODE_HARDEN_APPLIED`

Inverse mutations only when proven. Stale identity **before** stop → `FAILED` with zero PM2 rollback mutation.

Rollback path: nonterminal → `ROLLBACK_RUNNING` → conditional guarded restore/start → **PRE_EQUIVALENT proof** → `ROLLED_BACK`, else `FAIL_FORWARD_COMPLETE`.

Rollback restores **exact PRE dump bytes and exact PRE dump mode** (PRE may be `0664`). Success final mode is `0600`.

## Allowlists

- Env: secret-safe key/value compare; only engine extra online→stopped + collector `DB_*` appear
- Collector: exact live→persist equality for all five `DB_*` (evidence `*_MATCH=YES/NO` only)
- Stable PM2 config: name/script/cwd/exec_mode/interpreter/instances/namespace/args/node_args/autorestart/watch
- Engine selection: full env equality **except** a narrow PATH-only exception used solely for retain/extra selection; PRE→POST PATH drift remains FAIL
- Canonical retain: when PATH differs, retain the unique engine matching backend+processor PATH consensus (never mutate PATH)

## Future one-shot envelope (DO NOT execute casually)

precheck → journal → consume auth (persisted) → backup → stop extra → singleton →
guarded `pm2 save` → dump harden `0600` → allowlist + DB exact match → health → COMPLETE

Authorized transaction id: `T2_ENGINE_SINGLETON_COLLECTOR_DB_B_PERSIST_DUMP_HARDEN`  
Authorized effects: `ENGINE_2_TO_1` · `COLLECTOR_DB_B_PERSIST` · `DUMP_MODE_HARDEN_0600`  
Tool version: `TOOL_VERSION` in `constants.mjs` (currently **1.4.0**). Old `1.3.0` artifacts fail closed.

Active dump restore preserves **exact PRE mode** (never forces `0664`). Exactly **one** forward `pm2 save`; harden does not save again.
