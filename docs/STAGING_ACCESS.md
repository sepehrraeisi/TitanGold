# Staging Access — Human QA

## Approved Access Method

**Primary:** Internal host browser / SSH tunnel to staging services on the application host.

| Service | URL | Purpose |
|---------|-----|---------|
| Frontend (dev) | `http://localhost:3000/?view=ai&dev-login` | UI panels with dev session |
| Frontend (dist) | Served via Nginx on host | Production-style bundle |
| Backend API | `http://127.0.0.1:5002/api/v1` | REST API |
| Health | `http://127.0.0.1:5002/api/v1/health/ready` | Runtime safety verification |

## Remote Access (without exposing dev server publicly)

From an approved workstation on the internal network or via VPN:

```bash
# SSH tunnel — replace HOST with approved staging host
ssh -L 3000:127.0.0.1:3000 -L 5002:127.0.0.1:5002 USER@HOST
```

Then open locally:

- UI: `http://localhost:3000/?view=ai`
- API: `http://127.0.0.1:5002/api/v1/health/ready`

**Do not** bind Vite dev server to `0.0.0.0` or expose port 3000 to the public internet.

## Pre-QA Verification Checklist

1. `git rev-parse HEAD` matches deployed commit (`e8b3de4` or newer)
2. Frontend bundle hash matches `dist/assets/*` from that commit
3. `./scripts/verify-staging-deployment.sh` exits 0
4. `/api/v1/health/ready` → `runtime_safety.killSwitchActive=true`, `effectiveMode=demo`
5. Role fixtures available via integration tests (`backend/__tests__/helpers/roleFixtures.js`)
6. No production exchange credentials in `.env` or PM2 env
7. Live trading disabled; Kill Switch active

## Authentication for QA

- **Integration tests:** disposable DB fixtures (`runtime-safety-fixture-*@titangold.test`)
- **Browser dev QA:** `?dev-login` query param (development mode only)
- **Production-style QA:** use real staging credentials issued by ops (not documented here)

## Nginx Route Verification

```bash
curl -sS http://127.0.0.1:5002/api/v1/health
# If NGINX_URL set:
# curl -sS $NGINX_URL/api/v1/health
```

## Runtime Safety (must remain after access setup)

- Global mode: **demo**
- Kill Switch: **active** (never cleared for QA setup)
- Worker acknowledgement: **current revision**
- TRADING_ENGINE_ENABLED: **false**
- Broker connections: **0**
