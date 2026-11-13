# @titangold/tecp-ops — Offline TECP Ops Pilot Contracts

**PROOF_CLASS = OFFLINE / TEST_ONLY / NON_OPERATIONAL**

This package holds merged offline TECP-OPS-PILOT-001 contracts for:

| Layer | Status | Modules (sources under `src/`) |
| --- | --- | --- |
| **CP1** | Merged (PR #281) | `operationalWorkerIdentity.js`, `ownerApprovalArtifact.js`, `operationalCapabilityIssuer.js`, `config.js`, `index.js` |
| **S1** | Merged offline (PR #290) | `resourceLeaseAuthority.js` |
| **S2** | Merged offline (PR #291–#296) | `ownerInstalledTrustRoot.js`, `operationalResourceLeaseAuthority.js`, `operationalEmergencyStop.js` |
| **One-Cursor** | Merged offline composition (PR #297/#298) | `test/oneCursorPilot.integration.test.js` only |

Offline `ALLOW` / green tests mean contract verification only. They are **not** operational readiness, real Cursor claim/lease, durable PostgreSQL proof, Worker launch, MCP mutation, or operational dispatch authorization.

## Historical CP1 scope (11 paths — preserved)

CP1 remains documented in `CP1_PATHS` (`src/config.js`):

1. `tecp-ops/package.json`
2. `tecp-ops/package-lock.json`
3. `tecp-ops/README.md`
4. `tecp-ops/src/config.js`
5. `tecp-ops/src/operationalWorkerIdentity.js`
6. `tecp-ops/src/operationalCapabilityIssuer.js`
7. `tecp-ops/src/ownerApprovalArtifact.js`
8. `tecp-ops/src/index.js`
9. `tecp-ops/test/operationalWorkerIdentity.test.js`
10. `tecp-ops/test/operationalCapabilityIssuer.test.js`
11. `tecp-ops/test/ownerApprovalArtifact.test.js`

`src/index.js` still re-exports the **CP1 public surface only**. S1/S2 modules are additional offline sources consumed by relative imports and tests; they are not advertised as a broader runtime package API by `index.js`.

## Public offline test entrypoints

```bash
cd tecp-ops
# All package unit/integration offline suites (including one-Cursor composition)
node --test test/*.test.js

# Focused examples
node --test test/resourceLeaseAuthority.test.js
node --test test/operationalResourceLeaseAuthority.test.js test/operationalEmergencyStop.test.js test/ownerInstalledTrustRoot.test.js
node --test test/oneCursorPilot.integration.test.js
```

Or via npm:

```bash
cd tecp-ops
npm test
```

Uses builtin `node:test` / `node:assert/strict` / `node:crypto` only.  
**NEW_NPM_DEPENDENCIES = NONE.**

### One-Cursor offline composition (PR #298)

`test/oneCursorPilot.integration.test.js` simulates a single-Cursor authority chain:

`CP1 identity → Owner approval → capability → S1 RLA → S2 ORLA / emergency-stop → dispatcher HARD_DENY`

A valid path must reach `authorizeAndDispatch` and receive `DENY_OPERATIONAL_DISPATCH_DISABLED`. This is an offline integration proof, **not** real Cursor process execution, claim/lease durability, or operational dispatch enablement.

## Threat model and trust assumptions

- Trust anchors are installed only by privileged TEST_ONLY harness factories.
- Callers cannot supply verifying keys, trust anchors, or verifiers in requests.
- Successful local `ALLOW` means offline contract verification only.
- `TEST_ATTESTED` ≠ `OS_AUTHENTICATED`
- Test ephemeral keys ≠ real Owner key custody
- Offline capability / S1 / S2 authority verify ≠ persistence mutation permission
- Rule02 YES / Validator ALLOW ≠ execution authority
- CP1/S1/S2/one-Cursor PASS ≠ CP2-DB, Worker, MCP, or production authorization

## Explicit non-claims

- No same-UID / OS isolation sealing
- No real Owner private-key custody
- No live GitHub tip provenance
- No operational MCP mutation authorization
- No database authorization or durable jti/lease proof in this package
- No real Worker launch or OS identity issuance
- Process-local replay/revocation registries are **volatile** (not durable exactly-once)
- No operational dispatcher activation (`OPERATIONAL_DISPATCH_AUTHORIZED` remains false in persistence)
- No production readiness

## Related package

Persistence / disposable harness / hard-deny dispatcher offline contracts live in
`@titangold/tecp-ops-persistence` (see that package README). Live PostgreSQL remains separately gated and currently closed.

## Import safety

Importing this package creates no listeners, Workers, MCP registrations,
database clients, network sockets, or credential file access.
