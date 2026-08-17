# TitanGold C2 Offline Migration Runner Capsule

Exceptional maintenance tool for applying the already-reviewed C2 migration
`052_telegram_messages_channel_message_id_index` when production
`node-pg-migrate` is absent because of `npm ci --production`.

This is **not** a replacement for TitanGold's global migration framework.
Do **not** change `backend/database/migrate.js`, `setup_migrations.js`,
or production `package.json` / `package-lock.json` / `node_modules`.

## Contract

- Runner model: **R2** isolated offline capsule
- Node model: **N1** — production system Node **v20.19.5** / linux x64
- Root dependencies (exact): `node-pg-migrate@8.0.4`, `pg@8.16.3`
- Closure: pure JavaScript (no native addons, no `pg-native`)
- Capsule contains **no** canonical migration 052
- Capsule contains **no** database credentials
- Allowed operations: `up` and `down` only
- Allowed migration basename only:
  `052_telegram_messages_channel_message_id_index.js`
- Required migration SHA256:
  `2c7c5723b20fd823102fb78f8cd97664453e3fcbb07ece56efb4ec0bd444f082`
- Artifact authority: **CONTENT SHA256**, not tag/URL/run id
- Delivery design: **D2** public GitHub Release asset
- Publishing a Release is a **separate Owner authorization**
- Production `052 up` still requires a **separate Owner execution gate**
- `npm run migrate:up` remains **blocked** for C2 because it would also
  apply pending 050/051
- 050 remains **BLOCKED**; 051 remains **NOT AUTHORIZED**
- Owner-accepted bounded Telegram maintenance gap is a **product policy**,
  not capsule behavior
- The C2 pre-build IO resource gate remains **mandatory**
- Controlled collector pause is **not** authorized by this package

## Launcher

From an extracted capsule (never via `npx`):

```
unset NODE_PATH
node bin/c2-migrate.mjs <up|down> <ONE_FILE_MIGRATIONS_DIR>
```

Exactly two user arguments. No extra flags. `--fake` and `--no-lock` are
impossible to pass. Advisory locking stays enabled.

`DATABASE_URL` is read at execution time only. The launcher never prints it.
Self-test must not require it and must not open a database connection.

## Self-test

```
unset NODE_PATH
node bin/c2-self-test.mjs
```

Validates Node v20.19.5 / linux / x64, package metadata, module isolation,
and (when present) file manifests. Exit nonzero on mismatch.

## Future D2 retrieval (not performed by this package)

Public repository retrieval does not require a GitHub access secret:

1. Download the Owner-authorized Release asset
2. Compute local SHA256
3. Compare to the SHA256 in the Owner execution prompt
4. Only then extract, verify, and self-test

Transport success is not trust. Tag/name/URL are not authority.

Recommended future names (still not trust):

- tag: `c2-runner-capsule-<SOURCE_SHA_PREFIX>`
- asset: `titangold-c2-runner-linux-x64-node20.19.5.tar.gz`

## Build (CI / isolated source worktree only)

Never run npm inside the production application tree.

```
SOURCE_COMMIT=<git sha> SOURCE_DATE_EPOCH=<unix>
./scripts/build-artifact.sh
./scripts/verify-artifact.sh <archive> <sha256>
```
