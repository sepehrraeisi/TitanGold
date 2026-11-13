# @titangold/tecp-ops-persistence — Offline Persistence & S2 Contracts

**PROOF_CLASS = OFFLINE / TEST_ONLY / NON_OPERATIONAL**

This package holds merged TECP-OPS-PILOT-001 persistence-side offline contracts:

| Layer | Status | Notes |
| --- | --- | --- |
| **CP2-I** | Merged verified closed (PR #288) | Non-dispatch composition of CP1 authority with frozen DLP-001..004 public interfaces |
| **S2** | Merged offline (PR #291–#296) | Disposable harness, DB-issued lease context, durable registry contracts, hard-deny dispatcher, Gate C+D offline suites |
| **CP2-DB / live PostgreSQL** | **NOT AUTHORIZED** | `OPS_PILOT_DB_EXECUTION_AUTHORIZED = false`, `OPS_PILOT_TIER3_AUTHORIZED = false` |

Offline green tests are **not** durable fencing proof, operational dispatch, Worker/MCP activation, or production readiness.

## Existing sources (do not invent beyond this list)

Under `src/`:

- `operationalTaskLeaseAuditRepository.js` — CP2-I offline composition gate (non-dispatch)
- `nonProdDbHarness.js` — CP2-I non-prod harness; `HARNESS_DB_EXECUTION_AUTHORIZED = false`
- `disposableOpsPilotDbHarness.js` — S2 disposable harness planning + fail-closed live gates
- `dbIssuedLeaseContext.js` — DB-validated lease context projection contracts (offline doubles / branded provenance)
- `durableAuthorityRegistries.js` — durable jti/revocation registry contracts + offline TEST_ONLY doubles
- `operationalDispatcher.js` — fail-closed dispatcher; `OPERATIONAL_DISPATCH_AUTHORIZED = false`

Under `scripts/`:

- `ownerControlledTier3LocalRunner.js` — Owner-controlled Tier-3 local runner (offline suite orchestration / evidence); does **not** grant live DB by itself

Under `test/`:

- SQL fixtures for future disposable proof only: `disposableOpsPilotSchema.sql`, `disposableOpsPilotAuthoritySchema.sql` (not executed by `npm test`)

### Package `exports` (current)

`package.json` `exports` currently expose only:

- `./operationalTaskLeaseAuditRepository.js`
- `./nonProdDbHarness.js`

Other S2 modules are present as source files and are imported by relative path from tests. Expanding `exports` is **out of scope** for this documentation slice.

## DB-free offline test inventory

All of the following suites are authored to run **without** starting PostgreSQL, opening `DATABASE_URL`, or executing live SQL when live gates remain false:

| Suite | Role |
| --- | --- |
| `test/operationalTaskLeaseAuditRepository.test.js` | CP2-I fake-client / non-dispatch contracts |
| `test/fencingConcurrency.test.js` | Modeled offline concurrency/fencing negatives (not live PG) |
| `test/dbIssuedLeaseContext.test.js` | Lease-context branding / offline fixture rejects |
| `test/durableAuthorityRegistries.test.js` | Offline registry doubles + SQL catalog constants |
| `test/operationalDispatcher.test.js` | Hard-deny dispatcher + TEST_ONLY composition |
| `test/disposableOpsPilotDbHarness.test.js` | Harness safety / inert `spawnSync` planning (no real initdb) |
| `test/cp2DbFencingDurability.test.js` | Offline orchestration; live SQL matrix gated closed |
| `test/cp2DbDispatcherIntegration.test.js` | Offline orchestration; live DB matrix gated closed |

### How to run

```bash
cd tecp-ops-persistence
npm test
```

Equivalent explicit command (what `scripts.test` runs):

```bash
cd tecp-ops-persistence
node --test \
  test/operationalTaskLeaseAuditRepository.test.js \
  test/fencingConcurrency.test.js \
  test/dbIssuedLeaseContext.test.js \
  test/durableAuthorityRegistries.test.js \
  test/operationalDispatcher.test.js \
  test/disposableOpsPilotDbHarness.test.js \
  test/cp2DbFencingDurability.test.js \
  test/cp2DbDispatcherIntegration.test.js
```

`npm test` must remain DB-free while `OPS_PILOT_DB_EXECUTION_AUTHORIZED === false`.

## PostgreSQL 14.24 readiness versus live execution

The disposable harness documents a **required** binary set:

- Version prefix: `postgres (PostgreSQL) 14.24`
- Bin dir: `/usr/lib/postgresql/14/bin`
- Intended isolation: disposable root, Unix-socket-only, no env `DATABASE_URL` / remote targets

Having matching host binaries is **readiness inventory only**. Live disposable PostgreSQL execution additionally requires separate Owner Tier-3 / CP2-DB authorization. Today:

- `OPS_PILOT_DB_EXECUTION_AUTHORIZED = false`
- `OPS_PILOT_TIER3_AUTHORIZED = false`
- Live fencing / dispatcher SQL catalogs remain `NOT_EXECUTED_LIVE_GATE_CLOSED` under normal offline runs

## Hard-deny gates and prohibited live targets

Documented fail-closed behaviors (non-exhaustive; see sources/tests):

- Env / caller `DATABASE_URL`, `PGHOST`, `PGPORT`, `PGSERVICE`, caller-defined pg binaries → DENY
- TCP / remote endpoints / production env signals → DENY
- Shared or non-disposable roots → DENY
- Caller boolean / env activation of live DB → DENY
- Operational dispatcher: `authorizeAndDispatch` → `DENY_OPERATIONAL_DISPATCH_DISABLED` while `OPERATIONAL_DISPATCH_AUTHORIZED = false`
- S1 offline lease fixtures are **not** operational / DB-proven lease authority

Do **not** point these suites at the host’s shared PostgreSQL cluster socket.

## Explicit non-claims

- No CP2-DB durability or live fencing PASS from offline orchestration alone
- No operational Worker, MCP mutation, or production authorization
- No claim that package `exports` cover every S2 module
- No migration 057 / canonical schema adoption
- No production readiness

## Related package

Identity, Owner approval, capability, S1 RLA, S2 ORLA/trust-root/emergency-stop, and the offline one-Cursor composition test live in `@titangold/tecp-ops`.
