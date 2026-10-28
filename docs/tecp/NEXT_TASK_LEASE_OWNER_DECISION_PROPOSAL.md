# TitanGold TECP — Next Owner Decision Proposal: Disposable Atomic WRITE Lease

**Date:** 2026-10-28  
**Class:** Governance **PROPOSAL / NOT_AUTHORIZED**; *not* a Rule02 authorization, numbered stage, implementation or merge approval.  
**Reviewed canonical baseline:** `74cda2ccf6926bf4155a941528fceded3054cc30` (TECP-020 formal closeout [PR #222](https://github.com/sepehrraeisi/TitanGold/pull/222)).  
**Current Rule02 gate:** `TECP_NEXT_DISPOSABLE_TASK_LEASE_PROOF_OWNER_DECISION / NOT_AUTHORIZED`.  
**Candidate capability identity:** `CAP-DURABLE-ATOMIC-LEASE-DISPOSABLE` (design-only; historical TECP-020 Conflict Pilot `CAP-PILOT-CONFLICT` remains deferred).

> **Mandatory first action on a future chat:** Re-read current Rule01 v4.7 and current canonical Rule02 on `main`, compare live SHA and review subsequent PRs. If authority changed, defer to the current Rule02. This proposal is not authorization to write code, run PostgreSQL or alter production.

## 1. Decision requested, NOT yet granted

Approve **in a later, separate Rule02 governance transaction**, one exact-scope Tier-3-provisional non-production proof that two independently connected clients cannot both acquire the same canonical **WRITE** resource lease, and that the former owner cannot renew/release the successor's lease.

This is a **disposable database evidence exercise**, *not* a Task Dispatcher, persistent production control plane, two-Cursor pilot, MCP expansion or background worker. Do not elevate a successful test to operational verification.

**Current owner outcome:** `PENDING / NOT_AUTHORIZED`. Preparation or merge of this proposal document does **not** answer the owner decision or create an active TECP implementation slice.

## 2. Evidence and why a new boundary is necessary

- [TECP-020 closeout PR #222](https://github.com/sepehrraeisi/TitanGold/pull/222) has merged at `74cda2ccf6926bf4155a941528fceded3054cc30`; owner SSH focused 109/109 and full 560/560 PASS (29 suites) on candidate `944866a52628f42a13cbcce3b8b6d487904ea567`; separate from GitHub CI.
- [Migration 056](../../backend/database/migrations/056_create_tecp_control_plane_foundation.sql) creates six `public.tecp_*` tables and was previously verified on a disposable DB; **production deployment of migration 056 was NO**. `tecp_leases` has `lease_key UNIQUE`, `heartbeat_at` and `version`, but **that alone does not guarantee exclusive ownership of a resource across different task leases**, or monotonic fencing after expiry. The canonical schema must not be silently altered.
- [TECP service config](../../tecp/src/config.js) strictly requires `persistence='none'`; [health](../../tecp/src/health.js) requires zero DB writes, worker starts and production runtime. [service skeleton tests](../../tecp/test/serviceSkeleton.test.js) prohibit DB/network imports and extra dependencies under `tecp/src`. Its package manifest pins only MCP SDK and zod.
- [Claim](../../tecp/src/resourceClaims.js), [conflict](../../tecp/src/conflictEngine.js), [lease](../../tecp/src/leaseEngine.js), [idempotency](../../tecp/src/idempotencyOps.js) and [recovery](../../tecp/src/recovery.js) are **in-memory value/decision contracts**, not real transaction enforcement.
- [MCP](../../tecp/src/mcpServer.js) exposes only `titan_tecp_ping` and `titan_tecp_manifest`; no claim, release, heartbeat or action tool exists.

## 3. Proposed **exact file allowlist** for a future separate implementation PR

The files below **do not exist as part of this proposal** and must be individually authorized *before* anyone creates them. This is the narrowest proposed test-only package boundary:

1. `tecp-persistence/package.json` — local, isolated Node package and single explicit PostgreSQL driver dependency.
2. `tecp-persistence/package-lock.json` — fully pinned dependency resolution; version/license/audit reviewed before authorization; never install dependencies during discovery.
3. `tecp-persistence/src/writeLeaseRepository.js` — deliberately narrow, injected DB-client repository implementing `acquireWriteLease`, `renewWriteLease`, `releaseWriteLease`, `validateWriteLease`. No exports of a generic SQL runner, no network listener and no integration into TECP main service.
4. `tecp-persistence/test/disposableSchema.sql` — **test-only** schema for a single canonical WRITE-resource owner row and monotonic fencing epoch, namespaced to a temporary test database. NOT a canonical production migration.
5. `tecp-persistence/test/writeLeaseRepository.test.js` — concurrency, denial, fencing, replay, rollback, outage and transaction tests.
6. `tecp-persistence/test/disposablePgHarness.js` — creates and removes a dedicated local ephemeral PostgreSQL instance/directory with no non-local DB URI and no secret output. If isolation cannot be established, hard **BLOCKED**, no fallback to a configured development or production database.

**No other paths permitted** in this suggested slice. In particular:
- **DO NOT TOUCH:** `tecp/src/**`, `tecp/test/**`, `tecp/package.json`, `tecp/package-lock.json`, `.cursor/mcp.json`, `backend/**` (including frozen migration 056), existing README/Rule01/Rule02 during the implementation code PR, `Data Hub`, `AI Shared Foundation`, `Agents Shell`, `Artemis Stage 11` or any production host/DB.
- Authorizing this candidate would require a **separate prior Rule02 governance PR**, with exact slice ID, risk, stop conditions, review and merged SHA. The candidate label alone is not a numbered slice.
- If a real migration 057 or audit/outbox is required, **STOP** and request a distinct authorized scope; do not silently widen this proof. A successful disposable proof cannot become production-ready without an independently approved canonical migration and audit design.

## 4. Proposed transaction / identity invariants (must become tests)

- **Atomic single-owner:** canonical `(resource_type, resource_key)` has at most one current WRITE owner. All contender acquisitions run under a DB transaction and a unique per-resource row; use DB row-level locks / conflict-safe insert, not a read-then-write race.
- **Stable fencing:** a durable monotonically increasing epoch is allocated **by the database** and never resets by deleting/recreating the resource row. All renew/release checks bind `resource`, trusted `actor_id`, `task_id`, `lease_key`, `expected_version`, `fencing_epoch` and `governance_revision` (CAS).
- **Stale actor deny:** an older epoch or foreign actor can neither renew nor release a replacement lease. Marked-expired or released owner never counts as a valid owner; no auto-transfer of dirty worktrees.
- **Database time:** TTL and expiry use database clock; no client wall clock permits expiry takeover. Precise TTL policy **requires owner sign-off** before operational promotion.
- **Idempotency:** retries with the same caller-bound idempotency key must return the original logical result, not create a second grant; reuse with different resource/actor/task binding is `DENY_CONFLICT`.
- **Governance:** no prompt-asserted worker identity; caller must supply trusted actor context and approved governance revision. Unknown/mismatched revision `DENY`.
- **Safe failure:** database disconnect / timeout / aborted transaction / competing acquire => no success without committed proof. Err on the side of DENY / BLOCKED and do not forge state.
- **Audit:** test-only proof is **NOT_OPERATIONAL** if it lacks immutable persisted audit, trusted authentication and production-grade authorization. This permission must not flow to any live Cursor tool.
- **Identity & secrecy:** no credentials, URLs or full SQL statements with sensitive values in reports. No external provider or internet APIs at runtime.

## 5. Acceptance / evidence matrix for a *future* authorized proof

| Scenario | Required result |
|---|---|
| Two simultaneous WRITE acquisitions of one resource | Exactly one grant; contender DENY/SERIALIZE |
| 10+ racing acquisitions on distinct DB connections | Never two valid owners; uncommitted loser leaves no partial state |
| Duplicate grant with same idempotency identity | One logical grant; deterministic replay |
| Same idempotency key rebound to different binding | DENY_CONFLICT; no state mutation |
| Foreign actor heartbeat/release | DENY; actual owner unaffected |
| Stale fencing epoch after expiry/re-grant | DENY; successor unaffected |
| Database transaction fails mid-acquire | ROLLBACK; no ghost owner |
| DB unavailable or isolation preflight fails | BLOCKED; no fake PASS |
| Invalidated governance revision | DENY, no grant or renewal |
| Dirty/crashed worktree | No automatic reassignment |
| Legacy TECP test suite | Existing full suite PASS with same source boundaries |
| Human QA | Owner reviews real disposable-DB transaction logs, exact tested SHA, QA scope, no Production |

**Completion classification:** local **disposable concurrent-transaction proof PASS**, not durable production readiness, not single-Cursor end-to-end, not multiworker coordination and not TECP-021+ completion.

## 6. Dependencies, risk and stop conditions

- **Provisional risk:** Tier 3, because DB connectivity / transactional writes / package install are involved. Owner and Rule01 must determine exact final tier and required negative tests. No Tier is granted in this document.
- **Build order if separately authorized:** exact-scope governance PR → owner-approved merge → isolated package and disposable-only harness → negative/race tests → frozen TECP regression → owner Human QA → closeout through separate governance PR. No deploy.
- **Blocked if:** trusted disposable DB identity not established; `pg` dependency unavailable; extra files required; frozen skeleton or migration 056 needs edits; isolation/atomicity cannot be proven; runtime/production endpoint is involved; Rule02 differs; any test fails; evidence is missing.
- **No runtime upgrade:** any need for a real Worker, multi-Cursor GUI, GitHub mutation by TECP, MCP action tools, production database or audit-backed operational control must trigger a **different owner-gated slice**, not scope creep.
- **After this proof, if authorized and PASS:** propose canonical migration, trustworthy audit/idempotency, then an authorized single-Cursor Task→Claim→Evidence→Release pilot; only after that a two-Cursor conflict pilot followed by 3→4→5 worker stress tests.

## 7. Owner decision register (not a progress counter)

`OWNER_DECISION = PENDING`  
`CURRENT_RULE02_GATE = TECP_NEXT_DISPOSABLE_TASK_LEASE_PROOF_OWNER_DECISION / NOT_AUTHORIZED`  
`IMPLEMENTATION_AUTHORIZED = NO`  
`DB_ACCESS_AUTHORIZED = NO`  
`MCP_EXPANSION_AUTHORIZED = NO`  
`MULTI_CURSOR_AUTHORIZED = NO`  
`PRODUCTION_MUTATION_AUTHORIZED = NO`  
`NEXT_ACTION = OWNER_REVIEW_OF_PROPOSED_EXACT_SCOPE_AND_RISK`

This document is **supporting evidence only**, not the canonical Rule02 status. The [living Handoff](CONTROL_PLANE_HANDOFF.md) and Rule02 remain the continuity entry points.

## 8. Resume instruction

> TitanGold TECP has completed TECP-020 read-only reconciliation in PR #222 at main `74cda2ccf6926bf4155a941528fceded3054cc30`. Inspect newer main/Rule02, then compare this proposed `CAP-DURABLE-ATOMIC-LEASE-DISPOSABLE` exact-scope decision packet. **No implementation or DB permission exists**. Next owner decision: authorize a separately governed, disposable PostgreSQL single WRITE lease/fencing transaction test, or reject/split it. Do not create code, migrations, tests, worktrees, install dependencies, start workers or access databases based only on this document.
