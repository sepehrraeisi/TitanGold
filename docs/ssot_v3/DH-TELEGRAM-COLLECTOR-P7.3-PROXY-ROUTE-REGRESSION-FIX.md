# DH-TELEGRAM-COLLECTOR-P7.3 — Proxy Route Regression Fix

**Phase:** P7.3  
**Date:** 2026-06-30  
**Prior:** [P7.2 Write Auth Hotfix](./DH-TELEGRAM-COLLECTOR-P7.2-WRITE-AUTH-HOTFIX.md) · [P2 Route Repair](./DH-TELEGRAM-COLLECTOR-P2-ROUTE-REPAIR-SECURITY-UX-VERIFY.md)  
**Human QA URL:** `https://titan.zala.ir`

---

## 1. Human QA rejection (post-P7.2)

After P7.2 write-auth hotfix, production UI regressed:

| Symptom | Observed |
|---------|----------|
| Collector Status | **Degraded** |
| Telegram Accounts | `Telegram Collector proxy is unreachable. (HTTP 404)` |
| Average latency | — |
| Last Processed | - |

P7.2 local verification used `127.0.0.1:3002`, reintroducing suspicion that the P2 nginx route fix (`:5003`) was out of sync with the collector runtime.

---

## 2. Root cause

**Port drift between nginx upstream and PM2 collector runtime.**

| Layer | Port before fix | Port after fix |
|-------|-----------------|----------------|
| `/etc/nginx/sites-enabled/titan-zala` | **5003** (P2 fix — unchanged) | **5003** |
| PM2 `telegram-collector` (`ecosystem.config.json`, `.env`) | **3002** | **5003** |
| `ss -tlnp` collector listen | **3002** | **5003** |

nginx proxied to `:5003` while the collector listened on `:3002` → `connect() failed (111: Connection refused)` → nginx served HTML 404 (missing `50x.html` fallback). UI interpreted this as **proxy unreachable**.

P7.2 did not change nginx; it restarted PM2 from `ecosystem.config.json` which still declared `PORT=3002`, re-drifting the runtime away from the P2 source of truth.

---

## 3. Source of truth — 3002 vs 5003

| Component | Authoritative port |
|-----------|-------------------|
| Production nginx `/api/telegram-collector/*` | **5003** |
| PM2 `telegram-collector` | **5003** (aligned in P7.3) |
| `infrastructure/nginx.conf` (+ blue/green) | **5003** |
| `vite.config.ts` dev proxy (+ blue/green) | **5003** |
| `telegram-collector-monitor.js` default `COLLECTOR_URL` | **5003** |
| Port **3002** | **Not required** — nothing listens after fix |

Legacy `PORT=3002` in `telegram-collector/.env` and old audit scripts was the drift vector; repo `ecosystem.config.json` now documents **5003**.

---

## 4. Live nginx config proof

```text
/etc/nginx/sites-available/titan-zala:203:  proxy_pass http://127.0.0.1:5003;
/etc/nginx/sites-enabled/titan-zala:203:    proxy_pass http://127.0.0.1:5003;
sudo nginx -t → syntax ok
sudo systemctl reload nginx → success
```

---

## 5. Endpoint verification table

| Endpoint | Via nginx (HTTPS) | Direct `:5003` | Direct `:3002` |
|----------|-------------------|----------------|----------------|
| `GET /api/telegram-collector/health` | **200** JSON | **200** JSON | connection refused |
| `GET /api/telegram-collector/session/status` | **200** JSON | **200** JSON | connection refused |
| `GET /api/telegram-collector/accounts` | **200** JSON | **200** JSON | connection refused |
| `GET /api/telegram-collector/collector-channels` | **200** JSON | **200** JSON | connection refused |

Latency via nginx: ~100–150 ms. Direct local: ~10–26 ms.

---

## 6. Fix applied

1. `telegram-collector/ecosystem.config.json` — `PORT` **3002 → 5003**
2. `telegram-collector/.env` — `PORT=5003` (live only; gitignored)
3. `/etc/nginx/sites-available/titan-zala` — synced to **5003** (enabled already correct)
4. `pm2 delete telegram-collector && pm2 start ecosystem.config.json` — fresh env (restart alone kept stale `PORT=3002`)
5. `pm2 save`
6. `backend/scripts/telegram-collector-p72-write-auth-verify.mjs` — default base **5003**
7. New audit: `backend/scripts/telegram-collector-p73-route-regression-audit.mjs`

**Not changed:** P7.2 `collectorAuth.js` JWT secret precedence — write auth preserved.

---

## 7. Write auth regression proof (P7.2 intact)

Via nginx (`https://titan.zala.ir`):

| Action | Auth | Status |
|--------|------|--------|
| `PATCH /collector-channels/:id` (priority) | admin JWT | **200** |
| `PATCH /collector-channels/:id` | viewer JWT | **403** |
| `POST /channels/refresh` | admin JWT | **200** |
| `POST /channels/refresh` | none | **401** |

Evidence: `docs/ssot_v3/screenshots/telegram-collector-p72-write-auth-evidence.json` (re-run post-fix).

---

## 8. Browser evidence

Screenshot: `docs/ssot_v3/screenshots/telegram-collector-p73-current.png`  
JSON: `docs/ssot_v3/screenshots/telegram-collector-p73-route-regression-browser-evidence.json`

| Check | Result |
|-------|--------|
| Collector Status Healthy | ✅ |
| No proxy unreachable / 404 | ✅ |
| Average latency value | ✅ |
| Accounts loaded | ✅ |
| Channels loaded | ✅ |
| All 5 analytics tabs | ✅ |
| Agent Feed (5 agents) | ✅ 227–297 ms, HTTP 200 |

`Last Processed` may show dash when no recent ingestion timestamp exists — acceptable per QA criteria.

---

## 9. Final verdict

**REAL WORKING**

- Production UI no longer shows Degraded / proxy unreachable
- nginx collector endpoints return **200 JSON**
- P7.2 write auth passes (admin 200, viewer 403, no-auth 401)
- All five Telegram Collector tabs load
- Agent Feed remains fast (<500 ms per agent)

Telegram Collector proxy route regression after P7.2 is **closed**.
