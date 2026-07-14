# Runtime Safety Rollback Procedure (Staging)

## Baselines

| Procedure | Restores tree to | Scope |
|-----------|------------------|-------|
| **A. Full work-package** | `d705bd2` | All commits from `878e92c` through current HEAD |
| **B. Later-phase only** | `09dc28b` | Commits from `133aecc` through current HEAD |

**First implementation commit:** `878e92c`  
**Current related HEAD:** see `git rev-parse HEAD` (update after each push)

## Complete Related Commit List (oldest → newest)

```
878e92c fix(auth): fail-closed identity resolution and capability model
beb3274 feat(agents): centralized execution policy and route authorization
00537a1 fix(worker): scheduler direct execution and cross-process kill switch
1f56ced feat(ui): agent safety banner and permission-aware routing UX
09dc28b docs: AI agent runtime safety closeout report
133aecc fix(runtime): close SSOT gaps and connect legacy risk-gate
712930a fix(auth): fail-closed routes and readiness runtime safety check
56501b5 test(runtime): unit and integration safety matrix (50 tests)
6ddadc4 feat(ui): header effective mode sync and backend capability contract
563e553 chore(devops): staging deployment verify, browser QA and closeout docs
23fdb3f fix(runtime): reject Redis cache that weakens kill switch vs PostgreSQL
24b97ce feat(ui): capability-aware execution gate on all 15 agent panels
e8b3de4 test(docs): pre-Human-QA evidence, route matrix, Redis and Playwright
c4723b9 docs(devops): complete rollback plan and staging access
7afbd48 test(qa): close pre-Human-QA verification gaps
(+ any newer remediation commits on main)
```

## Invalid Commands

```bash
git revert 7afbd48..878e92c     # WRONG — reversed range
git revert 563e553..133aecc     # WRONG — incomplete + reversed
```

## A. Full Work-Package Rollback → `d705bd2`

```bash
# Isolated worktree / disposable branch only
git revert --no-edit $(git rev-list --reverse d705bd2..HEAD | tac | tr '\n' ' ')
# Equivalent when HEAD includes full package:
# git revert --no-edit 878e92c^..HEAD   # use carefully — verify rev-list first
```

Expected:

- Working tree matches `d705bd2`
- Kill Switch in PostgreSQL remains active (never cleared during code rollback)
- Live remains disabled
- Rebuild frontend dist from restored tree
- `pm2 restart titan-backend titan-engine-worker`
- `./scripts/verify-staging-deployment.sh`

## B. Later-Phase-Only Rollback → `09dc28b`

```bash
git revert --no-edit $(git rev-list --reverse 09dc28b..HEAD | tac | tr '\n' ' ')
```

Expected:

- Working tree matches `09dc28b`
- Phase-1 auth/policy/worker commits remain
- Later Redis UI/evidence/tests reverted

## Automated Validation

```bash
node scripts/validate-rollback.mjs
# docs/evidence/rollback-validation.json must show pass:true for A and B
```

Validated results must show `0 files changed` vs the target base.

## Runtime State — DO NOT WEAKEN

1. Confirm PG `killSwitchActive=true` before and after
2. Never run kill-switch clear during rollback
3. Redis: restart services; optional `DEL titan:runtime:execution_state` only after PG verified
4. TRADING_ENGINE_ENABLED must remain false

## PM2 Order

```bash
pm2 restart titan-backend
pm2 restart titan-engine-worker
./scripts/verify-staging-deployment.sh
```

## Frontend Dist

```bash
npm run build
# Verify served bundle matches post-rollback HEAD
```
