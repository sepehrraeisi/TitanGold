# Deployment Target Classification

## Script examined

`scripts/deploy-production-frontend.sh`

## Exact target observed on this host

| Field | Value |
|-------|-------|
| Script default URL | `https://titan.zala.ir` (`PRODUCTION_URL`) |
| Nginx server_name | `titan.zala.ir` |
| Nginx root (frontend) | `/home/ubuntu/webapp/TitanGold/dist` |
| Dist destination | `/home/ubuntu/webapp/TitanGold/dist` (same as repo dist) |
| Active backend source | `/home/ubuntu/webapp/TitanGold/backend` (PM2 `titan-backend` cluster ×2, port 5002) |
| Active worker source | `/home/ubuntu/webapp/TitanGold/backend/workers/engineWorkerLeader.js` (fork) |
| Active Vite (dev only) | PM2 `titan-frontend` → `npm run dev` on `:3000` — **not** what nginx serves |
| Backend NODE_ENV | `development` (PM2 env on this host) |

## Staging vs Production

**Classification for Human QA:** this host + `titan.zala.ir` is the **staging / shared application host** used throughout the Runtime Safety work package.

Evidence:

- Access docs labeled Staging (`docs/STAGING_ACCESS.md`)
- Kill Switch permanently active; demo mode enforced
- Zero broker connections; trading engine deployment disabled
- Disposable Playwright fixtures (`runtime-safety-fixture-*`)
- Script **name** says “production” because it performs a **production-style** build+nginx dist deploy, not because a separate prod farm was verified

**Do not claim Production verification** for a second isolated production environment: **none was verified on this host**. Only one nginx site (`titan-zala`) is enabled with `server_name titan.zala.ir`.

## Script naming

**Technical debt:** name `deploy-production-frontend.sh` is historically/misleading for this environment. Behavior on this host is correct (build → `dist` → nginx reload → smoke `titan.zala.ir`). Rename not required for Human QA.

## Credentials / unrelated environments

- Script does not inject exchange secrets
- Deployment observed: rebuild of repo `dist` + nginx reload only
- No second environment / cluster was deployed by the qualification runs
- Real Live trading credentials were not activated; broker connections remain 0
