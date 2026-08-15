# ARTEMIS B10 — Append-Only / Versioned Artemis Decision Persistence Discovery

**Discovery:** COMPLETE
**Architecture:** OWNER APPROVED — OPTION C
**Implementation:** SOURCE COMPLETE / OWNER FINAL CODE REVIEW PASSED
**Implementation commit/push:** OWNER AUTHORIZED
**Migration source:** AUTHORED + DISPOSABLE VERIFIED
**Live migration:** NOT AUTHORIZED / NOT EXECUTED
**Runtime wiring:** NOT AUTHORIZED / NOT ACTIVE
**PR:** NOT AUTHORIZED / NOT CREATED
**Shadow / WP-D / Paper / Live:** NOT STARTED

**Canonical product main:** `origin/main` = `6e89475b05f2bbd52669b845cb8e4d4b41ab7407`
**Discovery branch / head:** `feat/artemis-b10-persistence-discovery` @ `1f762aecde75bcad08ba5c56e957cd1d5a496f59`
**Discovery worktree:** `/home/ubuntu/worktrees/titangold-artemis-b10-discovery`
**Implementation branch:** `feat/artemis-b10-persistence`
**Implementation worktree:** `/home/ubuntu/worktrees/titangold-artemis-b10-implementation`

**Preserved freezes:** WP-C.1 / WP-C.2 / WP-B.1 / Data Hub / Trend / Arbitrage

Classification legend used below:

- **PROVEN BY SOURCE**
- **PROVEN BY LIVE SCHEMA**
- **INFERRED**
- **PROPOSED**
- **UNKNOWN**

---

## 1. Purpose and hard boundaries

### 1.1 Purpose

Design the durable persistence foundation for:

- canonical ArtemisDecision (`artemis-decision-1.0.0`)
- Decision-safe evidence references
- durable decision context
- append-only history
- version provenance
- future Shadow auditability prerequisite

### 1.2 Hard non-goals (locked for this Discovery)

B10 Discovery does **not**:

- activate Shadow / Paper / Live
- activate runtime orchestration
- change C.1 / C.2 contracts or synthesis policy
- authorize execution
- start WP-D
- integrate Risk / Portfolio / Liquidity / Order
- remediate Sentiment
- execute any migration or mutate DB data

---

## 2. Repository persistence inventory

| Concern | Path / finding | Class |
|---|---|---|
| Env / config | `backend/.env.example`, `backend/config/schema.js`, `backend/config/{dev,staging,production}.js` — `DATABASE_URL` preferred; also `DB_HOST/PORT/NAME/USER/PASSWORD`, pool vars | PROVEN BY SOURCE |
| Pool owner | `backend/database/db.js` — `pg.Pool`; exports `query`, `transaction`, `getClient`, `shutdownPool` | PROVEN BY SOURCE |
| Migration tool | `node-pg-migrate` via `backend/database/migrate.js` + `backend/package.json` scripts | PROVEN BY SOURCE |
| Tracking table | `pgmigrations` | PROVEN BY SOURCE / LIVE SCHEMA |
| Canonical migrations dir | `backend/database/migrations/` (~59 files; runner hardcodes this dir + `--no-check-order`) | PROVEN BY SOURCE |
| Secondary migration dirs | `backend/migrations/` (~9), root `database/migrations/` (~6) — not the migrate.js authority | PROVEN BY SOURCE |
| Bootstrap SQL | `database/schema.sql` (includes `ai_decisions`, `artemis_state`, `system_logs`) | PROVEN BY SOURCE |
| ORM / query builder | **None** — raw parameterized SQL | PROVEN BY SOURCE |
| Repository/DAO layer | **No** `models/` / `repositories/` / `dao/` — services/routes call `query()` | PROVEN BY SOURCE |
| Transaction helper | `backend/database/db.js` → `transaction(callback)` (`BEGIN`/`COMMIT`/`ROLLBACK`) | PROVEN BY SOURCE |
| DB error normalization | No central PG normalizer; local `23505`/`23503` handling + auth fail-closed | PROVEN BY SOURCE |
| Test harness | No dedicated test-DB factory; integration tests use live `DATABASE_URL` with rollback; unit tests mock `query` | PROVEN BY SOURCE |
| Config mismatch note | `.migration-config.json` says `dir: migrations` + `checkOrder: true`, but `migrate.js` uses `database/migrations` + `--no-check-order` | PROVEN BY SOURCE |

---

## 3. Live database truth (read-only metadata)

| Item | Value | Class |
|---|---|---|
| Engine | PostgreSQL **14.23** (Ubuntu) | PROVEN BY LIVE SCHEMA |
| Database | `titangold_db` | PROVEN BY LIVE SCHEMA |
| Inspecting role | `postgres` (UPDATE/DELETE privileges present on `ai_decisions`) | PROVEN BY LIVE SCHEMA |
| Artemis Decision tables present | `artemis_decisions` / `artemis_decision_evidence_refs` / `artemis_decision_contexts` = **NULL** | PROVEN BY LIVE SCHEMA |
| Health | root HTTP 200 · `/api/v1/health` 200 `status=ok` | PROVEN BY LIVE SCHEMA (HTTP) |
| `TITAN_RUNTIME_COMMIT` | `48d7722b651e1d551bbbf128eaa30e1b1c136163` | PROVEN BY LIVE SCHEMA (env/health) |
| C.2 Runtime Wired | **NO** | PROVEN BY SOURCE (runtime tree search) |
| C.2 Runtime Active | **NO** | PROVEN BY SOURCE / INFERRED from unwired + unchanged runtimeCommit |

Inspection method: `information_schema` / `pg_catalog` / `pg_stat_user_tables` / bounded `MIN/MAX(created_at)` only. No business-row dumps. No mutations.

---

## 4. `ai_decisions` — exact truth

### 4.1 Existence

| Check | Result | Class |
|---|---|---|
| In source bootstrap | YES — `database/schema.sql` | PROVEN BY SOURCE |
| In migrations | YES — partition recreate `006_partition_ai_decisions.sql`; later indexes/archive/version alters | PROVEN BY SOURCE |
| In live DB | YES — partitioned parent `public.ai_decisions` | PROVEN BY LIVE SCHEMA |

### 4.2 Live schema summary

| Column | Type | Null | Default | Class |
|---|---|---|---|---|
| `id` | uuid | NO | `uuid_generate_v4()` | PROVEN BY LIVE SCHEMA |
| `agent_id` | uuid | YES | — | PROVEN BY LIVE SCHEMA |
| `user_id` | uuid | YES | — | PROVEN BY LIVE SCHEMA |
| `decision_type` | varchar | YES | — | PROVEN BY LIVE SCHEMA |
| `input_data` | jsonb | YES | — | PROVEN BY LIVE SCHEMA |
| `output_data` | jsonb | YES | — | PROVEN BY LIVE SCHEMA |
| `confidence` | numeric | YES | — | PROVEN BY LIVE SCHEMA |
| `was_successful` | boolean | YES | — | PROVEN BY LIVE SCHEMA |
| `execution_time_ms` | integer | YES | — | PROVEN BY LIVE SCHEMA |
| `created_at` | timestamptz | NO | `now()` | PROVEN BY LIVE SCHEMA |
| `metadata` | jsonb | YES | `'{}'` | PROVEN BY LIVE SCHEMA |
| `agent_version` | varchar(20) | YES | — | PROVEN BY LIVE SCHEMA |

| Constraint / index | Detail | Class |
|---|---|---|
| PK | `PRIMARY KEY (id, created_at)` on partitioned parent | PROVEN BY LIVE SCHEMA |
| Live FKs on current parent | **None** observed on live `ai_decisions` (legacy FKs remain on `ai_decisions_old` / `ai_learning_events`) | PROVEN BY LIVE SCHEMA |
| Indexes | btree on agent/user/type/version/success; GIN on `input_data`/`output_data`/`metadata` | PROVEN BY LIVE SCHEMA |
| Est. rows (sum of partitions) | **4944** | PROVEN BY LIVE SCHEMA |
| Size (sum of partitions) | total ~**80 MB** · table ~**16 MB** · indexes ~**40 MB** | PROVEN BY LIVE SCHEMA |
| Timestamp range (cheap MIN/MAX) | `2026-02-10` → `2026-08-15` | PROVEN BY LIVE SCHEMA |

### 4.3 Writers / readers / semantics

| Role | Paths (representative) | Class |
|---|---|---|
| Writers (INSERT) | `backend/routes/ai-agents.js`, `backend/services/agentExecutionService.js`, `trendRunService.js`, `arbitrageRunService.js`, `risk-gate.js`, GraphQL resolvers | PROVEN BY SOURCE |
| Mutations after insert | rare `UPDATE agent_version` (`agents/registry.js`); admin/archive **DELETE**/move paths | PROVEN BY SOURCE |
| Readers | Agent history routes, analytics/exports, Artemis readiness/on-read evidence, GraphQL | PROVEN BY SOURCE |
| Artemis Decision write path | **Does not INSERT ArtemisDecision into `ai_decisions`** | PROVEN BY SOURCE |
| Artemis advisory log | `backend/routes/artemis.js` `logDecision` → **`system_logs`** (`category='artemis_decision'`) | PROVEN BY SOURCE |

### 4.4 Semantic classification

**KEEP AS AGENT-RUN SOT**

Rationale (PROVEN / PROPOSED):

- Schema is Agent-run oriented (`agent_id`, `input_data`/`output_data`, `confidence`, `was_successful`) — not ArtemisDecision envelope.
- Partitioned + heavily indexed for Agent history.
- Many Agent writers/readers depend on it.
- Artemis already uses a different advisory log (`system_logs`) and frozen C.1/C.2 contracts are in-memory only.
- Reusing it would mix Agent-run SoT with Artemis Decision SoT → **UNSAFE** without Owner-approved semantic rewrite.

**Default lock proposal:** new Artemis-specific tables. Do **not** repurpose `ai_decisions`.

---

## 5. Related tables / history surfaces

| Table | Role | Class |
|---|---|---|
| `ai_agents` | Agent registry identity | PROVEN BY LIVE SCHEMA / SOURCE |
| `ai_decisions_archive*` + stats | Cold archive for Agent runs | PROVEN BY LIVE SCHEMA / SOURCE |
| `ai_learning_events` | Learning events; FK historically to `ai_decisions_old` | PROVEN BY LIVE SCHEMA |
| `artemis_state` | Artemis status/mode/config/autopilot counters — **not** Decision lineage | PROVEN BY LIVE SCHEMA / SOURCE |
| `system_logs` | Operational / advisory logs including `artemis_decision` category; retention-oriented | PROVEN BY LIVE SCHEMA / SOURCE |
| `pgmigrations` | Migration ledger | PROVEN BY LIVE SCHEMA |

### 5.1 `system_logs` boundary (architecture lock)

**`system_logs` MUST NOT become Artemis durable Decision SoT.**

It lacks Decision identity/version/evidence-ref integrity, is retention/ops oriented, and is already used as unstructured advisory logging. B10 requires dedicated durable Decision persistence.

---

## 6. Frozen C.1 / C.2 persistence readiness

| Item | Truth | Class |
|---|---|---|
| Canonical Decision contract | `backend/contracts/artemisDecisionContract.js` · `artemis-decision-1.0.0` / schema `1.0.0` | PROVEN BY SOURCE |
| Max Decision UTF-8 | **16 KiB** (`MAX_DECISION_UTF8_BYTES`) | PROVEN BY SOURCE |
| Max evidence refs | **32** | PROVEN BY SOURCE |
| C.1 persistence table | **NO** | PROVEN BY LIVE SCHEMA / SOURCE |
| C.2 persistence table | **NO** | PROVEN BY LIVE SCHEMA / SOURCE |
| Artemis current DB writes of canonical Decision | **NO** | PROVEN BY SOURCE |
| Projection helper | `projectSynthesisToArtemisDecision()` builds advisory Decision; forces unavailable Risk/Allocation/Liquidity/Runtime; `decisionEligible=false`, `executionEligible=false`, `ADVISORY_ONLY` | PROVEN BY SOURCE |

B10 must persist these unavailable/false eligibility states **truthfully** and must **not** upgrade them.

---

## 7. Versioning model (A / B / C)

| Concept | Meaning | Existing fields | Class |
|---|---|---|---|
| A. Schema/contract version | Envelope identity | `schemaVersion`, `contractVersion` | PROVEN BY SOURCE |
| B. Policy/implementation version | Synthesis/policy code lineage | `policyVersion`, `implementationVersion` | PROVEN BY SOURCE |
| C. Durable decision revision chain | Supersession / sequence across re-evaluations | **Not present** today | PROVEN BY SOURCE |

### 7.1 Recommendation (PROPOSED)

- Every persisted Decision gets a new immutable `decisionId`.
- `decisionContextId` groups related evaluations for the same context.
- Do **not** invent `revision` / `supersedesDecisionId` in v1 unless Owner requires explicit correction chains.
- If a correction/re-evaluation is needed: insert a **new** Decision under the same or new context; never UPDATE the old row.
- Optional later additive fields (`parentDecisionId`) can be introduced in a future contract version without rewriting history.

---

## 8. Architecture options

Scoring axes (1–5; higher = better): semantic isolation · append-only integrity · queryability · auditability · Shadow readiness · replay readiness · migration risk (higher=safer/lower risk) · runtime coupling (higher=less coupling) · complexity (higher=simpler) · schema compatibility.

### OPTION A — Reuse/extend `ai_decisions`

| Axis scores (approx) | Weak |
|---|---|
| Isolation 1 · Append-only 1 · Query 3 · Audit 2 · Shadow 2 · Replay 2 · Mig risk 1 · Coupling 1 · Complexity 3 · Compat 2 |

**Verdict:** REJECT for Artemis Decision SoT. Keep as Agent-run SoT only.

### OPTION B — Dedicated `artemis_decisions` with evidenceRefs only inside JSONB

| Axis | Strong on isolation/append/audit; weaker on evidence queryability |
|---|---|
| Isolation 5 · Append 5 · Query 2 · Audit 4 · Shadow 4 · Replay 4 · Mig 5 · Coupling 5 · Complexity 4 · Compat 5 |

**Verdict:** Acceptable minimal viable; evidence querying harder.

### OPTION C — Dedicated Decision + normalized evidence-ref child rows

| Axis | Best balance for audit + query without premature context table |
|---|---|
| Isolation 5 · Append 5 · Query 4 · Audit 5 · Shadow 5 · Replay 5 · Mig 4 · Coupling 5 · Complexity 3 · Compat 5 |

**Verdict:** **RECOMMENDED** for B10 v1.

### OPTION D — Decision + context table + normalized evidence refs

| Axis | More modeling power; higher complexity before Shadow needs proven |
|---|---|
| Isolation 5 · Append 5 · Query 5 · Audit 5 · Shadow 5 · Replay 5 · Mig 3 · Coupling 5 · Complexity 2 · Compat 5 |

**Verdict:** Defer context table unless Owner requires first-class context rows now. Context can start as immutable columns + JSON fields on Decision.

### Recommended option

**OPTION C** — dedicated `artemis_decisions` + `artemis_decision_evidence_refs`, with **canonical Decision JSONB** as SoT and normalized evidence-ref rows as queryable projections.

---

## 9. Proposed table design (NOT CREATED)

### 9.1 `artemis_decisions` (PROPOSED)

| Column | Type | Null | Notes |
|---|---|---|---|
| `decision_id` | UUID | NO | PK; equals canonical `decisionId` |
| `decision_context_id` | UUID | NO | indexed |
| `schema_version` | TEXT | NO | |
| `contract_version` | TEXT | NO | |
| `policy_version` | TEXT | YES | |
| `implementation_version` | TEXT | YES | |
| `created_at` | TIMESTAMPTZ | NO | from Decision |
| `analysis_at` | TIMESTAMPTZ | NO | |
| `expires_at` | TIMESTAMPTZ | YES | |
| `symbol` | TEXT | YES | projection |
| `venue` | TEXT | YES | |
| `market_type` | TEXT | YES | |
| `timeframe` | TEXT | YES | |
| `analysis_horizon` | TEXT | YES | |
| `synthesis_outcome` | TEXT | NO | projection |
| `observed_direction` | TEXT | YES | |
| `conflict_state` | TEXT | YES | |
| `classification` | TEXT | NO | expect `ADVISORY_ONLY` |
| `maturity_stage` | TEXT | NO | |
| `decision_eligible` | BOOLEAN | NO | must remain false for current maturity |
| `execution_eligible` | BOOLEAN | NO | must remain false |
| `decision_payload` | JSONB | NO | **exact validated canonical Decision** |
| `payload_sha256` | CHAR(64) | NO | integrity over canonical serialization |
| `payload_bytes` | INTEGER | NO | UTF-8 size ≤ 16384 |
| `persisted_at` | TIMESTAMPTZ | NO | DEFAULT `now()` |
| `writer` | TEXT | NO | service/version key |

Constraints (PROPOSED):

- PK(`decision_id`)
- UNIQUE(`decision_id`) redundant with PK
- CHECK `payload_bytes > 0 AND payload_bytes <= 16384`
- CHECK `decision_eligible = false` and `execution_eligible = false` for initial B10 policy **or** enforce in writer (prefer writer+validator; avoid hardcoding forever if future stages change under Owner approval)
- No FK to `ai_decisions` / `ai_agents` in v1 (identity compatibility not proven for Decision refs as FK targets under partition PK `(id, created_at)`)

### 9.2 `artemis_decision_evidence_refs` (PROPOSED)

| Column | Type | Null | Notes |
|---|---|---|---|
| `decision_id` | UUID | NO | FK → `artemis_decisions(decision_id)` ON DELETE RESTRICT |
| `ordinal` | INTEGER | NO | 0..N-1 stable order |
| `agent_id` | TEXT | NO | canonical Agent id string |
| `run_id` | UUID | YES | |
| `agent_record_id` | UUID | YES | |
| `evidence_contract_version` | TEXT | NO | |
| `role` | TEXT | YES | |
| `authority_class` | TEXT | YES | |
| `correlation_family` | TEXT | YES | |
| `freshness` | TEXT | YES | |
| `availability` | TEXT | YES | |
| `admission_state` | TEXT | YES | |
| `admission_reason` | TEXT | YES | |
| `confirmation_semantics` | TEXT | YES | |
| `symbol` | TEXT | YES | |
| `venue` | TEXT | YES | |
| `market_type` | TEXT | YES | |
| `timeframe` | TEXT | YES | |
| `analysis_horizon` | TEXT | YES | |
| `analysis_timestamp` | TIMESTAMPTZ | YES | |
| `ref_payload` | JSONB | NO | exact Decision-safe ref object |

Constraints (PROPOSED):

- PK(`decision_id`, `ordinal`)
- CHECK `ordinal >= 0 AND ordinal < 32`
- UNIQUE optional (`decision_id`, `agent_id`, `run_id`) only if proven unique in contract; prefer not until proven
- FK RESTRICT (append-only parent must not be deleted by app)

### 9.3 Context table

**Defer** `artemis_decision_contexts` for v1 (**PROPOSED**).

Context identity for queries:

- `decision_context_id` plus projected symbol/venue/marketType/timeframe/horizon/sourceWindow fields inside payload.

Future Shadow replay can `WHERE decision_context_id = $1 ORDER BY created_at, persisted_at`.

---

## 10. Canonical payload + integrity

### 10.1 Payload strategy (PROPOSED)

- Persist **exact validated** ArtemisDecision as `decision_payload` JSONB.
- Normalized columns/child rows are **projections**, never authoritative alone.
- Future reads must return payload (optionally re-validated), not reconstruct from projections.

### 10.2 Payload hash (PROPOSED: YES)

- Store `payload_sha256` of a **canonical serialization**:
  - UTF-8 JSON with stable key order (deterministic stringify of the already-validated object, or JCS-like canonical JSON)
  - hash computed once at write after validation
- Reject write if recomputed hash ≠ stored when verifying duplicates.

Do not hash unstable `JSON.stringify` of arbitrarily ordered objects without a defined canonicalizer.

---

## 11. Append-only semantics (PROPOSED)

Principle: a persisted ArtemisDecision row is immutable.

- No normal application UPDATE/DELETE.
- Re-evaluation ⇒ new `decision_id` insert.
- Enforcement layers:
  1. **Required:** repository/service policy (no update/delete APIs)
  2. **Recommended soon after first migration:** DB privileges — app role without UPDATE/DELETE on B10 tables
  3. **Optional later:** trigger rejecting UPDATE/DELETE

Current DB role inspected (`postgres`) can UPDATE/DELETE everything — so privilege hardening is a future implementation concern, not available as default protection today (**PROVEN BY LIVE SCHEMA**).

---

## 12. Duplicate / idempotency (PROPOSED)

| Case | Behavior |
|---|---|
| Same `decision_id` inserted twice with **identical** `payload_sha256` | Deterministic **ALREADY_PERSISTED** success/idempotent return of existing (no overwrite) |
| Same `decision_id` with **different** hash | **FAIL** conflict — never overwrite |
| Same `decision_context_id` with multiple decisions | **Allowed** (history) |
| Same evidence ref repeated inside one Decision | Rejected by C.1 validator before write |
| Same `agentId+runId` across different decisions | **Allowed** (refs are not globally unique) |

Never silent overwrite.

---

## 13. Transaction boundary (PROPOSED)

Use existing `transaction()` from `backend/database/db.js`:

1. validate Decision (`validateArtemisDecision`)
2. reject execution-authorizing / forbidden fields
3. BEGIN
4. INSERT `artemis_decisions`
5. INSERT N evidence-ref rows with ordinals
6. COMMIT
7. on any failure ROLLBACK — no partial Decision

Future service/repo boundaries should follow project convention (services + `query`/`transaction`), e.g.:

- `backend/services/artemisDecisionPersistenceService.js` (**PROPOSED name**)
- optional thin SQL module — only if team prefers; no new ORM

---

## 14. Read path / history (minimum)

| Read | Purpose |
|---|---|
| by `decision_id` | exact Decision + refs |
| by `decision_context_id` ordered by time | context history / future Shadow |
| recent by `symbol` + time | audit listing |
| evidence refs by `decision_id` | lineage display |
| optional by `agent_id`/`run_id` | “where used” lookup |

WP-D owns replay/evaluation/backtesting engines; B10 only stores durable inputs/outputs.

### Read-time validation (PROPOSED)

- Default: call `validateArtemisDecision` (version-aware) before treating payload as canonical for new consumers.
- Historical versions: validate with matching contract version module; **no silent coercion**.
- If validator unavailable for ancient version: return payload with explicit `validationStatus=UNAVAILABLE_FOR_VERSION` rather than mutating.

---

## 15. Index plan (minimal; PROPOSED)

`artemis_decisions`:

- PK `decision_id`
- btree `(decision_context_id, created_at DESC)`
- btree `(symbol, created_at DESC)` where symbol not null
- btree `(synthesis_outcome, created_at DESC)` only if listing by outcome is proven needed — else defer

`artemis_decision_evidence_refs`:

- PK `(decision_id, ordinal)`
- btree `(agent_id, run_id)`
- btree `(run_id)` optional if run lookups dominate

Avoid excessive indexes given historical Postgres load issues. New empty tables ⇒ ordinary `CREATE INDEX` inside migration transaction is acceptable initially (**PROPOSED**). `CREATE INDEX CONCURRENTLY` **not required** for empty new tables.

---

## 16. Migration safety plan (future only — NOT EXECUTED)

| Topic | Plan | Class |
|---|---|---|
| Files | One (or two) SQL migration(s) under `backend/database/migrations/` via `node-pg-migrate` | PROPOSED |
| Lock level | `CREATE TABLE` / indexes on empty tables — low; brief AccessExclusive on new objects only | PROPOSED / INFERRED |
| Table rewrite | None expected | PROPOSED |
| Downtime | Near-zero if no heavy locks on hot tables | PROPOSED |
| CONCURRENTLY | **NO** for empty new tables | PROPOSED |
| Rollback philosophy | **Do not auto DROP production tables.** Disable writer / feature flag. Preserve append-only records. DROP/cleanup = **DESTRUCTIVE — OWNER AUTHORIZATION REQUIRED** | PROPOSED |

---

## 17. Backup / retention / security

| Topic | Finding / recommendation | Class |
|---|---|---|
| Backup compatibility | Existing `scripts/backup-db.sh` uses `pg_dump` of `titangold_db` — **new public tables would be included naturally** | PROVEN BY SOURCE (script pattern) → **YES** |
| Retention | No automatic purge for B10. Agent `system_logs` retention must not be copied. **NO AUTOMATIC RETENTION / PURGE** | PROPOSED |
| Secrets | Reuse frozen validators; reject secret-like keys; no provider raw payloads; bound 16 KiB Decision + ≤32 refs | PROVEN BY SOURCE / PROPOSED |
| Storage upper bound | Decision ≤16 KiB + ≤32 refs (each bounded by Decision-safe validator) + row overhead — keep small | PROVEN BY SOURCE / PROPOSED |

---

## 18. Schema evolution (PROPOSED)

- Do not rewrite historical payloads in place.
- New contract versions produce new records.
- Readers are version-aware.
- Additive nullable projection columns allowed; breaking changes require new contractVersion + dual-read window under Owner approval.

---

## 19. Shadow boundary

| Item | State |
|---|---|
| B10 | persistence prerequisite only |
| Shadow | **NOT STARTED** / NOT AUTHORIZED by this Discovery |
| Paper / Live | **NOT STARTED** |
| WP-D | **NOT STARTED** |

Server library presence of C.1/C.2 ≠ runtime activation. B10 tables (future) ≠ Shadow.

---

## 20. Proposed Owner architecture locks

Pending Owner approval:

1. **Table strategy:** OPTION C — dedicated Decision + normalized evidence refs
2. **`ai_decisions` reuse:** **NO** (KEEP AS AGENT-RUN SOT)
3. **Decision payload:** exact validated JSONB SoT
4. **Evidence refs:** JSONB parent array preserved in payload + normalized child rows with ordinal
5. **Context model:** `decision_context_id` on Decision; defer context table
6. **Append-only enforcement:** service policy required; DB privilege hardening recommended; triggers optional later
7. **Duplicates:** identical hash → ALREADY_PERSISTED; different hash → FAIL; never overwrite
8. **Revision model:** new `decisionId` per immutable record; no v1 supersession chain required
9. **Transaction:** atomic Decision + refs via existing `transaction()`
10. **Indexes:** minimal set in §15
11. **Read validation:** version-aware `validateArtemisDecision`; no silent coercion
12. **Schema evolution:** immutable history; new versions = new rows
13. **Retention:** no automatic purge
14. **Rollback:** disable writer; DROP destructive + Owner-gated
15. **Shadow boundary:** B10 ≠ Shadow activation

---

## 21. Three-state ledger (Discovery)

| State | Value |
|---|---|
| GitHub Source | B10 discovery branch from `6e89475…` |
| Server Content | **UNCHANGED** by this Discovery |
| Runtime Active | **UNCHANGED** · `TITAN_RUNTIME_COMMIT=48d7722…` · C.2 Wired=NO · C.2 Active=NO |

---

## 22. Stop conditions for implementation

Implementation / migration may begin only after:

1. Owner approves the architecture locks in §20
2. Separate implementation authorization in Rule 02
3. Explicit migration authorization

Until then: **NO CREATE TABLE / NO MIGRATE / NO RUNTIME WIRING**.

---

## 23. Implementation outcome (Owner-authorized source)

This section records the post-Discovery implementation source outcome. Discovery
findings and architecture history above remain authoritative for why OPTION C
was selected. This section does **not** claim live deployment, live migration,
production persistence, runtime activation, Shadow readiness, or WP-D start.

### 23.1 Final implementation / test paths

1. `backend/database/migrations/051_artemis_b10_decision_persistence.sql`
2. `backend/services/artemisDecisionCanonicalJson.js`
3. `backend/services/artemisDecisionPersistenceService.js`
4. `backend/__tests__/unit/artemisDecisionCanonicalJson.b10.test.js`
5. `backend/__tests__/unit/artemisDecisionPersistence.b10.test.js`
6. `backend/__tests__/integration/artemisDecisionPersistence.b10.integration.test.js`

Governance/docs accompanying the implementation commit:

7. `.cursor/rules/titangold-current-active-work.mdc`
8. `docs/ARTEMIS_B10_PERSISTENCE_DISCOVERY.md`

### 23.2 Architecture locks realized in source

| Item | State |
|---|---|
| Table strategy | OPTION C — dedicated `artemis_decisions` + `artemis_decision_evidence_refs` |
| Canonical SoT | `decision_payload` JSONB (exact validated ArtemisDecision) |
| Canonicalization | `titangold-json-c14n-1` |
| Append-only / idempotency | identical hash → ALREADY_PERSISTED; different hash → CONFLICT; never overwrite |
| Read-time integrity | re-canonicalize + SHA-256 + byte + projection verification |
| Evidence projection integrity | ordinal + `ref_payload` + normalized column comparison |
| UPDATE/DELETE persistence API | **NOT PROVIDED** |
| `ai_decisions` / `system_logs` writes | **NONE** |
| Context table | **DEFERRED / NOT CREATED** |
| Runtime wiring | **NOT AUTHORIZED / NOT ACTIVE** |

### 23.3 Final approved source SHA256

| Path | SHA256 |
|---|---|
| `051_artemis_b10_decision_persistence.sql` | `c78599b5de5f727a26eb31367ec74ffd1024445c269d30a7261689abc57b173d` |
| `artemisDecisionCanonicalJson.js` | `5841b2366e4ddb73c9dfbb3f6660566bb4ffa036a448ad1128ec2949d23b50fd` |
| `artemisDecisionPersistenceService.js` | `795f10e6cf9dbbfb05131265769bb73554b0c0e4f5a0dd155ec7bd7c82467b16` |
| `artemisDecisionCanonicalJson.b10.test.js` | `3e326288dbcc7fed4d30bbbe84fbcb9362a64fdeeb1b1dde91630e673a3e78f4` |
| `artemisDecisionPersistence.b10.test.js` | `f31ee260f608c9a16d5a7c51ebb510fbedeefcffa2972f01e511516ec25cf7ed` |
| `artemisDecisionPersistence.b10.integration.test.js` | `5ba9bfd0ff4f7309bd6cd6049442ebf9598dba8d1f99b997b3ce8777b109fff7` |

### 23.4 Verification evidence (Owner-reviewed)

| Check | Result |
|---|---|
| Focused unit | **56/56 PASS** (2 suites) |
| Disposable PG integration | **10/10 PASS** (1 suite) |
| Disposable migration 051 | **PASS** via actual `node-pg-migrate` |
| Disposable PostgreSQL | **15** |
| Live/production PostgreSQL | **14.23** (discovered earlier; migration compatibility **NOT EXECUTED / NOT PROVEN**) |
| Live migration | **NOT AUTHORIZED / NOT EXECUTED** |
| Pending live migration 050 | Must be reviewed before any future production **051** execution |
| PR | **NOT AUTHORIZED / NOT CREATED** |
| Shadow / WP-D / Paper / Live | **NOT STARTED** |

### 23.5 Three-state ledger (Implementation source stage)

| State | Value |
|---|---|
| GitHub Source | B10 implementation branch `feat/artemis-b10-persistence` (commit + push Owner-authorized) |
| Server Content | **UNCHANGED** |
| Runtime Active | **UNCHANGED / LEGACY / B10 unwired** |

**Next Owner gate:** PR review (separate). Live migration remains a separate
Owner gate after PostgreSQL 14.23 / `pgmigrations` / pending **050** assessment.
