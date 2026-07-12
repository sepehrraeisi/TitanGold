# DevOps Outage RCA — Backend Syntax Error (2026-07-12)

## Summary

Approximately one hour, PM2 reported `titan-backend` as **online** while port **5002 was not bound** and API requests failed. Root cause: **SyntaxError** in `backend/routes/settings.js` (extra closing brace) introduced during runtime SSOT work.

## Timeline

| Time (UTC) | Event |
|------------|-------|
| ~13:52 | Backend serving traffic normally |
| ~13:58 | PM2 restart after uncommitted deploy; `settings.js` fails to parse |
| ~13:58–14:37 | PM2 cluster shows `online`; port 5002 unbound; unhandled module rejection in logs |
| ~14:37 | Syntax error identified; brace removed; PM2 restart; port 5002 restored |

## Root Cause

1. Extra `}` in `routes/settings.js` line 138 → ESM import chain fails at load time
2. PM2 cluster mode may report process **online** briefly before module load failure propagates
3. No post-reload **port bind** or **HTTP health** gate in deployment flow
4. `/api/health` on wrong path returned 301 — curl without `-L` masked availability

## Corrective Actions (this work package)

1. **`scripts/verify-staging-deployment.sh`** — checks PM2, port 5002, `/api/health`, `/api/health/ready`, syntax errors in logs, optional runtime safety via token
2. **`/api/health/ready`** — adds `runtime_safety` check (demo + kill switch)
3. Kill switch monitor moved to **worker startup** (idle mode no longer skips ack)

## Why PM2 "online" Was Insufficient

- `listen_timeout` / crash loop: process starts, fails during route import, may exit and restart
- Health checks were not invoked automatically after reload
- Error buried in `titan-backend-error-*.log` as `SyntaxError: missing ) after argument list`

## Prevention

- Run `node --check` on changed route files before PM2 reload
- Run `./scripts/verify-staging-deployment.sh` after every backend reload; **exit non-zero blocks deploy**
- Alert on: port not listening + PM2 online mismatch (extend existing `titangold-backup-healthcheck.sh` pattern with `logger -p user.warning`)

## Environment

Host classified as **Mixed Development/Staging** — not production verification.
