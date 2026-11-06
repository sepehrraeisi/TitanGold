# @titangold/tecp-ops — CP1 Offline Security Contracts

**PROOF_CLASS = OFFLINE / TEST_ONLY / NON_OPERATIONAL**

This package implements TECP-OPS-PILOT-001 checkpoint CP1 only:

1. Test-attested Worker identity verification
2. Independently verified Owner approval artifacts (Ed25519)
3. Task-scoped, time-limited, revocable capability verification

## Exact CP1 file scope (11 paths)

See `CP1_PATHS` in `src/config.js`. No other files are authorized in CP1.

## How to run focused tests

```bash
cd tecp-ops
node --test test/*.test.js
```

Uses builtin `node:test` / `node:assert/strict` / `node:crypto` only.
**NEW_NPM_DEPENDENCIES = NONE.**

## Threat model and trust assumptions

- Trust anchors are installed only by privileged TEST_ONLY harness factories.
- Callers cannot supply verifying keys, trust anchors, or verifiers in requests.
- Successful local `ALLOW` means offline contract verification only.
- `TEST_ATTESTED` ≠ `OS_AUTHENTICATED`
- Test ephemeral keys ≠ real Owner key custody
- Offline capability ≠ operational permission
- Rule02 YES / Validator ALLOW ≠ execution authority
- CP1 PASS ≠ CP2–CP10 authorization

## Explicit non-claims

- No same-UID / OS isolation sealing
- No real Owner private-key custody
- No live GitHub tip provenance
- No operational MCP mutation authorization
- No database authorization
- No real Worker launch or OS identity issuance
- Process-local replay/revocation registries are **volatile** (not durable exactly-once)
- No production readiness

## Future CP2–CP10

Each later checkpoint requires a **separate Owner gate** and security evidence.
CP1 success does not auto-advance the program.

## Import safety

Importing this package creates no listeners, Workers, MCP registrations,
database clients, network sockets, or credential file access.
