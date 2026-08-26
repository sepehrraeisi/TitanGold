# T2 Retry Orchestrator (durable / fail-closed)

Operational tooling for a future Owner-authorized one-shot T2 transaction:

1. Engine topology 2 → 1 (stop exact extra `titan-engine-worker`)
2. Persist already-live telegram-collector DB-B discrete `DB_*` via **surgical projected dump write**
3. Active dump created/replaced atomically at mode **0600** (no global `pm2 save`)

Default CLI is non-mutating. Live adapter (`liveBoundary.mjs`) is selected only when **all** gates are **explicit** (no default `--expected-tool-version`), including `--confirm-run-transaction`.

## Tool version

**TOOL_VERSION = 1.5.0**  
Authorized transaction: `T2_ENGINE_SINGLETON_COLLECTOR_DB_B_PROJECTED_PERSIST`  
Authorized effects: `ENGINE_2_TO_1` · `COLLECTOR_DB_B_PERSIST` · `PROJECTED_DUMP_WRITE_0600`

Old `1.4.0` / `DUMP_MODE_HARDEN_0600` / global-save artifacts **fail closed**.

## Why not `pm2 save`

PM2 6.0.13 `God.dumpProcessList` serializes **LIVE God `pm2_env`** (application + OS/shell + secrets). That caused `SEMANTIC_ALLOWLIST_FAIL` and unauthorized secret persistence risk (e.g. live `JWT_SECRET` ≠ dump).

Forward path **MUST NOT** call `pm2 save`. Boundary `pm2Save()` throws `GLOBAL_PM2_SAVE_FORBIDDEN`.

## Expected projection

```
EXPECTED_POST_DUMP = f(PRE_DUMP, PRE_LIVE_authorized_DB_only, AUTHORIZED_EFFECTS)
```

Base = deep clone of exact PRE dump. Allowed edits only:

- extra engine dump `status`: online → stopped
- collector: add exactly five PRE-LIVE `DB_HOST|PORT|NAME|USER|PASSWORD`
- file mode: **0600** from first temp byte (no 0664 intermediate)

Never copy live JWT / Cursor / SSH / PATH / `prev_restart_delay` / providers / Telegram / MASTER_KEY / etc.

Dump↔live engine mapping **does not rely on dump `pm_id`** (PM2 deletes it on save historically). Uses stable script/cwd/exec_mode/created_at (+ PATH-aware selection already done on live).

## Durable journal

- Exclusive run dir: `<journalRoot>/TITANGOLD_T2_RUN_<RUN_ID>/` (0700)
- Journal file: `journal.json` (0600)
- Auth consumption persisted **before** any backup/PM2 mutation
- Same RUN_ID / crash-after-consume / terminal → fail closed

## Side-effect ledger + rollback

Ledger: `BACKUP_WRITTEN` · `STOP_ATTEMPTED` · `ENGINE_STOP_APPLIED` · `PROJECTED_DUMP_WRITE_ATTEMPTED` · `PROJECTED_DUMP_WRITE_APPLIED`

Legacy `SAVE_*` / `DUMP_MODE_HARDEN_*` remain false/unused on v1.5 forward.

Rollback: restore exact PRE dump bytes+mode (+ owner/group when captured); restart extra only if stop proven. No `pm2 save` on rollback.

## Resurrect compatibility

PM2 resurrect passes each dump entry to `God.prepare`. Flat dump top-level `status === stopped` is consumed so the process is registered stopped without execute. Projected `status` + flat/`env` DB_* locations match that model (fixture-tested; production resurrect not executed by this tool task).

## Future one-shot envelope (DO NOT execute casually)

precheck → journal → consume auth → backup → stop extra → build projection → atomic projected dump write 0600 → postwrite verify → health → COMPLETE
