# TitanGold / TECP — Living Handoff and Next-Gate Index

**Last verified:** 2026-10-28  
**Snapshot canonical main:** `74cda2ccf6926bf4155a941528fceded3054cc30`  
**Read first:** [Rule02](../../.cursor/rules/titangold-current-active-work.mdc) and Rule01 v4.7. **This handoff is NOT authority, NOT a second progress counter, and NOT an implementation approval.** The live Rule02 on current `main` overrides stale status here.

> How to recover from a lost chat: fetch `main`, read canonical Rule02 + Rule01, compare the live SHA with the snapshot above, then review this evidence index and its PR links. Never trust prior-chat authority or stale worktrees.

## Current verified state

| Item | Verified record | Do not infer |
|---|---|---|
| TECP-019 | CLOSED / FROZEN / VERIFIED after [PR #218](https://github.com/sepehrraeisi/TitanGold/pull/218) and formal [PR #219](https://github.com/sepehrraeisi/TitanGold/pull/219) | Previous implementation approval was CONSUMED / NON-ACTIVE |
| TECP-020 | `TECP-020-ROADMAP-AND-CAPABILITY-RECONCILIATION` formally **CLOSED / FROZEN / VERIFIED** by [PR #222](https://github.com/sepehrraeisi/TitanGold/pull/222), after read-only discovery [PR #220](https://github.com/sepehrraeisi/TitanGold/pull/220) | Discovery entitlement CONSUMED / NON-ACTIVE; `TECP020_IMPLEMENTATION_AUTHORIZED=NO` |
| Next owner gate | `TECP_NEXT_DISPOSABLE_TASK_LEASE_PROOF_OWNER_DECISION / NOT_AUTHORIZED` | Candidate is design-only; separate owner-approved governance required before any experiment |
| TECP-021+ | NOT_AUTHORIZED | No automatic next stage |
| Cursor MCP | Real local connection, ping/manifest and bounded Agent QA PASS | Not evidence of multi-agent, autonomous recovery or production service |
| Artemis | Independently at `PROJECT_PROGRESS=4/10`, Stage 11, `CURRENT_STAGE_PROGRESS=11/15` | Do not inflate from TECP progress |

**Latest verified main:** `74cda2ccf6926bf4155a941528fceded3054cc30` — [PR #222](https://github.com/sepehrraeisi/TitanGold/pull/222) merged; **Rule02 only**. PR #222 tested at head `944866a52628f42a13cbcce3b8b6d487904ea567`: **109/109 focused**, **560/560 full** (29 suites), exit codes 0, clean SSH worktree and exactly one changed Rule02 file. These are owner-provided terminal results, not independent GitHub CI. Prior PR #221 documentation merge: `36084a76d7a9b579f0753a1a7676be7239cab4ee`; PR #220 governance merge: `8dbee0f471e99361fc7fbd939972068ea81836f7`.

## Historical evidence milestones

- TECP-003 local service skeleton: [PR #173](https://github.com/sepehrraeisi/TitanGold/pull/173). It explicitly has no operational DB, provider network, scheduler or worker.
- TECP-004 database foundation: [PR #175](https://github.com/sepehrraeisi/TitanGold/pull/175). Migration `backend/database/migrations/056_create_tecp_control_plane_foundation.sql`: six `tecp_` tables. Rule02 records disposable DB apply/rollback/reapply PASS; **no production migration executed**.
- TECP-005–016: parser/governance/capability/graph/claims/conflict/lease/scope/audit/idempotency/recovery/evidence source code and unit contracts. See frozen section evidence in Rule02; no durable runtime should be assumed.
- TECP-017 local MCP: [PR #212](https://github.com/sepehrraeisi/TitanGold/pull/212). Exactly `titan_tecp_ping` and `titan_tecp_manifest`; stdio and read-only only.
- TECP-018 one-Cursor config: [PR #214](https://github.com/sepehrraeisi/TitanGold/pull/214), formal closeout [PR #215](https://github.com/sepehrraeisi/TitanGold/pull/215). Repo integration tests check config, **not** launching a real Agent.
- TECP-019 governance [PR #217](https://github.com/sepehrraeisi/TitanGold/pull/217), implementation [PR #218](https://github.com/sepehrraeisi/TitanGold/pull/218), formal closeout [PR #219](https://github.com/sepehrraeisi/TitanGold/pull/219). `governanceReadModel.js` is a presentation-only model, intentionally tied to TECP-019 and fail-closed for other slices.
- TECP-020 read-only governance [PR #220](https://github.com/sepehrraeisi/TitanGold/pull/220). This **does not** authorize the historical TECP-020 “Conflict Pilot”; future target `CAP-PILOT-CONFLICT` remains deferred.
- TECP-020 source-only reconciliation completed; formal closeout [PR #222](https://github.com/sepehrraeisi/TitanGold/pull/222), merged main `74cda2ccf6926bf4155a941528fceded3054cc30`. Owner SSH tests: **109/109 focused + 560/560 full PASS**. Current TECP implementation authority is **NO**.

## Cursor QA boundary (human evidence)

- The earlier stale worktree `/home/ubuntu/worktrees/titangold-tecp-019-readmodel` at `9187e2197a57d5bf9558783191be14c8cbcce403` gave unavailable tools / MCP `Connection closed -32000`. The precise root cause was not proven.
- Recovered isolated `/home/ubuntu/worktrees/titangold-cursor-recovery-qa` at `a699dbd72b9279acfd7341c2ee2cc8b322d00949`, with pre-existing verified MCP dependencies and **30/30** setup tests PASS; Cursor UI Connected.
- Actual Cursor smoke: ping PASS, manifest PASS, no retries/loop. Stability V2: focused tests **9/9 PASS**, 4 calls, 0 retries, 0 repeated preflights, 0 file changes. Does not prove long-running worker reliability.
- Never assume this detached QA worktree equals current `main`; verify SHA independently.

## TECP-020 gap and dependency matrix

| Area | Implemented/tested boundary | Not yet operationally verified |
|---|---|---|
| Task graph | `tecp/src/taskGraph.js` in-memory readiness/topological order | Durable dispatcher, task lifecycle and retries |
| Claims | `tecp/src/resourceClaims.js` in-memory validation | Atomic reservation between processes |
| Conflict | `tecp/src/conflictEngine.js` determinstic conflict verdict | Actual locking/serialization under two concurrent workers |
| Leases | `tecp/src/leaseEngine.js` value creation and release | Durable atomic lease, heartbeat expiry, stale owner fencing and recovery |
| Idempotency | `tecp/src/idempotencyOps.js` immutable comparison | Durable uniqueness and replay control |
| Audit / Evidence | `tecp/src/auditEvent.js`, `evidenceLedger.js` value models | Persisted immutable audit evidence and provenance |
| Recovery | `tecp/src/recovery.js` assessment model | Worker crash detection/real restart resolution |
| DB | Migration 056, six tables, disposable verification recorded | TECP repository adapter and production application. `tecp/src/config.js` requires `persistence='none'` |
| MCP | `tecp/src/mcpServer.js` two tested stdio tools | Safe, authorized Task/Claim/Release operations |
| Providers | `tecp/src/ports/githubPort.js`, `linearPort.js` fail-closed stubs | Real TECP provider authority and audit integration |

**Source-level blockers:** `tecp/src/config.js` forbids persistence, `tecp/src/health.js` expects zero DB writes and worker starts, and `tecp/package.json` only pins `@modelcontextprotocol/server@2.4.0` and `zod@4.6.7`. `tecp/test/serviceSkeleton.test.js` enforces the frozen no-network/no-DB boundary. Therefore adding `pg` or runtime writes directly is **not** a safe unreviewed modification. Migration 056 contains `heartbeat_at` and `version` but no dedicated `expires_at` / fencing epoch; actual design adequacy remains unproven.

## Approved direction — completion is NOT approved

- [x] TECP-019 closed; Rule02 updated via PR #219.
- [x] Bounded single-Cursor MCP recovery test PASS.
- [x] TECP-020 read-only discovery authorized via PR #220.
- [x] Source-only capability gap and key blockers identified.
- [x] TECP-020 owner-reviewed source-only reconciliation and formal closeout through PR #222; Rule02 gate moved.
- [ ] **CURRENT / NOT_AUTHORIZED:** owner decision for `CAP-DURABLE-ATOMIC-LEASE-DISPOSABLE` and a separate exact-scope governance proposal. No implementation permission, DB connection, code or runtime mutation.
- [ ] Prove concurrent Claim/Lease safety and restart/fencing in nonproduction; independent tests and Human QA.
- [ ] Add durable Evidence/Audit/Recovery/Idempotency under separate authorizations.
- [ ] Add a restricted action-capable MCP gateway only after separate owner decision.
- [ ] Verify single Cursor Task→Claim→Evidence→Release end-to-end.
- [ ] Verify *two* Cursor conflict pilot; only then expand **3 → 4 → 5** with crash/recovery tests.

### Candidate next slice: NOT_AUTHORIZED

**After PR #222:** this is the next *proposed* capability, not a numbered TECP-021 stage or an effective implementation slice. It requires a separate explicit owner decision, Rule02 authorization PR, exact file list, Tier-3-or-higher risk review, disposable PostgreSQL isolation and Human QA. The historical Conflict Pilot (`CAP-PILOT-CONFLICT`) remains deferred.

Proposed label `TECP-NEXT-DURABLE-TASK-LEASE-TRANSACTION` is **not** an approved numbered stage. Possible exact-scope candidates, to be reviewed before any governance authorization: **new** `tecp/src/ports/taskLeaseRepository.js` + **new** `tecp/test/taskLeaseRepository.test.js`. A real PostgreSQL driver may require explicit revisions of frozen `tecp/package.json`, `tecp/package-lock.json`, `tecp/test/serviceSkeleton.test.js` and `tecp/test/rule02Parser.test.js`, **or** an owner-approved separate persistence package. An additive new-numbered migration is conditional; frozen migration 056 must not be changed. No package change, DB connection, implementation or deployment now.

Future tests must cover competing claims, stale owner fencing, rollback, duplicate retries, idempotent release, schema transitions, exact file scope, full regression and owner Human QA. **Do not mistake this candidate for permission to implement.**

## Update protocol

1. Recheck current `main` and Rule02 at each return to the project.
2. After a meaningful separately approved gate, update this document with **verified PR link, exact SHAs, changed-file scope, tests/environment, owner QA, deploy classification and next gate**. Changes must be owner-authorized, not silent.
3. Keep Rule02 as the sole canonical progress/authorization source, per Rule01 §107. Never use this file to introduce a parallel progress counter.
4. Separate `MERGED`, `DEPLOYED`, `RUNTIME_VERIFIED`, per Rule01 §108. Do not fake a redeploy for documentation-only changes.
5. TECP-020 is closed and its discovery entitlement consumed. No new Task/Lease implementation, two-Cursor pilot, MCP tool, live/disposable DB connection, Production mutation or TECP-021+ action until a separate Rule02 authorization is explicitly owner-approved and effective.

## Resume prompt for another ChatGPT chat / Cursor

> Resume TitanGold TECP using `docs/tecp/CONTROL_PLANE_HANDOFF.md` as a historical evidence index only. First inspect current Rule01 v4.7 and current Rule02 on canonical GitHub `main`, then compare the live SHA against snapshot `74cda2ccf6926bf4155a941528fceded3054cc30`. [PR #222](https://github.com/sepehrraeisi/TitanGold/pull/222) merged; TECP-020 is CLOSED/FROZEN/VERIFIED, read-only entitlement CONSUMED/NON-ACTIVE, implementation NO. Current owner gate: `TECP_NEXT_DISPOSABLE_TASK_LEASE_PROOF_OWNER_DECISION / NOT_AUTHORIZED`. Candidate: an isolated disposable PostgreSQL atomic WRITE lease + fencing proof, design-only. Check newer PRs, verify source/test evidence, and obtain independent owner approval for any governance merge or implementation. Do not mutate code, Rule02, DB, MCP, production or multi-Cursor on the basis of this handoff. If current Rule02 differs, defer to live canonical authority.

**Snapshot status:** TECP-020 CLOSED / FROZEN / VERIFIED after PR #222; next Task/Lease disposable proof is NOT_AUTHORIZED. This document records evidence and decisions but never grants authority.
