# T2 Dump Sanitizer (v1.0.0)

Repo-owned tooling to sanitize unauthorized persisted PM2 dump state while preserving collector DB-B exactly.

## Authorized transaction

`T2_UNAUTHORIZED_DUMP_SANITIZE_PRESERVE_DB_B`

## Effects (exact set)

- `SANITIZE_UNAUTHORIZED_PERSISTED_STATE`
- `PRESERVE_COLLECTOR_DB_B_EXACT`
- `ATOMIC_DUMP_WRITE_0600`

## Semantics

- Target = `deepClone(CLEAN_PRE)` + five collector `DB_*` from **CURRENT** dump only
- CURRENT dump `DB_*` must equal LIVE for all five before auth consume
- Never merge full live env / God / `process.env`
- Atomic write via `writeProjectedActiveDump` semantics (mode `0600` before secret bytes; uid/gid preserved; no intermediate `0664`; **no** `pm2 save`)

## Default mode

Non-mutating / fail-closed. Live execution requires:

`--execute --run-id --authorization-file --acknowledge-production-mutation YES --clean-pre-file --expected-clean-pre-sha --expected-active-dump-sha --backup-root --journal-root --expected-tool-version 1.0.0 --confirm-run-transaction`

Auth is consumed immediately before the first production mutation (backup write).

## Rollback

Rollback authority is the **current pre-sanitization** active dump backup — **never** CLEAN_PRE.

If write applied/unknown: fresh-read first; if PRE still present → no restore; else restore exact PRE bytes/mode/uid/gid.

## Tests

```bash
cd backend
NODE_OPTIONS=--experimental-vm-modules node_modules/.bin/jest __tests__/unit/t2DumpSanitizer.test.js --no-coverage
```
