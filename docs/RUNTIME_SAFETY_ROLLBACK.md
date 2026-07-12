# Runtime Safety Rollback Procedure (Staging)

## Work Package Commit Range

| Order | Commit | Subject |
|-------|--------|---------|
| 1 (oldest) | `133aecc` | fix(runtime): SSOT + risk-gate + worker kill switch |
| 2 | `712930a` | fix(auth): fail-closed + readiness |
| 3 | `56501b5` | test(runtime): safety matrix |
| 4 | `6ddadc4` | feat(ui): header + capabilities |
| 5 (newest) | `563e553` | chore(devops): verify + Playwright + docs |

**Base before work package:** `09dc28b`

## Invalid Command (Do Not Use)

```bash
git revert 563e553..133aecc   # WRONG — range syntax reverts unintended commits
```

## Valid Rollback (Newest First)

```bash
# In an isolated worktree or staging branch only — NOT on production without approval
git revert --no-edit 563e553 6ddadc4 56501b5 712930a 133aecc
git commit -m "revert: runtime safety work package (staging rollback test)"
```

Alternative single range (equivalent):

```bash
git revert --no-edit 133aecc^..563e553
```

## Runtime State — DO NOT WEAKEN SAFETY

Rollback of **code** must **not** clear Kill Switch or enable Live:

1. Before revert: confirm PG `global_execution_runtime.killSwitchActive = true`
2. After revert: run `ensureDefaultRuntimeState()` if service missing — defaults to demo + kill ON
3. **Never** run `clearKillSwitch` during rollback
4. Verify: `curl -H "Authorization: Bearer $TOKEN" http://127.0.0.1:5002/api/v1/settings/execution-runtime`

## Redis

- Redis cache may hold stale state after rollback
- Restart backend + worker after revert so PG authoritative state re-caches
- `redis-cli DEL titan:runtime:execution_state` only if PG verified first

## PM2 Restart Order

```bash
pm2 restart titan-backend
pm2 restart titan-engine-worker
./scripts/verify-staging-deployment.sh   # must exit 0
```

## Frontend Dist

```bash
npm run build
# Serve from /home/ubuntu/webapp/TitanGold/dist (current staging path)
```

## Validation (Isolated Worktree Test)

Validated in worktree without touching active staging DB:

```bash
git worktree add /tmp/titan-rollback-test 09dc28b
cd /tmp/titan-rollback-test && git cherry-pick 133aecc..563e553
# revert test...
git worktree remove /tmp/titan-rollback-test
```

## Post-Rollback Deployment Check

- Port 5002 listening
- `/api/v1/health` → 200
- `/api/v1/health/ready` → 200 with `runtime_safety.ok`
- Worker ack revision matches PG version
- Kill Switch remains **active**
