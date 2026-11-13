# TECP Task Manager V1

Zero-cost, single-Cursor task queue for Owner-supervised engineering work.

## What this is

A usable Owner CLI that manages:

`CREATE → CLAIM → PREPARE → RUNNING ACK → SUBMIT EVIDENCE → VERIFY → OWNER ACCEPT/REJECT → NEXT`

- **Transport:** `SUPERVISED_MANUAL_CURSOR_HANDOFF_V1` (Owner pastes an instruction packet into an existing Cursor chat)
- **Storage:** local atomic JSON files under an Owner-owned absolute data directory
- **Process model:** one active manager process (exclusive lock). No multi-process correctness claim.
- **TECP reuse:** import-only vocabulary/contracts from frozen `tecp/src` (`taskGraph`, `resourceClaims`, `conflictEngine`, `leaseEngine`, `evidenceLedger`, `auditEvent`, `idempotencyOps`, `recovery`, `actorCapabilityEngine`)

## What this is not

- Not production TECP authorization, fencing, or PostgreSQL durability
- Not Worker launch, MCP mutation, or operational dispatcher activation
- Not automatic Cursor execution
- Not a second incompatible task system
- Not authenticated Owner identity (local CLI accept/reject is same-UID acknowledgement only)
- Not proof that a verified task is merged or production-deployed

## Setup

```bash
# From repository root
cd tecp-task-manager
export TECP_TASK_MANAGER_DATA_DIR="$HOME/.local/share/tecp-task-manager-v1"
mkdir -p "$TECP_TASK_MANAGER_DATA_DIR"
chmod 700 "$TECP_TASK_MANAGER_DATA_DIR"
```

Do **not** store runtime data inside the git worktree. Do not commit queue state.

## CLI examples

```bash
node src/cli.js create \
  --task-id docs-refresh-1 \
  --owner owner-1 \
  --repo sepehrraeisi/TitanGold \
  --base-sha "$(git -C .. rev-parse HEAD)" \
  --goal "Refresh offline package docs only" \
  --allow tecp-ops/README.md

node src/cli.js claim --task-id docs-refresh-1 --actor cursor-1
node src/cli.js prepare --task-id docs-refresh-1 --actor cursor-1
# Paste the printed instruction packet into the existing Cursor chat.
node src/cli.js start --task-id docs-refresh-1 --actor cursor-1
node src/cli.js submit --task-id docs-refresh-1 --actor cursor-1 --pr 300 --head-sha <head>
node src/cli.js verify --task-id docs-refresh-1
node src/cli.js accept --task-id docs-refresh-1 --actor owner-1
node src/cli.js next
node src/cli.js status
node src/cli.js recover --task-id docs-refresh-1 --reason MANUAL
```

Add `--json` for machine-readable output.

## Evidence verification

`verify` queries authoritative GitHub metadata via allowlisted `gh` (or an injected reader in tests):

- repository identity
- PR number/state
- exact HEAD SHA and base SHA (base must match the task baseline)
- **complete** changed-file list via paginated `gh api .../pulls/{n}/files` (not truncated `pr view --json files`)
- changed files must be a non-empty subset of the task allowlist

Caller-supplied `success: true` is ignored. If GitHub is unavailable, or the file list is partial/incomplete, result is `BLOCKED` / fail — **never PASS**.

Verification ≠ Owner accept ≠ merged ≠ production deployed.

## Storage durability (honest limits)

- Writes use temp file → `fsync` → atomic `rename` → directory `fsync` (best effort).
- A crash between task-file write and index update leaves an **orphan** task file. On restart, the store reconciles the orphan into the index **only** when the JSON is valid and `task.taskId` matches the filename. Mismatched orphans and index entries without files **fail closed**. Orphans are never silently overwritten.
- `task.auditTrail` inside the task file is the authoritative audit record. `events.jsonl` is supplemental; an append failure after a successful task write is surfaced as an error.
- `fsync` reduces loss windows but does **not** guarantee power-loss durability on every filesystem, mount option, cloud disk, or VM host. This is not a PostgreSQL WAL claim.

## Recovery rules

- Expired **CLAIMED/PREPARED** → `RECOVERY_REQUIRED` (safe Owner review before re-claim)
- Expired **RUNNING** → `UNCERTAIN_RUNNING` (never silently reassigned; work may still be running)
- Corrupt store / unprovable orphan → DENY (no silent empty re-init)

## Tests

```bash
cd tecp-task-manager
npm test
```

Automated tests use disposable temp directories and inert GitHub fixtures. They do **not** claim a real GitHub-backed engineering acceptance has completed.

## Package layout

Authorized V1 paths only:

- `package.json`, `README.md`
- `src/taskRecord.js`, `fileQueueStore.js`, `claimLease.js`, `instructionPacket.js`, `evidenceVerifier.js`, `taskManager.js`, `cli.js`
- `test/taskManager.acceptance.test.js`, `test/fileQueueStore.test.js`
