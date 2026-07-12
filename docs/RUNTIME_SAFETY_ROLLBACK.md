# Runtime Safety Rollback Procedure (Staging)

## Work Package Commit Range

**First work-package commit:** `878e92c` (auth fail-closed + capabilities)  
**Phase 1 closeout:** `09dc28b`  
**Phase 2 SSOT + tests:** `133aecc` … `563e553`  
**Phase 3 pre-Human-QA:** `23fdb3f`, `24b97ce`, `e8b3de4`  
**Newest related commit:** `e8b3de4`

| Order | Commit | Subject | Runtime/DB Effect |
|-------|--------|---------|-------------------|
| 1 | `878e92c` | fix(auth): fail-closed identity + capabilities | auth middleware |
| 2 | `beb3274` | feat(agents): execution policy + route auth | routes + policy |
| 3 | `00537a1` | fix(worker): scheduler + kill switch | worker/scheduler |
| 4 | `1f56ced` | feat(ui): safety banner + routing UX | frontend |
| 5 | `09dc28b` | docs: closeout report | docs only |
| 6 | `133aecc` | fix(runtime): SSOT + risk-gate + worker KS | **runtime SSOT + DB** |
| 7 | `712930a` | fix(auth): fail-closed routes + readiness | routes + health |
| 8 | `56501b5` | test(runtime): safety matrix (50 tests) | tests only |
| 9 | `6ddadc4` | feat(ui): header + capabilities contract | frontend |
| 10 | `563e553` | chore(devops): verify + Playwright + docs | scripts + docs |
| 11 | `23fdb3f` | fix(runtime): Redis cannot weaken kill switch | **Redis cache safety** |
| 12 | `24b97ce` | feat(ui): execution gate on 15 panels | frontend |
| 13 (newest) | `e8b3de4` | test(docs): evidence, route matrix, Redis PW | tests + docs |

**Base before work package:** `d705bd2` (parent of `878e92c`)  
**Safe revert target:** `09dc28b` (phase 1 only) or `d705bd2` (full revert)

## Invalid Command (Do Not Use)

```bash
git revert 563e553..133aecc   # WRONG — range syntax reverts unintended commits
git revert e8b3de4..878e92c   # WRONG — reversed range
```

## Valid Rollback (Newest → Oldest)

```bash
# Isolated worktree or disposable branch ONLY — NOT on active staging without approval
git revert --no-edit e8b3de4 24b97ce 23fdb3f 563e553 6ddadc4 56501b5 712930a 133aecc
```

Alternative single range (equivalent for phase 2+3):

```bash
git revert --no-edit 133aecc^..e8b3de4
```

Full work-package revert (includes phase 1):

```bash
git revert --no-edit e8b3de4 24b97ce 23fdb3f 563e553 6ddadc4 56501b5 712930a 133aecc 09dc28b 1f56ced 00537a1 beb3274 878e92c
```

## Runtime State — DO NOT WEAKEN SAFETY

Rollback of **code** must **not** clear Kill Switch or enable Live:

1. Before revert: confirm PG `global_execution_runtime.killSwitchActive = true`
2. After revert: if service missing, defaults remain demo + kill ON
3. **Never** run `clearKillSwitch` during rollback
4. Verify: `curl -H "Authorization: Bearer $TOKEN" http://127.0.0.1:5002/api/v1/settings/execution-runtime`

## Redis Cache Handling

- Redis may hold stale post-rollback values
- After revert: restart backend + worker so PG authoritative state re-caches
- Optional: `redis-cli DEL titan:runtime:execution_state` **only after PG verified**
- Invalid/stale Redis must not weaken kill switch (fixed in `23fdb3f`)

## PM2 Restart Order

```bash
pm2 restart titan-backend
pm2 restart titan-engine-worker
./scripts/verify-staging-deployment.sh   # must exit 0
```

## Frontend Dist Rollback

```bash
npm run build
# Serve from /home/ubuntu/webapp/TitanGold/dist (staging path)
# Verify bundle hash matches reverted commit
```

## Nginx Verification

```bash
curl -sS -o /dev/null -w "%{http_code}" http://127.0.0.1/api/v1/health
# Optional: NGINX_URL=https://staging.example ./scripts/verify-staging-deployment.sh
```

## Validation (Isolated Worktree)

Automated validation:

```bash
node scripts/validate-rollback.mjs
# Output: docs/evidence/rollback-validation.json
```

Manual equivalent:

```bash
git worktree add /tmp/titan-rollback-test 09dc28b
cd /tmp/titan-rollback-test
git cherry-pick 133aecc..e8b3de4
git revert --no-edit e8b3de4 24b97ce 23fdb3f 563e553 6ddadc4 56501b5 712930a 133aecc
npm run build   # verify project builds
git worktree remove /tmp/titan-rollback-test
```

## Post-Rollback Deployment Check

- Port 5002 listening (both cluster instances if applicable)
- `/api/v1/health` → 200
- `/api/v1/health/ready` → 200 with `runtime_safety.ok`
- Worker ack revision matches PG version
- Kill Switch remains **active**
- Effective mode remains **demo**
- TRADING_ENGINE_ENABLED=false
- Zero broker connections

## Documentation/Test-Only Commits (safe to revert independently)

- `56501b5`, `563e553`, `e8b3de4` — tests, evidence, docs (no standalone runtime mutation)

## Commits With Runtime/Database Effects (revert together or verify PG after)

- `133aecc`, `712930a`, `23fdb3f`, `beb3274`, `00537a1`, `878e92c`
